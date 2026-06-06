package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

type InventoryHandler struct {
	ingRepo      repository.IngredientRepository
	movementRepo repository.StockMovementRepository
}

func NewInventoryHandler(ir repository.IngredientRepository, smr repository.StockMovementRepository) *InventoryHandler {
	return &InventoryHandler{ingRepo: ir, movementRepo: smr}
}

func (h *InventoryHandler) RegisterRoutes(r *gin.RouterGroup) {
	ing := r.Group("/ingredients", middleware.AuthRequired())
	{
		ing.GET("", h.GetAll)
		ing.GET("/movements", h.GetMovements)
		ing.GET("/:id", h.GetByID)
		ing.POST("/:id/restock", h.Restock)
		
		// Modifications restricted to Owner
		ing.POST("", middleware.RequireRole(model.RoleOwner), h.Create)
		ing.PUT("/:id", middleware.RequireRole(model.RoleOwner), h.Update)
		ing.DELETE("/:id", middleware.RequireRole(model.RoleOwner), h.Delete)
	}
}

// GetAll returns a list of ingredients
// @Summary      Get All Ingredients
// @Description  Get a list of all raw ingredients and their current stock levels
// @Tags         inventory
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.Ingredient}
// @Failure      500 {object} Response
// @Router       /ingredients [get]
func (h *InventoryHandler) GetAll(c *gin.Context) {
	ingredients, err := h.ingRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data bahan baku")
		return
	}
	Success(c, http.StatusOK, ingredients)
}

// GetByID returns detailed information about an ingredient
// @Summary      Get Ingredient by ID
// @Description  Get current stock, unit, and threshold for a single ingredient
// @Tags         inventory
// @Security     BearerAuth
// @Param        id path string true "Ingredient UUID"
// @Produce      json
// @Success      200 {object} Response{data=model.Ingredient}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /ingredients/{id} [get]
func (h *InventoryHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	ing, err := h.ingRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil detail bahan baku")
		return
	}
	if ing == nil {
		Error(c, http.StatusNotFound, "Bahan baku tidak ditemukan")
		return
	}
	Success(c, http.StatusOK, ing)
}

type CreateIngredientRequest struct {
	Name         string   `json:"name" binding:"required"`
	Unit         string   `json:"unit" binding:"required"`
	CurrentStock float64  `json:"current_stock"`
	MinThreshold *float64 `json:"min_threshold"`
}

// Create inserts a new ingredient record
// @Summary      Create Ingredient
// @Description  Add a new raw ingredient to inventory catalog
// @Tags         inventory
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateIngredientRequest true "Ingredient Details"
// @Success      201 {object} Response{data=model.Ingredient}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /ingredients [post]
func (h *InventoryHandler) Create(c *gin.Context) {
	var req CreateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Bahan baku tidak valid")
		return
	}

	ing := &model.Ingredient{
		ID:           uuid.New(),
		Name:         req.Name,
		Unit:         req.Unit,
		CurrentStock: req.CurrentStock,
		MinThreshold: req.MinThreshold,
	}

	err := h.ingRepo.Create(ing)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal membuat bahan baku")
		return
	}
	
	// If initial stock is logged, record as 'in' stock movement
	if req.CurrentStock > 0 {
		notes := "Stok awal bahan baku"
		_ = h.movementRepo.Create(&model.StockMovement{
			IngredientID: ing.ID,
			Type:         model.StockIn,
			Quantity:     req.CurrentStock,
			Notes:        &notes,
		})
	}

	Success(c, http.StatusCreated, ing)
}

type UpdateIngredientRequest struct {
	Name         string   `json:"name" binding:"required"`
	Unit         string   `json:"unit" binding:"required"`
	CurrentStock float64  `json:"current_stock" binding:"required,gte=0"`
	MinThreshold *float64 `json:"min_threshold"`
}

