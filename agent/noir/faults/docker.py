import time
from typing import Dict, Any, List, Optional, Tuple
import docker
from docker.errors import DockerException, NotFound, APIError


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

    def find_container(self, target: str) -> Optional[docker.models.containers.Container]:
        """
        Find container by exact name, short ID, or Docker Compose service name.
        """
        client = self.require_client()
        clean_target = target.strip().lower()

        # 1. Try exact lookup by name or ID
        try:
            return client.containers.get(target)
        except (NotFound, APIError):
            pass

        # 2. Iterate and match service label or partial name
        candidates = client.containers.list(all=True)
        for c in candidates:
            if c.name.lower() == clean_target:
                return c
            service = (c.labels or {}).get("com.docker.compose.service", "").lower()
            if service and service == clean_target:
                return c

        for c in candidates:
            if clean_target in c.name.lower():
                return c

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
            raise NotFound(f"Target container '{target}' not found.")

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
            raise NotFound(f"Target container '{target}' not found.")

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
            raise NotFound(f"Target container '{target}' not found.")

        if container.status != "running":
            container.start()
            container.reload()
        return {
            "container_name": container.name,
            "status": container.status,
            "running": container.status == "running",
        }

    # ==========================================
    # IN-CONTAINER EXECUTION & NETWORK CONTROL
    # ==========================================

    def exec_run(self, target: str, cmd: str, privileged: bool = False) -> Tuple[int, str]:
        container = self.find_container(target)
        if not container:
            raise NotFound(f"Target container '{target}' not found.")

        res = container.exec_run(cmd, privileged=privileged)
        exit_code = res.exit_code
        output = res.output.decode("utf-8", errors="replace") if res.output else ""
        return exit_code, output

    def apply_network_delay(
        self, target: str, latency_ms: int = 500, jitter_ms: int = 50, interface: str = "eth0"
    ) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            raise NotFound(f"Target container '{target}' not found.")

        # Clean existing rule first
        self.remove_network_delay(target, interface=interface)

        # Apply netem delay via Linux tc (traffic control)
        cmd = f"tc qdisc add dev {interface} root netem delay {latency_ms}ms {jitter_ms}ms"
        code, out = self.exec_run(target, cmd, privileged=True)

        if code != 0:
            # Check if tc is installed
            check_code, _ = self.exec_run(target, "which tc")
            if check_code != 0:
                raise RuntimeError(
                    f"Container '{container.name}' lacks 'tc' (iproute2) or NET_ADMIN capability. "
                    "Install iproute2 or add cap_add: [NET_ADMIN] to Docker Compose."
                )
            raise RuntimeError(f"Failed to inject network delay: {out.strip()}")

        return {
            "container_name": container.name,
            "interface": interface,
            "latency_ms": latency_ms,
            "jitter_ms": jitter_ms,
            "applied": True,
        }

    def remove_network_delay(self, target: str, interface: str = "eth0") -> bool:
        container = self.find_container(target)
        if not container or container.status != "running":
            return True

        cmd = f"tc qdisc del dev {interface} root"
        self.exec_run(target, cmd, privileged=True)
        return True

    def apply_network_loss(
        self, target: str, loss_percent: float = 20.0, interface: str = "eth0"
    ) -> Dict[str, Any]:
        container = self.find_container(target)
        if not container:
            raise NotFound(f"Target container '{target}' not found.")

        self.remove_network_delay(target, interface=interface)

        cmd = f"tc qdisc add dev {interface} root netem loss {loss_percent}%"
        code, out = self.exec_run(target, cmd, privileged=True)

        if code != 0:
            check_code, _ = self.exec_run(target, "which tc")
            if check_code != 0:
                raise RuntimeError(
                    f"Container '{container.name}' lacks 'tc' (iproute2) or NET_ADMIN capability."
                )
            raise RuntimeError(f"Failed to inject packet loss: {out.strip()}")

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
            raise NotFound(f"Target container '{target}' not found.")

        # Check for stress-ng or stress, otherwise use background python / shell arithmetic loop
        check_stress, _ = self.exec_run(target, "which stress-ng")
        if check_stress == 0:
            cmd = f"stress-ng --cpu {workers} --timeout {duration_sec}s --temp-path /tmp"
        else:
            check_stress2, _ = self.exec_run(target, "which stress")
            if check_stress2 == 0:
                cmd = f"stress --cpu {workers} --timeout {duration_sec}s"
            else:
                # Built-in lightweight fallback: spawn python worker processes with timeout
                cmd = (
                    f"python3 -c \""
                    f"import time, multiprocessing as mp; "
                    f"def burn(): "
                    f"  t=time.time()+{duration_sec}; "
                    f"  while time.time()<t: pass; "
                    f"ps = [mp.Process(target=burn) for _ in range({workers})]; "
                    f"[p.start() for p in ps]; [p.join() for p in ps]\""
                )

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
            raise NotFound(f"Target container '{target}' not found.")

        check_stress, _ = self.exec_run(target, "which stress-ng")
        if check_stress == 0:
            cmd = f"stress-ng --vm 1 --vm-bytes {memory_mb}M --timeout {duration_sec}s"
        else:
            check_stress2, _ = self.exec_run(target, "which stress")
            if check_stress2 == 0:
                cmd = f"stress --vm 1 --vm-bytes {memory_mb}M --timeout {duration_sec}s"
            else:
                # Built-in python fallback: allocate bytearray and hold for duration
                bytes_to_alloc = memory_mb * 1024 * 1024
                cmd = (
                    f"python3 -c \""
                    f"import time; "
                    f"b = bytearray({bytes_to_alloc}); "
                    f"time.sleep({duration_sec}); "
                    f"del b\""
                )

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
