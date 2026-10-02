package lynx

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLynxProfiler_PythonDjango(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_lynx_test_py_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create mock Django project structure
	os.WriteFile(filepath.Join(tempDir, "manage.py"), []byte("import django\nfrom django.core.management import execute_from_command_line\n"), 0644)
	os.WriteFile(filepath.Join(tempDir, "settings.py"), []byte("INSTALLED_APPS = ['rest_framework']\n"), 0644)
	os.WriteFile(filepath.Join(tempDir, "requirements.txt"), []byte("django>=4.2\ndjangorestframework\npsycopg2-binary\n"), 0644)

	profile, err := ProfileProject(tempDir)
	if err != nil {
		t.Fatalf("ProfileProject failed: %v", err)
	}

	if profile == nil {
		t.Fatal("expected non-nil profile")
	}

	if profile.Language != "Python" {
		t.Errorf("expected Language Python, got %s", profile.Language)
	}

	if profile.FrameworkName != "Django" {
		t.Errorf("expected Framework Django, got %s", profile.FrameworkName)
	}

	if profile.PackageManager != "pip" {
		t.Errorf("expected PackageManager pip, got %s", profile.PackageManager)
	}
}

func TestLynxProfiler_NodeReact(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "noir_lynx_test_node_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create mock React/Node project
	packageJSON := `{
  "name": "frontend",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}`
	os.WriteFile(filepath.Join(tempDir, "package.json"), []byte(packageJSON), 0644)
	os.WriteFile(filepath.Join(tempDir, "package-lock.json"), []byte("{}"), 0644)
	os.WriteFile(filepath.Join(tempDir, "App.tsx"), []byte("import React from 'react';\nexport default function App() { return <div>Noir</div>; }\n"), 0644)

	profile, err := ProfileProject(tempDir)
	if err != nil {
		t.Fatalf("ProfileProject failed: %v", err)
	}

	if profile.PackageManager != "npm" {
		t.Errorf("expected PackageManager npm, got %s", profile.PackageManager)
	}

	if profile.FrameworkName != "React" {
		t.Errorf("expected Framework React, got %s", profile.FrameworkName)
	}
}

func TestScoringEngine(t *testing.T) {
	evidence := NewEvidence()
	evidence.FileExtension[".py"] = 15
	evidence.FileExtension[".html"] = 2
	evidence.Files["manage.py"] = 1
	evidence.Files["requirements.txt"] = 1
	evidence.Dependencies["django"] = 8

	score := ScoringEngine(evidence)
	if len(score.Language.Primary) == 0 && len(score.Language.Secondary) == 0 {
		t.Errorf("expected language detected in score, got %+v", score.Language)
	}

	engine := NewIdentificationEngine(score)
	res := engine.Identify()

	if len(res.Language.Primary) == 0 || res.Language.Primary[0] != "python" {
		t.Errorf("expected primary language python, got %v", res.Language.Primary)
	}

	if res.Frameworks["django"] <= 0 {
		t.Errorf("expected positive score for django framework, got %v", res.Frameworks["django"])
	}
}
