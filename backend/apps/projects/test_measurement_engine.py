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

    def test_experiment_76_no_probe_produces_inconclusive_score(self):
        """Experiment #76: Missing probe data MUST NOT produce a numeric score or 0.0s recovery."""
        from apps.projects.chaos_reporting import generate_experiment_report

        class MockFault:
            id = 76
            fault_type = "cpu_stress"
            target = "worker"
            status = "completed"
            parameters = {"duration": 60, "workers": 2, "rto_target_seconds": 5.0}
            result = {
                "message": "CPU stress completed",
                "resilience": {"evidence_sufficient": False, "score": None, "grade": "INCONCLUSIVE"},
                "steady_state_baseline": {"available": False, "probes_count": 0},
                "experiment_metrics": {"probes_count": 0, "availability_percent": None},
                "recovery_metrics": {
                    "recovery_status": "INCONCLUSIVE",
                    "recovery_time_seconds": None,
                    "recovery_probe_count": 0,
                },
            }

        report = generate_experiment_report(MockFault())
        self.assertIsNone(report["score_summary"]["score"], "Score must be None when no probe evidence exists")
        self.assertEqual(report["score_summary"]["grade"], "INCONCLUSIVE")
        self.assertIsNone(report["recovery"]["recovery_time_seconds"], "Recovery time must be None, NOT 0.0s")
        self.assertEqual(report["recovery"]["recovery_status"], "INCONCLUSIVE")
        self.assertIsNone(report["recovery"]["rto_target_met"], "RTO met must be None, NOT False/True")
        finding_ids = [f["id"] for f in report["findings"]]
        self.assertIn("F-PROBE-NONE", finding_ids)

    def test_network_latency_amplification_detected(self):
        """Experiments #77, #78, #80: Configured +50ms delay with 150ms observed delta triggers amplification finding."""
        exp = {
            "probes_count": 15,
            "availability_percent": 100.0,
            "mean_latency_ms": 160.0, "avg_latency_ms": 160.0,
            "p50_latency_ms": 155.0, "p95_latency_ms": 175.0,
            "latency_multiplier": 16.0,
            "failed_probes": 0, "successful_probes": 15,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        params = {"latency_ms": 50.0}
        findings = FindingDetector.detect_findings(
            "network_delay", "api", self._base_baseline(), exp, self._base_recovery(), True, parameters=params
        )
        amp_finding = next((f for f in findings if f["id"] == "CONFIGURED_IMPAIRMENT_VS_OBSERVED_IMPACT"), None)
        self.assertIsNotNone(amp_finding, "Network amplification finding must be generated")
        self.assertEqual(amp_finding["metrics"]["configured_latency_ms"], 50.0)
        self.assertEqual(amp_finding["metrics"]["amplification_ratio"], 3.0)
        self.assertIn("Further investigation is required", amp_finding["suggested_investigation"])

    def test_short_duration_under_sampling_detected(self):
        """Experiment #82: A short fault duration relative to probe interval triggers F-UNDER-SAMPLED."""
        exp = {
            "probes_count": 1,
            "availability_percent": 100.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0,
            "p50_latency_ms": 10.0, "p95_latency_ms": 10.0,
            "latency_multiplier": 1.0,
            "failed_probes": 0, "successful_probes": 1,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [],
            "observability_coverage": {
                "fault_duration": 0.318,
                "probe_interval": 1.0,
                "under_sampled": True,
            },
        }
        findings = FindingDetector.detect_findings(
            "container_restart", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        finding_ids = [f["id"] for f in findings]
        self.assertIn("F-UNDER-SAMPLED", finding_ids)

    def test_sustained_latency_shift_detected(self):
        """Experiment #78: Consistent elevation is classified as F-LAT-SUSTAINED, not transient spikes."""
        exp = {
            "probes_count": 28,
            "availability_percent": 100.0,
            "avg_latency_ms": 160.0, "mean_latency_ms": 160.0,
            "p50_latency_ms": 158.0, "p95_latency_ms": 170.0,
            "latency_multiplier": 16.0,
            "failed_probes": 0, "successful_probes": 28,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [],
            "anomaly_summary": {
                "sustained_degradation_detected": True,
                "sustained_ratio": 1.0,
                "sustained_sample_count": 28,
                "spike_count": 28,
            },
        }
        findings = FindingDetector.detect_findings(
            "network_delay", "web", self._base_baseline(), exp, self._base_recovery(), True
        )
        finding_ids = [f["id"] for f in findings]
        self.assertIn("F-LAT-SUSTAINED", finding_ids)
        self.assertNotIn("F-SPIKE-TRANSIENT", finding_ids, "Sustained degradation must suppress independent spikes")

    def test_resource_pressure_ineffective_findings(self):
        """Experiments #79, #81: Ineffective CPU / low memory pressure triggers experiment quality findings."""
        exp = {
            "probes_count": 5, "availability_percent": 100.0,
            "avg_latency_ms": 10.0, "mean_latency_ms": 10.0,
            "p50_latency_ms": 10.0, "p95_latency_ms": 11.0,
            "latency_multiplier": 1.0, "failed_probes": 0, "successful_probes": 5,
            "connection_errors_count": 0, "http_5xx_count": 0,
            "sample_errors": [], "anomaly_summary": {},
        }
        # Ineffective CPU stress
        findings_cpu = FindingDetector.detect_findings(
            "cpu_stress", "worker", self._base_baseline(), exp, self._base_recovery(), True,
            telemetry={"cpu_delta": 2.0}
        )
        self.assertIn("F-CPU-INEFFECTIVE", [f["id"] for f in findings_cpu])

        # Low memory pressure
        findings_mem = FindingDetector.detect_findings(
            "memory_stress", "worker", self._base_baseline(), exp, self._base_recovery(), True,
            telemetry={"memory_pressure_ratio": 0.02}
        )
        self.assertIn("F-MEMORY-LOW-PRESSURE", [f["id"] for f in findings_mem])

    def test_sub_second_rto_precision_boundary(self):
        """Part 5: Recovery at 5.0001s with RTO 5.0000s is marked EXCEEDED without rounding down."""
        from apps.projects.chaos_reporting import generate_experiment_report

        class MockPrecisionFault:
            id = 80
            fault_type = "network_delay"
            target = "gateway"
            status = "completed"
            parameters = {"rto_target_seconds": 5.0}
            result = {
                "resilience": {"score": 85, "grade": "B", "evidence_sufficient": True},
                "steady_state_baseline": {"available": True, "probes_count": 10, "avg_latency_ms": 10.0},
                "experiment_metrics": {"probes_count": 10, "availability_percent": 100.0, "avg_latency_ms": 50.0},
                "recovery_metrics": {
                    "recovery_status": "RECOVERED",
                    "recovery_time_seconds": 5.0001,
                    "rto_target_seconds": 5.0,
                    "recovery_probe_count": 5,
                    "recovered": True,
                },
            }

        report = generate_experiment_report(MockPrecisionFault())
        self.assertFalse(report["recovery"]["rto_target_met"], "5.0001s must exceed 5.0s target")
        self.assertEqual(report["recovery"]["rto_status"], "VIOLATED")
        self.assertAlmostEqual(report["recovery"]["rto_delta_seconds"], 0.0001, places=4)
