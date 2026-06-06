package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

type CustomerHandler struct {
	customerRepo repository.CustomerRepository
}

func NewCustomerHandler(cr repository.CustomerRepository) *CustomerHandler {
	return &CustomerHandler{customerRepo: cr}
}

func (h *CustomerHandler) RegisterRoutes(r *gin.RouterGroup) {
	cust := r.Group("/customers", middleware.AuthRequired())
	{
		cust.GET("", h.GetAll)
		cust.GET("/:id", h.GetByID)
		cust.POST("", h.Create)
		cust.PUT("/:id", h.Update)
		cust.DELETE("/:id", middleware.RequireRole(model.RoleOwner), h.Delete)
	}
}

// GetAll returns a list of customers
// @Summary      Get All Customers
// @Description  Get a list of all registered customers sorted by name
// @Tags         customer
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.Customer}
// @Failure      500 {object} Response
// @Router       /customers [get]
func (h *CustomerHandler) GetAll(c *gin.Context) {
	customers, err := h.customerRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data customer")
		return
	}
	Success(c, http.StatusOK, customers)
}

// GetByID returns detailed customer profile
// @Summary      Get Customer by ID
// @Description  Get total transactions, total spent, and basic details of a customer
// @Tags         customer
// @Security     BearerAuth
// @Param        id path string true "Customer UUID"
// @Produce      json
// @Success      200 {object} Response{data=model.Customer}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /customers/{id} [get]
func (h *CustomerHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	cust, err := h.customerRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil detail customer")
		return
	}
	if cust == nil {
		Error(c, http.StatusNotFound, "Customer tidak ditemukan")
		return
	}
	Success(c, http.StatusOK, cust)
}

type CreateCustomerRequest struct {
	Name  string `json:"name" binding:"required"`
	Phone string `json:"phone" binding:"required"`
}

// Create registers a new customer
// @Summary      Create Customer
// @Description  Register a new customer for loyalty spent tracking
// @Tags         customer
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateCustomerRequest true "Customer Info"
// @Success      201 {object} Response{data=model.Customer}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /customers [post]
func (h *CustomerHandler) Create(c *gin.Context) {
	var req CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Nama dan nomor telepon diperlukan")
		return
	}

	// Check phone uniqueness
	existing, err := h.customerRepo.GetByPhone(req.Phone)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memverifikasi nomor telepon")
		return
	}
	if existing != nil {
		Error(c, http.StatusConflict, "Nomor telepon sudah terdaftar")
		return
	}

	cust := &model.Customer{
		ID:                uuid.New(),
		Name:              req.Name,
		Phone:             req.Phone,
		TotalTransactions: 0,
		TotalSpent:        0,
	}

	err = h.customerRepo.Create(cust)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal membuat customer baru")
		return
	}
	Success(c, http.StatusCreated, cust)
}

type UpdateCustomerRequest struct {
	Name  string `json:"name" binding:"required"`
	Phone string `json:"phone" binding:"required"`
}

// Update modifies customer profile details
// @Summary      Update Customer
// @Description  Modify name or phone number of a customer
// @Tags         customer
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "Customer UUID"
// @Param        request body UpdateCustomerRequest true "Customer Info"
// @Success      200 {object} Response{data=model.Customer}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /customers/{id} [put]
func (h *CustomerHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Nama dan nomor telepon diperlukan")
		return
	}

	existing, err := h.customerRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mencari data customer")
		return
	}
	if existing == nil {
		Error(c, http.StatusNotFound, "Customer tidak ditemukan")
		return
	}

	// Check if phone changed, and verify unique phone
	if req.Phone != existing.Phone {
		byPhone, err := h.customerRepo.GetByPhone(req.Phone)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memverifikasi nomor telepon")
			return
		}
		if byPhone != nil && byPhone.ID != id {
			Error(c, http.StatusConflict, "Nomor telepon sudah digunakan oleh customer lain")
			return
		}
	}

	existing.Name = req.Name
	existing.Phone = req.Phone

	err = h.customerRepo.Update(existing)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengubah data customer")
		return
	}
	Success(c, http.StatusOK, existing)
}

// Delete archives or removes customer details
// @Summary      Delete Customer
// @Description  Remove customer profile from the system
// @Tags         customer
// @Security     BearerAuth
// @Param        id path string true "Customer UUID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /customers/{id} [delete]
func (h *CustomerHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	err = h.customerRepo.Delete(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus data customer")
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr})
}
