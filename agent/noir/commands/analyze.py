import os
import json
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.lynx_engine import profile_project
from noir.utils.CommandDisplay import CommandDisplay
from noir.api.client import ApiClient
from noir.auth.storage import has_tokens

app = typer.Typer(
    help="Analyze workspace architecture, tech stack, and static reliability."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def analyze(
    path: str = typer.Option(".", help="Directory path to analyze.")
):
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Running Noir Static Code & Architecture Analysis...[/bold violet]\n")

    target = Path(path).resolve()
    print(f"[bold yellow]Analyzing directory:[bold yellow] [cyan]{target}[/cyan]")

    try:
        profile_data = profile_project(target)
    except Exception as e:
        print(f"[red]Error during Lynx analysis: {e}[/red]")
        raise typer.Exit(1)

    raw_results = profile_data.get("raw_results", {})
    languages = raw_results.get("language", {})
    frameworks = raw_results.get("frameworks", {})
    libraries = raw_results.get("libraries", {})
    tools = raw_results.get("tools", {})

    analysis_payload = {
        "profile": profile_data,
        "summary": {
            "primary_languages": languages.get("primary", []),
            "detected_frameworks": list(frameworks.keys()),
            "detected_libraries": list(libraries.keys()),
            "detected_tools": list(tools.keys()),
        }
    }

    if NOIR_DIR.exists():
        cache_dir = NOIR_DIR / "cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "analysis.json").write_text(
            json.dumps(analysis_payload, indent=4),
            encoding="utf-8"
        )
        print("[cyan]✔ Analysis results cached in .noir/cache/analysis.json[/cyan]")

    # Record analysis telemetry to backend database if connected
    if NOIR_DIR.exists() and (NOIR_DIR / "config.json").exists() and has_tokens():
        try:
            config_data = json.loads((NOIR_DIR / "config.json").read_text(encoding="utf-8"))
            code = config_data.get("project_id")
            if code:
                client = ApiClient()
                client.send_request_to_backend(
                    f"/project/{code}/stream-logs/",
                    "POST",
                    data={
                        "log": "[Analysis] Running Lynx AST & Architecture Inspection...",
                        "stream": "stdout",
                        "event": "analysis_start"
                    }
                )
                client.send_request_to_backend(
                    f"/project/{code}/profile/",
                    "POST",
                    data={
                        "framework_name": profile_data.get("framework_name"),
                        "language": profile_data.get("language"),
                        "runtime_version": profile_data.get("runtime_version"),
                        "package_manager": profile_data.get("package_manager"),
                        "operating_system": profile_data.get("operating_system"),
                        "analysis_data": analysis_payload,
                    }
                )
                client.send_request_to_backend(
                    f"/project/{code}/stream-logs/",
                    "POST",
                    data={
                        "log": "[Analysis] Lynx AST inspection complete.",
                        "stream": "stdout",
                        "event": "analysis_end"
                    }
                )
                print("[cyan]✔ Architecture analysis recorded to backend database.[/cyan]")
        except Exception as pe:
            print(f"[yellow]Note: Local analysis complete, but backend recording skipped ({pe})[/yellow]")

    # Display analysis report table
    table = Table(title="[bold green]Noir Architecture & Stack Analysis[/bold green]", border_style="violet")
    table.add_column("Category", style="bold cyan")
    table.add_column("Detected Details", style="white")

    table.add_row("Framework", profile_data.get("framework_name", "Generic"))
    table.add_row("Primary Language", profile_data.get("language", "Python"))
    table.add_row("Runtime Version", profile_data.get("runtime_version", "Unknown"))
    table.add_row("Package Manager", profile_data.get("package_manager", "npm"))
    table.add_row("Operating System", profile_data.get("operating_system", "Linux"))
    table.add_row("Detected Libraries", ", ".join(list(libraries.keys())[:5]) or "None")
    table.add_row("Dev & Build Tools", ", ".join(list(tools.keys())) or "Standard")

    print(table)
    print("\n[bold green]✔ Noir analysis completed successfully![/bold green]\n")
