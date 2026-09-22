import time
from typing import Dict, Any, Optional
from ..base import FaultExecutor, FaultResult


class ContainerRestartExecutor(FaultExecutor):
    name = "container_restart"
    display_name = "Container Restart"
    description = "Gracefully stops and restarts the target container to test system recovery and reconnection."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
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
        timeout = validated["timeout"]

        t0 = time.time()
        try:
            res = docker_mgr.restart_container(container_name, timeout=timeout)
            duration = round(time.time() - t0, 2)
            is_running = res.get("running", False)

            if is_running:
                return FaultResult(
                    success=True,
                    message=f"Container '{container_name}' successfully restarted and confirmed running in {duration}s.",
                    details={
                        "target": container_name,
                        "timeout": timeout,
                        "restart_duration_seconds": duration,
                        "status": res.get("status", "running"),
                    },
                    duration_seconds=duration,
                    recovered=True,
                )
            else:
                return FaultResult(
                    success=False,
                    message=f"Container '{container_name}' failed to resume running state after restart.",
                    details=res,
                    duration_seconds=duration,
                    recovered=False,
                    error=f"Container status is '{res.get('status')}' instead of running.",
                )
        except Exception as e:
            duration = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Failed to restart container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=duration,
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
