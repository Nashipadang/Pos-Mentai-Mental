package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv  string
	AppPort string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret             string
	JWTAccessExpiryHours  int
	JWTRefreshExpiryDays  int

	MidtransServerKey string
	MidtransClientKey string
	MidtransEnv       string

	CORSAllowedOrigins string
}

var App *Config

func Load() error {
	// Load .env file if exists (skip error in production)
	_ = godotenv.Load()

	accessHours, _ := strconv.Atoi(getEnv("JWT_ACCESS_EXPIRY_HOURS", "8"))
	refreshDays, _ := strconv.Atoi(getEnv("JWT_REFRESH_EXPIRY_DAYS", "7"))

	App = &Config{
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnv("APP_PORT", "8080"),

		DBHost:     getEnvRequired("DB_HOST"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnvRequired("DB_USER"),
		DBPassword: getEnvRequired("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "postgres"),
		DBSSLMode:  getEnv("DB_SSLMODE", "require"),

		JWTSecret:            getEnvRequired("JWT_SECRET"),
		JWTAccessExpiryHours: accessHours,
		JWTRefreshExpiryDays: refreshDays,

		MidtransServerKey: getEnvRequired("MIDTRANS_SERVER_KEY"),
		MidtransClientKey: getEnvRequired("MIDTRANS_CLIENT_KEY"),
		MidtransEnv:       getEnv("MIDTRANS_ENV", "sandbox"),

		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"),
	}

	return nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvRequired(key string) string {
	val := os.Getenv(key)
	if val == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return val
}
