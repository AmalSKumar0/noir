"""
Noir High-Fidelity Chaos Experiment Engine

Implements a time-series, evidence-driven measurement architecture:

  Raw Probe Observation
    → Phase-tagged sample (BASELINE / FAULT / RECOVERY)
    → Rolling metrics & baseline-relative deviation
    → Spike / consecutive-failure detection
    → Rigorous recovery (N consecutive healthy probes)
    → Causal timeline with explicit timestamps
    → Full distribution analysis (all percentiles)
    → Experiment quality / confidence score

Design principles:
  • Every conclusion traces to raw measurements.
  • Raw observations are preserved separately from derived metrics.
  • Small deviations are always surfaced, never hidden by averages.
  • Recovery is not declared from a single success.
  • No fake precision: sample_count gates percentile calculation.
"""

import math
import time
import threading
import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

import urllib.request
import urllib.error


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_SAMPLES_FOR_P99 = 20        # Minimum samples before P99 is meaningful
MIN_SAMPLES_FOR_P95 = 10
MIN_SAMPLES_FOR_STDDEV = 5
SPIKE_STDDEV_THRESHOLD = 3.0    # Observations > mean + 3σ are spikes
DEVIATION_RATIO_WARN = 1.15     # 15% above baseline mean → report it
DEVIATION_RATIO_SPIKE = 2.0     # 2× baseline mean → spike


# ---------------------------------------------------------------------------
# Phase labels
# ---------------------------------------------------------------------------

class Phase(str, Enum):
    BASELINE = "baseline"
    FAULT = "fault"
    RECOVERY = "recovery"


# ---------------------------------------------------------------------------
# Raw probe observation (immutable record)
# ---------------------------------------------------------------------------

@dataclass
class ProbeObservation:
    """
    A single HTTP health probe result.  Every field is stored; nothing is
    discarded.  Derived metrics are calculated externally.
    """
    seq: int                       # Sequence number within this phase
    phase: Phase
    timestamp: float               # wall-clock seconds (time.time())
    endpoint: str
    http_status: Optional[int]
    success: bool
    latency_ms: float
    timeout: bool = False
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    probe_duration_ms: Optional[float] = None   # same as latency_ms here
    response_size_bytes: Optional[int] = None
    # resource snapshot (filled when Docker stats available)
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    memory_used_mb: Optional[float] = None
    network_rx_bytes: Optional[int] = None
    network_tx_bytes: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "seq": self.seq,
            "phase": self.phase.value,
            "timestamp": round(self.timestamp, 3),
            "endpoint": self.endpoint,
            "http_status": self.http_status,
            "success": self.success,
            "latency_ms": round(self.latency_ms, 2),
            "timeout": self.timeout,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "probe_duration_ms": round(self.probe_duration_ms, 2) if self.probe_duration_ms is not None else None,
            "response_size_bytes": self.response_size_bytes,
            "cpu_percent": round(self.cpu_percent, 2) if self.cpu_percent is not None else None,
            "memory_percent": round(self.memory_percent, 2) if self.memory_percent is not None else None,
            "memory_used_mb": round(self.memory_used_mb, 2) if self.memory_used_mb is not None else None,
            "network_rx_bytes": self.network_rx_bytes,
            "network_tx_bytes": self.network_tx_bytes,
        }


# ---------------------------------------------------------------------------
# Event / anomaly records
# ---------------------------------------------------------------------------

@dataclass
class AnomalyEvent:
    start_time: float
    end_time: float
    duration_sec: float
    severity: str            # "low" | "medium" | "high" | "critical"
    affected_metric: str
    baseline_value: float
    observed_value: float
    deviation: float         # absolute delta
    deviation_pct: float     # percentage delta
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": round(self.start_time, 3),
            "end_time": round(self.end_time, 3),
            "duration_sec": round(self.duration_sec, 2),
            "severity": self.severity,
            "affected_metric": self.affected_metric,
            "baseline_value": round(self.baseline_value, 2),
            "observed_value": round(self.observed_value, 2),
            "deviation": round(self.deviation, 2),
            "deviation_pct": round(self.deviation_pct, 1),
            "description": self.description,
        }


# ---------------------------------------------------------------------------
# Statistical helpers
# ---------------------------------------------------------------------------

def _safe_percentile(sorted_values: List[float], p: float) -> Optional[float]:
    """
    Calculates the p-th percentile (0–100) of a pre-sorted list.
    Returns None when the sample count is insufficient.
    """
    n = len(sorted_values)
    if n == 0:
        return None
    if p == 99 and n < MIN_SAMPLES_FOR_P99:
        return None
    if p == 95 and n < MIN_SAMPLES_FOR_P95:
        return None
    idx = int(math.ceil((p / 100.0) * n)) - 1
    return round(sorted_values[max(0, min(idx, n - 1))], 2)


