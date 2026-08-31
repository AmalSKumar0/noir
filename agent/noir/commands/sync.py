import json
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.lynx_engine import profile_project
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Force an instant Lynx scan and sync workspace profile to backend."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def sync(
    path: str = typer.Option(".", help="Project directory path to sync with Lynx scanner.")
):
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Synchronizing Noir Project Telemetry & Profile...[/bold violet]\n")

    if not NOIR_DIR.exists() or not (NOIR_DIR / "config.json").exists():
        print("[red]Error: Project is not connected. Please run 'noir connect <code>' first.[/red]")
        raise typer.Exit(1)

    if not has_tokens():
        print("[red]Error: Authentication credentials not found. Please run 'noir login' first.[/red]")
        raise typer.Exit(1)

    try:
        config_data = json.loads((NOIR_DIR / "config.json").read_text(encoding="utf-8"))
        code = config_data.get("project_id")
    except Exception:
        print("[red]Failed to read project connection code from .noir/config.json[/red]")
        raise typer.Exit(1)

    client = ApiClient()

    print(f"[bold yellow]Scanning project workspace with Lynx engine...[/bold yellow]")
    try:
        profile_data = profile_project(path)
    except Exception as e:
        print(f"[red]Lynx profiler error: {e}[/red]")
        raise typer.Exit(1)

    print(f"[bold yellow]Pushing updated profile to Noir backend for project '[cyan]{code}[/cyan]'...[/bold yellow]")
    try:
        response = client.send_request_to_backend(
            f"/project/{code}/profile/",
            "POST",
            data={
                "framework_name": profile_data.get("framework_name"),
                "language": profile_data.get("language"),
                "runtime_version": profile_data.get("runtime_version"),
                "package_manager": profile_data.get("package_manager"),
                "operating_system": profile_data.get("operating_system"),
            }
        )

        project_file = NOIR_DIR / "project.json"
        if project_file.exists():
            try:
                p_data = json.loads(project_file.read_text(encoding="utf-8"))
                if isinstance(response, dict) and "profile" in response:
                    p_data["profile"] = response["profile"]
                    project_file.write_text(json.dumps(p_data, indent=4), encoding="utf-8")
            except Exception:
                pass

        table = Table(title="[bold green]Lynx Synced Profile[/bold green]", border_style="violet")
        table.add_column("Property", style="bold cyan")
        table.add_column("Synced Value", style="white")

        table.add_row("Framework", profile_data.get("framework_name", "Generic"))
        table.add_row("Primary Language", profile_data.get("language", "Python"))
        table.add_row("Runtime Version", profile_data.get("runtime_version", "Unknown"))
        table.add_row("Package Manager", profile_data.get("package_manager", "npm"))
        table.add_row("Operating System", profile_data.get("operating_system", "Linux"))

        print()
        print(table)
        print("\n[bold green]✔ Project profile successfully synced to Noir backend![/bold green]\n")

    except Exception as e:
        print(f"[red]Profile sync failed: {e}[/red]")
        raise typer.Exit(1)
