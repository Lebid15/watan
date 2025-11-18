package server

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/auth"
	"github.com/lebid15/ahla/backend/internal/domain"
)

// userDTO is the sanitized payload returned to clients.
type userDTO struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Email       string    `json:"email"`
	Name        string    `json:"name"`
	PictureURL  string    `json:"picture_url"`
	Role        string    `json:"role"`
	LastLoginAt time.Time `json:"last_login_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func serializeUser(u domain.User) userDTO {
	return userDTO{
		ID:          u.ID,
		TenantID:    u.TenantID,
		Email:       u.Email,
		Name:        u.Name,
		PictureURL:  u.PictureURL,
		Role:        u.Role,
		LastLoginAt: u.LastLoginAt,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

func (s *Server) upsertUserFromAuth0(ctx context.Context, claims auth.Auth0Claims) (domain.User, error) {
	if claims.Subject == "" {
		return domain.User{}, fmt.Errorf("auth0 claims missing subject")
	}
	if claims.Email == "" {
		return domain.User{}, fmt.Errorf("auth0 user missing email claim")
	}

	lower := strings.ToLower(claims.Email)
	now := time.Now()

	var user domain.User
	err := s.db.WithContext(ctx).Where("auth0_sub = ?", claims.Subject).First(&user).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		user = domain.User{
			ID:          uuid.NewString(),
			TenantID:    s.cfg.Auth.DefaultTenantID,
			Email:       claims.Email,
			EmailLower:  lower,
			Name:        firstNonEmpty(claims.Name, claims.Nickname, claims.Email),
			PictureURL:  claims.Picture,
			Auth0Sub:    claims.Subject,
			Role:        domain.RoleTenantUser,
			LastLoginAt: now,
		}
		if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
			return domain.User{}, err
		}
	case err != nil:
		return domain.User{}, err
	default:
		name := firstNonEmpty(claims.Name, claims.Nickname, user.Name)
		updates := map[string]any{
			"email":         claims.Email,
			"email_lower":   lower,
			"name":          name,
			"picture_url":   claims.Picture,
			"last_login_at": now,
		}
		if err := s.db.WithContext(ctx).Model(&user).Updates(updates).Error; err != nil {
			return domain.User{}, err
		}
		// apply in-memory changes for response consistency
		user.Email = claims.Email
		user.EmailLower = lower
		user.Name = name
		user.PictureURL = claims.Picture
		user.LastLoginAt = now
	}

	return user, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
