import time
import math
import threading
from typing import Dict, Any, List, Optional
import urllib.request
import urllib.error

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class ProbeResult:
    def __init__(
        self,
        timestamp: float,
        status_code: Optional[int],
        latency_ms: float,
        success: bool,
        error: Optional[str] = None,
    ):
        self.timestamp = timestamp
        self.status_code = status_code
        self.latency_ms = latency_ms
        self.success = success
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 3),
            "status_code": self.status_code,
            "latency_ms": round(self.latency_ms, 2),
            "success": self.success,
            "error": self.error,
        }


class ChaosProbe:
    """Sends lightweight HTTP health probes and measures status and latency."""

    @staticmethod
    def probe(url: str, timeout_sec: float = 3.0, expected_status: int = 200) -> ProbeResult:
        t0 = time.time()
        # Prefer httpx if installed, fallback to urllib
        if HAS_HTTPX:
            try:
                with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
                    resp = client.get(url)
                    elapsed_ms = round((time.time() - t0) * 1000, 2)
                    success = (resp.status_code == expected_status) or (200 <= resp.status_code < 400)
                    return ProbeResult(
                        timestamp=t0,
                        status_code=resp.status_code,
                        latency_ms=elapsed_ms,
                        success=success,
                        error=None if success else f"HTTP {resp.status_code}",
                    )
            except Exception as e:
                elapsed_ms = round((time.time() - t0) * 1000, 2)
                return ProbeResult(
                    timestamp=t0,
                    status_code=None,
                    latency_ms=elapsed_ms,
                    success=False,
                    error=str(e),
                )
        else:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Noir-Chaos-Probe/1.0"})
                with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                    elapsed_ms = round((time.time() - t0) * 1000, 2)
                    code = resp.getcode()
                    success = (code == expected_status) or (200 <= code < 400)
                    return ProbeResult(
                        timestamp=t0,
                        status_code=code,
                        latency_ms=elapsed_ms,
                        success=success,
                    )
            except urllib.error.HTTPError as he:
                elapsed_ms = round((time.time() - t0) * 1000, 2)
                return ProbeResult(
                    timestamp=t0,
                    status_code=he.code,
                    latency_ms=elapsed_ms,
                    success=(he.code == expected_status),
                    error=f"HTTP {he.code}",
                )
            except Exception as e:
                elapsed_ms = round((time.time() - t0) * 1000, 2)
                return ProbeResult(
                    timestamp=t0,
                    status_code=None,
                    latency_ms=elapsed_ms,
                    success=False,
                    error=str(e),
                )


