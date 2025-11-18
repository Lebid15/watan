package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/config"
	"github.com/lebid15/ahla/backend/internal/database"
	"github.com/lebid15/ahla/backend/internal/provider"
	"github.com/lebid15/ahla/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := database.OpenPostgres(cfg)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	if err := database.BootstrapDefaultTenant(db, cfg); err != nil {
		log.Fatalf("seed database: %v", err)
	}

	audience := cfg.Auth.Auth0.Audience
	if audience == "" {
		audience = cfg.Auth.Auth0.ClientID
	}
	auth0Verifier, err := auth.NewAuth0Verifier(cfg.Auth.Auth0.Domain, []string{audience})
	if err != nil {
		log.Fatalf("init auth0 verifier: %v", err)
	}
	defer auth0Verifier.Close()

	providerService := provider.NewService(db)

	srv := server.New(server.Options{Config: cfg, DB: db, Auth0: auth0Verifier, Providers: providerService})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := srv.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("server error: %v", err)
	}
}
