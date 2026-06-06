package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type ProductRepository interface {
	GetAll(search string, categoryID int, onlyActive bool) ([]model.Product, error)
	GetByID(id uuid.UUID) (*model.Product, error)
	Create(product *model.Product) error
	Update(product *model.Product) error
	Delete(id uuid.UUID) error
	
	// Category operations
	GetAllCategories() ([]model.Category, error)
	CreateCategory(category *model.Category) error
	UpdateCategory(category *model.Category) error
	DeleteCategory(id int) error
}

type pgProductRepository struct {
	db *sql.DB
}

func NewProductRepository(db *sql.DB) ProductRepository {
	return &pgProductRepository{db: db}
}

func (r *pgProductRepository) GetAll(search string, categoryID int, onlyActive bool) ([]model.Product, error) {
	query := `SELECT p.id, p.category_id, p.name, p.price, p.image_url, p.is_active, p.created_at, c.name 
	          FROM products p 
	          LEFT JOIN categories c ON p.category_id = c.id 
	          WHERE 1=1`

	var args []interface{}
	argCount := 1

	if onlyActive {
		query += " AND p.is_active = true"
	}

	if categoryID > 0 {
		query += fmt.Sprintf(" AND p.category_id = $%d", argCount)
		args = append(args, categoryID)
		argCount++
	}

	if search != "" {
		query += fmt.Sprintf(" AND p.name ILIKE $%d", argCount)
		args = append(args, "%"+search+"%")
		argCount++
	}

	query += " ORDER BY p.name ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []model.Product
	for rows.Next() {
		var p model.Product
		var catName sql.NullString
		var imgURL sql.NullString
		var catID sql.NullInt64
		
		err := rows.Scan(&p.ID, &catID, &p.Name, &p.Price, &imgURL, &p.IsActive, &p.CreatedAt, &catName)
		if err != nil {
			return nil, err
		}
		
		if catID.Valid {
			p.CategoryID = int(catID.Int64)
		} else {
			p.CategoryID = 0
		}
		
		if imgURL.Valid {
			p.ImageURL = &imgURL.String
		}
		
		if catName.Valid {
			p.Category = &model.Category{
				ID:   p.CategoryID,
				Name: catName.String,
			}
		}
		
		products = append(products, p)
	}

	return products, nil
}

func (r *pgProductRepository) GetByID(id uuid.UUID) (*model.Product, error) {
	query := `SELECT p.id, p.category_id, p.name, p.price, p.image_url, p.is_active, p.created_at, c.name 
	          FROM products p 
	          LEFT JOIN categories c ON p.category_id = c.id 
	          WHERE p.id = $1`
	row := r.db.QueryRow(query, id)

	var p model.Product
	var catName sql.NullString
	var imgURL sql.NullString
	var catID sql.NullInt64
	
	err := row.Scan(&p.ID, &catID, &p.Name, &p.Price, &imgURL, &p.IsActive, &p.CreatedAt, &catName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if catID.Valid {
		p.CategoryID = int(catID.Int64)
	} else {
		p.CategoryID = 0
	}

	if imgURL.Valid {
		p.ImageURL = &imgURL.String
	}
	
	if catName.Valid {
		p.Category = &model.Category{
			ID:   p.CategoryID,
			Name: catName.String,
		}
	}

	return &p, nil
}

func (r *pgProductRepository) Create(p *model.Product) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	var catID interface{}
	if p.CategoryID > 0 {
		catID = p.CategoryID
	} else {
		catID = nil
	}
	query := `INSERT INTO products (id, category_id, name, price, image_url, is_active, created_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING created_at`
	return r.db.QueryRow(query, p.ID, catID, p.Name, p.Price, p.ImageURL, p.IsActive).Scan(&p.CreatedAt)
}

func (r *pgProductRepository) Update(p *model.Product) error {
	var catID interface{}
	if p.CategoryID > 0 {
		catID = p.CategoryID
	} else {
		catID = nil
	}
	query := `UPDATE products SET category_id = $1, name = $2, price = $3, image_url = $4, is_active = $5 WHERE id = $6`
	_, err := r.db.Exec(query, catID, p.Name, p.Price, p.ImageURL, p.IsActive, p.ID)
	return err
}

func (r *pgProductRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM products WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// ── Category Operations ──────────────────────────────────────────────────────

func (r *pgProductRepository) GetAllCategories() ([]model.Category, error) {
	query := `SELECT id, name FROM categories ORDER BY name ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []model.Category
	for rows.Next() {
		var c model.Category
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, nil
}

func (r *pgProductRepository) CreateCategory(c *model.Category) error {
	query := `INSERT INTO categories (name) VALUES ($1) RETURNING id`
	return r.db.QueryRow(query, c.Name).Scan(&c.ID)
}

func (r *pgProductRepository) UpdateCategory(c *model.Category) error {
	query := `UPDATE categories SET name = $1 WHERE id = $2`
	_, err := r.db.Exec(query, c.Name, c.ID)
	return err
}

func (r *pgProductRepository) DeleteCategory(id int) error {
	query := `DELETE FROM categories WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
