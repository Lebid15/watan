package domain

import (
	"time"

	"gorm.io/datatypes"
)

// Tenant represents an Ahla tenant. For the local build we only need an id + name.
type Tenant struct {
	ID           string    `gorm:"primaryKey;size:64"`
	Name         string    `gorm:"size:255;not null"`
	Subdomain    string    `gorm:"size:100;uniqueIndex"`
	DisplayName  string    `gorm:"size:255"`
	ContactEmail string    `gorm:"size:255"`
	LogoURL      string    `gorm:"size:512"`
	Status       string    `gorm:"size:32;default:active"`
	CreatedAt    time.Time `gorm:"autoCreateTime"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime"`
}

// User roles recognised by the API.
const (
	RoleSuperAdmin  = "super_admin"
	RoleTenantAdmin = "tenant_admin"
	RoleTenantUser  = "tenant_user"
)

// User represents an authenticated person synced from Auth0 plus local metadata.
type User struct {
	ID          string    `gorm:"primaryKey;size:36"`
	TenantID    string    `gorm:"size:64;not null;index;index:idx_users_email_tenant,unique,priority:1"`
	Email       string    `gorm:"size:255;not null"`
	EmailLower  string    `gorm:"size:255;not null;index:idx_users_email_tenant,unique,priority:2"`
	Name        string    `gorm:"size:255"`
	PictureURL  string    `gorm:"size:512"`
	Auth0Sub    string    `gorm:"size:128;uniqueIndex"`
	Role        string    `gorm:"size:32;not null"`
	LastLoginAt time.Time `gorm:"index"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime"`
}

// ProviderCredential stores credentials per tenant for a provider such as ZNet.
type ProviderCredential struct {
	ID        string    `gorm:"primaryKey;size:64"`
	TenantID  string    `gorm:"size:64;index;not null"`
	Provider  string    `gorm:"size:32;not null"`
	BaseURL   string    `gorm:"size:255;not null"`
	Kod       string    `gorm:"size:128;not null"`
	Sifre     string    `gorm:"size:128;not null"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// SuperAdmin represents a platform-level administrator.
type SuperAdmin struct {
	ID           string    `gorm:"primaryKey;size:36"`
	Email        string    `gorm:"size:255;uniqueIndex;not null"`
	Username     string    `gorm:"size:100;not null"`
	DisplayName  string    `gorm:"size:255"`
	PasswordHash string    `gorm:"size:255;not null"`
	Status       string    `gorm:"size:32;default:active"`
	CreatedAt    time.Time `gorm:"autoCreateTime"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime"`
}

// ProductCategory groups master catalog products.
type ProductCategory struct {
	ID          string    `gorm:"primaryKey;size:36"`
	Name        string    `gorm:"size:255;not null"`
	DisplayName string    `gorm:"size:255"`
	Description string    `gorm:"type:text"`
	SortOrder   int       `gorm:"default:0"`
	Active      bool      `gorm:"default:true"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime"`
}

// Product represents a master catalog entry managed by super admins.
type Product struct {
	ID              string          `gorm:"primaryKey;size:36"`
	CategoryID      string          `gorm:"size:36;index"`
	Category        ProductCategory `gorm:"foreignKey:CategoryID"`
	Code            string          `gorm:"size:100;uniqueIndex;not null"`
	Name            string          `gorm:"size:255;not null"`
	DisplayName     string          `gorm:"size:255"`
	BaseCostUSD     float64         `gorm:"type:decimal(10,4);not null"`
	Available       bool            `gorm:"default:true"`
	Customizable    bool            `gorm:"default:false"`
	MinAmount       float64         `gorm:"type:decimal(10,2)"`
	MaxAmount       float64         `gorm:"type:decimal(10,2)"`
	InputParameters datatypes.JSON  `gorm:"type:jsonb"`
	SortOrder       int             `gorm:"default:0"`
	Metadata        datatypes.JSON  `gorm:"type:jsonb"`
	CreatedAt       time.Time       `gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `gorm:"autoUpdateTime"`
}
