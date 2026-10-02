package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/docker"
	"noir-cli/internal/faults"
	"noir-cli/internal/ui"
)

var (
	faultTarget   string
	faultDuration int
	faultLatency  int
	faultJitter   int
	faultLoss     float64
	faultWorkers  int
	faultMemory   int
	faultTimeout  int
	faultProbeURL string
	faultYes      bool

	listenInterval    float64
	listenConcurrency int
)

var faultCmd = &cobra.Command{
	Use:   "fault",
	Short: "Safely inject and manage manual fault injection experiments in local Docker containers.",
}

var faultListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all supported manual fault injection types and their parameter constraints.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		table := &ui.SimpleTable{
			Title:   "Noir Supported Manual Fault Injection Library",
			Headers: []string{"Fault Type", "Display Name", "Description", "Parameters & Constraints", "Reversible"},
		}

		paramInfo := map[string]string{
			"container_restart": "timeout (1-60s, default 10)",
			"container_stop":    "duration (1-300s, default 10)\ntimeout (1-60s, default 10)",
			"network_delay":     "latency_ms (1-5000ms, default 500)\njitter_ms (0-1000ms, default 50)\nduration (1-300s, default 10)",
			"network_loss":      "loss_percent (0.1-100%, default 20)\nduration (1-300s, default 10)",
			"cpu_stress":        "workers (1-16, default 2)\nduration (1-300s, default 10)",
			"memory_stress":     "memory_mb (16-4096MB, default 256)\nduration (1-300s, default 10)",
		}

		for _, fault := range faults.DefaultRegistry.ListAll() {
			table.Rows = append(table.Rows, []string{
				ui.StyleGreen.Bold(true).Render(fault.Name()),
				ui.StyleWhite.Bold(true).Render(fault.DisplayName()),
				fault.Description(),
				paramInfo[fault.Name()],
				ui.StyleGreen.Render("Yes"),
			})
		}

		fmt.Println(table.Render())
		fmt.Printf("\n%s\n\n", ui.StyleMuted.Render("Run 'noir fault inject <fault_type> --target <container>' to execute a fault."))
	},
}

var faultContainersCmd = &cobra.Command{
	Use:   "containers",
	Short: "List running Docker containers available for fault injection.",
	Run: func(cmd *cobra.Command, args []string) {
		dm := docker.NewManager()
		if !dm.IsAvailable() {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Docker daemon is not accessible: %s", dm.GetConnectionError())))
			os.Exit(1)
		}

		containers := detector.DiscoverProjectContainers(".", config.GetProjectID())
		if len(containers) == 0 {
			fmt.Println(ui.StyleYellow.Render("No Docker containers found on this system."))
			return
		}

		fmt.Println(detector.FormatContainersTable(containers))
	},
}

var faultInjectCmd = &cobra.Command{
	Use:   "inject <fault_type>",
	Short: "Manually inject an allowlisted, safe fault into a local Docker container with automated resilience evaluation.",
	Args:  cobra.ExactArgs(1),
	Run:   runFaultInject,
}

var faultListenCmd = &cobra.Command{
	Use:   "listen",
	Short: "Run in background/terminal to listen for and execute fault injection requests dispatched from Noir Web Dashboard.",
	Run:   runFaultListen,
}

