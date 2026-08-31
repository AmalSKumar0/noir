import json
import shutil
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.lynx_engine import profile_project
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Connect to a project on the Noir backend."
)

NOIR_DIR = Path(".noir")


def create_dir(name: str) -> Path:
    path = NOIR_DIR / name
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path


@app.callback(invoke_without_command=True)
def connect(
    code: str = typer.Argument(..., help="The Connection Code or Project ID to connect to."),
    path: str = typer.Option(".", help="Project directory path to profile with Lynx scanner.")
):
    text = CommandDisplay()
    text.print_banner()

    print(f"\n[bold violet]Connecting to Noir project:[bold violet] [cyan]{code}[/cyan]")

    if not has_tokens():
        print("[red]Error: Authentication credentials not found. Please run 'noir login' first.[/red]")
        raise typer.Exit(1)

    client = ApiClient()

    # 1. Fetch project details from backend
    try:
        response = client.send_request_to_backend(
            f"/project/connection-id/{code}/",
            "GET"
        )
    except Exception as e:
        # Fallback to direct ID endpoint if connection-id lookup fails
        try:
            response = client.send_request_to_backend(
                f"/project/{code}/",
                "GET"
            )
        except Exception:
            print(f"[red]Connection failed: Project with code/ID '{code}' could not be found or accessed.[/red]")
            raise typer.Exit(1)

    # 2. Run Lynx profiler on workspace
    print("[bold yellow]Scanning project workspace with Lynx engine...[/bold yellow]")
    try:
        profile_data = profile_project(path)
    except Exception as e:
        print(f"[red]Warning: Lynx profiler error: {e}[/red]")
        profile_data = {
            "framework_name": "Generic",
            "language": "Python",
            "runtime_version": "Unknown",
            "package_manager": "npm",
            "operating_system": "Linux"
        }

    # 3. Setup local .noir directory
    try:
        NOIR_DIR.mkdir(exist_ok=True)
        cache = create_dir("cache")
        create_dir("reports")
        log_dir = create_dir("logs")
        create_dir("temp")

        config_file = NOIR_DIR / "config.json"
        config_file.write_text(
            json.dumps(
                {
                    "backend": client.base_url,
                    "project_id": code,
                    "version": 1,
                },
                indent=4,
            ),
            encoding="utf-8",
        )

        config_yaml = NOIR_DIR / "config.yaml"
        config_yaml.write_text(
            f"project_name: {code}\nbackend_url: {client.base_url}\ntest_runner: pytest\n"
        )

        project_file = NOIR_DIR / "project.json"
        project_file.write_text(json.dumps(response, indent=4), encoding="utf-8")

        analysis = cache / "analysis.json"
        repository = cache / "repository.json"
        log = log_dir / "noir.log"

        analysis.touch(exist_ok=True)
        repository.touch(exist_ok=True)
        log.touch(exist_ok=True)

    except Exception as e:
        print(f"[red]Failed to initialize local .noir directory: {e}[/red]")

    # 4. Post profile data to backend
    print(f"[bold yellow]Updating project profile on backend server...[/bold yellow]")
    try:
        profile_res = client.send_request_to_backend(
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

        # Update project.json if response has profile
        if isinstance(profile_res, dict) and "profile" in profile_res:
            response["profile"] = profile_res["profile"]
            (NOIR_DIR / "project.json").write_text(json.dumps(response, indent=4), encoding="utf-8")

    except Exception as e:
        print(f"[yellow]Note: Connected locally, but profile sync to backend encountered an issue: {e}[/yellow]")

    # 5. Display rich summary table
    table = Table(title="[bold green]Lynx Auto-Detected System Profile[/bold green]", border_style="violet")
    table.add_column("Property", style="bold cyan")
    table.add_column("Detected Value", style="white")

    table.add_row("Framework", profile_data.get("framework_name"))
    table.add_row("Primary Language", profile_data.get("language"))
    table.add_row("Runtime Version", profile_data.get("runtime_version"))
    table.add_row("Package Manager", profile_data.get("package_manager"))
    table.add_row("Operating System", profile_data.get("operating_system"))

    print(table)
    print(f"\n[bold green]✔ Noir connected successfully to project '{code}' & profile updated![/bold green]\n")
