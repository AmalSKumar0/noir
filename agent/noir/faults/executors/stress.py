import time
from typing import Dict, Any, Optional
from ..base import FaultExecutor, FaultResult


class CpuStressExecutor(FaultExecutor):
    name = "cpu_stress"
    display_name = "CPU Stress / Load"
    description = "Simulates high CPU utilization inside container using worker processes for a bounded duration."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        workers = params.get("workers", 2)
        try:
            workers = int(workers)
            if workers < 1 or workers > 16:
                raise ValueError("workers must be between 1 and 16.")
            normalized["workers"] = workers
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid workers parameter: {e}")

        duration = params.get("duration", 10)
        try:
            duration = int(duration)
            if duration < 1 or duration > 300:
                raise ValueError("duration must be between 1 and 300 seconds.")
            normalized["duration"] = duration
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid duration parameter: {e}")

        return normalized

    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        validated = self.validate_parameters(params)
        workers = validated["workers"]
        duration = validated["duration"]

        t0 = time.time()
        try:
            res = docker_mgr.apply_cpu_stress(container_name, workers=workers, duration_sec=duration)
            elapsed = round(time.time() - t0, 2)

            return FaultResult(
                success=True,
                message=f"Applied CPU stress with {workers} worker(s) on '{container_name}' for {duration}s.",
                details={
                    "target": container_name,
                    "workers": workers,
                    "duration_seconds": duration,
                    "exit_code": res.get("exit_code", 0),
                },
                duration_seconds=elapsed,
                recovered=True,
            )
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"CPU stress injection failed on container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=elapsed,
                recovered=True,
                error=str(e),
            )


class MemoryStressExecutor(FaultExecutor):
    name = "memory_stress"
    display_name = "Memory Stress / Pressure"
    description = "Simulates memory pressure by allocating a designated buffer inside the container for a bounded duration."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        memory_mb = params.get("memory_mb", 256)
        try:
            memory_mb = int(memory_mb)
            if memory_mb < 16 or memory_mb > 4096:
                raise ValueError("memory_mb must be between 16 and 4096 MB.")
            normalized["memory_mb"] = memory_mb
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid memory_mb parameter: {e}")

        duration = params.get("duration", 10)
        try:
            duration = int(duration)
            if duration < 1 or duration > 300:
                raise ValueError("duration must be between 1 and 300 seconds.")
            normalized["duration"] = duration
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid duration parameter: {e}")

        return normalized

    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        validated = self.validate_parameters(params)
        memory_mb = validated["memory_mb"]
        duration = validated["duration"]

        t0 = time.time()
        try:
            res = docker_mgr.apply_memory_stress(container_name, memory_mb=memory_mb, duration_sec=duration)
            elapsed = round(time.time() - t0, 2)

            return FaultResult(
                success=True,
                message=f"Applied {memory_mb}MB memory stress on '{container_name}' for {duration}s.",
                details={
                    "target": container_name,
                    "memory_mb": memory_mb,
                    "duration_seconds": duration,
                    "exit_code": res.get("exit_code", 0),
                },
                duration_seconds=elapsed,
                recovered=True,
            )
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Memory stress injection failed on container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=elapsed,
                recovered=True,
                error=str(e),
            )
