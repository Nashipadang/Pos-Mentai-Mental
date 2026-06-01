package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/internal/middleware"
	"github.com/mentaimental/pos-backend/internal/model"
	"github.com/mentaimental/pos-backend/internal/repository"
)

type PromoHandler struct {
	promoRepo repository.PromoRepository
}

func NewPromoHandler(pr repository.PromoRepository) *PromoHandler {
	return &PromoHandler{promoRepo: pr}
}

func (h *PromoHandler) RegisterRoutes(r *gin.RouterGroup) {
	promos := r.Group("/promos")
	{
		// Authenticated routes
		promos.GET("", middleware.AuthRequired(), h.GetAllActive)
		promos.POST("/check", middleware.AuthRequired(), h.CheckEligibility)

		// Owner only CRUD
		admin := promos.Group("", middleware.AuthRequired(), middleware.RequireRole(model.RoleOwner))
		{
			admin.GET("/all", h.GetAll)
			admin.POST("", h.Create)
			admin.PUT("/:id", h.Update)
			admin.DELETE("/:id", h.Delete)
		}
	}
}

type CheckPromoRequest struct {
	Code        string  `json:"code" binding:"required"`
	TotalAmount float64 `json:"total_amount" binding:"required,gt=0"`
}

type CheckPromoResponse struct {
	Valid          bool     `json:"valid"`
	Message        string   `json:"message"`
	DiscountAmount float64  `json:"discount_amount"`
	FinalAmount    float64  `json:"final_amount"`
	Type           string   `json:"type"`
	Value          float64  `json:"value"`
	MaxDiscount    *float64 `json:"max_discount,omitempty"`
}

// GetAllActive lists active promo coupons
func (h *PromoHandler) GetAllActive(c *gin.Context) {
	promos, err := h.promoRepo.GetAllActive()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data promo: "+err.Error())
		return
	}
	Success(c, http.StatusOK, promos)
}

// CheckEligibility validates promo code usage and returns discount details
func (h *PromoHandler) CheckEligibility(c *gin.Context) {
	var req CheckPromoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data pencarian promo tidak valid")
		return
	}

	p, err := h.promoRepo.GetByCode(strings.ToUpper(strings.TrimSpace(req.Code)))
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memproses validasi promo: "+err.Error())
		return
	}

	if p == nil {
		Success(c, http.StatusOK, CheckPromoResponse{
			Valid:          false,
			Message:        "Kode promo tidak ditemukan",
			DiscountAmount: 0,
			FinalAmount:    req.TotalAmount,
		})
		return
	}

	if !p.IsActive {
		Success(c, http.StatusOK, CheckPromoResponse{
			Valid:          false,
			Message:        "Kode promo sudah tidak aktif",
			DiscountAmount: 0,
			FinalAmount:    req.TotalAmount,
		})
		return
	}

	if req.TotalAmount < p.MinTransaction {
		Success(c, http.StatusOK, CheckPromoResponse{
			Valid:          false,
			Message:        "Total belanja belum memenuhi syarat minimum untuk menggunakan promo ini",
			DiscountAmount: 0,
			FinalAmount:    req.TotalAmount,
		})
		return
	}

	var discount float64
	if p.Type == "percentage" {
		discount = (p.Value / 100.0) * req.TotalAmount
		if p.MaxDiscount != nil && *p.MaxDiscount > 0 && discount > *p.MaxDiscount {
			discount = *p.MaxDiscount
		}
		if discount > req.TotalAmount {
			discount = req.TotalAmount
		}
	} else if p.Type == "flat" {
		discount = p.Value
		if discount > req.TotalAmount {
			discount = req.TotalAmount
		}
	}

	Success(c, http.StatusOK, CheckPromoResponse{
		Valid:          true,
		Message:        "Promo berhasil diterapkan!",
		DiscountAmount: discount,
		FinalAmount:    req.TotalAmount - discount,
		Type:           p.Type,
		Value:          p.Value,
		MaxDiscount:    p.MaxDiscount,
	})
}

// GetAll lists all active and inactive promo coupons (owner only)
func (h *PromoHandler) GetAll(c *gin.Context) {
	promos, err := h.promoRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data promo: "+err.Error())
		return
	}
	Success(c, http.StatusOK, promos)
}

// Create inserts a new promo coupon (owner only)
func (h *PromoHandler) Create(c *gin.Context) {
	var p model.Promo
	if err := c.ShouldBindJSON(&p); err != nil {
		Error(c, http.StatusBadRequest, "Data promo tidak valid: "+err.Error())
		return
	}

	if p.Code == "" || p.Type == "" || p.Value <= 0 {
		Error(c, http.StatusBadRequest, "Kode, tipe, dan nilai potongan harus diisi dengan benar")
		return
	}

	p.Code = strings.ToUpper(strings.TrimSpace(p.Code))

	// Check if code already exists
	existing, _ := h.promoRepo.GetByCode(p.Code)
	if existing != nil {
		Error(c, http.StatusConflict, "Kode voucher sudah digunakan")
		return
	}

	err := h.promoRepo.Create(&p)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan promo: "+err.Error())
		return
	}
	Success(c, http.StatusCreated, p)
}

// Update modifies an existing promo coupon (owner only)
func (h *PromoHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID promo tidak valid")
		return
	}

	var p model.Promo
	if err := c.ShouldBindJSON(&p); err != nil {
		Error(c, http.StatusBadRequest, "Data update tidak valid: "+err.Error())
		return
	}
	p.ID = id
	p.Code = strings.ToUpper(strings.TrimSpace(p.Code))

	// Check if another promo has the same code
	existing, _ := h.promoRepo.GetByCode(p.Code)
	if existing != nil && existing.ID != p.ID {
		Error(c, http.StatusConflict, "Kode voucher sudah digunakan oleh voucher lain")
		return
	}

	err = h.promoRepo.Update(&p)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengubah promo: "+err.Error())
		return
	}
	Success(c, http.StatusOK, p)
}

// Delete removes a promo coupon (owner only)
func (h *PromoHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	_, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID promo tidak valid")
		return
	}

	err = h.promoRepo.Delete(idStr)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus promo: "+err.Error())
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr})
}
