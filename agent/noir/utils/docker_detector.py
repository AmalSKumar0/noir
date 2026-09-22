import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
import yaml
from rich.table import Table

try:
    import docker
    from docker.errors import DockerException
except ImportError:
    docker = None
    DockerException = Exception


def _extract_ports(ports_spec: Any) -> List[str]:
    """Helper to extract formatted port strings from compose or docker attrs."""
    result = []
    if isinstance(ports_spec, list):
        for p in ports_spec:
            if isinstance(p, str):
                result.append(p)
            elif isinstance(p, (int, float)):
                result.append(str(int(p)))
            elif isinstance(p, dict):
                published = p.get("published", "")
                target = p.get("target", "")
                if published and target:
                    result.append(f"{published}:{target}")
                elif target:
                    result.append(str(target))
    elif isinstance(ports_spec, dict):
        for container_port, host_bindings in ports_spec.items():
            if host_bindings:
                for binding in host_bindings:
                    host_port = binding.get("HostPort")
                    if host_port:
                        result.append(f"{host_port}->{container_port}")
            else:
                result.append(str(container_port))
    return result


def parse_compose_services(workspace_dir: Path) -> List[Dict[str, Any]]:
    """Parse services from compose files in workspace."""
    candidates = [
        workspace_dir / "docker-compose.yml",
        workspace_dir / "docker-compose.yaml",
        workspace_dir / "compose.yml",
        workspace_dir / "compose.yaml",
        workspace_dir / "docker" / "docker-compose.yml",
        workspace_dir / "docker" / "compose.yml",
    ]

    services_found = []
    seen_services = set()

    for path in candidates:
        if not path.exists():
            continue
        try:
            content = yaml.safe_load(path.read_text(encoding="utf-8", errors="ignore"))
            if not isinstance(content, dict):
                continue
            services = content.get("services", {})
            if isinstance(services, dict):
                for svc_name, svc_data in services.items():
                    if svc_name in seen_services:
                        continue
                    seen_services.add(svc_name)
                    svc_dict = svc_data if isinstance(svc_data, dict) else {}
                    image = svc_dict.get("image", "")
                    if not image and "build" in svc_dict:
                        image = f"{svc_name}:local-build"
                    ports = _extract_ports(svc_dict.get("ports", []))
                    container_name = svc_dict.get("container_name") or f"{workspace_dir.name}-{svc_name}"

                    services_found.append({
                        "id": "-",
                        "name": container_name,
                        "service": svc_name,
                        "image": image or "custom-image",
                        "status": "defined",
                        "ports": ports,
                        "source": "compose",
                        "file": path.name,
                    })
        except Exception:
            continue

    return services_found


def parse_dockerfiles(workspace_dir: Path) -> List[Dict[str, Any]]:
    """Detect standalone Dockerfiles in workspace."""
    dockerfiles = []
    candidates = [
        workspace_dir / "Dockerfile",
        workspace_dir / "docker" / "Dockerfile",
    ]
    for pattern in ["Dockerfile.*"]:
        candidates.extend(workspace_dir.glob(pattern))

    for df in candidates:
        if df.exists() and df.is_file():
            name = df.name
            service_name = "app" if name == "Dockerfile" else name.replace("Dockerfile.", "").replace("Dockerfile-", "")
            dockerfiles.append({
                "id": "-",
                "name": f"{workspace_dir.name}-{service_name}",
                "service": service_name,
                "image": f"{workspace_dir.name}:{service_name}",
                "status": "defined",
                "ports": [],
                "source": "dockerfile",
                "file": df.name,
            })
    return dockerfiles


