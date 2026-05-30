package model

import (
	"time"

	"github.com/google/uuid"
)

// ── Enums ────────────────────────────────────────────────────────────────────

type Role string

const (
	RoleOwner  Role = "owner"
	RoleKasir  Role = "kasir"
	RoleStaff  Role = "staff"
)

type PaymentMethod string

const (
	PaymentCash     PaymentMethod = "cash"
	PaymentTransfer PaymentMethod = "transfer"
	PaymentMidtrans PaymentMethod = "midtrans"
)

type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "pending"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusFailed   PaymentStatus = "failed"
	PaymentStatusExpired  PaymentStatus = "expired"
)

type TransactionStatus string

const (
	TxStatusPending   TransactionStatus = "pending"
	TxStatusCompleted TransactionStatus = "completed"
	TxStatusCancelled TransactionStatus = "cancelled"
)

type StockMovementType string

const (
	StockIn  StockMovementType = "in"
	StockOut StockMovementType = "out"
)

// ── Models ───────────────────────────────────────────────────────────────────

type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         Role      `json:"role" db:"role"`
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type Category struct {
	ID   int    `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
}

type Product struct {
	ID         uuid.UUID `json:"id" db:"id"`
	CategoryID int       `json:"category_id" db:"category_id"`
	Category   *Category `json:"category,omitempty"`
	Name       string    `json:"name" db:"name"`
	Price      float64   `json:"price" db:"price"`
	ImageURL   *string   `json:"image_url" db:"image_url"`
	IsActive   bool      `json:"is_active" db:"is_active"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type Ingredient struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Unit         string    `json:"unit" db:"unit"`
	CurrentStock float64   `json:"current_stock" db:"current_stock"`
	MinThreshold *float64  `json:"min_threshold" db:"min_threshold"`
	IsLow        bool      `json:"is_low,omitempty"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type RecipeItem struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	ProductID    uuid.UUID  `json:"product_id" db:"product_id"`
	IngredientID uuid.UUID  `json:"ingredient_id" db:"ingredient_id"`
	Ingredient   *Ingredient `json:"ingredient,omitempty"`
	Quantity     float64    `json:"quantity" db:"quantity"`
}

type Customer struct {
	ID                uuid.UUID `json:"id" db:"id"`
	Name              string    `json:"name" db:"name"`
	Phone             string    `json:"phone" db:"phone"`
	TotalTransactions int       `json:"total_transactions" db:"total_transactions"`
	TotalSpent        float64   `json:"total_spent" db:"total_spent"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type Transaction struct {
	ID               uuid.UUID         `json:"id" db:"id"`
	UserID           uuid.UUID         `json:"user_id" db:"user_id"`
	CustomerID       *uuid.UUID        `json:"customer_id" db:"customer_id"`
	TotalAmount      float64           `json:"total_amount" db:"total_amount"`
	PaymentMethod    PaymentMethod     `json:"payment_method" db:"payment_method"`
	PaymentStatus    PaymentStatus     `json:"payment_status" db:"payment_status"`
	MidtransOrderID  *string           `json:"midtrans_order_id,omitempty" db:"midtrans_order_id"`
	MidtransToken    *string           `json:"midtrans_token,omitempty" db:"midtrans_token"`
	Status           TransactionStatus `json:"status" db:"status"`
	CreatedAt        time.Time         `json:"created_at" db:"created_at"`
	Items            []TransactionItem `json:"items,omitempty"`
}

type TransactionItem struct {
	ID            uuid.UUID `json:"id" db:"id"`
	TransactionID uuid.UUID `json:"transaction_id" db:"transaction_id"`
	ProductID     uuid.UUID `json:"product_id" db:"product_id"`
	Product       *Product  `json:"product,omitempty"`
	Quantity      int       `json:"quantity" db:"quantity"`
	UnitPrice     float64   `json:"unit_price" db:"unit_price"`
	Subtotal      float64   `json:"subtotal" db:"subtotal"`
}

type StockMovement struct {
	ID            uuid.UUID         `json:"id" db:"id"`
	IngredientID  uuid.UUID         `json:"ingredient_id" db:"ingredient_id"`
	TransactionID *uuid.UUID        `json:"transaction_id,omitempty" db:"transaction_id"`
	Type          StockMovementType `json:"type" db:"type"`
	Quantity      float64           `json:"quantity" db:"quantity"`
	Notes         *string           `json:"notes,omitempty" db:"notes"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
}
