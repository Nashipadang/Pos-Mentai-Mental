package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mentaimental/pos-backend/internal/config"
	"github.com/mentaimental/pos-backend/internal/model"
)

type Claims struct {
	UserID string     `json:"user_id"`
	Email  string     `json:"email"`
	Role   model.Role `json:"role"`
	jwt.RegisteredClaims
}

// AuthRequired validates JWT token from Authorization header
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Authorization header diperlukan",
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(config.App.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Token tidak valid atau sudah expired",
			})
			return
		}

		// Store claims in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", string(claims.Role))
		c.Next()
	}
}

// RequireRole allows only specified roles to access the route
func RequireRole(roles ...model.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := model.Role(c.GetString("user_role"))
		for _, r := range roles {
			if userRole == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak — role tidak memiliki izin",
		})
	}
}