func init() {
	faultInjectCmd.Flags().StringVarP(&faultTarget, "target", "t", "", "Target container name or short ID.")
	faultInjectCmd.Flags().IntVarP(&faultDuration, "duration", "d", 10, "Fault duration in seconds (1-300).")
	faultInjectCmd.Flags().IntVarP(&faultLatency, "latency", "l", 500, "Latency in milliseconds (for network_delay, 1-5000).")
	faultInjectCmd.Flags().IntVarP(&faultJitter, "jitter", "j", 50, "Jitter in milliseconds (for network_delay, 0-1000).")
	faultInjectCmd.Flags().Float64Var(&faultLoss, "loss", 20.0, "Loss percentage (for network_loss, 0.1-100).")
	faultInjectCmd.Flags().IntVarP(&faultWorkers, "workers", "w", 2, "Number of CPU workers (for cpu_stress, 1-16).")
	faultInjectCmd.Flags().IntVarP(&faultMemory, "memory", "m", 256, "Memory to allocate in MB (for memory_stress, 16-4096).")
	faultInjectCmd.Flags().IntVar(&faultTimeout, "timeout", 10, "Graceful stop/restart timeout in seconds (1-60).")
	faultInjectCmd.Flags().StringVarP(&faultProbeURL, "probe-url", "p", "", "HTTP health probe URL for steady-state resilience evaluation.")
	faultInjectCmd.Flags().BoolVarP(&faultYes, "yes", "y", false, "Skip confirmation prompt.")

	faultListenCmd.Flags().Float64VarP(&listenInterval, "interval", "i", 2.0, "Polling interval in seconds.")
	faultListenCmd.Flags().IntVarP(&listenConcurrency, "concurrency", "c", 1, "Max concurrent injections.")

	faultCmd.AddCommand(faultListCmd)
	faultCmd.AddCommand(faultContainersCmd)
	faultCmd.AddCommand(faultInjectCmd)
	faultCmd.AddCommand(faultListenCmd)
}

