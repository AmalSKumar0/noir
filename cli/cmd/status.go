package cmd

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"

	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/ui"
)

func getGitBranch() string {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "Not a git repository"
	}
	return strings.TrimSpace(string(out))
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Display connection status and telemetry health of current workspace.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Checking Noir CLI Workspace Status..."))

		authStatus := ui.StyleDanger.Render("Not Authenticated")
		if auth.HasTokens() {
			authStatus = ui.StyleGreen.Render("Authenticated")
		}

		if !config.IsConnected() {
			panelContent := fmt.Sprintf(
				"Workspace State: %s\nAuthentication: %s\nGit Branch: %s\n\n%s",
				ui.StyleYellow.Render("Not Connected"),
				authStatus,
				getGitBranch(),
				ui.StyleMuted.Render("Run 'noir connect <code>' to link this repository to a Noir project."),
			)
			fmt.Println(ui.RenderPanel("Noir Connection Status", panelContent, ui.ColorWarning))
			return
		}

		cfgData, _ := config.ReadConfig()
		projData, _ := config.ReadProjectJSON()

		projectID := "Unknown"
		if id, ok := cfgData["project_id"].(string); ok {
			projectID = id
		}
		backendURL := config.DefaultBackend
		if b, ok := cfgData["backend"].(string); ok && b != "" {
			backendURL = b
		}

		title := "Connected Project"
		if t, ok := projData["title"].(string); ok && t != "" {
			title = t
		}

		profile, _ := projData["profile"].(map[string]interface{})
		framework := "Generic"
		language := "Python"
		runtime := "Unknown"
		pkgMgr := "npm"
		osInfo := "Linux"
		detectedAt := "Never"

		if profile != nil {
			if fw, ok := profile["framework"].(map[string]interface{}); ok {
				if n, ok := fw["name"].(string); ok && n != "" {
					framework = n
				}
				if l, ok := fw["language"].(string); ok && l != "" {
					language = l
				}
			} else if fn, ok := profile["framework_name"].(string); ok && fn != "" {
				framework = fn
			}
			if l, ok := profile["language"].(string); ok && l != "" {
				language = l
			}
			if r, ok := profile["runtime_version"].(string); ok && r != "" {
				runtime = r
			}
			if p, ok := profile["package_manager"].(string); ok && p != "" {
				pkgMgr = p
			}
			if o, ok := profile["operating_system"].(string); ok && o != "" {
				osInfo = o
			}
			if d, ok := profile["detected_at"].(string); ok && d != "" {
				detectedAt = d
			}
		}

		table := &ui.SimpleTable{
			Title:   fmt.Sprintf("Noir Active Connection — Project: %s", projectID),
			Headers: []string{"Property", "Status / Value"},
			Rows: [][]string{
				{ui.StyleCyan.Bold(true).Render("Connection Code / ID"), projectID},
				{ui.StyleCyan.Bold(true).Render("Project Title"), title},
				{ui.StyleCyan.Bold(true).Render("Backend URL"), backendURL},
				{ui.StyleCyan.Bold(true).Render("Auth Session"), authStatus},
				{ui.StyleCyan.Bold(true).Render("Git Branch"), getGitBranch()},
				{ui.StyleCyan.Bold(true).Render("Detected Framework"), framework},
				{ui.StyleCyan.Bold(true).Render("Language Stack"), language},
				{ui.StyleCyan.Bold(true).Render("Runtime Version"), runtime},
				{ui.StyleCyan.Bold(true).Render("Package Manager"), pkgMgr},
				{ui.StyleCyan.Bold(true).Render("Operating System"), osInfo},
				{ui.StyleCyan.Bold(true).Render("Last Profile Sync"), detectedAt},
			},
		}

		fmt.Println(table.Render())
	},
}
