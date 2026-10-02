package detector

import (
	"bufio"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var ignoredTestDirs = map[string]bool{
	"venv":          true,
	".venv":         true,
	"env":           true,
	".env":          true,
	"node_modules":  true,
	".git":          true,
	".noir":         true,
	"dist":          true,
	"build":         true,
	"__pycache__":   true,
	".pytest_cache": true,
	".next":         true,
	"vendor":        true,
	"target":        true,
	".gradle":       true,
	"bin":           true,
	"obj":           true,
	".idea":         true,
	".vscode":       true,
}

func isIgnoredPath(path string) bool {
	parts := strings.Split(filepath.ToSlash(path), "/")
	for _, p := range parts {
		if ignoredTestDirs[p] {
			return true
		}
	}
	return false
}

// ResolveTestCommand resolves testCmd to an executable command by checking local virtualenvs
func ResolveTestCommand(testCmd string, root string) string {
	parts := strings.Fields(strings.TrimSpace(testCmd))
	if len(parts) == 0 {
		return testCmd
	}

	binary := parts[0]
	args := parts[1:]
	venvs := []string{"venv", ".venv", "env", ".env"}

	var venvBinary string
	for _, venv := range venvs {
		candidate := filepath.Join(root, venv, "bin", binary)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			venvBinary = candidate
			break
		}
	}

	if venvBinary != "" {
		rest := strings.Join(args, " ")
		return strings.TrimSpace(venvBinary + " " + rest)
	}

	if _, err := exec.LookPath(binary); err == nil {
		return testCmd
	}

	var venvPython string
	for _, venv := range venvs {
		candidate := filepath.Join(root, venv, "bin", "python")
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			venvPython = candidate
			break
		}
	}

	pythonExec := venvPython
	if pythonExec == "" {
		if p, err := exec.LookPath("python3"); err == nil {
			pythonExec = p
		} else if p, err := exec.LookPath("python"); err == nil {
			pythonExec = p
		} else {
			pythonExec = "python"
		}
	}

	if binary == "pytest" {
		if fileExists(filepath.Join(root, "manage.py")) {
			return pythonExec + " manage.py test"
		}
		return pythonExec + " -m unittest discover"
	}

	if binary == "python" || binary == "python3" {
		rest := strings.Join(args, " ")
		return strings.TrimSpace(pythonExec + " " + rest)
	}

	return testCmd
}

type TestDetectionResult struct {
	HasTests            bool
	HostTestCommand     string
	ContainerTestCommand string
	TechName            string
}

