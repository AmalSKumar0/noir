"""
Noir Chaos Engineering Analysis & Structured Reporting Engine

Implements an evidence-driven, scientific Chaos Engineering report architecture:
  Experiment -> Raw Measurements -> Metrics Aggregator -> Finding Detector ->
  Recommendation Engine -> Report Data Model -> Web/Print/Markdown Output.

Separates execution from metric aggregation, analysis, and report rendering.
Produces strictly evidence-based findings, anomalies, root-cause indicators,
and actionable recommendations paired with follow-up validation experiments.
"""

from typing import Dict, Any, List, Optional
import math


DEFAULT_HYPOTHESES = {
    "container_restart": {
        "hypothesis": "Application will handle container restart with brief request drops, but automatically restore steady-state availability and latency within the RTO target without lingering state corruption.",
        "expected_behavior": "Short connection drops (< 5s) during container restart; automatic reconnect and steady-state latency resumption once the process starts.",
    },
    "container_stop": {
        "hypothesis": "Application or routing layer will detect container unavailability; upon restart, the service will recover to normal steady-state baseline within the configured RTO target.",
        "expected_behavior": "Zero availability during the stopped window; clean, uncorrupted recovery upon container start.",
    },
    "network_delay": {
        "hypothesis": "Application and upstream clients will absorb added network latency without dropping connections or exceeding client timeout thresholds.",
        "expected_behavior": "Response times increase proportionally to injected delay (plus jitter), but request success rate (availability) remains at or near 100%.",
    },
    "network_loss": {
        "hypothesis": "Application will absorb packet loss via TCP retransmissions and application-level retries with availability remaining above 90%.",
        "expected_behavior": "Minor latency degradation due to packet retransmissions; overall request availability remains resilient without cascading connection resets.",
    },
    "cpu_stress": {
        "hypothesis": "Containerized service will handle CPU saturation with graceful throughput degradation while remaining available and avoiding worker process crashes.",
        "expected_behavior": "P95 latency degrades predictably under high CPU pressure (< 4x baseline), but the endpoint continues serving HTTP requests without thread starvation.",
    },
    "memory_stress": {
        "hypothesis": "Container memory allocation surge will remain within configured cgroup limits without triggering Linux OOM-killer (Out-Of-Memory) termination.",
        "expected_behavior": "Memory buffer fills and holds without container crash; memory is released cleanly on rollback without persistent leaks.",
    },
}


