package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/domain"
)

const superAdminTenantID = "super_admin"

func (s *Server) registerSuperAdminRoutes(group *gin.RouterGroup) {
	group.POST("/auth/login", s.handleSuperAdminLogin)

	protected := group.Group("")
	protected.Use(s.superAdminAuthMiddleware())
	protected.GET("/auth/profile", s.handleSuperAdminProfile)

	protected.GET("/categories", s.handleListProductCategories)
	protected.POST("/categories", s.handleCreateProductCategory)
	protected.GET("/categories/:id", s.handleGetProductCategory)
	protected.PUT("/categories/:id", s.handleUpdateProductCategory)
	protected.DELETE("/categories/:id", s.handleDeleteProductCategory)

	protected.GET("/products", s.handleListProducts)
	protected.POST("/products", s.handleCreateProduct)
	protected.GET("/products/:id", s.handleGetProduct)
	protected.PUT("/products/:id", s.handleUpdateProduct)
	protected.DELETE("/products/:id", s.handleDeleteProduct)

	protected.GET("/tenants", s.handleListTenants)
	protected.POST("/tenants", s.handleCreateTenant)
	protected.GET("/tenants/:id", s.handleGetTenant)
	protected.PUT("/tenants/:id", s.handleUpdateTenant)
}

func (s *Server) handleSuperAdminLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid credentials"})
		return
	}

	lower := strings.ToLower(strings.TrimSpace(req.Email))
	var admin domain.SuperAdmin
	if err := s.db.WithContext(c.Request.Context()).Where("LOWER(email) = ?", lower).First(&admin).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}

	if err := auth.VerifyPassword(admin.PasswordHash, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := issueToken(s.cfg.Auth.JWTSecret, tokenClaims{
		Subject:  admin.ID,
		TenantID: superAdminTenantID,
		UserID:   admin.ID,
		Role:     domain.RoleSuperAdmin,
		Expires:  time.Now().Add(12 * time.Hour),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":       token,
		"super_admin": serializeSuperAdmin(admin),
	})
}

func (s *Server) handleSuperAdminProfile(c *gin.Context) {
	admin, ok := c.Get("super_admin")
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "context missing"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"super_admin": admin})
}

func (s *Server) superAdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		parts := strings.Fields(authz)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		claims, err := parseToken(parts[1], s.cfg.Auth.JWTSecret)
		if err != nil || claims.Role != domain.RoleSuperAdmin {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		var admin domain.SuperAdmin
		if err := s.db.WithContext(c.Request.Context()).First(&admin, "id = ?", claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "admin not found"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "admin lookup failed"})
			return
		}

		c.Set("super_admin_id", admin.ID)
		c.Set("super_admin", serializeSuperAdmin(admin))
		c.Next()
	}
}

type superAdminDTO struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func serializeSuperAdmin(sa domain.SuperAdmin) superAdminDTO {
	return superAdminDTO{
		ID:          sa.ID,
		Email:       sa.Email,
		Username:    sa.Username,
		DisplayName: sa.DisplayName,
		Status:      sa.Status,
		CreatedAt:   sa.CreatedAt,
		UpdatedAt:   sa.UpdatedAt,
	}
}

// ----- Product Categories -----

type categoryCreateRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	SortOrder   *int   `json:"sort_order"`
	Active      *bool  `json:"active"`
}

type categoryUpdateRequest struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
	Active      *bool   `json:"active"`
}

func (s *Server) handleListProductCategories(c *gin.Context) {
	ctx := c.Request.Context()
	query := s.db.WithContext(ctx).Model(&domain.ProductCategory{})
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(display_name) LIKE ?", like, like)
	}
	if v := strings.TrimSpace(c.Query("active")); v != "" {
		if parsed, ok := parseOptionalBool(v); ok {
			query = query.Where("active = ?", parsed)
		}
	}
	query = query.Order("sort_order ASC, name ASC")

	var categories []domain.ProductCategory
	if err := query.Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list categories failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": serializeProductCategoryList(categories)})
}

func (s *Server) handleCreateProductCategory(c *gin.Context) {
	var req categoryCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category payload"})
		return
	}

	category := domain.ProductCategory{
		ID:          uuid.NewString(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
	}
	if req.SortOrder != nil {
		category.SortOrder = *req.SortOrder
	}
	if req.Active != nil {
		category.Active = *req.Active
	}

	if err := s.db.WithContext(c.Request.Context()).Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create category"})
		return
	}

	c.JSON(http.StatusCreated, serializeProductCategory(category))
}

func (s *Server) handleGetProductCategory(c *gin.Context) {
	category, err := s.findCategoryByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		s.respondCategoryError(c, err)
		return
	}
	c.JSON(http.StatusOK, serializeProductCategory(category))
}

func (s *Server) handleUpdateProductCategory(c *gin.Context) {
	var req categoryUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category payload"})
		return
	}

	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no updates specified"})
		return
	}

	ctx := c.Request.Context()
	if err := s.db.WithContext(ctx).Model(&domain.ProductCategory{}).Where("id = ?", c.Param("id")).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update category"})
		return
	}

	category, err := s.findCategoryByID(ctx, c.Param("id"))
	if err != nil {
		s.respondCategoryError(c, err)
		return
	}

	c.JSON(http.StatusOK, serializeProductCategory(category))
}