// FindTestFiles scans the workspace for test files based on tech stack.
func FindTestFiles(root string) TestDetectionResult {
	// 0. Check custom configuration in .noir/config.yaml or .noir/config.json
	noirDir := filepath.Join(root, ".noir")
	if dirExists(noirDir) {
		cfgYaml := filepath.Join(noirDir, "config.yaml")
		if fileExists(cfgYaml) {
			if f, err := os.Open(cfgYaml); err == nil {
				scanner := bufio.NewScanner(f)
				for scanner.Scan() {
					line := strings.TrimSpace(scanner.Text())
					if strings.HasPrefix(line, "test_command:") || strings.HasPrefix(line, "test_runner:") {
						parts := strings.SplitN(line, ":", 2)
						if len(parts) == 2 {
							cmd := strings.TrimSpace(parts[1])
							if cmd != "" {
								resolved := ResolveTestCommand(cmd, root)
								containerCmd := cmd
								if fileExists(filepath.Join(root, "manage.py")) && cmd == "pytest" {
									containerCmd = "python manage.py test"
								}
								f.Close()
								return TestDetectionResult{
									HasTests:            true,
									HostTestCommand:     resolved,
									ContainerTestCommand: containerCmd,
									TechName:            "Custom Configuration",
								}
							}
						}
					}
				}
				f.Close()
			}
		}

		cfgJSON := filepath.Join(noirDir, "config.json")
		if fileExists(cfgJSON) {
			if data, err := os.ReadFile(cfgJSON); err == nil {
				var parsed map[string]interface{}
				if err := json.Unmarshal(data, &parsed); err == nil {
					cmd := ""
					if c, ok := parsed["test_command"].(string); ok && c != "" {
						cmd = c
					} else if c, ok := parsed["test_runner"].(string); ok && c != "" {
						cmd = c
					}
					if cmd != "" {
						resolved := ResolveTestCommand(cmd, root)
						containerCmd := cmd
						if fileExists(filepath.Join(root, "manage.py")) && cmd == "pytest" {
							containerCmd = "python manage.py test"
						}
						return TestDetectionResult{
							HasTests:            true,
							HostTestCommand:     resolved,
							ContainerTestCommand: containerCmd,
							TechName:            "Custom Configuration",
						}
					}
				}
			}
		}
	}

	var pyTestFiles []string
	var jsTsTestFiles []string
	var goTestFiles []string
	var rustTestFiles []string
	var javaTestFiles []string
	var phpTestFiles []string
	var rubyTestFiles []string

	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		if isIgnoredPath(rel) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if info.IsDir() {
			return nil
		}

		filename := strings.ToLower(info.Name())
		relParts := strings.Split(strings.ToLower(filepath.ToSlash(rel)), "/")
		ext := strings.ToLower(filepath.Ext(filename))

		switch ext {
		case ".py":
			if filename == "tests.py" || strings.HasPrefix(filename, "test_") || strings.HasSuffix(filename, "_test.py") {
				pyTestFiles = append(pyTestFiles, path)
			} else if containsAny(relParts, "tests", "test") {
				pyTestFiles = append(pyTestFiles, path)
			}
		case ".js", ".ts", ".jsx", ".tsx":
			if strings.Contains(filename, ".test.") || strings.Contains(filename, ".spec.") ||
				containsAny(relParts, "__tests__", "tests", "test") {
				jsTsTestFiles = append(jsTsTestFiles, path)
			}
		case ".go":
			if strings.HasSuffix(filename, "_test.go") {
				goTestFiles = append(goTestFiles, path)
			}
		case ".rs":
			if containsAny(relParts, "tests") || strings.HasSuffix(filename, "_test.rs") {
				rustTestFiles = append(rustTestFiles, path)
			} else {
				if content, err := os.ReadFile(path); err == nil && strings.Contains(string(content), "#[test]") {
					rustTestFiles = append(rustTestFiles, path)
				}
			}
		case ".java", ".kt":
			if strings.Contains(strings.ToLower(filepath.ToSlash(path)), "src/test") ||
				strings.HasSuffix(filename, "test.java") || strings.HasSuffix(filename, "test.kt") {
				javaTestFiles = append(javaTestFiles, path)
			}
		case ".php":
			if containsAny(relParts, "tests") || strings.HasSuffix(filename, "test.php") {
				phpTestFiles = append(phpTestFiles, path)
			}
		case ".rb":
			if containsAny(relParts, "spec", "test") || strings.HasSuffix(filename, "_spec.rb") || strings.HasSuffix(filename, "_test.rb") {
				rubyTestFiles = append(rubyTestFiles, path)
			}
		}

		return nil
	})

	// 1. Python Stack
	if len(pyTestFiles) > 0 {
		if fileExists(filepath.Join(root, "manage.py")) {
			hostCmd := ResolveTestCommand("python manage.py test", root)
			return TestDetectionResult{
				HasTests:            true,
				HostTestCommand:     hostCmd,
				ContainerTestCommand: "python manage.py test",
				TechName:            "Python (Django)",
			}
		}
		if fileExists(filepath.Join(root, "pytest.ini")) || fileExists(filepath.Join(root, "pyproject.toml")) {
			hostCmd := ResolveTestCommand("pytest", root)
			return TestDetectionResult{
				HasTests:            true,
				HostTestCommand:     hostCmd,
				ContainerTestCommand: "pytest",
				TechName:            "Python (pytest)",
			}
		}
		hostCmd := ResolveTestCommand("pytest", root)
		return TestDetectionResult{
			HasTests:            true,
			HostTestCommand:     hostCmd,
			ContainerTestCommand: "python -m unittest discover",
			TechName:            "Python",
		}
	}

	// 2. Node.js Stack
	if len(jsTsTestFiles) > 0 {
		hostCmd := ResolveTestCommand("npm test", root)
		return TestDetectionResult{
			HasTests:            true,
			HostTestCommand:     hostCmd,
			ContainerTestCommand: "npm test",
			TechName:            "Node.js / JS / TS",
		}
	}

	pkgJSON := filepath.Join(root, "package.json")
	if fileExists(pkgJSON) {
		if data, err := os.ReadFile(pkgJSON); err == nil {
			var pkg map[string]interface{}
			if err := json.Unmarshal(data, &pkg); err == nil {
				if scripts, ok := pkg["scripts"].(map[string]interface{}); ok {
					if testScript, ok := scripts["test"].(string); ok && testScript != "" && !strings.Contains(strings.ToLower(testScript), "no test specified") {
						hostCmd := ResolveTestCommand("npm test", root)
						return TestDetectionResult{
							HasTests:            true,
							HostTestCommand:     hostCmd,
							ContainerTestCommand: "npm test",
							TechName:            "Node.js (package.json script)",
						}
					}
				}
			}
		}
	}

	// 3. Go Stack
	goMod := filepath.Join(root, "go.mod")
	if len(goTestFiles) > 0 || (fileExists(goMod) && len(goTestFiles) > 0) {
		hostCmd := ResolveTestCommand("go test ./...", root)
		return TestDetectionResult{
			HasTests:            true,
			HostTestCommand:     hostCmd,
			ContainerTestCommand: "go test ./...",
			TechName:            "Go",
		}
	}

	// 4. Rust Stack
	cargoToml := filepath.Join(root, "Cargo.toml")
	if len(rustTestFiles) > 0 || (fileExists(cargoToml) && dirExists(filepath.Join(root, "tests"))) {
		hostCmd := ResolveTestCommand("cargo test", root)
		return TestDetectionResult{
			HasTests:            true,
			HostTestCommand:     hostCmd,
			ContainerTestCommand: "cargo test",
			TechName:            "Rust",
		}
	}

	// 5. Java / Kotlin Stack
	pomXML := filepath.Join(root, "pom.xml")
	buildGradle := filepath.Join(root, "build.gradle")
	buildGradleKts := filepath.Join(root, "build.gradle.kts")
	if len(javaTestFiles) > 0 {
		if fileExists(filepath.Join(root, "mvnw")) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("./mvnw test", root), ContainerTestCommand: "./mvnw test", TechName: "Java (Maven Wrapper)"}
		} else if fileExists(pomXML) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("mvn test", root), ContainerTestCommand: "mvn test", TechName: "Java (Maven)"}
		} else if fileExists(filepath.Join(root, "gradlew")) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("./gradlew test", root), ContainerTestCommand: "./gradlew test", TechName: "Java/Kotlin (Gradle Wrapper)"}
		} else if fileExists(buildGradle) || fileExists(buildGradleKts) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("gradle test", root), ContainerTestCommand: "gradle test", TechName: "Java/Kotlin (Gradle)"}
		}
		return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("mvn test", root), ContainerTestCommand: "mvn test", TechName: "Java"}
	}

	// 6. PHP / Laravel Stack
	phpunitXML := filepath.Join(root, "phpunit.xml")
	artisan := filepath.Join(root, "artisan")
	if len(phpTestFiles) > 0 || fileExists(phpunitXML) {
		if fileExists(artisan) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("php artisan test", root), ContainerTestCommand: "php artisan test", TechName: "PHP (Laravel)"}
		}
		return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("vendor/bin/phpunit", root), ContainerTestCommand: "vendor/bin/phpunit", TechName: "PHP (PHPUnit)"}
	}

	// 7. Ruby / Rails Stack
	if len(rubyTestFiles) > 0 {
		if dirExists(filepath.Join(root, "spec")) {
			return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("bundle exec rspec", root), ContainerTestCommand: "bundle exec rspec", TechName: "Ruby (RSpec)"}
		}
		return TestDetectionResult{HasTests: true, HostTestCommand: ResolveTestCommand("rake test", root), ContainerTestCommand: "rake test", TechName: "Ruby"}
	}

	// 8. Standalone pytest.ini
	if fileExists(filepath.Join(root, "pytest.ini")) {
		return TestDetectionResult{
			HasTests:            true,
			HostTestCommand:     ResolveTestCommand("pytest", root),
			ContainerTestCommand: "pytest",
			TechName:            "Python (pytest.ini)",
		}
	}

	return TestDetectionResult{HasTests: false}
}

func containsAny(slice []string, items ...string) bool {
	for _, s := range slice {
		for _, item := range items {
			if s == item {
				return true
			}
		}
	}
	return false
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func dirExists(p string) bool {
	info, err := os.Stat(p)
	if err != nil {
		return false
	}
	return info.IsDir()
}
