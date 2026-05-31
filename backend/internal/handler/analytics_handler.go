package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mentaimental/pos-backend/internal/middleware"
	"github.com/mentaimental/pos-backend/internal/repository"
)

type AnalyticsHandler struct {
	txRepo  repository.TransactionRepository
	ingRepo repository.IngredientRepository
	db      *sql.DB // Reference db for direct custom queries
}

func NewAnalyticsHandler(tr repository.TransactionRepository, ir repository.IngredientRepository, db *sql.DB) *AnalyticsHandler {
	return &AnalyticsHandler{txRepo: tr, ingRepo: ir, db: db}
}

func (h *AnalyticsHandler) RegisterRoutes(r *gin.RouterGroup) {
	analytics := r.Group("/analytics", middleware.AuthRequired())
	{
		analytics.GET("/overview", h.GetOverview)
		analytics.GET("/sales-trend", h.GetSalesTrend)
		analytics.GET("/runout-predictions", h.GetRunoutPredictions)
		analytics.GET("/busy-hours", h.GetBusyHours)
		analytics.GET("/customers/ranking", h.GetCustomerRanking)
		analytics.GET("/payment-methods", h.GetPaymentMethods)
		analytics.GET("/category-sales", h.GetCategorySales)
	}
}

// GetOverview returns dashboard overview metrics
// @Summary      Get Overview Analytics
// @Description  Get total sales, transaction counts, low stock counts, and top products
// @Tags         analytics
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response
// @Failure      500 {object} Response
// @Router       /analytics/overview [get]
func (h *AnalyticsHandler) GetOverview(c *gin.Context) {
	data, err := h.txRepo.GetAnalyticsOverview()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat overview analytics: "+err.Error())
		return
	}
	Success(c, http.StatusOK, data)
}

// GetSalesTrend returns sales trend grouped by date
// @Summary      Get Sales Trend
// @Description  Get sales and order counts trend over the last N days or custom range, grouped by daily or monthly period
// @Tags         analytics
// @Security     BearerAuth
// @Param        days query int false "Number of days (default 7)"
// @Param        start_date query string false "Start date YYYY-MM-DD"
// @Param        end_date query string false "End date YYYY-MM-DD"
// @Param        period query string false "Period grouping: daily or monthly (default daily)"
// @Produce      json
// @Success      200 {object} Response
// @Failure      500 {object} Response
// @Router       /analytics/sales-trend [get]
func (h *AnalyticsHandler) GetSalesTrend(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	period := c.DefaultQuery("period", "daily")
	if period != "daily" && period != "monthly" {
		period = "daily"
	}

	dateFormat := "YYYY-MM-DD"
	if period == "monthly" {
		dateFormat = "YYYY-MM"
	}

	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		layout := "2006-01-02"
		start, errStart := time.ParseInLocation(layout, startDate, time.Local)
		end, errEnd := time.ParseInLocation(layout, endDate, time.Local)
		if errStart != nil || errEnd != nil {
			Error(c, http.StatusBadRequest, "Format tanggal mulai/selesai tidak valid. Gunakan YYYY-MM-DD.")
			return
		}
		end = end.Add(24 * time.Hour).Add(-time.Nanosecond)

		query := fmt.Sprintf(`SELECT TO_CHAR(created_at, '%s') as date, COALESCE(SUM(total_amount), 0) as sales, COUNT(id) as orders
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= $1 AND created_at <= $2
		          GROUP BY TO_CHAR(created_at, '%s')
		          ORDER BY date ASC`, dateFormat, dateFormat)
		rows, err = h.db.Query(query, start, end)
	} else {
		daysStr := c.DefaultQuery("days", "7")
		days, errConv := strconv.Atoi(daysStr)
		if errConv != nil || days <= 0 {
			days = 7
		}
		query := fmt.Sprintf(`SELECT TO_CHAR(created_at, '%s') as date, COALESCE(SUM(total_amount), 0) as sales, COUNT(id) as orders
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= NOW() - ($1 || ' days')::INTERVAL
		          GROUP BY TO_CHAR(created_at, '%s')
		          ORDER BY date ASC`, dateFormat, dateFormat)
		rows, err = h.db.Query(query, days)
	}

	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat trend penjualan: "+err.Error())
		return
	}
	defer rows.Close()

	var trends []map[string]interface{}
	for rows.Next() {
		var date string
		var sales float64
		var orders int
		if err := rows.Scan(&date, &sales, &orders); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses data: "+err.Error())
			return
		}
		trends = append(trends, map[string]interface{}{
			"date":   date,
			"sales":  sales,
			"orders": orders,
		})
	}
	Success(c, http.StatusOK, trends)
}

