import sys
import shutil
import subprocess
import requests
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.auth.storage import has_tokens
from noir.api.client import ApiClient
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(
    help="Run diagnostic health checks on Noir CLI environment and backend connectivity."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def doctor():
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Running Noir System & Environment Diagnostics...[/bold violet]\n")

    table = Table(title="[bold green]Noir Doctor Diagnostic Summary[/bold green]", border_style="violet")
    table.add_column("Diagnostic Check", style="bold cyan")
    table.add_column("Status", style="bold")
    table.add_column("Details", style="white")

    # 1. Python Environment Check
    py_version = sys.version.split()[0]
    table.add_row("Python Runtime", "[green]PASS[/green]", f"Python {py_version}")

    # 2. Git CLI Check
    if shutil.which("git"):
        try:
            git_ver = subprocess.check_output(["git", "--version"], text=True).strip()
            table.add_row("Git Executable", "[green]PASS[/green]", git_ver)
        except Exception:
            table.add_row("Git Executable", "[yellow]WARN[/yellow]", "Git available but version check failed")
    else:
        table.add_row("Git Executable", "[yellow]WARN[/yellow]", "Git executable not found on PATH")

    # 3. Keyring Auth Tokens Check
    if has_tokens():
        table.add_row("Auth Credentials", "[green]PASS[/green]", "Valid tokens found in system keyring")
    else:
        table.add_row("Auth Credentials", "[yellow]WARN[/yellow]", "No active auth tokens found. Run 'noir login'")

    # 4. Backend Server Reachability
    client = ApiClient()
    backend_url = client.base_url
    try:
        res = requests.get(f"{backend_url}/accounts/me/", timeout=3)
        if res.status_code in [200, 401, 403]:
            table.add_row("Backend Reachability", "[green]PASS[/green]", f"Reachable at {backend_url}")
        else:
            table.add_row("Backend Reachability", "[yellow]WARN[/yellow]", f"Backend returned status {res.status_code}")
    except Exception as e:
        table.add_row("Backend Reachability", "[red]FAIL[/red]", f"Cannot connect to {backend_url} ({e})")

    # 5. Local .noir Workspace Check
    if NOIR_DIR.exists():
        if (NOIR_DIR / "config.json").exists():
            table.add_row("Workspace Configuration", "[green]PASS[/green]", ".noir/ workspace initialized")
        else:
            table.add_row("Workspace Configuration", "[yellow]WARN[/yellow]", ".noir/ directory missing config.json")
    else:
        table.add_row("Workspace Configuration", "[yellow]INFO[/yellow]", "No local .noir workspace. Run 'noir connect <code>'")

    print(table)
    print("\n[bold green]✔ Diagnostics check complete![/bold green]\n")
