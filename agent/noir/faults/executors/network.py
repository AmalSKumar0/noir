import time
import re
from typing import Dict, Any, Optional
from ..base import FaultExecutor, FaultResult

INTERFACE_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")


class NetworkDelayExecutor(FaultExecutor):
    name = "network_delay"
    display_name = "Network Latency / Delay"
    description = "Injects artificial network packet latency (with optional jitter) into container network interface using Linux Traffic Control."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        latency = params.get("latency_ms", 500)
        try:
            latency = int(latency)
            if latency < 1 or latency > 5000:
                raise ValueError("latency_ms must be between 1 and 5000 milliseconds.")
            normalized["latency_ms"] = latency
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid latency_ms parameter: {e}")

        jitter = params.get("jitter_ms", 50)
        try:
            jitter = int(jitter)
            if jitter < 0 or jitter > 1000:
                raise ValueError("jitter_ms must be between 0 and 1000 milliseconds.")
            normalized["jitter_ms"] = jitter
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid jitter_ms parameter: {e}")

        duration = params.get("duration", 10)
        try:
            duration = int(duration)
            if duration < 1 or duration > 300:
                raise ValueError("duration must be between 1 and 300 seconds.")
            normalized["duration"] = duration
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid duration parameter: {e}")

        interface = str(params.get("interface", "eth0")).strip()
        if not INTERFACE_REGEX.match(interface):
            raise ValueError(f"Invalid interface name format: '{interface}'")
        normalized["interface"] = interface
        return normalized

    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        validated = self.validate_parameters(params)
        latency_ms = validated["latency_ms"]
        jitter_ms = validated["jitter_ms"]
        duration = validated["duration"]
        interface = validated["interface"]

        t0 = time.time()
        try:
            if context and context.get("log"):
                context["log"](f"Applying network delay {latency_ms}ms (jitter ±{jitter_ms}ms) on {interface}...")

            # 1. Apply latency
            res = docker_mgr.apply_network_delay(
                container_name, latency_ms=latency_ms, jitter_ms=jitter_ms, interface=interface
            )

            # 2. Hold for duration with cancellation checking and periodic logging
            step = 0.5
            loops = int(duration / step)
            for i in range(loops):
                if context and context.get("is_cancelled") and context["is_cancelled"]():
                    self.rollback(docker_mgr, container_name, params)
                    if context.get("log"):
                        context["log"](f"Execution cancelled by user. Removed network delay on '{container_name}'.", level="WARN")
                    raise InterruptedError(f"Network delay on '{container_name}' cancelled by user.")
                time.sleep(step)
                if context and context.get("log") and (i + 1) % 4 == 0:
                    elapsed_sec = int((i + 1) * step)
                    context["log"](f"Network latency active: +{latency_ms}ms on {container_name} ({elapsed_sec}s / {duration}s)")

            # 3. Clean up / rollback latency rule
            docker_mgr.remove_network_delay(container_name, interface=interface)
            if context and context.get("log"):
                context["log"](f"Cleaned up network delay on '{container_name}'. Restored normal traffic.")

            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=True,
                message=f"Injected {latency_ms}ms delay (±{jitter_ms}ms) on '{container_name}' for {duration}s. Network restored.",
                details={
                    "target": container_name,
                    "latency_ms": latency_ms,
                    "jitter_ms": jitter_ms,
                    "duration_seconds": duration,
                    "interface": interface,
                },
                duration_seconds=elapsed,
                recovered=True,
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
            self.rollback(docker_mgr, container_name, params)
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Network delay injection failed on container '{container_name}': {e}",
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
        interface = str(params.get("interface", "eth0"))
        try:
            docker_mgr.remove_network_delay(container_name, interface=interface)
            return True
        except Exception:
            return False


class NetworkLossExecutor(FaultExecutor):
    name = "network_loss"
    display_name = "Packet Loss"
    description = "Simulates packet loss on the container's network interface using Linux Traffic Control netem."
    requires_active_container = True

    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        loss = params.get("loss_percent", 20.0)
        try:
            loss = float(loss)
            if loss <= 0.0 or loss > 100.0:
                raise ValueError("loss_percent must be between 0.1 and 100.0 percent.")
            normalized["loss_percent"] = loss
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid loss_percent parameter: {e}")

        duration = params.get("duration", 10)
        try:
            duration = int(duration)
            if duration < 1 or duration > 300:
                raise ValueError("duration must be between 1 and 300 seconds.")
            normalized["duration"] = duration
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid duration parameter: {e}")

        interface = str(params.get("interface", "eth0")).strip()
        if not INTERFACE_REGEX.match(interface):
            raise ValueError(f"Invalid interface name format: '{interface}'")
        normalized["interface"] = interface
        return normalized

    def execute(
        self,
        docker_mgr: Any,
        container_name: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> FaultResult:
        validated = self.validate_parameters(params)
        loss_percent = validated["loss_percent"]
        duration = validated["duration"]
        interface = validated["interface"]

        t0 = time.time()
        try:
            if context and context.get("log"):
                context["log"](f"Applying packet loss {loss_percent}% on {interface}...")

            # 1. Apply packet loss
            docker_mgr.apply_network_loss(container_name, loss_percent=loss_percent, interface=interface)

            # 2. Hold for duration with cancellation checking and periodic logging
            step = 0.5
            loops = int(duration / step)
            for i in range(loops):
                if context and context.get("is_cancelled") and context["is_cancelled"]():
                    self.rollback(docker_mgr, container_name, params)
                    if context.get("log"):
                        context["log"](f"Execution cancelled by user. Restored packet delivery on '{container_name}'.", level="WARN")
                    raise InterruptedError(f"Packet loss on '{container_name}' cancelled by user.")
                time.sleep(step)
                if context and context.get("log") and (i + 1) % 4 == 0:
                    elapsed_sec = int((i + 1) * step)
                    context["log"](f"Packet loss active: {loss_percent}% on {container_name} ({elapsed_sec}s / {duration}s)")

            # 3. Clean up
            docker_mgr.remove_network_delay(container_name, interface=interface)
            if context and context.get("log"):
                context["log"](f"Cleaned up packet loss on '{container_name}'. Restored normal traffic.")

            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=True,
                message=f"Applied {loss_percent}% packet loss on '{container_name}' for {duration}s. Normal network restored.",
                details={
                    "target": container_name,
                    "loss_percent": loss_percent,
                    "duration_seconds": duration,
                    "interface": interface,
                },
                duration_seconds=elapsed,
                recovered=True,
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
            self.rollback(docker_mgr, container_name, params)
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Packet loss injection failed on container '{container_name}': {e}",
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
        interface = str(params.get("interface", "eth0"))
        try:
            docker_mgr.remove_network_delay(container_name, interface=interface)
            return True
        except Exception:
            return False
