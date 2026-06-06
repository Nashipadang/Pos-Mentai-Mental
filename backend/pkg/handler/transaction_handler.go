package handler

import (
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"bytes"
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"

	"github.com/mentaimental/pos-backend/pkg/config"
	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
	"github.com/mentaimental/pos-backend/pkg/repository"
)

type TransactionHandler struct {
	txRepo       repository.TransactionRepository
	productRepo  repository.ProductRepository
	promoRepo    repository.PromoRepository
	customerRepo repository.CustomerRepository
	db           *sql.DB
}

func NewTransactionHandler(tr repository.TransactionRepository, pr repository.ProductRepository, promR repository.PromoRepository, cr repository.CustomerRepository, db *sql.DB) *TransactionHandler {
	return &TransactionHandler{
		txRepo:       tr,
		productRepo:  pr,
		promoRepo:    promR,
		customerRepo: cr,
		db:           db,
	}
}

func (h *TransactionHandler) RegisterRoutes(r *gin.RouterGroup) {
	txs := r.Group("/transactions")
	{
		// Authenticated POS routes
		txs.POST("", middleware.AuthRequired(), h.Create)
		txs.GET("", middleware.AuthRequired(), h.GetAll)
		txs.GET("/:id", middleware.AuthRequired(), h.GetByID)
		txs.POST("/:id/cancel", middleware.AuthRequired(), h.Cancel)
		txs.POST("/:id/send-whatsapp-receipt", middleware.AuthRequired(), h.SendWhatsAppReceipt)

		// Public Midtrans notification webhook
		txs.POST("/midtrans-webhook", h.MidtransWebhook)
	}
}

