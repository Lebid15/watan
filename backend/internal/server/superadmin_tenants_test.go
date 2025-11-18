package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/lebid15/ahla/backend/internal/domain"
)

func TestHandleCreateTenant(t *testing.T) {
	srv, db := newTestServer(t)

	payload := `{"name":"Alpha","display_name":"Alpha Store","subdomain":"alpha","contact_email":"ops@alpha.com"}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/superadmin/tenants", bytes.NewBufferString(payload))
	c.Request.Header.Set("Content-Type", "application/json")

	srv.handleCreateTenant(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}

	var resp tenantDTO
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Subdomain != "alpha" {
		t.Fatalf("expected subdomain alpha, got %s", resp.Subdomain)
	}

	var tenant domain.Tenant
	if err := db.Where("id = ?", resp.ID).First(&tenant).Error; err != nil {
		t.Fatalf("tenant not stored: %v", err)
	}
}

func TestHandleUpdateTenant(t *testing.T) {
	srv, db := newTestServer(t)

	tenant := domain.Tenant{ID: "tenant-1", Name: "Tenant A", Subdomain: "tenant-a", ContactEmail: "a@example.com", Status: tenantStatusActive}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("seed tenant: %v", err)
	}

	payload := `{"status":"suspended","subdomain":"tenant-b"}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: tenant.ID}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/v1/superadmin/tenants/tenant-1", bytes.NewBufferString(payload))
	c.Request.Header.Set("Content-Type", "application/json")

	srv.handleUpdateTenant(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp tenantDTO
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != tenantStatusSuspended {
		t.Fatalf("expected status suspended, got %s", resp.Status)
	}
	if resp.Subdomain != "tenant-b" {
		t.Fatalf("expected updated subdomain")
	}
}
