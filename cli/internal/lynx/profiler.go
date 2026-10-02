package lynx

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type ProjectProfile struct {
	FrameworkName   string            `json:"framework_name"`
	Language        string            `json:"language"`
	RuntimeVersion  string            `json:"runtime_version"`
	PackageManager  string            `json:"package_manager"`
	OperatingSystem string            `json:"operating_system"`
	RawResults      *IdentifiedResult `json:"raw_results"`
}

func getRuntimeVersion(language string) string {
	langLower := strings.ToLower(language)
	if strings.Contains(langLower, "go") {
		out, err := exec.Command("go", "version").Output()
		if err == nil {
			parts := strings.Fields(string(out))
			if len(parts) >= 3 {
				return parts[2]
			}
		}
		return "go1.22.0"
	} else if strings.Contains(langLower, "python") {
		for _, py := range []string{"python3", "python"} {
			out, err := exec.Command(py, "--version").Output()
			if err == nil {
				parts := strings.Fields(string(out))
				if len(parts) >= 2 {
					return parts[1]
				}
			}
		}
		return "3.11.0"
	} else if strings.Contains(langLower, "javascript") || strings.Contains(langLower, "typescript") || strings.Contains(langLower, "node") {
		out, err := exec.Command("node", "-v").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
		return "v20.10.0"
	} else if strings.Contains(langLower, "rust") {
		out, err := exec.Command("rustc", "--version").Output()
		if err == nil {
			parts := strings.Fields(string(out))
			if len(parts) >= 2 {
				return parts[1]
			}
		}
		return "1.76.0"
	}
	return runtime.Version()
}

func ProfileProject(targetDir string) (*ProjectProfile, error) {
	absTarget, err := filepath.Abs(targetDir)
	if err != nil {
		absTarget = targetDir
	}

	evidence := ScanDir(absTarget, absTarget)
	score := ScoringEngine(evidence)
	engine := NewIdentificationEngine(score)
	result := engine.Identify()

	// Framework
	frameworkName := "Generic"
	if len(result.Frameworks) > 0 {
		topFw := ""
		topCount := -1
		for fw, count := range result.Frameworks {
			if count > topCount {
				topCount = count
				topFw = fw
			}
		}
		if dn, ok := FrameworkDisplayNames[strings.ToLower(topFw)]; ok {
			frameworkName = dn
		} else if topFw != "" {
			frameworkName = strings.ToUpper(topFw[:1]) + topFw[1:]
		}
	}

	// Language
	rawLang := "python"
	if len(result.Language.Primary) > 0 {
		rawLang = result.Language.Primary[0]
	} else if len(result.Language.Secondary) > 0 {
		rawLang = result.Language.Secondary[0]
	} else if len(result.Language.Supporting) > 0 {
		rawLang = result.Language.Supporting[0]
	}

	language := rawLang
	if dn, ok := LanguageDisplayNames[strings.ToLower(rawLang)]; ok {
		language = dn
	} else if rawLang != "" {
		language = strings.ToUpper(rawLang[:1]) + rawLang[1:]
	}

	// Package Manager
	pkgManager := ""
	if len(result.PackageManagers) > 0 {
		topCount := -1
		for pm, count := range result.PackageManagers {
			if count > topCount {
				topCount = count
				pkgManager = pm
			}
		}
	} else {
		if fileExists(filepath.Join(absTarget, "uv.lock")) {
			pkgManager = "uv"
		} else if fileExists(filepath.Join(absTarget, "package-lock.json")) {
			pkgManager = "npm"
		} else if fileExists(filepath.Join(absTarget, "yarn.lock")) {
			pkgManager = "yarn"
		} else if fileExists(filepath.Join(absTarget, "pnpm-lock.yaml")) {
			pkgManager = "pnpm"
		} else if fileExists(filepath.Join(absTarget, "poetry.lock")) {
			pkgManager = "poetry"
		} else if fileExists(filepath.Join(absTarget, "Pipfile.lock")) || fileExists(filepath.Join(absTarget, "requirements.txt")) {
			pkgManager = "pip"
		} else if fileExists(filepath.Join(absTarget, "go.mod")) {
			pkgManager = "go"
		} else if fileExists(filepath.Join(absTarget, "Cargo.lock")) {
			pkgManager = "cargo"
		} else {
			if language == "JavaScript" || language == "TypeScript" {
				pkgManager = "npm"
			} else if language == "Go" {
				pkgManager = "go"
			} else {
				pkgManager = "pip"
			}
		}
	}

	// OS info
	osName := fmt.Sprintf("%s (%s)", runtime.GOOS, runtime.GOARCH)

	runtimeVer := getRuntimeVersion(language)

	return &ProjectProfile{
		FrameworkName:   frameworkName,
		Language:        language,
		RuntimeVersion:  runtimeVer,
		PackageManager:  pkgManager,
		OperatingSystem: osName,
		RawResults:      result,
	}, nil
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	if err != nil {
		return false
	}
	return !info.IsDir()
}
