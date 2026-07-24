from pathlib import Path

import typer
from rich import print

app = typer.Typer(
    help="Connect to the Noir backend."
)


@app.command(
    help="Connect to the Noir backend."
)
def connect(project_id:str = typer.Argument(..., help="The ID of the project to connect to.")):
    noir_dir = Path(".noir")

    config = noir_dir / "config.yaml"

    config.write_text(
        f"""project_name: {project_id}
        backend_url: http://localhost:8000/{project_id}
        test_runner: pytest
        """
    )

    print("[green]Noir connected successfully![/green]")


@app.command(
    help="disconnect from the Noir backend."
)
def disconnect():
    noir_dir = Path(".noir")

    config = noir_dir / "config.yaml"

    config.write_text(
        f"""project_name: 
        backend_url: http://localhost:8000/
        test_runner: pytest
        """
    )

    print("[green]Noir disconnected successfully![/green]")