package auth

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Auth0Claims mirrors the subset of fields we care about from Auth0 ID tokens.
type Auth0Claims struct {
	jwt.RegisteredClaims
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture"`
	Nickname string `json:"nickname"`
}

// Verifier validates Auth0-issued JWTs using the tenant JWKS endpoint.
type Verifier struct {
	domain   string
	audience []string
	keyfunc  keyfunc.Keyfunc
	cancel   context.CancelFunc
}

// NewAuth0Verifier creates a verifier that trusts the provided domain and optional audience.
func NewAuth0Verifier(domain string, audience []string) (*Verifier, error) {
	if domain == "" {
		return nil, fmt.Errorf("auth0 domain is required")
	}
	trimmed := strings.TrimSuffix(domain, "/")
	if !strings.Contains(trimmed, ".") {
		return nil, fmt.Errorf("invalid auth0 domain: %s", domain)
	}
	jwksURL, err := url.JoinPath("https://"+trimmed, ".well-known/jwks.json")
	if err != nil {
		return nil, fmt.Errorf("build jwks url: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	keyf, err := keyfunc.NewDefaultOverrideCtx(ctx, []string{jwksURL}, keyfunc.Override{
		RefreshInterval: time.Hour,
		RefreshErrorHandlerFunc: func(u string) func(context.Context, error) {
			return func(ctx context.Context, err error) {
				fmt.Printf("auth0 jwks refresh error (%s): %v\n", u, err)
			}
		},
	})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("load jwks: %w", err)
	}

	return &Verifier{
		domain:   trimmed,
		audience: audience,
		keyfunc:  keyf,
		cancel:   cancel,
	}, nil
}

// VerifyIDToken parses and validates the provided ID token, returning the claims on success.
func (v *Verifier) VerifyIDToken(tokenString string) (Auth0Claims, error) {
	if tokenString == "" {
		return Auth0Claims{}, fmt.Errorf("id token is required")
	}

	parserOpts := []jwt.ParserOption{jwt.WithIssuer("https://" + v.domain + "/")}
	for _, aud := range v.audience {
		parserOpts = append(parserOpts, jwt.WithAudience(aud))
	}
	parser := jwt.NewParser(parserOpts...)
	token, err := parser.ParseWithClaims(tokenString, &Auth0Claims{}, v.keyfunc.KeyfuncCtx(context.Background()))
	if err != nil {
		return Auth0Claims{}, fmt.Errorf("parse auth0 token: %w", err)
	}

	claims, ok := token.Claims.(*Auth0Claims)
	if !ok || !token.Valid {
		return Auth0Claims{}, fmt.Errorf("invalid auth0 token claims")
	}

	if claims.Subject == "" {
		return Auth0Claims{}, fmt.Errorf("auth0 token missing subject")
	}

	return *claims, nil
}

// Close releases underlying JWKS resources.
func (v *Verifier) Close() {
	if v == nil {
		return
	}
	if v.cancel != nil {
		v.cancel()
	}
}