def _full_distribution(values: List[float], label: str = "") -> Dict[str, Any]:
    """
    Compute the full statistical distribution for a list of float samples.
    Respects minimum sample requirements for higher percentiles.
    """
    if not values:
        return {"sample_count": 0, "insufficient_samples": True}

    sv = sorted(values)
    n = len(sv)
    mean_v = round(sum(sv) / n, 2)

    stddev = None
    variance = None
    if n >= MIN_SAMPLES_FOR_STDDEV:
        try:
            stddev = round(statistics.stdev(sv), 3)
            variance = round(statistics.variance(sv), 3)
        except statistics.StatisticsError:
            pass

    median_v = _safe_percentile(sv, 50)

    result: Dict[str, Any] = {
        "sample_count": n,
        "insufficient_samples": False,
        "min": round(sv[0], 2),
        "max": round(sv[-1], 2),
        "mean": mean_v,
        "median": median_v,
        "p50": _safe_percentile(sv, 50),
        "p75": _safe_percentile(sv, 75),
        "p90": _safe_percentile(sv, 90),
        "p95": _safe_percentile(sv, 95),
        "p99": _safe_percentile(sv, 99),
    }
    if stddev is not None:
        result["stddev"] = stddev
        result["variance"] = variance
    else:
        result["stddev"] = None
        result["variance"] = None
        result["stddev_note"] = f"Requires >= {MIN_SAMPLES_FOR_STDDEV} samples."
    if result["p99"] is None:
        result["p99_note"] = f"P99 unavailable: requires >= {MIN_SAMPLES_FOR_P99} samples (have {n})."
    if result["p95"] is None:
        result["p95_note"] = f"P95 unavailable: requires >= {MIN_SAMPLES_FOR_P95} samples (have {n})."

    return result


# ---------------------------------------------------------------------------
# HTTP health probe
# ---------------------------------------------------------------------------

class ChaosProbe:
    """Sends lightweight HTTP health probes and records all timing / error fields."""

    @staticmethod
    def probe(
        url: str,
        timeout_sec: float = 3.0,
        expected_status: int = 200,
        phase: Phase = Phase.FAULT,
        seq: int = 0,
    ) -> ProbeObservation:
        t0 = time.time()
        timeout_hit = False
        status_code: Optional[int] = None
        success = False
        error_type: Optional[str] = None
        error_msg: Optional[str] = None

        if HAS_HTTPX:
            try:
                with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
                    resp = client.get(url)
                    elapsed_ms = (time.time() - t0) * 1000
                    status_code = resp.status_code
                    success = (status_code == expected_status) or (200 <= status_code < 400)
                    if not success:
                        error_type = "http_error"
                        error_msg = f"HTTP {status_code}"
            except httpx.TimeoutException:
                elapsed_ms = (time.time() - t0) * 1000
                timeout_hit = True
                error_type = "timeout"
                error_msg = f"Timeout after {timeout_sec}s"
            except httpx.ConnectError as e:
                elapsed_ms = (time.time() - t0) * 1000
                error_type = "connection_error"
                error_msg = str(e)[:120]
            except Exception as e:
                elapsed_ms = (time.time() - t0) * 1000
                error_type = "unknown"
                error_msg = str(e)[:120]
        else:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Noir-Chaos-Probe/2.0"})
                with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                    elapsed_ms = (time.time() - t0) * 1000
                    status_code = resp.getcode()
                    success = (status_code == expected_status) or (200 <= status_code < 400)
            except urllib.error.HTTPError as he:
                elapsed_ms = (time.time() - t0) * 1000
                status_code = he.code
                success = (status_code == expected_status)
                if not success:
                    error_type = "http_error"
                    error_msg = f"HTTP {he.code}"
            except urllib.error.URLError as ue:
                elapsed_ms = (time.time() - t0) * 1000
                if "timed out" in str(ue).lower():
                    timeout_hit = True
                    error_type = "timeout"
                    error_msg = f"Timeout after {timeout_sec}s"
                else:
                    error_type = "connection_error"
                    error_msg = str(ue)[:120]
            except Exception as e:
                elapsed_ms = (time.time() - t0) * 1000
                error_type = "unknown"
                error_msg = str(e)[:120]

        elapsed_ms = round(elapsed_ms, 2)
        return ProbeObservation(
            seq=seq,
            phase=phase,
            timestamp=t0,
            endpoint=url,
            http_status=status_code,
            success=success,
            latency_ms=elapsed_ms,
            timeout=timeout_hit,
            error_type=error_type,
            error_message=error_msg,
            probe_duration_ms=elapsed_ms,
        )


# ---------------------------------------------------------------------------
# Resource telemetry collector
# ---------------------------------------------------------------------------

class ResourceTelemetry:
    """
    Collects Docker container resource stats (CPU, memory, network).
    Non-blocking; returns None silently if Docker is unavailable.
    """

    @staticmethod
    def collect(docker_mgr: Any, container_name: str) -> Optional[Dict[str, Any]]:
        """Returns a resource snapshot dict or None on any error."""
        if docker_mgr is None:
            return None
        try:
            container = docker_mgr.find_container(container_name)
            if container is None or container.status != "running":
                return None

            # Single-shot non-streaming stats (fast)
            stats = container.stats(stream=False)
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            sys_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"].get("system_cpu_usage", 0)
            num_cpus = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage") or [1])
            cpu_pct = round((cpu_delta / sys_delta) * num_cpus * 100.0, 2) if sys_delta > 0 else 0.0

            mem = stats.get("memory_stats", {})
            mem_usage = mem.get("usage", 0)
            mem_limit = mem.get("limit", 1)
            mem_pct = round((mem_usage / mem_limit) * 100, 2) if mem_limit else 0.0
            mem_mb = round(mem_usage / (1024 * 1024), 2)

            net = stats.get("networks", {})
            rx_bytes = sum(v.get("rx_bytes", 0) for v in net.values()) if net else 0
            tx_bytes = sum(v.get("tx_bytes", 0) for v in net.values()) if net else 0

            return {
                "cpu_percent": cpu_pct,
                "memory_percent": mem_pct,
                "memory_used_mb": mem_mb,
                "network_rx_bytes": rx_bytes,
                "network_tx_bytes": tx_bytes,
            }
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Phase metrics calculator
# ---------------------------------------------------------------------------

