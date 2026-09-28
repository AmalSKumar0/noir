"""
Measurement and Statistical Correctness Invariant Tests for Noir Chaos Engine.
Tests the 30 critical measurement invariants, null-safety rules, and statistical properties.
"""

from django.test import TestCase
from apps.projects.chaos_reporting import (
    MetricsAggregator,
    HypothesisEvaluator,
    FindingDetector,
    CollectiveReportAggregator,
    generate_experiment_report,
)


class MeasurementInvariantsTests(TestCase):

    # 1. Null-Preservation (missing values must NEVER be converted to 0.0)
    def test_invariant_01_empty_observations_preserve_null_values(self):
        metrics = MetricsAggregator.from_raw_observations([])
        self.assertIsNone(metrics["avg_latency_ms"])
        self.assertIsNone(metrics["p50_latency_ms"])
        self.assertIsNone(metrics["p95_latency_ms"])
        self.assertIsNone(metrics["p99_latency_ms"])
        self.assertIsNone(metrics["availability_percent"])
        self.assertIsNone(metrics["min_latency_ms"])
        self.assertIsNone(metrics["max_latency_ms"])
        self.assertIsNone(metrics["stddev_latency_ms"])

    # 2. Failed probes excluded from latency distribution
    def test_invariant_02_failed_probes_excluded_from_latency_distribution(self):
        raw = [
            {"success": True, "latency_ms": 10.0},
            {"success": True, "latency_ms": 20.0},
            {"success": False, "latency_ms": 5000.0, "timeout": True},  # 5s timeout error
            {"success": False, "latency_ms": 3000.0, "error_type": "connection_error"},
        ]
        metrics = MetricsAggregator.from_raw_observations(raw)
        self.assertEqual(metrics["sample_count"], 4)
        self.assertEqual(metrics["successful_probes"], 2)
        self.assertEqual(metrics["failed_probes"], 2)
        self.assertEqual(metrics["timeout_count"], 1)
        self.assertEqual(metrics["connection_error_count"], 1)
        self.assertEqual(metrics["availability_percent"], 50.0)
        # Latency must only reflect the two successful probes (10 and 20)
        self.assertEqual(metrics["min_latency_ms"], 10.0)
        self.assertEqual(metrics["max_latency_ms"], 20.0)
        self.assertEqual(metrics["avg_latency_ms"], 15.0)

    # 3. P95 sample gate (minimum 10 samples required)
    def test_invariant_03_p95_sample_gate_enforced(self):
        # 9 samples: insufficient for P95
        nine_samples = [float(i * 10) for i in range(1, 10)]
        dist_9 = MetricsAggregator.calculate_percentiles(nine_samples)
        self.assertIsNone(dist_9["p95"])
        self.assertEqual(dist_9["p95_status"], "INSUFFICIENT_SAMPLES")

        # 10 samples: available
        ten_samples = [float(i * 10) for i in range(1, 11)]
        dist_10 = MetricsAggregator.calculate_percentiles(ten_samples)
        self.assertIsNotNone(dist_10["p95"])
        self.assertEqual(dist_10["p95_status"], "AVAILABLE")

    # 4. P99 sample gate (minimum 20 samples required)
    def test_invariant_04_p99_sample_gate_enforced(self):
        # 19 samples: insufficient for P99
        nineteen_samples = [float(i * 5) for i in range(1, 20)]
        dist_19 = MetricsAggregator.calculate_percentiles(nineteen_samples)
        self.assertIsNone(dist_19["p99"])
        self.assertEqual(dist_19["p99_status"], "INSUFFICIENT_SAMPLES")

        # 20 samples: available
        twenty_samples = [float(i * 5) for i in range(1, 21)]
        dist_20 = MetricsAggregator.calculate_percentiles(twenty_samples)
        self.assertIsNotNone(dist_20["p99"])
        self.assertEqual(dist_20["p99_status"], "AVAILABLE")

    # 5. Standard deviation sample gate (minimum 5 samples required)
    def test_invariant_05_stddev_requires_minimum_5_samples(self):
        four_samples = [10.0, 12.0, 11.0, 13.0]
        dist_4 = MetricsAggregator.calculate_percentiles(four_samples)
        self.assertIsNone(dist_4["stddev"])

        five_samples = [10.0, 12.0, 11.0, 13.0, 10.5]
        dist_5 = MetricsAggregator.calculate_percentiles(five_samples)
        self.assertIsNotNone(dist_5["stddev"])
        self.assertGreater(dist_5["stddev"], 0)

    # 6. Zero variance (all probes identical) does not divide by zero
    def test_invariant_06_zero_variance_handled_safely(self):
        identical = [15.0, 15.0, 15.0, 15.0, 15.0, 15.0]
        dist = MetricsAggregator.calculate_percentiles(identical)
        self.assertEqual(dist["mean"], 15.0)
        self.assertEqual(dist["stddev"], 0.0)

    # 7. Deterministic recomputability from raw observations
    def test_invariant_07_deterministic_recomputability_from_raw(self):
        raw = [
            {"seq": 1, "success": True, "latency_ms": 12.4},
            {"seq": 2, "success": True, "latency_ms": 14.2},
            {"seq": 3, "success": True, "latency_ms": 11.8},
            {"seq": 4, "success": False, "timeout": True, "latency_ms": 3000},
            {"seq": 5, "success": True, "latency_ms": 13.0},
        ]
        run1 = MetricsAggregator.from_raw_observations(raw)
        run2 = MetricsAggregator.from_raw_observations(raw)
        self.assertEqual(run1, run2)
        self.assertEqual(run1["successful_probes"], 4)
        self.assertEqual(run1["failed_probes"], 1)

    # 8. RTO boundary exactness (recovery exactly at target meets RTO)
    def test_invariant_08_rto_exact_target_met(self):
        baseline = {
            "available": True, "healthy": True, "availability_percent": 100.0,
            "mean_latency_ms": 10.0, "p95_latency_ms": 12.0, "connection_errors_count": 0, "http_5xx_count": 0
        }
        exp = {
            "probes_count": 5, "availability_percent": 100.0, "latency_multiplier": 1.0,
            "connection_errors_count": 0, "http_5xx_count": 0
        }
        recovery_exact = {
            "recovered": True, "recovery_time_seconds": 5.000,
            "rto_target_seconds": 5.0, "rto_target_met": True
        }
        res = HypothesisEvaluator.evaluate("container_restart", baseline, exp, recovery_exact)
        self.assertEqual(res["verdict"], "VALIDATED")

    # 9. RTO exceeded by 1ms fails target
    def test_invariant_09_rto_exceeded_by_1ms_violates_target(self):
        baseline = {
            "available": True, "healthy": True, "availability_percent": 100.0,
            "mean_latency_ms": 10.0, "p95_latency_ms": 12.0, "connection_errors_count": 0, "http_5xx_count": 0
        }
        exp = {
            "probes_count": 5, "availability_percent": 100.0, "latency_multiplier": 1.0,
            "connection_errors_count": 0, "http_5xx_count": 0
        }
        recovery_exceeded = {
            "recovered": True, "recovery_time_seconds": 5.001,
            "rto_target_seconds": 5.0, "rto_target_met": False
        }
        res = HypothesisEvaluator.evaluate("container_restart", baseline, exp, recovery_exceeded)
        self.assertIn(res["verdict"], ("PARTIALLY VALIDATED", "PARTIALLY_VALIDATED", "VIOLATED"))

    # 10. Missing recovery observations produce INCONCLUSIVE verdict
    def test_invariant_10_missing_recovery_produces_inconclusive(self):
        baseline = {
            "available": True, "healthy": True, "availability_percent": 100.0,
            "mean_latency_ms": 10.0, "p95_latency_ms": 12.0, "connection_errors_count": 0, "http_5xx_count": 0
        }
        exp = {
            "probes_count": 5, "availability_percent": 100.0, "latency_multiplier": 1.0,
            "connection_errors_count": 0, "http_5xx_count": 0
        }
        recovery_missing = {
            "recovered": False, "recovery_time_seconds": None,
            "rto_target_seconds": 5.0, "rto_target_met": None, "recovery_status": "INCONCLUSIVE"
        }
        res = HypothesisEvaluator.evaluate("container_restart", baseline, exp, recovery_missing)
        self.assertEqual(res["verdict"], "INCONCLUSIVE")

    # 11. Finding detector: 3-sigma transient spike detection
    def test_invariant_11_transient_spike_detected(self):
        baseline = {
            "available": True, "healthy": True, "availability_percent": 100.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0, "p50_latency_ms": 10.0,
            "p95_latency_ms": 12.0, "connection_errors_count": 0, "http_5xx_count": 0
        }
        exp = {
            "probes_count": 10, "availability_percent": 100.0, "avg_latency_ms": 12.0,
            "mean_latency_ms": 12.0, "p50_latency_ms": 10.0, "p95_latency_ms": 15.0,
            "latency_multiplier": 1.2, "failed_probes": 0, "successful_probes": 10,
            "connection_errors_count": 0, "http_5xx_count": 0, "sample_errors": [],
            "anomaly_summary": {
                "spike_count": 2,
                "peak_impact": {"peak_latency_ms": 95.0, "percentage_delta": 850},
                "failure_bursts": [],
                "max_consecutive_failures": 0,
            }
        }
        recovery = {"recovered": True, "recovery_time_seconds": 0.4, "rto_target_seconds": 5.0, "rto_target_met": True}
        findings = FindingDetector.detect_findings("cpu_stress", "web", baseline, exp, recovery, True)
        finding_ids = [f["id"] for f in findings]
        self.assertIn("F-SPIKE-TRANSIENT", finding_ids)

    # 12. Recommendation deduplication across collective reports
    def test_invariant_12_recommendation_deduplication(self):
        experiments = [
            {
                "id": 1, "fault_type": "container_restart", "target": "api", "status": "completed",
                "resilience_score": 75, "resilience_grade": "B",
                "result": {
                    "structured_recommendations": [
                        {"title": "Implement Healthcheck Draining", "priority": "High", "action": "Add SIGTERM handler"},
                        {"title": "Add Circuit Breaker", "priority": "Medium", "action": "Wrap client calls"},
                    ]
                }
            },
            {
                "id": 2, "fault_type": "container_stop", "target": "api", "status": "completed",
                "resilience_score": 70, "resilience_grade": "B",
                "result": {
                    "structured_recommendations": [
                        {"title": "Implement Healthcheck Draining", "priority": "High", "action": "Add SIGTERM handler"},
                        {"title": "Tune Timeout Window", "priority": "Low", "action": "Increase HTTP timeout to 5s"},
                    ]
                }
            },
        ]
        collective = CollectiveReportAggregator.aggregate({"title": "Test Proj"}, experiments)
        recs = collective["consolidated_recommendations"]
        titles = [r["title"] for r in recs]
        # Should be deduplicated: "Implement Healthcheck Draining" appears only once with occurrences = 2
        self.assertEqual(len(titles), len(set(titles)))
        draining = next(r for r in recs if r["title"] == "Implement Healthcheck Draining")
        self.assertEqual(draining["occurrences"], 2)
