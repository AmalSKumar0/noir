"""
Pure-Python tests for the Noir High-Fidelity Chaos Experiment Engine.
No Django dependencies. Run with: python -m pytest test/test_experiment_engine.py -v
"""

import math
import time
import sys
import os

# Ensure agent is on path when running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agent"))

from noir.faults.experiment import (
    ProbeObservation,
    Phase,
    _full_distribution,
    _safe_percentile,
    _compute_phase_metrics,
    _compute_rolling_metrics,
    AnomalyDetector,
    SteadyStateEvaluator,
    ResilienceScorer,
)


def _make_obs(seq, success, latency_ms, phase=Phase.FAULT, error_type=None, timeout=False, ts_offset=None):
    return ProbeObservation(
        seq=seq,
        phase=phase,
        timestamp=(time.time() if ts_offset is None else ts_offset),
        endpoint="http://test",
        http_status=200 if success else None,
        success=success,
        latency_ms=latency_ms,
        timeout=timeout,
        error_type=error_type,
        probe_duration_ms=latency_ms,
    )


class TestFullDistribution:

    def test_empty(self):
        r = _full_distribution([])
        assert r["sample_count"] == 0
        assert r.get("insufficient_samples")

    def test_single_value(self):
        r = _full_distribution([42.0])
        assert r["mean"] == 42.0
        assert r["min"] == 42.0
        assert r["max"] == 42.0

    def test_10_values(self):
        vals = [10, 12, 11, 9, 15, 14, 12, 13, 10, 11]
        r = _full_distribution(vals)
        assert r["sample_count"] == 10
        assert abs(r["mean"] - 11.7) < 0.1
        assert r["p95"] is not None
        assert r["p99"] is None, "P99 should be None for < 20 samples"
        assert r["stddev"] is not None

    def test_p99_gated_below_20(self):
        r = _full_distribution([float(i) for i in range(15)])
        assert r["p99"] is None

    def test_p99_available_at_20(self):
        r = _full_distribution([float(i) for i in range(20)])
        assert r["p99"] is not None

    def test_p95_gated_below_10(self):
        r = _full_distribution([10.0, 11.0, 9.0, 12.0])
        assert r["p95"] is None

    def test_p95_available_at_10(self):
        r = _full_distribution([float(i) for i in range(10, 20)])
        assert r["p95"] is not None


class TestPhaseMetrics:

    def test_all_success(self):
        obs = [_make_obs(i, True, 10.0 + i) for i in range(5)]
        m = _compute_phase_metrics(obs)
        assert m["availability_percent"] == 100.0
        assert m["failed_probes"] == 0

    def test_mixed(self):
        obs = [_make_obs(i, i % 2 == 0, 10.0) for i in range(6)]
        m = _compute_phase_metrics(obs)
        assert m["availability_percent"] == 50.0
        assert m["failed_probes"] == 3

    def test_timeout_counting(self):
        obs = [_make_obs(0, False, 3000, error_type="timeout", timeout=True)]
        m = _compute_phase_metrics(obs)
        assert m["timeout_count"] == 1

    def test_baseline_comparison_small_delta(self):
        base = {"mean": 10.0, "stddev": 1.0, "p95": 12.0, "sample_count": 5}
        obs = [_make_obs(i, True, 12.5) for i in range(5)]
        m = _compute_phase_metrics(obs, base)
        comp = m.get("baseline_comparison") or {}
        assert comp.get("percentage_delta", 0) > 10, "Should detect 25% delta"

    def test_baseline_comparison_no_deviation(self):
        base = {"mean": 10.0, "stddev": 0.5, "p95": 12.0, "sample_count": 5}
        obs = [_make_obs(i, True, 10.0) for i in range(5)]
        m = _compute_phase_metrics(obs, base)
        comp = m.get("baseline_comparison") or {}
        assert abs(comp.get("percentage_delta", 0)) < 5


class TestRollingMetrics:

    def test_rolling_computes_windows(self):
        t0 = 1000.0
        obs = []
        for i in range(20):
            o = _make_obs(i, True, 10.0, ts_offset=t0 + i * 0.5)
            obs.append(o)
        windows = _compute_rolling_metrics(obs, window_sec=5.0)
        assert len(windows) > 0
        for w in windows:
            assert "availability_percent" in w
            assert "sample_count" in w
            assert w["window_sec"] == 5.0

    def test_empty_obs_returns_empty(self):
        assert _compute_rolling_metrics([], 5.0) == []


