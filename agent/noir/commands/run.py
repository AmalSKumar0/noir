import os
import sys
import json
import time
import asyncio
import subprocess
from pathlib import Path
import typer
from rich import print
from rich.console import Console

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.utils.CommandDisplay import CommandDisplay

try:
    import websockets
except ImportError:
    websockets = None

app = typer.Typer(
    help="Build & execute Docker container, streaming live logs to terminal & backend WebSockets."
)

NOIR_DIR = Path(".noir")
console = Console()


def get_backend_ws_url(http_url: str, project_code: str) -> str:
    ws_base = http_url.replace("http://", "ws://").replace("https://", "wss://").rstrip("/")
    if "/api" in ws_base:
        ws_base = ws_base.split("/api")[0]
    return f"{ws_base}/ws/project/{project_code}/logs/"


def create_fallback_dockerfile(directory: Path):
    dockerfile = directory / "Dockerfile"
    if dockerfile.exists():
        return

    # Create dynamic default Dockerfile based on detected files
    if (directory / "package.json").exists():
        content = """FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install || true
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
"""
    else:
        content = """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* pyproject.toml* ./
RUN pip install --no-cache-dir -r requirements.txt || true
COPY . .
EXPOSE 8000
CMD ["python", "-m", "http.server", "8000"]
"""
    dockerfile.write_text(content, encoding="utf-8")
    print("[dim]Generated default workspace Dockerfile.[/dim]")


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

    # Check Docker installation
    if not subprocess.run("docker --version", shell=True, capture_output=True).returncode == 0:
        print("[red]Error: Docker executable not found. Please install Docker daemon.[/red]")
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

    ws_url = get_backend_ws_url(backend_url, project_code)
    client = ApiClient()

    print(f"\n[bold green]Launching container '[cyan]{image_name}[/cyan]' for project '[yellow]{project_code}[/yellow]'...[/bold green]")
    print(f"[dim]Live log WebSocket endpoint: {ws_url}[/dim]\n")

    port_flag = f"-p {port}" if port else ""
    cmd_override = f" {command}" if command else ""
    docker_cmd = f"docker run --rm {port_flag} {image_name}{cmd_override}"

    try:
        proc = subprocess.Popen(
            docker_cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        print(f"[red]Failed to start docker container: {e}[/red]")
        raise typer.Exit(1)

    # Stream container stdout in real time to console and backend
    print(f"[bold cyan]═══ Live Container Stream Started (Press Ctrl+C to stop) ═══[/bold cyan]\n")

    try:
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                clean_line = line.rstrip()
                # 1. Print live line to terminal stdout
                console.print(f"[dim cyan][{time.strftime('%H:%M:%S')}][/dim cyan] {clean_line}")

                # 2. Transmit to backend via REST / WebSocket stream
                if has_tokens():
                    try:
                        client.send_request_to_backend(
                            f"/project/{project_code}/stream-logs/",
                            "POST",
                            data={
                                "log": clean_line,
                                "stream": "stdout",
                                "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')
                            }
                        )
                    except Exception:
                        pass
    except KeyboardInterrupt:
        print("\n[yellow]Stopping container execution...[/yellow]")
        proc.terminate()

    proc.wait()
    print(f"\n[bold green]✔ Container execution finished with exit code {proc.returncode}[/bold green]\n")
