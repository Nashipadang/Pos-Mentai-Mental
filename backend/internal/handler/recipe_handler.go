package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mentaimental/pos-backend/internal/middleware"
	"github.com/mentaimental/pos-backend/internal/model"
	"github.com/mentaimental/pos-backend/internal/repository"
)

type RecipeHandler struct {
	recipeRepo repository.RecipeRepository
}

func NewRecipeHandler(rr repository.RecipeRepository) *RecipeHandler {
	return &RecipeHandler{recipeRepo: rr}
}

func (h *RecipeHandler) RegisterRoutes(r *gin.RouterGroup) {
	recipes := r.Group("/recipes", middleware.AuthRequired())
	{
		recipes.GET("", h.GetAll)
		recipes.GET("/product/:product_id", h.GetByProductID)
		recipes.POST("/product/:product_id", middleware.RequireRole(model.RoleOwner), h.SaveRecipe)
	}
}

// GetAll returns a list of all recipe items
// @Summary      Get All Recipe Items
// @Description  Get list of all Bill of Materials (BOM) mappings
// @Tags         recipe
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.RecipeItem}
// @Failure      500 {object} Response
// @Router       /recipes [get]
func (h *RecipeHandler) GetAll(c *gin.Context) {
	items, err := h.recipeRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data resep")
		return
	}
	Success(c, http.StatusOK, items)
}

// GetByProductID returns BOM ingredients for a product
// @Summary      Get Product Recipe
// @Description  Get a list of raw ingredients and quantities required for a single product
// @Tags         recipe
// @Security     BearerAuth
// @Param        product_id path string true "Product UUID"
// @Produce      json
// @Success      200 {object} Response{data=[]model.RecipeItem}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /recipes/product/{product_id} [get]
func (h *RecipeHandler) GetByProductID(c *gin.Context) {
	prodIDStr := c.Param("product_id")
	prodID, err := uuid.Parse(prodIDStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "Product ID tidak valid")
		return
	}

	items, err := h.recipeRepo.GetByProductID(prodID)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data resep produk")
		return
	}
	Success(c, http.StatusOK, items)
}

type SaveRecipeItemRequest struct {
	IngredientID string  `json:"ingredient_id" binding:"required"`
	Quantity     float64 `json:"quantity" binding:"required,gt=0"`
}

// SaveRecipe updates BOM recipe ingredients list for a product
// @Summary      Save Product Recipe
// @Description  Replace all recipe items (BOM mapping) for a product
// @Tags         recipe
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        product_id path string true "Product UUID"
// @Param        request body []SaveRecipeItemRequest true "Recipe Items List"
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /recipes/product/{product_id} [post]
func (h *RecipeHandler) SaveRecipe(c *gin.Context) {
	prodIDStr := c.Param("product_id")
	prodID, err := uuid.Parse(prodIDStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "Product ID tidak valid")
		return
	}

	var reqItems []SaveRecipeItemRequest
	if err := c.ShouldBindJSON(&reqItems); err != nil {
		Error(c, http.StatusBadRequest, "Data komposisi resep tidak valid")
		return
	}

	var modelItems []model.RecipeItem
	for _, req := range reqItems {
		ingID, err := uuid.Parse(req.IngredientID)
		if err != nil {
			Error(c, http.StatusBadRequest, "Ingredient ID tidak valid: "+req.IngredientID)
			return
		}
		modelItems = append(modelItems, model.RecipeItem{
			ID:           uuid.New(),
			ProductID:    prodID,
			IngredientID: ingID,
			Quantity:     req.Quantity,
		})
	}

	err = h.recipeRepo.SaveRecipe(prodID, modelItems)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan komposisi resep")
		return
	}

	Success(c, http.StatusOK, gin.H{"status": "success", "message": "Resep berhasil disimpan"})
}
