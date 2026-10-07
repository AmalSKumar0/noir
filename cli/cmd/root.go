package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"noir-cli/internal/ui"
)

var rootCmd = &cobra.Command{
	Use:     "noir",
	Version: "2.4.1",
	Short:   "Noir CLI - AI-powered reliability engineering agent.",
	Long:    `Noir CLI is an autonomous, AI-powered reliability engineering agent designed to run in developer local workspaces and CI/CD pipelines.`,
	Run: func(cmd *cobra.Command, args []string) {
		ui.PrintBanner()
		fmt.Println("\nRun \"noir --help\" to get started.")
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	// Add subcommands
	rootCmd.AddCommand(connectCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(disconnectCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(testCmd)
	rootCmd.AddCommand(scanCmd)
	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(doctorCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(runContainerCmd)
	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(whoamiCmd)
	rootCmd.AddCommand(logoutCmd)
	rootCmd.AddCommand(faultCmd)
}