func runFaultInject(cmd *cobra.Command, args []string) {
	faultType := args[0]
	executor := faults.DefaultRegistry.Get(faultType)
	if executor == nil {
		fmt.Printf("%s %s\n", ui.StyleDanger.Render("Error: Unsupported fault type"), ui.StyleYellow.Bold(true).Render(faultType))
		fmt.Printf("%s\n", ui.StyleMuted.Render(fmt.Sprintf("Supported faults: %s", strings.Join(faults.DefaultRegistry.SupportedNames(), ", "))))
		os.Exit(1)
	}

	dm := docker.NewManager()
	if !dm.IsAvailable() {
		fmt.Printf("%s %s\n", ui.StyleDanger.Render("Docker Error:"), dm.GetConnectionError())
		os.Exit(1)
	}

	target := faultTarget
	if target == "" {
		containers := detector.DiscoverProjectContainers(".", config.GetProjectID())
		if len(containers) == 0 {
			fmt.Println(ui.StyleDanger.Render("No running containers found to inject faults into."))
			os.Exit(1)
		}
		fmt.Println(ui.StyleYellow.Render("No target specified. Available containers:"))
		for idx, c := range containers {
			fmt.Printf("  [%d] %s (%s) - %s\n", idx+1, ui.StyleCyan.Bold(true).Render(c.Name), c.ID, c.Image)
		}
		reader := bufio.NewReader(os.Stdin)
		fmt.Printf("Select container number or enter name [1]: ")
		choice, _ := reader.ReadString('\n')
		choice = strings.TrimSpace(choice)
		if choice == "" {
			choice = "1"
		}
		if num, err := strconv.Atoi(choice); err == nil && num >= 1 && num <= len(containers) {
			target = containers[num-1].Name
		} else {
			target = choice
		}
	}

	containerMeta, err := dm.FindContainer(target)
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Target container '%s' was not found: %v", target, err)))
		os.Exit(1)
	}

	resolvedProbeURL := faultProbeURL
	if resolvedProbeURL == "" {
		resolvedProbeURL = dm.GetContainerEndpoint(containerMeta.Name)
	}

	params := map[string]interface{}{
		"duration": faultDuration,
	}
	if resolvedProbeURL != "" {
		params["probe_url"] = resolvedProbeURL
	}
	switch faultType {
	case "network_delay":
		params["latency_ms"] = faultLatency
		params["jitter_ms"] = faultJitter
	case "network_loss":
		params["loss_percent"] = faultLoss
	case "cpu_stress":
		params["workers"] = faultWorkers
	case "memory_stress":
		params["memory_mb"] = faultMemory
	case "container_stop", "container_restart":
		params["timeout"] = faultTimeout
	}

	validatedParams, err := executor.ValidateParameters(params)
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Invalid Parameters: %v", err)))
		os.Exit(1)
	}

	var paramSummary []string
	for k, v := range validatedParams {
		paramSummary = append(paramSummary, fmt.Sprintf("  • %s: %s", ui.StyleCyan.Render(k), fmt.Sprintf("%v", v)))
	}
	if resolvedProbeURL != "" {
		paramSummary = append(paramSummary, fmt.Sprintf("  • %s: %s %s", ui.StyleGreen.Bold(true).Render("probe_url"), resolvedProbeURL, ui.StyleMuted.Render("(auto-evaluated)")))
	}

	warningText := fmt.Sprintf(
		"%s\n\nYou are about to inject %s into container %s.\n\nParameters:\n%s\n\n%s\n%s",
		ui.StyleDanger.Bold(true).Render("⚠ MANUAL FAULT INJECTION WARNING ⚠"),
		ui.StyleYellow.Bold(true).Render(executor.DisplayName()),
		ui.StyleCyan.Bold(true).Render(containerMeta.Name),
		strings.Join(paramSummary, "\n"),
		ui.StyleMuted.Render(executor.Description()),
		ui.StyleGreen.Render("Automatic rollback/cleanup and resilience scoring will execute."),
	)
	fmt.Println(ui.RenderPanel("Execution Confirmation", warningText, ui.ColorDanger))

	if !faultYes {
		reader := bufio.NewReader(os.Stdin)
		fmt.Printf("Proceed with injecting '%s' into '%s'? (y/N): ", faultType, containerMeta.Name)
		resp, _ := reader.ReadString('\n')
		resp = strings.ToLower(strings.TrimSpace(resp))
		if resp != "y" && resp != "yes" {
			fmt.Println(ui.StyleYellow.Render("Fault injection cancelled by user."))
			return
		}
	}

	projectID := config.GetProjectID()
	var client *api.Client
	var faultRecordID interface{}

	if projectID != "" && auth.HasTokens() {
		client = api.NewClient()
		createResp, cErr := client.SendRequest(fmt.Sprintf("/projects/%s/faults/", projectID), "POST", map[string]interface{}{
			"fault_type": faultType,
			"target":     containerMeta.Name,
			"parameters": validatedParams,
		})
		if cErr == nil {
			if cMap, ok := createResp.(map[string]interface{}); ok {
				faultRecordID = cMap["id"]
				fmt.Printf("%s\n", ui.StyleMuted.Render(fmt.Sprintf("Recorded fault injection request #%v in Noir backend.", faultRecordID)))
				_, _ = client.SendRequest(fmt.Sprintf("/projects/%s/faults/%v/claim/", projectID, faultRecordID), "POST", nil)
			}
		}
	}

	evaluator := faults.NewSteadyStateEvaluator(resolvedProbeURL, 200, containerMeta.Name, dm)
	if resolvedProbeURL != "" {
		fmt.Printf("%s\n", ui.StyleCyan.Render(fmt.Sprintf("Measuring baseline health on '%s'...", resolvedProbeURL)))
		baseline := evaluator.MeasureBaseline(3, 0.3)
		if healthy, ok := baseline["healthy"].(bool); ok && healthy {
			fmt.Printf("  %s\n", ui.StyleGreen.Render(fmt.Sprintf("✔ Baseline steady state healthy (%vms avg)", baseline["avg_latency_ms"])))
		} else {
			fmt.Printf("  %s\n", ui.StyleYellow.Render("⚠ Warning: Target endpoint did not respond with expected status"))
		}
	}

	evaluator.StartInFaultProbing(1.0)
	fmt.Printf("\n%s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("⚡ Injecting fault: %s...", executor.DisplayName())))

	result, err := executor.Execute(dm, containerMeta.Name, validatedParams, nil)
	faultWindowEnd := float64(time.Now().UnixNano()) / 1e9

	inFaultMetrics := evaluator.StopInFaultProbing(faultWindowEnd)
	lifecycle := evaluator.LifecycleTimestamps()

	fmt.Printf("%s\n", ui.StyleCyan.Render("Verifying post-fault recovery (target RTO: 5.0s)..."))
	recoveryMetrics := evaluator.MeasureRecovery(12.0, 5.0)

	scorer := &faults.ResilienceScorer{}
	resilienceReport := scorer.CalculateScore(
		faultType,
		evaluator.Baseline,
		inFaultMetrics,
		recoveryMetrics,
		result.Recovered,
	)

	grade := fmt.Sprintf("%v", resilienceReport["grade"])
	score := fmt.Sprintf("%v", resilienceReport["score"])
	classification := fmt.Sprintf("%v", resilienceReport["classification"])

	recs, _ := resilienceReport["recommendations"].([]string)
	var recsStr []string
	for _, r := range recs {
		recsStr = append(recsStr, "  • "+r)
	}

	panelColor := ui.ColorSuccess
	if grade == "B" {
		panelColor = ui.ColorWarning
	} else if grade == "C" || grade == "F" {
		panelColor = ui.ColorDanger
	}

	resilienceBody := fmt.Sprintf(
		"Grade %s — Score %s/100 (%s)\n\n"+
			"Steady-State Probe: %s\n"+
			"Fault Window Duration: %vs (configured: %ds)\n"+
			"In-Fault Availability: %v%%\n"+
			"In-Fault Latency P95: %vms\n"+
			"Recovery Time (RTO): %vs\n"+
			"Rollback Cleaned Up: %v\n\n"+
			"Architectural Recommendations:\n%s",
		grade,
		score,
		classification,
		resolvedProbeURL,
		lifecycle["fault_window_duration_seconds"],
		faultDuration,
		inFaultMetrics["availability_percent"],
		inFaultMetrics["p95_latency_ms"],
		recoveryMetrics["rto_seconds"],
		result.Recovered,
		strings.Join(recsStr, "\n"),
	)

	fmt.Println(ui.RenderPanel(fmt.Sprintf("Chaos Resilience Assessment — Score %s/100", score), resilienceBody, panelColor))

	// Report to backend
	if client != nil && faultRecordID != nil && projectID != "" {
		statusStr := "failed"
		if result.Success {
			statusStr = "completed"
		}
		payload := map[string]interface{}{
			"success":               result.Success,
			"message":               result.Message,
			"details":               result.Details,
			"duration_seconds":      result.DurationSeconds,
			"recovered":             result.Recovered,
			"resilience":            resilienceReport,
			"resilience_score":      resilienceReport["score"],
			"resilience_grade":      resilienceReport["grade"],
			"classification":        resilienceReport["classification"],
			"steady_state_baseline": evaluator.Baseline,
			"experiment_metrics":    inFaultMetrics,
			"recovery_metrics":      recoveryMetrics,
			"recommendations":       resilienceReport["recommendations"],
		}
		_, _ = client.SendRequest(fmt.Sprintf("/projects/%s/faults/%v/report/", projectID, faultRecordID), "POST", map[string]interface{}{
			"status":        statusStr,
			"result":        payload,
			"error_message": result.Error,
		})
		fmt.Println(ui.StyleMuted.Render(fmt.Sprintf("Reported final resilience audit for fault #%v to Noir backend.\n", faultRecordID)))
	}
}