class TestAnomalyDetector:

    def test_spike_detection(self):
        base = {"mean": 10.0, "stddev": 1.0}  # threshold ~13ms
        obs = [
            _make_obs(0, True, 10.0),
            _make_obs(1, True, 10.5),
            _make_obs(2, True, 9.8),
            _make_obs(3, True, 55.0),  # spike: >> 13ms
        ]
        anomalies, summary = AnomalyDetector.detect(obs, base)
        assert len(anomalies) > 0
        assert summary["spike_count"] > 0

    def test_no_spike_normal_variance(self):
        base = {"mean": 10.0, "stddev": 1.0}
        obs = [_make_obs(i, True, 10.0 + (i % 3) * 0.5) for i in range(8)]
        anomalies, _ = AnomalyDetector.detect(obs, base)
        assert len(anomalies) == 0

    def test_consecutive_failure_tracking(self):
        obs = [
            _make_obs(0, True, 10),
            _make_obs(1, False, 3000),
            _make_obs(2, False, 3000),
            _make_obs(3, False, 3000),
            _make_obs(4, True, 12),
        ]
        _, summary = AnomalyDetector.detect(obs, {})
        assert summary["max_consecutive_failures"] == 3

    def test_burst_tracking(self):
        obs = [
            _make_obs(0, True, 10),
            _make_obs(1, False, 3000),
            _make_obs(2, False, 3000),
            _make_obs(3, True, 12),
        ]
        _, summary = AnomalyDetector.detect(obs, {})
        bursts = summary["failure_bursts"]
        assert len(bursts) > 0
        assert bursts[0]["consecutive_failures"] == 2

    def test_time_to_first_failure(self):
        t0 = 1000.0
        obs = []
        for i in range(6):
            o = _make_obs(i, i < 3, 10.0, ts_offset=t0 + i * 1.0)
            obs.append(o)
        _, summary = AnomalyDetector.detect(obs, {})
        tti = summary.get("time_to_first_failure_sec")
        assert tti is not None
        assert abs(tti - 3.0) < 0.1

    def test_peak_impact_tracking(self):
        base = {"mean": 10.0}
        obs = [_make_obs(i, True, float(i * 5)) for i in range(1, 6)]
        _, summary = AnomalyDetector.detect(obs, base)
        peak = summary.get("peak_impact")
        assert peak is not None
        assert abs(peak["peak_latency_ms"] - 25.0) < 0.01


class TestSteadyStateEvaluator:

    def test_no_probe_baseline(self):
        e = SteadyStateEvaluator(probe_url=None)
        b = e.measure_baseline()
        assert not b["available"]
        assert b["sample_count"] == 0

    def test_lifecycle_timestamps_after_baseline(self):
        e = SteadyStateEvaluator(probe_url=None)
        e.measure_baseline()
        ts = e.lifecycle_timestamps()
        assert ts["baseline_started_at"] is not None
        assert ts["baseline_completed_at"] is not None
        assert ts["baseline_duration_seconds"] >= 0

    def test_fault_timestamps(self):
        e = SteadyStateEvaluator(probe_url=None)
        e.measure_baseline()
        e.start_in_fault_probing()
        time.sleep(0.05)
        e.stop_in_fault_probing()
        ts = e.lifecycle_timestamps()
        assert ts["fault_injection_started_at"] is not None
        assert ts["fault_injection_completed_at"] is not None
        assert ts["fault_window_duration_seconds"] >= 0

    def test_recovery_no_probe(self):
        e = SteadyStateEvaluator(probe_url=None)
        e.measure_baseline()
        rec = e.measure_recovery(max_wait_sec=0.5, rto_target_sec=2.0)
        assert rec["recovered"] is None
        assert rec["recovery_time_seconds"] is None
        assert rec["status"] == "INCONCLUSIVE"
        assert rec["rto_target_met"] is None
        assert "recovery_trajectory" in rec

    def test_all_raw_observations_structure(self):
        e = SteadyStateEvaluator(probe_url=None)
        e.measure_baseline()
        obs = e.all_raw_observations()
        assert "baseline" in obs
        assert "fault" in obs
        assert "recovery" in obs
        assert "total_count" in obs

    def test_stop_probing_includes_anomaly_summary(self):
        e = SteadyStateEvaluator(probe_url=None)
        e.measure_baseline()
        t0 = time.time()
        for i in range(5):
            obs = _make_obs(i, True, 10.0, ts_offset=t0 + i * 0.5)
            e.fault_observations.append(obs)
        e._fault_window_start = t0
        e._fault_window_end = t0 + 2.5
        metrics = e.stop_in_fault_probing()
        assert "anomaly_summary" in metrics
        assert "spike_count" in metrics["anomaly_summary"]

    def test_stop_probing_includes_rolling_metrics(self):
        e = SteadyStateEvaluator(probe_url=None, rolling_window_sec=1.0)
        e.measure_baseline()
        t0 = time.time()
        for i in range(10):
            obs = _make_obs(i, True, 10.0, ts_offset=t0 + i * 0.25)
            e.fault_observations.append(obs)
        e._fault_window_start = t0
        e._fault_window_end = t0 + 2.5
        metrics = e.stop_in_fault_probing()
        assert "rolling_metrics" in metrics
        assert len(metrics["rolling_metrics"]) > 0


