import shutil
from pathlib import Path
import typer
from rich import print

from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Disconnect from the Noir backend."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def disconnect():
    text = CommandDisplay()
    text.print_banner()

    if not NOIR_DIR.exists():
        print("[yellow]Noir is not currently connected to any project.[/yellow]")
        return

    try:
        shutil.rmtree(NOIR_DIR)
        print("[bold green]✔ Noir disconnected successfully! Removed local .noir workspace configuration.[/bold green]")
    except Exception as e:
        print(f"[red]Error disconnecting: {e}[/red]")
