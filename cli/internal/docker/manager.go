package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var interfaceRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-]+$`)

type ContainerMeta struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Service string            `json:"service"`
	Status  string            `json:"status"`
	Image   string            `json:"image"`
	Ports   []string          `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

type ContainerInfo struct {
	Exists       bool   `json:"exists"`
	ID           string `json:"id"`
	Name         string `json:"name"`
	Service      string `json:"service"`
	Status       string `json:"status"`
	Running      bool   `json:"running"`
	StartedAt    string `json:"started_at"`
	FinishedAt   string `json:"finished_at"`
	ExitCode     int    `json:"exit_code"`
	RestartCount int    `json:"restart_count"`
}

type Manager struct {
	connectionError string
}

func NewManager() *Manager {
	m := &Manager{}
	m.checkConnection()
	return m
}

func (m *Manager) checkConnection() {
	cmd := exec.Command("docker", "info")
	if err := cmd.Run(); err != nil {
		m.connectionError = fmt.Sprintf("Cannot connect to Docker daemon: %v", err)
	} else {
		m.connectionError = ""
	}
}

func (m *Manager) IsAvailable() bool {
	m.checkConnection()
	return m.connectionError == ""
}

func (m *Manager) GetConnectionError() string {
	return m.connectionError
}

type dockerInspectState struct {
	Status     string `json:"Status"`
	Running    bool   `json:"Running"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
	ExitCode   int    `json:"ExitCode"`
}

type dockerInspectItem struct {
	ID           string                 `json:"Id"`
	Name         string                 `json:"Name"`
	RestartCount int                    `json:"RestartCount"`
	State        dockerInspectState     `json:"State"`
	Config       map[string]interface{} `json:"Config"`
	NetworkSettings struct {
		Ports map[string][]struct {
			HostPort string `json:"HostPort"`
		} `json:"Ports"`
	} `json:"NetworkSettings"`
}

func (m *Manager) FindContainer(target string) (*ContainerMeta, error) {
	cleanTarget := strings.TrimLeft(strings.TrimSpace(target), "/")
	if cleanTarget == "" {
		return nil, fmt.Errorf("empty container name specified")
	}

	// 1. Direct inspect
	inspectOut, err := exec.Command("docker", "inspect", cleanTarget).Output()
	if err == nil {
		var items []dockerInspectItem
		if err := json.Unmarshal(inspectOut, &items); err == nil && len(items) > 0 {
			item := items[0]
			cName := strings.TrimLeft(item.Name, "/")
			shortID := item.ID
			if len(shortID) > 12 {
				shortID = shortID[:12]
			}
			return &ContainerMeta{
				ID:     shortID,
				Name:   cName,
				Status: item.State.Status,
			}, nil
		}
	}

	// 2. Search through all containers
	out, err := exec.Command("docker", "ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Labels}}").Output()
	if err != nil {
		return nil, fmt.Errorf("target container '%s' not found on Docker daemon", target)
	}

	normTarget := strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(cleanTarget), "-", ""), "_", "")
	lines := strings.Split(string(out), "\n")
	var candidates []*ContainerMeta

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 4 {
			continue
		}
		id := parts[0]
		name := strings.TrimLeft(parts[1], "/")
		status := parts[2]
		image := parts[3]
		labelsStr := ""
		if len(parts) >= 5 {
			labelsStr = parts[4]
		}

		c := &ContainerMeta{
			ID:     id,
			Name:   name,
			Status: status,
			Image:  image,
		}

		// Exact match
		if strings.EqualFold(name, cleanTarget) || strings.EqualFold(id, cleanTarget) {
			return c, nil
		}

		// Normalized match
		normName := strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(name), "-", ""), "_", "")
		if normName == normTarget {
			return c, nil
		}

		// Service match in labels
		if strings.Contains(strings.ToLower(labelsStr), "com.docker.compose.service="+strings.ToLower(cleanTarget)) {
			return c, nil
		}

		// Prefix / suffix / substring match
		cNameLower := strings.ToLower(name)
		targetLower := strings.ToLower(cleanTarget)
		if strings.HasPrefix(cNameLower, targetLower+"-") ||
			strings.HasPrefix(cNameLower, targetLower+"_") ||
			strings.HasSuffix(cNameLower, "-"+targetLower) ||
			strings.HasSuffix(cNameLower, "_"+targetLower) ||
			strings.Contains(cNameLower, targetLower) {
			candidates = append(candidates, c)
		}
	}

	if len(candidates) > 0 {
		return candidates[0], nil
	}

	// 3. Attempt docker compose up -d <target> if defined in compose
	_ = exec.Command("docker", "compose", "up", "-d", cleanTarget).Run()
	inspectOut, err = exec.Command("docker", "inspect", cleanTarget).Output()
	if err == nil {
		var items []dockerInspectItem
		if err := json.Unmarshal(inspectOut, &items); err == nil && len(items) > 0 {
			item := items[0]
			return &ContainerMeta{
				ID:     item.ID[:12],
				Name:   strings.TrimLeft(item.Name, "/"),
				Status: item.State.Status,
			}, nil
		}
	}

	return nil, fmt.Errorf("target container '%s' not found on Docker daemon", target)
}

func (m *Manager) GetContainerInfo(target string) (*ContainerInfo, error) {
	out, err := exec.Command("docker", "inspect", target).Output()
	if err != nil {
		return &ContainerInfo{Exists: false, Status: "not_found"}, nil
	}

	var items []dockerInspectItem
	if err := json.Unmarshal(out, &items); err != nil || len(items) == 0 {
		return &ContainerInfo{Exists: false, Status: "not_found"}, nil
	}

	item := items[0]
	shortID := item.ID
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}

	return &ContainerInfo{
		Exists:       true,
		ID:           shortID,
		Name:         strings.TrimLeft(item.Name, "/"),
		Status:       item.State.Status,
		Running:      item.State.Running,
		StartedAt:    item.State.StartedAt,
		FinishedAt:   item.State.FinishedAt,
		ExitCode:     item.State.ExitCode,
		RestartCount: item.RestartCount,
	}, nil
}

func (m *Manager) RestartContainer(target string, timeout int) (map[string]interface{}, error) {
	c, err := m.FindContainer(target)
	if err != nil {
		return nil, err
	}

	stopReq := float64(time.Now().UnixNano()) / 1e9
	stopCmd := exec.Command("docker", "stop", "-t", fmt.Sprintf("%d", timeout), c.Name)
	_ = stopCmd.Run()
	stoppedAt := float64(time.Now().UnixNano()) / 1e9

	startReq := float64(time.Now().UnixNano()) / 1e9
	startCmd := exec.Command("docker", "start", c.Name)
	if err := startCmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to start container '%s': %w", c.Name, err)
	}
	startedAt := float64(time.Now().UnixNano()) / 1e9

	info, _ := m.GetContainerInfo(c.Name)
	var healthyAt *float64
	if info != nil && info.Running {
		now := float64(time.Now().UnixNano()) / 1e9
		healthyAt = &now
	}

	dur := float64(int((startedAt-stopReq)*1000)) / 1000.0

	res := map[string]interface{}{
		"container_name":              c.Name,
		"status":                      info.Status,
		"running":                     info.Running,
		"restart_duration_seconds":    dur,
		"container_stop_requested_at": stopReq,
		"container_stopped_at":        stoppedAt,
		"container_start_requested_at": startReq,
		"container_started_at":        startedAt,
	}
	if healthyAt != nil {
		res["container_healthy_at"] = *healthyAt
	}

	return res, nil
}

func (m *Manager) StopContainer(target string, timeout int) error {
	c, err := m.FindContainer(target)
	if err != nil {
		return err
	}
	return exec.Command("docker", "stop", "-t", fmt.Sprintf("%d", timeout), c.Name).Run()
}

func (m *Manager) StartContainer(target string) error {
	c, err := m.FindContainer(target)
	if err != nil {
		return err
	}
	return exec.Command("docker", "start", c.Name).Run()
}

func (m *Manager) KillFaultProcesses(target string) {
	c, err := m.FindContainer(target)
	if err != nil {
		return
	}
	cmds := []string{
		"pkill -9 -f stress-ng",
		"pkill -9 -f stress",
		"pkill -9 -f noir_cpu_burn",
		"pkill -9 -f noir_mem",
		"pkill -9 -f multiprocessing",
		"rm -f /dev/shm/noir_mem.tmp /tmp/noir_mem.tmp",
	}
	for _, cmd := range cmds {
		_ = exec.Command("docker", "exec", c.Name, "sh", "-c", cmd).Run()
	}
}

func (m *Manager) ExecRun(target string, cmdArgs []string, privileged bool) (int, string, error) {
	c, err := m.FindContainer(target)
	if err != nil {
		return -1, "", err
	}

	info, _ := m.GetContainerInfo(c.Name)
	if info != nil && !info.Running {
		_ = exec.Command("docker", "start", c.Name).Run()
		time.Sleep(1 * time.Second)
	}

	args := []string{"exec"}
	if privileged {
		args = append(args, "--privileged")
	}
	args = append(args, c.Name)
	args = append(args, cmdArgs...)

	cmd := exec.Command("docker", args...)
	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &outBuf

	err = cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return exitCode, outBuf.String(), nil
}

func (m *Manager) ApplyNetworkDelay(target string, latencyMs, jitterMs int, iface string) error {
	if iface == "" {
		iface = "eth0"
	}
	if !interfaceRegex.MatchString(iface) {
		return fmt.Errorf("invalid network interface format: %s", iface)
	}

	// Remove existing rules first
	_ = m.RemoveNetworkDelay(target, iface)

	tcArgs := []string{"sh", "-c", fmt.Sprintf("tc qdisc add dev %s root netem delay %dms %dms", iface, latencyMs, jitterMs)}
	code, out, err := m.ExecRun(target, tcArgs, true)
	if err != nil || code != 0 {
		// Try sidecar container with NET_ADMIN
		c, cErr := m.FindContainer(target)
		if cErr != nil {
			return fmt.Errorf("failed to apply network delay: %s", out)
		}
		sidecarCmd := exec.Command("docker", "run", "--rm", "--net=container:"+c.Name, "--cap-add=NET_ADMIN", "gaiadocker/iproute2",
			"tc", "qdisc", "add", "dev", iface, "root", "netem", "delay", fmt.Sprintf("%dms", latencyMs), fmt.Sprintf("%dms", jitterMs))
		if sideErr := sidecarCmd.Run(); sideErr != nil {
			return fmt.Errorf("failed to apply network delay on %s (tc failed: %s)", c.Name, out)
		}
	}
	return nil
}

func (m *Manager) RemoveNetworkDelay(target string, iface string) error {
	if iface == "" {
		iface = "eth0"
	}
	tcArgs := []string{"sh", "-c", fmt.Sprintf("tc qdisc del dev %s root", iface)}
	_, _, _ = m.ExecRun(target, tcArgs, true)
	return nil
}

func (m *Manager) ApplyNetworkLoss(target string, lossPercent float64, iface string) error {
	if iface == "" {
		iface = "eth0"
	}
	_ = m.RemoveNetworkDelay(target, iface)

	tcArgs := []string{"sh", "-c", fmt.Sprintf("tc qdisc add dev %s root netem loss %.1f%%", iface, lossPercent)}
	code, out, err := m.ExecRun(target, tcArgs, true)
	if err != nil || code != 0 {
		c, cErr := m.FindContainer(target)
		if cErr != nil {
			return fmt.Errorf("failed to apply network loss: %s", out)
		}
		sidecarCmd := exec.Command("docker", "run", "--rm", "--net=container:"+c.Name, "--cap-add=NET_ADMIN", "gaiadocker/iproute2",
			"tc", "qdisc", "add", "dev", iface, "root", "netem", "loss", fmt.Sprintf("%.1f%%", lossPercent))
		if sideErr := sidecarCmd.Run(); sideErr != nil {
			return fmt.Errorf("failed to apply network loss on %s: %s", c.Name, out)
		}
	}
	return nil
}

func (m *Manager) ApplyCpuStress(ctx context.Context, target string, workers, durationSec int) (int, string, error) {
	c, err := m.FindContainer(target)
	if err != nil {
		return -1, "", err
	}

	// Try stress-ng, stress, or shell burn loop
	checkCmd := []string{"sh", "-c", "which stress-ng || which stress || which python3 || which python || echo sh"}
	_, out, _ := m.ExecRun(c.Name, checkCmd, false)
	tool := strings.TrimSpace(out)

	var runCmd []string
	if strings.Contains(tool, "stress-ng") {
		runCmd = []string{"stress-ng", "--cpu", strconv.Itoa(workers), "--timeout", fmt.Sprintf("%ds", durationSec), "--temp-path", "/tmp"}
	} else if strings.Contains(tool, "stress") {
		runCmd = []string{"stress", "--cpu", strconv.Itoa(workers), "--timeout", fmt.Sprintf("%ds", durationSec)}
	} else if strings.Contains(tool, "python") {
		pyBin := "python3"
		if strings.Contains(tool, "python3") {
			pyBin = "python3"
		} else {
			pyBin = "python"
		}
		pyScript := fmt.Sprintf(`import time, multiprocessing as mp
def noir_cpu_burn():
    end = time.time() + %d
    while time.time() < end:
        _ = 99999 * 99999
if __name__ == '__main__':
    procs = [mp.Process(target=noir_cpu_burn) for _ in range(%d)]
    for p in procs: p.start()
    for p in procs: p.join()`, durationSec, workers)
		runCmd = []string{pyBin, "-c", pyScript}
	} else {
		shScript := fmt.Sprintf(`end=$(( $(date +%%s) + %d )); for i in $(seq 1 %d); do ( while [ $(date +%%s) -lt $end ]; do :; done ) & done; wait`, durationSec, workers)
		runCmd = []string{"sh", "-c", shScript}
	}

	return m.ExecRun(c.Name, runCmd, false)
}

func (m *Manager) ApplyMemoryStress(ctx context.Context, target string, memoryMB, durationSec int) (int, string, error) {
	c, err := m.FindContainer(target)
	if err != nil {
		return -1, "", err
	}

	checkCmd := []string{"sh", "-c", "which stress-ng || which stress || which python3 || which python || echo sh"}
	_, out, _ := m.ExecRun(c.Name, checkCmd, false)
	tool := strings.TrimSpace(out)

	var runCmd []string
	if strings.Contains(tool, "stress-ng") {
		runCmd = []string{"stress-ng", "--vm", "1", "--vm-bytes", fmt.Sprintf("%dM", memoryMB), "--timeout", fmt.Sprintf("%ds", durationSec)}
	} else if strings.Contains(tool, "stress") {
		runCmd = []string{"stress", "--vm", "1", "--vm-bytes", fmt.Sprintf("%dM", memoryMB), "--timeout", fmt.Sprintf("%ds", durationSec)}
	} else if strings.Contains(tool, "python") {
		pyBin := "python3"
		if strings.Contains(tool, "python3") {
			pyBin = "python3"
		} else {
			pyBin = "python"
		}
		pyScript := fmt.Sprintf(`import time
b = bytearray(%d * 1024 * 1024)
time.sleep(%d)
del b`, memoryMB, durationSec)
		runCmd = []string{pyBin, "-c", pyScript}
	} else {
		shScript := fmt.Sprintf(`head -c %dM </dev/zero >/dev/shm/noir_mem.tmp 2>/dev/null || head -c %dM </dev/zero >/tmp/noir_mem.tmp; sleep %d; rm -f /dev/shm/noir_mem.tmp /tmp/noir_mem.tmp`, memoryMB, memoryMB, durationSec)
		runCmd = []string{"sh", "-c", shScript}
	}

	return m.ExecRun(c.Name, runCmd, false)
}

func (m *Manager) GetContainerEndpoint(target string) string {
	inspectOut, err := exec.Command("docker", "inspect", target).Output()
	if err != nil {
		return ""
	}
	var items []dockerInspectItem
	if err := json.Unmarshal(inspectOut, &items); err != nil || len(items) == 0 {
		return ""
	}

	ports := items[0].NetworkSettings.Ports
	preferred := []string{"80/tcp", "8080/tcp", "3000/tcp", "5000/tcp", "8000/tcp"}
	for _, p := range preferred {
		if bindings, ok := ports[p]; ok && len(bindings) > 0 && bindings[0].HostPort != "" {
			return fmt.Sprintf("http://localhost:%s/", bindings[0].HostPort)
		}
	}

	for _, bindings := range ports {
		if len(bindings) > 0 && bindings[0].HostPort != "" {
			return fmt.Sprintf("http://localhost:%s/", bindings[0].HostPort)
		}
	}

	return ""
}