type RunoutPrediction struct {
	IngredientID        uuid.UUID `json:"ingredient_id"`
	IngredientName      string    `json:"ingredient_name"`
	CurrentStock        float64   `json:"current_stock"`
	Unit                string    `json:"unit"`
	AvgDailyUsage       float64   `json:"avg_daily_usage"`
	DaysRemaining       float64   `json:"days_remaining"` // -1 means infinite/no usage
	EstimatedRunoutDate *string   `json:"estimated_runout_date,omitempty"`
}

// GetRunoutPredictions calculates inventory deplete rates
// @Summary      Get Inventory Runout Predictions
// @Description  Calculate average consumption rate over past 7 days to estimate deplete dates
// @Tags         analytics
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]RunoutPrediction}
// @Failure      500 {object} Response
// @Router       /analytics/runout-predictions [get]
func (h *AnalyticsHandler) GetRunoutPredictions(c *gin.Context) {
	ingredients, err := h.ingRepo.GetAll()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat bahan baku: "+err.Error())
		return
	}

	// Fetch average daily usage for each ingredient over the last 7 days
	usageQuery := `SELECT ingredient_id, COALESCE(SUM(quantity), 0) / 7.0 as avg_daily_usage 
	               FROM stock_movements 
	               WHERE type = 'out' AND created_at >= NOW() - INTERVAL '7 days'
	               GROUP BY ingredient_id`
	rows, err := h.db.Query(usageQuery)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menghitung rata-rata penggunaan bahan baku: "+err.Error())
		return
	}
	defer rows.Close()

	usageMap := make(map[uuid.UUID]float64)
	for rows.Next() {
		var ingID uuid.UUID
		var avgUsage float64
		if err := rows.Scan(&ingID, &avgUsage); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses hitungan penggunaan: "+err.Error())
			return
		}
		usageMap[ingID] = avgUsage
	}

	var predictions []RunoutPrediction
	now := time.Now()

	for _, ing := range ingredients {
		avgUsage := usageMap[ing.ID]
		daysRemaining := -1.0
		var runoutDateStr *string

		if avgUsage > 0 {
			daysRemaining = ing.CurrentStock / avgUsage
			runoutDate := now.Add(time.Duration(daysRemaining*24) * time.Hour)
			formattedDate := runoutDate.Format("2006-01-02")
			runoutDateStr = &formattedDate
		}

		predictions = append(predictions, RunoutPrediction{
			IngredientID:        ing.ID,
			IngredientName:      ing.Name,
			CurrentStock:        ing.CurrentStock,
			Unit:                ing.Unit,
			AvgDailyUsage:       avgUsage,
			DaysRemaining:       daysRemaining,
			EstimatedRunoutDate: runoutDateStr,
		})
	}

	Success(c, http.StatusOK, predictions)
}

type BusyHourItem struct {
	Hour             int `json:"hour"`
	TransactionCount int `json:"transaction_count"`
}

