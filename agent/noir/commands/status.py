import json
import subprocess
from pathlib import Path
import typer
from rich import print
from rich.table import Table
from rich.panel import Panel

from noir.auth.storage import has_tokens
from noir.api.client import ApiClient
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Display connection status and telemetry health of current workspace."
)

NOIR_DIR = Path(".noir")


def get_git_branch() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return "Not a git repository"


@app.callback(invoke_without_command=True)
def status():
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Checking Noir CLI Workspace Status...[/bold violet]\n")

    auth_status = "[green]Authenticated[/green]" if has_tokens() else "[red]Not Authenticated[/red]"

    if not NOIR_DIR.exists():
        print(Panel(
            f"Workspace State: [yellow]Not Connected[/yellow]\n"
            f"Authentication: {auth_status}\n"
            f"Git Branch: {get_git_branch()}\n\n"
            f"[dim]Run 'noir connect <code>' to link this repository to a Noir project.[/dim]",
            title="[bold yellow]Noir Connection Status[/bold yellow]",
            border_style="yellow"
        ))
        return

    config_file = NOIR_DIR / "config.json"
    project_file = NOIR_DIR / "project.json"

    config_data = {}
    if config_file.exists():
        try:
            config_data = json.loads(config_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    project_data = {}
    if project_file.exists():
        try:
            project_data = json.loads(project_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    project_id = config_data.get("project_id", "Unknown")
    backend_url = config_data.get("backend", "http://127.0.0.1:8000/")

    profile = project_data.get("profile", {}) or {}
    framework = profile.get("framework", {}).get("name", "Generic")
    language = profile.get("framework", {}).get("language", "Python")
    runtime = profile.get("runtime_version", "Unknown")
    pkg_mgr = profile.get("package_manager", "npm")
    os_info = profile.get("operating_system", "Linux")
    detected_at = profile.get("detected_at", "Never")

    table = Table(title=f"[bold green]Noir Active Connection — Project: {project_id}[/bold green]", border_style="violet")
    table.add_column("Property", style="bold cyan")
    table.add_column("Status / Value", style="white")

    table.add_row("Connection Code / ID", str(project_id))
    table.add_row("Project Title", project_data.get("title", "Connected Project"))
    table.add_row("Backend URL", backend_url)
    table.add_row("Auth Session", auth_status)
    table.add_row("Git Branch", get_git_branch())
    table.add_row("Detected Framework", framework)
    table.add_row("Language Stack", language)
    table.add_row("Runtime Version", runtime)
    table.add_row("Package Manager", pkg_mgr)
    table.add_row("Operating System", os_info)
    table.add_row("Last Profile Sync", detected_at)

    print(table)
