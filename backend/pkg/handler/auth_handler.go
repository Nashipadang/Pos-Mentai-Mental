package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/mentaimental/pos-backend/pkg/config"
	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

type AuthHandler struct {
	userRepo repository.UserRepository
	db       *sql.DB
}

func NewAuthHandler(ur repository.UserRepository, db *sql.DB) *AuthHandler {
	return &AuthHandler{userRepo: ur, db: db}
}

func (h *AuthHandler) RegisterRoutes(r *gin.RouterGroup) {
	auth := r.Group("/auth")
	{
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.Refresh)
		auth.POST("/logout", middleware.AuthRequired(), h.Logout)
		auth.GET("/profile", middleware.AuthRequired(), h.Profile)
	}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string          `json:"access_token"`
	RefreshToken string          `json:"refresh_token"`
	User         model.User      `json:"user"`
}

// Login handles user authentication and JWT token generation
// @Summary      User Login
// @Description  Log in a user and return access and refresh tokens
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body LoginRequest true "Login Credentials"
// @Success      200 {object} Response{data=LoginResponse}
// @Failure      400 {object} Response
// @Failure      401 {object} Response
// @Router       /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Email dan password tidak valid")
		return
	}

	u, err := h.userRepo.GetByEmail(req.Email)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memproses data user")
		return
	}

	if u == nil || !u.IsActive {
		Error(c, http.StatusUnauthorized, "Email atau password salah")
		return
	}

	// Verify password hash
	err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password))
	if err != nil {
		Error(c, http.StatusUnauthorized, "Email atau password salah")
		return
	}

	// Generate tokens
	accessToken, refreshToken, err := h.generateTokenPair(u)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal membuat session token")
		return
	}

	Success(c, http.StatusOK, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *u,
	})
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// Refresh handles renewing expired access tokens
// @Summary      Token Refresh
// @Description  Generate a new access token using a valid refresh token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body RefreshRequest true "Refresh Token"
// @Success      200 {object} Response{data=RefreshResponse}
// @Failure      400 {object} Response
// @Failure      401 {object} Response
// @Router       /auth/refresh [post]
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Refresh token diperlukan")
		return
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.App.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		Error(c, http.StatusUnauthorized, "Refresh token tidak valid atau expired")
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		Error(c, http.StatusUnauthorized, "Refresh token tidak valid")
		return
	}

	u, err := h.userRepo.GetByID(userID)
	if err != nil || u == nil || !u.IsActive {
		Error(c, http.StatusUnauthorized, "User tidak aktif atau tidak ditemukan")
		return
	}

	accessToken, refreshToken, err := h.generateTokenPair(u)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal membuat session token")
		return
	}

	Success(c, http.StatusOK, RefreshResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

// Profile returns currently authenticated user details
// @Summary      Get Profile
// @Description  Get current authenticated user profile details
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=model.User}
// @Failure      401 {object} Response
// @Router       /auth/profile [get]
func (h *AuthHandler) Profile(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		Error(c, http.StatusUnauthorized, "User ID tidak valid")
		return
	}

	u, err := h.userRepo.GetByID(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data profile")
		return
	}

	if u == nil {
		Error(c, http.StatusNotFound, "Profile tidak ditemukan")
		return
	}

	Success(c, http.StatusOK, u)
}

func (h *AuthHandler) generateTokenPair(u *model.User) (string, string, error) {
	// Access Token
	accessClaims := &middleware.Claims{
		UserID: u.ID.String(),
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * time.Duration(config.App.JWTAccessExpiryHours))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(config.App.JWTSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh Token
	refreshClaims := &middleware.Claims{
		UserID: u.ID.String(),
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 24 * time.Duration(config.App.JWTRefreshExpiryDays))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(config.App.JWTSecret))
	if err != nil {
		return "", "", err
	}

	return accessStr, refreshStr, nil
}

// Logout handles user logout and blacklists token
// @Summary      User Logout
// @Description  Blacklist the current JWT access token to invalidate the session
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response
// @Failure      401 {object} Response
// @Router       /auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		Error(c, http.StatusUnauthorized, "Token tidak ditemukan")
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

	// Decode token to extract expiration date (unverified parse is fine since we just need the claim)
	claims := &middleware.Claims{}
	_, _, err := new(jwt.Parser).ParseUnverified(tokenStr, claims)

	expiresAt := time.Now().Add(15 * time.Minute) // Default fallback
	if err == nil && claims.ExpiresAt != nil {
		expiresAt = claims.ExpiresAt.Time
	}

	if h.db != nil {
		_, err = h.db.Exec(`INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING`, tokenStr, expiresAt)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses logout: "+err.Error())
			return
		}
	}

	Success(c, http.StatusOK, "Logout berhasil")
}
