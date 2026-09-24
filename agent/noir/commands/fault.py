import json
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any


import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Confirm, Prompt

from noir.faults import registry, DockerManager
from noir.faults.base import FaultResult
from noir.faults.experiment import SteadyStateEvaluator, ResilienceScorer
from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.utils.CommandDisplay import CommandDisplay
from noir.utils.docker_detector import discover_project_containers

app = typer.Typer(
    help="Safely inject and manage manual fault injection experiments in local Docker containers.",
    no_args_is_help=True,
)

console = Console()
NOIR_DIR = Path(".noir")


def _get_connected_project() -> Optional[str]:
    if not NOIR_DIR.exists():
        return None
    config_file = NOIR_DIR / "config.json"
    if not config_file.exists():
        return None
    try:
        data = json.loads(config_file.read_text(encoding="utf-8"))
        return data.get("project_id")
    except Exception:
        return None


@app.command("list")
def list_faults():
    """
    List all supported manual fault injection types and their parameter constraints.
    """
    display = CommandDisplay()
    display.print_banner()

    table = Table(
        title="[bold violet]Noir Supported Manual Fault Injection Library[/bold violet]",
        border_style="violet",
        header_style="bold cyan",
    )
    table.add_column("Fault Type", style="bold green")
    table.add_column("Display Name", style="bold white")
    table.add_column("Description", style="dim")
    table.add_column("Parameters & Constraints", style="yellow")
    table.add_column("Reversible", justify="center")

    param_info = {
        "container_restart": "timeout (1-60s, default 10)",
        "container_stop": "duration (1-300s, default 10)\ntimeout (1-60s, default 10)",
        "network_delay": "latency_ms (1-5000ms, default 500)\njitter_ms (0-1000ms, default 50)\nduration (1-300s, default 10)",
        "network_loss": "loss_percent (0.1-100%, default 20)\nduration (1-300s, default 10)",
        "cpu_stress": "workers (1-16, default 2)\nduration (1-300s, default 10)",
        "memory_stress": "memory_mb (16-4096MB, default 256)\nduration (1-300s, default 10)",
    }

    for fault in registry.list_all():
        table.add_row(
            fault.name,
            fault.display_name,
            fault.description,
            param_info.get(fault.name, "None"),
            "[green]Yes[/green]",
        )

    console.print(table)
    console.print("\n[dim]Run 'noir fault inject <fault_type> --target <container>' to execute a fault.[/dim]\n")


@app.command("containers")
def list_containers():
    """
    List running Docker containers available for fault injection.
    """
    docker_mgr = DockerManager()
    if not docker_mgr.is_available():
        console.print(f"[bold red]Docker daemon is not accessible:[/bold red] {docker_mgr.error}")
        raise typer.Exit(1)

    containers = docker_mgr.list_containers(all=False)
    if not containers:
        console.print("[yellow]No running Docker containers found on this system.[/yellow]")
        return

    table = Table(
        title="[bold green]Detected Docker Containers (Targets)[/bold green]",
        border_style="cyan",
        header_style="bold magenta",
    )
    table.add_column("Name", style="bold white")
    table.add_column("ID", style="dim")
    table.add_column("Status", style="green")
    table.add_column("Image", style="cyan")
    table.add_column("Ports", style="yellow")

    for c in containers:
        ports = ", ".join(f"{k}->{v[0]['HostPort']}" for k, v in (c.attrs.get("NetworkSettings", {}).get("Ports") or {}).items() if v)
        table.add_row(
            c.name,
            c.short_id,
            c.status,
            c.image.tags[0] if c.image.tags else "untagged",
            ports or "-",
        )

    console.print(table)