class SteadyStateEvaluator:
    """
    Manages the full lifecycle of a Chaos Engineering experiment:
    1. Pre-fault steady state baseline measurement
    2. In-fault active synthetic probing
    3. Post-fault recovery time objective (RTO) verification

    Lifecycle timestamps are tracked explicitly so the orchestrator can
    build accurate timing reports that reflect the *experiment* duration,
    not the executor's internal command-run time.
    """

    def __init__(self, probe_url: Optional[str] = None, expected_status: int = 200):
        self.probe_url = probe_url
        self.expected_status = expected_status
        self.baseline: Optional[Dict[str, Any]] = None
        self.experiment_probes: List[ProbeResult] = []
        self._stop_probing = threading.Event()
        self._probe_thread: Optional[threading.Thread] = None

        # Explicit lifecycle timestamps — set by each phase method
        self._experiment_start: Optional[float] = None   # set in measure_baseline
        self._baseline_start: Optional[float] = None
        self._baseline_end: Optional[float] = None
        self._fault_window_start: Optional[float] = None  # set in start_in_fault_probing
        self._fault_window_end: Optional[float] = None    # set in stop_in_fault_probing
        self._recovery_start: Optional[float] = None      # set in measure_recovery
        self._recovery_end: Optional[float] = None

    def measure_baseline(self, count: int = 3, interval: float = 0.5) -> Dict[str, Any]:
        """Probes the target application before fault injection to establish normal operation."""
        self._baseline_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._baseline_start

        if not self.probe_url:
            self._baseline_end = time.time()
            self.baseline = {
                "available": False,
                "reason": "No probe URL configured.",
            }
            return self.baseline

        probes: List[ProbeResult] = []
        for _ in range(count):
            res = ChaosProbe.probe(self.probe_url, expected_status=self.expected_status)
            probes.append(res)
            time.sleep(interval)

        self._baseline_end = time.time()

        successes = [p for p in probes if p.success]
        success_rate = (len(successes) / len(probes)) * 100 if probes else 0
        avg_latency = (
            round(sum(p.latency_ms for p in successes) / len(successes), 2)
            if successes
            else None
        )

        sample_errors = [p.error for p in probes if p.error]
        self.baseline = {
            "available": bool(successes),
            "probe_url": self.probe_url,
            "probes_count": len(probes),
            "healthy": success_rate >= 66.0,
            "success_rate_percent": round(success_rate, 1),
            "avg_latency_ms": avg_latency or 0.0,
            "expected_status": self.expected_status,
            "status_code": successes[0].status_code if successes else (probes[0].status_code if probes else None),
            "sample_errors": sample_errors[:3],
        }
        return self.baseline

    def start_in_fault_probing(self, interval_sec: float = 1.0):
        """Starts background probing during the fault execution window."""
        self._fault_window_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._fault_window_start

        if not self.probe_url:
            return

        self._stop_probing.clear()
        self.experiment_probes = []

        def _worker():
            while not self._stop_probing.is_set():
                res = ChaosProbe.probe(self.probe_url, expected_status=self.expected_status)
                self.experiment_probes.append(res)
                self._stop_probing.wait(timeout=interval_sec)

        self._probe_thread = threading.Thread(target=_worker, daemon=True)
        self._probe_thread.start()

    def stop_in_fault_probing(self, fault_window_end: Optional[float] = None) -> Dict[str, Any]:
        """Stops in-fault probing and calculates impact metrics.

        Args:
            fault_window_end: Optional wall-clock time (from time.time()) marking when
                              the fault actually ended. If None, uses now().
        """
        self._fault_window_end = fault_window_end if fault_window_end is not None else time.time()
        self._stop_probing.set()
        if self._probe_thread and self._probe_thread.is_alive():
            self._probe_thread.join(timeout=2.0)

        if not self.experiment_probes:
            return {
                "probes_count": 0,
                "successful_probes": 0,
                "failed_probes": 0,
                "availability_percent": 100.0,
                "avg_latency_ms": 0.0,
                "p50_latency_ms": 0.0,
                "p95_latency_ms": 0.0,
                "p99_latency_ms": 0.0,
                "min_latency_ms": 0.0,
                "max_latency_ms": 0.0,
                "latency_multiplier": 1.0,
                "connection_errors_count": 0,
                "http_5xx_count": 0,
                "http_4xx_count": 0,
                "sample_errors": [],
                "probe_events": [],
            }

        total = len(self.experiment_probes)
        successes = [p for p in self.experiment_probes if p.success]
        avail = round((len(successes) / total) * 100, 1)

        latencies = sorted(p.latency_ms for p in successes) if successes else [0.0]
        avg_lat = round(sum(latencies) / len(latencies), 2) if successes else 0.0
        
        n_lat = len(latencies)
        p50_idx = max(0, min(int(math.ceil(0.50 * n_lat)) - 1, n_lat - 1))
        p95_idx = max(0, min(int(math.ceil(0.95 * n_lat)) - 1, n_lat - 1))
        p99_idx = max(0, min(int(math.ceil(0.99 * n_lat)) - 1, n_lat - 1))

        p50_lat = round(latencies[p50_idx], 2)
        p95_lat = round(latencies[p95_idx], 2)
        p99_lat = round(latencies[p99_idx], 2)
        min_lat = round(latencies[0], 2)
        max_lat = round(latencies[-1], 2)

        base_lat = (self.baseline or {}).get("avg_latency_ms", 0.0)
        lat_multiplier = round(avg_lat / base_lat, 2) if base_lat and base_lat > 0 else 1.0

        conn_errors = sum(1 for p in self.experiment_probes if not p.success and (p.status_code is None or p.status_code == 0))
        http_5xx = sum(1 for p in self.experiment_probes if p.status_code and p.status_code >= 500)
        http_4xx = sum(1 for p in self.experiment_probes if p.status_code and 400 <= p.status_code < 500)

        events = [p.to_dict() for p in self.experiment_probes]

        return {
            "probes_count": total,
            "successful_probes": len(successes),
            "failed_probes": total - len(successes),
            "availability_percent": avail,
            "avg_latency_ms": avg_lat,
            "p50_latency_ms": p50_lat,
            "p95_latency_ms": p95_lat,
            "p99_latency_ms": p99_lat,
            "min_latency_ms": min_lat,
            "max_latency_ms": max_lat,
            "latency_multiplier": lat_multiplier,
            "connection_errors_count": conn_errors,
            "http_5xx_count": http_5xx,
            "http_4xx_count": http_4xx,
            "sample_errors": [p.error for p in self.experiment_probes if p.error][:4],
            "probe_events": events,
        }

    def lifecycle_timestamps(self) -> Dict[str, Any]:
        """Returns a snapshot of all phase timestamps for use in the final timing report."""
        now = time.time()

        def _dur(start: Optional[float], end: Optional[float]) -> Optional[float]:
            if start is None:
                return None
            return round((end if end is not None else now) - start, 2)

        return {
            "experiment_start": round(self._experiment_start, 3) if self._experiment_start else None,
            "baseline_duration_seconds": _dur(self._baseline_start, self._baseline_end),
            "fault_window_start": round(self._fault_window_start, 3) if self._fault_window_start else None,
            "fault_window_duration_seconds": _dur(self._fault_window_start, self._fault_window_end),
            "recovery_duration_seconds": _dur(self._recovery_start, self._recovery_end),
            "total_experiment_duration_seconds": _dur(self._experiment_start, self._recovery_end or self._fault_window_end),
        }

    def measure_recovery(self, max_wait_sec: float = 15.0, poll_interval: float = 0.5, rto_target_sec: float = 5.0) -> Dict[str, Any]:
        """Measures recovery duration and validates whether the configured RTO target was achieved."""
        if not self.probe_url:
            return {
                "recovery_time_seconds": 0.0,
                "rto_seconds": 0.0,
                "rto_target_seconds": rto_target_sec,
                "rto_target_met": True,
                "recovered": True,
                "timed_out": False,
                "post_recovery_latency_ms": None,
            }

        self._recovery_start = time.time()
        t_start = self._recovery_start
        deadline = t_start + max_wait_sec
        recovered = False
        post_lat = None

        while time.time() < deadline:
            res = ChaosProbe.probe(self.probe_url, expected_status=self.expected_status)
            if res.success:
                recovered = True
                post_lat = res.latency_ms
                break
            time.sleep(poll_interval)

        self._recovery_end = time.time()
        rec_time = round(self._recovery_end - t_start, 2)
        rto_met = recovered and (rec_time <= rto_target_sec)

        return {
            "recovery_time_seconds": rec_time if recovered else round(max_wait_sec, 2),
            "rto_seconds": rec_time if recovered else round(max_wait_sec, 2),
            "rto_target_seconds": rto_target_sec,
            "rto_target_met": rto_met,
            "recovered": recovered,
            "timed_out": not recovered,
            "post_recovery_latency_ms": post_lat,
        }


