package handler

import "github.com/gin-gonic/gin"

// Response is the standard API response wrapper
type Response struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Page    int   `json:"page,omitempty"`
	PerPage int   `json:"per_page,omitempty"`
	Total   int64 `json:"total"`
}

func Success(c *gin.Context, code int, data interface{}) {
	c.JSON(code, Response{
		Status: "success",
		Data:   data,
	})
}

func SuccessWithMeta(c *gin.Context, code int, data interface{}, meta *Meta) {
	c.JSON(code, Response{
		Status: "success",
		Data:   data,
		Meta:   meta,
	})
}

func Error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Status:  "error",
		Message: message,
	})
}

func ErrorWithData(c *gin.Context, code int, message string, data interface{}) {
	c.JSON(code, Response{
		Status:  "error",
		Message: message,
		Data:    data,
	})
}
