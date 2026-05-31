package repository

import (
	"database/sql"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/internal/model"
)

type RecipeRepository interface {
	GetAll() ([]model.RecipeItem, error)
	GetByProductID(productID uuid.UUID) ([]model.RecipeItem, error)
	SaveRecipe(productID uuid.UUID, items []model.RecipeItem) error
}

type pgRecipeRepository struct {
	db *sql.DB
}

func NewRecipeRepository(db *sql.DB) RecipeRepository {
	return &pgRecipeRepository{db: db}
}

func (r *pgRecipeRepository) GetAll() ([]model.RecipeItem, error) {
	query := `SELECT r.id, r.product_id, r.ingredient_id, r.quantity, i.name, i.unit, i.current_stock, i.min_threshold 
	          FROM recipes r 
	          INNER JOIN ingredients i ON r.ingredient_id = i.id`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.RecipeItem
	for rows.Next() {
		var item model.RecipeItem
		var ing model.Ingredient
		var minThreshold sql.NullFloat64
		
		err := rows.Scan(
			&item.ID, &item.ProductID, &item.IngredientID, &item.Quantity,
			&ing.Name, &ing.Unit, &ing.CurrentStock, &minThreshold,
		)
		if err != nil {
			return nil, err
		}
		
		ing.ID = item.IngredientID
		if minThreshold.Valid {
			ing.MinThreshold = &minThreshold.Float64
			ing.IsLow = ing.CurrentStock <= minThreshold.Float64
		}
		item.Ingredient = &ing
		
		items = append(items, item)
	}

	return items, nil
}

func (r *pgRecipeRepository) GetByProductID(productID uuid.UUID) ([]model.RecipeItem, error) {
	query := `SELECT r.id, r.product_id, r.ingredient_id, r.quantity, i.name, i.unit, i.current_stock, i.min_threshold 
	          FROM recipes r 
	          INNER JOIN ingredients i ON r.ingredient_id = i.id 
	          WHERE r.product_id = $1`
	rows, err := r.db.Query(query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.RecipeItem
	for rows.Next() {
		var item model.RecipeItem
		var ing model.Ingredient
		var minThreshold sql.NullFloat64
		
		err := rows.Scan(
			&item.ID, &item.ProductID, &item.IngredientID, &item.Quantity,
			&ing.Name, &ing.Unit, &ing.CurrentStock, &minThreshold,
		)
		if err != nil {
			return nil, err
		}
		
		ing.ID = item.IngredientID
		if minThreshold.Valid {
			ing.MinThreshold = &minThreshold.Float64
			ing.IsLow = ing.CurrentStock <= minThreshold.Float64
		}
		item.Ingredient = &ing
		
		items = append(items, item)
	}

	return items, nil
}

func (r *pgRecipeRepository) SaveRecipe(productID uuid.UUID, items []model.RecipeItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	
	// Defer rollback in case of error
	defer tx.Rollback()

	// 1. Delete existing recipe items
	deleteQuery := `DELETE FROM recipes WHERE product_id = $1`
	_, err = tx.Exec(deleteQuery, productID)
	if err != nil {
		return err
	}

	// 2. Insert new recipe items
	insertQuery := `INSERT INTO recipes (id, product_id, ingredient_id, quantity) VALUES ($1, $2, $3, $4)`
	for _, item := range items {
		id := item.ID
		if id == uuid.Nil {
			id = uuid.New()
		}
		_, err = tx.Exec(insertQuery, id, productID, item.IngredientID, item.Quantity)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
