package detector

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFindTestFiles_GoProject(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_test_detector_go_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	os.WriteFile(filepath.Join(tempDir, "main.go"), []byte("package main\n"), 0644)
	os.WriteFile(filepath.Join(tempDir, "main_test.go"), []byte("package main\nimport \"testing\"\nfunc TestX(t *testing.T) {}\n"), 0644)

	res := FindTestFiles(tempDir)
	if !res.HasTests {
		t.Fatal("expected HasTests to be true for Go project with test file")
	}

	if !strings.Contains(res.HostTestCommand, "go test") {
		t.Errorf("expected go test command, got %s", res.HostTestCommand)
	}
}

func TestFindTestFiles_NodeProject(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_test_detector_node_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	pkgJSON := `{
  "scripts": {
    "test": "jest"
  }
}`
	os.WriteFile(filepath.Join(tempDir, "package.json"), []byte(pkgJSON), 0644)
	os.WriteFile(filepath.Join(tempDir, "app.test.js"), []byte("test('demo', () => {});\n"), 0644)

	res := FindTestFiles(tempDir)
	if !res.HasTests {
		t.Fatal("expected HasTests to be true for Node project with test file")
	}

	if !strings.Contains(res.HostTestCommand, "npm test") {
		t.Errorf("expected npm test command, got %s", res.HostTestCommand)
	}
}

func TestFindTestFiles_CustomConfig(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_test_detector_custom_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	noirDir := filepath.Join(tempDir, ".noir")
	os.MkdirAll(noirDir, 0755)
	cfgJSON := `{"test_command": "echo custom_test_suite"}`
	os.WriteFile(filepath.Join(noirDir, "config.json"), []byte(cfgJSON), 0644)

	res := FindTestFiles(tempDir)
	if !res.HasTests {
		t.Fatal("expected HasTests to be true for custom config")
	}

	if !strings.Contains(res.HostTestCommand, "custom_test_suite") {
		t.Errorf("expected custom_test_suite in command, got %s", res.HostTestCommand)
	}
	if res.TechName != "Custom Configuration" {
		t.Errorf("expected Custom Configuration tech name, got %s", res.TechName)
	}
}

func TestFindTestFiles_EmptyDir(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_test_detector_empty_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	res := FindTestFiles(tempDir)
	if res.HasTests {
		t.Errorf("expected HasTests to be false for empty directory")
	}
}