// LogBatcher batches logs to backend
type LogBatcher struct {
	client    *api.Client
	projectID string
	faultID   int
	buffer    []map[string]string
	mu        sync.Mutex
	stop      chan struct{}
}

func NewLogBatcher(client *api.Client, projectID string, faultID int) *LogBatcher {
	b := &LogBatcher{
		client:    client,
		projectID: projectID,
		faultID:   faultID,
		stop:      make(chan struct{}),
	}
	go b.flushLoop()
	return b
}

func (b *LogBatcher) Add(level, msg string) {
	b.mu.Lock()
	b.buffer = append(b.buffer, map[string]string{
		"level":     level,
		"message":   msg,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	shouldFlush := len(b.buffer) >= 10
	b.mu.Unlock()

	if shouldFlush {
		b.Flush()
	}
}

func (b *LogBatcher) Flush() {
	b.mu.Lock()
	if len(b.buffer) == 0 {
		b.mu.Unlock()
		return
	}
	items := make([]map[string]string, len(b.buffer))
	copy(items, b.buffer)
	b.buffer = nil
	b.mu.Unlock()

	_, err := b.client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/logs/batch/", b.projectID, b.faultID), "POST", map[string]interface{}{
		"logs": items,
	})
	if err != nil {
		for _, item := range items {
			_, _ = b.client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/log/", b.projectID, b.faultID), "POST", item)
		}
	}
}

