"""
Noir High-Fidelity Chaos Experiment Engine

Implements an evidence-driven, scientifically rigorous measurement architecture:

  Raw Probe Observation
    → Phase-tagged sample (BASELINE / FAULT / RECOVERY)
    → Rolling metrics & baseline-relative deviation
    → Anomaly classification (isolated spikes vs sustained degradation)
    → Rigorous observation-derived recovery (first healthy observation timestamp)
    → Authoritative monotonic lifecycle timestamps & duration breakdown
    → Strict sample-gated percentiles (no fake P95/P99)
    → Separate Resilience Score and Measurement Quality Score

Fundamental Rule:
  NOIR MUST NEVER CLAIM A SYSTEM BEHAVIOR THAT ITS OBSERVATIONS CANNOT SUPPORT.
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
# Constants & Safety Gates
# ---------------------------------------------------------------------------

MIN_SAMPLES_FOR_P99 = 20        # Minimum valid samples before P99 is calculated
MIN_SAMPLES_FOR_P95 = 10        # Minimum valid samples before P95 is calculated
MIN_SAMPLES_FOR_STDDEV = 5      # Minimum baseline samples before stddev is calculated
SPIKE_STDDEV_THRESHOLD = 3.0    # Observations > mean + 3σ are potential spikes
DEVIATION_RATIO_WARN = 1.15     # 15% above baseline mean → deviation flag
DEVIATION_RATIO_SPIKE = 2.0     # 2× baseline mean → spike threshold fallback
SUSTAINED_SHIFT_RATIO = 0.60    # If >= 60% of fault probes are elevated, classify as SUSTAINED


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Phase(str, Enum):
    BASELINE = "baseline"
    FAULT = "fault"
    RECOVERY = "recovery"


class EvidenceState(str, Enum):
    MEASURED = "MEASURED"
    PARTIALLY_MEASURED = "PARTIALLY_MEASURED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    INCONCLUSIVE = "INCONCLUSIVE"


class AnomalyClassification(str, Enum):
    ISOLATED_TRANSIENT_SPIKE = "ISOLATED_TRANSIENT_SPIKE"
    SUSTAINED_LATENCY_DEGRADATION = "SUSTAINED_LATENCY_DEGRADATION"
    BURST_OF_SPIKES = "BURST_OF_SPIKES"
    GRADUAL_DEGRADATION = "GRADUAL_DEGRADATION"
    RECOVERY_OVERSHOOT = "RECOVERY_OVERSHOOT"


# ---------------------------------------------------------------------------
# Raw probe observation (immutable record)
# ---------------------------------------------------------------------------

@dataclass
class ProbeObservation:
    """
    A single HTTP health probe result. Every field is stored; nothing is discarded.
    Failed probes never contribute latency to distributions.
    """
    seq: int = 0
    phase: Phase = Phase.FAULT
    timestamp: float = 0.0
    endpoint: str = ""
    http_status: Optional[int] = None
    success: bool = False
    latency_ms: float = 0.0
    timeout: bool = False
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    probe_duration_ms: Optional[float] = None
    response_size_bytes: Optional[int] = None
    # resource snapshot (filled when Docker stats available)
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    memory_used_mb: Optional[float] = None
    memory_limit_mb: Optional[float] = None
    network_rx_bytes: Optional[int] = None
    network_tx_bytes: Optional[int] = None

    def __init__(self, **kwargs):
        # Support backward-compat parameter names
        if "status_code" in kwargs and "http_status" not in kwargs:
            kwargs["http_status"] = kwargs.pop("status_code")
        if "error" in kwargs and "error_message" not in kwargs:
            kwargs["error_message"] = kwargs.pop("error")
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)
        if self.probe_duration_ms is None and self.latency_ms:
            self.probe_duration_ms = self.latency_ms

    @property
    def status_code(self) -> Optional[int]:
        return self.http_status

    @property
    def error(self) -> Optional[str]:
        return self.error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "seq": self.seq,
            "phase": self.phase.value if isinstance(self.phase, Phase) else str(self.phase),
            "timestamp": round(self.timestamp, 3),
            "endpoint": self.endpoint,
            "http_status": self.http_status,
            "success": self.success,
            "latency_ms": round(self.latency_ms, 2) if self.success else None,
            "raw_elapsed_ms": round(self.latency_ms, 2),
            "timeout": self.timeout,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "probe_duration_ms": round(self.probe_duration_ms, 2) if self.probe_duration_ms is not None else None,
            "response_size_bytes": self.response_size_bytes,
            "cpu_percent": round(self.cpu_percent, 2) if self.cpu_percent is not None else None,
            "memory_percent": round(self.memory_percent, 2) if self.memory_percent is not None else None,
            "memory_used_mb": round(self.memory_used_mb, 2) if self.memory_used_mb is not None else None,
            "memory_limit_mb": round(self.memory_limit_mb, 2) if self.memory_limit_mb is not None else None,
            "network_rx_bytes": self.network_rx_bytes,
            "network_tx_bytes": self.network_tx_bytes,
        }


# Backward compatibility alias for existing code/tests
ProbeResult = ProbeObservation


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
    classification: str = AnomalyClassification.ISOLATED_TRANSIENT_SPIKE.value
    z_score: Optional[float] = None
    confidence: str = "HIGH"

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
            "classification": self.classification,
            "z_score": round(self.z_score, 2) if self.z_score is not None else None,
            "confidence": self.confidence,
        }


# ---------------------------------------------------------------------------
# Statistical helpers with strict sample safety gates
# ---------------------------------------------------------------------------

def _safe_percentile(sorted_values: List[float], p: float) -> Optional[float]:
    """
    Calculates the p-th percentile (0–100) of a pre-sorted list.
    Returns None when the sample count is insufficient.
    Never returns 0.0 or NaN for missing samples.
    """
    n = len(sorted_values)
    if n == 0:
        return None
    if p >= 99 and n < MIN_SAMPLES_FOR_P99:
        return None
    if p >= 95 and n < MIN_SAMPLES_FOR_P95:
        return None
    idx = int(math.ceil((p / 100.0) * n)) - 1
    return round(sorted_values[max(0, min(idx, n - 1))], 2)


def _full_distribution(values: List[float], label: str = "") -> Dict[str, Any]:
    """
    Compute statistical distribution for valid float samples.
    Enforces sample count safety gates. Never fabricates percentiles.
    """
    if not values:
        return {
            "sample_count": 0,
            "insufficient_samples": True,
            "status": EvidenceState.INSUFFICIENT_DATA.value,
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "p50": None,
            "p75": None,
            "p90": None,
            "p95": None,
            "p99": None,
            "p95_status": "INSUFFICIENT_SAMPLES",
            "p99_status": "INSUFFICIENT_SAMPLES",
            "stddev": None,
            "variance": None,
        }

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
            stddev = 0.0
            variance = 0.0

    p95 = _safe_percentile(sv, 95)
    p99 = _safe_percentile(sv, 99)

    result: Dict[str, Any] = {
        "sample_count": n,
        "insufficient_samples": False,
        "status": EvidenceState.MEASURED.value if n >= MIN_SAMPLES_FOR_P95 else EvidenceState.PARTIALLY_MEASURED.value,
        "min": round(sv[0], 2),
        "max": round(sv[-1], 2),
        "mean": mean_v,
        "median": _safe_percentile(sv, 50),
        "p50": _safe_percentile(sv, 50),
        "p75": _safe_percentile(sv, 75),
        "p90": _safe_percentile(sv, 90),
        "p95": p95,
        "p99": p99,
        "p95_status": "AVAILABLE" if p95 is not None else "INSUFFICIENT_SAMPLES",
        "p99_status": "AVAILABLE" if p99 is not None else "INSUFFICIENT_SAMPLES",
    }
    if stddev is not None:
        result["stddev"] = stddev
        result["variance"] = variance
    else:
        result["stddev"] = None
        result["variance"] = None
        result["stddev_note"] = f"Requires >= {MIN_SAMPLES_FOR_STDDEV} samples (have {n})."
    if p99 is None:
        result["p99_note"] = f"P99 unavailable: requires >= {MIN_SAMPLES_FOR_P99} samples (have {n})."
    if p95 is None:
        result["p95_note"] = f"P95 unavailable: requires >= {MIN_SAMPLES_FOR_P95} samples (have {n})."

    return result


# ---------------------------------------------------------------------------
# Sampling Resolution & Observability Coverage
# ---------------------------------------------------------------------------

def compute_observability_coverage(
    fault_duration_sec: float,
    probe_interval_sec: float,
    sample_count: int,
) -> Dict[str, Any]:
    """
    Evaluates whether probe resolution was sufficient to observe the fault.
    Prevents false claims of 100% availability on short-duration events.
    """
    safe_dur = max(0.001, fault_duration_sec)
    expected_samples = max(1, int(safe_dur / max(0.001, probe_interval_sec)))
    is_under_sampled = (safe_dur < probe_interval_sec * 0.95) or (sample_count < 2)

    coverage_state = "INSUFFICIENT" if is_under_sampled else ("ADEQUATE" if sample_count >= 5 else "MARGINAL")

    return {
        "fault_duration_seconds": round(fault_duration_sec, 3),
        "probe_interval_seconds": round(probe_interval_sec, 3),
        "sample_count": sample_count,
        "expected_minimum_samples": expected_samples,
        "coverage": coverage_state,
        "under_sampled": is_under_sampled,
        "warning": (
            "Transient outage may be under-sampled. Fault duration was shorter than or comparable "
            "to the probe sampling interval. High availability cannot be guaranteed from this sample density."
            if is_under_sampled else None
        ),
    }


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

            stats = container.stats(stream=False)
            cpu_stats = stats.get("cpu_stats", {})
            precpu_stats = stats.get("precpu_stats", {})

            cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
            sys_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
            num_cpus = len(cpu_stats.get("cpu_usage", {}).get("percpu_usage") or [1])
            cpu_pct = round((cpu_delta / sys_delta) * num_cpus * 100.0, 2) if sys_delta > 0 else 0.0

            mem = stats.get("memory_stats", {})
            mem_usage = mem.get("usage", 0)
            mem_limit = mem.get("limit", 1)
            mem_pct = round((mem_usage / mem_limit) * 100, 2) if mem_limit else 0.0
            mem_mb = round(mem_usage / (1024 * 1024), 2)
            mem_limit_mb = round(mem_limit / (1024 * 1024), 2) if mem_limit else None

            net = stats.get("networks", {})
            rx_bytes = sum(v.get("rx_bytes", 0) for v in net.values()) if net else 0
            tx_bytes = sum(v.get("tx_bytes", 0) for v in net.values()) if net else 0

            return {
                "cpu_percent": cpu_pct,
                "memory_percent": mem_pct,
                "memory_used_mb": mem_mb,
                "memory_limit_mb": mem_limit_mb,
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
    If observations is empty, returns INSUFFICIENT_DATA status with None values,
    NOT fake 100% availability or 0.0 latency!
    """
    if not observations:
        return {
            "status": EvidenceState.INSUFFICIENT_DATA.value,
            "sample_count": 0,
            "insufficient_samples": True,
            "availability_percent": None,
            "successful_probes": 0,
            "failed_probes": 0,
            "timeout_count": 0,
            "connection_error_count": 0,
            "http_error_count": 0,
            "error_rate_percent": None,
            "timeout_rate_percent": None,
            "latency_distribution": _full_distribution([]),
            "availability_distribution": None,
            "baseline_comparison": None,
            # backward-compat flat fields
            "probes_count": 0,
            "avg_latency_ms": None,
            "p50_latency_ms": None,
            "p75_latency_ms": None,
            "p90_latency_ms": None,
            "p95_latency_ms": None,
            "p99_latency_ms": None,
            "min_latency_ms": None,
            "max_latency_ms": None,
            "stddev_latency_ms": None,
            "connection_errors_count": 0,
            "http_5xx_count": 0,
            "sample_errors": [],
            "probe_events": [],
            "cpu_mean_percent": None,
            "cpu_peak_percent": None,
            "memory_mean_mb": None,
            "memory_peak_mb": None,
            "memory_limit_mb": None,
            "memory_pressure_ratio": None,
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

    # STRICT RULE: Only successful probes have valid latency values!
    success_latencies = [o.latency_ms for o in successes if o.latency_ms is not None]
    lat_dist = _full_distribution(success_latencies)

    # Resource metrics aggregation
    cpus = [o.cpu_percent for o in observations if o.cpu_percent is not None]
    mems = [o.memory_used_mb for o in observations if o.memory_used_mb is not None]
    limits = [o.memory_limit_mb for o in observations if o.memory_limit_mb is not None]

    cpu_mean = round(sum(cpus) / len(cpus), 2) if cpus else None
    cpu_peak = round(max(cpus), 2) if cpus else None
    mem_mean = round(sum(mems) / len(mems), 2) if mems else None
    mem_peak = round(max(mems), 2) if mems else None
    mem_limit = limits[0] if limits else None
    mem_ratio = round(mem_peak / mem_limit, 4) if (mem_peak is not None and mem_limit and mem_limit > 0) else None

    # Baseline-relative deviation
    baseline_comparison = None
    if baseline_distribution and baseline_distribution.get("sample_count", 0) > 0:
        base_mean = baseline_distribution.get("mean")
        fault_mean = lat_dist.get("mean")
        base_p95 = baseline_distribution.get("p95")
        fault_p95 = lat_dist.get("p95")

        if base_mean is not None and fault_mean is not None:
            abs_delta_mean = round(fault_mean - base_mean, 2)
            pct_delta_mean = round(((fault_mean - base_mean) / base_mean) * 100, 1) if base_mean > 0 else 0.0
            ratio_mean = round(fault_mean / base_mean, 3) if base_mean > 0 else 1.0

            abs_delta_p95 = round(fault_p95 - base_p95, 2) if (fault_p95 is not None and base_p95 is not None) else None
            pct_delta_p95 = (
                round(((fault_p95 - base_p95) / base_p95) * 100, 1)
                if (base_p95 and base_p95 > 0 and fault_p95 is not None) else None
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

    status = EvidenceState.MEASURED.value if n >= 3 else EvidenceState.PARTIALLY_MEASURED.value

    return {
        "status": status,
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
        "baseline_comparison": baseline_comparison,
        # backward-compat flat fields
        "probes_count": n,
        "avg_latency_ms": lat_dist.get("mean"),
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
        # telemetry
        "cpu_mean_percent": cpu_mean,
        "cpu_peak_percent": cpu_peak,
        "memory_mean_mb": mem_mean,
        "memory_peak_mb": mem_peak,
        "memory_limit_mb": mem_limit,
        "memory_pressure_ratio": mem_ratio,
    }


# ---------------------------------------------------------------------------
# Anomaly & spike detector (temporal shape classification)
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """
    Scans observations for anomalies relative to baseline distribution.
    Distinguishes:
      - SUSTAINED_LATENCY_DEGRADATION (distribution shifted across >= 60% probes)
      - ISOLATED_TRANSIENT_SPIKE (occasional excursion returning immediately)
      - BURST_OF_SPIKES (cluster of 2-4 consecutive spikes)
      - Consecutive failure bursts
    Baseline statistics are frozen before fault execution.
    """

    @staticmethod
    def detect(
        observations: List[ProbeObservation],
        baseline_dist: Optional[Dict[str, Any]],
    ) -> Tuple[List[AnomalyEvent], Dict[str, Any]]:
        if not observations:
            return [], {}

        base_mean = (baseline_dist or {}).get("mean")
        base_stddev = (baseline_dist or {}).get("stddev")
        base_samples = (baseline_dist or {}).get("sample_count", 0)

        anomalies: List[AnomalyEvent] = []
        max_consecutive_failures = 0
        current_consecutive = 0
        time_to_first_impact: Optional[float] = None
        first_obs_ts = observations[0].timestamp if observations else None

        peak_latency = 0.0
        peak_latency_ts: Optional[float] = None

        # 3σ or deviation threshold calculation
        spike_threshold: Optional[float] = None
        has_reliable_stddev = (base_samples >= MIN_SAMPLES_FOR_STDDEV) and (base_stddev is not None)

        if base_mean is not None and base_mean > 0:
            if has_reliable_stddev and base_stddev > 0:
                spike_threshold = base_mean + SPIKE_STDDEV_THRESHOLD * base_stddev
            else:
                spike_threshold = base_mean * DEVIATION_RATIO_SPIKE

        # Collect success observations
        valid_obs = [o for o in observations if o.success and o.latency_ms is not None]
        n_valid = len(valid_obs)

        # Track consecutive failures & first failure impact
        for obs in observations:
            if not obs.success:
                current_consecutive += 1
                if current_consecutive > max_consecutive_failures:
                    max_consecutive_failures = current_consecutive
                if time_to_first_impact is None and first_obs_ts is not None:
                    time_to_first_impact = round(obs.timestamp - first_obs_ts, 3)
            else:
                current_consecutive = 0
                if obs.latency_ms > peak_latency:
                    peak_latency = obs.latency_ms
                    peak_latency_ts = obs.timestamp

        # Detect elevated observations
        elevated_obs = []
        if spike_threshold is not None and base_mean is not None:
            elevated_obs = [o for o in valid_obs if o.latency_ms > spike_threshold]

        sustained_shift = False
        sustained_ratio = (len(elevated_obs) / n_valid) if n_valid > 0 else 0.0

        if n_valid >= 5 and sustained_ratio >= SUSTAINED_SHIFT_RATIO and base_mean is not None:
            # SUSTAINED SHIFT: do NOT classify as dozens of independent spikes!
            sustained_shift = True
            first_elevated = elevated_obs[0]
            last_elevated = elevated_obs[-1]
            dur_sec = max(0.1, round(last_elevated.timestamp - first_elevated.timestamp, 2))
            mean_elevated = round(sum(o.latency_ms for o in elevated_obs) / len(elevated_obs), 2)
            abs_dev = round(mean_elevated - base_mean, 2)
            pct_dev = round(((mean_elevated - base_mean) / base_mean) * 100, 1)

            z_sc = round((mean_elevated - base_mean) / base_stddev, 2) if (has_reliable_stddev and base_stddev > 0) else None

            anomalies.append(AnomalyEvent(
                start_time=first_elevated.timestamp,
                end_time=last_elevated.timestamp + (last_elevated.latency_ms / 1000),
                duration_sec=dur_sec,
                severity="critical" if mean_elevated > base_mean * 4 else ("high" if mean_elevated > base_mean * 2 else "medium"),
                affected_metric="latency_ms",
                baseline_value=base_mean,
                observed_value=mean_elevated,
                deviation=abs_dev,
                deviation_pct=pct_dev,
                description=(
                    f"Sustained latency degradation: {len(elevated_obs)}/{n_valid} probes ({round(sustained_ratio*100, 1)}%) "
                    f"consistently elevated above threshold ({spike_threshold}ms). Mean in-fault: {mean_elevated}ms (+{abs_dev}ms, +{pct_dev}%)."
                ),
                classification=AnomalyClassification.SUSTAINED_LATENCY_DEGRADATION.value,
                z_score=z_sc,
                confidence="HIGH" if has_reliable_stddev else "MEDIUM",
            ))
        elif elevated_obs and base_mean is not None:
            # Genuine isolated spikes or small burst
            for obs in elevated_obs:
                abs_dev = round(obs.latency_ms - base_mean, 2)
                pct_dev = round(((obs.latency_ms - base_mean) / base_mean) * 100, 1) if base_mean > 0 else 0.0
                z_sc = round((obs.latency_ms - base_mean) / base_stddev, 2) if (has_reliable_stddev and base_stddev > 0) else None
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
                    description=f"Isolated latency excursion: {obs.latency_ms}ms vs baseline {base_mean}ms (+{abs_dev}ms, +{pct_dev}%)",
                    classification=AnomalyClassification.ISOLATED_TRANSIENT_SPIKE.value,
                    z_score=z_sc,
                    confidence="HIGH" if has_reliable_stddev else "MEDIUM",
                ))

        # Consecutive failure burst detection
        failure_bursts = []
        current_burst_start: Optional[float] = None
        current_burst_count = 0
        for obs in observations:
            if not obs.success:
                if current_burst_start is None:
                    current_burst_start = obs.timestamp
                current_burst_count += 1
            else:
                if current_burst_count >= 2 and current_burst_start is not None:
                    failure_bursts.append({
                        "start_time": round(current_burst_start, 3),
                        "end_time": round(obs.timestamp, 3),
                        "consecutive_failures": current_burst_count,
                        "duration_sec": round(obs.timestamp - current_burst_start, 2),
                    })
                current_burst_start = None
                current_burst_count = 0
        if current_burst_count >= 2 and current_burst_start and observations:
            last_ts = observations[-1].timestamp
            failure_bursts.append({
                "start_time": round(current_burst_start, 3),
                "end_time": round(last_ts, 3),
                "consecutive_failures": current_burst_count,
                "duration_sec": round(last_ts - current_burst_start, 2),
            })

        # Peak impact summary
        peak_impact = None
        if peak_latency_ts and base_mean and base_mean > 0:
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
        if n_valid >= MIN_SAMPLES_FOR_P95:
            sorted_v = sorted(o.latency_ms for o in valid_obs)
            p50 = _safe_percentile(sorted_v, 50)
            p95 = _safe_percentile(sorted_v, 95)
            if p50 and p95 and p50 > 0 and p95 >= p50 * 3.5 and p95 > 100:
                tail_divergence = {
                    "detected": True,
                    "p50_ms": p50,
                    "p95_ms": p95,
                    "p95_p50_ratio": round(p95 / p50, 2),
                    "description": f"Tail latency divergence: P95 ({p95}ms) is {round(p95/p50, 1)}x P50 ({p50}ms)",
                }

        summary = {
            "spike_count": len([a for a in anomalies if a.classification == AnomalyClassification.ISOLATED_TRANSIENT_SPIKE.value]),
            "sustained_degradation_detected": sustained_shift,
            "sustained_degradation_ratio": round(sustained_ratio, 3),
            "max_consecutive_failures": max_consecutive_failures,
            "failure_bursts": failure_bursts,
            "time_to_first_failure_sec": time_to_first_impact,
            "peak_impact": peak_impact,
            "tail_latency_divergence": tail_divergence,
            "baseline_samples_used": base_samples,
            "baseline_stddev_reliable": has_reliable_stddev,
        }

        return anomalies, summary


