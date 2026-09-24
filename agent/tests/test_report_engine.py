import unittest
import sys
import os

# Add backend directory to sys.path so we can import apps.projects.chaos_reporting
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from apps.projects.chaos_reporting import (
    MetricsAggregator,
    HypothesisEvaluator,
    FindingDetector,
    RootCauseIndicator,
    RecommendationEngine,
    CollectiveReportAggregator,
    generate_experiment_report,
)


class TestMetricsAggregator(unittest.TestCase):
    def test_percentile_calculation(self):
        data = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
        percentiles = MetricsAggregator.calculate_percentiles(data)

        self.assertAlmostEqual(percentiles["p50"], 50.0, delta=10.0)
        self.assertGreaterEqual(percentiles["p95"], 90.0)
        self.assertGreaterEqual(percentiles["p99"], 95.0)
        self.assertEqual(percentiles["min"], 10.0)
        self.assertEqual(percentiles["max"], 100.0)

    def test_percentile_empty(self):
        res = MetricsAggregator.calculate_percentiles([])
        self.assertEqual(res["p50"], 0.0)
        self.assertEqual(res["mean"], 0.0)

    def test_calculate_percentage_change_safe_zero_division(self):
        res = MetricsAggregator.calculate_percentage_change(0.0, 5.0, higher_is_better=False)
        self.assertIn("baseline was 0", res["display"])
        self.assertEqual(res["direction"], "bad")
        self.assertIsNone(res["change_pct"])

    def test_calculate_percentage_change_higher_is_better(self):
        # Availability dropped from 100 to 80
        res = MetricsAggregator.calculate_percentage_change(100.0, 80.0, higher_is_better=True)
        self.assertEqual(res["change_pct"], -20.0)
        self.assertEqual(res["direction"], "bad")

        # Availability improved from 80 to 100
        res_up = MetricsAggregator.calculate_percentage_change(80.0, 100.0, higher_is_better=True)
        self.assertEqual(res_up["change_pct"], 25.0)
        self.assertEqual(res_up["direction"], "good")

    def test_calculate_percentage_change_lower_is_better(self):
        # Latency surged from 50ms to 150ms (+200%)
        res = MetricsAggregator.calculate_percentage_change(50.0, 150.0, higher_is_better=False)
        self.assertEqual(res["change_pct"], 200.0)
        self.assertEqual(res["direction"], "bad")


class TestHypothesisEvaluator(unittest.TestCase):
    def setUp(self):
        self.baseline = {
            "available": True,
            "availability_percent": 100.0,
            "mean_latency_ms": 25.0,
            "p95_latency_ms": 30.0,
            "connection_errors_count": 0,
            "http_5xx_count": 0,
        }
        self.good_recovery = {
            "recovered": True,
            "recovery_time_seconds": 2.1,
            "rto_target_seconds": 5.0,
            "rto_target_met": True,
        }

    def test_hypothesis_validated(self):
        exp = {
            "probes_count": 15,
            "availability_percent": 100.0,
            "latency_multiplier": 1.2,
            "connection_errors_count": 0,
            "http_5xx_count": 0,
        }
        res = HypothesisEvaluator.evaluate(
            fault_type="cpu_stress",
            baseline_metrics=self.baseline,
            experiment_metrics=exp,
            recovery_metrics=self.good_recovery,
        )
        self.assertEqual(res["verdict"], "VALIDATED")
        self.assertIn("verdict_reason", res)

    def test_hypothesis_violated(self):
        exp = {
            "probes_count": 15,
            "availability_percent": 40.0,
            "latency_multiplier": 6.5,
            "connection_errors_count": 8,
            "http_5xx_count": 2,
        }
        bad_rec = {
            "recovered": False,
            "recovery_time_seconds": 15.0,
            "rto_target_seconds": 5.0,
            "rto_target_met": False,
        }
        res = HypothesisEvaluator.evaluate(
            fault_type="container_stop",
            baseline_metrics=self.baseline,
            experiment_metrics=exp,
            recovery_metrics=bad_rec,
        )
        self.assertEqual(res["verdict"], "VIOLATED")

    def test_hypothesis_inconclusive_when_no_baseline(self):
        no_baseline = {"available": False, "availability_percent": 0.0}
        exp = {"probes_count": 0, "availability_percent": 0.0}
        res = HypothesisEvaluator.evaluate(
            fault_type="network_delay",
            baseline_metrics=no_baseline,
            experiment_metrics=exp,
            recovery_metrics=self.good_recovery,
        )
        self.assertEqual(res["verdict"], "INCONCLUSIVE")


