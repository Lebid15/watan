package main

import (
    "flag"
    "fmt"
    "log"
    "strings"
    "time"

    "github.com/google/uuid"
    "gorm.io/gorm"

    "github.com/lebid15/ahla/backend/internal/config"
    "github.com/lebid15/ahla/backend/internal/database"
    "github.com/lebid15/ahla/backend/internal/domain"
)

func main() {
    tenantID := flag.String("tenant-id", "", "Tenant ID that the admin belongs to (required)")
    email := flag.String("email", "", "Email for the tenant admin (required)")
    name := flag.String("name", "", "Display name for the tenant admin")
    role := flag.String("role", domain.RoleTenantAdmin, "Role to assign (tenant_admin or tenant_user)")
    auth0Sub := flag.String("auth0-sub", "", "Optional Auth0 subject identifier")
    flag.Parse()

    if strings.TrimSpace(*tenantID) == "" {
        log.Fatal("tenant-id is required")
    }
    if strings.TrimSpace(*email) == "" {
        log.Fatal("email is required")
    }

    assignedRole := strings.TrimSpace(*role)
    if assignedRole == "" {
        assignedRole = domain.RoleTenantAdmin
    }
    if assignedRole != domain.RoleTenantAdmin && assignedRole != domain.RoleTenantUser {
        log.Fatalf("unsupported role %s (expected tenant_admin or tenant_user)", assignedRole)
    }

    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("load config: %v", err)
    }

    db, err := database.OpenPostgres(cfg)
    if err != nil {
        log.Fatalf("open database: %v", err)
    }
    if err := database.AutoMigrate(db); err != nil {
        log.Fatalf("auto migrate: %v", err)
    }

    tenantIDVal := strings.TrimSpace(*tenantID)
    if err := ensureTenantExists(db, tenantIDVal); err != nil {
        log.Fatalf("tenant lookup: %v", err)
    }

    user, err := buildTenantUser(tenantIDVal, strings.TrimSpace(*email), strings.TrimSpace(*name), assignedRole, strings.TrimSpace(*auth0Sub))
    if err != nil {
        log.Fatalf("build tenant user: %v", err)
    }

    if err := createTenantUser(db, user); err != nil {
        log.Fatalf("create tenant user: %v", err)
    }

    fmt.Printf("Tenant user %s created for tenant %s with role %s (id=%s)\n", user.Email, user.TenantID, user.Role, user.ID)
}

func ensureTenantExists(db *gorm.DB, tenantID string) error {
    var tenant domain.Tenant
    if err := db.First(&tenant, "id = ?", tenantID).Error; err != nil {
        if err == gorm.ErrRecordNotFound {
            return fmt.Errorf("tenant %s not found", tenantID)
        }
        return err
    }
    return nil
}

func buildTenantUser(tenantID, email, name, role, auth0Sub string) (domain.User, error) {
    lower := strings.ToLower(email)
    if lower == "" {
        return domain.User{}, fmt.Errorf("email cannot be empty")
    }

    displayName := name
    if strings.TrimSpace(displayName) == "" {
        displayName = preferredNameFromEmail(email)
    }

    return domain.User{
        ID:          uuid.NewString(),
        TenantID:    tenantID,
        Email:       email,
        EmailLower:  lower,
        Name:        displayName,
        Role:        role,
        Auth0Sub:    auth0Sub,
        LastLoginAt: time.Now(),
    }, nil
}

func createTenantUser(db *gorm.DB, user domain.User) error {
    var existing domain.User
    err := db.Where("tenant_id = ? AND email_lower = ?", user.TenantID, user.EmailLower).First(&existing).Error
    if err == nil {
        return fmt.Errorf("user with email %s already exists for tenant %s", user.Email, user.TenantID)
    }
    if err != nil && err != gorm.ErrRecordNotFound {
        return err
    }
    return db.Create(&user).Error
}

func preferredNameFromEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) > 0 {
        return strings.Title(strings.ReplaceAll(parts[0], ".", " "))
    }
    return email
}