func (s *Server) handleDeleteProductCategory(c *gin.Context) {
	if err := s.db.WithContext(c.Request.Context()).Delete(&domain.ProductCategory{}, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete category"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ----- Products -----

type productCreateRequest struct {
	CategoryID      string          `json:"category_id"`
	Code            string          `json:"code" binding:"required"`
	Name            string          `json:"name" binding:"required"`
	DisplayName     string          `json:"display_name"`
	BaseCostUSD     float64         `json:"base_cost_usd" binding:"required"`
	Available       *bool           `json:"available"`
	Customizable    *bool           `json:"customizable"`
	MinAmount       *float64        `json:"min_amount"`
	MaxAmount       *float64        `json:"max_amount"`
	SortOrder       *int            `json:"sort_order"`
	InputParameters json.RawMessage `json:"input_parameters"`
	Metadata        json.RawMessage `json:"metadata"`
}

type productUpdateRequest struct {
	CategoryID      *string         `json:"category_id"`
	Code            *string         `json:"code"`
	Name            *string         `json:"name"`
	DisplayName     *string         `json:"display_name"`
	BaseCostUSD     *float64        `json:"base_cost_usd"`
	Available       *bool           `json:"available"`
	Customizable    *bool           `json:"customizable"`
	MinAmount       *float64        `json:"min_amount"`
	MaxAmount       *float64        `json:"max_amount"`
	SortOrder       *int            `json:"sort_order"`
	InputParameters json.RawMessage `json:"input_parameters"`
	Metadata        json.RawMessage `json:"metadata"`
}

func (s *Server) handleListProducts(c *gin.Context) {
	ctx := c.Request.Context()
	query := s.db.WithContext(ctx).Model(&domain.Product{}).Preload("Category")
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(code) LIKE ?", like, like)
	}
	if cat := strings.TrimSpace(c.Query("category_id")); cat != "" {
		query = query.Where("category_id = ?", cat)
	}
	if v := strings.TrimSpace(c.Query("available")); v != "" {
		if parsed, ok := parseOptionalBool(v); ok {
			query = query.Where("available = ?", parsed)
		}
	}
	query = query.Order("sort_order ASC, name ASC")

	var products []domain.Product
	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list products failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": serializeProductList(products)})
}

func (s *Server) handleCreateProduct(c *gin.Context) {
	var req productCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product payload"})
		return
	}

	ctx := c.Request.Context()
	if err := s.ensureCategoryExists(ctx, req.CategoryID); err != nil {
		s.respondCategoryError(c, err)
		return
	}

	inputJSON, err := normalizeJSONField(req.InputParameters, []byte("[]"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input_parameters"})
		return
	}
	metadataJSON, err := normalizeJSONField(req.Metadata, []byte("{}"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid metadata"})
		return
	}

	product := domain.Product{
		ID:              uuid.NewString(),
		CategoryID:      req.CategoryID,
		Code:            req.Code,
		Name:            req.Name,
		DisplayName:     req.DisplayName,
		BaseCostUSD:     req.BaseCostUSD,
		InputParameters: inputJSON,
		Metadata:        metadataJSON,
	}
	if req.Available != nil {
		product.Available = *req.Available
	}
	if req.Customizable != nil {
		product.Customizable = *req.Customizable
	}
	if req.MinAmount != nil {
		product.MinAmount = *req.MinAmount
	}
	if req.MaxAmount != nil {
		product.MaxAmount = *req.MaxAmount
	}
	if req.SortOrder != nil {
		product.SortOrder = *req.SortOrder
	}

	if err := s.db.WithContext(ctx).Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create product"})
		return
	}

	created, err := s.findProductByID(ctx, product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load product"})
		return
	}

	c.JSON(http.StatusCreated, serializeProduct(created))
}

func (s *Server) handleGetProduct(c *gin.Context) {
	product, err := s.findProductByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		s.respondProductError(c, err)
		return
	}
	c.JSON(http.StatusOK, serializeProduct(product))
}

