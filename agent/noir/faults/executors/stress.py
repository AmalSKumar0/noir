import time
import threading
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
            if context and context.get("log"):
                context["log"](f"Applying CPU stress ({workers} workers) on '{container_name}' for {duration}s...")

            exec_result = {}
            exec_error = []

            def run_stress():
                try:
                    exec_result["res"] = docker_mgr.apply_cpu_stress(container_name, workers=workers, duration_sec=duration)
                except Exception as e:
                    exec_error.append(e)

            thread = threading.Thread(target=run_stress, daemon=True)
            thread.start()

            step = 0.25
            last_logged_sec = 0
            while thread.is_alive():
                if context and context.get("is_cancelled") and context["is_cancelled"]():
                    docker_mgr.kill_fault_processes(container_name)
                    if context.get("log"):
                        context["log"](f"Execution cancelled by user. Terminated CPU stress processes in '{container_name}'.", level="WARN")
                    raise InterruptedError(f"CPU stress on '{container_name}' cancelled by user.")

                thread.join(timeout=step)
                elapsed = int(time.time() - t0)
                if context and context.get("log") and elapsed > 0 and elapsed % 3 == 0 and elapsed != last_logged_sec:
                    last_logged_sec = elapsed
                    context["log"](f"CPU stress active on '{container_name}' ({elapsed}s / {duration}s)...")

            if exec_error:
                raise exec_error[0]

            res = exec_result.get("res", {})
            exit_code = res.get("exit_code", 0)
            elapsed = round(time.time() - t0, 2)

            if exit_code != 0:
                out_err = res.get("output", "").strip() or f"Process exited with non-zero status code {exit_code}."
                err_msg = f"CPU stress process failed inside container '{container_name}': {out_err}"
                if context and context.get("log"):
                    context["log"](err_msg, level="ERROR")
                return FaultResult(
                    success=False,
                    message=err_msg,
                    details={
                        "target": container_name,
                        "workers": workers,
                        "duration_seconds": duration,
                        "exit_code": exit_code,
                        "output": out_err,
                    },
                    duration_seconds=elapsed,
                    recovered=True,
                    error=err_msg,
                )

            if context and context.get("log"):
                context["log"](f"CPU stress completed successfully on '{container_name}' ({elapsed}s).")

            return FaultResult(
                success=True,
                message=f"Applied CPU stress with {workers} worker(s) on '{container_name}' for {duration}s.",
                details={
                    "target": container_name,
                    "workers": workers,
                    "duration_seconds": duration,
                    "exit_code": exit_code,
                },
                duration_seconds=elapsed,
                recovered=True,
            )
        except InterruptedError as ie:
            docker_mgr.kill_fault_processes(container_name)
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
            docker_mgr.kill_fault_processes(container_name)
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"CPU stress injection failed on container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=elapsed,
                recovered=True,
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
            docker_mgr.kill_fault_processes(container_name)
            return True
        except Exception:
            return False


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
            if context and context.get("log"):
                context["log"](f"Applying memory pressure ({memory_mb}MB) on '{container_name}' for {duration}s...")

            exec_result = {}
            exec_error = []

            def run_stress():
                try:
                    exec_result["res"] = docker_mgr.apply_memory_stress(container_name, memory_mb=memory_mb, duration_sec=duration)
                except Exception as e:
                    exec_error.append(e)

            thread = threading.Thread(target=run_stress, daemon=True)
            thread.start()

            step = 0.25
            last_logged_sec = 0
            while thread.is_alive():
                if context and context.get("is_cancelled") and context["is_cancelled"]():
                    docker_mgr.kill_fault_processes(container_name)
                    if context.get("log"):
                        context["log"](f"Execution cancelled by user. Released memory buffer in '{container_name}'.", level="WARN")
                    raise InterruptedError(f"Memory stress on '{container_name}' cancelled by user.")

                thread.join(timeout=step)
                elapsed = int(time.time() - t0)
                if context and context.get("log") and elapsed > 0 and elapsed % 3 == 0 and elapsed != last_logged_sec:
                    last_logged_sec = elapsed
                    context["log"](f"Memory pressure active on '{container_name}': {memory_mb}MB ({elapsed}s / {duration}s)...")

            if exec_error:
                raise exec_error[0]

            res = exec_result.get("res", {})
            exit_code = res.get("exit_code", 0)
            elapsed = round(time.time() - t0, 2)

            if exit_code != 0:
                out_err = res.get("output", "").strip() or f"Process exited with non-zero status code {exit_code}."
                err_msg = f"Memory stress process failed inside container '{container_name}': {out_err}"
                if context and context.get("log"):
                    context["log"](err_msg, level="ERROR")
                return FaultResult(
                    success=False,
                    message=err_msg,
                    details={
                        "target": container_name,
                        "memory_mb": memory_mb,
                        "duration_seconds": duration,
                        "exit_code": exit_code,
                        "output": out_err,
                    },
                    duration_seconds=elapsed,
                    recovered=True,
                    error=err_msg,
                )

            if context and context.get("log"):
                context["log"](f"Memory pressure completed and buffer released on '{container_name}' ({elapsed}s).")

            return FaultResult(
                success=True,
                message=f"Applied {memory_mb}MB memory stress on '{container_name}' for {duration}s.",
                details={
                    "target": container_name,
                    "memory_mb": memory_mb,
                    "duration_seconds": duration,
                    "exit_code": exit_code,
                },
                duration_seconds=elapsed,
                recovered=True,
            )
        except InterruptedError as ie:
            docker_mgr.kill_fault_processes(container_name)
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
            docker_mgr.kill_fault_processes(container_name)
            elapsed = round(time.time() - t0, 2)
            return FaultResult(
                success=False,
                message=f"Memory stress injection failed on container '{container_name}': {e}",
                details={"target": container_name, "error": str(e)},
                duration_seconds=elapsed,
                recovered=True,
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
            docker_mgr.kill_fault_processes(container_name)
            return True
        except Exception:
            return False

