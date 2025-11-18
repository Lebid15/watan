package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/config"
	"github.com/lebid15/ahla/backend/internal/database"
	"github.com/lebid15/ahla/backend/internal/domain"
)

func TestHandleSuperAdminLoginSuccess(t *testing.T) {
	srv, db := newTestServer(t)

	hash, err := auth.HashPassword("password123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	admin := domain.SuperAdmin{
		ID:           uuid.NewString(),
		Email:        "root@example.com",
		Username:     "root",
		DisplayName:  "Root",
		PasswordHash: hash,
		Status:       "active",
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := bytes.NewBufferString(`{"email":"root@example.com","password":"password123"}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/superadmin/auth/login", body)
	c.Request.Header.Set("Content-Type", "application/json")

	srv.handleSuperAdminLogin(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Token      string        `json:"token"`
		SuperAdmin superAdminDTO `json:"super_admin"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Token == "" {
		t.Fatalf("expected token in response")
	}
	if resp.SuperAdmin.Email != admin.Email {
		t.Fatalf("expected email %s", admin.Email)
	}
}

func TestHandleSuperAdminLoginInvalidPassword(t *testing.T) {
	srv, db := newTestServer(t)
	hash, err := auth.HashPassword("password123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	admin := domain.SuperAdmin{
		ID:           uuid.NewString(),
		Email:        "root@example.com",
		Username:     "root",
		PasswordHash: hash,
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := bytes.NewBufferString(`{"email":"root@example.com","password":"bad"}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/superadmin/auth/login", body)
	c.Request.Header.Set("Content-Type", "application/json")

	srv.handleSuperAdminLogin(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func newTestServer(t *testing.T) (*Server, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	cfg := config.Config{}
	cfg.Auth.JWTSecret = "test-secret"

	srv := &Server{cfg: cfg, db: db}
	return srv, db
}