func (s *Server) handleUpdateProduct(c *gin.Context) {
	var req productUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product payload"})
		return
	}

	updates := make(map[string]any)
	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.Code != nil {
		updates["code"] = strings.TrimSpace(*req.Code)
	}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.BaseCostUSD != nil {
		updates["base_cost_usd"] = *req.BaseCostUSD
	}
	if req.Available != nil {
		updates["available"] = *req.Available
	}
	if req.Customizable != nil {
		updates["customizable"] = *req.Customizable
	}
	if req.MinAmount != nil {
		updates["min_amount"] = *req.MinAmount
	}
	if req.MaxAmount != nil {
		updates["max_amount"] = *req.MaxAmount
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.InputParameters != nil {
		jsonValue, err := normalizeJSONField(req.InputParameters, []byte("[]"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input_parameters"})
			return
		}
		updates["input_parameters"] = jsonValue
	}
	if req.Metadata != nil {
		jsonValue, err := normalizeJSONField(req.Metadata, []byte("{}"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid metadata"})
			return
		}
		updates["metadata"] = jsonValue
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no updates specified"})
		return
	}

	ctx := c.Request.Context()
	if catID, ok := updates["category_id"].(string); ok {
		if err := s.ensureCategoryExists(ctx, catID); err != nil {
			s.respondCategoryError(c, err)
			return
		}
	}

	if err := s.db.WithContext(ctx).Model(&domain.Product{}).Where("id = ?", c.Param("id")).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update product"})
		return
	}

	product, err := s.findProductByID(ctx, c.Param("id"))
	if err != nil {
		s.respondProductError(c, err)
		return
	}

	c.JSON(http.StatusOK, serializeProduct(product))
}

func (s *Server) handleDeleteProduct(c *gin.Context) {
	if err := s.db.WithContext(c.Request.Context()).Delete(&domain.Product{}, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete product"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ----- Helpers -----

func (s *Server) findCategoryByID(ctx context.Context, id string) (domain.ProductCategory, error) {
	var category domain.ProductCategory
	if err := s.db.WithContext(ctx).First(&category, "id = ?", id).Error; err != nil {
		return domain.ProductCategory{}, err
	}
	return category, nil
}

func (s *Server) findProductByID(ctx context.Context, id string) (domain.Product, error) {
	var product domain.Product
	if err := s.db.WithContext(ctx).Preload("Category").First(&product, "id = ?", id).Error; err != nil {
		return domain.Product{}, err
	}
	return product, nil
}

func (s *Server) ensureCategoryExists(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return nil
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&domain.ProductCategory{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Server) respondCategoryError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "category lookup failed"})
	}
}

func (s *Server) respondProductError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "product lookup failed"})
	}
}

func normalizeJSONField(raw json.RawMessage, fallback []byte) (datatypes.JSON, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return datatypes.JSON(fallback), nil
	}
	if !json.Valid(trimmed) {
		return nil, fmt.Errorf("invalid json")
	}
	buf := make([]byte, len(trimmed))
	copy(buf, trimmed)
	return datatypes.JSON(buf), nil
}

func cloneJSONField(data datatypes.JSON, fallback []byte) json.RawMessage {
	if len(data) == 0 {
		return json.RawMessage(fallback)
	}
	buf := make([]byte, len(data))
	copy(buf, data)
	return json.RawMessage(buf)
}

func parseOptionalBool(value string) (bool, bool) {
	b, err := strconv.ParseBool(value)
	if err != nil {
		return false, false
	}
	return b, true
}

type productCategoryDTO struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sort_order"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func serializeProductCategory(c domain.ProductCategory) productCategoryDTO {
	return productCategoryDTO{
		ID:          c.ID,
		Name:        c.Name,
		DisplayName: c.DisplayName,
		Description: c.Description,
		SortOrder:   c.SortOrder,
		Active:      c.Active,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func serializeProductCategoryList(items []domain.ProductCategory) []productCategoryDTO {
	result := make([]productCategoryDTO, 0, len(items))
	for _, item := range items {
		result = append(result, serializeProductCategory(item))
	}
	return result
}

type productDTO struct {
	ID              string              `json:"id"`
	CategoryID      string              `json:"category_id"`
	Category        *productCategoryDTO `json:"category,omitempty"`
	Code            string              `json:"code"`
	Name            string              `json:"name"`
	DisplayName     string              `json:"display_name"`
	BaseCostUSD     float64             `json:"base_cost_usd"`
	Available       bool                `json:"available"`
	Customizable    bool                `json:"customizable"`
	MinAmount       float64             `json:"min_amount"`
	MaxAmount       float64             `json:"max_amount"`
	SortOrder       int                 `json:"sort_order"`
	InputParameters json.RawMessage     `json:"input_parameters"`
	Metadata        json.RawMessage     `json:"metadata"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
}

func serializeProduct(p domain.Product) productDTO {
	var category *productCategoryDTO
	if p.Category.ID != "" {
		catCopy := serializeProductCategory(p.Category)
		category = &catCopy
	}
	return productDTO{
		ID:              p.ID,
		CategoryID:      p.CategoryID,
		Category:        category,
		Code:            p.Code,
		Name:            p.Name,
		DisplayName:     p.DisplayName,
		BaseCostUSD:     p.BaseCostUSD,
		Available:       p.Available,
		Customizable:    p.Customizable,
		MinAmount:       p.MinAmount,
		MaxAmount:       p.MaxAmount,
		SortOrder:       p.SortOrder,
		InputParameters: cloneJSONField(p.InputParameters, []byte("[]")),
		Metadata:        cloneJSONField(p.Metadata, []byte("{}")),
		CreatedAt:       p.CreatedAt,
		UpdatedAt:       p.UpdatedAt,
	}
}

func serializeProductList(items []domain.Product) []productDTO {
	result := make([]productDTO, 0, len(items))
	for _, item := range items {
		result = append(result, serializeProduct(item))
	}
	return result
}
