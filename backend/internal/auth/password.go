package auth

import "golang.org/x/crypto/bcrypt"

const passwordCost = bcrypt.DefaultCost

// HashPassword produces a bcrypt hash for the provided plaintext password.
func HashPassword(plaintext string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), passwordCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword checks that the supplied plaintext matches the stored hash.
func VerifyPassword(hash, plaintext string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext))
}
