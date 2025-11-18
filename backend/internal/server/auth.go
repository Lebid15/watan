package server

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type tokenClaims struct {
	Subject  string
	TenantID string
	UserID   string
	Role     string
	Expires  time.Time
}

func issueToken(secret string, claims tokenClaims) (string, error) {
	jwtClaims := jwt.MapClaims{
		"sub":       claims.Subject,
		"tenant_id": claims.TenantID,
		"user_id":   claims.UserID,
		"role":      claims.Role,
		"exp":       claims.Expires.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims)
	return token.SignedString([]byte(secret))
}

func parseToken(tokenString, secret string) (tokenClaims, error) {
	parsed, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return tokenClaims{}, err
	}

	mapClaims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok || !parsed.Valid {
		return tokenClaims{}, fmt.Errorf("invalid token claims")
	}

	sub, _ := mapClaims["sub"].(string)
	tenantID, _ := mapClaims["tenant_id"].(string)
	userID, _ := mapClaims["user_id"].(string)
	role, _ := mapClaims["role"].(string)
	expUnix, _ := mapClaims["exp"].(float64)

	return tokenClaims{
		Subject:  sub,
		TenantID: tenantID,
		UserID:   userID,
		Role:     role,
		Expires:  time.Unix(int64(expUnix), 0),
	}, nil
}
