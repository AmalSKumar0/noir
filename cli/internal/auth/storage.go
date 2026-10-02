package auth

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/zalando/go-keyring"
)

const (
	Service      = "noir"
	UserRefresh  = "refresh"
	UserAccess   = "access"
	UserMetadata = "user_meta"
)

type TokenData struct {
	Access  string                 `json:"access"`
	Refresh string                 `json:"refresh"`
	User    map[string]interface{} `json:"user,omitempty"`
}

// getFallbackFilePath returns path to ~/.noir/credentials.json
func getFallbackFilePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".noir")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return filepath.Join(dir, "credentials.json"), nil
}

func readFallbackTokens() (*TokenData, error) {
	path, err := getFallbackFilePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var td TokenData
	if err := json.Unmarshal(data, &td); err != nil {
		return nil, err
	}
	return &td, nil
}

func writeFallbackTokens(td *TokenData) error {
	path, err := getFallbackFilePath()
	if err != nil {
		return err
	}
	bytes, err := json.MarshalIndent(td, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, bytes, 0600)
}

func deleteFallbackTokens() {
	path, err := getFallbackFilePath()
	if err == nil {
		_ = os.Remove(path)
	}
}

// SaveToken stores access and refresh tokens into keyring and fallback file.
func SaveToken(tokens map[string]interface{}) error {
	access, _ := tokens["access"].(string)
	refresh, _ := tokens["refresh"].(string)

	td := &TokenData{
		Access:  access,
		Refresh: refresh,
	}
	if user, ok := tokens["user"].(map[string]interface{}); ok {
		td.User = user
	}

	// Always write fallback to ensure persistence in environments without DBus
	_ = writeFallbackTokens(td)

	// Try keyring as well
	if access != "" {
		_ = keyring.Set(Service, UserAccess, access)
	}
	if refresh != "" {
		_ = keyring.Set(Service, UserRefresh, refresh)
	}

	return nil
}

// GetAccessToken retrieves access token from keyring or fallback file.
func GetAccessToken() string {
	val, err := keyring.Get(Service, UserAccess)
	if err == nil && val != "" {
		return val
	}
	if td, err := readFallbackTokens(); err == nil && td != nil {
		return td.Access
	}
	return ""
}

// GetRefreshToken retrieves refresh token from keyring or fallback file.
func GetRefreshToken() string {
	val, err := keyring.Get(Service, UserRefresh)
	if err == nil && val != "" {
		return val
	}
	if td, err := readFallbackTokens(); err == nil && td != nil {
		return td.Refresh
	}
	return ""
}

// DeleteToken removes tokens from both keyring and fallback storage.
func DeleteToken() {
	_ = keyring.Delete(Service, UserAccess)
	_ = keyring.Delete(Service, UserRefresh)
	deleteFallbackTokens()
}

// HasTokens checks if both access and refresh tokens are present.
func HasTokens() bool {
	access := GetAccessToken()
	refresh := GetRefreshToken()
	return access != "" && refresh != ""
}