// Update modifies ingredient settings
// @Summary      Update Ingredient
// @Description  Update unit, threshold, or base stock values
// @Tags         inventory
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "Ingredient UUID"
// @Param        request body UpdateIngredientRequest true "Ingredient Info"
// @Success      200 {object} Response{data=model.Ingredient}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /ingredients/{id} [put]
func (h *InventoryHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req UpdateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Bahan baku tidak valid")
		return
	}

	existing, err := h.ingRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mencari bahan baku")
		return
	}
	if existing == nil {
		Error(c, http.StatusNotFound, "Bahan baku tidak ditemukan")
		return
	}

	// Log discrepancy as stock movement if manual correction of stock level is made via update
	if req.CurrentStock != existing.CurrentStock {
		var mType model.StockMovementType
		var diff float64
		var note string
		if req.CurrentStock > existing.CurrentStock {
			mType = model.StockIn
			diff = req.CurrentStock - existing.CurrentStock
			note = "Koreksi manual stok (Penambahan)"
		} else {
			mType = model.StockOut
			diff = existing.CurrentStock - req.CurrentStock
			note = "Koreksi manual stok (Pengurangan)"
		}
		_ = h.movementRepo.Create(&model.StockMovement{
			IngredientID: id,
			Type:         mType,
			Quantity:     diff,
			Notes:        &note,
		})
	}

	existing.Name = req.Name
	existing.Unit = req.Unit
	existing.CurrentStock = req.CurrentStock
	existing.MinThreshold = req.MinThreshold

	err = h.ingRepo.Update(existing)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengubah bahan baku")
		return
	}
	Success(c, http.StatusOK, existing)
}

// Delete removes an ingredient from catalog
// @Summary      Delete Ingredient
// @Description  Delete an ingredient from system. Cascade clears recipe assignments
// @Tags         inventory
// @Security     BearerAuth
// @Param        id path string true "Ingredient UUID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /ingredients/{id} [delete]
func (h *InventoryHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	err = h.ingRepo.Delete(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus bahan baku")
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr})
}

type RestockRequest struct {
	Quantity float64 `json:"quantity" binding:"required,gt=0"`
	Notes    string  `json:"notes"`
}

// Restock increments ingredient stock level and records audit log
// @Summary      Restock Ingredient
// @Description  Increase stock level for an ingredient and write incoming log
// @Tags         inventory
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "Ingredient UUID"
// @Param        request body RestockRequest true "Restock Volume"
// @Success      200 {object} Response{data=model.Ingredient}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /ingredients/{id}/restock [post]
func (h *InventoryHandler) Restock(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req RestockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Jumlah restocking harus lebih besar dari 0")
		return
	}

	existing, err := h.ingRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mencari bahan baku")
		return
	}
	if existing == nil {
		Error(c, http.StatusNotFound, "Bahan baku tidak ditemukan")
		return
	}

	// Update stock level
	err = h.ingRepo.UpdateStock(id, req.Quantity)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menambah stok")
		return
	}

	// Record stock movement
	noteVal := req.Notes
	if noteVal == "" {
		noteVal = "Restock bahan baku"
	}
	movement := &model.StockMovement{
		ID:           uuid.New(),
		IngredientID: id,
		Type:         model.StockIn,
		Quantity:     req.Quantity,
		Notes:        &noteVal,
	}
	_ = h.movementRepo.Create(movement)

	// Fetch updated object
	existing, _ = h.ingRepo.GetByID(id)
	Success(c, http.StatusOK, existing)
}

// GetMovements returns audit movements for ingredients
// @Summary      Get Stock Movements
// @Description  Get a log of all incoming and outgoing stock transactions
// @Tags         inventory
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.StockMovement}
// @Failure      500 {object} Response
// @Router       /ingredients/movements [get]
func (h *InventoryHandler) GetMovements(c *gin.Context) {
	movements, err := h.movementRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data log stok")
		return
	}
	Success(c, http.StatusOK, movements)
}