@app.command("inject")
def inject_fault(
    fault_type: str = typer.Argument(..., help="Type of fault to inject (run 'noir fault list' to see all)."),
    target: Optional[str] = typer.Option(None, "--target", "-t", help="Target container name or short ID."),
    duration: int = typer.Option(10, "--duration", "-d", help="Fault duration in seconds (1-300)."),
    latency: int = typer.Option(500, "--latency", "-l", help="Latency in milliseconds (for network_delay, 1-5000)."),
    jitter: int = typer.Option(50, "--jitter", "-j", help="Jitter in milliseconds (for network_delay, 0-1000)."),
    loss: float = typer.Option(20.0, "--loss", help="Loss percentage (for network_loss, 0.1-100)."),
    workers: int = typer.Option(2, "--workers", "-w", help="Number of CPU workers (for cpu_stress, 1-16)."),
    memory: int = typer.Option(256, "--memory", "-m", help="Memory to allocate in MB (for memory_stress, 16-4096)."),
    timeout: int = typer.Option(10, "--timeout", help="Graceful stop/restart timeout in seconds (1-60)."),
    probe_url: Optional[str] = typer.Option(None, "--probe-url", "-p", help="HTTP health probe URL for steady-state resilience evaluation (auto-detected if omitted)."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt."),
):
    """
    Manually inject an allowlisted, safe fault into a local Docker container with automated resilience evaluation.
    """
    executor = registry.get(fault_type)
    if not executor:
        console.print(f"[bold red]Error:[/bold red] Unsupported fault type '[bold yellow]{fault_type}[/bold yellow]'.")
        console.print(f"[dim]Supported faults: {', '.join(registry.supported_names())}[/dim]")
        raise typer.Exit(1)

    docker_mgr = DockerManager()
    if not docker_mgr.is_available():
        console.print(f"[bold red]Docker Error:[/bold red] {docker_mgr.error}")
        raise typer.Exit(1)

    # Resolve target container
    if not target:
        containers = docker_mgr.list_containers(all=False)
        if not containers:
            console.print("[bold red]No running containers found to inject faults into.[/bold red]")
            raise typer.Exit(1)
        console.print("[yellow]No target specified. Available running containers:[/yellow]")
        for idx, c in enumerate(containers, 1):
            console.print(f"  [{idx}] [bold cyan]{c.name}[/bold cyan] ({c.short_id}) - {c.image.tags[0] if c.image.tags else 'untagged'}")
        choice = Prompt.ask("Select container number or enter name", default="1")
        if choice.isdigit() and 1 <= int(choice) <= len(containers):
            target = containers[int(choice) - 1].name
        else:
            target = choice

    container = docker_mgr.find_container(target)
    if not container:
        console.print(f"[bold red]Target container '{target}' was not found.[/bold red]")
        raise typer.Exit(1)

    # Auto-detect probe URL if not explicitly supplied
    resolved_probe_url = probe_url or docker_mgr.get_container_endpoint(container.name)

    # Construct parameters
    params: Dict[str, Any] = {"duration": duration}
    if resolved_probe_url:
        params["probe_url"] = resolved_probe_url
    if fault_type == "network_delay":
        params["latency_ms"] = latency
        params["jitter_ms"] = jitter
    elif fault_type == "network_loss":
        params["loss_percent"] = loss
    elif fault_type == "cpu_stress":
        params["workers"] = workers
    elif fault_type == "memory_stress":
        params["memory_mb"] = memory
    elif fault_type in ("container_stop", "container_restart"):
        params["timeout"] = timeout

    try:
        validated_params = executor.validate_parameters(params)
    except Exception as e:
        console.print(f"[bold red]Invalid Parameters:[/bold red] {e}")
        raise typer.Exit(1)

    # Rich Confirmation Panel
    param_summary = "\n".join(f"  • [cyan]{k}[/cyan]: [white]{v}[/white]" for k, v in validated_params.items())
    if resolved_probe_url:
        param_summary += f"\n  • [bold green]probe_url[/bold green]: [white]{resolved_probe_url}[/white] [dim](auto-evaluated)[/dim]"
    warning_text = (
        f"[bold red]⚠ MANUAL FAULT INJECTION WARNING ⚠[/bold red]\n\n"
        f"You are about to inject [bold yellow]{executor.display_name}[/bold yellow] into container [bold cyan]{container.name}[/bold cyan].\n\n"
        f"[bold]Parameters:[/bold]\n{param_summary}\n\n"
        f"[dim]{executor.description}[/dim]\n"
        f"[green]Automatic rollback/cleanup and resilience scoring will execute.[/green]"
    )
    console.print(Panel(warning_text, title="[bold yellow]Execution Confirmation[/bold yellow]", border_style="red"))

    if not yes:
        confirmed = Confirm.ask(f"Proceed with injecting '{fault_type}' into '{container.name}'?")
        if not confirmed:
            console.print("[yellow]Fault injection cancelled by user.[/yellow]")
            return

    # Check project connection for remote sync/audit
    project_id = _get_connected_project()
    client = None
    fault_record_id = None

    if project_id and has_tokens():
        try:
            client = ApiClient()
            create_resp = client.send_request_to_backend(
                f"/projects/{project_id}/faults/",
                "POST",
                data={
                    "fault_type": fault_type,
                    "target": container.name,
                    "parameters": validated_params,
                },
            )
            fault_record_id = create_resp.get("id")
            console.print(f"[dim]Recorded fault injection request #{fault_record_id} in Noir backend.[/dim]")

            # Claim
            client.send_request_to_backend(
                f"/projects/{project_id}/faults/{fault_record_id}/claim/",
                "POST",
            )
        except Exception as e:
            console.print(f"[dim yellow]Note: Could not sync fault audit with backend: {e}[/dim yellow]")

    # Steady State Baseline Check
    evaluator = SteadyStateEvaluator(probe_url=resolved_probe_url)
    if resolved_probe_url:
        console.print(f"[dim cyan]Measuring baseline health on '{resolved_probe_url}'...[/dim cyan]")
        baseline = evaluator.measure_baseline(count=3, interval=0.3)
        if baseline.get("healthy"):
            console.print(f"  [green]✔ Baseline steady state healthy ({baseline.get('avg_latency_ms', 0)}ms avg)[/green]")
        else:
            console.print(f"  [yellow]⚠ Warning: Target endpoint did not respond with expected status[/yellow]")

    # Start Active Probing & Execute Fault
    evaluator.start_in_fault_probing(interval_sec=1.0)
    console.print(f"\n[bold yellow]⚡ Injecting fault: {executor.display_name}...[/bold yellow]")
    with console.status(f"[bold cyan]Applying fault on '{container.name}'...[/bold cyan]"):
        result: FaultResult = executor.execute(docker_mgr, container.name, validated_params)

    in_fault_metrics = evaluator.stop_in_fault_probing()

    # Recovery Verification (RTO)
    rto_target_sec = float(validated_params.get("rto_target_seconds", 5.0))
    console.print(f"[dim cyan]Verifying post-fault recovery (target RTO: {rto_target_sec}s)...[/dim cyan]")
    recovery_metrics = evaluator.measure_recovery(max_wait_sec=12.0, rto_target_sec=rto_target_sec)

    # Compute Resilience Score & Report
    resilience_report = ResilienceScorer.calculate_score(
        fault_type=fault_type,
        baseline=evaluator.baseline,
        experiment_metrics=in_fault_metrics,
        recovery_metrics=recovery_metrics,
        rollback_success=result.recovered,
    )

    # Display Rich Resilience Report Panel
    grade_color = "green" if resilience_report["grade"] == "A" else ("yellow" if resilience_report["grade"] == "B" else "red")
    recs_text = "\n".join(f"  • {r}" for r in resilience_report["recommendations"])

    resilience_panel_body = (
        f"[bold {grade_color}]Grade {resilience_report['grade']}[/bold {grade_color}] — "
        f"[bold white]{resilience_report['score']}/100[/bold white] "
        f"([dim]{resilience_report['classification']}[/dim])\n\n"
        f"[bold]Steady-State Probe:[/bold] {resolved_probe_url or 'None'}\n"
        f"[bold]In-Fault Availability:[/bold] {in_fault_metrics.get('availability_percent', 100)}%\n"
        f"[bold]In-Fault Latency P95:[/bold] {in_fault_metrics.get('p95_latency_ms', 0)}ms\n"
        f"[bold]Recovery Time (RTO):[/bold] {recovery_metrics.get('rto_seconds', 0)}s\n"
        f"[bold]Rollback Cleaned Up:[/bold] {'Yes' if result.recovered else 'No'}\n\n"
        f"[bold cyan]Architectural Recommendations:[/bold cyan]\n{recs_text}"
    )
    console.print(Panel(
        resilience_panel_body,
        title=f"[bold {grade_color}]Chaos Resilience Assessment — Score {resilience_report['score']}/100[/bold {grade_color}]",
        border_style=grade_color,
    ))

    # Report to backend if tracked
    if client and fault_record_id and project_id:
        try:
            status_str = "completed" if result.success else "failed"
            payload = result.to_dict()
            payload["resilience"] = resilience_report
            payload["resilience_score"] = resilience_report["score"]
            payload["resilience_grade"] = resilience_report["grade"]
            payload["classification"] = resilience_report["classification"]
            payload["steady_state_baseline"] = evaluator.baseline
            payload["experiment_metrics"] = in_fault_metrics
            payload["recovery_metrics"] = recovery_metrics
            payload["recommendations"] = resilience_report["recommendations"]

            client.send_request_to_backend(
                f"/projects/{project_id}/faults/{fault_record_id}/report/",
                "POST",
                data={
                    "status": status_str,
                    "result": payload,
                    "error_message": result.error or "",
                },
            )
            console.print(f"[dim]Reported final resilience audit for fault #{fault_record_id} to Noir backend.[/dim]\n")
        except Exception as e:
            console.print(f"[dim yellow]Warning: Failed to report execution result to backend: {e}[/dim yellow]")


class LogBatcher:
    """
    Batches logs over a short interval (e.g. 250ms) or when buffer reaches threshold (10 items),
    flushing them via POST /projects/{project_id}/faults/{fault_id}/logs/batch/.
    Falls back to single-item /log/ if batch endpoint is unavailable.
    """
    def __init__(self, client: ApiClient, project_id: str, fault_id: int, max_batch_size: int = 10, flush_interval: float = 0.25):
        self.client = client
        self.project_id = project_id
        self.fault_id = fault_id
        self.max_batch_size = max_batch_size
        self.flush_interval = flush_interval
        self.buffer = []
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run_flush_loop, daemon=True)
        self.thread.start()

    def add(self, level: str, msg: str):
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.lock:
            self.buffer.append({"level": level, "message": msg, "timestamp": now_iso})
            should_flush = len(self.buffer) >= self.max_batch_size
        if should_flush:
            self.flush()

    def flush(self):
        with self.lock:
            if not self.buffer:
                return
            items_to_send = self.buffer[:]
            self.buffer = []

        try:
            self.client.send_request_to_backend(
                f"/projects/{self.project_id}/faults/{self.fault_id}/logs/batch/",
                "POST",
                data={"logs": items_to_send},
            )
        except Exception:
            for item in items_to_send:
                try:
                    self.client.send_request_to_backend(
                        f"/projects/{self.project_id}/faults/{self.fault_id}/log/",
                        "POST",
                        data={"level": item["level"], "message": item["message"]},
                    )
                except Exception:
                    pass

    def _run_flush_loop(self):
        while not self.stop_event.wait(timeout=self.flush_interval):
            self.flush()

    def close(self):
        self.stop_event.set()
        self.thread.join(timeout=1.0)
        self.flush()


