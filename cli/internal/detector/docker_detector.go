package detector

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"

	"noir-cli/internal/ui"
)

type DetectedContainer struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Service string   `json:"service"`
	Image   string   `json:"image"`
	Status  string   `json:"status"`
	Ports   []string `json:"ports"`
	Source  string   `json:"source"`
	File    string   `json:"file,omitempty"`
}

var (
	nonAlnumRegex    = regexp.MustCompile(`[^a-zA-Z0-9_.-]`)
	leadingEdgeRegex = regexp.MustCompile(`^[^a-z0-9]+|[^a-z0-9]+$`)
	multiHyphenRegex = regexp.MustCompile(`-+`)
)

func SanitizeDockerName(name, fallback string) string {
	if name == "" {
		return fallback
	}
	cleaned := strings.ToLower(strings.TrimSpace(name))
	cleaned = nonAlnumRegex.ReplaceAllString(cleaned, "-")
	cleaned = leadingEdgeRegex.ReplaceAllString(cleaned, "")
	cleaned = multiHyphenRegex.ReplaceAllString(cleaned, "-")
	if cleaned == "" {
		return fallback
	}
	return cleaned
}

func SanitizeDockerImageString(imageStr, fallback string) string {
	if imageStr == "" {
		return fallback
	}
	cleanStr := strings.TrimSpace(imageStr)
	if strings.Contains(cleanStr, ":") {
		parts := strings.SplitN(cleanStr, ":", 2)
		repo, tag := parts[0], parts[1]
		cleanRepo := strings.ToLower(nonAlnumRegex.ReplaceAllString(repo, "-"))
		cleanRepo = strings.Trim(cleanRepo, "-._/")
		cleanTag := SanitizeDockerName(tag, "latest")
		if cleanRepo == "" {
			cleanRepo = "app"
		}
		return fmt.Sprintf("%s:%s", cleanRepo, cleanTag)
	}
	return SanitizeDockerName(cleanStr, "app")
}

func extractPorts(spec interface{}) []string {
	var result []string
	switch v := spec.(type) {
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			} else if num, ok := item.(int); ok {
				result = append(result, fmt.Sprintf("%d", num))
			} else if m, ok := item.(map[string]interface{}); ok {
				pub, _ := m["published"].(string)
				tgt, _ := m["target"].(string)
				if pub != "" && tgt != "" {
					result = append(result, fmt.Sprintf("%s:%s", pub, tgt))
				} else if tgt != "" {
					result = append(result, tgt)
				}
			}
		}
	}
	return result
}

func ParseComposeServices(workspaceDir string) []DetectedContainer {
	candidates := []string{
		filepath.Join(workspaceDir, "docker-compose.yml"),
		filepath.Join(workspaceDir, "docker-compose.yaml"),
		filepath.Join(workspaceDir, "compose.yml"),
		filepath.Join(workspaceDir, "compose.yaml"),
		filepath.Join(workspaceDir, "docker", "docker-compose.yml"),
		filepath.Join(workspaceDir, "docker", "compose.yml"),
	}

	var servicesFound []DetectedContainer
	seen := make(map[string]bool)
	cleanWs := SanitizeDockerName(filepath.Base(workspaceDir), "app")

	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var parsed map[string]interface{}
		if err := yaml.Unmarshal(data, &parsed); err != nil {
			continue
		}

		services, ok := parsed["services"].(map[string]interface{})
		if !ok {
			continue
		}

		for svcName, rawData := range services {
			if seen[svcName] {
				continue
			}
			seen[svcName] = true

			cleanSvc := SanitizeDockerName(svcName, "service")
			svcDict, _ := rawData.(map[string]interface{})
			if svcDict == nil {
				svcDict = make(map[string]interface{})
			}

			containerName := ""
			if cName, ok := svcDict["container_name"].(string); ok && cName != "" {
				containerName = SanitizeDockerName(cName, "")
			}
			if containerName == "" {
				containerName = fmt.Sprintf("%s-%s", cleanWs, cleanSvc)
			}

			image := ""
			if rawImg, ok := svcDict["image"].(string); ok && rawImg != "" {
				image = SanitizeDockerImageString(rawImg, fmt.Sprintf("%s:%s", cleanWs, cleanSvc))
			} else if _, hasBuild := svcDict["build"]; hasBuild {
				image = fmt.Sprintf("%s:local-build", cleanSvc)
			} else {
				image = fmt.Sprintf("%s:%s", cleanWs, cleanSvc)
			}

			ports := extractPorts(svcDict["ports"])

			servicesFound = append(servicesFound, DetectedContainer{
				ID:      "-",
				Name:    containerName,
				Service: cleanSvc,
				Image:   image,
				Status:  "defined",
				Ports:   ports,
				Source:  "compose",
				File:    filepath.Base(path),
			})
		}
	}

	return servicesFound
}

func ParseDockerfiles(workspaceDir string) []DetectedContainer {
	var candidates []string
	candidates = append(candidates,
		filepath.Join(workspaceDir, "Dockerfile"),
		filepath.Join(workspaceDir, "docker", "Dockerfile"),
	)

	entries, _ := os.ReadDir(workspaceDir)
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, "Dockerfile.") || strings.HasPrefix(name, "Dockerfile-") {
			candidates = append(candidates, filepath.Join(workspaceDir, name))
		}
	}

	cleanWs := SanitizeDockerName(filepath.Base(workspaceDir), "app")
	var dockerfiles []DetectedContainer
	seen := make(map[string]bool)

	for _, df := range candidates {
		if !fileExists(df) {
			continue
		}
		name := filepath.Base(df)
		if seen[name] {
			continue
		}
		seen[name] = true

		rawSvc := "app"
		if name != "Dockerfile" {
			rawSvc = strings.TrimPrefix(name, "Dockerfile.")
			rawSvc = strings.TrimPrefix(rawSvc, "Dockerfile-")
		}
		cleanSvc := SanitizeDockerName(rawSvc, "app")

		dockerfiles = append(dockerfiles, DetectedContainer{
			ID:      "-",
			Name:    fmt.Sprintf("%s-%s", cleanWs, cleanSvc),
			Service: cleanSvc,
			Image:   fmt.Sprintf("%s:%s", cleanWs, cleanSvc),
			Status:  "defined",
			Ports:   []string{},
			Source:  "dockerfile",
			File:    name,
		})
	}
	return dockerfiles
}

