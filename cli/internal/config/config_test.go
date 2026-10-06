package config

import (
	"os"
	"testing"
)

func TestWorkspaceConfig(t *testing.T) {
	// Create temporary directory and change to it
	origWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}
	tempDir, err := os.MkdirTemp("", "noir_config_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer func() {
		_ = os.Chdir(origWd)
		_ = os.RemoveAll(tempDir)
	}()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("failed to chdir to temp dir: %v", err)
	}

	// Initially not connected
	if IsConnected() {
		t.Fatal("expected IsConnected to be false initially")
	}

	// Initialize workspace
	err = InitWorkspace("test-project-123", "https://api.amalskumar.dev", map[string]interface{}{"name": "Test Project"}, nil)
	if err != nil {
		t.Fatalf("InitWorkspace failed: %v", err)
	}

	if !IsConnected() {
		t.Fatal("expected IsConnected to be true after InitWorkspace")
	}

	// Test GetProjectID
	projID := GetProjectID()
	if projID != "test-project-123" {
		t.Errorf("expected project ID 'test-project-123', got '%s'", projID)
	}

	// Test GetBackendURL
	backend := GetBackendURL()
	if backend != "https://api.amalskumar.dev" {
		t.Errorf("expected backend 'https://api.amalskumar.dev', got '%s'", backend)
	}

	// Test ReadProjectJSON
	pData, err := ReadProjectJSON()
	if err != nil {
		t.Fatalf("ReadProjectJSON failed: %v", err)
	}
	if pData["name"] != "Test Project" {
		t.Errorf("expected project name 'Test Project', got %v", pData["name"])
	}

	// Remove workspace
	err = RemoveWorkspace()
	if err != nil {
		t.Fatalf("RemoveWorkspace failed: %v", err)
	}

	if IsConnected() {
		t.Fatal("expected IsConnected to be false after RemoveWorkspace")
	}
}
