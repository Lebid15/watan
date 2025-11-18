package database

import (
	"errors"
	"fmt"
	"time"

	"github.com/lebid15/ahla/backend/internal/config"
	"github.com/lebid15/ahla/backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// OpenPostgres opens a PostgreSQL database connection using the provided configuration.
func OpenPostgres(cfg config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		cfg.Database.SSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("obtain sql db: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db, nil
}

// AutoMigrate ensures the minimal tables required for the API exist.
func AutoMigrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&domain.Tenant{},
		&domain.User{},
		&domain.ProviderCredential{},
		&domain.SuperAdmin{},
		&domain.ProductCategory{},
		&domain.Product{},
	); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}
	return nil
}

// BootstrapDefaultTenant inserts/updates a default tenant + provider credentials from config.
func BootstrapDefaultTenant(db *gorm.DB, cfg config.Config) error {
	tenant := domain.Tenant{ID: cfg.Auth.DefaultTenantID}
	if err := db.Where("id = ?", tenant.ID).FirstOrCreate(&tenant, domain.Tenant{
		ID:          cfg.Auth.DefaultTenantID,
		Name:        "Default Tenant",
		DisplayName: "Ahla Default Tenant",
	}).Error; err != nil {
		return fmt.Errorf("seed tenant: %w", err)
	}

	credential := domain.ProviderCredential{}
	err := db.Where("tenant_id = ? AND provider = ?", cfg.Auth.DefaultTenantID, "znet").First(&credential).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("lookup provider credential: %w", err)
		}
		if err := db.Create(&domain.ProviderCredential{
			ID:       fmt.Sprintf("znet-%s", cfg.Auth.DefaultTenantID),
			TenantID: cfg.Auth.DefaultTenantID,
			Provider: "znet",
			BaseURL:  cfg.Provider.ZnetBaseURL,
			Kod:      cfg.Provider.ZnetKod,
			Sifre:    cfg.Provider.ZnetSifre,
		}).Error; err != nil {
			return fmt.Errorf("seed provider credential: %w", err)
		}
	} else {
		credential.BaseURL = cfg.Provider.ZnetBaseURL
		credential.Kod = cfg.Provider.ZnetKod
		credential.Sifre = cfg.Provider.ZnetSifre
		if err := db.Save(&credential).Error; err != nil {
			return fmt.Errorf("update provider credential: %w", err)
		}
	}

	return nil
}
