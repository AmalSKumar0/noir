import json
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Manage local .noir/config.json workspace settings."
)

NOIR_DIR = Path(".noir")
CONFIG_FILE = NOIR_DIR / "config.json"


def read_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_config(data: dict):
    NOIR_DIR.mkdir(exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(data, indent=4), encoding="utf-8")


@app.callback(invoke_without_command=True)
def show_config(ctx: typer.Context):
    if ctx.invoked_subcommand:
        return

    text = CommandDisplay()
    text.print_banner()

    if not CONFIG_FILE.exists():
        print("[yellow]No local .noir/config.json configuration found. Connect to a project first.[/yellow]")
        return

    config_data = read_config()
    table = Table(title="[bold green]Noir Workspace Configuration[/bold green]", border_style="violet")
    table.add_column("Setting Key", style="bold cyan")
    table.add_column("Value", style="white")

    for k, v in config_data.items():
        table.add_row(str(k), str(v))

    print(table)


@app.command(name="get")
def get_val(key: str = typer.Argument(..., help="Configuration key name to get.")):
    config_data = read_config()
    if key in config_data:
        print(f"[cyan]{key}[/cyan] = [green]{config_data[key]}[/green]")
    else:
        print(f"[red]Key '{key}' not found in configuration.[/red]")


@app.command(name="set")
def set_val(
    key: str = typer.Argument(..., help="Configuration key name to set."),
    value: str = typer.Argument(..., help="Value to assign.")
):
    config_data = read_config()
    config_data[key] = value
    write_config(config_data)
    print(f"[bold green]✔ Updated configuration:[/bold green] [cyan]{key}[/cyan] = [white]{value}[/white]")
