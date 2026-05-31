package handler

import (
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"

	"github.com/mentaimental/pos-backend/internal/config"
	"github.com/mentaimental/pos-backend/internal/middleware"
	"github.com/mentaimental/pos-backend/internal/model"
	"github.com/mentaimental/pos-backend/internal/repository"
)

type TransactionHandler struct {
	txRepo      repository.TransactionRepository
	productRepo repository.ProductRepository
}

func NewTransactionHandler(tr repository.TransactionRepository, pr repository.ProductRepository) *TransactionHandler {
	return &TransactionHandler{txRepo: tr, productRepo: pr}
}

func (h *TransactionHandler) RegisterRoutes(r *gin.RouterGroup) {
	txs := r.Group("/transactions")
	{
		// Authenticated POS routes
		txs.POST("", middleware.AuthRequired(), h.Create)
		txs.GET("", middleware.AuthRequired(), h.GetAll)
		txs.GET("/:id", middleware.AuthRequired(), h.GetByID)
		txs.POST("/:id/cancel", middleware.AuthRequired(), h.Cancel)

		// Public Midtrans notification webhook
		txs.POST("/midtrans-webhook", h.MidtransWebhook)
	}
}

type CreateItemRequest struct {
	ProductID string `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type CreateTransactionRequest struct {
	CustomerID    *string           `json:"customer_id"`
	PaymentMethod model.PaymentMethod `json:"payment_method" binding:"required"`
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

	txID := uuid.New()
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
		})
	}

	// Determine transaction state based on payment method
	var paymentStatus model.PaymentStatus = model.PaymentStatusPaid
	var txStatus model.TransactionStatus = model.TxStatusCompleted

	if req.PaymentMethod == model.PaymentMidtrans {
		paymentStatus = model.PaymentStatusPending
		txStatus = model.TxStatusPending
	}

	t := &model.Transaction{
		ID:            txID,
		UserID:        userID,
		CustomerID:    customerID,
		TotalAmount:   totalAmount,
		PaymentMethod: req.PaymentMethod,
		PaymentStatus: paymentStatus,
		Status:        txStatus,
		Items:         txItems,
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
					GrossAmt: int64(totalAmount),
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
