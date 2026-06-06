package repository

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type TransactionRepository interface {
	Create(tx *model.Transaction) error
	GetByID(id uuid.UUID) (*model.Transaction, error)
	GetAll() ([]model.Transaction, error)
	GetPaginated(page, limit int, search string, status string, paymentMethod string, startDate, endDate string) ([]model.Transaction, int64, error)
	UpdatePaymentStatus(id uuid.UUID, paymentStatus model.PaymentStatus, txStatus model.TransactionStatus) error
	GetAnalyticsOverview() (map[string]interface{}, error)
	GetSalesTrend(days int) ([]map[string]interface{}, error)
	GetTodayCount() (int, error)
}

type pgTransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) TransactionRepository {
	return &pgTransactionRepository{db: db}
}

func (r *pgTransactionRepository) Create(t *model.Transaction) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if t.ID == uuid.Nil {
		t.ID = GenerateReadableUUID(1)
	}

	// 1. Insert transaction record
	queryTx := `INSERT INTO transactions (id, user_id, customer_id, total_amount, payment_method, payment_status, midtrans_order_id, midtrans_token, status, promo_code, discount_amount, created_at)
	            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING created_at`
	err = tx.QueryRow(queryTx, t.ID, t.UserID, t.CustomerID, t.TotalAmount, t.PaymentMethod, t.PaymentStatus, t.MidtransOrderID, t.MidtransToken, t.Status, t.PromoCode, t.DiscountAmount).Scan(&t.CreatedAt)
	if err != nil {
		return err
	}

	// 2. Insert items and map ingredient demands
	requiredIngredients := make(map[uuid.UUID]float64)
	queryItem := `INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price, subtotal)
	              VALUES ($1, $2, $3, $4, $5, $6)`

	for i, item := range t.Items {
		if item.ID == uuid.Nil {
			item.ID = uuid.New()
		}
		t.Items[i].ID = item.ID
		t.Items[i].TransactionID = t.ID

		_, err = tx.Exec(queryItem, item.ID, t.ID, item.ProductID, item.Quantity, item.UnitPrice, item.Subtotal)
		if err != nil {
			return err
		}

		// Look up recipes (BOM) for the product
		recipeQuery := `SELECT ingredient_id, quantity FROM recipes WHERE product_id = $1`
		recipeRows, err := tx.Query(recipeQuery, item.ProductID)
		if err != nil {
			return err
		}
		
		for recipeRows.Next() {
			var ingID uuid.UUID
			var qty float64
			if err := recipeRows.Scan(&ingID, &qty); err != nil {
				recipeRows.Close()
				return err
			}
			requiredIngredients[ingID] += qty * float64(item.Quantity)
		}
		recipeRows.Close()
	}

	// 3. Verify stock levels and deduct atomically
	for ingID, needed := range requiredIngredients {
		var currentStock float64
		var name string
		var unit string
		err = tx.QueryRow(`SELECT name, unit, current_stock FROM ingredients WHERE id = $1 FOR UPDATE`, ingID).Scan(&name, &unit, &currentStock)
		if err != nil {
			return err
		}

		if currentStock < needed {
			return fmt.Errorf("Stok tidak mencukupi untuk bahan: %s. Sisa: %.2f %s, butuh: %.2f %s", name, currentStock, unit, needed, unit)
		}

		// Deduct stock
		_, err = tx.Exec(`UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2`, needed, ingID)
		if err != nil {
			return err
		}

		// Record stock movement
		notes := fmt.Sprintf("Penjualan Transaksi %s", t.ID)
		movementQuery := `INSERT INTO stock_movements (id, ingredient_id, transaction_id, type, quantity, notes, created_at)
		                  VALUES ($1, $2, $3, $4, $5, $6, NOW())`
		_, err = tx.Exec(movementQuery, uuid.New(), ingID, t.ID, model.StockOut, needed, notes)
		if err != nil {
			return err
		}
	}

	// 4. Update customer loyalty metrics if transaction is immediately completed
	if t.CustomerID != nil && t.Status == model.TxStatusCompleted {
		_, err = tx.Exec(`UPDATE customers SET total_spent = total_spent + $1, total_transactions = total_transactions + 1 WHERE id = $2`, t.TotalAmount, *t.CustomerID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *pgTransactionRepository) GetByID(id uuid.UUID) (*model.Transaction, error) {
	query := `SELECT id, user_id, customer_id, total_amount, payment_method, payment_status, midtrans_order_id, midtrans_token, status, promo_code, discount_amount, created_at 
	          FROM transactions WHERE id = $1`
	var t model.Transaction
	var custID uuid.NullUUID
	var orderID, token, promoCode sql.NullString
	err := r.db.QueryRow(query, id).Scan(&t.ID, &t.UserID, &custID, &t.TotalAmount, &t.PaymentMethod, &t.PaymentStatus, &orderID, &token, &t.Status, &promoCode, &t.DiscountAmount, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if custID.Valid {
		t.CustomerID = &custID.UUID
	}
	if orderID.Valid {
		t.MidtransOrderID = &orderID.String
	}
	if token.Valid {
		t.MidtransToken = &token.String
	}
	if promoCode.Valid {
		t.PromoCode = &promoCode.String
	}

	// Fetch associated items
	itemQuery := `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.unit_price, ti.subtotal, p.name, p.price, p.image_url, p.category_id
	              FROM transaction_items ti
	              JOIN products p ON ti.product_id = p.id
	              WHERE ti.transaction_id = $1`
	rows, err := r.db.Query(itemQuery, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item model.TransactionItem
		var p model.Product
		var imgURL sql.NullString
		var catID sql.NullInt64
		err := rows.Scan(&item.ID, &item.TransactionID, &item.ProductID, &item.Quantity, &item.UnitPrice, &item.Subtotal, &p.Name, &p.Price, &imgURL, &catID)
		if err != nil {
			return nil, err
		}
		if catID.Valid {
			p.CategoryID = int(catID.Int64)
		} else {
			p.CategoryID = 0
		}
		p.ID = item.ProductID
		if imgURL.Valid {
			p.ImageURL = &imgURL.String
		}
		item.Product = &p
		t.Items = append(t.Items, item)
	}

	return &t, nil
}

func (r *pgTransactionRepository) GetAll() ([]model.Transaction, error) {
	query := `SELECT id, user_id, customer_id, total_amount, payment_method, payment_status, midtrans_order_id, midtrans_token, status, promo_code, discount_amount, created_at 
	          FROM transactions ORDER BY created_at DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []model.Transaction
	for rows.Next() {
		var t model.Transaction
		var custID uuid.NullUUID
		var orderID, token, promoCode sql.NullString
		err := rows.Scan(&t.ID, &t.UserID, &custID, &t.TotalAmount, &t.PaymentMethod, &t.PaymentStatus, &orderID, &token, &t.Status, &promoCode, &t.DiscountAmount, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		if custID.Valid {
			t.CustomerID = &custID.UUID
		}
		if orderID.Valid {
			t.MidtransOrderID = &orderID.String
		}
		if token.Valid {
			t.MidtransToken = &token.String
		}
		if promoCode.Valid {
			t.PromoCode = &promoCode.String
		}
		transactions = append(transactions, t)
	}

	// Fetch items for each transaction
	for i, t := range transactions {
		itemQuery := `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.unit_price, ti.subtotal, p.name, p.price, p.image_url, p.category_id
		              FROM transaction_items ti
		              JOIN products p ON ti.product_id = p.id
		              WHERE ti.transaction_id = $1`
		rowsItem, err := r.db.Query(itemQuery, t.ID)
		if err != nil {
			return nil, err
		}
		
		var items []model.TransactionItem
		for rowsItem.Next() {
			var item model.TransactionItem
			var p model.Product
			var imgURL sql.NullString
			var catID sql.NullInt64
			err := rowsItem.Scan(&item.ID, &item.TransactionID, &item.ProductID, &item.Quantity, &item.UnitPrice, &item.Subtotal, &p.Name, &p.Price, &imgURL, &catID)
			if err != nil {
				rowsItem.Close()
				return nil, err
			}
			if catID.Valid {
				p.CategoryID = int(catID.Int64)
			} else {
				p.CategoryID = 0
			}
			p.ID = item.ProductID
			if imgURL.Valid {
				p.ImageURL = &imgURL.String
			}
			item.Product = &p
			items = append(items, item)
		}
		rowsItem.Close()
		transactions[i].Items = items
	}

	return transactions, nil
}

func (r *pgTransactionRepository) UpdatePaymentStatus(id uuid.UUID, paymentStatus model.PaymentStatus, txStatus model.TransactionStatus) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentStatus model.TransactionStatus
	var currentPaymentStatus model.PaymentStatus
	var customerID uuid.NullUUID
	var totalAmount float64
	err = tx.QueryRow(`SELECT status, payment_status, customer_id, total_amount FROM transactions WHERE id = $1 FOR UPDATE`, id).Scan(&currentStatus, &currentPaymentStatus, &customerID, &totalAmount)
	if err != nil {
		return err
	}

	if currentStatus == txStatus && currentPaymentStatus == paymentStatus {
		return nil
	}

	// Restocking if transaction goes to Cancelled from Completed/Pending
	if txStatus == model.TxStatusCancelled && currentStatus != model.TxStatusCancelled {
		rows, err := tx.Query(`SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1`, id)
		if err != nil {
			return err
		}
		
		type ItemQty struct {
			ProductID uuid.UUID
			Qty       int
		}
		var items []ItemQty
		for rows.Next() {
			var item ItemQty
			if err := rows.Scan(&item.ProductID, &item.Qty); err != nil {
				rows.Close()
				return err
			}
			items = append(items, item)
		}
		rows.Close()

		ingredientsToRestore := make(map[uuid.UUID]float64)
		for _, item := range items {
			recipeRows, err := tx.Query(`SELECT ingredient_id, quantity FROM recipes WHERE product_id = $1`, item.ProductID)
			if err != nil {
				return err
			}
			for recipeRows.Next() {
				var ingID uuid.UUID
				var qty float64
				if err := recipeRows.Scan(&ingID, &qty); err != nil {
					recipeRows.Close()
					return err
				}
				ingredientsToRestore[ingID] += qty * float64(item.Qty)
			}
			recipeRows.Close()
		}

		for ingID, qty := range ingredientsToRestore {
			_, err = tx.Exec(`UPDATE ingredients SET current_stock = current_stock + $1 WHERE id = $2`, qty, ingID)
			if err != nil {
				return err
			}

			notes := fmt.Sprintf("Pembatalan Transaksi %s", id)
			_, err = tx.Exec(`INSERT INTO stock_movements (id, ingredient_id, transaction_id, type, quantity, notes, created_at)
			                  VALUES ($1, $2, $3, $4, $5, $6, NOW())`, uuid.New(), ingID, id, model.StockIn, qty, notes)
			if err != nil {
				return err
			}
		}

		if customerID.Valid && currentStatus == model.TxStatusCompleted {
			_, err = tx.Exec(`UPDATE customers SET total_spent = GREATEST(0, total_spent - $1), total_transactions = GREATEST(0, total_transactions - 1) WHERE id = $2`, totalAmount, customerID.UUID)
			if err != nil {
				return err
			}
		}
	} else if txStatus == model.TxStatusCompleted && currentStatus != model.TxStatusCompleted {
		if customerID.Valid {
			_, err = tx.Exec(`UPDATE customers SET total_spent = total_spent + $1, total_transactions = total_transactions + 1 WHERE id = $2`, totalAmount, customerID.UUID)
			if err != nil {
				return err
			}
		}
	}

	_, err = tx.Exec(`UPDATE transactions SET payment_status = $1, status = $2 WHERE id = $3`, paymentStatus, txStatus, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *pgTransactionRepository) GetAnalyticsOverview() (map[string]interface{}, error) {
	analytics := make(map[string]interface{})

	var totalSales float64
	var txCount int
	err := r.db.QueryRow(`SELECT COALESCE(SUM(total_amount), 0), COUNT(id) FROM transactions WHERE status = 'completed'`).Scan(&totalSales, &txCount)
	if err != nil {
		return nil, err
	}
	analytics["total_sales"] = totalSales
	analytics["total_transactions"] = txCount

	var customerCount int
	err = r.db.QueryRow(`SELECT COUNT(id) FROM customers`).Scan(&customerCount)
	if err != nil {
		return nil, err
	}
	analytics["total_customers"] = customerCount

	var lowStockCount int
	err = r.db.QueryRow(`SELECT COUNT(id) FROM ingredients WHERE current_stock <= min_threshold`).Scan(&lowStockCount)
	if err != nil {
		return nil, err
	}
	analytics["low_stock_ingredients"] = lowStockCount

	var salesToday float64
	var ordersToday int
	err = r.db.QueryRow(`SELECT COALESCE(SUM(total_amount), 0), COUNT(id) FROM transactions WHERE status = 'completed' AND created_at >= CURRENT_DATE`).Scan(&salesToday, &ordersToday)
	if err != nil {
		return nil, err
	}
	analytics["sales_today"] = salesToday
	analytics["orders_today"] = ordersToday

	topProductsQuery := `SELECT p.name, SUM(ti.quantity) as total_qty, SUM(ti.subtotal) as total_sales
	                     FROM transaction_items ti
	                     JOIN products p ON ti.product_id = p.id
	                     JOIN transactions t ON ti.transaction_id = t.id
	                     WHERE t.status = 'completed'
	                     GROUP BY p.id, p.name
	                     ORDER BY total_qty DESC
	                     LIMIT 5`
	rows, err := r.db.Query(topProductsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topProducts []map[string]interface{}
	for rows.Next() {
		var name string
		var qty int
		var sales float64
		if err := rows.Scan(&name, &qty, &sales); err != nil {
			return nil, err
		}
		topProducts = append(topProducts, map[string]interface{}{
			"name":        name,
			"quantity":    qty,
			"total_sales": sales,
		})
	}
	analytics["top_products"] = topProducts

	return analytics, nil
}

func (r *pgTransactionRepository) GetSalesTrend(days int) ([]map[string]interface{}, error) {
	query := `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COALESCE(SUM(total_amount), 0) as sales, COUNT(id) as orders
	          FROM transactions
	          WHERE status = 'completed' AND created_at >= NOW() - ($1 || ' days')::INTERVAL
	          GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
	          ORDER BY date ASC`
	rows, err := r.db.Query(query, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trends []map[string]interface{}
	for rows.Next() {
		var date string
		var sales float64
		var orders int
		if err := rows.Scan(&date, &sales, &orders); err != nil {
			return nil, err
		}
		trends = append(trends, map[string]interface{}{
			"date":   date,
			"sales":  sales,
			"orders": orders,
		})
	}
	return trends, nil
}

func GenerateReadableUUID(sequence int) uuid.UUID {
	now := time.Now().Local()
	dayStr := now.Format("02")
	monthStr := now.Format("01")
	yearStr := now.Format("2006")
	
	datePart := dayStr + monthStr + yearStr  // DDMMYYYY
	seqPart := fmt.Sprintf("%04d", sequence) // 4-digit sequence (e.g. 0001)

	// Generate 6 random bytes (12 hex characters)
	bytes := make([]byte, 6)
	_, err := rand.Read(bytes)
	var suffix string
	if err != nil {
		suffix = "000000000000"
	} else {
		suffix = hex.EncodeToString(bytes)
	}

	uuidStr := fmt.Sprintf("%s-%s-0000-0000-%s", datePart, seqPart, suffix)
	parsed, err := uuid.Parse(uuidStr)
	if err != nil {
		return uuid.New()
	}
	return parsed
}

func (r *pgTransactionRepository) GetTodayCount() (int, error) {
	now := time.Now().Local()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfToday := startOfToday.Add(24 * time.Hour)

	var count int
	query := `SELECT COUNT(*) FROM transactions WHERE created_at >= $1 AND created_at < $2`
	err := r.db.QueryRow(query, startOfToday, endOfToday).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *pgTransactionRepository) GetPaginated(page, limit int, search string, status string, paymentMethod string, startDate, endDate string) ([]model.Transaction, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	}
	offset := (page - 1) * limit

	conditions := []string{}
	args := []interface{}{}
	argIndex := 1

	if status != "" && status != "all" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, status)
		argIndex++
	}

	if paymentMethod != "" && paymentMethod != "all" {
		conditions = append(conditions, fmt.Sprintf("payment_method = $%d", argIndex))
		args = append(args, paymentMethod)
		argIndex++
	}

	if startDate != "" && endDate != "" {
		layout := "2006-01-02"
		start, errStart := time.ParseInLocation(layout, startDate, time.Local)
		end, errEnd := time.ParseInLocation(layout, endDate, time.Local)
		if errStart == nil && errEnd == nil {
			end = end.Add(24 * time.Hour).Add(-time.Nanosecond)
			conditions = append(conditions, fmt.Sprintf("created_at >= $%d AND created_at <= $%d", argIndex, argIndex+1))
			args = append(args, start, end)
			argIndex += 2
		}
	}

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(id::text ILIKE $%d OR customer_id IN (SELECT id FROM customers WHERE name ILIKE $%d))", argIndex, argIndex))
		args = append(args, "%"+search+"%")
		argIndex++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM transactions %s", whereClause)
	err := r.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`SELECT id, user_id, customer_id, total_amount, payment_method, payment_status, midtrans_order_id, midtrans_token, status, promo_code, discount_amount, created_at 
	                      FROM transactions %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, whereClause, argIndex, argIndex+1)
	
	queryArgs := append(args, limit, offset)
	rows, err := r.db.Query(query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var transactions []model.Transaction
	for rows.Next() {
		var t model.Transaction
		var custID uuid.NullUUID
		var orderID, token, promoCode sql.NullString
		err := rows.Scan(&t.ID, &t.UserID, &custID, &t.TotalAmount, &t.PaymentMethod, &t.PaymentStatus, &orderID, &token, &t.Status, &promoCode, &t.DiscountAmount, &t.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if custID.Valid {
			t.CustomerID = &custID.UUID
		}
		if orderID.Valid {
			t.MidtransOrderID = &orderID.String
		}
		if token.Valid {
			t.MidtransToken = &token.String
		}
		if promoCode.Valid {
			t.PromoCode = &promoCode.String
		}
		transactions = append(transactions, t)
	}

	for i, t := range transactions {
		itemQuery := `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.unit_price, ti.subtotal, p.name, p.price, p.image_url, p.category_id
		              FROM transaction_items ti
		              JOIN products p ON ti.product_id = p.id
		              WHERE ti.transaction_id = $1`
		rowsItem, err := r.db.Query(itemQuery, t.ID)
		if err != nil {
			return nil, 0, err
		}
		
		var items []model.TransactionItem
		for rowsItem.Next() {
			var item model.TransactionItem
			var p model.Product
			var imgURL sql.NullString
			var catID sql.NullInt64
			err := rowsItem.Scan(&item.ID, &item.TransactionID, &item.ProductID, &item.Quantity, &item.UnitPrice, &item.Subtotal, &p.Name, &p.Price, &imgURL, &catID)
			if err != nil {
				rowsItem.Close()
				return nil, 0, err
			}
			if catID.Valid {
				p.CategoryID = int(catID.Int64)
			} else {
				p.CategoryID = 0
			}
			p.ID = item.ProductID
			if imgURL.Valid {
				p.ImageURL = &imgURL.String
			}
			item.Product = &p
			items = append(items, item)
		}
		rowsItem.Close()
		transactions[i].Items = items
	}

	return transactions, total, nil
}
