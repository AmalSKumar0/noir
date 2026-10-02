package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/lynx"
	"noir-cli/internal/ui"
)

var syncPath string

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Force an instant Lynx scan and sync workspace profile to backend.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Synchronizing Noir Project Telemetry & Profile..."))

		if !config.IsConnected() {
			fmt.Println(ui.StyleDanger.Render("Error: Project is not connected. Please run 'noir connect <code>' first."))
			os.Exit(1)
		}

		if !auth.HasTokens() {
			fmt.Println(ui.StyleDanger.Render("Error: Authentication credentials not found. Please run 'noir login' first."))
			os.Exit(1)
		}

		code := config.GetProjectID()
		if code == "" {
			fmt.Println(ui.StyleDanger.Render("Failed to read project connection code from .noir/config.json"))
			os.Exit(1)
		}

		client := api.NewClient()

		fmt.Println(ui.StyleYellow.Bold(true).Render("Scanning project workspace with Lynx engine..."))
		profileData, err := lynx.ProfileProject(syncPath)
		if err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Lynx profiler error: %v", err)))
			os.Exit(1)
		}

		fmt.Println(ui.StyleYellow.Bold(true).Render("Discovering Docker containers & Compose services..."))
		containers := detector.DiscoverProjectContainers(syncPath, code)

		fmt.Printf("%s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Pushing updated profile & Docker containers to Noir backend for project '%s'...", code)))
		response, err := client.SendRequest(fmt.Sprintf("/project/%s/profile/", code), "POST", map[string]interface{}{
			"framework_name":   profileData.FrameworkName,
			"language":         profileData.Language,
			"runtime_version":  profileData.RuntimeVersion,
			"package_manager":  profileData.PackageManager,
			"operating_system": profileData.OperatingSystem,
			"docker_containers": containers,
		})
		if err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Profile sync failed: %v", err)))
			os.Exit(1)
		}

		if pData, err := config.ReadProjectJSON(); err == nil && pData != nil {
			if rMap, ok := response.(map[string]interface{}); ok {
				if prof, ok := rMap["profile"]; ok {
					pData["profile"] = prof
					_ = config.WriteProjectJSON(pData)
				}
			}
		}

		cacheDir := filepath.Join(config.GetNoirDir(), config.CacheDirName)
		_ = os.MkdirAll(cacheDir, 0755)
		cBytes, _ := json.MarshalIndent(containers, "", "    ")
		_ = os.WriteFile(filepath.Join(cacheDir, "containers.json"), cBytes, 0644)

		profileTable := &ui.SimpleTable{
			Title:   "Lynx Synced Profile",
			Headers: []string{"Property", "Synced Value"},
			Rows: [][]string{
				{ui.StyleCyan.Bold(true).Render("Framework"), profileData.FrameworkName},
				{ui.StyleCyan.Bold(true).Render("Primary Language"), profileData.Language},
				{ui.StyleCyan.Bold(true).Render("Runtime Version"), profileData.RuntimeVersion},
				{ui.StyleCyan.Bold(true).Render("Package Manager"), profileData.PackageManager},
				{ui.StyleCyan.Bold(true).Render("Operating System"), profileData.OperatingSystem},
			},
		}

		fmt.Println()
		fmt.Println(profileTable.Render())
		fmt.Println()

		if len(containers) > 0 {
			fmt.Println(detector.FormatContainersTable(containers))
		} else {
			fmt.Println(ui.StyleYellow.Render("No Docker containers or compose services detected for this workspace."))
		}

		fmt.Println(ui.StyleSuccess.Render("\n✔ Project profile & Docker containers successfully synced to Noir backend!\n"))
	},
}

func init() {
	syncCmd.Flags().StringVarP(&syncPath, "path", "p", ".", "Project directory path to sync with Lynx scanner.")
}
