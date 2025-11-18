package server

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/domain"
)

const (
	tenantStatusActive    = "active"
	tenantStatusSuspended = "suspended"
	tenantStatusPending   = "pending"
)

var (
	allowedTenantStatuses = map[string]struct{}{
		tenantStatusActive:    {},
		tenantStatusSuspended: {},
		tenantStatusPending:   {},
	}
	subdomainPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`)
)

type tenantCreateRequest struct {
	Name         string `json:"name" binding:"required"`
	DisplayName  string `json:"display_name"`
	Subdomain    string `json:"subdomain" binding:"required"`
	ContactEmail string `json:"contact_email" binding:"required,email"`
	LogoURL      string `json:"logo_url"`
	Status       string `json:"status"`
}

type tenantUpdateRequest struct {
	Name         *string `json:"name"`
	DisplayName  *string `json:"display_name"`
	Subdomain    *string `json:"subdomain"`
	ContactEmail *string `json:"contact_email" binding:"omitempty,email"`
	LogoURL      *string `json:"logo_url"`
	Status       *string `json:"status"`
}

type tenantDTO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	DisplayName  string `json:"display_name"`
	Subdomain    string `json:"subdomain"`
	ContactEmail string `json:"contact_email"`
	LogoURL      string `json:"logo_url"`
	Status       string `json:"status"`
}

type tenantListResponse struct {
	Items []tenantDTO `json:"items"`
}

func (s *Server) handleListTenants(c *gin.Context) {
	ctx := c.Request.Context()
	query := s.db.WithContext(ctx).Model(&domain.Tenant{})

	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(display_name) LIKE ? OR LOWER(subdomain) LIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		if _, ok := allowedTenantStatuses[status]; ok {
			query = query.Where("status = ?", status)
		}
	}

	var tenants []domain.Tenant
	if err := query.Order("created_at DESC").Find(&tenants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tenants"})
		return
	}

	c.JSON(http.StatusOK, tenantListResponse{Items: serializeTenantList(tenants)})
}

func (s *Server) handleCreateTenant(c *gin.Context) {
	var req tenantCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant payload"})
		return
	}

	subdomain := normalizeSubdomain(req.Subdomain)
	if err := validateSubdomain(subdomain); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if exists, err := s.tenantSubdomainExists(c.Request.Context(), subdomain, ""); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "subdomain check failed"})
		return
	} else if exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subdomain already in use"})
		return
	}

	status := req.Status
	if status == "" {
		status = tenantStatusActive
	}
	if _, ok := allowedTenantStatuses[status]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	tenant := domain.Tenant{
		ID:           uuid.NewString(),
		Name:         strings.TrimSpace(req.Name),
		DisplayName:  strings.TrimSpace(req.DisplayName),
		Subdomain:    subdomain,
		ContactEmail: strings.TrimSpace(req.ContactEmail),
		LogoURL:      strings.TrimSpace(req.LogoURL),
		Status:       status,
	}

	if err := s.db.WithContext(c.Request.Context()).Create(&tenant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tenant"})
		return
	}

	c.JSON(http.StatusCreated, serializeTenant(tenant))
}

func (s *Server) handleGetTenant(c *gin.Context) {
	tenant, err := s.findTenantByID(c.Param("id"), c)
	if err != nil {
		return
	}
	c.JSON(http.StatusOK, serializeTenant(tenant))
}

func (s *Server) handleUpdateTenant(c *gin.Context) {
	var req tenantUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant payload"})
		return
	}

	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.ContactEmail != nil {
		updates["contact_email"] = strings.TrimSpace(*req.ContactEmail)
	}
	if req.LogoURL != nil {
		updates["logo_url"] = strings.TrimSpace(*req.LogoURL)
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if _, ok := allowedTenantStatuses[status]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
			return
		}
		updates["status"] = status
	}
	if req.Subdomain != nil {
		subdomain := normalizeSubdomain(*req.Subdomain)
		if err := validateSubdomain(subdomain); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		exists, err := s.tenantSubdomainExists(c.Request.Context(), subdomain, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "subdomain check failed"})
			return
		}
		if exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subdomain already in use"})
			return
		}
		updates["subdomain"] = subdomain
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no updates specified"})
		return
	}

	ctx := c.Request.Context()
	if err := s.db.WithContext(ctx).Model(&domain.Tenant{}).Where("id = ?", c.Param("id")).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update tenant"})
		return
	}

	tenant, err := s.findTenantByID(c.Param("id"), c)
	if err != nil {
		return
	}

	c.JSON(http.StatusOK, serializeTenant(tenant))
}

func (s *Server) findTenantByID(id string, c *gin.Context) (domain.Tenant, error) {
	var tenant domain.Tenant
	if err := s.db.WithContext(c.Request.Context()).First(&tenant, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
			return domain.Tenant{}, err
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tenant lookup failed"})
		return domain.Tenant{}, err
	}
	return tenant, nil
}

func (s *Server) tenantSubdomainExists(ctx context.Context, subdomain, excludeID string) (bool, error) {
	query := s.db.WithContext(ctx).Model(&domain.Tenant{}).Where("subdomain = ?", subdomain)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func serializeTenant(t domain.Tenant) tenantDTO {
	return tenantDTO{
		ID:           t.ID,
		Name:         t.Name,
		DisplayName:  t.DisplayName,
		Subdomain:    t.Subdomain,
		ContactEmail: t.ContactEmail,
		LogoURL:      t.LogoURL,
		Status:       t.Status,
	}
}

func serializeTenantList(items []domain.Tenant) []tenantDTO {
	res := make([]tenantDTO, 0, len(items))
	for _, item := range items {
		res = append(res, serializeTenant(item))
	}
	return res
}

func normalizeSubdomain(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func validateSubdomain(value string) error {
	if value == "" {
		return fmt.Errorf("subdomain is required")
	}
	if !subdomainPattern.MatchString(value) {
		return fmt.Errorf("invalid subdomain")
	}
	return nil
}
