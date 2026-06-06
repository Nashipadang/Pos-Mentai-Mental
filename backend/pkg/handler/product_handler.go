package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

type ProductHandler struct {
	productRepo repository.ProductRepository
}

func NewProductHandler(pr repository.ProductRepository) *ProductHandler {
	return &ProductHandler{productRepo: pr}
}

func (h *ProductHandler) RegisterRoutes(r *gin.RouterGroup) {
	products := r.Group("/products", middleware.AuthRequired())
	{
		products.GET("", h.GetAll)
		products.GET("/:id", h.GetByID)
		products.POST("", middleware.RequireRole(model.RoleOwner), h.Create)
		products.PUT("/:id", middleware.RequireRole(model.RoleOwner), h.Update)
		products.DELETE("/:id", middleware.RequireRole(model.RoleOwner), h.Delete)
	}

	categories := r.Group("/categories", middleware.AuthRequired())
	{
		categories.GET("", h.GetAllCategories)
		categories.POST("", middleware.RequireRole(model.RoleOwner, model.RoleStaff), h.CreateCategory)
		categories.PUT("/:id", middleware.RequireRole(model.RoleOwner), h.UpdateCategory)
		categories.DELETE("/:id", middleware.RequireRole(model.RoleOwner), h.DeleteCategory)
	}
}

// GetAll retrieves list of products
// @Summary      Get All Products
// @Description  Get a list of all products, optionally filtered by name search, category, or active status
// @Tags         product
// @Security     BearerAuth
// @Param        search query string false "Search products by name"
// @Param        category_id query int false "Filter products by category ID"
// @Param        is_active query bool false "Filter only active products"
// @Param        only_active query bool false "Filter only active products (backward compatibility)"
// @Produce      json
// @Success      200 {object} Response{data=[]model.Product}
// @Failure      500 {object} Response
// @Router       /products [get]
func (h *ProductHandler) GetAll(c *gin.Context) {
	search := c.Query("search")
	categoryIDStr := c.Query("category_id")
	isActiveStr := c.Query("is_active")
	onlyActiveStr := c.Query("only_active")

	var categoryID int
	if categoryIDStr != "" {
		if id, err := strconv.Atoi(categoryIDStr); err == nil {
			categoryID = id
		}
	}

	onlyActive := isActiveStr == "true" || onlyActiveStr == "true"

	products, err := h.productRepo.GetAll(search, categoryID, onlyActive)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data produk: "+err.Error())
		return
	}
	Success(c, http.StatusOK, products)
}

// GetByID returns a single product by ID
// @Summary      Get Product by ID
// @Description  Get detailed information about a single product
// @Tags         product
// @Security     BearerAuth
// @Param        id path string true "Product UUID"
// @Produce      json
// @Success      200 {object} Response{data=model.Product}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /products/{id} [get]
func (h *ProductHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	p, err := h.productRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil detail produk")
		return
	}
	if p == nil {
		Error(c, http.StatusNotFound, "Produk tidak ditemukan")
		return
	}
	Success(c, http.StatusOK, p)
}

type CreateProductRequest struct {
	CategoryID int     `json:"category_id" binding:"required"`
	Name       string  `json:"name" binding:"required"`
	Price      float64 `json:"price" binding:"required,gte=0"`
	ImageURL   *string `json:"image_url"`
	IsActive   *bool   `json:"is_active"`
}

// Create registers a new product
// @Summary      Create Product
// @Description  Add a new product to the POS system
// @Tags         product
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateProductRequest true "Product Info"
// @Success      201 {object} Response{data=model.Product}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /products [post]
func (h *ProductHandler) Create(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data produk tidak valid")
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	p := &model.Product{
		ID:         uuid.New(),
		CategoryID: req.CategoryID,
		Name:       req.Name,
		Price:      req.Price,
		ImageURL:   req.ImageURL,
		IsActive:   isActive,
	}

	err := h.productRepo.Create(p)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan produk")
		return
	}

	// Fetch detail again to include category name
	pDetail, err := h.productRepo.GetByID(p.ID)
	if err == nil && pDetail != nil {
		p = pDetail
	}

	Success(c, http.StatusCreated, p)
}

