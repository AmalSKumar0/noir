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

app = typer.Typer(
    help="Run workspace tests and record results telemetry to backend."
)

NOIR_DIR = Path(".noir")


def detect_test_command() -> str:
    if (Path("pytest.ini").exists() or Path("tests").exists() or Path("test").exists()):
        return "pytest"
    elif Path("package.json").exists():
        return "npm test"
    elif Path("Cargo.toml").exists():
        return "cargo test"
    elif Path("go.mod").exists():
        return "go test ./..."
    return "pytest"


@app.callback(invoke_without_command=True)
def run_tests(
    command: str = typer.Option(None, "--command", "-c", help="Custom test command to execute.")
):
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Executing Noir Reliability Test Runner...[/bold violet]\n")

    test_cmd = command
    if not test_cmd:
        if NOIR_DIR.exists() and (NOIR_DIR / "config.yaml").exists():
            try:
                for line in (NOIR_DIR / "config.yaml").read_text(encoding="utf-8").splitlines():
                    if line.startswith("test_runner:"):
                        test_cmd = line.split(":", 1)[1].strip()
                        break
            except Exception:
                pass
        if not test_cmd or test_cmd == "pytest":
            test_cmd = detect_test_command()

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
        combined_logs = stdout + "\n" + stderr
        returncode = process.returncode
    except Exception as e:
        print(f"[red]Error executing test command '{test_cmd}': {e}[/red]")
        raise typer.Exit(1)

    passed = 1 if returncode == 0 else 0
    failed = 0 if returncode == 0 else 1
    total = passed + failed

    print(combined_logs)

    # Post test run results to backend if connected
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
            print("[cyan]✔ Test run telemetry recorded to Noir backend server.[/cyan]")
        except Exception as pe:
            print(f"[yellow]Note: Test run completed, but telemetry sync skipped: {pe}[/yellow]")

    # Display Summary Table
    table = Table(title="[bold green]Noir Test Run Results[/bold green]", border_style="violet")
    table.add_column("Metric", style="bold cyan")
    table.add_column("Result", style="white")

    table.add_row("Test Command", test_cmd)
    table.add_row("Status", "[green]PASSED[/green]" if returncode == 0 else "[red]FAILED[/red]")
    table.add_row("Duration", f"{duration_ms} ms")
    table.add_row("Exit Code", str(returncode))

    print(table)
    print()
