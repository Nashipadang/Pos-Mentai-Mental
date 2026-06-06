package repository

import (
	"database/sql"
	"errors"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type CustomerRepository interface {
	GetAll() ([]model.Customer, error)
	GetByID(id uuid.UUID) (*model.Customer, error)
	GetByPhone(phone string) (*model.Customer, error)
	Create(customer *model.Customer) error
	Update(customer *model.Customer) error
	Delete(id uuid.UUID) error
	UpdateSpentTx(tx *sql.Tx, id uuid.UUID, spentDelta float64, txDelta int) error
}

type pgCustomerRepository struct {
	db *sql.DB
}

func NewCustomerRepository(db *sql.DB) CustomerRepository {
	return &pgCustomerRepository{db: db}
}

func (r *pgCustomerRepository) GetAll() ([]model.Customer, error) {
	query := `SELECT id, name, phone, total_transactions, total_spent, created_at FROM customers ORDER BY name ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []model.Customer
	for rows.Next() {
		var c model.Customer
		err := rows.Scan(&c.ID, &c.Name, &c.Phone, &c.TotalTransactions, &c.TotalSpent, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		customers = append(customers, c)
	}
	return customers, nil
}

func (r *pgCustomerRepository) GetByID(id uuid.UUID) (*model.Customer, error) {
	query := `SELECT id, name, phone, total_transactions, total_spent, created_at FROM customers WHERE id = $1`
	row := r.db.QueryRow(query, id)

	var c model.Customer
	err := row.Scan(&c.ID, &c.Name, &c.Phone, &c.TotalTransactions, &c.TotalSpent, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *pgCustomerRepository) GetByPhone(phone string) (*model.Customer, error) {
	query := `SELECT id, name, phone, total_transactions, total_spent, created_at FROM customers WHERE phone = $1`
	row := r.db.QueryRow(query, phone)

	var c model.Customer
	err := row.Scan(&c.ID, &c.Name, &c.Phone, &c.TotalTransactions, &c.TotalSpent, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *pgCustomerRepository) Create(c *model.Customer) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	query := `INSERT INTO customers (id, name, phone, total_transactions, total_spent, created_at) 
	          VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING created_at`
	return r.db.QueryRow(query, c.ID, c.Name, c.Phone, c.TotalTransactions, c.TotalSpent).Scan(&c.CreatedAt)
}

func (r *pgCustomerRepository) Update(c *model.Customer) error {
	query := `UPDATE customers SET name = $1, phone = $2, total_transactions = $3, total_spent = $4 WHERE id = $5`
	_, err := r.db.Exec(query, c.Name, c.Phone, c.TotalTransactions, c.TotalSpent, c.ID)
	return err
}

func (r *pgCustomerRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM customers WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *pgCustomerRepository) UpdateSpentTx(tx *sql.Tx, id uuid.UUID, spentDelta float64, txDelta int) error {
	query := `UPDATE customers SET total_spent = total_spent + $1, total_transactions = total_transactions + $2 WHERE id = $3`
	_, err := tx.Exec(query, spentDelta, txDelta, id)
	return err
}
