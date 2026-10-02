package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	NoirDirName     = ".noir"
	ConfigFile      = "config.json"
	ConfigYaml      = "config.yaml"
	ProjectFile     = "project.json"
	CacheDirName    = "cache"
	ReportsDirName  = "reports"
	LogsDirName     = "logs"
	TempDirName     = "temp"
	DefaultBackend  = "http://127.0.0.1:8000"
)

// WorkspaceConfig represents .noir/config.json
type WorkspaceConfig struct {
	Backend   string `json:"backend"`
	ProjectID string `json:"project_id"`
	Version   int    `json:"version"`
}

func GetNoirDir() string {
	return NoirDirName
}

func IsConnected() bool {
	info, err := os.Stat(NoirDirName)
	if err != nil || !info.IsDir() {
		return false
	}
	cfgPath := filepath.Join(NoirDirName, ConfigFile)
	_, err = os.Stat(cfgPath)
	return err == nil
}

func ReadConfig() (map[string]interface{}, error) {
	cfgPath := filepath.Join(NoirDirName, ConfigFile)
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return nil, err
	}
	var res map[string]interface{}
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return res, nil
}

func WriteConfig(data map[string]interface{}) error {
	if err := os.MkdirAll(NoirDirName, 0755); err != nil {
		return err
	}
	cfgPath := filepath.Join(NoirDirName, ConfigFile)
	bytes, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return err
	}
	return os.WriteFile(cfgPath, bytes, 0644)
}

func ReadProjectJSON() (map[string]interface{}, error) {
	p := filepath.Join(NoirDirName, ProjectFile)
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var res map[string]interface{}
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return res, nil
}

func WriteProjectJSON(data map[string]interface{}) error {
	if err := os.MkdirAll(NoirDirName, 0755); err != nil {
		return err
	}
	p := filepath.Join(NoirDirName, ProjectFile)
	bytes, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, bytes, 0644)
}

func GetProjectID() string {
	cfg, err := ReadConfig()
	if err != nil {
		return ""
	}
	if id, ok := cfg["project_id"].(string); ok {
		return id
	}
	return ""
}

func GetBackendURL() string {
	if envURL := os.Getenv("NOIR_API_URL"); envURL != "" {
		return envURL
	}
	if envKey := os.Getenv("API_KEY"); envKey != "" && (len(envKey) > 7 && (envKey[:7] == "http://" || envKey[:8] == "https://")) {
		return envKey
	}
	cfg, err := ReadConfig()
	if err == nil {
		if u, ok := cfg["backend"].(string); ok && u != "" {
			return u
		}
	}
	return DefaultBackend
}

// InitWorkspace creates local .noir directory and default files.
func InitWorkspace(projectCode, backendURL string, projectData map[string]interface{}, containers interface{}) error {
	if err := os.MkdirAll(NoirDirName, 0755); err != nil {
		return err
	}

	dirs := []string{CacheDirName, ReportsDirName, LogsDirName, TempDirName}
	for _, d := range dirs {
		if err := os.MkdirAll(filepath.Join(NoirDirName, d), 0755); err != nil {
			return err
		}
	}

	// config.json
	cfgData := map[string]interface{}{
		"backend":    backendURL,
		"project_id": projectCode,
		"version":    1,
	}
	if err := WriteConfig(cfgData); err != nil {
		return err
	}

	// config.yaml
	yamlContent := fmt.Sprintf("project_name: %s\nbackend_url: %s\ntest_runner: pytest\n", projectCode, backendURL)
	_ = os.WriteFile(filepath.Join(NoirDirName, ConfigYaml), []byte(yamlContent), 0644)

	// project.json
	if projectData != nil {
		_ = WriteProjectJSON(projectData)
	}

	// cache files
	cacheDir := filepath.Join(NoirDirName, CacheDirName)
	_ = os.WriteFile(filepath.Join(cacheDir, "analysis.json"), []byte("{}"), 0644)
	_ = os.WriteFile(filepath.Join(cacheDir, "repository.json"), []byte("{}"), 0644)

	if containers != nil {
		cBytes, _ := json.MarshalIndent(containers, "", "    ")
		_ = os.WriteFile(filepath.Join(cacheDir, "containers.json"), cBytes, 0644)
	}

	// log file
	_ = os.WriteFile(filepath.Join(NoirDirName, LogsDirName, "noir.log"), []byte(""), 0644)

	return nil
}

// RemoveWorkspace deletes the local .noir directory.
func RemoveWorkspace() error {
	return os.RemoveAll(NoirDirName)
}
