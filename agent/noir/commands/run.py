import os
import sys
import json
import time
import subprocess
from pathlib import Path
import typer
from rich import print
from rich.console import Console

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.utils.CommandDisplay import CommandDisplay
from noir.utils.test_detector import find_test_files

app = typer.Typer(
    help="Build & execute Docker container, stream in-container tests and live logs to terminal & WebSockets."
)

NOIR_DIR = Path(".noir")
console = Console()


def send_log_telemetry(client: ApiClient, project_code: str, log: str, stream: str = "stdout", event: str = None):
    if not has_tokens():
        return
    try:
        data = {
            "log": log,
            "stream": stream,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        if event:
            data["event"] = event
        client.send_request_to_backend(
            f"/project/{project_code}/stream-logs/",
            "POST",
            data=data
        )
    except Exception:
        pass


def create_fallback_dockerfile(directory: Path):
    dockerfile = directory / "Dockerfile"

    if (directory / "package.json").exists():
        content = """FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
"""
    elif (directory / "manage.py").exists():
        content = """FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc default-libmysqlclient-dev pkg-config libpq-dev build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; else pip install django; fi
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
"""
    else:
        content = """FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi
COPY . .
EXPOSE 8000
CMD ["python", "-m", "http.server", "8000"]
"""

    if not dockerfile.exists() or "|| true" in dockerfile.read_text(encoding="utf-8", errors="ignore"):
        dockerfile.write_text(content, encoding="utf-8")
        print("[dim]Generated workspace Dockerfile for containerized execution.[/dim]")


@app.callback(invoke_without_command=True)
def run_container(
    image: str = typer.Option(None, "--image", "-i", help="Custom Docker image name/tag to run."),
    port: str = typer.Option(None, "--port", "-p", help="Port mapping (e.g. 8000:8000)."),
    command: str = typer.Option(None, "--cmd", "-c", help="Override container CMD.")
):
    text = CommandDisplay()
    text.print_banner()

    print("[bold violet]Noir Live Container Engine & Telemetry Stream...[/bold violet]\n")

    if not NOIR_DIR.exists() or not (NOIR_DIR / "config.json").exists():
        print("[red]Error: Project is not connected. Please run 'noir connect <code>' first.[/red]")
        raise typer.Exit(1)

    try:
        config_data = json.loads((NOIR_DIR / "config.json").read_text(encoding="utf-8"))
        project_code = config_data.get("project_id", "NR-UNKNOWN")
        backend_url = config_data.get("backend", "http://localhost:8000/api")
    except Exception:
        print("[red]Error reading workspace configuration from .noir/config.json[/red]")
        raise typer.Exit(1)

    # 1. VERIFY TEST FILES EXISTENCE IN WORKSPACE
    has_tests, host_test_cmd, container_test_cmd, tech_name = find_test_files(Path("."))
    if not has_tests or not container_test_cmd:
        print("[bold red]no test files found aborting noir[/bold red]")
        raise typer.Exit(1)

    print(f"[bold green]✔ Test suite detected for [cyan]{tech_name}[/cyan][/bold green]")
    print(f"[bold yellow]In-container test runner target: [cyan]{container_test_cmd}[/cyan][/bold yellow]\n")

    # 2. CHECK DOCKER INSTALLATION
    if subprocess.run("docker --version", shell=True, capture_output=True).returncode != 0:
        print("[red]Error: Docker executable not found. Please ensure Docker daemon is running.[/red]")
        raise typer.Exit(1)

    image_name = image
    if not image_name:
        image_name = f"noir-app-{project_code.lower()}"
        print(f"[bold yellow]Building Docker image '[cyan]{image_name}[/cyan]'...[/bold yellow]")
        create_fallback_dockerfile(Path("."))
        build_proc = subprocess.run(f"docker build -t {image_name} .", shell=True)
        if build_proc.returncode != 0:
            print("[red]Docker build failed.[/red]")
            raise typer.Exit(1)

    client = ApiClient()
    container_name = f"noir-run-{project_code.lower()}"
    subprocess.run(f"docker rm -f {container_name}", shell=True, capture_output=True)

    print(f"\n[bold green]Launching container '[cyan]{image_name}[/cyan]' ({container_name}) for project '[yellow]{project_code}[/yellow]'...[/bold green]\n")

    port_flag = f"-p {port}" if port else ""
    cmd_override = f" {command}" if command else ""
    docker_run_cmd = f"docker run -d --rm --name {container_name} {port_flag} {image_name}{cmd_override}"

    run_proc = subprocess.run(docker_run_cmd, shell=True, capture_output=True, text=True)
    if run_proc.returncode != 0:
        print(f"[red]Failed to start container: {run_proc.stderr}[/red]")
        raise typer.Exit(1)

    # Broadcast run start event to backend
    send_log_telemetry(
        client, project_code,
        f"[Agent] Launching container '{image_name}' for project '{project_code}'",
        event="run_start"
    )

    try:
        # 3. RUN TESTS INSIDE CONTAINER VIA `docker exec`
        print(f"[bold cyan]═══ Executing Tests Inside Running Container ═══[/bold cyan]")
        print(f"[bold yellow]Running: docker exec {container_name} {container_test_cmd}[/bold yellow]\n")

        exec_cmd = f"docker exec {container_name} {container_test_cmd}"
        start_time = time.time()
        test_logs = []

        test_proc = subprocess.Popen(
            exec_cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        while True:
            line = test_proc.stdout.readline()
            if not line and test_proc.poll() is not None:
                break
            if line:
                clean_line = line.rstrip()
                test_logs.append(clean_line)
                console.print(f"[dim cyan][{time.strftime('%H:%M:%S')}][Test][/dim cyan] {clean_line}")
                send_log_telemetry(client, project_code, f"[Test] {clean_line}")

        test_proc.wait()
        duration_ms = int((time.time() - start_time) * 1000)
        combined_logs = "\n".join(test_logs)
        test_success = (test_proc.returncode == 0)

        # Record test run results to backend
        if has_tokens():
            try:
                client.send_request_to_backend(
                    "/project/test-runs/",
                    "POST",
                    data={
                        "project": project_code,
                        "command": container_test_cmd,
                        "total_tests": 1,
                        "passed_tests": 1 if test_success else 0,
                        "failed_tests": 0 if test_success else 1,
                        "skipped_tests": 0,
                        "duration_ms": duration_ms,
                        "logs": combined_logs[-2000:]
                    }
                )
            except Exception:
                pass

        if not test_success:
            print(f"\n[bold red]✖ Tests failed inside container (exit code {test_proc.returncode}).[/bold red]")
            raise typer.Exit(1)

        print(f"\n[bold green]✔ All container tests passed ({duration_ms} ms)![/bold green]\n")

        # 4. STREAM LIVE CONTAINER LOGS
        print(f"[bold cyan]═══ Streaming Container Live Logs (Press Ctrl+C to stop) ═══[/bold cyan]\n")
        logs_proc = subprocess.Popen(
            f"docker logs -f {container_name}",
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        try:
            while True:
                line = logs_proc.stdout.readline()
                if not line and logs_proc.poll() is not None:
                    break
                if line:
                    clean_line = line.rstrip()
                    console.print(f"[dim cyan][{time.strftime('%H:%M:%S')}][App][/dim cyan] {clean_line}")
                    send_log_telemetry(client, project_code, clean_line)
        except KeyboardInterrupt:
            print("\n[yellow]Interrupted by user. Stopping container...[/yellow]")
            logs_proc.terminate()

        logs_proc.wait()

    finally:
        # Cleanup container and signal run end
        subprocess.run(f"docker rm -f {container_name}", shell=True, capture_output=True)
        send_log_telemetry(
            client, project_code,
            "[Agent] Noir container execution finished.",
            event="run_end"
        )
        print(f"\n[bold green]✔ Noir container execution finished cleanly.[/bold green]\n")
