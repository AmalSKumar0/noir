package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"noir-cli/internal/config"
	"noir-cli/internal/ui"
)

var disconnectCmd = &cobra.Command{
	Use:   "disconnect",
	Short: "Disconnect from the Noir backend.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		if !config.IsConnected() {
			fmt.Println(ui.StyleYellow.Render("Noir is not currently connected to any project."))
			return
		}

		if err := config.RemoveWorkspace(); err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Error disconnecting: %v", err)))
			return
		}

		fmt.Println(ui.StyleSuccess.Render("✔ Noir disconnected successfully! Removed local .noir workspace configuration."))
	},
}