type dockerContainerJSON struct {
	ID      string `json:"ID"`
	Names   string `json:"Names"`
	Image   string `json:"Image"`
	Status  string `json:"Status"`
	State   string `json:"State"`
	Ports   string `json:"Ports"`
	Labels  string `json:"Labels"`
}

// DiscoverProjectContainers scans project workspace files and queries host Docker daemon
func DiscoverProjectContainers(targetDir, projectCode string) []DetectedContainer {
	absTarget, err := filepath.Abs(targetDir)
	if err != nil {
		absTarget = targetDir
	}
	dirName := strings.ToLower(filepath.Base(absTarget))
	codeLower := strings.ToLower(strings.TrimSpace(projectCode))

	composeServices := ParseComposeServices(absTarget)
	dockerfileServices := ParseDockerfiles(absTarget)

	containersMap := make(map[string]DetectedContainer)
	for _, svc := range composeServices {
		containersMap[strings.ToLower(svc.Service)] = svc
	}
	for _, df := range dockerfileServices {
		key := strings.ToLower(df.Service)
		if _, exists := containersMap[key]; !exists {
			containersMap[key] = df
		}
	}

	// Query host Docker containers via `docker ps -a --format json`
	var hostContainers []DetectedContainer
	out, err := exec.Command("docker", "ps", "-a", "--format", "{{json .}}").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var item dockerContainerJSON
			if err := json.Unmarshal([]byte(line), &item); err != nil {
				continue
			}

			cName := strings.TrimLeft(item.Names, "/")
			shortID := item.ID
			if len(shortID) > 12 {
				shortID = shortID[:12]
			}

			cStatus := strings.ToLower(item.State)
			if cStatus == "" {
				if strings.Contains(strings.ToLower(item.Status), "up") {
					cStatus = "running"
				} else {
					cStatus = "exited"
				}
			}

			var portsList []string
			if item.Ports != "" {
				portsList = strings.Split(item.Ports, ", ")
			}

			matchesProject := false
			cNameLower := strings.ToLower(cName)

			if dirName != "" && strings.Contains(cNameLower, dirName) {
				matchesProject = true
			}
			if codeLower != "" && (strings.Contains(cNameLower, codeLower) || strings.Contains(cNameLower, "noir-run-"+codeLower)) {
				matchesProject = true
			}
			for svcKey := range containersMap {
				if strings.Contains(cNameLower, svcKey) {
					matchesProject = true
					break
				}
			}

			cInfo := DetectedContainer{
				ID:      shortID,
				Name:    cName,
				Service: cName,
				Image:   item.Image,
				Status:  cStatus,
				Ports:   portsList,
				Source:  "docker",
			}

			if matchesProject {
				targetKey := strings.ToLower(cName)
				for svcKey, svcVal := range containersMap {
					if strings.Contains(cNameLower, svcKey) {
						cInfo.Service = svcVal.Service
						targetKey = svcKey
						break
					}
				}
				containersMap[targetKey] = cInfo
			} else {
				hostContainers = append(hostContainers, cInfo)
			}
		}
	}

	var result []DetectedContainer
	for _, v := range containersMap {
		result = append(result, v)
	}

	if len(result) == 0 && len(hostContainers) > 0 {
		var running []DetectedContainer
		for _, c := range hostContainers {
			if c.Status == "running" {
				running = append(running, c)
			}
		}
		if len(running) > 0 {
			if len(running) > 8 {
				result = running[:8]
			} else {
				result = running
			}
		} else {
			if len(hostContainers) > 8 {
				result = hostContainers[:8]
			} else {
				result = hostContainers
			}
		}
	}

	return result
}

// FormatContainersTable formats detected containers using lipgloss
func FormatContainersTable(containers []DetectedContainer) string {
	table := &ui.SimpleTable{
		Title:   "Docker Containers & Microservices",
		Headers: []string{"ID", "Container Name", "Service", "Status", "Image", "Ports / Source"},
	}

	for _, c := range containers {
		styledStatus := c.Status
		switch strings.ToLower(c.Status) {
		case "running":
			styledStatus = ui.StyleGreen.Render("● Running")
		case "exited":
			styledStatus = ui.StyleDanger.Render("■ Exited")
		case "defined":
			styledStatus = ui.StyleYellow.Render("▲ Defined")
		case "paused":
			styledStatus = ui.StyleCyan.Render("⏸ Paused")
		case "restarting":
			styledStatus = ui.StyleYellow.Bold(true).Render("↻ Restarting")
		}

		portsStr := strings.Join(c.Ports, ", ")
		if portsStr == "" {
			portsStr = fmt.Sprintf("[%s]", c.Source)
		}

		table.Rows = append(table.Rows, []string{
			ui.StyleCyan.Render(c.ID),
			ui.StyleWhite.Bold(true).Render(c.Name),
			ui.StyleYellow.Render(c.Service),
			styledStatus,
			ui.StyleMuted.Render(c.Image),
			ui.StyleCyan.Render(portsStr),
		})
	}

	return table.Render()
}