type CreateItemRequest struct {
	ProductID string `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type CreateTransactionRequest struct {
	CustomerID    *string             `json:"customer_id"`
	PaymentMethod model.PaymentMethod `json:"payment_method" binding:"required"`
	PromoCode     *string             `json:"promo_code"`
	Items         []CreateItemRequest `json:"items" binding:"required,gt=0"`
}

type CheckoutResponse struct {
	Transaction       model.Transaction `json:"transaction"`
	SnapToken         string            `json:"snap_token,omitempty"`
	SnapRedirectURL   string            `json:"snap_redirect_url,omitempty"`
}

// Create checks out a transaction cart
// @Summary      Create Checkout
// @Description  Check BOM ingredients availability, deduct stock, update loyalty records, and request payment token
// @Tags         transaction
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body CreateTransactionRequest true "Cart Details"
// @Success      201 {object} Response{data=CheckoutResponse}
// @Failure      400 {object} Response
// @Failure      409 {object} Response
// @Failure      500 {object} Response
// @Router       /transactions [post]
func (h *TransactionHandler) Create(c *gin.Context) {
	var req CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Data transaksi tidak valid")
		return
	}

	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		Error(c, http.StatusUnauthorized, "User ID tidak valid")
		return
	}

	var customerID *uuid.UUID
	if req.CustomerID != nil && *req.CustomerID != "" {
		parsedCustID, err := uuid.Parse(*req.CustomerID)
		if err != nil {
			Error(c, http.StatusBadRequest, "Customer ID tidak valid")
			return
		}
		customerID = &parsedCustID
	}

	// Get today's transaction count to generate sequence number
	count, err := h.txRepo.GetTodayCount()
	if err != nil {
		log.Printf("Failed to get today count: %v", err)
		count = 0
	}
	sequence := count + 1
	txID := repository.GenerateReadableUUID(sequence)
	var totalAmount float64
	var txItems []model.TransactionItem

	// Validate product prices and map transaction items
	for _, item := range req.Items {
		prodID, err := uuid.Parse(item.ProductID)
		if err != nil {
			Error(c, http.StatusBadRequest, "Product ID tidak valid: "+item.ProductID)
			return
		}

		p, err := h.productRepo.GetByID(prodID)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal mengambil data produk")
			return
		}
		if p == nil || !p.IsActive {
			Error(c, http.StatusBadRequest, "Produk tidak aktif atau tidak ditemukan: "+item.ProductID)
			return
		}

		subtotal := p.Price * float64(item.Quantity)
		totalAmount += subtotal

		txItems = append(txItems, model.TransactionItem{
			ID:            uuid.New(),
			TransactionID: txID,
			ProductID:     prodID,
			Quantity:      item.Quantity,
			UnitPrice:     p.Price,
			Subtotal:      subtotal,
			Product:       p,
		})
	}

	// Determine transaction state based on payment method
	var paymentStatus model.PaymentStatus = model.PaymentStatusPaid
	var txStatus model.TransactionStatus = model.TxStatusCompleted

	if req.PaymentMethod == model.PaymentMidtrans {
		paymentStatus = model.PaymentStatusPending
		txStatus = model.TxStatusPending
	}

	// Calculate promo/discount if applied
	var discountAmount float64
	var appliedPromoCode *string

	if req.PromoCode != nil && *req.PromoCode != "" {
		p, err := h.promoRepo.GetByCode(*req.PromoCode)
		if err == nil && p != nil && p.IsActive && totalAmount >= p.MinTransaction {
			appliedPromoCode = &p.Code
			if p.Type == "percentage" {
				discountAmount = (p.Value / 100.0) * totalAmount
				if p.MaxDiscount != nil && *p.MaxDiscount > 0 && discountAmount > *p.MaxDiscount {
					discountAmount = *p.MaxDiscount
				}
			} else if p.Type == "flat" {
				discountAmount = p.Value
			}
			if discountAmount > totalAmount {
				discountAmount = totalAmount
			}
		}
	}

	finalTotal := totalAmount - discountAmount

	t := &model.Transaction{
		ID:             txID,
		UserID:         userID,
		CustomerID:     customerID,
		TotalAmount:    finalTotal,
		PaymentMethod:  req.PaymentMethod,
		PaymentStatus:  paymentStatus,
		Status:         txStatus,
		PromoCode:      appliedPromoCode,
		DiscountAmount: discountAmount,
		Items:          txItems,
	}

	// Request snap payment details if using Midtrans
	var snapToken string
	var snapRedirectURL string
	if req.PaymentMethod == model.PaymentMidtrans {
		orderID := txID.String()
		t.MidtransOrderID = &orderID

		if config.App.MidtransServerKey == "dummy" || config.App.MidtransServerKey == "" {
			// Mock details in case keys are not configured
			dummyToken := "snap-token-mock-" + uuid.New().String()[:8]
			dummyURL := "https://checkout.sandbox.midtrans.com/v1/payment-redirect?token=" + dummyToken
			t.MidtransToken = &dummyToken
			snapToken = dummyToken
			snapRedirectURL = dummyURL
		} else {
			// Request actual snap details from Midtrans API
			var envType midtrans.EnvironmentType = midtrans.Sandbox
			if config.App.MidtransEnv == "production" {
				envType = midtrans.Production
			}

			s := snap.Client{}
			s.New(config.App.MidtransServerKey, envType)

			snapReq := &snap.Request{
				TransactionDetails: midtrans.TransactionDetails{
					OrderID:  orderID,
					GrossAmt: int64(t.TotalAmount),
				},
				Expiry: &snap.ExpiryDetails{
					Duration: 24,
					Unit:     "hour",
				},
			}

			snapResp, err := s.CreateTransaction(snapReq)
			if err != nil {
				log.Printf("Midtrans Snap error: %v", err)
				Error(c, http.StatusInternalServerError, "Gagal menghubungi API Midtrans: "+err.Error())
				return
			}
			t.MidtransToken = &snapResp.Token
			snapToken = snapResp.Token
			snapRedirectURL = snapResp.RedirectURL
		}
	}

	// Save transaction and deduct inventory stock
	err = h.txRepo.Create(t)
	if err != nil {
		// Return friendly stock deduction errors (which contain "Stok tidak mencukupi")
		if strings.Contains(err.Error(), "Stok tidak mencukupi") {
			Error(c, http.StatusConflict, err.Error())
			return
		}
		Error(c, http.StatusInternalServerError, "Gagal menyimpan transaksi: "+err.Error())
		return
	}



	Success(c, http.StatusCreated, CheckoutResponse{
		Transaction:     *t,
		SnapToken:       snapToken,
		SnapRedirectURL: snapRedirectURL,
	})
}

// GetAll lists transaction history
// @Summary      Get Transaction History
// @Description  Get a list of all transactions sorted by date
// @Tags         transaction
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=[]model.Transaction}
// @Failure      500 {object} Response
// @Router       /transactions [get]
func (h *TransactionHandler) GetAll(c *gin.Context) {
	pageStr := c.Query("page")
	limitStr := c.Query("limit")

	if pageStr == "" && limitStr == "" {
		txs, err := h.txRepo.GetAll()
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal mengambil riwayat transaksi")
			return
		}
		Success(c, http.StatusOK, txs)
		return
	}

	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	search := c.Query("search")
	status := c.Query("status")
	paymentMethod := c.Query("payment_method")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	txs, total, err := h.txRepo.GetPaginated(page, limit, search, status, paymentMethod, startDate, endDate)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil riwayat transaksi terpaginasi: "+err.Error())
		return
	}

	SuccessWithMeta(c, http.StatusOK, txs, &Meta{
		Page:    page,
		PerPage: limit,
		Total:   total,
	})
}

// checkMidtransStatus queries the Midtrans API directly to retrieve order status
func (h *TransactionHandler) checkMidtransStatus(orderID string) (string, string, error) {
	if config.App.MidtransServerKey == "" || config.App.MidtransServerKey == "dummy" {
		return "", "", nil
	}

	url := "https://api.sandbox.midtrans.com/v2/" + orderID + "/status"
	if config.App.MidtransEnv == "production" {
		url = "https://api.midtrans.com/v2/" + orderID + "/status"
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", "", err
	}

	auth := config.App.MidtransServerKey + ":"
	basicAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
	req.Header.Set("Authorization", basicAuth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("midtrans status returned code %d", resp.StatusCode)
	}

	var result struct {
		TransactionStatus string `json:"transaction_status"`
		FraudStatus       string `json:"fraud_status"`
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return "", "", err
	}

	return result.TransactionStatus, result.FraudStatus, nil
}

// GetByID returns detailed transaction summary
// @Summary      Get Transaction by ID
// @Description  Get detailed invoice summary containing product checkouts
// @Tags         transaction
// @Security     BearerAuth
// @Param        id path string true "Transaction UUID"
// @Produce      json
// @Success      200 {object} Response{data=model.Transaction}
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Router       /transactions/{id} [get]
func (h *TransactionHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	t, err := h.txRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data detail transaksi")
		return
	}
	if t == nil {
		Error(c, http.StatusNotFound, "Transaksi tidak ditemukan")
		return
	}

	// If transaction is pending and paid via midtrans, check status dynamically to sync
	if t.PaymentMethod == model.PaymentMidtrans && t.PaymentStatus == model.PaymentStatusPending {
		txStatus, fraudStatus, err := h.checkMidtransStatus(t.ID.String())
		if err == nil && txStatus != "" {
			var payStatus model.PaymentStatus
			var status model.TransactionStatus
			var shouldUpdate bool

			switch txStatus {
			case "capture", "settlement":
				if fraudStatus == "challenge" {
					payStatus = model.PaymentStatusPending
					status = model.TxStatusPending
				} else {
					payStatus = model.PaymentStatusPaid
					status = model.TxStatusCompleted
					shouldUpdate = true
				}
			case "deny", "expire", "cancel", "failure":
				payStatus = model.PaymentStatusFailed
				status = model.TxStatusCancelled
				shouldUpdate = true
			}

			if shouldUpdate {
				_ = h.txRepo.UpdatePaymentStatus(t.ID, payStatus, status)
				// Reload updated transaction details
				updatedT, err := h.txRepo.GetByID(t.ID)
				if err == nil && updatedT != nil {
					t = updatedT
				}
			}
		}
	}

	Success(c, http.StatusOK, t)
}

// Cancel voids a transaction and restores deducted stock
// @Summary      Cancel Transaction
// @Description  Void a transaction and increment the stock levels back
// @Tags         transaction
// @Security     BearerAuth
// @Param        id path string true "Transaction UUID"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /transactions/{id}/cancel [post]
func (h *TransactionHandler) Cancel(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID tidak valid")
		return
	}

	err = h.txRepo.UpdatePaymentStatus(id, model.PaymentStatusFailed, model.TxStatusCancelled)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal melakukan pembatalan transaksi: "+err.Error())
		return
	}
	Success(c, http.StatusOK, gin.H{"id": idStr, "status": "cancelled"})
}

type MidtransPayload struct {
	TransactionStatus string `json:"transaction_status"`
	PaymentType       string `json:"payment_type"`
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	FraudStatus       string `json:"fraud_status"`
}

// MidtransWebhook processes public callbacks from Midtrans servers
// @Summary      Midtrans Payment Webhook
// @Description  Validate signature key and update transaction status to Paid/Failed
// @Tags         transaction
// @Accept       json
// @Produce      json
// @Param        request body MidtransPayload true "Webhook Payload"
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      401 {object} Response
// @Router       /transactions/midtrans-webhook [post]
func (h *TransactionHandler) MidtransWebhook(c *gin.Context) {
	var payload MidtransPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "Invalid payload")
		return
	}

	log.Printf("Midtrans Webhook: Received notification for OrderID: %s, Status: %s", payload.OrderID, payload.TransactionStatus)

	// Validate Signature Key if real server key is set
	if config.App.MidtransServerKey != "" && config.App.MidtransServerKey != "dummy" {
		input := payload.OrderID + payload.StatusCode + payload.GrossAmount + config.App.MidtransServerKey
		hasher := sha512.New()
		hasher.Write([]byte(input))
		expectedSignature := hex.EncodeToString(hasher.Sum(nil))

		if payload.SignatureKey != expectedSignature {
			Error(c, http.StatusUnauthorized, "Tanda tangan digital tidak valid")
			return
		}
	}

	// Let's parse payload.OrderID as a UUID directly!
	txID, err := uuid.Parse(payload.OrderID)
	if err != nil {
		Error(c, http.StatusBadRequest, "Order ID bukan UUID yang valid")
		return
	}

	// Map Midtrans payment status to domain status
	var payStatus model.PaymentStatus
	var status model.TransactionStatus

	switch payload.TransactionStatus {
	case "capture", "settlement":
		if payload.FraudStatus == "challenge" {
			payStatus = model.PaymentStatusPending
			status = model.TxStatusPending
		} else {
			payStatus = model.PaymentStatusPaid
			status = model.TxStatusCompleted
		}
	case "pending":
		payStatus = model.PaymentStatusPending
		status = model.TxStatusPending
	case "deny", "expire", "cancel", "failure":
		payStatus = model.PaymentStatusFailed
		status = model.TxStatusCancelled
	default:
		payStatus = model.PaymentStatusPending
		status = model.TxStatusPending
	}

	err = h.txRepo.UpdatePaymentStatus(txID, payStatus, status)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengupdate status transaksi: "+err.Error())
		return
	}



	Success(c, http.StatusOK, gin.H{"status": "processed"})
}

// ── WhatsApp Receipt Helpers ──────────────────────────────────────────────────

func (h *TransactionHandler) triggerWhatsAppReceipt(t *model.Transaction) {
	if t == nil || t.CustomerID == nil || t.Status != model.TxStatusCompleted {
		return
	}

	cust, err := h.customerRepo.GetByID(*t.CustomerID)
	if err != nil || cust == nil || cust.Phone == "" {
		return
	}

	settings, err := h.getSettingsMap()
	if err != nil {
		log.Printf("[WA Gateway] Failed to load settings for receipt: %v", err)
		settings = map[string]string{
			"store_name":     "Mentai Mental",
			"receipt_header": "MENTAI MENTAL",
			"receipt_footer": "Terima kasih atas pesanan Anda!",
		}
	}

	receiptMsg := h.formatReceiptMessage(t, cust.Name, settings)
	go h.sendWhatsAppGateway(cust.Phone, receiptMsg)
}

func formatIDR(val float64) string {
	n := int64(val)
	s := strconv.FormatInt(n, 10)
	
	var result []string
	length := len(s)
	for i := length; i > 0; i -= 3 {
		start := i - 3
		if start < 0 {
			start = 0
		}
		result = append([]string{s[start:i]}, result...)
	}
	
	return "Rp " + strings.Join(result, ".")
}

func formatTxID(id string) string {
	parts := strings.Split(id, "-")
	if len(parts) >= 2 && len(parts[0]) == 8 && len(parts[1]) == 4 {
		dateStr := parts[0]
		seqStr := parts[1]
		
		day := dateStr[0:2]
		month := dateStr[2:4]
		yearShort := dateStr[6:8]
		
		return fmt.Sprintf("TX-%s%s%s-%s", day, month, yearShort, seqStr)
	}
	
	if len(id) > 8 {
		return "TX-" + strings.ToUpper(id[:8])
	}
	return id
}

func (h *TransactionHandler) getSettingsMap() (map[string]string, error) {
	rows, err := h.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err == nil {
			settings[key] = value
		}
	}
	return settings, nil
}

func (h *TransactionHandler) formatReceiptMessage(t *model.Transaction, custName string, settings map[string]string) string {
	header := settings["receipt_header"]
	if header == "" {
		header = settings["store_name"]
	}
	if header == "" {
		header = "MENTAI MENTAL"
	}

	address := strings.ReplaceAll(settings["store_address"], "\\n", "\n")
	footer := settings["receipt_footer"]
	if footer == "" {
		footer = "Terima kasih atas pesanan Anda!\nMentai Mental - Dimsum Mentai Juara"
	} else {
		footer = strings.ReplaceAll(footer, "\\n", "\n")
	}

	txID := formatTxID(t.ID.String())
	
	loc, err := time.LoadLocation("Asia/Jakarta")
	var formattedTime string
	if err == nil {
		formattedTime = t.CreatedAt.In(loc).Format("02 Jan 2006 15:04")
	} else {
		formattedTime = t.CreatedAt.Format("02 Jan 2006 15:04")
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("*%s*\n", strings.ToUpper(header)))
	if address != "" {
		sb.WriteString(fmt.Sprintf("%s\n", address))
	}
	sb.WriteString("----------------------------------------\n")
	sb.WriteString(fmt.Sprintf("No. Transaksi : %s\n", txID))
	sb.WriteString(fmt.Sprintf("Tanggal       : %s\n", formattedTime))
	sb.WriteString(fmt.Sprintf("Pelanggan     : %s\n", custName))
	sb.WriteString("----------------------------------------\n")

	var subtotalAmount float64
	for _, item := range t.Items {
		prodName := "Produk"
		if item.Product != nil {
			prodName = item.Product.Name
		}
		if item.Quantity > 1 {
			sb.WriteString(fmt.Sprintf("%dx %s (@%s) - %s\n", item.Quantity, prodName, formatIDR(item.UnitPrice), formatIDR(item.Subtotal)))
		} else {
			sb.WriteString(fmt.Sprintf("%dx %s - %s\n", item.Quantity, prodName, formatIDR(item.Subtotal)))
		}
		subtotalAmount += item.Subtotal
	}
	sb.WriteString("----------------------------------------\n")
	sb.WriteString(fmt.Sprintf("Subtotal      : %s\n", formatIDR(subtotalAmount)))
	
	if t.DiscountAmount > 0 {
		promoInfo := ""
		if t.PromoCode != nil && *t.PromoCode != "" {
			promoInfo = fmt.Sprintf(" (%s)", *t.PromoCode)
		}
		sb.WriteString(fmt.Sprintf("Diskon        : -%s%s\n", formatIDR(t.DiscountAmount), promoInfo))
	}
	
	sb.WriteString(fmt.Sprintf("Total         : %s\n", formatIDR(t.TotalAmount)))
	
	payMethod := string(t.PaymentMethod)
	if len(payMethod) > 0 {
		payMethod = strings.ToUpper(payMethod[:1]) + payMethod[1:]
	}
	sb.WriteString(fmt.Sprintf("Pembayaran    : %s\n", payMethod))
	sb.WriteString("----------------------------------------\n")
	sb.WriteString(footer)

	return sb.String()
}

func (h *TransactionHandler) sendWhatsAppGateway(phone string, message string) {
	url := "http://localhost:9000/send"
	
	payloadMap := map[string]string{
		"phone":   phone,
		"message": message,
	}
	
	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		log.Printf("[WA Gateway] Failed to marshal payload: %v", err)
		return
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("[WA Gateway] Failed to create HTTP request: %v", err)
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[WA Gateway] Service offline or request failed: %v", err)
		return
	}
	defer resp.Body.Close()
	
	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("[WA Gateway] Received error status %d: %s", resp.StatusCode, string(bodyBytes))
		return
	}
	
	log.Printf("[WA Gateway] Pesan otomatis berhasil dikirim ke nomor %s", phone)
}

type SendWhatsAppReceiptRequest struct {
	Phone *string `json:"phone"`
}

// SendWhatsAppReceipt manual trigger to send receipt to client's phone
// @Summary      Send Receipt via WhatsApp
// @Description  Format transaction receipt and trigger local WhatsApp gateway
// @Tags         transaction
// @Security     BearerAuth
// @Param        id path string true "Transaction UUID"
// @Param        request body SendWhatsAppReceiptRequest false "Optional Phone Number Override"
// @Produce      json
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      404 {object} Response
// @Failure      500 {object} Response
// @Router       /transactions/{id}/send-whatsapp-receipt [post]
func (h *TransactionHandler) SendWhatsAppReceipt(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(c, http.StatusBadRequest, "ID transaksi tidak valid")
		return
	}

	t, err := h.txRepo.GetByID(id)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil data transaksi")
		return
	}
	if t == nil {
		Error(c, http.StatusNotFound, "Transaksi tidak ditemukan")
		return
	}

	var bodyReq SendWhatsAppReceiptRequest
	_ = c.ShouldBindJSON(&bodyReq) // Ignore error as body is optional

	var recipientPhone string
	if bodyReq.Phone != nil && *bodyReq.Phone != "" {
		recipientPhone = *bodyReq.Phone
	} else {
		if t.CustomerID == nil {
			Error(c, http.StatusBadRequest, "Transaksi ini adalah Walk-In. Silakan masukkan nomor telepon penerima.")
			return
		}
		cust, err := h.customerRepo.GetByID(*t.CustomerID)
		if err != nil || cust == nil || cust.Phone == "" {
			Error(c, http.StatusBadRequest, "Pelanggan tidak memiliki nomor telepon terdaftar. Silakan masukkan nomor telepon penerima.")
			return
		}
		recipientPhone = cust.Phone
	}

	custName := "Walk-In"
	if t.CustomerID != nil {
		cust, err := h.customerRepo.GetByID(*t.CustomerID)
		if err == nil && cust != nil {
			custName = cust.Name
		}
	}

	settings, err := h.getSettingsMap()
	if err != nil {
		log.Printf("[WA Gateway] Failed to load settings for receipt: %v", err)
		settings = map[string]string{
			"store_name":     "Mentai Mental",
			"receipt_header": "MENTAI MENTAL",
			"receipt_footer": "Terima kasih atas pesanan Anda!",
		}
	}

	receiptMsg := h.formatReceiptMessage(t, custName, settings)

	// Post JSON body to local gateway synchronously to report success/failure
	url := "http://localhost:9000/send"
	payloadMap := map[string]string{
		"phone":   recipientPhone,
		"message": receiptMsg,
	}

	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memproses payload WhatsApp")
		return
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal membuat HTTP request ke gateway")
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		Error(c, http.StatusServiceUnavailable, "Gateway WhatsApp sedang offline. Silakan pastikan microservice berjalan.")
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(bodyBytes, &errResp)
		errMsg := errResp.Error
		if errMsg == "" {
			errMsg = string(bodyBytes)
		}
		Error(c, resp.StatusCode, "Gagal dari gateway WhatsApp: "+errMsg)
		return
	}

	Success(c, http.StatusOK, gin.H{"message": "Struk WhatsApp berhasil dikirim ke " + recipientPhone})
}