def _compute_phase_metrics(
    observations: List[ProbeObservation],
    baseline_distribution: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute full metrics for a list of observations from one phase.
    Includes distribution, error breakdown, and baseline-relative deviation.
    """
    if not observations:
        return {
            "sample_count": 0,
            "insufficient_samples": True,
            "availability_percent": 100.0,
            "successful_probes": 0,
            "failed_probes": 0,
            "timeout_count": 0,
            "connection_error_count": 0,
            "http_error_count": 0,
            "latency_distribution": _full_distribution([]),
            "availability_distribution": None,
            "baseline_comparison": None,
            "error_rate_percent": 0.0,
            "timeout_rate_percent": 0.0,
        }

    n = len(observations)
    successes = [o for o in observations if o.success]
    failures = [o for o in observations if not o.success]
    timeouts = [o for o in observations if o.timeout]
    conn_errors = [o for o in observations if o.error_type == "connection_error"]
    http_errors = [o for o in observations if o.error_type == "http_error"]

    avail = round((len(successes) / n) * 100, 2)
    err_rate = round(100 - avail, 2)
    timeout_rate = round((len(timeouts) / n) * 100, 2)

    success_latencies = [o.latency_ms for o in successes]
    all_latencies = [o.latency_ms for o in observations]

    lat_dist = _full_distribution(success_latencies)

    # Baseline-relative deviation
    baseline_comparison = None
    if baseline_distribution and baseline_distribution.get("sample_count", 0) > 0:
        base_mean = baseline_distribution.get("mean") or 0.0
        fault_mean = lat_dist.get("mean") or 0.0
        base_p95 = baseline_distribution.get("p95") or base_mean
        fault_p95 = lat_dist.get("p95") or fault_mean

        abs_delta_mean = round(fault_mean - base_mean, 2)
        pct_delta_mean = round(((fault_mean - base_mean) / base_mean) * 100, 1) if base_mean > 0 else 0.0
        ratio_mean = round(fault_mean / base_mean, 3) if base_mean > 0 else 1.0

        abs_delta_p95 = round(fault_p95 - base_p95, 2) if fault_p95 is not None and base_p95 is not None else None
        pct_delta_p95 = (
            round(((fault_p95 - base_p95) / base_p95) * 100, 1)
            if base_p95 and base_p95 > 0 and fault_p95 is not None else None
        )

        baseline_comparison = {
            "baseline_mean_ms": base_mean,
            "observed_mean_ms": fault_mean,
            "absolute_delta_ms": abs_delta_mean,
            "percentage_delta": pct_delta_mean,
            "ratio_to_baseline": ratio_mean,
            "baseline_p95_ms": base_p95,
            "observed_p95_ms": fault_p95,
            "absolute_delta_p95_ms": abs_delta_p95,
            "percentage_delta_p95": pct_delta_p95,
        }

    return {
        "sample_count": n,
        "insufficient_samples": n < 3,
        "availability_percent": avail,
        "successful_probes": len(successes),
        "failed_probes": len(failures),
        "timeout_count": len(timeouts),
        "connection_error_count": len(conn_errors),
        "http_error_count": len(http_errors),
        "error_rate_percent": err_rate,
        "timeout_rate_percent": timeout_rate,
        "latency_distribution": lat_dist,
        # backward-compat flat fields (used by existing code)
        "probes_count": n,
        "avg_latency_ms": lat_dist.get("mean", 0.0),
        "p50_latency_ms": lat_dist.get("p50"),
        "p75_latency_ms": lat_dist.get("p75"),
        "p90_latency_ms": lat_dist.get("p90"),
        "p95_latency_ms": lat_dist.get("p95"),
        "p99_latency_ms": lat_dist.get("p99"),
        "min_latency_ms": lat_dist.get("min"),
        "max_latency_ms": lat_dist.get("max"),
        "stddev_latency_ms": lat_dist.get("stddev"),
        "connection_errors_count": len(conn_errors),
        "http_5xx_count": len(http_errors),
        "sample_errors": [o.error_message for o in failures if o.error_message][:5],
        "probe_events": [o.to_dict() for o in observations],
        "baseline_comparison": baseline_comparison,
    }


# ---------------------------------------------------------------------------
# Anomaly & spike detector
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """
    Scans observations for transient spikes, consecutive failures,
    and latency anomalies relative to the baseline distribution.
    """

    @staticmethod
    def detect(
        observations: List[ProbeObservation],
        baseline_dist: Optional[Dict[str, Any]],
    ) -> Tuple[List[AnomalyEvent], Dict[str, Any]]:
        """
        Returns (anomaly_events, detection_summary).
        """
        if not observations:
            return [], {}

        base_mean = (baseline_dist or {}).get("mean") or 0.0
        base_stddev = (baseline_dist or {}).get("stddev") or None

        anomalies: List[AnomalyEvent] = []
        max_consecutive_failures = 0
        current_consecutive = 0
        time_to_first_impact: Optional[float] = None
        first_obs_ts = observations[0].timestamp if observations else None

        peak_latency = 0.0
        peak_latency_ts: Optional[float] = None
        peak_latency_obs: Optional[float] = None
        min_availability_window = 100.0

        # ---- Spike detection (individual observations) ----
        spike_threshold = (base_mean + SPIKE_STDDEV_THRESHOLD * base_stddev) if (base_mean > 0 and base_stddev) else (base_mean * DEVIATION_RATIO_SPIKE if base_mean > 0 else None)

        for obs in observations:
            # Consecutive failures
            if not obs.success:
                current_consecutive += 1
                if current_consecutive > max_consecutive_failures:
                    max_consecutive_failures = current_consecutive
                # First impact
                if time_to_first_impact is None and first_obs_ts is not None:
                    time_to_first_impact = round(obs.timestamp - first_obs_ts, 3)
            else:
                current_consecutive = 0

            # Peak latency (successful probes)
            if obs.success and obs.latency_ms > peak_latency:
                peak_latency = obs.latency_ms
                peak_latency_ts = obs.timestamp
                peak_latency_obs = obs.latency_ms

            # Latency spike detection
            if obs.success and spike_threshold and obs.latency_ms > spike_threshold:
                abs_dev = round(obs.latency_ms - base_mean, 2)
                pct_dev = round(((obs.latency_ms - base_mean) / base_mean) * 100, 1) if base_mean > 0 else 0.0
                severity = "critical" if obs.latency_ms > base_mean * 5 else ("high" if obs.latency_ms > base_mean * 3 else "medium")
                anomalies.append(AnomalyEvent(
                    start_time=obs.timestamp,
                    end_time=obs.timestamp + (obs.latency_ms / 1000),
                    duration_sec=round(obs.latency_ms / 1000, 3),
                    severity=severity,
                    affected_metric="latency_ms",
                    baseline_value=base_mean,
                    observed_value=obs.latency_ms,
                    deviation=abs_dev,
                    deviation_pct=pct_dev,
                    description=f"Latency spike: {obs.latency_ms}ms vs baseline {base_mean}ms (+{abs_dev}ms, +{pct_dev}%)",
                ))

        # ---- Consecutive failure burst detection ----
        failure_bursts = []
        current_burst_start: Optional[float] = None
        current_burst_count = 0
        for obs in observations:
            if not obs.success:
                if current_burst_start is None:
                    current_burst_start = obs.timestamp
                current_burst_count += 1
            else:
                if current_burst_count >= 2:  # Report bursts of >= 2 consecutive failures
                    failure_bursts.append({
                        "start_time": round(current_burst_start, 3),
                        "end_time": round(obs.timestamp, 3),
                        "consecutive_failures": current_burst_count,
                        "duration_sec": round(obs.timestamp - current_burst_start, 2),
                    })
                current_burst_start = None
                current_burst_count = 0
        if current_burst_count >= 2 and current_burst_start:
            last_ts = observations[-1].timestamp
            failure_bursts.append({
                "start_time": round(current_burst_start, 3),
                "end_time": round(last_ts, 3),
                "consecutive_failures": current_burst_count,
                "duration_sec": round(last_ts - current_burst_start, 2),
            })

        # Peak impact summary
        peak_impact = None
        if peak_latency_ts and base_mean > 0:
            abs_delta = round(peak_latency - base_mean, 2)
            pct_delta = round(((peak_latency - base_mean) / base_mean) * 100, 1)
            peak_impact = {
                "peak_latency_ms": round(peak_latency, 2),
                "at_timestamp": round(peak_latency_ts, 3),
                "baseline_mean_ms": base_mean,
                "absolute_delta_ms": abs_delta,
                "percentage_delta": pct_delta,
                "ratio_to_baseline": round(peak_latency / base_mean, 3),
            }

        # Tail-latency divergence detection (P95 >> P50)
        tail_divergence = None
        success_lats = sorted(o.latency_ms for o in observations if o.success)
        if len(success_lats) >= MIN_SAMPLES_FOR_P95:
            p50 = _safe_percentile(success_lats, 50)
            p95 = _safe_percentile(success_lats, 95)
            if p50 and p95 and p95 >= p50 * 3.5 and p95 > 100:
                tail_divergence = {
                    "detected": True,
                    "p50_ms": p50,
                    "p95_ms": p95,
                    "p95_p50_ratio": round(p95 / p50, 2),
                    "description": f"Tail latency divergence: P95 ({p95}ms) is {round(p95/p50, 1)}x P50 ({p50}ms)",
                }

        summary = {
            "spike_count": len(anomalies),
            "max_consecutive_failures": max_consecutive_failures,
            "failure_bursts": failure_bursts,
            "time_to_first_failure_sec": time_to_first_impact,
            "peak_impact": peak_impact,
            "tail_latency_divergence": tail_divergence,
        }

        return anomalies, summary


# ---------------------------------------------------------------------------
# Rolling window metrics (computed from raw observations)
# ---------------------------------------------------------------------------

def _compute_rolling_metrics(
    observations: List[ProbeObservation],
    window_sec: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Computes rolling window metrics over the observation stream.
    Returns a list of window snapshots.
    """
    if not observations or window_sec <= 0:
        return []

    results = []
    n = len(observations)
    i = 0
    while i < n:
        window_start = observations[i].timestamp
        window_end = window_start + window_sec
        window_obs = [o for o in observations if window_start <= o.timestamp < window_end]
        if not window_obs:
            i += 1
            continue

        success_lats = [o.latency_ms for o in window_obs if o.success]
        avail = round((sum(1 for o in window_obs if o.success) / len(window_obs)) * 100, 1)
        mean_lat = round(sum(success_lats) / len(success_lats), 2) if success_lats else 0.0
        p95 = _safe_percentile(sorted(success_lats), 95) if len(success_lats) >= MIN_SAMPLES_FOR_P95 else None
        err_rate = round(100 - avail, 1)

        results.append({
            "window_start": round(window_start, 3),
            "window_end": round(window_end, 3),
            "window_sec": window_sec,
            "sample_count": len(window_obs),
            "availability_percent": avail,
            "error_rate_percent": err_rate,
            "mean_latency_ms": mean_lat,
            "p95_latency_ms": p95,
        })

        # Advance to the first observation beyond this window
        next_i = i + 1
        while next_i < n and observations[next_i].timestamp < window_end:
            next_i += 1
        i = next_i

    return results


# ---------------------------------------------------------------------------
# Main experiment engine
# ---------------------------------------------------------------------------

class SteadyStateEvaluator:
    """
    Orchestrates the full chaos experiment lifecycle with high-resolution,
    phase-tagged observations and evidence-based analysis.

    Lifecycle:
        measure_baseline() → start_in_fault_probing() → stop_in_fault_probing()
        → measure_recovery() → lifecycle_timestamps() + all phase raw_observations

    Configuration:
        baseline_probe_count  – number of baseline probes (default 10)
        baseline_interval_sec – seconds between baseline probes (default 1.0)
        fault_probe_interval  – seconds between fault-window probes (default 1.0)
        recovery_probe_interval – seconds between recovery probes (default 0.5)
        recovery_consecutive_required – consecutive successes to confirm recovery (default 3)
    """

    def __init__(
        self,
        probe_url: Optional[str] = None,
        expected_status: int = 200,
        baseline_probe_count: int = 10,
        baseline_interval_sec: float = 1.0,
        fault_probe_interval: float = 1.0,
        recovery_probe_interval: float = 0.5,
        recovery_consecutive_required: int = 3,
        rolling_window_sec: float = 5.0,
        docker_mgr: Any = None,
        container_name: Optional[str] = None,
    ):
        self.probe_url = probe_url
        self.expected_status = expected_status
        self.baseline_probe_count = baseline_probe_count
        self.baseline_interval_sec = baseline_interval_sec
        self.fault_probe_interval = fault_probe_interval
        self.recovery_probe_interval = recovery_probe_interval
        self.recovery_consecutive_required = recovery_consecutive_required
        self.rolling_window_sec = rolling_window_sec
        self.docker_mgr = docker_mgr
        self.container_name = container_name

        # Raw observations per phase
        self.baseline_observations: List[ProbeObservation] = []
        self.fault_observations: List[ProbeObservation] = []
        self.recovery_observations: List[ProbeObservation] = []

        # Derived (set after each phase)
        self.baseline: Optional[Dict[str, Any]] = None
        self._baseline_distribution: Optional[Dict[str, Any]] = None

        # Threading
        self._stop_probing = threading.Event()
        self._probe_thread: Optional[threading.Thread] = None
        self._fault_seq = 0

        # Timeline timestamps
        self._experiment_start: Optional[float] = None
        self._baseline_start: Optional[float] = None
        self._baseline_end: Optional[float] = None
        self._fault_window_start: Optional[float] = None
        self._fault_window_end: Optional[float] = None
        self._recovery_start: Optional[float] = None
        self._recovery_end: Optional[float] = None
        self._first_deviation_ts: Optional[float] = None
        self._peak_degradation_ts: Optional[float] = None

    # ------------------------------------------------------------------
    # Phase 1: Baseline
    # ------------------------------------------------------------------

    def measure_baseline(
        self,
        count: Optional[int] = None,
        interval: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Collects N probes before fault injection and computes the full
        baseline statistical distribution (mean, stddev, all percentiles).
        """
        probe_count = count if count is not None else self.baseline_probe_count
        probe_interval = interval if interval is not None else self.baseline_interval_sec

        self._baseline_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._baseline_start

        if not self.probe_url:
            self._baseline_end = time.time()
            self.baseline = {
                "available": False,
                "probe_url": None,
                "reason": "No probe URL configured.",
                "sample_count": 0,
                "healthy": False,
            }
            return self.baseline

        for i in range(probe_count):
            resource = ResourceTelemetry.collect(self.docker_mgr, self.container_name) if self.container_name else None
            obs = ChaosProbe.probe(
                self.probe_url,
                timeout_sec=3.0,
                expected_status=self.expected_status,
                phase=Phase.BASELINE,
                seq=i,
            )
            if resource:
                obs.cpu_percent = resource.get("cpu_percent")
                obs.memory_percent = resource.get("memory_percent")
                obs.memory_used_mb = resource.get("memory_used_mb")
                obs.network_rx_bytes = resource.get("network_rx_bytes")
                obs.network_tx_bytes = resource.get("network_tx_bytes")
            self.baseline_observations.append(obs)
            if i < probe_count - 1:
                time.sleep(probe_interval)

        self._baseline_end = time.time()

        # Compute baseline distribution
        metrics = _compute_phase_metrics(self.baseline_observations)
        self._baseline_distribution = metrics.get("latency_distribution", {})

        successes = [o for o in self.baseline_observations if o.success]
        avail = round((len(successes) / len(self.baseline_observations)) * 100, 1) if self.baseline_observations else 0.0

        self.baseline = {
            "available": bool(successes),
            "probe_url": self.probe_url,
            "sample_count": len(self.baseline_observations),
            "probes_count": len(self.baseline_observations),
            "healthy": avail >= 66.0,
            "success_rate_percent": avail,
            "availability_percent": avail,
            "expected_status": self.expected_status,
            "status_code": successes[0].http_status if successes else None,
            "sample_errors": [o.error_message for o in self.baseline_observations if o.error_message][:3],
            "distribution": self._baseline_distribution,
            # backward-compat flat fields
            "avg_latency_ms": self._baseline_distribution.get("mean", 0.0),
            "p50_latency_ms": self._baseline_distribution.get("p50"),
            "p75_latency_ms": self._baseline_distribution.get("p75"),
            "p90_latency_ms": self._baseline_distribution.get("p90"),
            "p95_latency_ms": self._baseline_distribution.get("p95"),
            "p99_latency_ms": self._baseline_distribution.get("p99"),
            "min_latency_ms": self._baseline_distribution.get("min"),
            "max_latency_ms": self._baseline_distribution.get("max"),
            "stddev_latency_ms": self._baseline_distribution.get("stddev"),
            # resource baseline averages
            "baseline_cpu_percent": (
                round(sum(o.cpu_percent for o in self.baseline_observations if o.cpu_percent is not None)
                      / max(1, sum(1 for o in self.baseline_observations if o.cpu_percent is not None)), 2)
                if any(o.cpu_percent is not None for o in self.baseline_observations) else None
            ),
            "baseline_memory_percent": (
                round(sum(o.memory_percent for o in self.baseline_observations if o.memory_percent is not None)
                      / max(1, sum(1 for o in self.baseline_observations if o.memory_percent is not None)), 2)
                if any(o.memory_percent is not None for o in self.baseline_observations) else None
            ),
            "raw_observations": [o.to_dict() for o in self.baseline_observations],
        }
        return self.baseline

    # ------------------------------------------------------------------
    # Phase 2: Fault window probing
    # ------------------------------------------------------------------

    def start_in_fault_probing(self, interval_sec: Optional[float] = None) -> None:
        """Starts background probing during the fault window."""
        self._fault_window_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._fault_window_start

        if not self.probe_url:
            return

        probe_interval = interval_sec if interval_sec is not None else self.fault_probe_interval
        self._stop_probing.clear()
        self._fault_seq = 0

        def _worker():
            while not self._stop_probing.is_set():
                resource = ResourceTelemetry.collect(self.docker_mgr, self.container_name) if self.container_name else None
                obs = ChaosProbe.probe(
                    self.probe_url,
                    timeout_sec=3.0,
                    expected_status=self.expected_status,
                    phase=Phase.FAULT,
                    seq=self._fault_seq,
                )
                self._fault_seq += 1
                if resource:
                    obs.cpu_percent = resource.get("cpu_percent")
                    obs.memory_percent = resource.get("memory_percent")
                    obs.memory_used_mb = resource.get("memory_used_mb")
                    obs.network_rx_bytes = resource.get("network_rx_bytes")
                    obs.network_tx_bytes = resource.get("network_tx_bytes")
                self.fault_observations.append(obs)

                # Update first deviation timestamp
                if self._first_deviation_ts is None and not obs.success and self._baseline_distribution:
                    self._first_deviation_ts = obs.timestamp
                elif self._first_deviation_ts is None and obs.success and self._baseline_distribution:
                    base_mean = self._baseline_distribution.get("mean") or 0.0
                    if base_mean > 0 and obs.latency_ms > base_mean * DEVIATION_RATIO_WARN:
                        self._first_deviation_ts = obs.timestamp

                # Track peak degradation
                if obs.success:
                    if self._peak_degradation_ts is None:
                        self._peak_degradation_ts = obs.timestamp
                    else:
                        current_peak = max(
                            (o.latency_ms for o in self.fault_observations if o.success),
                            default=0.0
                        )
                        if obs.latency_ms >= current_peak:
                            self._peak_degradation_ts = obs.timestamp

                self._stop_probing.wait(timeout=probe_interval)

        self._probe_thread = threading.Thread(target=_worker, daemon=True)
        self._probe_thread.start()

    def stop_in_fault_probing(
        self,
        fault_window_end: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Stops in-fault probing.  Accepts the caller's wall-clock timestamp
        for the fault window end so timing is precise.
        """
        self._fault_window_end = fault_window_end if fault_window_end is not None else time.time()
        self._stop_probing.set()
        if self._probe_thread and self._probe_thread.is_alive():
            self._probe_thread.join(timeout=2.0)

        metrics = _compute_phase_metrics(self.fault_observations, self._baseline_distribution)

        # Enrich with anomaly detection
        anomalies, anomaly_summary = AnomalyDetector.detect(self.fault_observations, self._baseline_distribution)
        metrics["anomalies"] = [a.to_dict() for a in anomalies]
        metrics["anomaly_summary"] = anomaly_summary

        # Rolling window metrics
        metrics["rolling_metrics"] = _compute_rolling_metrics(self.fault_observations, self.rolling_window_sec)

        # latency_multiplier for backward compat
        base_mean = (self._baseline_distribution or {}).get("mean") or 0.0
        fault_mean = (metrics.get("latency_distribution") or {}).get("mean") or 0.0
        metrics["latency_multiplier"] = round(fault_mean / base_mean, 3) if base_mean > 0 else 1.0

        return metrics

    # ------------------------------------------------------------------
    # Phase 3: Recovery
    # ------------------------------------------------------------------

    def measure_recovery(
        self,
        max_wait_sec: float = 30.0,
        poll_interval: Optional[float] = None,
        rto_target_sec: float = 5.0,
    ) -> Dict[str, Any]:
        """
        Rigorous recovery measurement:
        - Requires `recovery_consecutive_required` consecutive healthy probes
          AND latency within baseline tolerance.
        - Stores the full recovery trajectory.
        - Prevents false recovery (hysteresis).
        """
        self._recovery_start = time.time()

        if not self.probe_url:
            self._recovery_end = time.time()
            return {
                "recovered": True,
                "recovery_time_seconds": 0.0,
                "rto_target_seconds": rto_target_sec,
                "rto_target_met": True,
                "timed_out": False,
                "post_recovery_latency_ms": None,
                "consecutive_healthy_required": self.recovery_consecutive_required,
                "recovery_trajectory": [],
                "raw_observations": [],
            }

        probe_interval = poll_interval if poll_interval is not None else self.recovery_probe_interval
        t_start = self._recovery_start
        deadline = t_start + max_wait_sec
        recovered = False
        consecutive_healthy = 0
        confirmed_at: Optional[float] = None
        seq = 0

        while time.time() < deadline:
            resource = ResourceTelemetry.collect(self.docker_mgr, self.container_name) if self.container_name else None
            obs = ChaosProbe.probe(
                self.probe_url,
                timeout_sec=3.0,
                expected_status=self.expected_status,
                phase=Phase.RECOVERY,
                seq=seq,
            )
            seq += 1
            if resource:
                obs.cpu_percent = resource.get("cpu_percent")
                obs.memory_percent = resource.get("memory_percent")
                obs.memory_used_mb = resource.get("memory_used_mb")
            self.recovery_observations.append(obs)

            # Latency tolerance check (within 50% of baseline mean)
            base_mean = (self._baseline_distribution or {}).get("mean") or 0.0
            latency_ok = base_mean <= 0 or obs.latency_ms <= base_mean * 1.5

            if obs.success and latency_ok:
                consecutive_healthy += 1
                if consecutive_healthy >= self.recovery_consecutive_required:
                    recovered = True
                    confirmed_at = obs.timestamp
                    break
            else:
                consecutive_healthy = 0  # hysteresis: reset on any failure

            time.sleep(probe_interval)

        self._recovery_end = time.time()
        rec_time = round(self._recovery_end - t_start, 3)
        rto_met = recovered and (rec_time <= rto_target_sec)

        # Recovery trajectory: all recovery observations
        trajectory = [
            {
                "t": round(o.timestamp - t_start, 3),
                "latency_ms": o.latency_ms,
                "success": o.success,
                "http_status": o.http_status,
            }
            for o in self.recovery_observations
        ]

        return {
            "recovered": recovered,
            "recovery_time_seconds": rec_time if recovered else round(max_wait_sec, 2),
            "rto_seconds": rec_time if recovered else round(max_wait_sec, 2),
            "rto_target_seconds": rto_target_sec,
            "rto_target_met": rto_met,
            "timed_out": not recovered,
            "consecutive_healthy_required": self.recovery_consecutive_required,
            "confirmed_at": round(confirmed_at - t_start, 3) if confirmed_at else None,
            "post_recovery_latency_ms": self.recovery_observations[-1].latency_ms if self.recovery_observations else None,
            "recovery_trajectory": trajectory,
            "raw_observations": [o.to_dict() for o in self.recovery_observations],
        }

    # ------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------

    def lifecycle_timestamps(self) -> Dict[str, Any]:
        """
        Returns all phase timestamps and derived durations.
        This is the single ground truth for timing in the final report.
        """
        now = time.time()

        def _dur(start: Optional[float], end: Optional[float]) -> Optional[float]:
            if start is None:
                return None
            return round((end if end is not None else now) - start, 3)

        fw_dur = _dur(self._fault_window_start, self._fault_window_end)
        tti = None
        if self._first_deviation_ts and self._fault_window_start:
            tti = round(self._first_deviation_ts - self._fault_window_start, 3)

        return {
            "experiment_start": round(self._experiment_start, 3) if self._experiment_start else None,
            "baseline_started_at": round(self._baseline_start, 3) if self._baseline_start else None,
            "baseline_completed_at": round(self._baseline_end, 3) if self._baseline_end else None,
            "baseline_duration_seconds": _dur(self._baseline_start, self._baseline_end),
            "fault_injection_started_at": round(self._fault_window_start, 3) if self._fault_window_start else None,
            "fault_injection_completed_at": round(self._fault_window_end, 3) if self._fault_window_end else None,
            "fault_window_duration_seconds": fw_dur,
            "first_deviation_at": round(self._first_deviation_ts, 3) if self._first_deviation_ts else None,
            "time_to_first_impact_seconds": tti,
            "peak_degradation_at": round(self._peak_degradation_ts, 3) if self._peak_degradation_ts else None,
            "recovery_started_at": round(self._recovery_start, 3) if self._recovery_start else None,
            "recovery_confirmed_at": round(self._recovery_end, 3) if self._recovery_end else None,
            "recovery_duration_seconds": _dur(self._recovery_start, self._recovery_end),
            "total_experiment_duration_seconds": _dur(self._experiment_start, self._recovery_end or self._fault_window_end),
        }

    def all_raw_observations(self) -> Dict[str, Any]:
        """Returns all raw observations across all phases."""
        return {
            "baseline": [o.to_dict() for o in self.baseline_observations],
            "fault": [o.to_dict() for o in self.fault_observations],
            "recovery": [o.to_dict() for o in self.recovery_observations],
            "total_count": (
                len(self.baseline_observations)
                + len(self.fault_observations)
                + len(self.recovery_observations)
            ),
        }


# ---------------------------------------------------------------------------
# Resilience Scorer (multi-dimensional)
# ---------------------------------------------------------------------------

class ResilienceScorer:
    """
    Computes a standardized, explainable 0–100 Resilience Score derived from
    multiple dimensions:
        Availability (30 pts)
        Latency degradation (20 pts)
        Tail latency (10 pts)
        Recovery / RTO (25 pts)
        Rollback integrity (10 pts)
        Fault containment / stability (5 pts)

    Every component is exposed in the score breakdown.
    Confidence is separate from the score.
    """

    @staticmethod
    def calculate_score(
        fault_type: str,
        baseline: Optional[Dict[str, Any]],
        experiment_metrics: Optional[Dict[str, Any]],
        recovery_metrics: Optional[Dict[str, Any]],
        rollback_success: bool = True,
        anomaly_summary: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        exp = experiment_metrics or {}
        rec = recovery_metrics or {}
        base = baseline or {}
        anoms = anomaly_summary or {}

        has_probe = bool(
            base.get("available")
            and exp.get("probes_count", 0) > 0
        )

        if not has_probe:
            score = 75 if rollback_success else 30
            grade = "B" if rollback_success else "F"
            return {
                "score": score,
                "grade": grade,
                "classification": "No Probe Data" if rollback_success else "Fragile / Rollback Failed",
                "has_probe": False,
                "confidence": "low",
                "confidence_reason": "No HTTP probe configured; no in-experiment evidence collected.",
                "breakdown": {
                    "availability": score // 2,
                    "latency_degradation": score // 4,
                    "tail_latency": 0,
                    "recovery": score // 4,
                    "rollback": 10 if rollback_success else 0,
                    "stability": 0,
                },
                "recommendations": [
                    "Configure --probe-url to enable real-time evidence collection.",
                ],
            }

        # 1. Availability (30 pts)
        avail = exp.get("availability_percent", 100.0)
        avail_score = round((avail / 100.0) * 30, 1)

        # 2. Latency degradation (20 pts) — from comparison delta
        comparison = exp.get("baseline_comparison") or {}
        mult = exp.get("latency_multiplier", comparison.get("ratio_to_baseline", 1.0))
        if mult <= 1.15:
            lat_score = 20.0
        elif mult <= 1.5:
            lat_score = 17.0
        elif mult <= 2.0:
            lat_score = 13.0
        elif mult <= 3.0:
            lat_score = 8.0
        elif mult <= 6.0:
            lat_score = 4.0
        else:
            lat_score = 1.0

        # 3. Tail latency (10 pts) — P95 delta
        pct_delta_p95 = (comparison.get("percentage_delta_p95") or 0.0)
        if pct_delta_p95 <= 10:
            tail_score = 10.0
        elif pct_delta_p95 <= 30:
            tail_score = 8.0
        elif pct_delta_p95 <= 75:
            tail_score = 5.0
        elif pct_delta_p95 <= 200:
            tail_score = 2.0
        else:
            tail_score = 0.0

        # 4. Recovery / RTO (25 pts)
        rto = rec.get("rto_seconds", 0.0)
        is_rec = rec.get("recovered", True)
        if not is_rec:
            rec_score = 0.0
        elif rto <= 1.0:
            rec_score = 25.0
        elif rto <= 3.0:
            rec_score = 20.0
        elif rto <= 5.0:
            rec_score = 15.0
        elif rto <= 10.0:
            rec_score = 8.0
        else:
            rec_score = 3.0

        # 5. Rollback integrity (10 pts)
        rollback_score = 10.0 if rollback_success else 0.0

        # 6. Stability: penalize spikes and consecutive failures (5 pts)
        spike_count = anoms.get("spike_count", 0)
        max_consec = anoms.get("max_consecutive_failures", 0)
        stability_penalty = min(5.0, spike_count * 1.0 + max_consec * 0.5)
        stability_score = max(0.0, 5.0 - stability_penalty)

        total = min(100, max(0, int(round(
            avail_score + lat_score + tail_score + rec_score + rollback_score + stability_score
        ))))

        # Grade
        if total >= 90:
            grade = "A"; classification = "Resilient (Production Grade)"
        elif total >= 75:
            grade = "B"; classification = "Gracefully Degraded"
        elif total >= 50:
            grade = "C"; classification = "Vulnerable"
        else:
            grade = "F"; classification = "Fragile / High Risk"

        # Confidence
        sample_count = exp.get("probes_count", 0)
        if sample_count >= 20:
            confidence = "high"
            confidence_reason = f"{sample_count} in-fault probes collected."
        elif sample_count >= 8:
            confidence = "medium"
            confidence_reason = f"Only {sample_count} in-fault probes; higher sample count recommended."
        else:
            confidence = "low"
            confidence_reason = f"Only {sample_count} in-fault probe(s); results have high uncertainty."

        # Recommendations
        recs = []
        if avail < 80.0:
            recs.append("Deploy multiple service replicas with active health checks and load balancing.")
        if mult > 2.5:
            recs.append("Configure explicit client timeouts with bounded exponential backoff and jitter.")
        if pct_delta_p95 > 50:
            recs.append("Investigate tail latency: consider connection pool sizing, GC pauses, and thread contention.")
        if rto > 4.0 or not is_rec:
            recs.append("Optimize container restart and warm-up time; configure graceful termination (SIGTERM).")
        if fault_type in ("cpu_stress", "memory_stress"):
            recs.append("Define explicit CPU and memory cgroup limits in docker-compose.yml to prevent node starvation.")
        if spike_count > 0:
            recs.append(f"Investigate {spike_count} latency spike(s): consider rate limiting or circuit breaker patterns.")
        if not recs:
            recs.append("System maintained excellent resilience. Continue running automated chaos tests on CI/CD.")

        return {
            "score": total,
            "grade": grade,
            "classification": classification,
            "has_probe": True,
            "confidence": confidence,
            "confidence_reason": confidence_reason,
            "breakdown": {
                "availability": round(avail_score, 1),
                "latency_degradation": round(lat_score, 1),
                "tail_latency": round(tail_score, 1),
                "recovery": round(rec_score, 1),
                "rollback": round(rollback_score, 1),
                "stability": round(stability_score, 1),
            },
            "recommendations": recs,
        }
