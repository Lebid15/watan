package server

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func requestLogger() gin.HandlerFunc {
	logger := log.New(log.Writer(), "[http] ", log.LstdFlags)
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		logger.Printf("%s %s -> %d (%s)", c.Request.Method, c.Request.URL.Path, c.Writer.Status(), latency)
	}
}
