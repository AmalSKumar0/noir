package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/lynx"
	"noir-cli/internal/ui"
)

var connectPath string

var connectCmd = &cobra.Command{
	Use:   "connect <code/project_id>",
	Short: "Connect current repository to a Noir project.",
	Args:  cobra.ExactArgs(1),
	Run:   runConnect,
}

var initCmd = &cobra.Command{
	Use:   "init <code/project_id>",
	Short: "Connect current repository to a Noir project (alias for connect).",
	Args:  cobra.ExactArgs(1),
	Run:   runConnect,
}

func init() {
	connectCmd.Flags().StringVarP(&connectPath, "path", "p", ".", "Project directory path to profile with Lynx scanner.")
	initCmd.Flags().StringVarP(&connectPath, "path", "p", ".", "Project directory path to profile with Lynx scanner.")
}

func runConnect(cmd *cobra.Command, args []string) {
	code := args[0]

	ui.PrintBanner()
	fmt.Printf("\n%s %s\n\n", ui.StyleViolet.Bold(true).Render("Connecting to Noir project:"), ui.StyleCyan.Render(code))

	if !auth.HasTokens() {
		fmt.Println(ui.StyleDanger.Render("Error: Authentication credentials not found. Please run 'noir login' first."))
		os.Exit(1)
	}

	client := api.NewClient()

	// 1. Fetch project details from backend
	var projectData map[string]interface{}
	res, err := client.SendRequest(fmt.Sprintf("/project/connection-id/%s/", code), "GET", nil)
	if err != nil {
		res, err = client.SendRequest(fmt.Sprintf("/project/%s/", code), "GET", nil)
	}
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Connection failed: Project with code or ID '%s' could not be found or accessed: %v", code, err)))
		os.Exit(1)
	}
	if pMap, ok := res.(map[string]interface{}); ok {
		projectData = pMap
	} else {
		projectData = map[string]interface{}{"title": code}
	}

	// 2. Run Lynx profiler on workspace
	fmt.Println(ui.StyleYellow.Bold(true).Render("Scanning project workspace with Lynx engine..."))
	profileData, err := lynx.ProfileProject(connectPath)
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

	// 3. Discover Docker containers & Compose services
	fmt.Println(ui.StyleYellow.Bold(true).Render("Discovering Docker containers & Compose services..."))
	containers := detector.DiscoverProjectContainers(connectPath, code)

	// 4. Initialize local .noir directory
	if err := config.InitWorkspace(code, client.BaseHost, projectData, containers); err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Failed to initialize local .noir workspace: %v", err)))
		os.Exit(1)
	}

	// 5. Post profile data to backend
	fmt.Println(ui.StyleYellow.Bold(true).Render("Syncing workspace profile & Docker containers to Noir backend server..."))
	profilePayload := map[string]interface{}{
		"framework_name":   profileData.FrameworkName,
		"language":         profileData.Language,
		"runtime_version":  profileData.RuntimeVersion,
		"package_manager":  profileData.PackageManager,
		"operating_system": profileData.OperatingSystem,
		"docker_containers": containers,
	}

	profileRes, err := client.SendRequest(fmt.Sprintf("/project/%s/profile/", code), "POST", profilePayload)
	if err == nil {
		if pMap, ok := profileRes.(map[string]interface{}); ok {
			if prof, ok := pMap["profile"]; ok {
				projectData["profile"] = prof
				_ = config.WriteProjectJSON(projectData)
			}
		}
	} else {
		fmt.Printf("%s\n", ui.StyleYellow.Render(fmt.Sprintf("Note: Connected locally, but backend profile sync was skipped (%v)", err)))
	}

	// 6. Display summary tables
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

	fmt.Printf("\n%s\n\n", ui.StyleSuccess.Render(fmt.Sprintf("✔ Noir connected successfully to project '%s'!", code)))
}
