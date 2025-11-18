package auth

import "testing"

func TestHashAndVerifyPassword(t *testing.T) {
	password := "Sup3rSecret!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("hash password failed: %v", err)
	}
	if hash == password {
		t.Fatalf("hash should not match plaintext")
	}
	if err := VerifyPassword(hash, password); err != nil {
		t.Fatalf("expected password to match: %v", err)
	}
	if err := VerifyPassword(hash, "wrong"); err == nil {
		t.Fatalf("expected mismatch error")
	}
}