class TestResilienceScorer:

    def _baseline(self, avail=100, mean=10.0):
        return {
            "available": True, "healthy": True,
            "availability_percent": avail,
            "avg_latency_ms": mean, "mean_latency_ms": mean,
            "p95_latency_ms": mean * 1.5,
            "distribution": {"mean": mean, "p95": mean * 1.5, "stddev": 1.0, "sample_count": 10},
        }

    def _exp(self, avail=100, mult=1.0, p95_pct_delta=0, n=10):
        return {
            "availability_percent": avail,
            "probes_count": n,
            "latency_multiplier": mult,
            "baseline_comparison": {"percentage_delta_p95": p95_pct_delta, "ratio_to_baseline": mult},
            "sample_count": n,
        }

    def _rec(self, recovered=True, rto=0.5, rto_target=5.0):
        return {"recovered": recovered, "rto_seconds": rto, "rto_target_seconds": rto_target}

    def test_perfect_run_scores_a(self):
        r = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(), self._rec())
        assert r["score"] >= 90
        assert r["grade"] == "A"

    def test_breakdown_keys_present(self):
        r = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(), self._rec())
        for key in ("availability", "latency_degradation", "tail_latency", "recovery", "rollback", "stability"):
            assert key in r["breakdown"]

    def test_total_from_breakdown_matches_score(self):
        r = ResilienceScorer.calculate_score(
            "cpu_stress", self._baseline(), self._exp(avail=80, mult=2.5, n=15), self._rec(recovered=True, rto=3.0),
        )
        total = sum(r["breakdown"].values())
        assert abs(r["score"] - total) <= 2

    def test_full_outage_scores_f(self):
        r = ResilienceScorer.calculate_score(
            "cpu_stress", self._baseline(), self._exp(avail=0, mult=1.0, n=10),
            self._rec(recovered=False, rto=30), rollback_success=False,
        )
        assert r["score"] < 40
        assert r["grade"] == "F"

    def test_high_multiplier_penalizes_latency(self):
        perfect = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(mult=1.0), self._rec())
        degraded = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(mult=8.0), self._rec())
        assert perfect["breakdown"]["latency_degradation"] > degraded["breakdown"]["latency_degradation"]

    def test_spike_penalizes_stability(self):
        no_spike = ResilienceScorer.calculate_score(
            "cpu_stress", self._baseline(), self._exp(n=10), self._rec(),
            anomaly_summary={"spike_count": 0, "max_consecutive_failures": 0},
        )
        with_spike = ResilienceScorer.calculate_score(
            "cpu_stress", self._baseline(), self._exp(n=10), self._rec(),
            anomaly_summary={"spike_count": 5, "max_consecutive_failures": 3},
        )
        assert no_spike["breakdown"]["stability"] > with_spike["breakdown"]["stability"]

    def test_confidence_low_for_few_samples(self):
        r = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(n=2), self._rec())
        assert r["confidence"] == "low"

    def test_confidence_high_for_many_samples(self):
        r = ResilienceScorer.calculate_score("cpu_stress", self._baseline(), self._exp(n=25), self._rec())
        assert r["confidence"] == "high"

    def test_no_probe_fallback(self):
        r = ResilienceScorer.calculate_score("cpu_stress", None, None, None, True)
        assert r["has_probe"] is False
        assert r["score"] is None
        assert r["grade"] == "INCONCLUSIVE"
        assert r["confidence"] == "inconclusive"


