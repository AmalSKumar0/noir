import time
import re
import io
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import docker
from docker.errors import DockerException, NotFound, APIError

INTERFACE_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")

def _validate_interface(interface: str) -> str:
    clean = str(interface or "eth0").strip()
    if not INTERFACE_REGEX.match(clean):
        raise ValueError(f"Invalid network interface format: '{interface}'")
    return clean


class DockerManager:
    """
    Encapsulates all Docker SDK operations for Noir's Fault Injection engine.
    Ensures safe container discovery, health checking, fault execution, and rollback.
    """

    def __init__(self):
        self._client: Optional[docker.DockerClient] = None
        self._connection_error: Optional[str] = None
        self._connect()

    def _connect(self):
        try:
            self._client = docker.from_env()
            self._client.ping()
            self._connection_error = None
        except DockerException as e:
            self._client = None
            self._connection_error = f"Cannot connect to Docker daemon: {e}"
        except Exception as e:
            self._client = None
            self._connection_error = f"Docker connection failure: {e}"

    def is_available(self) -> bool:
        if self._client is None:
            self._connect()
        return self._client is not None

    def get_connection_error(self) -> Optional[str]:
        return self._connection_error

    def require_client(self) -> docker.DockerClient:
        if not self.is_available():
            raise RuntimeError(self._connection_error or "Docker daemon is unreachable.")
        return self._client

    def list_containers(self, all_containers: bool = False) -> List[Dict[str, Any]]:
        """List containers with metadata relevant to the project."""
        client = self.require_client()
        containers = client.containers.list(all=all_containers)
        result = []
        for c in containers:
            labels = c.labels or {}
            service_name = labels.get("com.docker.compose.service") or c.name
            result.append({
                "id": c.short_id,
                "name": c.name,
                "service": service_name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else c.image.short_id,
                "labels": labels,
            })
        return result

    def get_available_container_names(self, all_containers: bool = True) -> List[Dict[str, str]]:
        """Return list of available docker containers with their names and status."""
        try:
            client = self.require_client()
            return [
                {
                    "name": c.name.lstrip('/'),
                    "status": c.status,
                    "id": c.short_id,
                    "image": c.image.tags[0] if (c.image and c.image.tags) else getattr(c.image, "short_id", "unknown")
                }
                for c in client.containers.list(all=all_containers)
            ]
        except Exception:
            return []

    def _raise_container_not_found(self, target: str):
        available = self.get_available_container_names(all_containers=True)
        running = [f"'{c['name']}'" for c in available if c['status'] == 'running']
        stopped = [f"'{c['name']}'" for c in available if c['status'] != 'running']

        workspace = Path(".").resolve()
        compose_files = [workspace / "docker-compose.yml", workspace / "docker-compose.yaml", workspace / "compose.yml"]
        has_compose = any(f.exists() for f in compose_files)
        has_dockerfile = (workspace / "Dockerfile").exists()

        clean_target = re.sub(r'[^a-zA-Z0-9_.-]', '-', target.strip()).lower().strip('-._') or "app"
        clean_image = clean_target.replace("-", ":") if "-" in clean_target else f"{clean_target}:app"

        if has_compose:
            solution = f"Target '{target}' is defined in Docker Compose. Start it first with: 'docker compose up -d'"
        elif has_dockerfile:
            solution = (
                f"Target '{target}' is defined in Dockerfile but not started on Docker.\n"
                f"   Build and start it with:\n"
                f"     $ docker build -t {clean_image} .\n"
                f"     $ docker run -d --name {clean_target} -p 8000:8000 {clean_image}"
            )
        else:
            solution = f"Start your container first with: 'docker run -d --name {clean_target} <image>' before injecting faults."

        msg = f"Target container '{target}' not found on Docker daemon.\n👉 {solution}"
        if running:
            msg += f"\nCurrently Running: [{', '.join(running)}]."
        if stopped:
            msg += f"\nCurrently Stopped: [{', '.join(stopped)}]."
        if not available:
            msg += "\nNo Docker containers currently exist on this host."
        raise NotFound(msg)

    def find_container(self, target: str) -> Optional[docker.models.containers.Container]:
        """
        Find container by exact name, short ID, Docker Compose service name, or normalized name.
        """
        client = self.require_client()
        clean_target = target.strip().lower().lstrip('/')
        norm_target = re.sub(r'[-_.]', '', clean_target)

        # 1. Try exact lookup by name or ID
        try:
            return client.containers.get(target)
        except (NotFound, APIError):
            pass

        candidates = client.containers.list(all=True)

        # 2. Match exact name (case-insensitive, strip slash)
        for c in candidates:
            c_name = c.name.lower().lstrip('/')
            if c_name == clean_target:
                return c

        # 3. Match normalized name (ignoring hyphens/underscores/dots)
        for c in candidates:
            c_name = c.name.lower().lstrip('/')
            norm_name = re.sub(r'[-_.]', '', c_name)
            if norm_name == norm_target:
                return c

        # 4. Match service label from Docker Compose or Dockerfile convention
        for c in candidates:
            labels = c.labels or {}
            service = str(labels.get("com.docker.compose.service") or "").lower()
            if service and (service == clean_target or re.sub(r'[-_.]', '', service) == norm_target):
                return c

        # 5. Match compose container format: e.g. <project>-<target>-<num>
        for c in candidates:
            c_name = c.name.lower().lstrip('/')
            if (
                c_name.startswith(f"{clean_target}-")
                or c_name.startswith(f"{clean_target}_")
                or c_name.endswith(f"-{clean_target}")
                or c_name.endswith(f"_{clean_target}")
            ):
                return c

        # 6. Substring / partial match
        for c in candidates:
            c_name = c.name.lower().lstrip('/')
            if clean_target in c_name or c_name in clean_target:
                return c

        # 7. Match image tags
        for c in candidates:
            tags = c.image.tags if c.image and c.image.tags else []
            for tag in tags:
                tag_lower = tag.lower()
        # 8. If defined in Docker Compose, attempt auto-launching service
        workspace = Path(".").resolve()
        compose_files = [workspace / "docker-compose.yml", workspace / "docker-compose.yaml", workspace / "compose.yml"]
        if any(f.exists() for f in compose_files):
            try:
                up_res = subprocess.run(["docker", "compose", "up", "-d", clean_target], capture_output=True, text=True, timeout=25)
                if up_res.returncode == 0:
                    time.sleep(2)
                    for c in client.containers.list(all=True):
                        c_name = c.name.lower().lstrip('/')
                        if c_name == clean_target or clean_target in c_name:
                            return c
            except Exception:
                pass

        return None

    def get_container_info(self, container_or_name: Any) -> Dict[str, Any]:
        container = (
            container_or_name
            if hasattr(container_or_name, "status")
            else self.find_container(str(container_or_name))
        )
        if not container:
            return {"exists": False, "status": "not_found"}

        container.reload()
        state = container.attrs.get("State", {})
        labels = container.labels or {}
        return {
            "exists": True,
            "id": container.short_id,
            "name": container.name,
            "service": labels.get("com.docker.compose.service", container.name),
            "status": container.status,
            "running": state.get("Running", False),
            "started_at": state.get("StartedAt"),
            "finished_at": state.get("FinishedAt"),
            "exit_code": state.get("ExitCode"),
            "restart_count": container.attrs.get("RestartCount", 0),
        }

    # ==========================================
    # CONTAINER LIFECYCLE FAULTS
    # ==========================================

    def restart_container(self, target: str, timeout: int = 10) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        t0 = time.time()
        container.restart(timeout=timeout)
        duration = round(time.time() - t0, 2)

        container.reload()
        return {
            "container_name": container.name,
            "status": container.status,
            "running": container.status == "running",
            "restart_duration_seconds": duration,
        }

    def stop_container(self, target: str, timeout: int = 10) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        container.stop(timeout=timeout)
        container.reload()
        return {
            "container_name": container.name,
            "status": container.status,
            "running": False,
        }

    def start_container(self, target: str) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        if container.status != "running":
            container.start()
            container.reload()
        return {
            "container_name": container.name,
            "status": container.status,
            "running": container.status == "running",
        }

    def kill_fault_processes(self, target: str) -> None:
        """
        Safely kills any active fault workloads (stress-ng, stress, burnout scripts)
        inside the container upon cancellation.
        """
        container = self.find_container(target)
        if not container:
            return
        try:
            container.reload()
            if container.status != "running":
                return
            container.exec_run("pkill -9 -f stress-ng", privileged=True)
            container.exec_run("pkill -9 -f stress", privileged=True)
            container.exec_run("pkill -9 -f noir_cpu_burn", privileged=True)
            container.exec_run("pkill -9 -f noir_mem", privileged=True)
            container.exec_run("pkill -9 -f multiprocessing", privileged=True)
            container.exec_run("rm -f /dev/shm/noir_mem.tmp /tmp/noir_mem.tmp", privileged=True)
        except Exception:
            pass

    # ==========================================
    # IN-CONTAINER EXECUTION & NETWORK CONTROL
    # ==========================================

    def exec_run(self, target: str, cmd: str, privileged: bool = False) -> Tuple[int, str]:

        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        # Auto-wake container if stopped on Docker daemon
        if container.status != "running":
            try:
                container.start()
                container.reload()
                time.sleep(1)
            except Exception as start_err:
                raise RuntimeError(f"Target container '{container.name}' is stopped (status: {container.status}) and failed to auto-start: {start_err}")

        res = container.exec_run(cmd, privileged=privileged)
        exit_code = res.exit_code
        output = res.output.decode("utf-8", errors="replace") if res.output else ""
        return exit_code, output

    def _ensure_chaos_netem_image(self) -> str:
        """Ensure a local image with iproute2/tc exists for sidecar netem execution."""
        client = self.require_client()
        image_name = "noir-chaos-netem:latest"
        try:
            client.images.get(image_name)
            return image_name
        except Exception:
            pass

        # Try to pull gaiadocker/iproute2 or build local minimal alpine image with iproute2
        try:
            client.images.pull("gaiadocker/iproute2:latest")
            return "gaiadocker/iproute2:latest"
        except Exception:
            pass

        try:
            dockerfile = io.BytesIO(b"FROM alpine:latest\nRUN apk add --no-cache iproute2\nENTRYPOINT [\"tc\"]\n")
            client.images.build(fileobj=dockerfile, tag=image_name, rm=True)
            return image_name
        except Exception:
            return ""

    def _exec_tc_command(self, target: str, tc_args: str) -> Tuple[int, str]:
        """
        Executes a tc (Traffic Control) command inside the target container's network namespace.
        1. Attempts direct exec inside target container.
        2. If target lacks 'tc' or NET_ADMIN capability, launches an ephemeral sidecar container
           attached to the target's network namespace (--net=container:<target> --cap-add=NET_ADMIN).
        """
        # 1. Direct exec attempt
        code, out = self.exec_run(target, f"tc {tc_args}", privileged=True)
        if code == 0:
            return code, out

        # 2. Sidecar fallback attached to target network namespace
        sidecar_image = self._ensure_chaos_netem_image()
        if sidecar_image:
            try:
                client = self.require_client()
                cmd = tc_args if "noir-chaos-netem" in sidecar_image else f"tc {tc_args}"
                res = client.containers.run(
                    image=sidecar_image,
                    command=cmd,
                    network_mode=f"container:{target}",
                    cap_add=["NET_ADMIN"],
                    remove=True,
                    stdout=True,
                    stderr=True,
                )
                output = res.decode("utf-8", errors="replace") if isinstance(res, bytes) else str(res or "")
                return 0, output
            except docker.errors.ContainerError as ce:
                err_msg = ce.stderr.decode("utf-8", errors="replace") if hasattr(ce, "stderr") and ce.stderr else str(ce)
                return ce.exit_status or 1, err_msg
            except Exception as e:
                pass

        return code, out

    def apply_network_delay(
        self, target: str, latency_ms: int = 500, jitter_ms: int = 50, interface: str = "eth0"
    ) -> Dict[str, Any]:
        interface = _validate_interface(interface)
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        # Clean existing rule first
        self.remove_network_delay(target, interface=interface)

        # Apply netem delay via Linux tc (traffic control)
        tc_args = f"qdisc add dev {interface} root netem delay {latency_ms}ms {jitter_ms}ms"
        code, out = self._exec_tc_command(target, tc_args)

        if code != 0:
            raise RuntimeError(
                f"Failed to inject network delay on '{container.name}': {out.strip() or 'Exit ' + str(code)}. "
                f"Ensure interface '{interface}' exists and container has network connectivity."
            )

        return {
            "container_name": container.name,
            "interface": interface,
            "latency_ms": latency_ms,
            "jitter_ms": jitter_ms,
            "applied": True,
        }

    def remove_network_delay(self, target: str, interface: str = "eth0") -> bool:
        interface = _validate_interface(interface)
        container = self.find_container(target)
        if not container or container.status != "running":
            return True

        tc_args = f"qdisc del dev {interface} root"
        self._exec_tc_command(target, tc_args)
        return True

    def apply_network_loss(
        self, target: str, loss_percent: float = 20.0, interface: str = "eth0"
    ) -> Dict[str, Any]:
        interface = _validate_interface(interface)
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        self.remove_network_delay(target, interface=interface)

        tc_args = f"qdisc add dev {interface} root netem loss {loss_percent}%"
        code, out = self._exec_tc_command(target, tc_args)

        if code != 0:
            raise RuntimeError(
                f"Failed to inject packet loss on '{container.name}': {out.strip() or 'Exit ' + str(code)}. "
                f"Ensure interface '{interface}' exists and container has network connectivity."
            )

        return {
            "container_name": container.name,
            "interface": interface,
            "loss_percent": loss_percent,
            "applied": True,
        }

    # ==========================================
    # RESOURCE STRESS (CPU / MEMORY)
    # ==========================================

    def apply_cpu_stress(self, target: str, workers: int = 2, duration_sec: int = 10) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        # Check for stress-ng or stress, otherwise use background python / shell arithmetic loop
        check_stress, _ = self.exec_run(target, "which stress-ng")
        if check_stress == 0:
            cmd = f"stress-ng --cpu {workers} --timeout {duration_sec}s --temp-path /tmp"
        else:
            check_stress2, _ = self.exec_run(target, "which stress")
            if check_stress2 == 0:
                cmd = f"stress --cpu {workers} --timeout {duration_sec}s"
            else:
                check_py3, _ = self.exec_run(target, "which python3")
                check_py, _ = self.exec_run(target, "which python")
                py_bin = "python3" if check_py3 == 0 else ("python" if check_py == 0 else None)
                if py_bin:
                    py_script = (
                        "import time, multiprocessing as mp\n"
                        "def noir_cpu_burn():\n"
                        f"    end = time.time() + {duration_sec}\n"
                        "    while time.time() < end:\n"
                        "        _ = 99999 * 99999\n"
                        "if __name__ == '__main__':\n"
                        f"    procs = [mp.Process(target=noir_cpu_burn) for _ in range({workers})]\n"
                        "    for p in procs: p.start()\n"
                        "    for p in procs: p.join()\n"
                    )
                    cmd = [py_bin, "-c", py_script]
                else:
                    cmd = [
                        "sh", "-c",
                        f"end=$(( $(date +%s) + {duration_sec} )); "
                        f"for i in $(seq 1 {workers}); do "
                        f"  ( while [ $(date +%s) -lt $end ]; do :; done ) & "
                        f"done; "
                        f"wait"
                    ]

        code, out = self.exec_run(target, cmd)
        return {
            "container_name": container.name,
            "workers": workers,
            "duration_sec": duration_sec,
            "exit_code": code,
            "output": out[:500] if out else "",
        }

    def apply_memory_stress(self, target: str, memory_mb: int = 256, duration_sec: int = 10) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            self._raise_container_not_found(target)

        check_stress, _ = self.exec_run(target, "which stress-ng")
        if check_stress == 0:
            cmd = f"stress-ng --vm 1 --vm-bytes {memory_mb}M --timeout {duration_sec}s"
        else:
            check_stress2, _ = self.exec_run(target, "which stress")
            if check_stress2 == 0:
                cmd = f"stress --vm 1 --vm-bytes {memory_mb}M --timeout {duration_sec}s"
            else:
                check_py3, _ = self.exec_run(target, "which python3")
                check_py, _ = self.exec_run(target, "which python")
                py_bin = "python3" if check_py3 == 0 else ("python" if check_py == 0 else None)
                if py_bin:
                    bytes_to_alloc = memory_mb * 1024 * 1024
                    py_script = (
                        "import time\n"
                        f"b = bytearray({bytes_to_alloc})\n"
                        f"time.sleep({duration_sec})\n"
                        "del b\n"
                    )
                    cmd = [py_bin, "-c", py_script]
                else:
                    cmd = [
                        "sh", "-c",
                        f"head -c {memory_mb}M </dev/zero >/dev/shm/noir_mem.tmp 2>/dev/null || head -c {memory_mb}M </dev/zero >/tmp/noir_mem.tmp; "
                        f"sleep {duration_sec}; "
                        f"rm -f /dev/shm/noir_mem.tmp /tmp/noir_mem.tmp"
                    ]

        code, out = self.exec_run(target, cmd)
        return {
            "container_name": container.name,
            "memory_mb": memory_mb,
            "duration_sec": duration_sec,
            "exit_code": code,
            "output": out[:500] if out else "",
        }

    def stream_logs(self, target: str, tail: int = 15) -> List[str]:
        container = self.find_container(target)
        if not container:
            return []
        try:
            raw = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
            return [line for line in raw.split("\n") if line.strip()]
        except Exception:
            return []

    def get_container_endpoint(self, target: str) -> Optional[str]:
        """Auto-discovers the primary exposed HTTP endpoint for a container."""
        container = self.find_container(target)
        if not container:
            return None
        ports = (container.attrs or {}).get("NetworkSettings", {}).get("Ports") or {}
        # Prioritize standard web ports if mapped
        preferred = ["80/tcp", "8080/tcp", "3000/tcp", "5000/tcp", "8000/tcp"]
        for pref in preferred:
            bindings = ports.get(pref)
            if bindings and isinstance(bindings, list) and len(bindings) > 0:
                host_port = bindings[0].get("HostPort")
                if host_port:
                    return f"http://localhost:{host_port}/"

        # Fallback to any mapped port
        for port_key, bindings in ports.items():
            if bindings and isinstance(bindings, list) and len(bindings) > 0:
                host_port = bindings[0].get("HostPort")
                if host_port:
                    return f"http://localhost:{host_port}/"
        return None
