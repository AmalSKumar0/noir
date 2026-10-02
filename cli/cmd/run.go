package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/ui"
)

var (
	runImage string
	runPort  string
	runCmd   string
)

var runContainerCmd = &cobra.Command{
	Use:   "run",
	Short: "Build & launch Docker container, execute tests in container, stream live telemetry, and terminate cleanly.",
	Run:   executeRunContainer,
}

func init() {
	runContainerCmd.Flags().StringVarP(&runImage, "image", "i", "", "Custom Docker image name/tag to run.")
	runContainerCmd.Flags().StringVarP(&runPort, "port", "p", "", "Port mapping (e.g. 8000:8000).")
	runContainerCmd.Flags().StringVarP(&runCmd, "cmd", "c", "", "Override container CMD.")
}

func sendLogTelemetry(client *api.Client, projectCode, logMsg, stream, event string) {
	if !auth.HasTokens() {
		return
	}
	data := map[string]interface{}{
		"log":       logMsg,
		"stream":    stream,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	if event != "" {
		data["event"] = event
	}
	_, _ = client.SendRequest(fmt.Sprintf("/project/%s/stream-logs/", projectCode), "POST", data)
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func createFallbackDockerfile(dir string) {
	dfPath := filepath.Join(dir, "Dockerfile")

	var content string
	if fileExists(filepath.Join(dir, "package.json")) {
		content = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`
	} else if fileExists(filepath.Join(dir, "manage.py")) {
		content = `FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc default-libmysqlclient-dev pkg-config libpq-dev build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; else pip install django; fi
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
`
	} else {
		content = `FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi
COPY . .
EXPOSE 8000
CMD ["python", "-m", "http.server", "8000"]
`
	}

	needsWrite := true
	if fileExists(dfPath) {
		existing, err := os.ReadFile(dfPath)
		if err == nil && !strings.Contains(string(existing), "|| true") {
			needsWrite = false
		}
	}

	if needsWrite {
		_ = os.WriteFile(dfPath, []byte(content), 0644)
		fmt.Println(ui.StyleMuted.Render("Generated workspace Dockerfile for containerized execution."))
	}
}

func executeRunContainer(cmd *cobra.Command, args []string) {
	ui.PrintBanner()
	fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Noir Container Test Execution & Live Telemetry Stream..."))

	if !config.IsConnected() {
		fmt.Println(ui.StyleDanger.Render("Error: Project is not connected. Please run 'noir connect <code>' first."))
		os.Exit(1)
	}

	projectCode := config.GetProjectID()
	if projectCode == "" {
		projectCode = "NR-UNKNOWN"
	}

	client := api.NewClient()

	// Initial stream telemetry
	sendLogTelemetry(client, projectCode, fmt.Sprintf("[Agent] Noir run session initiated for project '%s'", projectCode), "stdout", "run_start")

	// 1. Verify test files exist
	res := detector.FindTestFiles(".")
	if !res.HasTests || res.ContainerTestCommand == "" {
		fmt.Println(ui.StyleDanger.Bold(true).Render("no test files found aborting noir"))
		sendLogTelemetry(client, projectCode, "[Agent] No test files found, aborting.", "stdout", "run_end")
		os.Exit(1)
	}

	fmt.Printf("%s\n", ui.StyleSuccess.Render(fmt.Sprintf("✔ Test suite detected for %s", res.TechName)))
	fmt.Printf("%s %s\n\n", ui.StyleYellow.Bold(true).Render("In-container test runner target:"), ui.StyleCyan.Render(res.ContainerTestCommand))

	// 2. Check Docker installation
	if err := exec.Command("docker", "--version").Run(); err != nil {
		fmt.Println(ui.StyleDanger.Render("Error: Docker executable not found. Please ensure Docker daemon is running."))
		sendLogTelemetry(client, projectCode, "[Agent] Docker not found, aborting.", "stdout", "run_end")
		os.Exit(1)
	}

	imageName := runImage
	if imageName == "" {
		imageName = fmt.Sprintf("noir-app-%s", strings.ToLower(projectCode))
	} else {
		imageName = detector.SanitizeDockerImageString(imageName, "app:latest")
	}

	if runImage == "" {
		fmt.Printf("%s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Building Docker image '%s'...", imageName)))
		sendLogTelemetry(client, projectCode, fmt.Sprintf("[Agent] Building Docker image '%s'...", imageName), "stdout", "")
		createFallbackDockerfile(".")

		buildCmd := exec.Command("docker", "build", "-t", imageName, ".")
		buildCmd.Stdout = os.Stdout
		buildCmd.Stderr = os.Stderr
		if err := buildCmd.Run(); err != nil {
			fmt.Println(ui.StyleDanger.Render("Docker build failed."))
			sendLogTelemetry(client, projectCode, "[Agent] Docker build failed.", "stdout", "run_end")
			os.Exit(1)
		}
	}

	containerName := fmt.Sprintf("noir-run-%s", strings.ToLower(projectCode))
	_ = exec.Command("docker", "rm", "-f", containerName).Run()

	fmt.Printf("\n%s\n\n", ui.StyleSuccess.Render(fmt.Sprintf("Launching container '%s' (%s) for project '%s'...", imageName, containerName, projectCode)))
	sendLogTelemetry(client, projectCode, fmt.Sprintf("[Agent] Launching container '%s'...", containerName), "stdout", "")

	dockerRunArgs := []string{"run", "-d", "--name", containerName}
	if runPort != "" {
		dockerRunArgs = append(dockerRunArgs, "-p", runPort)
	}
	dockerRunArgs = append(dockerRunArgs, imageName)
	if runCmd != "" {
		dockerRunArgs = append(dockerRunArgs, strings.Fields(runCmd)...)
	}

	runOut, err := exec.Command("docker", dockerRunArgs...).CombinedOutput()
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Failed to start container: %s", string(runOut))))
		sendLogTelemetry(client, projectCode, fmt.Sprintf("[Agent] Failed to start container: %s", string(runOut)), "stdout", "run_end")
		os.Exit(1)
	}

	testSuccess := false

	defer func() {
		// 4. Terminate container and clean up immediately
		fmt.Println(ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Terminating and removing container '%s'...", containerName)))
		_ = exec.Command("docker", "rm", "-f", containerName).Run()

		sendLogTelemetry(client, projectCode, fmt.Sprintf("[Agent] Container '%s' terminated cleanly.", containerName), "stdout", "run_end")
		fmt.Println(ui.StyleSuccess.Render("\n✔ Noir container execution finished and container terminated cleanly.\n"))

		if !testSuccess {
			os.Exit(1)
		}
	}()

	// 3. Run tests inside container via `docker exec`
	fmt.Println(ui.StyleCyan.Bold(true).Render("═══ Executing Tests Inside Container ═══"))
	fmt.Printf("%s\n\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Running: docker exec %s %s", containerName, res.ContainerTestCommand)))

	execArgs := append([]string{"exec", containerName}, strings.Fields(res.ContainerTestCommand)...)
	testExecCmd := exec.Command("docker", execArgs...)

	stdoutPipe, err := testExecCmd.StdoutPipe()
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Error creating stdout pipe: %v", err)))
		return
	}
	testExecCmd.Stderr = testExecCmd.Stdout // multiplex

	startTime := time.Now()
	if err := testExecCmd.Start(); err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Error starting docker exec: %v", err)))
		return
	}

	var testLogs []string
	scanner := bufio.NewScanner(stdoutPipe)
	for scanner.Scan() {
		line := scanner.Text()
		testLogs = append(testLogs, line)
		timestamp := time.Now().Format("15:04:05")
		prefix := ui.StyleCyan.Render(fmt.Sprintf("[%s][Container Test]", timestamp))
		fmt.Printf("%s %s\n", prefix, line)
		sendLogTelemetry(client, projectCode, fmt.Sprintf("[Container Test] %s", line), "stdout", "")
	}

	_ = testExecCmd.Wait()
	durationMs := int(time.Since(startTime).Milliseconds())
	testSuccess = (testExecCmd.ProcessState != nil && testExecCmd.ProcessState.Success())

	combinedLogs := strings.Join(testLogs, "\n")
	lastLogs := combinedLogs
	if len(lastLogs) > 2000 {
		lastLogs = lastLogs[len(lastLogs)-2000:]
	}

	if auth.HasTokens() {
		passed := 0
		failed := 1
		if testSuccess {
			passed = 1
			failed = 0
		}
		_, _ = client.SendRequest("/project/test-runs/", "POST", map[string]interface{}{
			"project":       projectCode,
			"command":       res.ContainerTestCommand,
			"total_tests":   1,
			"passed_tests":  passed,
			"failed_tests":  failed,
			"skipped_tests": 0,
			"duration_ms":   durationMs,
			"logs":          lastLogs,
		})
	}

	if !testSuccess {
		exitCode := 1
		if testExecCmd.ProcessState != nil {
			exitCode = testExecCmd.ProcessState.ExitCode()
		}
		fmt.Printf("\n%s\n", ui.StyleDanger.Bold(true).Render(fmt.Sprintf("✖ Tests failed inside container (exit code %d).", exitCode)))
	} else {
		fmt.Printf("\n%s\n", ui.StyleSuccess.Render(fmt.Sprintf("✔ All container tests completed successfully (%d ms)!", durationMs)))
	}
}
