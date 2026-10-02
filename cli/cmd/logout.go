package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/ui"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout and clear stored Noir authentication tokens.",
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()

		if !auth.HasTokens() {
			fmt.Println(ui.StyleYellow.Render("No active authentication session found."))
			return
		}

		client := api.NewClient()
		refreshToken := auth.GetRefreshToken()
		if refreshToken != "" {
			_, _ = client.SendRequest("/accounts/logout/", "POST", map[string]string{"refresh": refreshToken})
		}

		auth.DeleteToken()
		fmt.Println(ui.StyleSuccess.Render("✔ Logged out successfully. Local authentication credentials cleared.\n"))
	},
}
