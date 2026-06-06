package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mentaimental/pos-backend/pkg/middleware"
	"github.com/mentaimental/pos-backend/pkg/model"
)

type SettingsHandler struct {
	db *sql.DB
}

func NewSettingsHandler(db *sql.DB) *SettingsHandler {
	return &SettingsHandler{db: db}
}

func (h *SettingsHandler) RegisterRoutes(r *gin.RouterGroup) {
	settings := r.Group("/settings", middleware.AuthRequired())
	{
		settings.GET("", h.GetSettings)
		settings.PUT("", middleware.RequireRole(model.RoleOwner), h.UpdateSettings)
	}
}

// GetSettings retrieves system settings
// @Summary      Get Settings
// @Description  Get a key-value map of store and system configuration settings
// @Tags         settings
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} Response{data=map[string]string}
// @Failure      500 {object} Response
// @Router       /settings [get]
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	rows, err := h.db.Query("SELECT key, value FROM settings")
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal mengambil pengaturan: "+err.Error())
		return
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memproses pengaturan: "+err.Error())
			return
		}
		settings[key] = value
	}

	Success(c, http.StatusOK, settings)
}

// UpdateSettings modifies store settings
// @Summary      Update Settings
// @Description  Modify store profile and configuration settings (Owner only)
// @Tags         settings
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        request body map[string]string true "Settings key-value updates"
// @Success      200 {object} Response
// @Failure      400 {object} Response
// @Failure      500 {object} Response
// @Router       /settings [put]
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "Payload pengaturan tidak valid")
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		Error(c, http.StatusInternalServerError, "Gagal memulai transaksi: "+err.Error())
		return
	}
	defer tx.Rollback()

	query := `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
	          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`

	for k, v := range req {
		_, err = tx.Exec(query, k, v)
		if err != nil {
			Error(c, http.StatusInternalServerError, "Gagal memperbarui kunci "+k+": "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		Error(c, http.StatusInternalServerError, "Gagal menyimpan perubahan: "+err.Error())
		return
	}

	Success(c, http.StatusOK, "Pengaturan berhasil diperbarui")
}
