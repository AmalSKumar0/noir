package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/config"
	"noir-cli/internal/detector"
	"noir-cli/internal/lynx"
	"noir-cli/internal/ui"
)

var analyzePath string

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze workspace architecture, tech stack, and static reliability.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Printf("%s\n\n", ui.StyleViolet.Bold(true).Render("Running Noir Static Code & Architecture Analysis..."))

		target, err := filepath.Abs(analyzePath)
		if err != nil {
			target = analyzePath
		}
		fmt.Printf("%s %s\n", ui.StyleYellow.Bold(true).Render("Analyzing directory:"), ui.StyleCyan.Render(target))

		profileData, err := lynx.ProfileProject(target)
		if err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Error during Lynx analysis: %v", err)))
			os.Exit(1)
		}

		code := config.GetProjectID()

		fmt.Println(ui.StyleYellow.Bold(true).Render("Discovering Docker containers & Compose services..."))
		containers := detector.DiscoverProjectContainers(target, code)

		rawResults := profileData.RawResults
		var frameworkList []string
		for fw := range rawResults.Frameworks {
			frameworkList = append(frameworkList, fw)
		}
		var libraryList []string
		for lib := range rawResults.Libraries {
			libraryList = append(libraryList, lib)
		}
		var toolList []string
		for tool := range rawResults.Tools {
			toolList = append(toolList, tool)
		}

		analysisPayload := map[string]interface{}{
			"profile":           profileData,
			"docker_containers": containers,
			"summary": map[string]interface{}{
				"primary_languages":   rawResults.Language.Primary,
				"detected_frameworks": frameworkList,
				"detected_libraries":  libraryList,
				"detected_tools":      toolList,
			},
		}

		if config.IsConnected() {
			cacheDir := filepath.Join(config.GetNoirDir(), config.CacheDirName)
			_ = os.MkdirAll(cacheDir, 0755)
			aBytes, _ := json.MarshalIndent(analysisPayload, "", "    ")
			_ = os.WriteFile(filepath.Join(cacheDir, "analysis.json"), aBytes, 0644)

			cBytes, _ := json.MarshalIndent(containers, "", "    ")
			_ = os.WriteFile(filepath.Join(cacheDir, "containers.json"), cBytes, 0644)

			fmt.Println(ui.StyleCyan.Render("✔ Analysis results cached in .noir/cache/analysis.json"))
		}

		if code != "" && auth.HasTokens() {
			client := api.NewClient()
			_, _ = client.SendRequest(fmt.Sprintf("/project/%s/stream-logs/", code), "POST", map[string]interface{}{
				"log":    "[Analysis] Running Lynx AST & Architecture Inspection...",
				"stream": "stdout",
				"event":  "analysis_start",
			})

			_, _ = client.SendRequest(fmt.Sprintf("/project/%s/profile/", code), "POST", map[string]interface{}{
				"framework_name":   profileData.FrameworkName,
				"language":         profileData.Language,
				"runtime_version":  profileData.RuntimeVersion,
				"package_manager":  profileData.PackageManager,
				"operating_system": profileData.OperatingSystem,
				"docker_containers": containers,
				"analysis_data":    analysisPayload,
			})

			_, _ = client.SendRequest(fmt.Sprintf("/project/%s/stream-logs/", code), "POST", map[string]interface{}{
				"log":    "[Analysis] Lynx AST inspection complete.",
				"stream": "stdout",
				"event":  "analysis_end",
			})
			fmt.Println(ui.StyleCyan.Render("✔ Architecture analysis & Docker containers recorded to backend database."))
		}

		var libsDisplay string
		if len(libraryList) > 5 {
			libsDisplay = strings.Join(libraryList[:5], ", ")
		} else {
			libsDisplay = strings.Join(libraryList, ", ")
		}
		if libsDisplay == "" {
			libsDisplay = "None"
		}

		toolsDisplay := strings.Join(toolList, ", ")
		if toolsDisplay == "" {
			toolsDisplay = "Standard"
		}

		table := &ui.SimpleTable{
			Title:   "Noir Architecture & Stack Analysis",
			Headers: []string{"Category", "Detected Details"},
			Rows: [][]string{
				{ui.StyleCyan.Bold(true).Render("Framework"), profileData.FrameworkName},
				{ui.StyleCyan.Bold(true).Render("Primary Language"), profileData.Language},
				{ui.StyleCyan.Bold(true).Render("Runtime Version"), profileData.RuntimeVersion},
				{ui.StyleCyan.Bold(true).Render("Package Manager"), profileData.PackageManager},
				{ui.StyleCyan.Bold(true).Render("Operating System"), profileData.OperatingSystem},
				{ui.StyleCyan.Bold(true).Render("Detected Libraries"), libsDisplay},
				{ui.StyleCyan.Bold(true).Render("Dev & Build Tools"), toolsDisplay},
			},
		}

		fmt.Println()
		fmt.Println(table.Render())
		fmt.Println()

		if len(containers) > 0 {
			fmt.Println(detector.FormatContainersTable(containers))
		} else {
			fmt.Println(ui.StyleYellow.Render("No Docker containers or compose services detected for this workspace."))
		}

		fmt.Println(ui.StyleSuccess.Render("\n✔ Noir analysis completed successfully!\n"))
	},
}

func init() {
	analyzeCmd.Flags().StringVarP(&analyzePath, "path", "p", ".", "Directory path to analyze.")
}
