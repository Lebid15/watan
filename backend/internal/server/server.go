package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/config"
	"github.com/lebid15/ahla/backend/internal/provider"
)

// Options bundles the dependencies required by the HTTP server.
type Options struct {
	Config    config.Config
	DB        *gorm.DB
	Auth0     *auth.Verifier
	Providers *provider.Service
}

// Server wraps the Gin engine and keeps references to shared services.
type Server struct {
	cfg       config.Config
	db        *gorm.DB
	auth0     *auth.Verifier
	providers *provider.Service
	engine    *gin.Engine
}

// New builds a new Server with routes/middleware wired.
func New(opts Options) *Server {
	if opts.DB == nil {
		panic("server: db dependency is required")
	}
	if opts.Auth0 == nil {
		panic("server: auth0 verifier is required")
	}
	if opts.Providers == nil {
		panic("server: provider service is required")
	}
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(requestLogger())

	s := &Server{
		cfg:       opts.Config,
		db:        opts.DB,
		auth0:     opts.Auth0,
		providers: opts.Providers,
		engine:    engine,
	}

	s.registerRoutes()
	return s
}

// Run starts serving HTTP traffic until the context is cancelled.
func (s *Server) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:    s.cfg.App.Addr,
		Handler: s.engine,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}
