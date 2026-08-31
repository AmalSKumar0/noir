import json
import time
import subprocess
from pathlib import Path
import typer
from rich import print
from rich.table import Table

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.utils.CommandDisplay import CommandDisplay
from noir.utils.test_detector import find_test_files

app = typer.Typer(
    help="Run workspace tests locally and record test execution telemetry to backend."
)

NOIR_DIR = Path(".noir")


@app.callback(invoke_without_command=True)
def run_tests(
    command: str = typer.Option(None, "--command", "-c", help="Custom test command to execute.")
):
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Executing Noir Reliability Test Runner...[/bold violet]\n")

    test_cmd = command
    if not test_cmd:
        has_tests, host_cmd, _, tech_name = find_test_files(Path("."))
        if not has_tests or not host_cmd:
            print("[bold red]no test files found aborting noir[/bold red]")
            raise typer.Exit(1)
        test_cmd = host_cmd

    print(f"[bold yellow]Running test command:[bold yellow] [cyan]{test_cmd}[/cyan]\n")

    start_time = time.time()
    try:
        process = subprocess.run(
            test_cmd,
            shell=True,
            text=True,
            capture_output=True
        )
        duration_ms = int((time.time() - start_time) * 1000)
        stdout = process.stdout or ""
        stderr = process.stderr or ""
        combined_logs = (stdout + "\n" + stderr).strip()
        returncode = process.returncode
    except Exception as e:
        print(f"[red]Error executing test command '{test_cmd}': {e}[/red]")
        raise typer.Exit(1)

    passed = 1 if returncode == 0 else 0
    failed = 0 if returncode == 0 else 1
    total = passed + failed

    print(combined_logs)

    # Post test run results to backend if connected & authenticated
    if NOIR_DIR.exists() and (NOIR_DIR / "config.json").exists() and has_tokens():
        try:
            config_data = json.loads((NOIR_DIR / "config.json").read_text(encoding="utf-8"))
            project_id = config_data.get("project_id")

            client = ApiClient()
            client.send_request_to_backend(
                "/project/test-runs/",
                "POST",
                data={
                    "project": project_id,
                    "command": test_cmd,
                    "total_tests": total,
                    "passed_tests": passed,
                    "failed_tests": failed,
                    "skipped_tests": 0,
                    "duration_ms": duration_ms,
                    "logs": combined_logs[-2000:]
                }
            )
            print("\n[cyan]✔ Test run telemetry recorded to Noir backend server.[/cyan]")
        except Exception as pe:
            print(f"\n[yellow]Note: Test run completed, but telemetry sync skipped ({pe})[/yellow]")

    # Display Summary Table
    table = Table(title="[bold green]Noir Test Run Results[/bold green]", border_style="violet")
    table.add_column("Metric", style="bold cyan")
    table.add_column("Result", style="white")

    table.add_row("Test Command", test_cmd)
    table.add_row("Status", "[green]PASSED[/green]" if returncode == 0 else "[red]FAILED[/red]")
    table.add_row("Duration", f"{duration_ms} ms")
    table.add_row("Exit Code", str(returncode))

    print()
    print(table)
    print()

    if returncode != 0:
        raise typer.Exit(code=returncode)
