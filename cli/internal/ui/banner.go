package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	// Colors
	ColorPrimary   = lipgloss.Color("#8b5cf6") // Violet
	ColorSecondary = lipgloss.Color("#06b6d4") // Cyan
	ColorSuccess   = lipgloss.Color("#10b981") // Green
	ColorWarning   = lipgloss.Color("#f59e0b") // Yellow
	ColorDanger    = lipgloss.Color("#ef4444") // Red
	ColorMuted     = lipgloss.Color("#71717a") // Dim Gray
	ColorHighlight = lipgloss.Color("#c4b5fd") // Light Violet

	// Styles
	StyleTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary)

	StyleBanner = lipgloss.NewStyle().
			Foreground(ColorSecondary).
			Bold(true)

	StyleSuccess = lipgloss.NewStyle().
			Foreground(ColorSuccess).
			Bold(true)

	StyleWarning = lipgloss.NewStyle().
			Foreground(ColorWarning).
			Bold(true)

	StyleDanger = lipgloss.NewStyle().
			Foreground(ColorDanger).
			Bold(true)

	StyleMuted = lipgloss.NewStyle().
			Foreground(ColorMuted)

	StyleCyan = lipgloss.NewStyle().
			Foreground(ColorSecondary)

	StyleViolet = lipgloss.NewStyle().
			Foreground(ColorPrimary)

	StyleYellow = lipgloss.NewStyle().
			Foreground(ColorWarning)

	StyleGreen = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	StyleWhite = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ffffff"))

	StyleBold = lipgloss.NewStyle().
			Bold(true)

	StylePanel = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorPrimary).
			Padding(1, 2)
)

const BannerText = `███╗   ██╗ ██████╗ ██╗██████╗ 
████╗  ██║██╔═══██╗██║██╔══██╗
██╔██╗ ██║██║   ██║██║██████╔╝
██║╚██╗██║██║   ██║██║██╔══██╗
██║ ╚████║╚██████╔╝██║██║  ██║███████╗
╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝
--AI-Powered Reliability Engineering--`

// PrintBanner outputs the stylized Noir ASCII logo to stdout.
func PrintBanner() {
	fmt.Println(StyleBanner.Render(BannerText))
}

// PrintWhoami prints user profile information.
func PrintWhoami(name, email string) {
	fmt.Printf("Who Am I:\n    Name  :%s\n    Email :%s\n", name, email)
}

// RenderPanel renders text enclosed in a stylish lipgloss panel.
func RenderPanel(title, content string, borderColor lipgloss.Color) string {
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(1, 2)

	header := lipgloss.NewStyle().Bold(true).Foreground(borderColor).Render(title)
	body := fmt.Sprintf("%s\n\n%s", header, content)
	return boxStyle.Render(body)
}

// Table helper for formatted console tables
type SimpleTable struct {
	Title   string
	Headers []string
	Rows    [][]string
}

func (t *SimpleTable) Render() string {
	if len(t.Headers) == 0 {
		return ""
	}

	colWidths := make([]int, len(t.Headers))
	for i, h := range t.Headers {
		colWidths[i] = len(stripAnsi(h))
	}
	for _, r := range t.Rows {
		for i, cell := range r {
			if i < len(colWidths) {
				w := len(stripAnsi(cell))
				if w > colWidths[i] {
					colWidths[i] = w
				}
			}
		}
	}

	var sb strings.Builder
	if t.Title != "" {
		sb.WriteString(StyleTitle.Render(fmt.Sprintf("━━━ %s ━━━", t.Title)) + "\n")
	}

	// Header row
	headerCells := make([]string, len(t.Headers))
	for i, h := range t.Headers {
		headerCells[i] = padRight(StyleCyan.Bold(true).Render(h), colWidths[i]+len(StyleCyan.Bold(true).Render(h))-len(stripAnsi(h)))
	}
	sb.WriteString(strings.Join(headerCells, "  ") + "\n")

	// Separator
	sepCells := make([]string, len(t.Headers))
	for i := range t.Headers {
		sepCells[i] = StyleMuted.Render(strings.Repeat("─", colWidths[i]))
	}
	sb.WriteString(strings.Join(sepCells, "  ") + "\n")

	// Data rows
	for _, row := range t.Rows {
		rowCells := make([]string, len(t.Headers))
		for i := range t.Headers {
			val := ""
			if i < len(row) {
				val = row[i]
			}
			rowCells[i] = padRight(val, colWidths[i]+len(val)-len(stripAnsi(val)))
		}
		sb.WriteString(strings.Join(rowCells, "  ") + "\n")
	}

	return sb.String()
}

func padRight(str string, length int) string {
	if len(str) >= length {
		return str
	}
	return str + strings.Repeat(" ", length-len(str))
}

func stripAnsi(str string) string {
	// Simple ANSI escape sequence stripper for accurate length measurement
	var b strings.Builder
	inEsc := false
	for _, r := range str {
		if r == '\x1b' {
			inEsc = true
			continue
		}
		if inEsc {
			if r == 'm' {
				inEsc = false
			}
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
