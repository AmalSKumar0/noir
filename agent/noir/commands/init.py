from pathlib import Path

import typer
from rich import print

app = typer.Typer(
    help="Initialize Noir in the current project."
)


@app.callback(invoke_without_command=True)
def init():
    noir_dir = Path(".noir")

    if noir_dir.exists():
        print("[yellow]Noir is already initialized in this project.[/yellow]")
        raise typer.Exit()

    noir_dir.mkdir()

    config = noir_dir / "config.yaml"

    config.write_text(
"""project_name: my-project
backend_url: http://localhost:8000
test_runner: pytest
"""
    )

    print("[green]Noir initialized successfully![/green]")