package handler

import (
	"database/sql"
	"log"
	"net/http"
	"sync"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	_ "github.com/mentaimental/pos-backend/docs" // swagger docs auto-generated
	"github.com/mentaimental/pos-backend/pkg/config"
	"github.com/mentaimental/pos-backend/pkg/handler"
	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

var (
	router *gin.Engine
	db     *sql.DB
	once   sync.Once
	initErr error
)

func initialize() {
	// Load config from environment variables (godotenv will look for .env but in production it relies on system env)
	if err := config.Load(); err != nil {
		initErr = err
		log.Printf("Failed to load config: %v", err)
		return
	}

	// Connect to PostgreSQL
	var err error
	db, err = sql.Open("postgres", config.App.DSN())
	if err != nil {
		initErr = err
		log.Printf("Failed to connect to database: %v", err)
		return
	}

	if err = db.Ping(); err != nil {
		initErr = err
		log.Printf("Database ping failed: %v", err)
		return
	}
	log.Println("✅ Connected to PostgreSQL Database")

	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	r := gin.Default()

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{config.App.CORSAllowedOrigins},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

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

	router = r
}

// Handler is the entrypoint for Vercel Serverless Function
func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(initialize)

	if initErr != nil {
		http.Error(w, "Initialization error: "+initErr.Error(), http.StatusInternalServerError)
		return
	}

	// Forward the request to Gin router
	router.ServeHTTP(w, r)
}
