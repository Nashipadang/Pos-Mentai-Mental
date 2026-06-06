package repository

import (
	"database/sql"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type StockMovementRepository interface {
	Create(movement *model.StockMovement) error
	CreateTx(tx *sql.Tx, movement *model.StockMovement) error
	GetByIngredientID(ingredientID uuid.UUID) ([]model.StockMovement, error)
	GetAll() ([]model.StockMovement, error)
}

type pgStockMovementRepository struct {
	db *sql.DB
}

func NewStockMovementRepository(db *sql.DB) StockMovementRepository {
	return &pgStockMovementRepository{db: db}
}

func (r *pgStockMovementRepository) Create(m *model.StockMovement) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	query := `INSERT INTO stock_movements (id, ingredient_id, transaction_id, type, quantity, notes, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING created_at`
	return r.db.QueryRow(query, m.ID, m.IngredientID, m.TransactionID, m.Type, m.Quantity, m.Notes).Scan(&m.CreatedAt)
}

func (r *pgStockMovementRepository) CreateTx(tx *sql.Tx, m *model.StockMovement) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	query := `INSERT INTO stock_movements (id, ingredient_id, transaction_id, type, quantity, notes, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING created_at`
	return tx.QueryRow(query, m.ID, m.IngredientID, m.TransactionID, m.Type, m.Quantity, m.Notes).Scan(&m.CreatedAt)
}

func (r *pgStockMovementRepository) GetByIngredientID(ingredientID uuid.UUID) ([]model.StockMovement, error) {
	query := `SELECT id, ingredient_id, transaction_id, type, quantity, notes, created_at 
	          FROM stock_movements WHERE ingredient_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(query, ingredientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []model.StockMovement
	for rows.Next() {
		var m model.StockMovement
		var txID uuid.NullUUID
		var notes sql.NullString

		err := rows.Scan(&m.ID, &m.IngredientID, &txID, &m.Type, &m.Quantity, &notes, &m.CreatedAt)
		if err != nil {
			return nil, err
		}

		if txID.Valid {
			m.TransactionID = &txID.UUID
		}
		if notes.Valid {
			m.Notes = &notes.String
		}

		movements = append(movements, m)
	}
	return movements, nil
}

func (r *pgStockMovementRepository) GetAll() ([]model.StockMovement, error) {
	query := `SELECT id, ingredient_id, transaction_id, type, quantity, notes, created_at 
	          FROM stock_movements ORDER BY created_at DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var movements []model.StockMovement
	for rows.Next() {
		var m model.StockMovement
		var txID uuid.NullUUID
		var notes sql.NullString

		err := rows.Scan(&m.ID, &m.IngredientID, &txID, &m.Type, &m.Quantity, &notes, &m.CreatedAt)
		if err != nil {
			return nil, err
		}

		if txID.Valid {
			m.TransactionID = &txID.UUID
		}
		if notes.Valid {
			m.Notes = &notes.String
		}

		movements = append(movements, m)
	}
	return movements, nil
}
