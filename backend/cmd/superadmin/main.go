package main

import (
	"flag"
	"fmt"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/config"
	"github.com/lebid15/ahla/backend/internal/database"
	"github.com/lebid15/ahla/backend/internal/domain"
)

func main() {
	email := flag.String("email", "", "Email for the super admin (required)")
	username := flag.String("username", "", "Username for the super admin")
	displayName := flag.String("name", "", "Display name for the super admin")
	password := flag.String("password", "", "Password for the super admin (required)")
	flag.Parse()

	if *email == "" || *password == "" {
		log.Fatal("email and password are required")
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

	hash, err := auth.HashPassword(*password)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}

	admin := domain.SuperAdmin{
		ID:           uuid.NewString(),
		Email:        *email,
		Username:     fallback(*username, *email),
		DisplayName:  fallback(*displayName, *username, *email),
		PasswordHash: hash,
		Status:       "active",
	}

	if err := createSuperAdmin(db, admin); err != nil {
		log.Fatalf("create super admin: %v", err)
	}

	fmt.Printf("Super admin created: %s (id=%s)\n", admin.Email, admin.ID)
}

func createSuperAdmin(db *gorm.DB, admin domain.SuperAdmin) error {
	var existing domain.SuperAdmin
	if err := db.Where("email = ?", admin.Email).First(&existing).Error; err == nil {
		return fmt.Errorf("super admin with email %s already exists", admin.Email)
	}

	return db.Create(&admin).Error
}

func fallback(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