# ---------------------------------------------------------------------------
# Rolling window metrics
# ---------------------------------------------------------------------------

def _compute_rolling_metrics(
    observations: List[ProbeObservation],
    window_sec: float = 5.0,
) -> List[Dict[str, Any]]:
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

        success_lats = [o.latency_ms for o in window_obs if o.success and o.latency_ms is not None]
        avail = round((sum(1 for o in window_obs if o.success) / len(window_obs)) * 100, 1)
        mean_lat = round(sum(success_lats) / len(success_lats), 2) if success_lats else None
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

        # Derived state
        self.baseline: Optional[Dict[str, Any]] = None
        self._baseline_distribution: Optional[Dict[str, Any]] = None

        # Threading
        self._stop_probing = threading.Event()
        self._probe_thread: Optional[threading.Thread] = None
        self._fault_seq = 0

        # Authoritative Monotonic Lifecycle Timestamps
        self._experiment_start: Optional[float] = None
        self._baseline_start: Optional[float] = None
        self._baseline_end: Optional[float] = None
        self._fault_window_start: Optional[float] = None
        self._fault_window_end: Optional[float] = None
        self._rollback_start: Optional[float] = None
        self._rollback_end: Optional[float] = None
        self._recovery_start: Optional[float] = None
        self._recovery_end: Optional[float] = None
        self._experiment_end: Optional[float] = None
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
        Collects baseline probes before fault injection and freezes statistical distribution.
        """
        probe_count = count if count is not None else self.baseline_probe_count
        probe_interval = interval if interval is not None else self.baseline_interval_sec

        self._baseline_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._baseline_start

        if not self.probe_url:
            self._baseline_end = time.time()
            self.baseline = {
                "status": EvidenceState.INSUFFICIENT_DATA.value,
                "available": False,
                "probe_url": None,
                "reason": "No probe URL configured.",
                "sample_count": 0,
                "probes_count": 0,
                "healthy": False,
                "availability_percent": None,
                "avg_latency_ms": None,
                "distribution": _full_distribution([]),
                "raw_observations": [],
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
                obs.memory_limit_mb = resource.get("memory_limit_mb")
                obs.network_rx_bytes = resource.get("network_rx_bytes")
                obs.network_tx_bytes = resource.get("network_tx_bytes")
            self.baseline_observations.append(obs)
            if i < probe_count - 1:
                time.sleep(probe_interval)

        self._baseline_end = time.time()

        # Compute and freeze baseline distribution
        metrics = _compute_phase_metrics(self.baseline_observations)
        self._baseline_distribution = metrics.get("latency_distribution", {})

        successes = [o for o in self.baseline_observations if o.success]
        avail = round((len(successes) / len(self.baseline_observations)) * 100, 1) if self.baseline_observations else 0.0

        self.baseline = {
            "status": EvidenceState.MEASURED.value if len(self.baseline_observations) >= 3 else EvidenceState.PARTIALLY_MEASURED.value,
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
            # flat fields
            "avg_latency_ms": self._baseline_distribution.get("mean"),
            "p50_latency_ms": self._baseline_distribution.get("p50"),
            "p75_latency_ms": self._baseline_distribution.get("p75"),
            "p90_latency_ms": self._baseline_distribution.get("p90"),
            "p95_latency_ms": self._baseline_distribution.get("p95"),
            "p99_latency_ms": self._baseline_distribution.get("p99"),
            "min_latency_ms": self._baseline_distribution.get("min"),
            "max_latency_ms": self._baseline_distribution.get("max"),
            "stddev_latency_ms": self._baseline_distribution.get("stddev"),
            # resource telemetry
            "baseline_cpu_percent": metrics.get("cpu_mean_percent"),
            "baseline_memory_percent": round(metrics.get("memory_mean_mb", 0) / (metrics.get("memory_limit_mb") or 1) * 100, 2) if metrics.get("memory_limit_mb") else None,
            "baseline_memory_used_mb": metrics.get("memory_mean_mb"),
            "raw_observations": [o.to_dict() for o in self.baseline_observations],
        }
        return self.baseline

    # ------------------------------------------------------------------
    # Phase 2: Fault window probing (supports adaptive resolution)
    # ------------------------------------------------------------------

    def start_in_fault_probing(
        self,
        interval_sec: Optional[float] = None,
        high_resolution_interval: Optional[float] = None,
    ) -> None:
        """Starts background probing during the fault window with configurable density."""
        self._fault_window_start = time.time()
        if self._experiment_start is None:
            self._experiment_start = self._fault_window_start

        if not self.probe_url:
            return

        probe_interval = high_resolution_interval or interval_sec or self.fault_probe_interval
        self._active_fault_probe_interval = probe_interval
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
                    obs.memory_limit_mb = resource.get("memory_limit_mb")
                    obs.network_rx_bytes = resource.get("network_rx_bytes")
                    obs.network_tx_bytes = resource.get("network_tx_bytes")
                self.fault_observations.append(obs)

                # Update first deviation timestamp
                if self._first_deviation_ts is None and not obs.success and self._baseline_distribution:
                    self._first_deviation_ts = obs.timestamp
                elif self._first_deviation_ts is None and obs.success and self._baseline_distribution:
                    base_mean = self._baseline_distribution.get("mean")
                    if base_mean and obs.latency_ms > base_mean * DEVIATION_RATIO_WARN:
                        self._first_deviation_ts = obs.timestamp

                # Track peak degradation
                if obs.success:
                    if self._peak_degradation_ts is None:
                        self._peak_degradation_ts = obs.timestamp
                    else:
                        current_peak = max(
                            (o.latency_ms for o in self.fault_observations if o.success and o.latency_ms is not None),
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
        """Stops in-fault probing, computes metrics, anomalies, and sampling coverage."""
        self._fault_window_end = fault_window_end if fault_window_end is not None else time.time()
        self._stop_probing.set()
        if self._probe_thread and self._probe_thread.is_alive():
            self._probe_thread.join(timeout=2.0)

        metrics = _compute_phase_metrics(self.fault_observations, self._baseline_distribution)

        # Anomaly detection with temporal shape classification
        anomalies, anomaly_summary = AnomalyDetector.detect(self.fault_observations, self._baseline_distribution)
        metrics["anomalies"] = [a.to_dict() for a in anomalies]
        metrics["anomaly_summary"] = anomaly_summary

        # Rolling window metrics
        metrics["rolling_metrics"] = _compute_rolling_metrics(self.fault_observations, self.rolling_window_sec)

        # Observability coverage evaluation
        fw_dur = (self._fault_window_end - (self._fault_window_start or self._fault_window_end))
        probe_interval = getattr(self, "_active_fault_probe_interval", self.fault_probe_interval)
        coverage = compute_observability_coverage(
            fault_duration_sec=fw_dur,
            probe_interval_sec=probe_interval,
            sample_count=len(self.fault_observations),
        )
        metrics["observability_coverage"] = coverage

        # Relative latency multiplier
        base_mean = (self._baseline_distribution or {}).get("mean")
        if base_mean is None and self.baseline:
            base_mean = self.baseline.get("avg_latency_ms") or self.baseline.get("mean_latency_ms")
        fault_mean = (metrics.get("latency_distribution") or {}).get("mean")
        if fault_mean is None and metrics.get("avg_latency_ms") is not None:
            fault_mean = metrics.get("avg_latency_ms")

        if base_mean and fault_mean and base_mean > 0:
            metrics["latency_multiplier"] = round(fault_mean / base_mean, 3)
        else:
            metrics["latency_multiplier"] = None if not self.fault_observations else 1.0

        return metrics

    # ------------------------------------------------------------------
    # Phase 3: Recovery (rigorous observation-derived recovery time)
    # ------------------------------------------------------------------

    def measure_recovery(
        self,
        max_wait_sec: float = 30.0,
        poll_interval: Optional[float] = None,
        rto_target_sec: float = 5.0,
    ) -> Dict[str, Any]:
        """
        Rigorous recovery measurement:
        - Recovery started timestamp is exact rollback completion / fault removal time.
        - Stability requirement: N consecutive healthy probes within baseline tolerance.
        - Recovery time is derived from the timestamp of the FIRST healthy probe
          in the stabilized sequence: (first_healthy_in_seq.timestamp - recovery_started_at).
        - If no probes exist or no recovery observations: recovery_time_seconds = None,
          status = INCONCLUSIVE, rto_met = None.
        - NEVER substitutes 0.0s or 0 for missing data.
        """
        self._recovery_start = time.time()

        if not self.probe_url:
            self._recovery_end = time.time()
            return {
                "status": EvidenceState.INCONCLUSIVE.value,
                "recovered": None,
                "recovery_time_seconds": None,
                "rto_seconds": None,
                "rto_target_seconds": rto_target_sec,
                "rto_target_met": None,
                "rto_delta_seconds": None,
                "rto_status": "INCONCLUSIVE",
                "timed_out": False,
                "consecutive_healthy_required": self.recovery_consecutive_required,
                "recovery_stability_required": self.recovery_consecutive_required,
                "recovery_stability_achieved": 0,
                "recovery_probe_count": 0,
                "recovery_successful_probe_count": 0,
                "recovery_failed_probe_count": 0,
                "recovery_first_healthy_at": None,
                "recovery_confirmed_at": None,
                "post_recovery_latency_ms": None,
                "recovery_trajectory": [],
                "raw_observations": [],
                "reason": "Recovery could not be evaluated because no valid recovery probe observations were collected.",
            }

        probe_interval = poll_interval if poll_interval is not None else self.recovery_probe_interval
        t_start = self._recovery_start
        deadline = t_start + max_wait_sec
        recovered = False
        consecutive_healthy = 0
        first_healthy_obs: Optional[ProbeObservation] = None
        confirmed_at: Optional[float] = None
        seq = 0

        while time.time() < deadline:
            resource = ResourceTelemetry.collect(self.docker_mgr, self.container_name) if self.container_name else None
            try:
                obs = ChaosProbe.probe(
                    self.probe_url,
                    timeout_sec=3.0,
                    expected_status=self.expected_status,
                    phase=Phase.RECOVERY,
                    seq=seq,
                )
            except StopIteration:
                break
            seq += 1
            if resource:
                obs.cpu_percent = resource.get("cpu_percent")
                obs.memory_percent = resource.get("memory_percent")
                obs.memory_used_mb = resource.get("memory_used_mb")
                obs.memory_limit_mb = resource.get("memory_limit_mb")
            self.recovery_observations.append(obs)

            # Tolerance check: latency within 50% of baseline mean
            base_mean = (self._baseline_distribution or {}).get("mean")
            latency_ok = (base_mean is None) or (base_mean <= 0) or (obs.latency_ms <= base_mean * 1.5)

            if obs.success and latency_ok:
                if consecutive_healthy == 0:
                    first_healthy_obs = obs
                consecutive_healthy += 1
                if consecutive_healthy >= self.recovery_consecutive_required:
                    recovered = True
                    confirmed_at = obs.timestamp
                    break
            else:
                consecutive_healthy = 0
                first_healthy_obs = None

            time.sleep(probe_interval)

        self._recovery_end = time.time()

        successes = [o for o in self.recovery_observations if o.success]
        failures = [o for o in self.recovery_observations if not o.success]

        if not self.recovery_observations:
            return {
                "status": EvidenceState.INCONCLUSIVE.value,
                "recovered": None,
                "recovery_time_seconds": None,
                "rto_seconds": None,
                "rto_target_seconds": rto_target_sec,
                "rto_target_met": None,
                "rto_delta_seconds": None,
                "rto_status": "INCONCLUSIVE",
                "timed_out": False,
                "consecutive_healthy_required": self.recovery_consecutive_required,
                "recovery_stability_required": self.recovery_consecutive_required,
                "recovery_stability_achieved": 0,
                "recovery_probe_count": 0,
                "recovery_successful_probe_count": 0,
                "recovery_failed_probe_count": 0,
                "recovery_first_healthy_at": None,
                "recovery_confirmed_at": None,
                "post_recovery_latency_ms": None,
                "recovery_trajectory": [],
                "raw_observations": [],
                "reason": "Zero recovery observations collected.",
            }

        if recovered and first_healthy_obs is not None:
            # Deterministic, observation-derived recovery time (NOT detector loop duration)
            rec_time = round(first_healthy_obs.timestamp - t_start, 3)
            # Ensure non-negative duration
            rec_time = max(0.001, rec_time)
            first_healthy_ts = round(first_healthy_obs.timestamp, 3)
            confirmed_ts = round(confirmed_at, 3) if confirmed_at else None
            rto_met = (rec_time <= rto_target_sec)
            rto_delta = round(rec_time - rto_target_sec, 4)
            rto_status = "MET" if rto_met else "EXCEEDED"
            rec_status = "RECOVERED"
        else:
            rec_time = None
            first_healthy_ts = None
            confirmed_ts = None
            rto_met = False
            rto_delta = None
            rto_status = "EXCEEDED"
            rec_status = "TIMED_OUT"

        trajectory = [
            {
                "t": round(o.timestamp - t_start, 3),
                "latency_ms": o.latency_ms if o.success else None,
                "raw_elapsed_ms": o.latency_ms,
                "success": o.success,
                "http_status": o.http_status,
                "error": o.error_message,
            }
            for o in self.recovery_observations
        ]

        post_lat = successes[-1].latency_ms if successes else None

        return {
            "status": rec_status,
            "recovered": recovered,
            "recovery_time_seconds": rec_time,
            "rto_seconds": rec_time,
            "rto_target_seconds": rto_target_sec,
            "rto_target_met": rto_met,
            "rto_delta_seconds": rto_delta,
            "rto_status": rto_status,
            "timed_out": not recovered,
            "consecutive_healthy_required": self.recovery_consecutive_required,
            "recovery_stability_required": self.recovery_consecutive_required,
            "recovery_stability_achieved": consecutive_healthy,
            "recovery_probe_count": len(self.recovery_observations),
            "recovery_successful_probe_count": len(successes),
            "recovery_failed_probe_count": len(failures),
            "recovery_first_healthy_at": first_healthy_ts,
            "recovery_confirmed_at": confirmed_ts,
            "post_recovery_latency_ms": post_lat,
            "recovery_trajectory": trajectory,
            "raw_observations": [o.to_dict() for o in self.recovery_observations],
        }

    # ------------------------------------------------------------------
    # Authoritative Monotonic Timestamps & Duration Breakdown
    # ------------------------------------------------------------------

    def record_rollback_timing(self, start_ts: float, end_ts: float) -> None:
        """Records explicit rollback start and completion timestamps."""
        self._rollback_start = start_ts
        self._rollback_end = end_ts

    def lifecycle_timestamps(self) -> Dict[str, Any]:
        """
        Returns authoritative lifecycle timestamps and duration breakdown.
        Durations are strictly derived from these monotonic timestamps.
        """
        now = time.time()

        def _dur(s: Optional[float], e: Optional[float]) -> Optional[float]:
            if s is None:
                return None
            end_val = e if e is not None else now
            return max(0.0, round(end_val - s, 3))

        exp_start = self._experiment_start or self._baseline_start or self._fault_window_start
        exp_end = self._recovery_end or self._fault_window_end or now

        fw_dur = _dur(self._fault_window_start, self._fault_window_end)
        base_dur = _dur(self._baseline_start, self._baseline_end)
        rollback_dur = _dur(self._rollback_start, self._rollback_end)
        rec_dur = _dur(self._recovery_start, self._recovery_end)
        total_dur = _dur(exp_start, exp_end)

        tti = None
        if self._first_deviation_ts and self._fault_window_start:
            tti = max(0.0, round(self._first_deviation_ts - self._fault_window_start, 3))

        duration_breakdown = {
            "preparation_duration_seconds": _dur(exp_start, self._baseline_start or exp_start),
            "baseline_duration_seconds": base_dur,
            "fault_window_duration_seconds": fw_dur,
            "rollback_duration_seconds": rollback_dur,
            "recovery_duration_seconds": rec_dur,
            "total_experiment_duration_seconds": total_dur,
        }

        return {
            "experiment_started_at": round(exp_start, 3) if exp_start else None,
            "baseline_started_at": round(self._baseline_start, 3) if self._baseline_start else None,
            "baseline_completed_at": round(self._baseline_end, 3) if self._baseline_end else None,
            "baseline_duration_seconds": base_dur,
            "fault_injection_started_at": round(self._fault_window_start, 3) if self._fault_window_start else None,
            "fault_injection_completed_at": round(self._fault_window_end, 3) if self._fault_window_end else None,
            "fault_window_duration_seconds": fw_dur,
            "first_deviation_at": round(self._first_deviation_ts, 3) if self._first_deviation_ts else None,
            "time_to_first_impact_seconds": tti,
            "peak_degradation_at": round(self._peak_degradation_ts, 3) if self._peak_degradation_ts else None,
            "rollback_started_at": round(self._rollback_start, 3) if self._rollback_start else None,
            "rollback_completed_at": round(self._rollback_end, 3) if self._rollback_end else None,
            "rollback_duration_seconds": rollback_dur,
            "recovery_started_at": round(self._recovery_start, 3) if self._recovery_start else None,
            "recovery_confirmed_at": round(self._recovery_end, 3) if self._recovery_end else None,
            "recovery_duration_seconds": rec_dur,
            "experiment_completed_at": round(exp_end, 3) if exp_end else None,
            "total_experiment_duration_seconds": total_dur,
            "duration_breakdown": duration_breakdown,
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
# Resilience Scorer (Evidence-Gated & Transparent)
# ---------------------------------------------------------------------------

class ResilienceScorer:
    """
    Computes an evidence-gated, transparent Resilience Score.
    Distinguishes genuine resilience from insufficient evidence.
    Separates Resilience Score (application health) from Measurement Quality Score (experiment rigor).
    """

    @staticmethod
    def calculate_score(
        fault_type: str,
        baseline: Optional[Dict[str, Any]],
        experiment_metrics: Optional[Dict[str, Any]],
        recovery_metrics: Optional[Dict[str, Any]],
        rollback_success: bool = True,
        anomaly_summary: Optional[Dict[str, Any]] = None,
        lifecycle_timing: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        exp = experiment_metrics or {}
        rec = recovery_metrics or {}
        base = baseline or {}
        anoms = anomaly_summary or {}

        has_probe = bool(
            base.get("available")
            and exp.get("probes_count", 0) > 0
        )
        fault_sample_count = exp.get("sample_count", exp.get("probes_count", 0))
        recovery_sample_count = rec.get("recovery_probe_count", len(rec.get("raw_observations", [])))
        if recovery_sample_count == 0 and rec.get("recovered") is not None:
            recovery_sample_count = rec.get("recovery_stability_achieved", 3 if rec.get("recovered") else 1)
        baseline_sample_count = base.get("sample_count", base.get("probes_count", 0))
        if baseline_sample_count == 0 and isinstance(base.get("distribution"), dict):
            baseline_sample_count = base["distribution"].get("sample_count", 0)

        # --- Calculate Measurement Quality Score (0–100) ---
        quality_score = 0
        quality_breakdown = {}

        # 1. Baseline Quality (25 pts)
        if baseline_sample_count >= 10:
            b_pts = 25
        elif baseline_sample_count >= 5:
            b_pts = 18
        elif baseline_sample_count >= 1:
            b_pts = 10
        else:
            b_pts = 0
        quality_breakdown["baseline_sampling"] = b_pts
        quality_score += b_pts

        # 2. Fault Sampling & Density (35 pts)
        cov = exp.get("observability_coverage") or {}
        under_sampled = cov.get("under_sampled", False)
        if not under_sampled and fault_sample_count >= 20:
            f_pts = 35
        elif not under_sampled and fault_sample_count >= 10:
            f_pts = 28
        elif fault_sample_count >= 3:
            f_pts = 15 if not under_sampled else 8
        elif fault_sample_count >= 1:
            f_pts = 5
        else:
            f_pts = 0
        quality_breakdown["fault_sampling"] = f_pts
        quality_score += f_pts

        # 3. Recovery Sampling (20 pts)
        if recovery_sample_count >= 3:
            r_pts = 20
        elif recovery_sample_count >= 1:
            r_pts = 10
        else:
            r_pts = 0
        quality_breakdown["recovery_sampling"] = r_pts
        quality_score += r_pts

        # 4. Telemetry Completeness (10 pts)
        has_telemetry = bool(exp.get("cpu_mean_percent") is not None or exp.get("memory_mean_mb") is not None)
        t_pts = 10 if has_telemetry else 0
        quality_breakdown["telemetry_completeness"] = t_pts
        quality_score += t_pts

        # 5. Statistical Validity / Percentiles (10 pts)
        lat_dist = exp.get("latency_distribution") or {}
        p95_valid = lat_dist.get("p95") is not None
        p_pts = 10 if p95_valid else (5 if fault_sample_count >= 5 else 0)
        quality_breakdown["statistical_validity"] = p_pts
        quality_score += p_pts

        quality_score = min(100, max(0, quality_score))
        if quality_score >= 85:
            quality_grade = "EXCELLENT"
        elif quality_score >= 70:
            quality_grade = "GOOD"
        elif quality_score >= 50:
            quality_grade = "ADEQUATE"
        elif quality_score >= 25:
            quality_grade = "POOR"
        else:
            quality_grade = "INSUFFICIENT"

        # --- EVIDENCE SUFFICIENCY GATE ---
        # If no active probe or 0 fault probes collected, Noir MUST NOT assign a numeric resilience score.
        if not has_probe or fault_sample_count == 0:
            return {
                "score": None,
                "grade": "INCONCLUSIVE",
                "classification": "INCONCLUSIVE (Insufficient Evidence)",
                "has_probe": False,
                "evidence_state": EvidenceState.INSUFFICIENT_DATA.value,
                "evidence_gate_passed": False,
                "evidence_gate_reason": (
                    "No synthetic HTTP probe observations were collected during the fault window. "
                    "Resilience and recovery cannot be verified from missing observations."
                ),
                "confidence": "inconclusive",
                "confidence_reason": "No in-fault probe observations collected.",
                "breakdown": {
                    "availability": None,
                    "latency_degradation": None,
                    "tail_latency": None,
                    "recovery": None,
                    "rollback": 10.0 if rollback_success else 0.0,
                    "stability": None,
                },
                "score_before_evidence_gate": None,
                "evidence_adjustment": {"adjustment": 0, "reason": "Gate failed — score suppressed to prevent false health claim."},
                "measurement_quality_score": quality_score,
                "measurement_quality_grade": quality_grade,
                "measurement_quality_breakdown": quality_breakdown,
                "recommendations": [
                    "Configure an active HTTP probe endpoint (--probe-url) to collect real-time steady-state measurements.",
                    "Verify target container is reachable from the chaos worker daemon before running fault injection.",
                ],
            }

        # --- Compute Resilience Score Components (0–100) ---
        # 1. Availability (30 pts)
        avail = exp.get("availability_percent")
        if avail is not None:
            avail_score = round((avail / 100.0) * 30, 1)
        else:
            avail_score = 0.0

        # 2. Latency degradation (20 pts)
        comparison = exp.get("baseline_comparison") or {}
        mult = exp.get("latency_multiplier")
        if mult is None:
            mult = comparison.get("ratio_to_baseline", 1.0)

        if mult is None:
            lat_score = 10.0  # uncertain
        elif mult <= 1.15:
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

        # 3. Tail latency (10 pts)
        pct_delta_p95 = comparison.get("percentage_delta_p95")
        if pct_delta_p95 is None:
            exp_p95 = exp.get("p95_latency_ms")
            base_p95 = base.get("p95_latency_ms") or base.get("avg_latency_ms") or base.get("mean_latency_ms")
            if exp_p95 is not None and base_p95 and base_p95 > 0:
                pct_delta_p95 = round(((exp_p95 - base_p95) / base_p95) * 100, 1)

        if pct_delta_p95 is None:
            tail_score = 5.0  # insufficient samples to measure tail
        elif pct_delta_p95 <= 10:
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
        is_rec = rec.get("recovered")
        rec_time = rec.get("recovery_time_seconds")
        if rec_time is None:
            rec_time = rec.get("rto_seconds")

        if is_rec is None or rec_time is None:
            # Recovery was inconclusive / unobserved
            rec_score = 10.0
        elif not is_rec:
            # Service failed to restore steady state
            rec_score = 0.0
        elif rec_time <= 1.0:
            rec_score = 25.0
        elif rec_time <= 3.0:
            rec_score = 20.0
        elif rec_time <= 5.0:
            rec_score = 15.0
        elif rec_time <= 10.0:
            rec_score = 8.0
        else:
            rec_score = 3.0

        # 5. Rollback integrity (10 pts)
        rollback_score = 10.0 if rollback_success else 0.0

        # 6. Stability (5 pts)
        spike_count = anoms.get("spike_count", 0)
        max_consec = anoms.get("max_consecutive_failures", 0)
        sustained = anoms.get("sustained_degradation_detected", False)
        stability_penalty = min(5.0, spike_count * 1.0 + max_consec * 0.5 + (2.0 if sustained else 0.0))
        stability_score = max(0.0, 5.0 - stability_penalty)

        raw_total = avail_score + lat_score + tail_score + rec_score + rollback_score + stability_score
        score_before_gate = int(round(raw_total))

        # Under-sampling adjustment: if fault was under-sampled, cap confidence
        evidence_adjustment = 0
        adj_reason = "No adjustment applied."
        if under_sampled:
            evidence_adjustment = -5
            adj_reason = "Under-sampled transient fault; small resolution penalty applied."

        final_score = min(100, max(0, score_before_gate + evidence_adjustment))

        # Grade assignment
        if final_score >= 90:
            grade = "A"; classification = "Resilient (Production Grade)"
        elif final_score >= 75:
            grade = "B"; classification = "Gracefully Degraded"
        elif final_score >= 50:
            grade = "C"; classification = "Vulnerable"
        else:
            grade = "F"; classification = "Fragile / High Risk"

        # Confidence assignment
        if under_sampled:
            confidence = "low"
            confidence_reason = "Fault event duration was shorter than probe interval; outage may have occurred between probes."
        elif fault_sample_count >= 20 and quality_score >= 75:
            confidence = "high"
            confidence_reason = f"{fault_sample_count} in-fault probes and high measurement quality score ({quality_score}/100)."
        elif fault_sample_count >= 8:
            confidence = "medium"
            confidence_reason = f"{fault_sample_count} in-fault probes collected."
        else:
            confidence = "low"
            confidence_reason = f"Only {fault_sample_count} in-fault probe(s); results have elevated statistical uncertainty."

        # Recommendations
        recs = []
        if avail is not None and avail < 80.0:
            recs.append("Deploy multiple service replicas with active health checks and load balancing.")
        if mult is not None and mult > 2.5:
            recs.append("Configure explicit client timeouts with bounded exponential backoff and jitter.")
        if pct_delta_p95 is not None and pct_delta_p95 > 50:
            recs.append("Investigate tail latency: consider connection pool sizing, GC pauses, and thread contention.")
        if rec_time is not None and rec_time > 4.0:
            recs.append("Optimize container restart and warm-up time; configure graceful termination (SIGTERM).")
        elif is_rec is False:
            recs.append("Investigate process failure to recover steady state: verify healthcheck probe endpoints.")
        if fault_type in ("cpu_stress", "memory_stress"):
            recs.append("Define explicit CPU and memory cgroup limits in docker-compose.yml to prevent node starvation.")
        if spike_count > 0:
            recs.append(f"Investigate {spike_count} latency spike(s): consider rate limiting or circuit breaker patterns.")
        if under_sampled:
            recs.append("Increase probe sampling density (lower probe interval) to monitor short-duration lifecycle events.")
        if not recs:
            recs.append("System maintained excellent resilience under fault injection.")

        return {
            "score": final_score,
            "grade": grade,
            "classification": classification,
            "has_probe": True,
            "evidence_state": EvidenceState.MEASURED.value if fault_sample_count >= 3 else EvidenceState.PARTIALLY_MEASURED.value,
            "evidence_gate_passed": True,
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
            "score_before_evidence_gate": score_before_gate,
            "evidence_adjustment": {"adjustment": evidence_adjustment, "reason": adj_reason},
            "final_score": final_score,
            "measurement_quality_score": quality_score,
            "measurement_quality_grade": quality_grade,
            "measurement_quality_breakdown": quality_breakdown,
            "recommendations": recs,
        }
