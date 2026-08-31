from pathlib import Path
from noir.utils.CommandDisplay import CommandDisplay
from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.lynx_engine import profile_project
from rich import print
import shutil

import typer
import json

app = typer.Typer(
    help="Initialize Noir in the current project."
)

NOIR_DIR = Path(".noir")

def create_dir(name: str) -> Path:
    path = NOIR_DIR / name
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path

@app.callback(invoke_without_command=True)
def init(code: str):

    text = CommandDisplay()
    text.print_banner()

    if NOIR_DIR.exists():
        print("[yellow]Noir is already initialized in this project.[/yellow]")
        raise typer.Exit()

    try:    
        client = ApiClient()
        response = client.send_request_to_backend(
            f"/project/connection-id/{code}/",
            "GET"
        )
    
    except Exception as e:
        typer.echo(f"Initialization failed: {e}")
        raise typer.Exit(1)

    try:
        NOIR_DIR.mkdir()
        cache = create_dir("cache")
        create_dir("reports")
        log_dir = create_dir("logs")
        create_dir("temp")

        config = NOIR_DIR / "config.json"
        config.write_text(
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

        project_file = NOIR_DIR / "project.json"
        project_file.write_text(json.dumps(response, indent=4), encoding="utf-8")

        analysis = cache / "analysis.json"
        repository = cache / "repository.json"
        log = log_dir / "noir.log"

        analysis.touch()
        repository.touch()
        log.touch()

        # Run Lynx engine profile scan and sync profile to backend
        try:
            profile_data = profile_project(".")
            client.send_request_to_backend(
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
            print("[cyan]✔ Project profile updated automatically via Lynx profiler.[/cyan]")
        except Exception as pe:
            print(f"[yellow]Note: Profile sync skipped ({pe})[/yellow]")

    except Exception as e:
        if NOIR_DIR.exists():
            shutil.rmtree(NOIR_DIR)
        typer.echo("Noir encountered an error initializing your project.")
        raise typer.Exit(code=1)

    print("[green]Noir initialized successfully![/green]")