func (b *LogBatcher) flushLoop() {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-b.stop:
			b.Flush()
			return
		case <-ticker.C:
			b.Flush()
		}
	}
}

func (b *LogBatcher) Close() {
	close(b.stop)
	b.Flush()
}

func runFaultListen(cmd *cobra.Command, args []string) {
	ui.PrintBanner()

	projectID := config.GetProjectID()
	if projectID == "" {
		fmt.Println(ui.StyleDanger.Render("No connected project found in this workspace."))
		fmt.Println(ui.StyleYellow.Render("Please run 'noir connect <code>' first."))
		os.Exit(1)
	}

	if !auth.HasTokens() {
		fmt.Println(ui.StyleDanger.Render("Not authenticated. Please run 'noir login' first."))
		os.Exit(1)
	}

	dm := docker.NewManager()
	if !dm.IsAvailable() {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Docker daemon is not accessible: %s", dm.GetConnectionError())))
		os.Exit(1)
	}

	client := api.NewClient()

	panelContent := fmt.Sprintf(
		"Project: %s\nPolling Interval: %.1fs\nConcurrency Limit: %d\nStatus: %s\n\n%s\n%s",
		ui.StyleCyan.Bold(true).Render(projectID),
		listenInterval,
		listenConcurrency,
		ui.StyleGreen.Bold(true).Render("Active & Listening for Remote Fault Injections"),
		ui.StyleMuted.Render("Trigger faults from the web dashboard. The agent will execute them locally and stream logs."),
		ui.StyleMuted.Render("Press Ctrl+C at any time to stop listening."),
	)
	fmt.Println(ui.RenderPanel("Noir Fault Injection Daemon", panelContent, ui.ColorPrimary))

	// Initial stream log
	sendLogTelemetry(client, projectID, fmt.Sprintf("[Daemon] Noir Fault Injection Daemon active on project %s (concurrency: %d). Listening...", projectID, listenConcurrency), "stdout", "daemon_start")

	// Discovered containers sync
	detected := detector.DiscoverProjectContainers(".", projectID)
	if len(detected) > 0 {
		_, _ = client.SendRequest(fmt.Sprintf("/projects/%s/containers/", projectID), "POST", map[string]interface{}{
			"containers": detected,
		})
		fmt.Println(detector.FormatContainersTable(detected))
		activeCount := 0
		for _, c := range detected {
			if c.Status == "running" {
				activeCount++
			}
		}
		if activeCount > 0 {
			fmt.Printf("%s\n\n", ui.StyleGreen.Render(fmt.Sprintf("✔ %d active container(s) ready for fault injection experiments.", activeCount)))
		} else {
			fmt.Printf("%s\n\n", ui.StyleYellow.Render("⚡ Note: Start defined containers with 'docker compose up -d' or 'noir run' so the agent can execute faults."))
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	type activeWorker struct {
		cancelCh chan struct{}
		doneCh   chan struct{}
	}
	activeWorkers := make(map[int]*activeWorker)
	var workersMu sync.Mutex

	ticker := time.NewTicker(time.Duration(listenInterval * float64(time.Second)))
	defer ticker.Stop()

	for {
		select {
		case <-sigCh:
			fmt.Printf("\n%s\n\n", ui.StyleYellow.Bold(true).Render("Stopping Noir Fault Daemon. Signalling active tasks to terminate..."))
			workersMu.Lock()
			for _, w := range activeWorkers {
				close(w.cancelCh)
			}
			workersMu.Unlock()
			sendLogTelemetry(client, projectID, fmt.Sprintf("[Daemon] Noir Fault Injection Daemon stopped for project %s.", projectID), "stdout", "daemon_stop")
			fmt.Println(ui.StyleMuted.Render("Goodbye!\n"))
			return

		case <-ticker.C:
			// 1. Clean finished workers
			workersMu.Lock()
			for fid, w := range activeWorkers {
				select {
				case <-w.doneCh:
					delete(activeWorkers, fid)
				default:
				}
			}

			// 2. Check for backend cancellation
			for fid, w := range activeWorkers {
				res, err := client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/status/", projectID, fid), "GET", nil)
				if err == nil {
					if rMap, ok := res.(map[string]interface{}); ok {
						if cancelReq, _ := rMap["cancel_requested"].(bool); cancelReq {
							fmt.Printf("  %s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Stop requested for active fault #%d. Terminating...", fid)))
							close(w.cancelCh)
						}
					}
				}
			}

			// 3. Poll for next pending fault
			if len(activeWorkers) < listenConcurrency {
				resp, err := client.SendRequest(fmt.Sprintf("/projects/%s/faults/pending/?concurrency=%d", projectID, listenConcurrency), "GET", nil)
				if err == nil {
					if rMap, ok := resp.(map[string]interface{}); ok {
						if faultObj, ok := rMap["fault"].(map[string]interface{}); ok && faultObj != nil {
							fidFloat, _ := faultObj["id"].(float64)
							fid := int(fidFloat)
							if _, exists := activeWorkers[fid]; !exists {
								ftype, _ := faultObj["fault_type"].(string)
								ftarget, _ := faultObj["target"].(string)
								params, _ := faultObj["parameters"].(map[string]interface{})

								fmt.Printf("\n%s %s -> %s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("⚡ Received Queued Fault #%d:", fid)), ui.StyleCyan.Bold(true).Render(ftype), ui.StyleWhite.Render(ftarget))

								cancelCh := make(chan struct{})
								doneCh := make(chan struct{})
								activeWorkers[fid] = &activeWorker{cancelCh: cancelCh, doneCh: doneCh}

								go func(fID int, fType, fTarget string, fParams map[string]interface{}, cCh, dCh chan struct{}) {
									defer close(dCh)
									executeQueuedFault(fID, fType, fTarget, fParams, projectID, client, dm, cCh)
								}(fid, ftype, ftarget, params, cancelCh, doneCh)
							}
						}
					}
				}
			}
			workersMu.Unlock()
		}
	}
}

func executeQueuedFault(faultID int, faultType, target string, params map[string]interface{}, projectID string, client *api.Client, dm *docker.Manager, cancelCh chan struct{}) {
	batcher := NewLogBatcher(client, projectID, faultID)
	defer batcher.Close()

	emitLog := func(msg, level string) {
		levelStyle := ui.StyleGreen
		if level == "WARN" {
			levelStyle = ui.StyleYellow
		} else if level == "ERROR" {
			levelStyle = ui.StyleDanger
		}
		fmt.Printf("  %s %s\n", ui.StyleCyan.Render(fmt.Sprintf("#%d", faultID)), levelStyle.Render(msg))
		batcher.Add(level, msg)
	}

	// 1. Claim
	_, err := client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/claim/", projectID, faultID), "POST", nil)
	if err != nil {
		fmt.Printf("  %s\n", ui.StyleDanger.Render(fmt.Sprintf("Failed to claim fault #%d: %v", faultID, err)))
		return
	}
	emitLog(fmt.Sprintf("Claimed by worker daemon. Preparing %s on target '%s'...", faultType, target), "INFO")

	executor := faults.DefaultRegistry.Get(faultType)
	if executor == nil {
		errMsg := fmt.Sprintf("Agent does not support fault type '%s'", faultType)
		emitLog(errMsg, "ERROR")
		_, _ = client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/report/", projectID, faultID), "POST", map[string]interface{}{
			"status":        "failed",
			"result":        map[string]interface{}{"error": errMsg},
			"error_message": errMsg,
		})
		return
	}

	isCancelled := func() bool {
		select {
		case <-cancelCh:
			return true
		default:
			return false
		}
	}

	execCtx := &faults.ExecutionContext{
		IsCancelled: isCancelled,
		Log:         emitLog,
	}

	probeURL := ""
	if p, ok := params["probe_url"].(string); ok {
		probeURL = p
	}
	if probeURL == "" {
		probeURL = dm.GetContainerEndpoint(target)
	}

	evaluator := faults.NewSteadyStateEvaluator(probeURL, 200, target, dm)
	if probeURL != "" {
		emitLog(fmt.Sprintf("[STEADY STATE] Measuring baseline on '%s'...", probeURL), "INFO")
		baseline := evaluator.MeasureBaseline(5, 0.5)
		if healthy, _ := baseline["healthy"].(bool); healthy {
			emitLog(fmt.Sprintf("[STEADY STATE] Baseline healthy: mean=%vms", baseline["avg_latency_ms"]), "INFO")
		} else {
			emitLog("[STEADY STATE] Target endpoint unreachable before fault.", "WARN")
		}
	}

	evaluator.StartInFaultProbing(1.0)
	emitLog(fmt.Sprintf("Executing %s on target '%s'...", executor.DisplayName(), target), "INFO")

	result, _ := executor.Execute(dm, target, params, execCtx)
	faultWindowEnd := float64(time.Now().UnixNano()) / 1e9

	inFaultMetrics := evaluator.StopInFaultProbing(faultWindowEnd)
	lifecycle := evaluator.LifecycleTimestamps()

	wasCancelled := isCancelled() || (result != nil && result.Details != nil && result.Details["cancelled"] == true)

	var recoveryMetrics map[string]interface{}
	if wasCancelled {
		recoveryMetrics = map[string]interface{}{
			"status":    "CANCELLED",
			"recovered": true,
		}
		emitLog(fmt.Sprintf("Fault #%d stopped and cleaned up safely.", faultID), "WARN")
	} else {
		emitLog("[RECOVERY] Fault completed. Verifying recovery to steady state...", "INFO")
		recoveryMetrics = evaluator.MeasureRecovery(12.0, 5.0)
	}

	scorer := &faults.ResilienceScorer{}
	resilienceReport := scorer.CalculateScore(
		faultType,
		evaluator.Baseline,
		inFaultMetrics,
		recoveryMetrics,
		result.Recovered,
	)

	statusStr := "failed"
	if wasCancelled {
		statusStr = "cancelled"
	} else if result.Success {
		statusStr = "completed"
		emitLog(fmt.Sprintf("Fault #%d completed successfully. Score: %v/100 (Grade %v)", faultID, resilienceReport["score"], resilienceReport["grade"]), "INFO")
	} else {
		emitLog(fmt.Sprintf("Fault #%d failed: %s", faultID, result.Error), "ERROR")
	}

	resultPayload := map[string]interface{}{
		"success":               result.Success,
		"message":               result.Message,
		"details":               result.Details,
		"duration_seconds":      result.DurationSeconds,
		"recovered":             result.Recovered,
		"resilience":            resilienceReport,
		"resilience_score":      resilienceReport["score"],
		"resilience_grade":      resilienceReport["grade"],
		"classification":        resilienceReport["classification"],
		"steady_state_baseline": evaluator.Baseline,
		"experiment_metrics":    inFaultMetrics,
		"recovery_metrics":      recoveryMetrics,
		"recommendations":       resilienceReport["recommendations"],
		"lifecycle_timing":      lifecycle,
	}

	_, _ = client.SendRequest(fmt.Sprintf("/projects/%s/faults/%d/report/", projectID, faultID), "POST", map[string]interface{}{
		"status":        statusStr,
		"result":        resultPayload,
		"error_message": result.Error,
	})

	if statusStr == "completed" {
		fmt.Printf("  %s\n", ui.StyleSuccess.Render(fmt.Sprintf("✔ Fault #%d Completed — Resilience: %v (%v/100)", faultID, resilienceReport["grade"], resilienceReport["score"])))
	} else if statusStr == "cancelled" {
		fmt.Printf("  %s\n", ui.StyleYellow.Render(fmt.Sprintf("■ Fault #%d Cancelled & Cleaned Up", faultID)))
	} else {
		fmt.Printf("  %s\n", ui.StyleDanger.Render(fmt.Sprintf("✖ Fault #%d Failed: %s", faultID, result.Error)))
	}
}