type UpdateProductRequest struct {
	CategoryID *int     `json:"category_id"`
	Name       *string  `json:"name"`
	Price      *float64 `json:"price" binding:"omitempty,gte=0"`
	ImageURL   *string  `json:"image_url"`
	IsActive   *bool    `json:"is_active"`
}

// Update modifies an existing product
// @Summary      Update Product
// @Description  Modify pricing, details or status of a product
// @Tags         product
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "Product UUID"
// @Param        request body UpdateProductRequest true "Product Info"
// @Success      200 {object} Response{data=model.Product}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /products/{id} [put]
// Update modifies an existing product
func (h *ProductHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data produk tidak valid")
		return
	}

	existing, err := h.productRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mencari produk")
		return
	}
	if existing == nil {
		Error(c, http.StatusNotFound, "Produk tidak ditemukan")
		return
	}

	if req.CategoryID != nil {
		existing.CategoryID = *req.CategoryID
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Price != nil {
		existing.Price = *req.Price
	}
	if req.ImageURL != nil {
		existing.ImageURL = req.ImageURL
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	err = h.productRepo.Update(existing)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengubah produk")
		return
	}

	pDetail, err := h.productRepo.GetByID(id)
	if err == nil && pDetail != nil {
		existing = pDetail
	}

	Success(c, http.StatusOK, existing)
}

// Delete archives or removes a product
// @Summary      Delete Product
// @Description  Delete product and clear related recipe assignments
// @Tags         product
// @Security     BearerAuth
// @Param        id path string true "Product UUID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /products/{id} [delete]
func (h *ProductHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	err = h.productRepo.Delete(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus produk")
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr})
}

// GetAllCategories returns list of categories
// @Summary      Get All Categories
// @Description  Get a list of all product categories
// @Tags         product
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.Category}
// @Failure      500 {object} Response
// @Router       /categories [get]
func (h *ProductHandler) GetAllCategories(c *gin.Context) {
	categories, err := h.productRepo.GetAllCategories()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil kategori")
		return
	}
	Success(c, http.StatusOK, categories)
}

type CreateCategoryRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateCategory registers a new category
// @Summary      Create Category
// @Description  Add a new product category
// @Tags         product
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateCategoryRequest true "Category Info"
// @Success      201 {object} Response{data=model.Category}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /categories [post]
func (h *ProductHandler) CreateCategory(c *gin.Context) {
	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Nama kategori diperlukan")
		return
	}

	cat := &model.Category{Name: req.Name}
	err := h.productRepo.CreateCategory(cat)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan kategori")
		return
	}
	Success(c, http.StatusCreated, cat)
}

type UpdateCategoryRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateCategory modifies category details
// @Summary      Update Category
// @Description  Rename an existing product category
// @Tags         product
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path int true "Category ID"
// @Param        request body UpdateCategoryRequest true "Category Info"
// @Success      200 {object} Response{data=model.Category}
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /categories/{id} [put]
func (h *ProductHandler) UpdateCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID kategori tidak valid")
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Nama kategori diperlukan")
		return
	}

	cat := &model.Category{ID: id, Name: req.Name}
	err = h.productRepo.UpdateCategory(cat)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengubah kategori")
		return
	}
	Success(c, http.StatusOK, cat)
}

// DeleteCategory removes a product category
// @Summary      Delete Category
// @Description  Delete a product category from the system
// @Tags         product
// @Security     BearerAuth
// @Param        id path int true "Category ID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /categories/{id} [delete]
func (h *ProductHandler) DeleteCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID kategori tidak valid")
		return
	}

	err = h.productRepo.DeleteCategory(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus kategori")
		return
	}
	Success(c, http.StatusOK, gin.H{"id": id})
}
