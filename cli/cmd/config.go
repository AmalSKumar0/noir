package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"noir-cli/internal/config"
	"noir-cli/internal/ui"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage local .noir/config.json workspace settings.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		if !config.IsConnected() {
			fmt.Println(ui.StyleYellow.Render("No local .noir/config.json configuration found. Connect to a project first."))
			return
		}

		cfgData, err := config.ReadConfig()
		if err != nil || len(cfgData) == 0 {
			fmt.Println(ui.StyleYellow.Render("Workspace configuration is empty."))
			return
		}

		table := &ui.SimpleTable{
			Title:   "Noir Workspace Configuration",
			Headers: []string{"Setting Key", "Value"},
		}

		for k, v := range cfgData {
			table.Rows = append(table.Rows, []string{
				ui.StyleCyan.Bold(true).Render(k),
				fmt.Sprintf("%v", v),
			})
		}

		fmt.Println(table.Render())
	},
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get configuration value for key.",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		cfgData, err := config.ReadConfig()
		if err == nil {
			if val, ok := cfgData[key]; ok {
				fmt.Printf("%s = %s\n", ui.StyleCyan.Render(key), ui.StyleGreen.Render(fmt.Sprintf("%v", val)))
				return
			}
		}
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Key '%s' not found in configuration.", key)))
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set configuration value for key.",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := args[1]

		cfgData, err := config.ReadConfig()
		if err != nil || cfgData == nil {
			cfgData = make(map[string]interface{})
		}
		cfgData[key] = value

		if err := config.WriteConfig(cfgData); err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Failed to write config: %v", err)))
			return
		}

		fmt.Printf("%s %s = %s\n", ui.StyleSuccess.Render("✔ Updated configuration:"), ui.StyleCyan.Render(key), ui.StyleWhite.Render(value))
	},
}

func init() {
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configSetCmd)
}
