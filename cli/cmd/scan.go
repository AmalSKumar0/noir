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

var scanPath string

var scanCmd = &cobra.Command{
	Use:   "scan",
	Short: "Scan workspace technologies, runtime stack, and detect project Docker containers.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		target, err := filepath.Abs(scanPath)
		if err != nil {
			target = scanPath
		}
		fmt.Printf("\n%s %s\n\n", ui.StyleViolet.Bold(true).Render("Scanning workspace directory:"), ui.StyleCyan.Render(target))

		fmt.Println(ui.StyleYellow.Bold(true).Render("Scanning project workspace with Lynx engine..."))
		profileData, err := lynx.ProfileProject(target)
		if err != nil {
			fmt.Printf("%s\n", ui.StyleYellow.Render(fmt.Sprintf("Lynx profiler notice: %v. Falling back to default detection.", err)))
			profileData = &lynx.ProjectProfile{
				FrameworkName:   "Generic",
				Language:        "Python",
				RuntimeVersion:  "Unknown",
				PackageManager:  "npm",
				OperatingSystem: "Linux",
			}
		}

		code := config.GetProjectID()

		fmt.Println(ui.StyleYellow.Bold(true).Render("Discovering Docker containers & Compose services..."))
		containers := detector.DiscoverProjectContainers(target, code)

		profileTable := &ui.SimpleTable{
			Title:   "Lynx System Profile",
			Headers: []string{"Property", "Detected Value"},
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

		if config.IsConnected() {
			cacheDir := filepath.Join(config.GetNoirDir(), config.CacheDirName)
			_ = os.MkdirAll(cacheDir, 0755)
			cBytes, _ := json.MarshalIndent(containers, "", "    ")
			_ = os.WriteFile(filepath.Join(cacheDir, "containers.json"), cBytes, 0644)
		}

		if code != "" && auth.HasTokens() {
			fmt.Printf("\n%s\n", ui.StyleYellow.Bold(true).Render(fmt.Sprintf("Syncing scan results & Docker containers to Noir backend for '%s'...", code)))
			client := api.NewClient()
			_, syncErr := client.SendRequest(fmt.Sprintf("/project/%s/profile/", code), "POST", map[string]interface{}{
				"framework_name":   profileData.FrameworkName,
				"language":         profileData.Language,
				"runtime_version":  profileData.RuntimeVersion,
				"package_manager":  profileData.PackageManager,
				"operating_system": profileData.OperatingSystem,
				"docker_containers": containers,
			})
			if syncErr == nil {
				fmt.Println(ui.StyleSuccess.Render("✔ Workspace profile & Docker containers successfully synced to Noir cloud!\n"))
			} else {
				fmt.Printf("%s\n\n", ui.StyleYellow.Render(fmt.Sprintf("Note: Local scan complete, but cloud sync skipped (%v)", syncErr)))
			}
		} else if code == "" {
			fmt.Printf("\n%s\n\n", ui.StyleMuted.Render("Note: Workspace not linked to Noir cloud project. Run 'noir connect <code>' to link and sync."))
		}

		fmt.Println(ui.StyleSuccess.Render("✔ Noir scan complete!\n"))
	},
}

func init() {
	scanCmd.Flags().StringVarP(&scanPath, "path", "p", ".", "Workspace directory path to scan.")
}
