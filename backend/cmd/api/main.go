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
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/mentaimental/pos-backend/docs" // swagger docs auto-generated
	"github.com/mentaimental/pos-backend/pkg/config"
	"github.com/mentaimental/pos-backend/pkg/handler"
	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

func main() {
	// Load config from .env
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to PostgreSQL
	db, err := sql.Open("postgres", config.App.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL Database")

	// Execute migrations
	runMigrations(db)

	// Setup Gin
	if config.App.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS Setup
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

	// Initialize database connection for middleware
	middleware.InitDB(db)

	// Instantiate repositories
	userRepo := repository.NewUserRepository(db)
	productRepo := repository.NewProductRepository(db)
	ingredientRepo := repository.NewIngredientRepository(db)
	recipeRepo := repository.NewRecipeRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	movementRepo := repository.NewStockMovementRepository(db)
	transactionRepo := repository.NewTransactionRepository(db)
	promoRepo := repository.NewPromoRepository(db)

	// Instantiate handlers
	authHandler := handler.NewAuthHandler(userRepo, db)
	userHandler := handler.NewUserHandler(userRepo)
	productHandler := handler.NewProductHandler(productRepo)
	inventoryHandler := handler.NewInventoryHandler(ingredientRepo, movementRepo)
	recipeHandler := handler.NewRecipeHandler(recipeRepo)
	customerHandler := handler.NewCustomerHandler(customerRepo)
	transactionHandler := handler.NewTransactionHandler(transactionRepo, productRepo, promoRepo, customerRepo, db)
	analyticsHandler := handler.NewAnalyticsHandler(transactionRepo, ingredientRepo, db)
	settingsHandler := handler.NewSettingsHandler(db)
	promoHandler := handler.NewPromoHandler(promoRepo)

	// API routes v1
	v1 := r.Group("/api/v1")
	{
		authHandler.RegisterRoutes(v1)
		userHandler.RegisterRoutes(v1)
		productHandler.RegisterRoutes(v1)
		inventoryHandler.RegisterRoutes(v1)
		recipeHandler.RegisterRoutes(v1)
		customerHandler.RegisterRoutes(v1)
		transactionHandler.RegisterRoutes(v1)
		analyticsHandler.RegisterRoutes(v1)
		settingsHandler.RegisterRoutes(v1)
		promoHandler.RegisterRoutes(v1)
	}

	addr := fmt.Sprintf(":%s", config.App.AppPort)
	log.Printf("🚀 Server running on http://localhost%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func runMigrations(db *sql.DB) {
	log.Println("🔄 Running database migrations...")

	// Try multiple relative paths to locate migration file
	paths := []string{
		"migrations/0001_create_schema.up.sql",
		"../migrations/0001_create_schema.up.sql",
		"../../migrations/0001_create_schema.up.sql",
	}

	var content []byte
	var err error
	for _, p := range paths {
		content, err = os.ReadFile(p)
		if err == nil {
			log.Printf("Found migration file at: %s", p)
			break
		}
	}

	if err != nil {
		log.Printf("⚠️ Warning: migration file not found: %v", err)
		return
	}

	// Execute migrations content
	_, err = db.Exec(string(content))
	if err != nil {
		log.Fatalf("❌ Migration failed: %v", err)
	}
	log.Println("✅ Database migrations executed successfully")
}