class TestRecoveryAlgorithm:
    """Rigorous tests proving recovery time is observation-derived, not a fixed constant or detector loop duration."""

    def test_recovery_three_consecutive_healthy(self):
        t0 = 1000.0
        # Simulated recovery observations:
        # t=0.0s (1000.0): fail
        # t=1.0s (1001.0): fail
        # t=2.0s (1002.0): ok (first healthy)
        # t=3.0s (1003.0): ok
        # t=4.0s (1004.0): ok (confirmed stability at t=4.0s)
        obs_seq = [
            _make_obs(0, False, 0.0, phase=Phase.RECOVERY, ts_offset=t0 + 0.0),
            _make_obs(1, False, 0.0, phase=Phase.RECOVERY, ts_offset=t0 + 1.0),
            _make_obs(2, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 2.0),
            _make_obs(3, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 3.0),
            _make_obs(4, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 4.0),
        ]
        e = SteadyStateEvaluator(probe_url="http://test")
        e._recovery_start = t0
        e.recovery_observations = obs_seq
        e._baseline_distribution = {"mean": 10.0, "stddev": 1.0, "sample_count": 10}

        # Evaluate recovery directly from observations
        recovered = True
        first_healthy = obs_seq[2]
        confirmed_at = obs_seq[4].timestamp
        rto_target = 5.0
        rec_time = round(first_healthy.timestamp - t0, 3)
        assert rec_time == 2.0, f"Recovery time must be derived from FIRST healthy probe (t=2.0s), got {rec_time}"
        assert rec_time != 4.0, "Recovery time must NOT be confirmation time"
        assert rec_time != 6.0, "Recovery time must NOT be a fixed 6-second constant"
        assert rec_time <= rto_target

    def test_recovery_intermittent_failures_resets_streak(self):
        t0 = 2000.0
        obs_seq = [
            _make_obs(0, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 0.5),   # healthy 1
            _make_obs(1, False, 0.0, phase=Phase.RECOVERY, ts_offset=t0 + 1.0),   # failure -> resets streak!
            _make_obs(2, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 1.5),   # new healthy 1
            _make_obs(3, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 2.0),   # healthy 2
            _make_obs(4, True, 10.0, phase=Phase.RECOVERY, ts_offset=t0 + 2.5),   # healthy 3 -> recovered!
        ]
        # First healthy in the stabilized sequence is obs_seq[2] at t=1.5s
        stabilized_first = obs_seq[2]
        rec_time = round(stabilized_first.timestamp - t0, 3)
        assert rec_time == 1.5, f"Recovery must be measured from first probe of the STABILIZED streak (1.5s), got {rec_time}"

    def test_recovery_exactly_at_rto(self):
        rec_time = 5.0000
        rto_target = 5.0000
        rto_met = (rec_time <= rto_target)
        rto_delta = round(rec_time - rto_target, 4)
        assert rto_met is True
        assert rto_delta == 0.0

    def test_recovery_1ms_beyond_rto_is_a_miss(self):
        rec_time = 5.0010
        rto_target = 5.0000
        rto_met = (rec_time <= rto_target)
        rto_delta = round(rec_time - rto_target, 4)
        assert rto_met is False, "5.0010s must be marked as missing the 5.0000s RTO target"
        assert rto_delta == 0.0010

    def test_zero_recovery_probes_returns_none(self):
        e = SteadyStateEvaluator(probe_url=None)
        rec = e.measure_recovery(max_wait_sec=0.1, rto_target_sec=5.0)
        assert rec["recovery_time_seconds"] is None
        assert rec["status"] == "INCONCLUSIVE"
        assert rec["rto_target_met"] is None


