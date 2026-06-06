package repository

import (
	"database/sql"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type PromoRepository interface {
	GetByCode(code string) (*model.Promo, error)
	GetAllActive() ([]model.Promo, error)
	GetAll() ([]model.Promo, error)
	Create(p *model.Promo) error
	Update(p *model.Promo) error
	Delete(id string) error
}

type pgPromoRepository struct {
	db *sql.DB
}

func NewPromoRepository(db *sql.DB) PromoRepository {
	return &pgPromoRepository{db: db}
}

func (r *pgPromoRepository) GetByCode(code string) (*model.Promo, error) {
	var p model.Promo
	query := `SELECT id, code, type, value, min_transaction, max_discount, is_active, created_at 
	          FROM promos WHERE code = $1`
	err := r.db.QueryRow(query, code).Scan(&p.ID, &p.Code, &p.Type, &p.Value, &p.MinTransaction, &p.MaxDiscount, &p.IsActive, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *pgPromoRepository) GetAllActive() ([]model.Promo, error) {
	query := `SELECT id, code, type, value, min_transaction, max_discount, is_active, created_at 
	          FROM promos WHERE is_active = true ORDER BY code ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var promos []model.Promo
	for rows.Next() {
		var p model.Promo
		err := rows.Scan(&p.ID, &p.Code, &p.Type, &p.Value, &p.MinTransaction, &p.MaxDiscount, &p.IsActive, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		promos = append(promos, p)
	}
	return promos, nil
}

func (r *pgPromoRepository) GetAll() ([]model.Promo, error) {
	query := `SELECT id, code, type, value, min_transaction, max_discount, is_active, created_at 
	          FROM promos ORDER BY created_at DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var promos []model.Promo
	for rows.Next() {
		var p model.Promo
		err := rows.Scan(&p.ID, &p.Code, &p.Type, &p.Value, &p.MinTransaction, &p.MaxDiscount, &p.IsActive, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		promos = append(promos, p)
	}
	return promos, nil
}

func (r *pgPromoRepository) Create(p *model.Promo) error {
	query := `INSERT INTO promos (code, type, value, min_transaction, max_discount, is_active)
	          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	return r.db.QueryRow(query, p.Code, p.Type, p.Value, p.MinTransaction, p.MaxDiscount, p.IsActive).Scan(&p.ID, &p.CreatedAt)
}

func (r *pgPromoRepository) Update(p *model.Promo) error {
	query := `UPDATE promos SET code = $1, type = $2, value = $3, min_transaction = $4, max_discount = $5, is_active = $6
	          WHERE id = $7`
	_, err := r.db.Exec(query, p.Code, p.Type, p.Value, p.MinTransaction, p.MaxDiscount, p.IsActive, p.ID)
	return err
}

func (r *pgPromoRepository) Delete(id string) error {
	query := `DELETE FROM promos WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
