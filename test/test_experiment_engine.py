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
        assert rec["recovered"] is True
        assert "recovery_trajectory" in rec
        assert "recovery_time_seconds" in rec

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
        assert r["score"] > 0
        assert r["confidence"] == "low"


if __name__ == "__main__":
    import unittest
    # Convert pytest-style classes to unittest
    # Easiest: just call directly
    import traceback
    failures = 0
    suites = [
        TestFullDistribution, TestPhaseMetrics, TestRollingMetrics,
        TestAnomalyDetector, TestSteadyStateEvaluator, TestResilienceScorer,
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
