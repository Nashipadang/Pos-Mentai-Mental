package repository

import (
	"database/sql"
	"errors"
	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/internal/model"
)

type UserRepository interface {
	GetByEmail(email string) (*model.User, error)
	GetByID(id uuid.UUID) (*model.User, error)
	Create(user *model.User) error
	Update(user *model.User) error
	GetAll() ([]model.User, error)
	Delete(id uuid.UUID) error
}

type pgUserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
	return &pgUserRepository{db: db}
}

func (r *pgUserRepository) GetByEmail(email string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_active, created_at FROM users WHERE email = $1`
	row := r.db.QueryRow(query, email)

	var u model.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *pgUserRepository) GetByID(id uuid.UUID) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_active, created_at FROM users WHERE id = $1`
	row := r.db.QueryRow(query, id)

	var u model.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *pgUserRepository) Create(u *model.User) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	query := `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING created_at`
	return r.db.QueryRow(query, u.ID, u.Name, u.Email, u.PasswordHash, u.Role, u.IsActive).Scan(&u.CreatedAt)
}

func (r *pgUserRepository) Update(u *model.User) error {
	query := `UPDATE users SET name = $1, email = $2, password_hash = $3, role = $4, is_active = $5 WHERE id = $6`
	_, err := r.db.Exec(query, u.Name, u.Email, u.PasswordHash, u.Role, u.IsActive, u.ID)
	return err
}

func (r *pgUserRepository) GetAll() ([]model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_active, created_at FROM users ORDER BY name ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *pgUserRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
