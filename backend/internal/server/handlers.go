package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/domain"
	"github.com/lebid15/ahla/backend/internal/provider"
	"github.com/lebid15/ahla/backend/internal/provider/zdk"
	"github.com/lebid15/ahla/backend/internal/provider/znet"
)

func (s *Server) registerRoutes() {
	s.engine.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	auth := s.engine.Group("/api/v1/auth")
	auth.POST("/exchange", s.handleAuth0Exchange)

	superAdmin := s.engine.Group("/api/v1/superadmin")
	s.registerSuperAdminRoutes(superAdmin)

	api := s.engine.Group("/api/v1")
	api.Use(s.authMiddleware())
	creds := api.Group("/provider-credentials")
	creds.GET("", s.handleListProviderCredentials)
	creds.POST("", s.handleCreateProviderCredential)

	znetGroup := api.Group("/providers/znet")
	znetGroup.GET("/balance", s.handleZNetBalance)
	znetGroup.GET("/products", s.handleZNetProducts)
	znetGroup.POST("/orders", s.handleZNetOrder)

	zdkGroup := api.Group("/providers/zdk")
	zdkGroup.GET("/balance", s.handleZDKBalance)
	zdkGroup.GET("/products", s.handleZDKProducts)
	zdkGroup.POST("/orders", s.handleZDKOrder)
}