class MetricsAggregator:
    """Computes detailed statistical distributions and comparative delta metrics."""

    MIN_P99 = 20
    MIN_P95 = 10
    MIN_STDDEV = 5

    @staticmethod
    def calculate_percentiles(latencies: List[float]) -> Dict[str, Any]:
        if not latencies:
            return {"p50": 0.0, "p75": None, "p90": None, "p95": 0.0, "p99": None, "mean": 0.0, "min": 0.0, "max": 0.0, "stddev": None, "sample_count": 0}

        sorted_lat = sorted(latencies)
        n = len(sorted_lat)

        def _p(p: float) -> Optional[float]:
            if p == 99 and n < MetricsAggregator.MIN_P99:
                return None
            if p == 95 and n < MetricsAggregator.MIN_P95:
                return None
            idx = int(math.ceil((p / 100.0) * n)) - 1
            return round(sorted_lat[max(0, min(idx, n - 1))], 2)

        mean_val = round(sum(sorted_lat) / n, 2)
        stddev_val = None
        if n >= MetricsAggregator.MIN_STDDEV:
            mean_sq = sum((x - mean_val) ** 2 for x in sorted_lat) / n
            stddev_val = round(mean_sq ** 0.5, 3)

        return {
            "sample_count": n,
            "p50": _p(50),
            "p75": _p(75),
            "p90": _p(90),
            "p95": _p(95),
            "p99": _p(99),
            "mean": mean_val,
            "min": round(sorted_lat[0], 2),
            "max": round(sorted_lat[-1], 2),
            "stddev": stddev_val,
        }

    @staticmethod
    def from_raw_observations(raw_obs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Recomputes phase metrics from raw probe observation dicts.
        Enables report reproduction from stored raw data.
        """
        if not raw_obs:
            return {"sample_count": 0}
        n = len(raw_obs)
        successes = [o for o in raw_obs if o.get("success")]
        failures = [o for o in raw_obs if not o.get("success")]
        timeouts = [o for o in raw_obs if o.get("timeout")]
        conn_errs = [o for o in raw_obs if o.get("error_type") == "connection_error"]
        http_errs = [o for o in raw_obs if o.get("error_type") == "http_error"]
        avail = round((len(successes) / n) * 100, 2)
        lats = [o["latency_ms"] for o in successes if "latency_ms" in o]
        dist = MetricsAggregator.calculate_percentiles(lats)
        return {
            "sample_count": n,
            "availability_percent": avail,
            "successful_probes": len(successes),
            "failed_probes": len(failures),
            "timeout_count": len(timeouts),
            "connection_error_count": len(conn_errs),
            "http_error_count": len(http_errs),
            "error_rate_percent": round(100 - avail, 2),
            "latency_distribution": dist,
            "avg_latency_ms": dist.get("mean", 0.0),
            "p50_latency_ms": dist.get("p50"),
            "p75_latency_ms": dist.get("p75"),
            "p90_latency_ms": dist.get("p90"),
            "p95_latency_ms": dist.get("p95"),
            "p99_latency_ms": dist.get("p99"),
            "min_latency_ms": dist.get("min"),
            "max_latency_ms": dist.get("max"),
            "stddev_latency_ms": dist.get("stddev"),
            "probes_count": n,
        }

    @staticmethod
    def calculate_percentage_change(baseline_val: Optional[float], fault_val: Optional[float], higher_is_better: bool = False) -> Dict[str, Any]:
        """Calculates percentage change safely without dividing by zero."""
        if baseline_val is None or fault_val is None:
            return {"change_pct": None, "display": "N/A", "direction": "neutral"}

        if baseline_val == 0:
            if fault_val == 0:
                return {"change_pct": 0.0, "display": "0%", "direction": "neutral"}
            diff = fault_val - baseline_val
            sign = "+" if diff > 0 else ""
            return {"change_pct": None, "display": f"{sign}{diff:.1f} (baseline was 0)", "direction": "bad" if not higher_is_better else "good"}

        pct = round(((fault_val - baseline_val) / abs(baseline_val)) * 100, 1)
        sign = "+" if pct > 0 else ""
        display = f"{sign}{pct}%"

        if pct == 0:
            direction = "neutral"
        elif higher_is_better:
            direction = "good" if pct > 0 else "bad"
        else:
            direction = "bad" if pct > 0 else "good"

        return {"change_pct": pct, "display": display, "direction": direction}


class HypothesisEvaluator:
    """Evaluates whether the experiment hypothesis was VALIDATED, PARTIALLY VALIDATED, VIOLATED, or INCONCLUSIVE."""

    @staticmethod
    def evaluate(
        fault_type: str,
        baseline_metrics: Dict[str, Any],
        experiment_metrics: Dict[str, Any],
        recovery_metrics: Dict[str, Any],
        custom_hypothesis: Optional[str] = None,
        custom_expected: Optional[str] = None,
    ) -> Dict[str, Any]:
        defaults = DEFAULT_HYPOTHESES.get(fault_type, {
            "hypothesis": f"System will absorb {fault_type} and recover steady-state operation within the RTO target.",
            "expected_behavior": "Service maintains availability or recovers quickly without unhandled errors.",
        })

        hypothesis_text = custom_hypothesis or defaults["hypothesis"]
        expected_behavior = custom_expected or defaults["expected_behavior"]

        # Check evidence availability
        has_baseline = baseline_metrics.get("available", False)
        base_healthy = baseline_metrics.get("healthy", True)
        base_avail_pct = baseline_metrics.get("availability_percent", 100.0)
        probes_count = experiment_metrics.get("probes_count", 0)

        if not has_baseline or probes_count == 0:
            return {
                "hypothesis": hypothesis_text,
                "expected_behavior": expected_behavior,
                "observed_behavior": "Experiment executed without active synthetic HTTP probing. System recovery could only be verified at container cgroup/process level.",
                "verdict": "INCONCLUSIVE",
                "verdict_reason": "No synthetic HTTP probe was configured to observe real-time application behavior during fault injection.",
                "confidence": "Low",
                "criteria_evaluated": [
                    {
                        "criterion": "Synthetic Probing Configured",
                        "expected": "Active HTTP probe",
                        "actual": "None",
                        "passed": False,
                    }
                ],
            }

        # Check if baseline was actually healthy before fault was injected
        if base_avail_pct < 50.0 or not base_healthy:
            return {
                "hypothesis": hypothesis_text,
                "expected_behavior": expected_behavior,
                "observed_behavior": f"Pre-fault baseline check failed on '{baseline_metrics.get('probe_url')}'. The application was unreachable or returning errors prior to fault injection.",
                "verdict": "INCONCLUSIVE",
                "verdict_reason": f"Steady-state baseline could not be established before injection ({base_avail_pct}% availability). In-fault failures reflect a pre-existing application outage (e.g. database crash or server error), not chaos degradation.",
                "confidence": "High",
                "criteria_evaluated": [
                    {
                        "criterion": "Pre-Fault Steady State Baseline",
                        "expected": "HTTP 200 (Healthy)",
                        "actual": f"Unhealthy ({base_avail_pct}% success)",
                        "passed": False,
                    }
                ],
            }

        avail = experiment_metrics.get("availability_percent", 100.0)
        rto_met = recovery_metrics.get("rto_target_met", True)
        recovered = recovery_metrics.get("recovered", True)
        p95_change = experiment_metrics.get("p95_latency_ms", 0.0)
        base_p95 = baseline_metrics.get("p95_latency_ms") or baseline_metrics.get("avg_latency_ms", 1.0)
        lat_multiplier = round(p95_change / base_p95, 2) if base_p95 > 0 else 1.0

        if fault_type in ("container_restart", "container_stop"):
            if recovered and rto_met and (avail >= 50.0 or fault_type == "container_stop"):
                verdict = "VALIDATED" if rto_met and recovered else "PARTIALLY VALIDATED"
                observed = f"Container recovered within {recovery_metrics.get('recovery_time_seconds', 0)}s (target: {recovery_metrics.get('rto_target_seconds', 5.0)}s). Availability during the event was {avail}%."
            elif recovered and not rto_met:
                verdict = "PARTIALLY VALIDATED"
                observed = f"Container restored healthy state, but recovery took {recovery_metrics.get('recovery_time_seconds', 0)}s, exceeding the {recovery_metrics.get('rto_target_seconds', 5.0)}s RTO target."
            else:
                verdict = "VIOLATED"
                observed = f"Container failed to restore steady-state health after fault injection completed."
        elif fault_type in ("cpu_stress", "memory_stress"):
            if avail >= 95.0 and lat_multiplier <= 4.0:
                verdict = "VALIDATED"
                observed = f"Application maintained {avail}% availability under {fault_type}. P95 latency degraded by {lat_multiplier}x baseline."
            elif avail >= 70.0 or lat_multiplier <= 6.0:
                verdict = "PARTIALLY VALIDATED"
                observed = f"Application remained partially available ({avail}%), but latency degraded by {lat_multiplier}x baseline under resource saturation."
            else:
                verdict = "VIOLATED"
                observed = f"Resource saturation caused severe availability drop to {avail}% with severe latency degradation ({lat_multiplier}x)."
        elif fault_type in ("network_delay", "network_loss"):
            if avail >= 90.0:
                verdict = "VALIDATED"
                observed = f"Application absorbed network disturbance with {avail}% request availability."
            elif avail >= 60.0:
                verdict = "PARTIALLY VALIDATED"
                observed = f"Network disruption dropped availability to {avail}%, causing connection errors."
            else:
                verdict = "VIOLATED"
                observed = f"Network fault triggered critical availability failure ({avail}% availability) with widespread timeouts."
        else:
            verdict = "VALIDATED" if recovered else "VIOLATED"
            observed = f"Execution completed with {avail}% availability."

        return {
            "hypothesis": hypothesis_text,
            "expected_behavior": expected_behavior,
            "observed_behavior": observed,
            "verdict": verdict,
            "verdict_reason": f"Based on measured availability ({avail}%), recovery duration ({recovery_metrics.get('recovery_time_seconds', 0)}s), and latency response.",
            "confidence": "High" if probes_count >= 5 else "Medium",
        }


class FindingDetector:
    """Analyzes experiment results to derive factual, evidence-backed findings and anomalies."""

    @staticmethod
    def detect_findings(
        fault_type: str,
        target: str,
        baseline: Dict[str, Any],
        experiment: Dict[str, Any],
        recovery: Dict[str, Any],
        rollback_success: bool,
    ) -> List[Dict[str, Any]]:
        findings = []

        avail = experiment.get("availability_percent", 100.0)
        probes_count = experiment.get("probes_count", 0)
        failed_probes = experiment.get("failed_probes", 0)
        conn_errors = experiment.get("connection_errors_count", 0)
        http_5xx = experiment.get("http_5xx_count", 0)
        sample_errors = experiment.get("sample_errors", [])
        recovery_time = recovery.get("recovery_time_seconds", 0.0)
        rto_target = recovery.get("rto_target_seconds", 5.0)
        rto_met = recovery.get("rto_target_met", True)
        recovered = recovery.get("recovered", True)
        lat_mult = experiment.get("latency_multiplier", 1.0)
        p95 = experiment.get("p95_latency_ms", 0.0)

        # 0. Baseline Health Finding
        base_healthy = baseline.get("healthy", True)
        base_avail = baseline.get("available", False)
        base_succ = baseline.get("availability_percent", 100.0)
        if base_avail and (not base_healthy or base_succ < 50.0):
            findings.append({
                "id": "F-BASELINE-FAIL",
                "category": "Steady-State Baseline",
                "title": "Pre-Fault Baseline Invalidation (Endpoint Unreachable Before Fault)",
                "severity": "Critical",
                "observed": f"Target endpoint '{baseline.get('probe_url')}' failed steady-state verification before chaos injection began.",
                "evidence": f"Pre-fault baseline health check returned unexpected status or connection reset ({base_succ}% success).",
                "impact": "The test results reflect an existing application outage (e.g. database connection refused or server crash), rather than degradation caused by the chaos experiment.",
                "suggested_investigation": f"Inspect container '{target}' application logs ('docker logs {target}') and verify '{baseline.get('probe_url')}' responds with HTTP 200 before running chaos experiments.",
                "affected_components": [target],
            })

        # 1. Availability Findings
        if probes_count > 0:
            if avail < 50.0:
                findings.append({
                    "id": "F-AVAIL-CRIT",
                    "category": "Availability",
                    "title": "Severe Service Disruption During Fault",
                    "severity": "Critical",
                    "observed": f"Request availability collapsed to {avail}% during the chaos window.",
                    "evidence": f"{failed_probes} of {probes_count} probes failed. Observed errors: {', '.join(sample_errors[:2]) or 'Endpoint unreachable'}.",
                    "impact": "End users and dependent services experienced total or near-total outage during the fault duration.",
                    "suggested_investigation": f"Review container redundancy, health-check failover routing, and circuit breaker configurations for '{target}'.",
                })
            elif avail < 90.0:
                findings.append({
                    "id": "F-AVAIL-DEG",
                    "category": "Availability",
                    "title": "Degraded Service Availability Under Stress",
                    "severity": "High",
                    "observed": f"Availability dropped to {avail}% during fault execution.",
                    "evidence": f"{failed_probes} probes failed out of {probes_count} total attempts.",
                    "impact": "Intermittent request failures experienced by clients attempting to reach the service.",
                    "suggested_investigation": "Inspect request retry logic, timeout configurations, and worker process queue limits.",
                })
            elif avail == 100.0 and probes_count >= 3:
                findings.append({
                    "id": "F-AVAIL-PASS",
                    "category": "Availability",
                    "title": "Full Request Availability Maintained",
                    "severity": "Informational",
                    "observed": f"Service sustained 100.0% availability during the fault execution window.",
                    "evidence": f"All {probes_count} synthetic probes succeeded with expected HTTP status.",
                    "impact": "Zero client-visible error responses occurred during the experiment.",
                    "suggested_investigation": "Verify that load testing concurrent traffic yields identical resilience.",
                })

        # 2. Connection Failures
        if conn_errors > 0:
            findings.append({
                "id": "F-CONN-DROP",
                "category": "Networking & Transport",
                "title": "TCP Connection Drops / Resets Observed",
                "severity": "High" if conn_errors >= 3 else "Medium",
                "observed": f"{conn_errors} synthetic probes encountered socket-level connection errors (Connection Refused / Reset / Timeout).",
                "evidence": f"Connection error count: {conn_errors}. Error sample: '{sample_errors[0] if sample_errors else 'Socket connection failure'}'.",
                "impact": "Clients experienced abrupt connection terminations rather than clean HTTP error codes.",
                "suggested_investigation": f"Check reverse proxy keepalive timeouts, upstream connection pools, and graceful socket shutdown in '{target}'.",
            })

        # 3. HTTP 5xx Server Errors
        if http_5xx > 0:
            findings.append({
                "id": "F-HTTP-5XX",
                "category": "Reliability",
                "title": "Server-Side Error Responses (HTTP 5xx)",
                "severity": "High",
                "observed": f"Endpoint returned {http_5xx} internal server error responses during fault injection.",
                "evidence": f"HTTP 5xx responses detected in active probe stream during fault window.",
                "impact": "Uncaught application exceptions or upstream gateway timeouts visible to callers.",
                "suggested_investigation": "Inspect container application logs for unhandled exception stack traces or gateway 502/504 timeouts.",
            })

        # 4. Latency Degradation
        if lat_mult >= 3.0 and p95 > 50.0:
            findings.append({
                "id": "F-LAT-SPIKE",
                "category": "Performance & Capacity",
                "title": f"Substantial Latency Amplification ({lat_mult}x Baseline)",
                "severity": "High" if lat_mult >= 5.0 else "Medium",
                "observed": f"P95 latency surged to {p95}ms, a {lat_mult}x multiplier over baseline.",
                "evidence": f"Baseline latency: {baseline.get('avg_latency_ms', 0)}ms vs In-Fault P95: {p95}ms.",
                "impact": "Users experienced noticeable sluggishness; downstream callers could hit timeout thresholds.",
                "suggested_investigation": f"Evaluate concurrency thread pool size, database connection contention, and CPU throttling on '{target}'.",
            })
        elif lat_mult >= 1.15 and p95 > 0:
            pct_delta = round((lat_mult - 1.0) * 100, 1)
            findings.append({
                "id": "F-LAT-MINOR",
                "category": "Performance & Capacity",
                "title": f"Subtle Latency Elevation Under Fault (+{pct_delta}% vs Baseline)",
                "severity": "Low",
                "observed": f"Mean latency increased {pct_delta}% above baseline during fault window.",
                "evidence": f"Baseline mean: {baseline.get('avg_latency_ms', 0)}ms vs In-Fault mean: {experiment.get('avg_latency_ms', 0)}ms.",
                "impact": "Marginal but measurable performance degradation visible to sensitive clients.",
                "suggested_investigation": "Monitor at higher concurrency; the degradation may amplify under load.",
            })

        # 4b. Tail latency divergence (P95 >> P50 — head-of-line blocking)
        p50 = experiment.get("p50_latency_ms", 0.0)
        if p50 and p95 and p50 > 0 and p95 >= p50 * 3.5 and p95 > 100:
            ratio = round(p95 / p50, 1)
            findings.append({
                "id": "F-TAIL-DIVERGE",
                "category": "Performance & Capacity",
                "title": f"Tail Latency Divergence (P95 is {ratio}x P50 — Head-of-Line Blocking)",
                "severity": "Medium",
                "observed": f"P95 ({p95}ms) diverged {ratio}x from P50 ({p50}ms) during the fault window.",
                "evidence": f"This bimodal distribution indicates that a minority of requests experienced severe queuing or blocking.",
                "impact": "Tail latency directly impacts SLA compliance for SLO-sensitive endpoints.",
                "suggested_investigation": "Investigate head-of-line blocking, garbage collection pauses, or synchronous locks under concurrent load.",
            })

        # 4c. Transient latency spikes from anomaly data
        anoms = experiment.get("anomaly_summary") or {}
        spike_count = anoms.get("spike_count", 0)
        if spike_count > 0:
            peak = anoms.get("peak_impact") or {}
            peak_ms = peak.get("peak_latency_ms", 0.0)
            peak_pct = peak.get("percentage_delta", 0.0)
            findings.append({
                "id": "F-SPIKE-TRANSIENT",
                "category": "Performance & Capacity",
                "title": f"{spike_count} Transient Latency Spike(s) Detected During Fault Window",
                "severity": "Medium" if spike_count <= 2 else "High",
                "observed": f"{spike_count} individual probe(s) exceeded spike threshold (baseline mean + 3σ).",
                "evidence": f"Peak spike: {peak_ms}ms (+{peak_pct}% over baseline mean). Transient spikes indicate intermittent starvation or lock contention.",
                "impact": "Spike events cause individual request tail degradation even if mean latency appears stable.",
                "suggested_investigation": "Enable application profiling and CPU flame graphs during fault injection to identify synchronization hotspots.",
            })

        # 4d. Consecutive failure bursts
        failure_bursts = anoms.get("failure_bursts", [])
        max_burst = anoms.get("max_consecutive_failures", 0)
        if max_burst >= 3 or failure_bursts:
            total_burst_duration = sum(b.get("duration_sec", 0) for b in failure_bursts)
            findings.append({
                "id": "F-BURST-FAIL",
                "category": "Availability",
                "title": f"Consecutive Failure Burst(s) Detected (max streak: {max_burst})",
                "severity": "High" if max_burst >= 5 else "Medium",
                "observed": f"{len(failure_bursts)} failure burst(s) detected (max consecutive failures: {max_burst}, total duration: {round(total_burst_duration, 1)}s).",
                "evidence": f"Consecutive failure bursts indicate the service was completely unreachable for extended windows, not just degraded.",
                "impact": "Clients experienced outage windows — requests failed completely rather than slowly.",
                "suggested_investigation": "Implement retry-with-backoff at the client and ensure health-check routing prevents sending requests to an unhealthy backend.",
            })

        # 5. Recovery & RTO Findings
        if not recovered:
            findings.append({
                "id": "F-REC-FAIL",
                "category": "Startup & Recovery",
                "title": "Failure to Restore Steady State After Fault Completion",
                "severity": "Critical",
                "observed": f"Service did not recover steady-state health after fault rollback.",
                "evidence": f"Post-fault health polling timed out after {recovery_time}s without receiving a successful HTTP response.",
                "impact": "Manual intervention was required to restore service operation following the experiment.",
                "suggested_investigation": "Verify whether container crashed, process deadlocked, or network rules failed to delete.",
            })
        elif not rto_met:
            findings.append({
                "id": "F-REC-SLOW",
                "category": "Startup & Recovery",
                "title": "Recovery Time Exceeded Configured RTO Target",
                "severity": "Medium",
                "observed": f"Service recovered in {recovery_time}s, exceeding the target RTO of {rto_target}s.",
                "evidence": f"Measured recovery time: {recovery_time}s > RTO target: {rto_target}s.",
                "impact": "Failover or restart time was slower than organizational SLA thresholds.",
                "suggested_investigation": f"Profile container startup duration, framework initialization overhead, and database migration checks on startup.",
            })
        elif recovery_time > 0 and rto_met:
            findings.append({
                "id": "F-REC-MET",
                "category": "Startup & Recovery",
                "title": "Recovery Completed Within RTO Target",
                "severity": "Informational",
                "observed": f"Steady-state availability restored in {recovery_time}s (target: {rto_target}s).",
                "evidence": f"First post-rollback HTTP probe succeeded at T+{recovery_time}s.",
                "impact": "Service recovery satisfied defined resilience SLA requirements.",
                "suggested_investigation": "No immediate remediation needed for recovery duration.",
            })

        # 6. Rollback Safety
        if not rollback_success:
            findings.append({
                "id": "F-ROLLBACK-FAIL",
                "category": "Fault Isolation & Safety",
                "title": "Fault Rollback Incomplete / Dirty State",
                "severity": "Critical",
                "observed": "The chaos rollback procedure failed to cleanly revert injected controls.",
                "evidence": "Executor reported rollback_success=False or cgroup/qdisc removal failure.",
                "impact": "Residual network traffic shaping or CPU limits may linger on the host.",
                "suggested_investigation": "Inspect Linux kernel qdisc table and docker cgroup state manually.",
            })

        return findings

    @staticmethod
    def detect_anomalies(
        baseline: Dict[str, Any],
        experiment: Dict[str, Any],
        recovery: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        anomalies = []

        p50 = experiment.get("p50_latency_ms", 0.0)
        p95 = experiment.get("p95_latency_ms", 0.0)
        base_avg = baseline.get("avg_latency_ms", 0.0)
        http_5xx = experiment.get("http_5xx_count", 0)
        avail = experiment.get("availability_percent", 100.0)

        # Anomaly 1: Severe latency divergence (P95 >> P50)
        if p50 > 0 and p95 >= (p50 * 3.5) and p95 > 100:
            anomalies.append({
                "title": "Bimodal Latency Divergence (Head-of-Line Blocking)",
                "description": f"P95 latency ({p95}ms) diverged dramatically from P50 ({p50}ms), indicating tail latency amplification.",
                "evidence": f"P50: {p50}ms, P95: {p95}ms (ratio: {round(p95 / p50, 1)}x).",
            })

        # Anomaly 2: 5xx errors appeared strictly during chaos
        if http_5xx > 0 and baseline.get("http_5xx_count", 0) == 0:
            anomalies.append({
                "title": "Sudden HTTP 5xx Emergence Under Fault",
                "description": "Server returned 5xx errors strictly while fault was active; zero 5xx errors were present during baseline.",
                "evidence": f"Baseline 5xx: 0, In-fault 5xx: {http_5xx}.",
            })

        # Anomaly 3: Post-recovery latency lingering
        post_lat = recovery.get("post_recovery_latency_ms")
        if post_lat and base_avg > 0 and post_lat > (base_avg * 2.0):
            anomalies.append({
                "title": "Lingering Post-Recovery Latency (Warm-Up Lag)",
                "description": f"Service recovered availability, but initial post-recovery latency ({post_lat}ms) remained over 2x above baseline ({base_avg}ms).",
                "evidence": f"Baseline avg: {base_avg}ms, Post-recovery probe: {post_lat}ms.",
            })

        return anomalies


class RootCauseIndicator:
    """Infers evidence-backed technical root-cause indicators without conflating correlation with causation."""

    @staticmethod
    def infer_root_causes(
        fault_type: str,
        target: str,
        findings: List[Dict[str, Any]],
        experiment: Dict[str, Any],
        recovery: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        indicators = []
        finding_ids = {f["id"] for f in findings}

        if "F-BASELINE-FAIL" in finding_ids:
            indicators.append({
                "issue": f"Pre-Existing Application Crash or Dependency Outage in '{target}'",
                "confidence": "High",
                "evidence": f"Endpoint was unreachable or returning unexpected status before {fault_type} was injected.",
                "reasoning": "When an application fails to initialize, crashes on boot, or cannot connect to backing databases/services, HTTP probes immediately fail with connection resets regardless of chaos injection.",
            })

        if "F-CONN-DROP" in finding_ids and fault_type in ("container_restart", "container_stop"):
            indicators.append({
                "issue": "Absence of Pre-Routing Readiness Checks and Drain Period",
                "confidence": "High",
                "evidence": f"Connection refused errors occurred immediately upon {fault_type}. Docker health state or traffic router did not reroute prior to process death.",
                "reasoning": "When a container stops abruptly without connection draining or active health-check rerouting, in-flight requests encounter immediate TCP resets.",
            })

        if "F-LAT-SPIKE" in finding_ids and fault_type == "cpu_stress":
            indicators.append({
                "issue": "Thread / Worker Starvation Under CPU Saturation",
                "confidence": "High",
                "evidence": f"P95 latency amplified by {experiment.get('latency_multiplier', 1)}x while workers saturated CPU cores.",
                "reasoning": "Synchronous request handler threads competed for CPU time slices with chaos worker processes, delaying socket read/write completion.",
            })

        if "F-HTTP-5XX" in finding_ids:
            indicators.append({
                "issue": "Uncaught Upstream Timeout or Unhandled Connection Exception",
                "confidence": "Medium",
                "evidence": f"{experiment.get('http_5xx_count', 0)} HTTP 5xx responses were captured during the fault window.",
                "reasoning": "HTTP 5xx indicates the gateway or application caught an unhandled exception (e.g. database timeout or dead socket) and returned an error code rather than an intentional fallback response.",
            })

        if "F-REC-SLOW" in finding_ids:
            indicators.append({
                "issue": "Heavy Framework Initialization or Cold-Start Overhead",
                "confidence": "Medium",
                "evidence": f"Recovery time ({recovery.get('recovery_time_seconds', 0)}s) exceeded configured RTO target ({recovery.get('rto_target_seconds', 5.0)}s).",
                "reasoning": "Application process restart involves cold startup tasks (e.g., dependency injection, database connection pool creation, cache warming) before accepting HTTP traffic.",
            })

        if not indicators and any(f["severity"] in ("High", "Critical") for f in findings):
            indicators.append({
                "issue": f"Single Point of Failure in Service '{target}'",
                "confidence": "Medium",
                "evidence": "Target container failure directly impacted client request availability.",
                "reasoning": "No redundant replica was observed taking over traffic when the target was degraded.",
            })

        return indicators


class RecommendationEngine:
    """
    Generates actionable engineering recommendations and pairs each recommendation
    with a concrete follow-up validation experiment:
      Finding -> Recommendation -> Reason -> Priority -> Next Experiment
    """

    @staticmethod
    def generate_recommendations(
        fault_type: str,
        target: str,
        findings: List[Dict[str, Any]],
        root_causes: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        recommendations = []
        finding_ids = {f["id"] for f in findings}

        # 0. Fix Pre-Existing Application Health
        if "F-BASELINE-FAIL" in finding_ids:
            recommendations.append({
                "title": f"Restore Baseline Application Health for '{target}'",
                "category": "Application Health",
                "priority": "High",
                "reason": f"Service '{target}' failed health checks before chaos injection began. All subsequent degradation was caused by pre-existing server or dependency failures.",
                "action": f"Check container logs ('docker logs {target}') to fix application crashes (e.g. database connection refused or unhandled exceptions), and ensure the endpoint responds with HTTP 200 prior to chaos testing.",
                "next_experiment": {
                    "fault_type": fault_type,
                    "target": target,
                    "goal": f"Establish verified healthy baseline on '{target}' and re-verify steady-state resilience under {fault_type}.",
                    "command": f"noir fault inject {fault_type} {target}",
                },
            })

        # 1. Redundancy & Load Balancing
        if any(f_id in finding_ids for f_id in ("F-AVAIL-CRIT", "F-CONN-DROP")):
            recommendations.append({
                "title": f"Deploy Redundant Replicas for '{target}' with Active Health Checks",
                "category": "High Availability",
                "priority": "High",
                "reason": f"Service '{target}' demonstrated total or partial availability loss when disrupted, indicating a single point of failure.",
                "action": "Configure at least 2 container replicas behind a reverse proxy (e.g., NGINX / Traefik / Envoy) with active layer-7 health checks.",
                "next_experiment": {
                    "fault_type": "container_stop",
                    "target": target,
                    "goal": f"Stop one replica of '{target}' while testing whether the reverse proxy seamlessly routes 100% of traffic to the survivor replica.",
                    "command": f"noir fault inject container_stop {target} --duration 15",
                },
            })

        # 2. Connection Draining & Graceful Shutdown
        if "F-CONN-DROP" in finding_ids:
            recommendations.append({
                "title": "Implement SIGTERM Graceful Shutdown & Connection Draining",
                "category": "Reliability & Shutdown",
                "priority": "High",
                "reason": "Immediate TCP connection resets were observed during container disruption, causing abrupt client failures.",
                "action": "Ensure the application handles SIGTERM by finishing in-flight requests and pausing new connections before exiting. Set 'stop_grace_period: 15s' in docker-compose.",
                "next_experiment": {
                    "fault_type": "container_restart",
                    "target": target,
                    "goal": f"Execute a container restart with graceful timeout and verify that in-flight requests complete cleanly without connection drops.",
                    "command": f"noir fault inject container_restart {target} --timeout 15",
                },
            })

        # 3. Latency & Timeouts / Circuit Breakers
        if any(f_id in finding_ids for f_id in ("F-LAT-SPIKE", "F-HTTP-5XX")):
            recommendations.append({
                "title": "Configure Strict Client Timeouts and Circuit Breakers",
                "category": "Traffic Control",
                "priority": "Medium",
                "reason": f"Latency amplified up to tail limits and triggered server errors under stress.",
                "action": "Introduce client-side timeout thresholds (e.g., 2000ms) and circuit breaker fallbacks (e.g. return cached data or degradation response) when response times exceed normal bounds.",
                "next_experiment": {
                    "fault_type": "network_delay",
                    "target": target,
                    "goal": f"Inject 800ms latency and verify that upstream clients trigger circuit breaker fallbacks rather than hanging indefinitely.",
                    "command": f"noir fault inject network_delay {target} --latency-ms 800 --duration 20",
                },
            })

        # 4. Resource Quotas (CPU / Memory)
        if fault_type in ("cpu_stress", "memory_stress") or "F-LAT-SPIKE" in finding_ids:
            recommendations.append({
                "title": f"Enforce Docker Resource Quotas (Cgroups Limits) on '{target}'",
                "category": "Capacity Management",
                "priority": "Medium",
                "reason": "Unbounded resource pressure can starve co-located services on the same host node.",
                "action": "Define explicit CPU ('cpus: 1.5') and Memory ('mem_limit: 512m') reservations and limits in Docker Compose / Kubernetes specs.",
                "next_experiment": {
                    "fault_type": "cpu_stress",
                    "target": target,
                    "goal": f"Re-run CPU stress with cgroup limits enforced to confirm that host node stability is preserved.",
                    "command": f"noir fault inject cpu_stress {target} --workers 4 --duration 15",
                },
            })

        # Default fallback recommendation if all was clean
        if not recommendations:
            recommendations.append({
                "title": f"Validate Multi-Fault Concurrent Stress on '{target}'",
                "category": "Resilience Verification",
                "priority": "Low",
                "reason": f"Service '{target}' passed baseline chaos testing cleanly. Step up testing to compounded failure modes.",
                "action": "Evaluate combined network jitter and CPU pressure concurrently to test complex degradation boundaries.",
                "next_experiment": {
                    "fault_type": "network_delay",
                    "target": target,
                    "goal": "Inject higher latency combined with packet loss to test deep resilience boundaries.",
                    "command": f"noir fault inject network_delay {target} --latency-ms 500 --jitter-ms 100 --duration 20",
                },
            })

        return recommendations


class CollectiveReportAggregator:
    """
    Synthesizes findings, outliers, patterns, and consolidated recommendations
    across multiple chaos engineering experiments.
    """

    @staticmethod
    def aggregate(project_data: Dict[str, Any], experiments: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(experiments)
        if total == 0:
            return {
                "project": project_data,
                "summary": {
                    "total_experiments": 0,
                    "completed": 0,
                    "failed": 0,
                    "cancelled": 0,
                    "hypotheses_validated": 0,
                    "hypotheses_partially_validated": 0,
                    "hypotheses_violated": 0,
                    "hypotheses_inconclusive": 0,
                    "avg_recovery_seconds": 0.0,
                    "longest_recovery_seconds": 0.0,
                    "rto_violations_count": 0,
                    "overall_resilience_score": 0,
                    "overall_resilience_grade": "N/A",
                },
                "overview_matrix": [],
                "outliers": [],
                "cross_experiment_patterns": [],
                "consolidated_recommendations": [],
                "follow_up_roadmap": [],
            }

        completed = sum(1 for e in experiments if e.get("status") == "completed")
        failed = sum(1 for e in experiments if e.get("status") == "failed")
        cancelled = sum(1 for e in experiments if e.get("status") == "cancelled")

        # Hypotheses
        val_count = 0
        part_count = 0
        viol_count = 0
        inconc_count = 0

        recovery_times: List[float] = []
        rto_violations = 0
        scores: List[float] = []

        overview_matrix = []
        outliers = []
        pattern_bucket: Dict[str, List[int]] = {
            "restart_conn_drops": [],
            "latency_surge": [],
            "rto_exceeded": [],
            "http_5xx": [],
            "recovery_failure": [],
        }

        raw_recs_pool: List[Dict[str, Any]] = []

        for exp in experiments:
            exp_id = exp.get("id")
            f_type = exp.get("fault_type", "unknown")
            target = exp.get("target", "unknown")
            status_str = exp.get("status", "unknown")
            res = exp.get("result") or {}

            # Hypothesis check
            hypo = res.get("hypothesis_evaluation") or (exp.get("structured_report") or {}).get("hypothesis")
            if not hypo or not hypo.get("verdict"):
                base = res.get("steady_state_baseline") or {}
                exp_m = res.get("experiment_metrics") or {}
                rec_m = res.get("recovery_metrics") or {}
                hypo = HypothesisEvaluator.evaluate(
                    fault_type=f_type,
                    baseline_metrics=base,
                    experiment_metrics=exp_m,
                    recovery_metrics=rec_m,
                    custom_hypothesis=(exp.get("parameters") or {}).get("hypothesis"),
                    custom_expected=(exp.get("parameters") or {}).get("expected_behavior"),
                )
            verdict = hypo.get("verdict")
            if verdict == "VALIDATED":
                val_count += 1
            elif verdict == "PARTIALLY VALIDATED":
                part_count += 1
            elif verdict == "VIOLATED":
                viol_count += 1
            else:
                inconc_count += 1

            # Recovery metrics
            rec_m = res.get("recovery_metrics") or {}
            rec_sec = rec_m.get("recovery_time_seconds") or rec_m.get("rto_seconds")
            if rec_sec is not None:
                recovery_times.append(float(rec_sec))

            rto_target = rec_m.get("rto_target_seconds", 5.0)
            if rec_sec and float(rec_sec) > float(rto_target):
                rto_violations += 1
                pattern_bucket["rto_exceeded"].append(exp_id)

            # Score
            sc = exp.get("resilience_score") or res.get("resilience_score")
            if sc is not None:
                scores.append(float(sc))

            # Metrics
            exp_m = res.get("experiment_metrics") or {}
            avail = exp_m.get("availability_percent", 100.0)
            p95 = exp_m.get("p95_latency_ms", 0.0)
            conn_errs = exp_m.get("connection_errors_count", 0)
            http_5xx = exp_m.get("http_5xx_count", 0)

            # Key Finding summary
            findings = res.get("findings") or (exp.get("structured_report") or {}).get("findings") or []
            root_causes = res.get("root_causes") or (exp.get("structured_report") or {}).get("root_causes") or []
            recs_list = res.get("structured_recommendations") or (exp.get("structured_report") or {}).get("recommendations") or []
            key_finding = findings[0].get("title") if findings else (res.get("message") or status_str.capitalize())

            overview_matrix.append({
                "id": exp_id,
                "fault_type": f_type,
                "target": target,
                "status": status_str,
                "outcome": verdict or ("Pass" if status_str == "completed" else "Fail"),
                "recovery_time": f"{rec_sec:.1f}s" if rec_sec is not None else "N/A",
                "rto_target": f"{rto_target:.1f}s",
                "key_finding": key_finding,
                "resilience_grade": exp.get("resilience_grade") or res.get("resilience_grade") or "-",
            })

            # Check for statistical outliers
            standout_reasons = []
            base_unhealthy = (res.get("steady_state_baseline") or {}).get("healthy") is False or (res.get("steady_state_baseline") or {}).get("success_rate_percent", 100) < 50
            if base_unhealthy:
                standout_reasons.append("Target endpoint was unreachable before injection (Pre-fault baseline failure)")
            elif avail < 80.0:
                standout_reasons.append(f"Availability dropped to {avail}%")

            if p95 > 500.0 or exp_m.get("latency_multiplier", 1.0) >= 4.0:
                standout_reasons.append(f"P95 latency surged to {p95}ms ({exp_m.get('latency_multiplier', 1.0)}x)")
                pattern_bucket["latency_surge"].append(exp_id)
            if rec_sec and float(rec_sec) > 8.0:
                standout_reasons.append(f"Lengthy recovery time of {rec_sec:.1f}s")
            if http_5xx > 0:
                standout_reasons.append(f"{http_5xx} HTTP 5xx errors encountered")
                pattern_bucket["http_5xx"].append(exp_id)
            if conn_errs > 0:
                pattern_bucket["restart_conn_drops"].append(exp_id)
            if verdict == "VIOLATED":
                standout_reasons.append("Hypothesis violated")
            if rec_m.get("recovered") is False:
                standout_reasons.append("Failed to restore steady state")
                pattern_bucket["recovery_failure"].append(exp_id)

            if standout_reasons:
                outliers.append({
                    "id": exp_id,
                    "fault_type": f_type,
                    "target": target,
                    "standout_reason": " & ".join(standout_reasons),
                    "availability": f"{avail}%",
                    "p95_latency": f"{p95}ms",
                    "recovery_time": f"{rec_sec:.1f}s" if rec_sec is not None else "N/A",
                    "likely_issue": (root_causes or [{}])[0].get("issue") if root_causes else ("Pre-Existing Application Failure (Target down before chaos injection)" if base_unhealthy else "Underlying resilience bottleneck"),
                    "recommended_action": (recs_list or [{}])[0].get("action") if recs_list else ("Check container logs to resolve application crashes before chaos testing" if base_unhealthy else "Investigate service failover"),
                })

            # Collect recommendations
            for r in recs_list:
                raw_recs_pool.append(r)

        # Cross-Experiment Patterns
        cross_patterns = []
        if len(pattern_bucket["restart_conn_drops"]) >= 2:
            cross_patterns.append({
                "pattern": "Container disruption consistently triggers socket connection resets.",
                "evidence": f"Observed in {len(pattern_bucket['restart_conn_drops'])} experiments ({', '.join(f'#{i}' for i in pattern_bucket['restart_conn_drops'][:4])}).",
                "impact": "Clients experience immediate dropped connections during lifecycle events rather than graceful retry/reroute.",
                "root_cause_direction": "Reverse proxy or upstream caller does not perform health-check based connection draining prior to process termination.",
            })

        if len(pattern_bucket["latency_surge"]) >= 2:
            cross_patterns.append({
                "pattern": "High tail latency amplification under resource and network stress.",
                "evidence": f"Observed across {len(pattern_bucket['latency_surge'])} experiments with P95 latency surge > 4x baseline.",
                "impact": "End-user requests experience severe tail lag during bounded disturbances.",
                "root_cause_direction": "Absence of client-side timeouts or concurrency pool limits inside the application.",
            })

        if len(pattern_bucket["rto_exceeded"]) >= 2:
            cross_patterns.append({
                "pattern": "Recovery Time Objective (RTO) repeatedly violated.",
                "evidence": f"{len(pattern_bucket['rto_exceeded'])} experiments exceeded the configured RTO recovery deadline.",
                "impact": "Service restoration after failure is slower than defined organizational SLA targets.",
                "root_cause_direction": "Cold startup overhead and synchronous initialization tasks on application boot.",
            })

        # Consolidate and deduplicate recommendations
        dedup_recs: Dict[str, Dict[str, Any]] = {}
        for rec in raw_recs_pool:
            title = rec.get("title")
            if not title:
                continue
            if title not in dedup_recs:
                dedup_recs[title] = {
                    "title": title,
                    "category": rec.get("category", "General"),
                    "priority": rec.get("priority", "Medium"),
                    "action": rec.get("action", ""),
                    "reason": rec.get("reason", ""),
                    "occurrences": 1,
                    "next_experiment": rec.get("next_experiment"),
                }
            else:
                dedup_recs[title]["occurrences"] += 1

        consolidated_recommendations = sorted(
            dedup_recs.values(),
            key=lambda x: (0 if x["priority"] == "High" else (1 if x["priority"] == "Medium" else 2), -x["occurrences"])
        )

        # Build Follow-Up Roadmap
        roadmap = []
        for cr in consolidated_recommendations:
            if cr.get("next_experiment"):
                roadmap.append(cr["next_experiment"])

        # Aggregate metrics
        avg_rec = round(sum(recovery_times) / len(recovery_times), 2) if recovery_times else 0.0
        max_rec = round(max(recovery_times), 2) if recovery_times else 0.0
        overall_score = round(sum(scores) / len(scores)) if scores else 0
        overall_grade = "A" if overall_score >= 90 else ("B" if overall_score >= 75 else ("C" if overall_score >= 60 else "F"))

        return {
            "project": project_data,
            "summary": {
                "total_experiments": total,
                "completed": completed,
                "failed": failed,
                "cancelled": cancelled,
                "hypotheses_validated": val_count,
                "hypotheses_partially_validated": part_count,
                "hypotheses_violated": viol_count,
                "hypotheses_inconclusive": inconc_count,
                "avg_recovery_seconds": avg_rec,
                "longest_recovery_seconds": max_rec,
                "rto_violations_count": rto_violations,
                "overall_resilience_score": overall_score,
                "overall_resilience_grade": overall_grade,
            },
            "overview_matrix": overview_matrix,
            "outliers": outliers,
            "cross_experiment_patterns": cross_patterns,
            "consolidated_recommendations": consolidated_recommendations,
            "follow_up_roadmap": roadmap,
        }


def generate_experiment_report(fault: Any) -> Dict[str, Any]:
    """
    Main entry point for generating the complete structured individual experiment report.
    Compatible with both newly run experiments and historical records.
    """
    res = getattr(fault, "result", {}) or {}
    params = getattr(fault, "parameters", {}) or {}
    fault_type = getattr(fault, "fault_type", "unknown")
    target = getattr(fault, "target", "unknown")
    status_str = getattr(fault, "status", "unknown")
    req_at = getattr(fault, "requested_at", None)
    started_at = getattr(fault, "started_at", None)
    completed_at = getattr(fault, "completed_at", None)

    # Calculate hold duration
    duration = getattr(fault, "duration_seconds", None)
    if duration is None and started_at and completed_at:
        duration = round((completed_at - started_at).total_seconds(), 2)
    if duration is None:
        duration = params.get("duration", 0.0)

    # 1. Baseline — prefer raw_observations for recomputation
    base = res.get("steady_state_baseline") or (res.get("resilience") or {}).get("steady_state_baseline") or {}
    base_succ = base.get("success_rate_percent") or base.get("availability_percent")
    if base_succ is None and base.get("available"):
        base_succ = 100.0 if (base.get("avg_latency_ms") or base.get("sample_count")) else 0.0
    elif base_succ is None:
        base_succ = 0.0

    # Attempt recomputation from raw observations if present
    raw_obs_all = res.get("raw_observations") or {}
    raw_baseline_obs = raw_obs_all.get("baseline") or []
    if raw_baseline_obs:
        _recomp = MetricsAggregator.from_raw_observations(raw_baseline_obs)
        base_succ = _recomp.get("availability_percent", base_succ)
        base["avg_latency_ms"] = _recomp.get("avg_latency_ms") or base.get("avg_latency_ms")
        base["p50_latency_ms"] = _recomp.get("p50_latency_ms")
        base["p75_latency_ms"] = _recomp.get("p75_latency_ms")
        base["p90_latency_ms"] = _recomp.get("p90_latency_ms")
        base["p95_latency_ms"] = _recomp.get("p95_latency_ms")
        base["p99_latency_ms"] = _recomp.get("p99_latency_ms")
        base["min_latency_ms"] = _recomp.get("min_latency_ms")
        base["max_latency_ms"] = _recomp.get("max_latency_ms")
        base["stddev_latency_ms"] = _recomp.get("stddev_latency_ms")

    baseline_metrics = {
        "available": base.get("available", False) or bool(base.get("avg_latency_ms")),
        "healthy": base.get("healthy", base_succ >= 66.0 if base.get("available") else False),
        "probe_url": base.get("probe_url") or params.get("probe_url") or "N/A",
        "http_method": "GET",
        "expected_status": base.get("expected_status", 200),
        "actual_status": base.get("status_code", 200) if (base.get("available") and base_succ > 0) else None,
        "probes_count": base.get("probes_count") or base.get("sample_count", 0),
        "availability_percent": base_succ,
        "mean_latency_ms": base.get("avg_latency_ms") or base.get("mean_latency_ms"),
        "p50_latency_ms": base.get("p50_latency_ms") or base.get("avg_latency_ms"),
        "p75_latency_ms": base.get("p75_latency_ms"),
        "p90_latency_ms": base.get("p90_latency_ms"),
        "p95_latency_ms": base.get("p95_latency_ms") or base.get("avg_latency_ms"),
        "p99_latency_ms": base.get("p99_latency_ms"),
        "min_latency_ms": base.get("min_latency_ms"),
        "max_latency_ms": base.get("max_latency_ms"),
        "stddev_latency_ms": base.get("stddev_latency_ms"),
        "baseline_cpu_percent": base.get("baseline_cpu_percent"),
        "baseline_memory_percent": base.get("baseline_memory_percent"),
        "connection_errors_count": base.get("connection_errors_count", 0),
        "http_5xx_count": base.get("http_5xx_count", 0),
        "distribution": base.get("distribution"),
        "raw_sample_count": len(raw_baseline_obs),
    }
    # Keep backward-compat alias
    baseline_metrics["avg_latency_ms"] = baseline_metrics["mean_latency_ms"]

    # 2. In-Fault Experiment Metrics
    exp_m = res.get("experiment_metrics") or (res.get("resilience") or {}).get("experiment_metrics") or {}

    # Recompute from raw fault observations if present
    raw_fault_obs = raw_obs_all.get("fault") or []
    if raw_fault_obs:
        _recomp_f = MetricsAggregator.from_raw_observations(raw_fault_obs)
        # Prefer recomputed values but keep anomaly_summary from original
        for _k in ("availability_percent", "avg_latency_ms", "p50_latency_ms", "p75_latency_ms",
                   "p90_latency_ms", "p95_latency_ms", "p99_latency_ms",
                   "min_latency_ms", "max_latency_ms", "stddev_latency_ms",
                   "successful_probes", "failed_probes", "timeout_count",
                   "connection_error_count", "http_error_count"):
            if _recomp_f.get(_k) is not None:
                exp_m[_k] = _recomp_f[_k]

    probes_cnt = exp_m.get("probes_count", 0) or len(raw_fault_obs)
    avail_pct = exp_m.get("availability_percent")
    if avail_pct is None:
        avail_pct = exp_m.get("availability_pct", 100.0 if status_str == "completed" else 0.0)

    avg_lat = exp_m.get("avg_latency_ms") or exp_m.get("mean_latency_ms", 0.0)
    p95_lat = exp_m.get("p95_latency_ms") or avg_lat
    p50_lat = exp_m.get("p50_latency_ms") or avg_lat
    p99_lat = exp_m.get("p99_latency_ms")

    # Anomaly summary from agent
    anomaly_summary = res.get("anomaly_summary") or exp_m.get("anomaly_summary") or {}

    experiment_metrics = {
        "probes_count": probes_cnt,
        "raw_sample_count": len(raw_fault_obs),
        "successful_probes": exp_m.get("successful_probes") or exp_m.get("success_count", probes_cnt if avail_pct == 100 else 0),
        "failed_probes": exp_m.get("failed_probes") or exp_m.get("error_count", 0),
        "availability_percent": avail_pct,
        "error_rate_percent": round(100 - (avail_pct or 100), 2),
        "p50_latency_ms": p50_lat,
        "p75_latency_ms": exp_m.get("p75_latency_ms"),
        "p90_latency_ms": exp_m.get("p90_latency_ms"),
        "p95_latency_ms": p95_lat,
        "p99_latency_ms": p99_lat,
        "mean_latency_ms": avg_lat,
        "min_latency_ms": exp_m.get("min_latency_ms"),
        "max_latency_ms": exp_m.get("max_latency_ms"),
        "stddev_latency_ms": exp_m.get("stddev_latency_ms"),
        "latency_multiplier": exp_m.get("latency_multiplier") or exp_m.get("latency_degradation_factor", 1.0),
        "connection_errors_count": exp_m.get("connection_errors_count", 0),
        "http_5xx_count": exp_m.get("http_5xx_count", 0),
        "sample_errors": exp_m.get("sample_errors", []),
        "anomaly_summary": anomaly_summary,
        "rolling_metrics": exp_m.get("rolling_metrics", []),
        "baseline_comparison": exp_m.get("baseline_comparison"),
        # backward-compat alias
        "avg_latency_ms": avg_lat,
    }

    # 3. Recovery Metrics
    rec_m = res.get("recovery_metrics") or (res.get("resilience") or {}).get("recovery_metrics") or {}
    rto_target_sec = float(params.get("rto_target_seconds", 5.0))
    rec_sec = rec_m.get("recovery_time_seconds")
    if rec_sec is None:
        rec_sec = rec_m.get("rto_seconds", 0.0)

    recovery_metrics = {
        "recovery_time_seconds": float(rec_sec),
        "rto_target_seconds": rto_target_sec,
        "rto_target_met": float(rec_sec) <= rto_target_sec if rec_m.get("recovered") else False,
        "recovered": rec_m.get("recovered", res.get("recovered", True)),
        "timed_out": rec_m.get("timed_out", False),
        "post_recovery_latency_ms": rec_m.get("post_recovery_latency_ms"),
        "metrics_returned_to_baseline": rec_m.get("recovered", True) and (not rec_m.get("timed_out", False)),
    }

    # 4. Comparative Delta Table
    comparison = {
        "availability": {
            "baseline": f"{baseline_metrics['availability_percent']}%" if baseline_metrics["available"] else "N/A",
            "during_fault": f"{experiment_metrics['availability_percent']}%" if probes_cnt > 0 else "N/A",
            **MetricsAggregator.calculate_percentage_change(
                baseline_metrics["availability_percent"] if baseline_metrics["available"] else None,
                experiment_metrics["availability_percent"] if probes_cnt > 0 else None,
                higher_is_better=True
            ),
        },
        "p50_latency": {
            "baseline": f"{baseline_metrics['p50_latency_ms']} ms" if baseline_metrics.get("p50_latency_ms") is not None else "N/A",
            "during_fault": f"{experiment_metrics['p50_latency_ms']} ms" if probes_cnt > 0 else "N/A",
            **MetricsAggregator.calculate_percentage_change(
                baseline_metrics.get("p50_latency_ms"),
                experiment_metrics.get("p50_latency_ms") if probes_cnt > 0 else None,
                higher_is_better=False
            ),
        },
        "p95_latency": {
            "baseline": f"{baseline_metrics['p95_latency_ms']} ms" if baseline_metrics.get("p95_latency_ms") is not None else "N/A",
            "during_fault": f"{experiment_metrics['p95_latency_ms']} ms" if probes_cnt > 0 else "N/A",
            **MetricsAggregator.calculate_percentage_change(
                baseline_metrics.get("p95_latency_ms"),
                experiment_metrics.get("p95_latency_ms") if probes_cnt > 0 else None,
                higher_is_better=False
            ),
        },
        "http_5xx": {
            "baseline": str(baseline_metrics["http_5xx_count"]),
            "during_fault": str(experiment_metrics["http_5xx_count"]),
            **MetricsAggregator.calculate_percentage_change(
                float(baseline_metrics["http_5xx_count"]),
                float(experiment_metrics["http_5xx_count"]),
                higher_is_better=False
            ),
        },
        "connection_errors": {
            "baseline": str(baseline_metrics["connection_errors_count"]),
            "during_fault": str(experiment_metrics["connection_errors_count"]),
            **MetricsAggregator.calculate_percentage_change(
                float(baseline_metrics["connection_errors_count"]),
                float(experiment_metrics["connection_errors_count"]),
                higher_is_better=False
            ),
        },
    }

    # 5. Hypothesis Evaluation
    custom_hypo = params.get("hypothesis")
    custom_exp = params.get("expected_behavior")
    hypothesis_eval = HypothesisEvaluator.evaluate(
        fault_type=fault_type,
        baseline_metrics=baseline_metrics,
        experiment_metrics=experiment_metrics,
        recovery_metrics=recovery_metrics,
        custom_hypothesis=custom_hypo,
        custom_expected=custom_exp,
    )

    # 6. Findings & Anomalies
    rollback_ok = res.get("recovered", True)
    findings = FindingDetector.detect_findings(
        fault_type=fault_type,
        target=target,
        baseline=baseline_metrics,
        experiment=experiment_metrics,
        recovery=recovery_metrics,
        rollback_success=rollback_ok,
    )

    anomalies = FindingDetector.detect_anomalies(
        baseline=baseline_metrics,
        experiment=experiment_metrics,
        recovery=recovery_metrics,
    )

    # 7. Root-Cause Indicators
    root_causes = RootCauseIndicator.infer_root_causes(
        fault_type=fault_type,
        target=target,
        findings=findings,
        experiment=experiment_metrics,
        recovery=recovery_metrics,
    )

    # 8. Structured Recommendations paired with Next Experiments
    structured_recs = RecommendationEngine.generate_recommendations(
        fault_type=fault_type,
        target=target,
        findings=findings,
        root_causes=root_causes,
    )

    # 9. Chronological Timeline — uses actual lifecycle timestamps when available
    lifecycle_timing = res.get("lifecycle_timing") or {}
    base_start = lifecycle_timing.get("baseline_started_at")
    fault_start = lifecycle_timing.get("fault_injection_started_at")
    fault_end = lifecycle_timing.get("fault_injection_completed_at")
    first_dev = lifecycle_timing.get("first_deviation_at")
    tti = lifecycle_timing.get("time_to_first_impact_seconds")
    rec_start = lifecycle_timing.get("recovery_started_at")
    rec_end = lifecycle_timing.get("recovery_confirmed_at")
    fw_dur = lifecycle_timing.get("fault_window_duration_seconds") or float(duration)
    rec_dur = lifecycle_timing.get("recovery_duration_seconds")

    timeline = []
    timeline.append({"phase": "init", "t_rel": 0.0, "time": "T+0.0s", "event": "Experiment initialized & dispatched to Noir queue."})
    if baseline_metrics["available"]:
        base_dur = lifecycle_timing.get("baseline_duration_seconds")
        t_base = f"~{round(base_dur, 1)}s" if base_dur else "~10s"
        timeline.append({
            "phase": "baseline",
            "t_rel": 0.5,
            "time": f"T+0.5s to T+{t_base}",
            "event": f"Baseline measured on '{baseline_metrics['probe_url']}': "
                     f"mean={baseline_metrics.get('mean_latency_ms', 0)}ms, "
                     f"p95={baseline_metrics.get('p95_latency_ms', 'N/A')}ms, "
                     f"stddev={baseline_metrics.get('stddev_latency_ms', 'N/A')}ms, "
                     f"n={baseline_metrics.get('probes_count', 0)} probes.",
        })
    fault_t0 = round(lifecycle_timing.get("baseline_duration_seconds") or 0, 1)
    timeline.append({
        "phase": "fault",
        "t_rel": fault_t0,
        "time": f"T+{fault_t0}s",
        "event": f"Fault injected: {fault_type.replace('_', ' ')} applied to container '{target}'.",
    })
    if tti is not None:
        timeline.append({
            "phase": "fault",
            "t_rel": fault_t0 + tti,
            "time": f"T+{round(fault_t0 + tti, 1)}s",
            "event": f"First measurable impact detected: T+{tti}s after fault start (latency deviation or HTTP error).",
        })
    elif experiment_metrics.get("failed_probes", 0) > 0:
        timeline.append({
            "phase": "fault",
            "t_rel": fault_t0 + 1.0,
            "time": f"T+{fault_t0 + 1.0}s (est.)",
            "event": f"First failure observed: '{experiment_metrics['sample_errors'][0] if experiment_metrics['sample_errors'] else 'Probe failed'}'.",
        })
    peak_at = lifecycle_timing.get("peak_degradation_at")
    if experiment_metrics.get("availability_percent", 100) < 100 or experiment_metrics.get("anomaly_summary", {}).get("peak_impact"):
        peak_info = (experiment_metrics.get("anomaly_summary") or {}).get("peak_impact") or {}
        peak_lat = peak_info.get("peak_latency_ms") or experiment_metrics.get("p95_latency_ms", 0)
        timeline.append({
            "phase": "fault",
            "t_rel": fault_t0 + fw_dur / 2,
            "time": f"T+{round(fault_t0 + fw_dur / 2, 1)}s (est.)",
            "event": f"Peak degradation: Availability {experiment_metrics['availability_percent']}%, "
                     f"P95 {experiment_metrics.get('p95_latency_ms', 'N/A')}ms, "
                     f"peak latency observed: {peak_lat}ms.",
        })
    timeline.append({
        "phase": "fault_end",
        "t_rel": fault_t0 + fw_dur,
        "time": f"T+{round(fault_t0 + fw_dur, 1)}s",
        "event": f"Fault execution window ended ({round(fw_dur, 1)}s); rollback initiated.",
    })
    if recovery_metrics.get("recovered"):
        rec_t = recovery_metrics.get('recovery_time_seconds', 0)
        timeline.append({
            "phase": "recovery",
            "t_rel": fault_t0 + fw_dur + rec_t,
            "time": f"T+{round(fault_t0 + fw_dur + rec_t, 1)}s",
            "event": f"Steady-state confirmed: {rec_t}s recovery (required {recovery_metrics.get('consecutive_healthy_required', 3)} consecutive healthy probes, "
                     f"RTO {'met' if recovery_metrics.get('rto_target_met') else 'exceeded'}).",
        })
    total_dur = lifecycle_timing.get("total_experiment_duration_seconds") or fault_t0 + fw_dur + (recovery_metrics.get("recovery_time_seconds") or 0) + 0.5
    timeline.append({
        "phase": "complete",
        "t_rel": total_dur,
        "time": f"T+{round(total_dur, 1)}s",
        "event": f"Experiment completed with status: {status_str.upper()}. Total duration: {round(total_dur, 1)}s.",
    })

    # 10. Resilience Score Explanation
    score_obj = res.get("resilience") or {}
    score = res.get("resilience_score") or score_obj.get("score", 85)
    grade = res.get("resilience_grade") or score_obj.get("grade", "B")
    classification = res.get("classification") or score_obj.get("classification", "Evaluated")
    score_breakdown = score_obj.get("breakdown") or {}
    experiment_confidence = res.get("experiment_confidence") or score_obj.get("confidence") or "low"
    experiment_confidence_reason = res.get("experiment_confidence_reason") or score_obj.get("confidence_reason") or ""

    score_explanation = [
        f"Availability ({score_breakdown.get('availability', '?')} pts): {experiment_metrics['availability_percent']}% during the fault window.",
        f"Latency Degradation ({score_breakdown.get('latency_degradation', '?')} pts): {experiment_metrics['latency_multiplier']}x baseline mean ({experiment_metrics.get('mean_latency_ms', 0)}ms in-fault vs {baseline_metrics.get('mean_latency_ms', 0)}ms baseline).",
        f"Tail Latency ({score_breakdown.get('tail_latency', '?')} pts): P95={experiment_metrics.get('p95_latency_ms', 'N/A')}ms.",
        f"Recovery ({score_breakdown.get('recovery', '?')} pts): {recovery_metrics['recovery_time_seconds']}s (RTO Target: {recovery_metrics['rto_target_seconds']}s, Target Met: {'Yes' if recovery_metrics['rto_target_met'] else 'No'}).",
        f"Rollback ({score_breakdown.get('rollback', '?')} pts): {'Clean rollback verified' if rollback_ok else 'Rollback incomplete / dirty state'}.",
        f"Stability ({score_breakdown.get('stability', '?')} pts): {(anomaly_summary or {}).get('spike_count', 0)} spike(s), max {(anomaly_summary or {}).get('max_consecutive_failures', 0)} consecutive failures.",
        f"Hypothesis: {hypothesis_eval['verdict']}.",
        f"Confidence: {experiment_confidence.upper()} ({experiment_confidence_reason})",
    ]

    # 11. Executive Summary Text
    exec_summary = (
        f"The experiment tested '{fault_type.replace('_', ' ')}' against container '{target}' "
        f"for {round(fw_dur, 1)}s while actively probing '{baseline_metrics['probe_url']}'. "
        f"Baseline ({baseline_metrics.get('probes_count', 0)} probes): mean={baseline_metrics.get('mean_latency_ms', 0)}ms, "
        f"stddev={baseline_metrics.get('stddev_latency_ms', 'N/A')}ms, availability={baseline_metrics['availability_percent']}%. "
        f"During fault injection ({experiment_metrics.get('raw_sample_count', probes_cnt)} probe samples): "
        f"availability={experiment_metrics['availability_percent']}%, "
        f"mean={experiment_metrics.get('mean_latency_ms', 0)}ms (+{round((experiment_metrics.get('latency_multiplier', 1.0)-1)*100, 1)}%), "
        f"P95={experiment_metrics.get('p95_latency_ms', 'N/A')}ms, "
        f"spikes={anomaly_summary.get('spike_count', 0)}, "
        f"max_consecutive_failures={anomaly_summary.get('max_consecutive_failures', 0)}. "
        f"Recovery: {recovery_metrics['recovery_time_seconds']}s (RTO {'met' if recovery_metrics['rto_target_met'] else 'EXCEEDED'}, target {recovery_metrics['rto_target_seconds']}s). "
        f"Hypothesis '{hypothesis_eval['hypothesis'][:80]}...' was evaluated as {hypothesis_eval['verdict']}."
    )

    return {
        "metadata": {
            "id": getattr(fault, "id", 0),
            "project_id": getattr(fault, "project_id", 0),
            "project_title": getattr(fault.project, "title", "Project") if hasattr(fault, "project") else "Project",
            "project_code": getattr(fault.project, "connection_code", "") if hasattr(fault, "project") else "",
            "fault_type": fault_type,
            "target": target,
            "status": status_str,
            "duration_seconds": float(duration),
            "fault_window_seconds": round(fw_dur, 2),
            "requested_at": req_at.isoformat() if req_at else None,
            "started_at": started_at.isoformat() if started_at else None,
            "completed_at": completed_at.isoformat() if completed_at else None,
            "requested_by": {
                "username": getattr(fault.requested_by, "username", "Engineer") if hasattr(fault, "requested_by") else "Engineer",
                "email": getattr(fault.requested_by, "email", "") if hasattr(fault, "requested_by") else "",
            } if hasattr(fault, "requested_by") else None,
            "parameters": params,
        },
        "score_summary": {
            "score": score,
            "grade": grade,
            "classification": classification,
            "why": score_explanation,
            "breakdown": score_breakdown,
            "confidence": experiment_confidence,
            "confidence_reason": experiment_confidence_reason,
        },
        "executive_summary": exec_summary,
        "hypothesis": hypothesis_eval,
        "timeline": timeline,
        "lifecycle_timing": lifecycle_timing,
        "baseline": baseline_metrics,
        "experiment_metrics": experiment_metrics,
        "recovery": recovery_metrics,
        "comparison_table": comparison,
        "anomaly_summary": anomaly_summary,
        "findings": findings,
        "anomalies": anomalies,
        "root_causes": root_causes,
        "recommendations": structured_recs,
        "error_message": getattr(fault, "error_message", "") or res.get("error", ""),
    }