// GetBusyHours returns transaction distribution by hour of day
// @Summary      Get Busy Hours
// @Description  Get transaction count distribution grouped by hour of day for completed transactions
// @Tags         analytics
// @Security     BearerAuth
// @Param        days query int false "Number of days to analyze (default 30)"
// @Produce      json
// @Success      200 {object} Response{data=[]BusyHourItem}
// @Failure      500 {object} Response
// @Router       /analytics/busy-hours [get]
func (h *AnalyticsHandler) GetBusyHours(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		layout := "2006-01-02"
		start, errStart := time.ParseInLocation(layout, startDate, time.Local)
		end, errEnd := time.ParseInLocation(layout, endDate, time.Local)
		if errStart != nil || errEnd != nil {
			Error(c, http.StatusBadRequest, "Format tanggal tidak valid.")
			return
		}
		end = end.Add(24 * time.Hour).Add(-time.Nanosecond)

		query := `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(id) AS tx_count
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= $1 AND created_at <= $2
		          GROUP BY hour
		          ORDER BY hour ASC`
		rows, err = h.db.Query(query, start, end)
	} else {
		daysStr := c.DefaultQuery("days", "30")
		days, errConv := strconv.Atoi(daysStr)
		if errConv != nil || days <= 0 {
			days = 30
		}
		query := `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(id) AS tx_count
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= NOW() - ($1 || ' days')::INTERVAL
		          GROUP BY hour
		          ORDER BY hour ASC`
		rows, err = h.db.Query(query, days)
	}

	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat data jam sibuk: "+err.Error())
		return
	}
	defer rows.Close()

	// Seed all 24 hours with zero counts
	hoursMap := make(map[int]int)
	for h := 0; h < 24; h++ {
		hoursMap[h] = 0
	}

	for rows.Next() {
		var hour, count int
		if err := rows.Scan(&hour, &count); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses data jam sibuk: "+err.Error())
			return
		}
		hoursMap[hour] = count
	}

	var result []BusyHourItem
	for h := 0; h < 24; h++ {
		result = append(result, BusyHourItem{
			Hour:             h,
			TransactionCount: hoursMap[h],
		})
	}

	Success(c, http.StatusOK, result)
}

type CustomerRankingItem struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	Phone             string    `json:"phone"`
	TotalSpent        float64   `json:"total_spent"`
	TotalTransactions int       `json:"total_transactions"`
}

// GetCustomerRanking returns top customers by total spending
// @Summary      Get Customer Ranking
// @Description  Get customers ranked by total spending amount
// @Tags         analytics
// @Security     BearerAuth
// @Param        limit query int false "Number of top customers (default 10)"
// @Produce      json
// @Success      200 {object} Response{data=[]CustomerRankingItem}
// @Failure      500 {object} Response
// @Router       /analytics/customers/ranking [get]
func (h *AnalyticsHandler) GetCustomerRanking(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	query := `SELECT id, name, phone, total_spent, total_transactions
	          FROM customers
	          WHERE total_transactions > 0
	          ORDER BY total_spent DESC
	          LIMIT $1`
	rows, err := h.db.Query(query, limit)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat ranking pelanggan: "+err.Error())
		return
	}
	defer rows.Close()

	var ranking []CustomerRankingItem
	for rows.Next() {
		var item CustomerRankingItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Phone, &item.TotalSpent, &item.TotalTransactions); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses ranking pelanggan: "+err.Error())
			return
		}
		ranking = append(ranking, item)
	}

	Success(c, http.StatusOK, ranking)
}

type PaymentMethodItem struct {
	PaymentMethod string  `json:"payment_method"`
	TotalSales    float64 `json:"total_sales"`
	TxCount       int     `json:"transaction_count"`
}