def _execute_single_fault(
    fault: Dict[str, Any],
    project_id: str,
    client: ApiClient,
    docker_mgr: DockerManager,
    cancel_event: threading.Event,
):
    fault_id = fault["id"]
    fault_type = fault["fault_type"]
    target = fault["target"]
    params = fault.get("parameters") or {}

    batcher = LogBatcher(client, project_id, fault_id, max_batch_size=10, flush_interval=0.25)

    def emit_log(msg: str, level: str = "INFO"):
        level_style = "green" if level == "INFO" else ("yellow" if level == "WARN" else "red")
        console.print(f"  [dim cyan]#{fault_id}[/dim cyan] [{level_style}]{msg}[/{level_style}]")
        batcher.add(level, msg)

    # 1. Claim
    try:
        client.send_request_to_backend(
            f"/projects/{project_id}/faults/{fault_id}/claim/",
            "POST",
        )
        emit_log(f"Claimed by worker daemon. Preparing {fault_type} on target '{target}'...")
    except Exception as claim_err:
        console.print(f"  [red]Failed to claim fault #{fault_id}: {claim_err}[/red]")
        batcher.close()
        return

    # Check for early cancellation
    if cancel_event.is_set():
        emit_log("Cancelled before execution began.", level="WARN")
        try:
            client.send_request_to_backend(
                f"/projects/{project_id}/faults/{fault_id}/report/",
                "POST",
                data={"status": "cancelled", "result": {"cancelled": True}, "error_message": "Cancelled by user."},
            )
        except Exception:
            pass
        batcher.close()
        return

    # 2. Get executor
    executor = registry.get(fault_type)
    if not executor:
        err_msg = f"Agent does not support fault type '{fault_type}'"
        emit_log(err_msg, level="ERROR")
        try:
            client.send_request_to_backend(
                f"/projects/{project_id}/faults/{fault_id}/report/",
                "POST",
                data={
                    "status": "failed",
                    "result": {"error": err_msg},
                    "error_message": err_msg,
                },
            )
        except Exception:
            pass
        batcher.close()
        return

    # Fast cancellation check: event-driven via thread Event (zero HTTP overhead)
    def is_cancelled_fn() -> bool:
        return cancel_event.is_set()

    context = {
        "is_cancelled": is_cancelled_fn,
        "log": emit_log,
    }

    # 3. Steady-State Baseline Evaluation (Principles of Chaos Engineering)
    probe_url = params.get("probe_url")
    if not probe_url:
        probe_url = docker_mgr.get_container_endpoint(target)

    expected_status = int(params.get("expected_status", 200))
    evaluator = SteadyStateEvaluator(probe_url=probe_url, expected_status=expected_status)

    if probe_url:
        emit_log(f"[STEADY STATE] Measuring baseline health on target endpoint '{probe_url}'...")
        baseline = evaluator.measure_baseline(count=3, interval=0.3)
        if baseline.get("healthy"):
            emit_log(f"[STEADY STATE] Baseline healthy: HTTP {expected_status} (~{baseline.get('avg_latency_ms', 0)}ms avg latency).")
        else:
            sample_err = baseline.get("sample_errors", [])
            err_desc = f" ({sample_err[0]})" if sample_err else ""
            emit_log(f"[STEADY STATE] Target endpoint was UNREACHABLE or returned unexpected status before fault{err_desc}. Note: In-fault metrics will reflect pre-existing application outages rather than chaos impact.", level="WARN")

    # Start active in-fault synthetic probing
    evaluator.start_in_fault_probing(interval_sec=1.0)

    emit_log(f"Executing {executor.display_name} on target '{target}'...")
    try:
        result: FaultResult = executor.execute(docker_mgr, target, params, context=context)
    except Exception as e:
        result = FaultResult(
            success=False,
            message=f"Execution error on '{target}': {e}",
            recovered=False,
            error=str(e),
        )

    # Stop in-fault probing and gather impact metrics
    in_fault_metrics = evaluator.stop_in_fault_probing()
    if in_fault_metrics.get("probes_count", 0) > 0:
        emit_log(
            f"[CHAOS IMPACT] In-fault availability: {in_fault_metrics['availability_percent']}% | "
            f"Avg Latency: {in_fault_metrics['avg_latency_ms']}ms (P95: {in_fault_metrics['p95_latency_ms']}ms)."
        )

    is_cancelled = (
        cancel_event.is_set()
        or (result.details and result.details.get("cancelled"))
        or (result.error and "cancelled" in result.error.lower())
    )

    rto_target_sec = float(params.get("rto_target_seconds", 5.0))
    if is_cancelled:
        # Immediate clean exit: skip 12.0s recovery polling when user explicitly stopped the job
        recovery_metrics = {
            "recovered": True,
            "recovery_time_seconds": 0.0,
            "rto_target_seconds": rto_target_sec,
            "rto_target_met": True,
            "aborted_by_user": True,
        }
        emit_log(f"Fault #{fault_id} stopped and cleaned up safely.", level="WARN")
    else:
        # Post-fault RTO recovery verification
        emit_log(f"[RECOVERY] Fault completed. Verifying recovery to steady state (RTO target: {rto_target_sec}s)...")
        recovery_metrics = evaluator.measure_recovery(max_wait_sec=12.0, rto_target_sec=rto_target_sec)
        rec_time = recovery_metrics.get("recovery_time_seconds", 0)
        if recovery_metrics.get("recovered"):
            emit_log(f"[RECOVERY] Steady-state restored in {rec_time}s (RTO target: {rto_target_sec}s, target {'met' if recovery_metrics.get('rto_target_met') else 'exceeded'}).")
        else:
            emit_log(f"[RECOVERY] Service did not restore within {rec_time}s timeout.", level="WARN")

    # Compute comprehensive Resilience Score & Grade
    resilience_report = ResilienceScorer.calculate_score(
        fault_type=fault_type,
        baseline=evaluator.baseline,
        experiment_metrics=in_fault_metrics,
        recovery_metrics=recovery_metrics,
        rollback_success=result.recovered,
    )
    if not is_cancelled:
        emit_log(f"[RESILIENCE AUDIT] Score: {resilience_report['score']}/100 | Grade: {resilience_report['grade']} ({resilience_report['classification']})")

    # 4. Report final result
    if is_cancelled:
        status_str = "cancelled"
    elif result.success:
        status_str = "completed"
        emit_log(f"Fault #{fault_id} completed successfully in {result.duration_seconds}s.", level="INFO")
    else:
        status_str = "failed"
        emit_log(f"Fault #{fault_id} failed: {result.error}", level="ERROR")

    result_payload = result.to_dict()
    result_payload["resilience"] = resilience_report
    result_payload["resilience_score"] = resilience_report["score"]
    result_payload["resilience_grade"] = resilience_report["grade"]
    result_payload["classification"] = resilience_report["classification"]
    result_payload["steady_state_baseline"] = evaluator.baseline
    result_payload["experiment_metrics"] = in_fault_metrics
    result_payload["recovery_metrics"] = recovery_metrics
    result_payload["recommendations"] = resilience_report["recommendations"]

    try:
        client.send_request_to_backend(
            f"/projects/{project_id}/faults/{fault_id}/report/",
            "POST",
            data={
                "status": status_str,
                "result": result_payload,
                "error_message": result.error or "",
            },
        )
    except Exception as rep_err:
        console.print(f"[dim yellow]Warning: Failed to report execution result: {rep_err}[/dim yellow]")

    batcher.close()

    if status_str == "completed":
        console.print(f"  [bold green]✔ Fault #{fault_id} Completed ({result.duration_seconds}s) - Resilience: {resilience_report['grade']} ({resilience_report['score']}/100)[/bold green]")
    elif status_str == "cancelled":
        console.print(f"  [bold yellow]■ Fault #{fault_id} Cancelled & Cleaned Up[/bold yellow]")
    else:
        console.print(f"  [bold red]✖ Fault #{fault_id} Failed: {result.error}[/bold red]")


