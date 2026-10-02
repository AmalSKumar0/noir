package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/ui"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Display current authenticated Noir user identity.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		if !auth.HasTokens() {
			fmt.Println(ui.StyleDanger.Render("Error: Authentication credentials not found. Run 'noir login' to authenticate."))
			os.Exit(1)
		}

		client := api.NewClient()
		data, err := client.SendRequest("/accounts/me/", "GET", nil)
		if err != nil {
			fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("Failed to retrieve user identity: %v", err)))
			os.Exit(1)
		}

		userMap, ok := data.(map[string]interface{})
		if !ok {
			fmt.Println(ui.StyleDanger.Render("Invalid user data response from server."))
			os.Exit(1)
		}

		name := ""
		if n, ok := userMap["name"].(string); ok && n != "" {
			name = n
		} else if u, ok := userMap["username"].(string); ok && u != "" {
			name = u
		}
		email := ""
		if e, ok := userMap["email"].(string); ok && e != "" {
			email = e
		}

		ui.PrintWhoami(name, email)
	},
}
