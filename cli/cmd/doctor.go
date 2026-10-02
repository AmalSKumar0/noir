package cmd

import (
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/docker"
	"noir-cli/internal/ui"
)

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Run diagnostic health checks on Noir CLI environment and backend connectivity.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Running Noir System & Environment Diagnostics..."))

		table := &ui.SimpleTable{
			Title:   "Noir Doctor Diagnostic Summary",
			Headers: []string{"Diagnostic Check", "Status", "Details"},
		}

		// 1. Go Runtime
		table.Rows = append(table.Rows, []string{
			ui.StyleCyan.Bold(true).Render("Go Runtime"),
			ui.StyleGreen.Render("PASS"),
			fmt.Sprintf("%s (%s/%s)", runtime.Version(), runtime.GOOS, runtime.GOARCH),
		})

		// 2. Git CLI Check
		gitPath, err := exec.LookPath("git")
		if err == nil {
			out, err := exec.Command(gitPath, "--version").Output()
			if err == nil {
				table.Rows = append(table.Rows, []string{
					ui.StyleCyan.Bold(true).Render("Git Executable"),
					ui.StyleGreen.Render("PASS"),
					strings.TrimSpace(string(out)),
				})
			} else {
				table.Rows = append(table.Rows, []string{
					ui.StyleCyan.Bold(true).Render("Git Executable"),
					ui.StyleYellow.Render("WARN"),
					"Git available but version check failed",
				})
			}
		} else {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Git Executable"),
				ui.StyleYellow.Render("WARN"),
				"Git executable not found on PATH",
			})
		}

		// 3. Docker Daemon Check
		dm := docker.NewManager()
		if dm.IsAvailable() {
			out, err := exec.Command("docker", "--version").Output()
			dockerVer := "Docker daemon running"
			if err == nil {
				dockerVer = strings.TrimSpace(string(out))
			}
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Docker Daemon"),
				ui.StyleGreen.Render("PASS"),
				dockerVer,
			})
		} else {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Docker Daemon"),
				ui.StyleDanger.Render("FAIL"),
				dm.GetConnectionError(),
			})
		}

		// 4. Auth Credentials Check
		if auth.HasTokens() {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Auth Credentials"),
				ui.StyleGreen.Render("PASS"),
				"Valid credentials stored securely",
			})
		} else {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Auth Credentials"),
				ui.StyleYellow.Render("WARN"),
				"No active auth tokens found. Run 'noir login'",
			})
		}

		// 5. Backend Server Reachability
		client := api.NewClient()
		checkURL := client.BuildURL("/accounts/me/")
		netClient := &http.Client{Timeout: 3 * time.Second}
		resp, err := netClient.Get(checkURL)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 || resp.StatusCode == 401 || resp.StatusCode == 403 {
				table.Rows = append(table.Rows, []string{
					ui.StyleCyan.Bold(true).Render("Backend Reachability"),
					ui.StyleGreen.Render("PASS"),
					fmt.Sprintf("Reachable at %s", client.BaseHost),
				})
			} else {
				table.Rows = append(table.Rows, []string{
					ui.StyleCyan.Bold(true).Render("Backend Reachability"),
					ui.StyleYellow.Render("WARN"),
					fmt.Sprintf("Backend returned status %d", resp.StatusCode),
				})
			}
		} else {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Backend Reachability"),
				ui.StyleDanger.Render("FAIL"),
				fmt.Sprintf("Cannot connect to %s (%v)", client.BaseHost, err),
			})
		}

		// 6. Local .noir Workspace Check
		if config.IsConnected() {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Workspace Configuration"),
				ui.StyleGreen.Render("PASS"),
				".noir/ workspace initialized",
			})
		} else {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render("Workspace Configuration"),
				ui.StyleYellow.Render("INFO"),
				"No local .noir workspace. Run 'noir connect <code>'",
			})
		}

		fmt.Println(table.Render())
		fmt.Printf("\n%s\n\n", ui.StyleSuccess.Render("✔ Diagnostics check complete!"))
	},
}
