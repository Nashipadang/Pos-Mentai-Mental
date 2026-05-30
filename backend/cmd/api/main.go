// @title           POS Mentai Mental API
// @version         1.0
// @description     REST API untuk sistem Point of Sale Mentai Mental
// @termsOfService  http://swagger.io/terms/

// @contact.name   Mentai Mental Dev
// @contact.email  dev@mentaimental.com

// @license.name  MIT

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Masukkan token dengan format: Bearer {token}

package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/mentaimental/pos-backend/docs" // swagger docs auto-generated
	"github.com/mentaimental/pos-backend/internal/config"
)

func main() {
	// Load config from .env
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to PostgreSQL (Supabase)
	db, err := sql.Open("postgres", config.App.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL (Supabase)")

	// Setup Gin
	if config.App.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{config.App.CORSAllowedOrigins},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Swagger UI (only in development)
	if config.App.AppEnv != "production" {
		r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		log.Println("📖 Swagger UI: http://localhost:" + config.App.AppPort + "/swagger/index.html")
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "env": config.App.AppEnv})
	})

	// API routes v1
	v1 := r.Group("/api/v1")
	{
		// TODO: Register handlers here
		// auth.RegisterRoutes(v1, db)
		// product.RegisterRoutes(v1, db)
		// inventory.RegisterRoutes(v1, db)
		// transaction.RegisterRoutes(v1, db)
		// analytics.RegisterRoutes(v1, db)
		_ = v1 // placeholder
	}

	addr := fmt.Sprintf(":%s", config.App.AppPort)
	log.Printf("🚀 Server running on http://localhost%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
