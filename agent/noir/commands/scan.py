import json
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.lynx_engine import profile_project
from noir.utils.CommandDisplay import CommandDisplay
from noir.utils.docker_detector import discover_project_containers, format_containers_table

app = typer.Typer(
    help="Scan workspace technologies, runtime stack, and detect project Docker containers."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def scan(
    path: str = typer.Option(".", help="Workspace directory path to scan.")
):
    text = CommandDisplay()
    text.print_banner()

    target = Path(path).resolve()
    print(f"\n[bold violet]Scanning workspace directory:[bold violet] [cyan]{target}[/cyan]\n")

    # 1. Run Lynx profiler on workspace
    print("[bold yellow]Scanning project workspace with Lynx engine...[/bold yellow]")
    try:
        profile_data = profile_project(target)
    except Exception as e:
        print(f"[yellow]Lynx profiler notice: {e}. Falling back to default detection.[/yellow]")
        profile_data = {
            "framework_name": "Generic",
            "language": "Python",
            "runtime_version": "Unknown",
            "package_manager": "npm",
            "operating_system": "Linux"
        }

    # 2. Check if project is connected locally to get project code
    code = ""
    if NOIR_DIR.exists() and (NOIR_DIR / "config.json").exists():
        try:
            config_data = json.loads((NOIR_DIR / "config.json").read_text(encoding="utf-8"))
            code = config_data.get("project_id", "")
        except Exception:
            pass

    # 3. Discover Docker containers
    print("[bold yellow]Discovering Docker containers & Compose services...[/bold yellow]")
    try:
        containers = discover_project_containers(target, project_code=code)
    except Exception as de:
        print(f"[yellow]Container discovery notice: {de}[/yellow]")
        containers = []

    # 4. Display summary tables
    profile_table = Table(title="[bold green]Lynx System Profile[/bold green]", border_style="violet")
    profile_table.add_column("Property", style="bold cyan")
    profile_table.add_column("Detected Value", style="white")

    profile_table.add_row("Framework", profile_data.get("framework_name", "Generic"))
    profile_table.add_row("Primary Language", profile_data.get("language", "Python"))
    profile_table.add_row("Runtime Version", profile_data.get("runtime_version", "Unknown"))
    profile_table.add_row("Package Manager", profile_data.get("package_manager", "npm"))
    profile_table.add_row("Operating System", profile_data.get("operating_system", "Linux"))

    print()
    print(profile_table)

    print()
    if containers:
        container_table = format_containers_table(containers)
        print(container_table)
    else:
        print("[yellow]No Docker containers or compose services detected for this workspace.[/yellow]")

    # 5. Cache locally if .noir exists
    if NOIR_DIR.exists():
        try:
            cache_dir = NOIR_DIR / "cache"
            cache_dir.mkdir(parents=True, exist_ok=True)
            (cache_dir / "containers.json").write_text(json.dumps(containers, indent=4), encoding="utf-8")
        except Exception:
            pass

    # 6. Push to backend if connected
    if code and has_tokens():
        print(f"\n[bold yellow]Syncing scan results & Docker containers to Noir backend for '[cyan]{code}[/cyan]'...[/bold yellow]")
        try:
            client = ApiClient()
            client.send_request_to_backend(
                f"/project/{code}/profile/",
                "POST",
                data={
                    "framework_name": profile_data.get("framework_name"),
                    "language": profile_data.get("language"),
                    "runtime_version": profile_data.get("runtime_version"),
                    "package_manager": profile_data.get("package_manager"),
                    "operating_system": profile_data.get("operating_system"),
                    "docker_containers": containers,
                }
            )
            print("[bold green]✔ Workspace profile & Docker containers successfully synced to Noir cloud![/bold green]\n")
        except Exception as se:
            print(f"[yellow]Note: Local scan complete, but cloud sync skipped ({se})[/yellow]\n")
    else:
        if not code:
            print("\n[dim]Note: Workspace not linked to Noir cloud project. Run 'noir connect <code>' to link and sync.[/dim]\n")

    print("[bold green]✔ Noir scan complete![/bold green]\n")
