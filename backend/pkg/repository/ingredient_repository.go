package repository

import (
	"database/sql"
	"errors"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type IngredientRepository interface {
	GetAll() ([]model.Ingredient, error)
	GetByID(id uuid.UUID) (*model.Ingredient, error)
	Create(ingredient *model.Ingredient) error
	Update(ingredient *model.Ingredient) error
	Delete(id uuid.UUID) error
	
	// Stock updates (atomic)
	UpdateStock(id uuid.UUID, delta float64) error
	UpdateStockTx(tx *sql.Tx, id uuid.UUID, delta float64) error
}

type pgIngredientRepository struct {
	db *sql.DB
}

func NewIngredientRepository(db *sql.DB) IngredientRepository {
	return &pgIngredientRepository{db: db}
}

func (r *pgIngredientRepository) GetAll() ([]model.Ingredient, error) {
	query := `SELECT id, name, unit, current_stock, min_threshold, created_at FROM ingredients ORDER BY name ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ingredients []model.Ingredient
	for rows.Next() {
		var ing model.Ingredient
		var minThreshold sql.NullFloat64
		
		err := rows.Scan(&ing.ID, &ing.Name, &ing.Unit, &ing.CurrentStock, &minThreshold, &ing.CreatedAt)
		if err != nil {
			return nil, err
		}
		
		if minThreshold.Valid {
			ing.MinThreshold = &minThreshold.Float64
			ing.IsLow = ing.CurrentStock <= minThreshold.Float64
		} else {
			ing.IsLow = false
		}
		
		ingredients = append(ingredients, ing)
	}

	return ingredients, nil
}

func (r *pgIngredientRepository) GetByID(id uuid.UUID) (*model.Ingredient, error) {
	query := `SELECT id, name, unit, current_stock, min_threshold, created_at FROM ingredients WHERE id = $1`
	row := r.db.QueryRow(query, id)

	var ing model.Ingredient
	var minThreshold sql.NullFloat64
	
	err := row.Scan(&ing.ID, &ing.Name, &ing.Unit, &ing.CurrentStock, &minThreshold, &ing.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if minThreshold.Valid {
		ing.MinThreshold = &minThreshold.Float64
		ing.IsLow = ing.CurrentStock <= minThreshold.Float64
	}

	return &ing, nil
}

func (r *pgIngredientRepository) Create(ing *model.Ingredient) error {
	if ing.ID == uuid.Nil {
		ing.ID = uuid.New()
	}
	query := `INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, created_at) 
	          VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING created_at`
	return r.db.QueryRow(query, ing.ID, ing.Name, ing.Unit, ing.CurrentStock, ing.MinThreshold).Scan(&ing.CreatedAt)
}

func (r *pgIngredientRepository) Update(ing *model.Ingredient) error {
	query := `UPDATE ingredients SET name = $1, unit = $2, current_stock = $3, min_threshold = $4 WHERE id = $5`
	_, err := r.db.Exec(query, ing.Name, ing.Unit, ing.CurrentStock, ing.MinThreshold, ing.ID)
	return err
}

func (r *pgIngredientRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM ingredients WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *pgIngredientRepository) UpdateStock(id uuid.UUID, delta float64) error {
	query := `UPDATE ingredients SET current_stock = current_stock + $1 WHERE id = $2`
	_, err := r.db.Exec(query, delta, id)
	return err
}

func (r *pgIngredientRepository) UpdateStockTx(tx *sql.Tx, id uuid.UUID, delta float64) error {
	query := `UPDATE ingredients SET current_stock = current_stock + $1 WHERE id = $2`
	_, err := tx.Exec(query, delta, id)
	return err
}
