"""
Tests for the Noir High-Fidelity Chaos Experiment Engine
Backend portion: MetricsAggregator, FindingDetector, and generate_experiment_report.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()

from apps.projects.chaos_reporting import (
    MetricsAggregator,
    FindingDetector,
)


class TestMetricsAggregatorBackend(TestCase):

    def test_percentile_safety_p99(self):
        vals = [float(i) for i in range(15)]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNone(d["p99"], "P99 must be None for < 20 samples")

    def test_percentile_available_p99_at_20(self):
        vals = [float(i) for i in range(20)]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNotNone(d["p99"])

    def test_percentile_safety_p95(self):
        vals = [float(i) for i in range(5)]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNone(d["p95"], "P95 must be None for < 10 samples")

    def test_percentile_available_p95_at_10(self):
        vals = [float(i) for i in range(10)]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNotNone(d["p95"])

    def test_stddev_computed_at_5_values(self):
        vals = [10.0, 11.0, 9.0, 12.0, 10.5]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNotNone(d["stddev"])
        self.assertGreater(d["stddev"], 0)

    def test_stddev_none_below_5_samples(self):
        vals = [10.0, 11.0, 9.0, 12.0]  # 4 values
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNone(d["stddev"])

    def test_p75_p90_always_present(self):
        vals = [float(i) for i in range(10)]
        d = MetricsAggregator.calculate_percentiles(vals)
        self.assertIsNotNone(d["p75"])
        self.assertIsNotNone(d["p90"])

    def test_from_raw_observations_empty(self):
        m = MetricsAggregator.from_raw_observations([])
        self.assertEqual(m["sample_count"], 0)

    def test_from_raw_observations_all_success(self):
        raw = [{"success": True, "latency_ms": 10.0} for _ in range(5)]
        m = MetricsAggregator.from_raw_observations(raw)
        self.assertEqual(m["availability_percent"], 100.0)
        self.assertEqual(m["successful_probes"], 5)
        self.assertEqual(m["failed_probes"], 0)
        self.assertEqual(m["timeout_count"], 0)

    def test_from_raw_observations_mixed(self):
        raw = [
            {"success": True, "latency_ms": 10.0},
            {"success": False, "latency_ms": 5000, "timeout": True, "error_type": "timeout"},
            {"success": False, "latency_ms": 3000, "error_type": "connection_error"},
        ]
        m = MetricsAggregator.from_raw_observations(raw)
        self.assertAlmostEqual(m["availability_percent"], 33.33, places=1)
        self.assertEqual(m["timeout_count"], 1)
        self.assertEqual(m["connection_error_count"], 1)

    def test_from_raw_observations_distribution_fields(self):
        raw = [{"success": True, "latency_ms": float(i * 5)} for i in range(1, 11)]
        m = MetricsAggregator.from_raw_observations(raw)
        self.assertIsNotNone(m.get("p95_latency_ms"))
        self.assertIsNotNone(m.get("avg_latency_ms"))
        self.assertIsNotNone(m.get("min_latency_ms"))
        self.assertIsNotNone(m.get("max_latency_ms"))
        self.assertEqual(m["avg_latency_ms"], m["latency_distribution"]["mean"])


class TestFindingDetectorNewFindings(TestCase):

    def _base_baseline(self):
        return {
            "available": True, "healthy": True,
            "probe_url": "http://test/health",
            "availability_percent": 100.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0,
            "p50_latency_ms": 10.0, "p95_latency_ms": 12.0,
            "connection_errors_count": 0, "http_5xx_count": 0,
        }

    def _base_recovery(self):
        return {
            "recovered": True,
            "recovery_time_seconds": 0.5,
            "rto_target_seconds": 5.0,
            "rto_target_met": True,
            "timed_out": False,
        }

    def test_f_lat_minor_detected_at_25pct_increase(self):
        """F-LAT-MINOR must fire for 15–50% latency increase."""
        exp = {
            "probes_count": 5,
            "availability_percent": 100.0,
            "avg_latency_ms": 12.5, "mean_latency_ms": 12.5,
            "p50_latency_ms": 12.0, "p95_latency_ms": 14.0,
            "latency_multiplier": 1.25,
            "failed_probes": 0, "successful_probes": 5,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        findings = FindingDetector.detect_findings(
            "cpu_stress", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        ids = [f["id"] for f in findings]
        self.assertIn("F-LAT-MINOR", ids, "25% increase should be detected")
        self.assertNotIn("F-LAT-SPIKE", ids, "Should not be spike at 1.25x")

    def test_f_lat_spike_fires_at_3x(self):
        exp = {
            "probes_count": 10,
            "availability_percent": 100.0,
            "avg_latency_ms": 50.0, "mean_latency_ms": 50.0,
            "p50_latency_ms": 45.0, "p95_latency_ms": 60.0,
            "latency_multiplier": 5.0,
            "failed_probes": 0, "successful_probes": 10,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        findings = FindingDetector.detect_findings(
            "cpu_stress", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        ids = [f["id"] for f in findings]
        self.assertIn("F-LAT-SPIKE", ids)
        self.assertNotIn("F-LAT-MINOR", ids, "Only one latency finding should fire")

    def test_f_tail_diverge_fires_when_p95_13x_p50(self):
        exp = {
            "probes_count": 20,
            "availability_percent": 90.0,
            "avg_latency_ms": 30.0, "mean_latency_ms": 30.0,
            "p50_latency_ms": 15.0,
            "p95_latency_ms": 200.0,
            "latency_multiplier": 3.0,
            "failed_probes": 2, "successful_probes": 18,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        findings = FindingDetector.detect_findings(
            "cpu_stress", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        ids = [f["id"] for f in findings]
        self.assertIn("F-TAIL-DIVERGE", ids)

    def test_f_spike_transient_fires_from_anomaly_summary(self):
        exp = {
            "probes_count": 10,
            "availability_percent": 100.0,
            "avg_latency_ms": 12.0, "mean_latency_ms": 12.0,
            "p50_latency_ms": 11.0, "p95_latency_ms": 15.0,
            "latency_multiplier": 1.2,
            "failed_probes": 0, "successful_probes": 10,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [],
            "anomaly_summary": {
                "spike_count": 3,
                "peak_impact": {"peak_latency_ms": 80.0, "percentage_delta": 700},
                "failure_bursts": [],
                "max_consecutive_failures": 0,
            },
        }
        findings = FindingDetector.detect_findings(
            "cpu_stress", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        ids = [f["id"] for f in findings]
        self.assertIn("F-SPIKE-TRANSIENT", ids)
        f = next(f for f in findings if f["id"] == "F-SPIKE-TRANSIENT")
        self.assertIn("3", f["title"], "Title should mention spike count")

    def test_f_burst_fail_fires_for_consecutive_failures(self):
        exp = {
            "probes_count": 10,
            "availability_percent": 60.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0,
            "p50_latency_ms": 10.0, "p95_latency_ms": 12.0,
            "latency_multiplier": 1.0,
            "failed_probes": 4, "successful_probes": 6,
            "connection_errors_count": 4, "http_5xx_count": 0,
            "sample_errors": [],
            "anomaly_summary": {
                "spike_count": 0,
                "failure_bursts": [{"start_time": 1.0, "end_time": 3.0, "consecutive_failures": 4, "duration_sec": 2.0}],
                "max_consecutive_failures": 4,
            },
        }
        findings = FindingDetector.detect_findings(
            "container_stop", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        ids = [f["id"] for f in findings]
        self.assertIn("F-BURST-FAIL", ids)

    def test_perfect_run_only_informational_findings(self):
        exp = {
            "probes_count": 10,
            "availability_percent": 100.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0,
            "p50_latency_ms": 10.0, "p95_latency_ms": 11.0,
            "latency_multiplier": 1.0,
            "failed_probes": 0, "successful_probes": 10,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        findings = FindingDetector.detect_findings(
            "cpu_stress", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        non_info = [f for f in findings if f["severity"] not in ("Informational", "Low")]
        self.assertEqual(
            len(non_info), 0,
            f"Unexpected non-informational findings on a perfect run: {[f['id'] for f in non_info]}"
        )