class TestFindingDetectorAndRootCause(unittest.TestCase):
    def test_detect_findings_and_anomalies(self):
        baseline = {"available": True, "availability_percent": 100.0, "avg_latency_ms": 20.0}
        exp = {
            "probes_count": 10,
            "availability_percent": 0.0,
            "p95_latency_ms": 800.0,
            "latency_multiplier": 8.0,
            "connection_errors_count": 5,
            "http_5xx_count": 2,
        }
        recovery = {
            "recovered": False,
            "recovery_time_seconds": 12.0,
            "rto_target_seconds": 5.0,
            "rto_target_met": False,
        }

        findings = FindingDetector.detect_findings(
            fault_type="container_restart",
            target="web-app",
            baseline=baseline,
            experiment=exp,
            recovery=recovery,
            rollback_success=False,
        )

        finding_ids = {f["id"] for f in findings}
        self.assertIn("F-AVAIL-CRIT", finding_ids)
        self.assertIn("F-LAT-SPIKE", finding_ids)
        self.assertIn("F-CONN-DROP", finding_ids)
        self.assertIn("F-REC-FAIL", finding_ids)
        self.assertIn("F-ROLLBACK-FAIL", finding_ids)

        anomalies = FindingDetector.detect_anomalies(
            baseline=baseline,
            experiment=exp,
            recovery=recovery,
        )
        self.assertGreater(len(anomalies), 0)

        # Root Cause Indicators
        root_causes = RootCauseIndicator.infer_root_causes(
            fault_type="container_restart",
            target="web-app",
            findings=findings,
            experiment=exp,
            recovery=recovery,
        )
        self.assertGreater(len(root_causes), 0)
        self.assertTrue(any("Drain" in rc["issue"] or "Readiness" in rc["issue"] or "Point of Failure" in rc["issue"] for rc in root_causes))


class TestRecommendationEngine(unittest.TestCase):
    def test_recommendations_paired_with_next_experiment(self):
        findings = [
            {"id": "F-AVAIL-CRIT", "severity": "Critical"},
            {"id": "F-CONN-DROP", "severity": "High"},
        ]
        recs = RecommendationEngine.generate_recommendations(
            fault_type="container_restart",
            target="payment-service",
            findings=findings,
            root_causes=[],
        )

        self.assertGreater(len(recs), 0)
        for rec in recs:
            self.assertIn("title", rec)
            self.assertIn("priority", rec)
            self.assertIn("action", rec)
            self.assertIn("reason", rec)
            self.assertIn("next_experiment", rec)
            next_exp = rec["next_experiment"]
            self.assertIn("fault_type", next_exp)
            self.assertIn("target", next_exp)
            self.assertIn("goal", next_exp)
            self.assertIn("command", next_exp)
            self.assertTrue(next_exp["command"].startswith("noir fault inject"))


class TestCollectiveReportAggregator(unittest.TestCase):
    def test_aggregate_project_faults(self):
        project_data = {"id": 1, "title": "DormCare", "connection_code": "DC-100"}
        experiments = [
            {
                "id": 101,
                "fault_type": "container_restart",
                "target": "web-server",
                "status": "completed",
                "resilience_score": 55,
                "resilience_grade": "F",
                "result": {
                    "experiment_metrics": {
                        "availability_percent": 60.0,
                        "p95_latency_ms": 650.0,
                        "latency_multiplier": 5.0,
                        "connection_errors_count": 4,
                    },
                    "recovery_metrics": {
                        "recovered": True,
                        "recovery_time_seconds": 9.5,
                        "rto_target_seconds": 5.0,
                    },
                    "hypothesis_evaluation": {"verdict": "VIOLATED"},
                    "structured_recommendations": [
                        {
                            "title": "Deploy Redundant Replicas for 'web-server'",
                            "category": "High Availability",
                            "priority": "High",
                            "reason": "Single point of failure",
                            "action": "Add second replica",
                            "next_experiment": {
                                "fault_type": "container_stop",
                                "target": "web-server",
                                "goal": "Validate failover",
                                "command": "noir fault inject container_stop web-server",
                            },
                        }
                    ],
                },
            },
            {
                "id": 102,
                "fault_type": "container_stop",
                "target": "web-server",
                "status": "completed",
                "resilience_score": 60,
                "resilience_grade": "C",
                "result": {
                    "experiment_metrics": {
                        "availability_percent": 75.0,
                        "p95_latency_ms": 720.0,
                        "latency_multiplier": 4.8,
                        "connection_errors_count": 3,
                    },
                    "recovery_metrics": {
                        "recovered": True,
                        "recovery_time_seconds": 9.0,
                        "rto_target_seconds": 5.0,
                    },
                    "hypothesis_evaluation": {"verdict": "VIOLATED"},
                    "structured_recommendations": [
                        {
                            "title": "Deploy Redundant Replicas for 'web-server'",
                            "category": "High Availability",
                            "priority": "High",
                            "reason": "Single point of failure",
                            "action": "Add second replica",
                            "next_experiment": {
                                "fault_type": "container_stop",
                                "target": "web-server",
                                "goal": "Validate failover",
                                "command": "noir fault inject container_stop web-server",
                            },
                        }
                    ],
                },
            },
        ]

        collective = CollectiveReportAggregator.aggregate(project_data, experiments)

        self.assertEqual(collective["summary"]["total_experiments"], 2)
        self.assertEqual(collective["summary"]["hypotheses_violated"], 2)
        self.assertEqual(collective["summary"]["rto_violations_count"], 2)

        # Outlier Detection
        self.assertEqual(len(collective["outliers"]), 2)

        # Cross-Experiment Pattern Detection (2 experiments had connection drops and RTO exceeded)
        patterns = collective["cross_experiment_patterns"]
        self.assertGreaterEqual(len(patterns), 2)

        # Consolidated Recommendations (Deduplicated)
        recs = collective["consolidated_recommendations"]
        self.assertEqual(len(recs), 1)
        self.assertEqual(recs[0]["occurrences"], 2)

        # Follow-Up Roadmap
        roadmap = collective["follow_up_roadmap"]
        self.assertEqual(len(roadmap), 1)


if __name__ == "__main__":
    unittest.main()