def discover_project_containers(
    target_dir: Union[str, Path] = ".",
    project_code: str = ""
) -> List[Dict[str, Any]]:
    """
    Scans project workspace and host Docker daemon for all relevant Docker containers.
    Returns structured list of container metadata.
    """
    workspace = Path(target_dir).resolve()
    dir_name = workspace.name.lower()
    code_lower = project_code.strip().lower() if project_code else ""

    compose_services = parse_compose_services(workspace)
    dockerfile_services = parse_dockerfiles(workspace)

    # Dictionary to merge detected containers by service or container name
    containers_map: Dict[str, Dict[str, Any]] = {}

    for svc in compose_services:
        key = svc["service"].lower()
        containers_map[key] = svc

    for df in dockerfile_services:
        key = df["service"].lower()
        if key not in containers_map:
            containers_map[key] = df

    # Check Docker daemon
    docker_containers = []
    client = None
    if docker is not None:
        try:
            client = docker.from_env()
            client.ping()
        except Exception:
            client = None

    if client:
        try:
            all_host_containers = client.containers.list(all=True)
            for c in all_host_containers:
                labels = c.labels or {}
                compose_project = labels.get("com.docker.compose.project", "").lower()
                compose_service = labels.get("com.docker.compose.service", "").lower()
                c_name = c.name.lower()
                c_image = c.image.tags[0] if c.image.tags else c.image.short_id

                ports_list = _extract_ports(c.attrs.get("NetworkSettings", {}).get("Ports", {}))

                # Check if this container is associated with this project
                matches_project = False
                matched_service = compose_service

                if compose_project and (compose_project == dir_name or (code_lower and compose_project == code_lower)):
                    matches_project = True
                elif dir_name in c_name:
                    matches_project = True
                elif code_lower and (code_lower in c_name or f"noir-run-{code_lower}" in c_name):
                    matches_project = True
                elif compose_service and compose_service in containers_map:
                    matches_project = True
                elif any(svc_key in c_name for svc_key in containers_map.keys()):
                    matches_project = True

                c_info = {
                    "id": c.short_id,
                    "name": c.name,
                    "service": matched_service or labels.get("com.docker.compose.service") or c.name,
                    "image": c_image,
                    "status": c.status,
                    "ports": ports_list,
                    "source": "docker",
                }

                if matches_project:
                    target_key = (matched_service or c.name).lower()
                    if target_key in containers_map:
                        containers_map[target_key].update(c_info)
                    else:
                        containers_map[target_key] = c_info
                else:
                    docker_containers.append(c_info)

        except Exception:
            pass

    # Consolidated list
    result = list(containers_map.values())

    # If no project-specific containers were found at all, but host has running containers,
    # supply running host containers so the user has immediate targets
    if not result and docker_containers:
        running_only = [c for c in docker_containers if c.get("status") == "running"]
        result = running_only[:8] if running_only else docker_containers[:8]

    return result


def format_containers_table(containers: List[Dict[str, Any]]) -> Table:
    """Build a rich Table presenting detected Docker containers."""
    table = Table(
        title="[bold green]Docker Containers & Microservices[/bold green]",
        border_style="cyan",
        header_style="bold magenta",
    )
    table.add_column("ID", style="dim cyan", width=12)
    table.add_column("Container Name", style="bold white")
    table.add_column("Service", style="bold yellow")
    table.add_column("Status", justify="center")
    table.add_column("Image", style="dim white")
    table.add_column("Ports / Source", style="cyan")

    status_styles = {
        "running": "[bold green]● Running[/bold green]",
        "exited": "[dim red]■ Exited[/dim red]",
        "defined": "[yellow]▲ Defined[/yellow]",
        "paused": "[cyan]⏸ Paused[/cyan]",
        "restarting": "[bold yellow]↻ Restarting[/bold yellow]",
    }

    for c in containers:
        c_status = c.get("status", "unknown").lower()
        styled_status = status_styles.get(c_status, f"[white]{c_status}[/white]")
        ports_str = ", ".join(c.get("ports", []))
        if not ports_str:
            source = c.get("source", "docker")
            ports_str = f"[{source}]"

        table.add_row(
            c.get("id", "-"),
            c.get("name", "unknown"),
            c.get("service", "-"),
            styled_status,
            c.get("image", "unknown"),
            ports_str,
        )

    return table