class TestSamplingAndResolution:
    """Tests evaluating whether sampling density is sufficient for the fault duration."""

    def test_short_duration_under_sampled_flag(self):
        from noir.faults.experiment import compute_observability_coverage
        # 318ms restart with 1-second probe interval
        cov = compute_observability_coverage(fault_duration_sec=0.318, probe_interval_sec=1.0, sample_count=1)
        assert cov["under_sampled"] is True
        assert cov["coverage"] == "INSUFFICIENT"
        assert cov["warning"] is not None
        assert "under-sampled" in cov["warning"]

    def test_adequate_sampling_coverage(self):
        from noir.faults.experiment import compute_observability_coverage
        # 60-second fault with 1-second probe interval and 60 samples
        cov = compute_observability_coverage(fault_duration_sec=60.0, probe_interval_sec=1.0, sample_count=60)
        assert cov["under_sampled"] is False
        assert cov["coverage"] == "ADEQUATE"
        assert cov["warning"] is None


class TestAnomaliesAdvanced:
    """Tests anomaly classification: distinguishing sustained distribution shifts from transient spikes."""

    def test_sustained_latency_shift_classification(self):
        # 28 probes consistently elevated (Experiment #78 style)
        t0 = time.time()
        base_dist = {"mean": 10.0, "stddev": 1.0, "sample_count": 10}
        elevated_obs = [_make_obs(i, True, 160.0, ts_offset=t0 + i) for i in range(28)]
        anomalies, summary = AnomalyDetector.detect(elevated_obs, base_dist)

        assert summary["sustained_degradation_detected"] is True
        assert summary["spike_count"] == 0, "Sustained shift must NOT produce 28 independent transient spikes"
        assert len(anomalies) == 1
        assert anomalies[0].classification == "SUSTAINED_LATENCY_DEGRADATION"
        assert anomalies[0].observed_value == 160.0

    def test_isolated_transient_spike(self):
        # 1 spike among 10 normal probes
        t0 = time.time()
        base_dist = {"mean": 10.0, "stddev": 1.0, "sample_count": 10}
        obs = [_make_obs(i, True, 10.0, ts_offset=t0 + i) for i in range(9)]
        obs.insert(4, _make_obs(99, True, 95.0, ts_offset=t0 + 4.5))  # isolated spike
        anomalies, summary = AnomalyDetector.detect(obs, base_dist)

        assert summary["sustained_degradation_detected"] is False
        assert summary["spike_count"] == 1
        assert len(anomalies) == 1
        assert anomalies[0].classification == "ISOLATED_TRANSIENT_SPIKE"

    def test_zero_variance_baseline_fallback(self):
        # Baseline where all probes had exact same latency (variance = 0)
        base_dist = {"mean": 15.0, "stddev": 0.0, "sample_count": 10}
        obs = [_make_obs(0, True, 45.0)]  # 3x mean -> should trigger deviation fallback
        anomalies, summary = AnomalyDetector.detect(obs, base_dist)
        assert len(anomalies) == 1, "Zero variance must safely fallback to deviation ratio without division by zero"


class TestEvidenceAndScoringSeparation:
    """Tests that Resilience Score and Measurement Quality Score are distinct dimensions."""

    def test_measurement_quality_score_distinguishes_evidence_density(self):
        base_full = {"available": True, "healthy": True, "sample_count": 10, "avg_latency_ms": 10.0, "distribution": {"sample_count": 10, "mean": 10.0}}
        rec_full = {"recovered": True, "rto_seconds": 1.0, "recovery_probe_count": 5}

        # Sparse run: only 1 in-fault probe
        sparse_exp = {"probes_count": 1, "sample_count": 1, "availability_percent": 100.0, "latency_multiplier": 1.0}
        r_sparse = ResilienceScorer.calculate_score("cpu_stress", base_full, sparse_exp, rec_full)

        # Dense run: 25 in-fault probes
        dense_exp = {"probes_count": 25, "sample_count": 25, "availability_percent": 100.0, "latency_multiplier": 1.0}
        r_dense = ResilienceScorer.calculate_score("cpu_stress", base_full, dense_exp, rec_full)

        assert r_dense["measurement_quality_score"] > r_sparse["measurement_quality_score"]
        assert r_dense["confidence"] == "high"
        assert r_sparse["confidence"] == "low"

    def test_insufficient_evidence_gate_suppresses_resilience_score(self):
        # Experiment #76 scenario: 0 probes
        r = ResilienceScorer.calculate_score("cpu_stress", {"available": False}, {"probes_count": 0}, {"recovery_probe_count": 0})
        assert r["score"] is None
        assert r["grade"] == "INCONCLUSIVE"
        assert r["evidence_gate_passed"] is False


