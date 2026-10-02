package auth

import (
	"os"
	"testing"
)

func TestAuthStorage(t *testing.T) {
	// Temporarily override HOME to isolate the test from user's real ~/.noir
	origHome := os.Getenv("HOME")
	tempHome, err := os.MkdirTemp("", "noir_auth_test_*")
	if err != nil {
		t.Fatalf("failed to create temp home: %v", err)
	}
	defer func() {
		_ = os.Setenv("HOME", origHome)
		_ = os.RemoveAll(tempHome)
	}()
	_ = os.Setenv("HOME", tempHome)

	// Clean initially
	DeleteToken()

	if HasTokens() {
		t.Error("expected HasTokens to be false initially")
	}

	// Save token
	testTokens := map[string]interface{}{
		"access":  "test-access-token-123",
		"refresh": "test-refresh-token-456",
		"user": map[string]interface{}{
			"id":       "user-1",
			"username": "noir-tester",
		},
	}
	err = SaveToken(testTokens)
	if err != nil {
		t.Fatalf("SaveToken failed: %v", err)
	}

	if !HasTokens() {
		t.Error("expected HasTokens to be true after SaveToken")
	}

	acc := GetAccessToken()
	if acc != "test-access-token-123" {
		t.Errorf("expected access token 'test-access-token-123', got '%s'", acc)
	}

	ref := GetRefreshToken()
	if ref != "test-refresh-token-456" {
		t.Errorf("expected refresh token 'test-refresh-token-456', got '%s'", ref)
	}

	// Delete tokens
	DeleteToken()

	if HasTokens() {
		t.Error("expected HasTokens to be false after DeleteToken")
	}
	if GetAccessToken() != "" {
		t.Error("expected empty access token after DeleteToken")
	}
}