class ResilienceScorer:
    """
    Computes a standardized 0-100 Resilience Score and letter grade,
    then generates targeted architectural recommendations.
    """

    @staticmethod
    def calculate_score(
        fault_type: str,
        baseline: Optional[Dict[str, Any]],
        experiment_metrics: Optional[Dict[str, Any]],
        recovery_metrics: Optional[Dict[str, Any]],
        rollback_success: bool = True,
    ) -> Dict[str, Any]:
        has_probe = bool(baseline and baseline.get("available") and experiment_metrics and experiment_metrics.get("probes_count", 0) > 0)

        if not has_probe:
            # Fallback score if no HTTP probe was configured
            score = 80 if rollback_success else 35
            grade = "B" if rollback_success else "F"
            classification = "Gracefully Degraded (No Probe)" if rollback_success else "Fragile / Rollback Failed"
            recs = [
                "Configure a steady-state health probe URL (--probe-url) to measure real-time availability during chaos experiments.",
                "Implement structured health check endpoints (e.g. /healthz or /api/status) on your containerized services.",
            ]
            return {
                "score": score,
                "grade": grade,
                "classification": classification,
                "has_probe": False,
                "breakdown": {
                    "availability": score // 2,
                    "latency": score // 4,
                    "recovery": score // 4,
                    "rollback": 10 if rollback_success else 0,
                },
                "recommendations": recs,
            }

        # 1. Availability Score (0 - 40 pts)
        avail = experiment_metrics.get("availability_percent", 0.0)
        avail_score = round((avail / 100.0) * 40, 1)

        # 2. Latency & Degradation Score (0 - 25 pts)
        mult = experiment_metrics.get("latency_multiplier", 1.0)
        if mult <= 1.5:
            lat_score = 25.0
        elif mult <= 3.0:
            lat_score = 18.0
        elif mult <= 6.0:
            lat_score = 10.0
        else:
            lat_score = 4.0

        # 3. Recovery / RTO Score (0 - 25 pts)
        rto = (recovery_metrics or {}).get("rto_seconds", 0.0)
        is_rec = (recovery_metrics or {}).get("recovered", True)
        if not is_rec:
            rec_score = 0.0
        elif rto <= 2.0:
            rec_score = 25.0
        elif rto <= 5.0:
            rec_score = 18.0
        elif rto <= 10.0:
            rec_score = 10.0
        else:
            rec_score = 5.0

        # 4. Rollback Integrity (0 - 10 pts)
        rollback_score = 10.0 if rollback_success else 0.0

        total_score = min(100, max(0, int(round(avail_score + lat_score + rec_score + rollback_score))))

        # Grading scale
        if total_score >= 90:
            grade = "A"
            classification = "Resilient (Production Grade)"
        elif total_score >= 75:
            grade = "B"
            classification = "Gracefully Degraded"
        elif total_score >= 50:
            grade = "C"
            classification = "Vulnerable"
        else:
            grade = "F"
            classification = "Fragile / High Risk"

        # Generate targeted recommendations
        recs = []
        if avail < 80.0:
            recs.append("Deploy multiple service replicas behind a reverse proxy/load balancer with active health-checking to maintain availability.")
            recs.append("Implement circuit breaking patterns to immediately return cached or fallback responses when dependencies fail.")
        if mult > 2.5:
            recs.append("Configure explicit client timeouts (e.g. 1500ms) with bounded exponential backoff and jitter to mitigate latency spikes.")
        if rto > 4.0 or not is_rec:
            recs.append("Optimize container restart and warm-up time; configure graceful termination signals (SIGTERM handlers).")
        if fault_type in ("cpu_stress", "memory_stress"):
            recs.append("Define explicit CPU and memory cgroup limits and reservations in docker-compose.yml to prevent node starvation.")
        if not recs:
            recs.append("System maintained excellent steady-state resilience throughout the experiment. Continue running automated chaos tests on CI/CD.")

        return {
            "score": total_score,
            "grade": grade,
            "classification": classification,
            "has_probe": True,
            "breakdown": {
                "availability": round(avail_score, 1),
                "latency": round(lat_score, 1),
                "recovery": round(rec_score, 1),
                "rollback": round(rollback_score, 1),
            },
            "recommendations": recs,
        }