// GetPaymentMethods returns sales breakdown by payment method
func (h *AnalyticsHandler) GetPaymentMethods(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		layout := "2006-01-02"
		start, errStart := time.ParseInLocation(layout, startDate, time.Local)
		end, errEnd := time.ParseInLocation(layout, endDate, time.Local)
		if errStart != nil || errEnd != nil {
			Error(c, http.StatusBadRequest, "Format tanggal tidak valid.")
			return
		}
		end = end.Add(24 * time.Hour).Add(-time.Nanosecond)

		query := `SELECT payment_method, COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(id) AS tx_count
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= $1 AND created_at <= $2
		          GROUP BY payment_method
		          ORDER BY total_sales DESC`
		rows, err = h.db.Query(query, start, end)
	} else {
		daysStr := c.DefaultQuery("days", "30")
		days, errConv := strconv.Atoi(daysStr)
		if errConv != nil || days <= 0 {
			days = 30
		}
		query := `SELECT payment_method, COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(id) AS tx_count
		          FROM transactions
		          WHERE status = 'completed' AND created_at >= NOW() - ($1 || ' days')::INTERVAL
		          GROUP BY payment_method
		          ORDER BY total_sales DESC`
		rows, err = h.db.Query(query, days)
	}

	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat data metode pembayaran: "+err.Error())
		return
	}
	defer rows.Close()

	var result []PaymentMethodItem
	for rows.Next() {
		var item PaymentMethodItem
		if err := rows.Scan(&item.PaymentMethod, &item.TotalSales, &item.TxCount); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses data metode pembayaran: "+err.Error())
			return
		}
		result = append(result, item)
	}

	Success(c, http.StatusOK, result)
}

type CategorySalesItem struct {
	CategoryName string  `json:"category_name"`
	TotalSales   float64 `json:"total_sales"`
	TotalQty     int     `json:"total_quantity"`
}

// GetCategorySales returns sales breakdown by product category
func (h *AnalyticsHandler) GetCategorySales(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		layout := "2006-01-02"
		start, errStart := time.ParseInLocation(layout, startDate, time.Local)
		end, errEnd := time.ParseInLocation(layout, endDate, time.Local)
		if errStart != nil || errEnd != nil {
			Error(c, http.StatusBadRequest, "Format tanggal tidak valid.")
			return
		}
		end = end.Add(24 * time.Hour).Add(-time.Nanosecond)

		query := `SELECT c.name AS category_name, COALESCE(SUM(ti.subtotal), 0) AS total_sales, COALESCE(SUM(ti.quantity), 0)::int AS total_qty
		          FROM transaction_items ti
		          JOIN products p ON ti.product_id = p.id
		          JOIN categories c ON p.category_id = c.id
		          JOIN transactions t ON ti.transaction_id = t.id
		          WHERE t.status = 'completed' AND t.created_at >= $1 AND t.created_at <= $2
		          GROUP BY c.id, c.name
		          ORDER BY total_sales DESC`
		rows, err = h.db.Query(query, start, end)
	} else {
		daysStr := c.DefaultQuery("days", "30")
		days, errConv := strconv.Atoi(daysStr)
		if errConv != nil || days <= 0 {
			days = 30
		}
		query := `SELECT c.name AS category_name, COALESCE(SUM(ti.subtotal), 0) AS total_sales, COALESCE(SUM(ti.quantity), 0)::int AS total_qty
		          FROM transaction_items ti
		          JOIN products p ON ti.product_id = p.id
		          JOIN categories c ON p.category_id = c.id
		          JOIN transactions t ON ti.transaction_id = t.id
		          WHERE t.status = 'completed' AND t.created_at >= NOW() - ($1 || ' days')::INTERVAL
		          GROUP BY c.id, c.name
		          ORDER BY total_sales DESC`
		rows, err = h.db.Query(query, days)
	}

	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memuat data kategori menu: "+err.Error())
		return
	}
	defer rows.Close()

	var result []CategorySalesItem
	for rows.Next() {
		var item CategorySalesItem
		if err := rows.Scan(&item.CategoryName, &item.TotalSales, &item.TotalQty); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses data kategori menu: "+err.Error())
			return
		}
		result = append(result, item)
	}

	Success(c, http.StatusOK, result)
}