func (s *Server) handleAuth0Exchange(c *gin.Context) {
	var req struct {
		IDToken string `json:"id_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id_token is required"})
		return
	}

	claims, err := s.auth0.VerifyIDToken(req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	user, err := s.upsertUserFromAuth0(c.Request.Context(), claims)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync user"})
		return
	}

	token, err := issueToken(s.cfg.Auth.JWTSecret, tokenClaims{
		Subject:  claims.Subject,
		TenantID: user.TenantID,
		UserID:   user.ID,
		Role:     user.Role,
		Expires:  time.Now().Add(12 * time.Hour),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  serializeUser(user),
	})
}

func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		parts := strings.Fields(authz)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		claims, err := parseToken(parts[1], s.cfg.Auth.JWTSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		var user domain.User
		if err := s.db.WithContext(c.Request.Context()).First(&user, "id = ?", claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
			return
		}
		if user.TenantID != claims.TenantID {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "tenant mismatch"})
			return
		}

		c.Set("tenant_id", user.TenantID)
		c.Set("user_id", user.ID)
		c.Set("user_role", user.Role)
		c.Set("current_user", serializeUser(user))
		c.Next()
	}
}

func (s *Server) handleZNetBalance(c *gin.Context) {
	ctx := c.Request.Context()
	client, err := s.buildZNetClient(c, c.Query("credential_id"))
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	balance, err := client.GetBalance(ctx)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, balance)
}

func (s *Server) handleZDKBalance(c *gin.Context) {
	ctx := c.Request.Context()
	providerKey := c.DefaultQuery("provider", provider.ProviderZDK)
	client, err := s.buildZDKClient(c, providerKey, c.Query("credential_id"))
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	balance, err := client.GetBalance(ctx)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, balance)
}

func (s *Server) handleZNetProducts(c *gin.Context) {
	ctx := c.Request.Context()
	client, err := s.buildZNetClient(c, c.Query("credential_id"))
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	products, err := client.ListProducts(ctx)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": products})
}

func (s *Server) handleZDKProducts(c *gin.Context) {
	ctx := c.Request.Context()
	providerKey := c.DefaultQuery("provider", provider.ProviderZDK)
	client, err := s.buildZDKClient(c, providerKey, c.Query("credential_id"))
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	products, err := client.ListProducts(ctx)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": products})
}

func (s *Server) handleZNetOrder(c *gin.Context) {
	var req struct {
		CredentialID     string `json:"credential_id"`
		GameID           string `json:"game_id" binding:"required"`
		CouponID         string `json:"coupon_id" binding:"required"`
		PlayerIdentifier string `json:"player_identifier" binding:"required"`
		Reference        string `json:"reference"`
		CustomerPhone    string `json:"customer_phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}
	ctx := c.Request.Context()
	client, err := s.buildZNetClient(c, req.CredentialID)
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	orderReq := znet.PlaceOrderRequest{
		GameID:           req.GameID,
		CouponID:         req.CouponID,
		PlayerIdentifier: req.PlayerIdentifier,
		Reference:        req.Reference,
		CustomerPhone:    req.CustomerPhone,
	}
	resp, err := client.PlaceOrder(ctx, orderReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (s *Server) handleZDKOrder(c *gin.Context) {
	var req struct {
		Provider     string            `json:"provider"`
		CredentialID string            `json:"credential_id"`
		ProductID    string            `json:"product_id" binding:"required"`
		Quantity     int               `json:"quantity" binding:"required"`
		Params       map[string]string `json:"params"`
		OrderUUID    string            `json:"order_uuid"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}
	if req.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantity must be positive"})
		return
	}
	ctx := c.Request.Context()
	providerKey := req.Provider
	if strings.TrimSpace(providerKey) == "" {
		providerKey = provider.ProviderZDK
	}
	client, err := s.buildZDKClient(c, providerKey, req.CredentialID)
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	resp, err := client.PlaceOrder(ctx, zdk.PlaceOrderRequest{
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		Params:    req.Params,
		OrderUUID: req.OrderUUID,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (s *Server) handleListProviderCredentials(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	creds, err := s.providers.ListCredentials(ctx, tenantID, c.Query("provider"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list provider credentials"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": sanitizeCredentialList(creds)})
}

func (s *Server) handleCreateProviderCredential(c *gin.Context) {
	if !s.requireRole(c, domain.RoleSuperAdmin, domain.RoleTenantAdmin) {
		return
	}
	var req struct {
		Provider string `json:"provider" binding:"required"`
		BaseURL  string `json:"base_url" binding:"required"`
		Kod      string `json:"kod" binding:"required"`
		Sifre    string `json:"sifre" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}
	credential, err := s.providers.CreateCredential(c.Request.Context(), c.GetString("tenant_id"), provider.CreateCredentialInput{
		Provider: req.Provider,
		BaseURL:  req.BaseURL,
		Kod:      req.Kod,
		Sifre:    req.Sifre,
	})
	if err != nil {
		s.respondProviderError(c, err)
		return
	}
	c.JSON(http.StatusCreated, sanitizeCredential(credential))
}

func (s *Server) buildZNetClient(c *gin.Context, credentialID string) (*znet.Client, error) {
	client, _, err := s.providers.BuildZNetClient(c.Request.Context(), c.GetString("tenant_id"), credentialID)
	return client, err
}

func (s *Server) buildZDKClient(c *gin.Context, providerKey, credentialID string) (*zdk.Client, error) {
	client, _, err := s.providers.BuildZDKClient(c.Request.Context(), c.GetString("tenant_id"), providerKey, credentialID)
	return client, err
}

func (s *Server) respondProviderError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, provider.ErrCredentialNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "provider credential not found"})
	case errors.Is(err, provider.ErrUnsupportedProvider):
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider not supported"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "provider error"})
	}
}

func (s *Server) requireRole(c *gin.Context, allowed ...string) bool {
	role := c.GetString("user_role")
	for _, candidate := range allowed {
		if role == candidate {
			return true
		}
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	return false
}

type credentialResponse struct {
	ID        string    `json:"id"`
	Provider  string    `json:"provider"`
	BaseURL   string    `json:"base_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func sanitizeCredential(c domain.ProviderCredential) credentialResponse {
	return credentialResponse{
		ID:        c.ID,
		Provider:  c.Provider,
		BaseURL:   c.BaseURL,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}

func sanitizeCredentialList(creds []domain.ProviderCredential) []credentialResponse {
	items := make([]credentialResponse, 0, len(creds))
	for _, cred := range creds {
		items = append(items, sanitizeCredential(cred))
	}
	return items
}
