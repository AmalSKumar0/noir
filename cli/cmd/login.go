package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"noir-cli/internal/api"
	"noir-cli/internal/auth"
	"noir-cli/internal/ui"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate Noir developer session.",
	Run:   runEmailLogin,
}

var loginGithubCmd = &cobra.Command{
	Use:   "github",
	Short: "Authenticate with GitHub OAuth in browser.",
	Run: func(cmd *cobra.Command, args []string) {
		handleOAuthLogin("github", "GitHub")
	},
}

var loginGoogleCmd = &cobra.Command{
	Use:   "google",
	Short: "Authenticate with Google OAuth in browser.",
	Run: func(cmd *cobra.Command, args []string) {
		handleOAuthLogin("google", "Google")
	},
}

func init() {
	loginCmd.AddCommand(loginGithubCmd)
	loginCmd.AddCommand(loginGoogleCmd)
}

func runEmailLogin(cmd *cobra.Command, args []string) {
	ui.PrintBanner()

	if auth.HasTokens() {
		fmt.Printf("%s\n\n", ui.StyleYellow.Render("Notice: Already authenticated. Re-authenticating will replace current session."))
	}

	reader := bufio.NewReader(os.Stdin)

	var email string
	for {
		fmt.Printf("%s: ", ui.StyleCyan.Render("Enter Email"))
		input, _ := reader.ReadString('\n')
		email = strings.TrimSpace(input)
		if strings.Contains(email, "@") && strings.Contains(email, ".") {
			break
		}
		fmt.Println(ui.StyleDanger.Render("Invalid email format. Please enter a valid email address."))
	}

	var password string
	for {
		fmt.Printf("%s: ", ui.StyleCyan.Render("Enter Password"))
		bytePassword, err := term.ReadPassword(int(syscall.Stdin))
		fmt.Println()
		if err != nil {
			fmt.Println(ui.StyleDanger.Render("Error reading password."))
			os.Exit(1)
		}
		password = strings.TrimSpace(string(bytePassword))
		if password == "" {
			fmt.Println(ui.StyleDanger.Render("Password cannot be empty."))
		} else if len(password) < 6 {
			fmt.Println(ui.StyleDanger.Render("Password must be at least 6 characters."))
		} else {
			break
		}
	}

	client := api.NewClient()
	tokens, err := client.Login(email, password)
	if err != nil {
		fmt.Println(ui.StyleDanger.Render(fmt.Sprintf("\n✖ Authentication failed: Invalid email or password (%v)\n", err)))
		os.Exit(1)
	}

	_ = auth.SaveToken(tokens)
	fmt.Println(ui.StyleSuccess.Render("\n✔ Authenticated successfully! Credentials stored securely.\n"))
}

func handleOAuthLogin(provider, displayName string) {
	ui.PrintBanner()

	if auth.HasTokens() {
		fmt.Printf("%s\n\n", ui.StyleYellow.Render(fmt.Sprintf("Notice: Already authenticated. Re-authenticating with %s will replace current session.", displayName)))
	}

	client := api.NewClient()
	oauthURL := client.GetOAuthURL(provider)
	server := api.NewOAuthServer(client)

	fmt.Printf("%s\n", ui.StyleCyan.Render(fmt.Sprintf("Initiating %s OAuth authentication...", displayName)))
	fmt.Println(ui.StyleMuted.Render("If browser does not open automatically, visit:"))
	fmt.Printf("%s\n\n", ui.StyleCyan.Underline(true).Render(oauthURL))

	_ = api.OpenBrowser(oauthURL)

	fmt.Println(ui.StyleMuted.Render("Waiting for authentication callback on http://127.0.0.1:53145/auth/callback (press Ctrl+C to cancel)..."))

	authData, err := server.Start(120 * time.Second)
	if err != nil {
		fmt.Printf("\n%s\n\n", ui.StyleDanger.Render(fmt.Sprintf("✖ Authentication failed: %v", err)))
		os.Exit(1)
	}

	username := "Developer"
	if user, ok := authData["user"].(map[string]interface{}); ok {
		if u, ok := user["username"].(string); ok && u != "" {
			username = u
		} else if e, ok := user["email"].(string); ok && e != "" {
			username = e
		}
	}

	fmt.Printf("\n%s\n\n", ui.StyleSuccess.Render(fmt.Sprintf("✔ Authenticated successfully via %s as '%s'! Credentials stored securely.", displayName, username)))
}
