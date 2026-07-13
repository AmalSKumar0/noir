from pathlib import Path

import typer
from rich import print

app = typer.Typer(
    help="Connect to the Noir backend."
)


@app.callback(invoke_without_command=True)
def connect(Id:str = typer.Option(..., prompt=True, help="The ID of the project to connect to.")):
    noir_dir = Path(".noir")

    config = noir_dir / "config.yaml"

    config.write_text(
        f"""project_name: {Id}
        backend_url: http://localhost:8000/{Id}
        test_runner: pytest
        """
    )

    print("[green]Noir connected successfully![/green]")