@app.command("listen")
def listen_for_faults(
    interval: float = typer.Option(2.0, "--interval", "-i", help="Polling interval in seconds (default 2.0s)."),
    concurrency: int = typer.Option(1, "--concurrency", "-c", help="Max concurrent injections (default 1)."),
):
    """
    Run in background/terminal to listen for and execute fault injection requests dispatched from the Noir Web Dashboard.
    """
    display = CommandDisplay()
    display.print_banner()

    project_id = _get_connected_project()
    if not project_id:
        console.print("[bold red]No connected project found in this workspace.[/bold red]")
        console.print("[yellow]Please run 'noir connect <code>' first.[/yellow]")
        raise typer.Exit(1)

    if not has_tokens():
        console.print("[bold red]Not authenticated.[/bold red] Please run 'noir login' first.")
        raise typer.Exit(1)

    docker_mgr = DockerManager()
    if not docker_mgr.is_available():
        console.print(f"[bold red]Docker daemon is not accessible:[/bold red] {docker_mgr.error}")
        raise typer.Exit(1)

    client = ApiClient()

    console.print(Panel(
        f"Project: [bold cyan]{project_id}[/bold cyan]\n"
        f"Polling Interval: [white]{interval}s[/white]\n"
        f"Concurrency Limit: [bold yellow]{concurrency}[/bold yellow]\n"
        f"Status: [bold green]Active & Listening for Remote Fault Injections[/bold green]\n\n"
        f"[dim]Trigger faults from the web dashboard. The agent will execute them locally and stream logs.[/dim]\n"
        f"[dim]Press Ctrl+C at any time to stop listening.[/dim]",
        title="[bold violet]Noir Fault Injection Daemon[/bold violet]",
        border_style="violet",
    ))

    # Send initial daemon started heartbeat to telemetry stream
    try:
        client.send_request_to_backend(
            f"/project/{project_id}/stream-logs/",
            "POST",
            data={
                "log": f"[Daemon] Noir Fault Injection Daemon active on project {project_id} (concurrency: {concurrency}). Listening...",
                "stream": "stdout",
                "event": "daemon_start",
            },
        )
    except Exception:
        pass

    # Display discovered & available Docker containers
    try:
        detected = discover_project_containers(".", project_id)
        if detected:
            try:
                client.send_request_to_backend(
                    f"/projects/{project_id}/containers/",
                    "POST",
                    data={"containers": detected}
                )
            except Exception:
                pass

            table = Table(title="[bold cyan]Discovered Docker Containers (Project & Daemon)[/bold cyan]", border_style="cyan")
            table.add_column("Container Name", style="bold white")
            table.add_column("Service", style="yellow")
            table.add_column("Status", justify="center")
            table.add_column("Source", style="dim")
            table.add_column("Image", style="cyan")

            active_count = 0
            for c in detected:
                raw_st = c.get("status", "unknown")
                if raw_st == "running":
                    st = "[bold green]● Running[/bold green]"
                    active_count += 1
                elif raw_st == "exited":
                    st = "[dim red]○ Exited[/dim red]"
                elif raw_st == "defined":
                    st = "[yellow]◌ Defined (Not Started)[/yellow]"
                else:
                    st = f"[dim]{raw_st}[/dim]"

                table.add_row(
                    c.get("name", "-"),
                    c.get("service", "-"),
                    st,
                    c.get("source", "-"),
                    c.get("image", "-"),
                )
            console.print(table)

            if active_count == 0:
                console.print(
                    "[yellow]⚡ Note: Fault injections (latency, stress, stop, restart) operate on running containers.\n"
                    "   Start defined containers with 'docker compose up -d' or 'noir run' so the agent can execute faults against them.[/yellow]\n"
                )
            else:
                console.print(f"[bold green]✔ {active_count} active container(s) ready for fault injection experiments.[/bold green]\n")
        else:
            avail = docker_mgr.get_available_container_names()
            if avail:
                table = Table(title="[bold cyan]Active Docker Containers on Host[/bold cyan]", border_style="cyan")
                table.add_column("Container Name", style="bold white")
                table.add_column("Status", justify="center")
                table.add_column("Image", style="cyan")
                for c in avail:
                    st = "[bold green]● Running[/bold green]" if c['status'] == 'running' else f"[dim]{c['status']}[/dim]"
                    table.add_row(c['name'], st, c.get('image', '-'))
                console.print(table)
            else:
                console.print("[dim yellow]No Docker containers currently found on Docker daemon.[/dim yellow]\n")
    except Exception as e:
        console.print(f"[dim]Could not list local containers: {e}[/dim]\n")

    active_workers: Dict[int, Dict[str, Any]] = {}

    try:
        while True:
            # 1. Clean up finished worker threads
            finished_ids = [fid for fid, w in active_workers.items() if not w["thread"].is_alive()]
            for fid in finished_ids:
                del active_workers[fid]

            # 2. Check for backend cancellation on running jobs
            for fid, w in list(active_workers.items()):
                if not w["cancel_event"].is_set():
                    try:
                        st = client.send_request_to_backend(f"/projects/{project_id}/faults/{fid}/status/", "GET")
                        if st.get("cancel_requested"):
                            console.print(f"  [bold yellow]Stop requested for active fault #{fid}. Terminating...[/bold yellow]")
                            w["cancel_event"].set()
                    except Exception:
                        pass

            # 3. If capacity available, poll for next pending fault
            if len(active_workers) < concurrency:
                try:
                    pending_resp = client.send_request_to_backend(
                        f"/projects/{project_id}/faults/pending/?concurrency={concurrency}",
                        "GET",
                    )
                    fault = pending_resp.get("fault")
                    if fault and fault["id"] not in active_workers:
                        fid = fault["id"]
                        ftype = fault["fault_type"]
                        ftarget = fault["target"]
                        console.print(f"\n[bold yellow]⚡ Received Queued Fault #{fid}:[/bold yellow] [bold cyan]{ftype}[/bold cyan] -> [white]{ftarget}[/white]")

                        cancel_ev = threading.Event()
                        worker_thread = threading.Thread(
                            target=_execute_single_fault,
                            args=(fault, project_id, client, docker_mgr, cancel_ev),
                            daemon=True,
                        )
                        active_workers[fid] = {
                            "thread": worker_thread,
                            "cancel_event": cancel_ev,
                        }
                        worker_thread.start()
                except Exception:
                    pass

            time.sleep(interval)

    except KeyboardInterrupt:
        console.print("\n[bold yellow]Stopping Noir Fault Daemon. Signalling active tasks to terminate...[/bold yellow]\n")
        for fid, w in active_workers.items():
            w["cancel_event"].set()
        for fid, w in active_workers.items():
            w["thread"].join(timeout=2.0)
        console.print("[dim]Goodbye![/dim]\n")
    finally:
        try:
            client.send_request_to_backend(
                f"/project/{project_id}/stream-logs/",
                "POST",
                data={
                    "log": f"[Daemon] Noir Fault Injection Daemon stopped for project {project_id}.",
                    "stream": "stdout",
                    "event": "daemon_stop",
                },
            )
        except Exception:
            pass

