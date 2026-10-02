package cmd

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/ui"
)

var testCustomCmd string

var testCmd = &cobra.Command{
	Use:   "test",
	Short: "Run workspace tests locally and record test execution telemetry to backend.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Executing Noir Reliability Test Runner..."))

		testToRun := testCustomCmd
		if testToRun == "" {
			res := detector.FindTestFiles(".")
			if !res.HasTests || res.HostTestCommand == "" {
				fmt.Println(ui.StyleDanger.Render("no test files found aborting noir"))
				os.Exit(1)
			}
			testToRun = res.HostTestCommand
		}

		fmt.Printf("%s %s\n\n", ui.StyleYellow.Bold(true).Render("Running test command:"), ui.StyleCyan.Render(testToRun))

		start := time.Now()
		shCmd := exec.Command("sh", "-c", testToRun)
		var combinedOut bytes.Buffer
		shCmd.Stdout = &combinedOut
		shCmd.Stderr = &combinedOut

		err := shCmd.Run()
		durationMs := int(time.Since(start).Milliseconds())
		logs := combinedOut.String()

		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = 1
			}
		}

		passed := 0
		failed := 1
		if exitCode == 0 {
			passed = 1
			failed = 0
		}
		total := passed + failed

		fmt.Println(logs)

		// Post test run results to backend if connected & authenticated
		projectID := config.GetProjectID()
		if config.IsConnected() && projectID != "" && auth.HasTokens() {
			client := api.NewClient()
			lastLogs := logs
			if len(lastLogs) > 2000 {
				lastLogs = lastLogs[len(lastLogs)-2000:]
			}
			_, pErr := client.SendRequest("/project/test-runs/", "POST", map[string]interface{}{
				"project":       projectID,
				"command":       testToRun,
				"total_tests":   total,
				"passed_tests":  passed,
				"failed_tests":  failed,
				"skipped_tests": 0,
				"duration_ms":   durationMs,
				"logs":          lastLogs,
			})
			if pErr == nil {
				fmt.Println(ui.StyleCyan.Render("\n✔ Test run telemetry recorded to Noir backend server."))
			} else {
				fmt.Printf("\n%s\n", ui.StyleYellow.Render(fmt.Sprintf("Note: Test run completed, but telemetry sync skipped (%v)", pErr)))
			}
		}

		// Display Summary Table
		statusStr := ui.StyleDanger.Render("FAILED")
		if exitCode == 0 {
			statusStr = ui.StyleGreen.Render("PASSED")
		}

		table := &ui.SimpleTable{
			Title:   "Noir Test Run Results",
			Headers: []string{"Metric", "Result"},
			Rows: [][]string{
				{ui.StyleCyan.Bold(true).Render("Test Command"), testToRun},
				{ui.StyleCyan.Bold(true).Render("Status"), statusStr},
				{ui.StyleCyan.Bold(true).Render("Duration"), fmt.Sprintf("%d ms", durationMs)},
				{ui.StyleCyan.Bold(true).Render("Exit Code"), fmt.Sprintf("%d", exitCode)},
			},
		}

		fmt.Println()
		fmt.Println(table.Render())
		fmt.Println()

		if exitCode != 0 {
			os.Exit(exitCode)
		}
	},
}

func init() {
	testCmd.Flags().StringVarP(&testCustomCmd, "command", "c", "", "Custom test command to execute.")
}