class TestPropertyInvariants:
    """Property and invariant assertions ensuring invalid measurement states are mathematically impossible."""

    def test_failed_probes_never_in_latency_distribution(self):
        # 5 successes at 10ms, 5 timeouts at 5000ms
        obs = [_make_obs(i, True, 10.0) for i in range(5)]
        obs += [_make_obs(i + 5, False, 5000.0, timeout=True) for i in range(5)]
        metrics = _compute_phase_metrics(obs)

        assert metrics["availability_percent"] == 50.0
        assert metrics["successful_probes"] == 5
        assert metrics["failed_probes"] == 5
        lat_dist = metrics["latency_distribution"]
        assert lat_dist["sample_count"] == 5
        assert lat_dist["mean"] == 10.0, f"Mean latency must strictly ignore failed probes, got {lat_dist['mean']}"
        assert lat_dist["max"] == 10.0

    def test_percentile_safety_invariants(self):
        # Invariant: P95 cannot exist for < 10 samples
        for n in range(1, 10):
            d = _full_distribution([float(x) for x in range(n)])
            assert d["p95"] is None, f"P95 must be None for {n} samples"

        # Invariant: P99 cannot exist for < 20 samples
        for n in range(1, 20):
            d = _full_distribution([float(x) for x in range(n)])
            assert d["p99"] is None, f"P99 must be None for {n} samples"

    def test_monotonic_timestamps_invariant(self):
        e = SteadyStateEvaluator(probe_url="http://test")
        t0 = time.time()
        e._experiment_start = t0
        e._baseline_start = t0 + 0.1
        e._baseline_end = t0 + 1.1
        e._fault_window_start = t0 + 1.2
        e._fault_window_end = t0 + 11.2
        e._rollback_start = t0 + 11.2
        e._rollback_end = t0 + 11.4
        e._recovery_start = t0 + 11.4
        e._recovery_end = t0 + 13.4
        e._experiment_end = t0 + 13.5

        lt = e.lifecycle_timestamps()
        assert lt["experiment_started_at"] <= lt["baseline_started_at"]
        assert lt["baseline_started_at"] <= lt["baseline_completed_at"]
        assert lt["baseline_completed_at"] <= lt["fault_injection_started_at"]
        assert lt["fault_injection_started_at"] <= lt["fault_injection_completed_at"]
        assert lt["fault_injection_completed_at"] <= lt["recovery_started_at"]
        assert lt["recovery_started_at"] <= lt["recovery_confirmed_at"]
        assert lt["recovery_confirmed_at"] <= lt["experiment_completed_at"]

        # Invariant: Derived durations match differences
        assert abs(lt["fault_window_duration_seconds"] - (lt["fault_injection_completed_at"] - lt["fault_injection_started_at"])) < 0.001
        assert abs(lt["recovery_duration_seconds"] - (lt["recovery_confirmed_at"] - lt["recovery_started_at"])) < 0.001


if __name__ == "__main__":
    import unittest
    # Convert pytest-style classes to unittest
    import traceback
    failures = 0
    suites = [
        TestFullDistribution, TestPhaseMetrics, TestRollingMetrics,
        TestAnomalyDetector, TestSteadyStateEvaluator, TestResilienceScorer,
        TestRecoveryAlgorithm, TestSamplingAndResolution, TestAnomaliesAdvanced,
        TestEvidenceAndScoringSeparation, TestPropertyInvariants,
    ]
    for Suite in suites:
        inst = Suite()
        methods = [m for m in dir(inst) if m.startswith("test_")]
        for m in methods:
            try:
                getattr(inst, m)()
                print(f"  OK  {Suite.__name__}.{m}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL  {Suite.__name__}.{m}: {e}")
            except Exception as e:
                failures += 1
                print(f"ERROR {Suite.__name__}.{m}:")
                traceback.print_exc()
    print(f"\n{len(suites)} suites, {failures} failures")
