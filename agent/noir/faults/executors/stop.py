import time
from typing import Dict, Any, Optional
from ..base import FaultExecutor, FaultResult


class ContainerStopExecutor(FaultExecutor):
    name = "container_stop"
    display_name = "Container Stop"
    description = "Stops the target container for a configured duration, then automatically restarts it to verify fault recovery."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        duration = params.get("duration", 15)
        try:
            duration = int(duration)
            if duration < 1 or duration > 120:
                raise ValueError("duration must be between 1 and 120 seconds.")
            normalized["duration"] = duration
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid duration parameter: {e}")

        timeout = params.get("timeout", 10)
        try:
            timeout = int(timeout)
            if timeout < 1 or timeout > 60:
                raise ValueError("timeout must be between 1 and 60 seconds.")
            normalized["timeout"] = timeout
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid timeout parameter: {e}")

        return normalized

    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        validated = self.validate_parameters(params)
        duration = validated["duration"]
        timeout = validated["timeout"]

        t0 = time.time()
        try:
            if context and context.get("log"):
                context["log"](f"Stopping container '{container_name}' (timeout: {timeout}s)...")

            # 1. Stop container
            docker_mgr.stop_container(container_name, timeout=timeout)
            if context and context.get("log"):
                context["log"](f"Container '{container_name}' stopped. Holding offline state for {duration}s...")

            # 2. Hold stopped state for duration with cancellation checking
            step = 0.25
            loops = int(duration / step)
            for i in range(loops):
                if context and context.get("is_cancelled") and context["is_cancelled"]():
                    self.rollback(docker_mgr, container_name, params)
                    if context.get("log"):
                        context["log"](f"Execution cancelled by user. Restarted container '{container_name}'.", level="WARN")
                    raise InterruptedError(f"Container stop on '{container_name}' cancelled by user.")
                time.sleep(step)
                if context and context.get("log") and (i + 1) % 8 == 0:
                    elapsed_sec = int((i + 1) * step)
                    context["log"](f"Container offline: '{container_name}' ({elapsed_sec}s / {duration}s)")

            # 3. Automatically recover / start container back up
            if context and context.get("log"):
                context["log"](f"Holding duration complete. Recovering and starting container '{container_name}'...")
            start_res = docker_mgr.start_container(container_name)
            elapsed = round(time.time() - t0, 2)
            recovered = start_res.get("running", False)

            if recovered:
                if context and context.get("log"):
                    context["log"](f"Container '{container_name}' restarted and healthy.")
                return FaultResult(
                    success=True,
                    message=f"Container '{container_name}' successfully stopped for {duration}s and recovered.",
                    details={
                        "target": container_name,
                        "stopped_duration_seconds": duration,
                        "total_duration_seconds": elapsed,
                        "status": "running",
                    },
                    duration_seconds=elapsed,
                    recovered=True,
                )
            else:
                return FaultResult(
                    success=False,
                    message=f"Container '{container_name}' failed to restart after {duration}s stop period.",
                    details={"target": container_name, "error": "Container failed to resume running state."},
                    duration_seconds=elapsed,
                    recovered=False,
                    error="Container restart failed after stop window.",
                )
        except InterruptedError as ie:
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=str(ie),
                details={"target": container_name, "cancelled": True},
                duration_seconds=elapsed,
                recovered=True,
                error="Cancelled by user.",
            )
        except Exception as e:
            # Attempt recovery
            self.rollback(docker_mgr, container_name, params)
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Error executing stop fault on container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=elapsed,
                recovered=False,
                error=str(e),
            )


    def rollback(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        try:
            info = docker_mgr.get_container_info(container_name)
            if not info.get("running", False):
                docker_mgr.start_container(container_name)
            return True
        except Exception:
            return False
