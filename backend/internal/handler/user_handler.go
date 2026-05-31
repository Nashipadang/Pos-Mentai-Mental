package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/mentaimental/pos-backend/internal/middleware"
	"github.com/mentaimental/pos-backend/internal/model"
	"github.com/mentaimental/pos-backend/internal/repository"
)

type UserHandler struct {
	userRepo repository.UserRepository
}

func NewUserHandler(ur repository.UserRepository) *UserHandler {
	return &UserHandler{userRepo: ur}
}

func (h *UserHandler) RegisterRoutes(r *gin.RouterGroup) {
	// Protected owner-only routes for user management
	users := r.Group("/users", middleware.AuthRequired(), middleware.RequireRole(model.RoleOwner))
	{
		users.GET("", h.GetAll)
		users.GET("/:id", h.GetByID)
		users.POST("", h.Create)
		users.PUT("/:id", h.Update)
		users.DELETE("/:id", h.Delete)
	}
}

// GetAll lists all registered users
// @Summary      Get All Users
// @Description  Get a list of all user accounts (owner-only)
// @Tags         user
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.User}
// @Failure      403 {object} Response
// @Failure      500 {object} Response
// @Router       /users [get]
func (h *UserHandler) GetAll(c *gin.Context) {
	users, err := h.userRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil daftar pengguna: "+err.Error())
		return
	}
	Success(c, http.StatusOK, users)
}

// GetByID retrieves detailed user profile
// @Summary      Get User by ID
// @Description  Get information of a single user account
// @Tags         user
// @Security     BearerAuth
// @Param        id path string true "User UUID"
// @Produce      json
// @Success      200 {object} Response{data=model.User}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /users/{id} [get]
func (h *UserHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	u, err := h.userRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data pengguna")
		return
	}
	if u == nil {
		Error(c, http.StatusNotFound, "Pengguna tidak ditemukan")
		return
	}
	Success(c, http.StatusOK, u)
}

type CreateUserRequest struct {
	Name     string     `json:"name" binding:"required"`
	Email    string     `json:"email" binding:"required,email"`
	Password string     `json:"password" binding:"required,min=6"`
	Role     model.Role `json:"role" binding:"required,oneof=owner kasir staff"`
	IsActive *bool      `json:"is_active"`
}

// Create inserts a new user account
// @Summary      Create User
// @Description  Create a new cashier, staff, or owner user account with a hashed password
// @Tags         user
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateUserRequest true "User Info"
// @Success      201 {object} Response{data=model.User}
// @Failure      400 {object} Response
// @Failure      409 {object} Response
// @Failure      500 {object} Response
// @Router       /users [post]
func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data input tidak valid")
		return
	}

	// Verify email uniqueness
	existing, err := h.userRepo.GetByEmail(req.Email)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memverifikasi alamat email")
		return
	}
	if existing != nil {
		Error(c, http.StatusConflict, "Alamat email sudah terdaftar")
		return
	}

	// Hash password
	hashedPass, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengenkripsi kata sandi")
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	u := &model.User{
		ID:           uuid.New(),
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPass),
		Role:         req.Role,
		IsActive:     isActive,
	}

	err = h.userRepo.Create(u)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan akun baru: "+err.Error())
		return
	}

	Success(c, http.StatusCreated, u)
}

type UpdateUserRequest struct {
	Name     string     `json:"name" binding:"required"`
	Email    string     `json:"email" binding:"required,email"`
	Password string     `json:"password"` // Optional
	Role     model.Role `json:"role" binding:"required,oneof=owner kasir staff"`
	IsActive *bool      `json:"is_active"`
}

// Update modifies account settings
// @Summary      Update User
// @Description  Update user profile details, roles, or change passwords
// @Tags         user
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "User UUID"
// @Param        request body UpdateUserRequest true "User Info"
// @Success      200 {object} Response{data=model.User}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /users/{id} [put]
func (h *UserHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data input tidak valid")
		return
	}

	existing, err := h.userRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mencari data pengguna")
		return
	}
	if existing == nil {
		Error(c, http.StatusNotFound, "Pengguna tidak ditemukan")
		return
	}

	// Verify email uniqueness if email changed
	if req.Email != existing.Email {
		byEmail, err := h.userRepo.GetByEmail(req.Email)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memverifikasi alamat email")
			return
		}
		if byEmail != nil && byEmail.ID != id {
			Error(c, http.StatusConflict, "Alamat email sudah terdaftar pada pengguna lain")
			return
		}
	}

	// Update fields
	existing.Name = req.Name
	existing.Email = req.Email
	existing.Role = req.Role
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	// Hash password only if non-empty
	if req.Password != "" {
		if len(req.Password) < 6 {
			Error(c, http.StatusBadRequest, "Kata sandi minimal terdiri dari 6 karakter")
			return
		}
		hashedPass, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal mengenkripsi kata sandi")
			return
		}
		existing.PasswordHash = string(hashedPass)
	}

	err = h.userRepo.Update(existing)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan perubahan: "+err.Error())
		return
	}

	Success(c, http.StatusOK, existing)
}

// Delete permanently removes user account
// @Summary      Delete User
// @Description  Delete user account from system (owner-only)
// @Tags         user
// @Security     BearerAuth
// @Param        id path string true "User UUID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /users/{id} [delete]
func (h *UserHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	// Prevent user from self-deletion
	currentUserID := c.GetString("user_id")
	if currentUserID == idStr {
		Error(c, http.StatusBadRequest, "Anda tidak dapat menghapus akun Anda sendiri")
		return
	}

	err = h.userRepo.Delete(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghapus akun pengguna")
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr})
}
