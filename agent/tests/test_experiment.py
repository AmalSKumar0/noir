import time
import unittest
from unittest.mock import MagicMock, patch

from noir.faults.experiment import (
    ChaosProbe,
    ProbeResult,
    SteadyStateEvaluator,
    ResilienceScorer,
)
from noir.faults.docker import DockerManager


class TestChaosProbe(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_probe_urllib_success(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        # Force HAS_HTTPX = False to test standard urllib probe
        with patch("noir.faults.experiment.HAS_HTTPX", False):
            res = ChaosProbe.probe("http://localhost:8000/health", timeout_sec=2.0)

        self.assertTrue(res.success)
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.latency_ms, 0)
        self.assertIsNone(res.error)

    @patch("urllib.request.urlopen")
    def test_probe_urllib_unexpected_status(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 503
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch("noir.faults.experiment.HAS_HTTPX", False):
            res = ChaosProbe.probe("http://localhost:8000/health", expected_status=200)

        self.assertFalse(res.success)
        self.assertEqual(res.status_code, 503)

    @patch("urllib.request.urlopen", side_effect=Exception("Connection refused"))
    def test_probe_connection_error(self, mock_urlopen):
        with patch("noir.faults.experiment.HAS_HTTPX", False):
            res = ChaosProbe.probe("http://localhost:8000/health")

        self.assertFalse(res.success)
        self.assertIsNone(res.status_code)
        self.assertIn("Connection refused", str(res.error))


class TestSteadyStateEvaluator(unittest.TestCase):
    def test_measure_baseline_without_url(self):
        evaluator = SteadyStateEvaluator(probe_url=None)
        baseline = evaluator.measure_baseline()
        self.assertFalse(baseline["available"])

    @patch.object(ChaosProbe, "probe")
    def test_measure_baseline_healthy(self, mock_probe):
        mock_probe.side_effect = [
            ProbeResult(timestamp=100.0, status_code=200, latency_ms=10.0, success=True),
            ProbeResult(timestamp=100.5, status_code=200, latency_ms=20.0, success=True),
            ProbeResult(timestamp=101.0, status_code=200, latency_ms=30.0, success=True),
        ]

        evaluator = SteadyStateEvaluator(probe_url="http://localhost:8000/health")
        baseline = evaluator.measure_baseline(count=3, interval=0.01)

        self.assertTrue(baseline["available"])
        self.assertTrue(baseline["healthy"])
        self.assertEqual(baseline["success_rate_percent"], 100.0)
        self.assertEqual(baseline["avg_latency_ms"], 20.0)
        self.assertEqual(baseline["probes_count"], 3)

    @patch.object(ChaosProbe, "probe")
    def test_in_fault_experiment_probing(self, mock_probe):
        mock_probe.return_value = ProbeResult(
            timestamp=100.0, status_code=200, latency_ms=50.0, success=True
        )

        evaluator = SteadyStateEvaluator(probe_url="http://localhost:8000/health")
        evaluator.baseline = {"avg_latency_ms": 25.0, "available": True}

        evaluator.start_in_fault_probing(interval_sec=0.03)
        time.sleep(0.12)
        metrics = evaluator.stop_in_fault_probing()

        self.assertGreaterEqual(metrics["probes_count"], 2)
        self.assertEqual(metrics["availability_percent"], 100.0)
        self.assertEqual(metrics["avg_latency_ms"], 50.0)
        self.assertEqual(metrics["latency_multiplier"], 2.0)

    @patch.object(ChaosProbe, "probe")
    def test_measure_recovery_success(self, mock_probe):
        mock_probe.side_effect = [
            ProbeResult(timestamp=100.0, status_code=None, latency_ms=0, success=False, error="Refused"),
            ProbeResult(timestamp=100.2, status_code=200, latency_ms=15.0, success=True),
        ]

        evaluator = SteadyStateEvaluator(probe_url="http://localhost:8000/health")
        rec = evaluator.measure_recovery(max_wait_sec=2.0, poll_interval=0.02)

        self.assertTrue(rec["recovered"])
        self.assertFalse(rec["timed_out"])
        self.assertGreater(rec["rto_seconds"], 0)


class TestResilienceScorer(unittest.TestCase):
    def test_perfect_resilience_grade_a(self):
        baseline = {
            "available": True,
            "avg_latency_ms": 20.0,
            "success_rate_percent": 100.0,
            "healthy": True,
        }
        exp_metrics = {
            "probes_count": 5,
            "successful_probes": 5,
            "failed_probes": 0,
            "availability_percent": 100.0,
            "avg_latency_ms": 22.0,
            "p95_latency_ms": 25.0,
            "latency_multiplier": 1.1,
            "sample_errors": [],
        }
        rec_metrics = {
            "rto_seconds": 0.2,
            "recovered": True,
            "timed_out": False,
        }

        res = ResilienceScorer.calculate_score(
            fault_type="cpu_stress",
            baseline=baseline,
            experiment_metrics=exp_metrics,
            recovery_metrics=rec_metrics,
            rollback_success=True,
        )

        self.assertGreaterEqual(res["score"], 90.0)
        self.assertEqual(res["grade"], "A")
        self.assertEqual(res["classification"], "Resilient (Production Grade)")
        self.assertTrue(res["has_probe"])

    def test_complete_outage_grade_f(self):
        baseline = {
            "available": True,
            "avg_latency_ms": 15.0,
            "success_rate_percent": 100.0,
            "healthy": True,
        }
        exp_metrics = {
            "probes_count": 5,
            "successful_probes": 0,
            "failed_probes": 5,
            "availability_percent": 0.0,
            "avg_latency_ms": 0.0,
            "p95_latency_ms": 0.0,
            "latency_multiplier": 0.0,
            "sample_errors": ["HTTP 500"],
        }
        rec_metrics = {
            "rto_seconds": 15.0,
            "recovered": False,
            "timed_out": True,
        }

        res = ResilienceScorer.calculate_score(
            fault_type="container_stop",
            baseline=baseline,
            experiment_metrics=exp_metrics,
            recovery_metrics=rec_metrics,
            rollback_success=False,
        )

        self.assertLess(res["score"], 50.0)
        self.assertEqual(res["grade"], "F")
        self.assertEqual(res["classification"], "Fragile / High Risk")
        self.assertTrue(len(res["recommendations"]) > 0)
        joined_recs = " ".join(res["recommendations"])
        self.assertIn("replicas", joined_recs.lower())

    def test_fallback_score_without_probe(self):
        res = ResilienceScorer.calculate_score(
            fault_type="network_delay",
            baseline=None,
            experiment_metrics=None,
            recovery_metrics=None,
            rollback_success=True,
        )
        self.assertEqual(res["score"], 80)
        self.assertEqual(res["grade"], "B")
        self.assertFalse(res["has_probe"])

    def test_auto_detect_container_endpoint(self):
        with patch("docker.from_env"):
            mgr = DockerManager()
        mock_container = MagicMock()
        mock_container.attrs = {
            "NetworkSettings": {
                "Ports": {
                    "8000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}],
                    "3306/tcp": [{"HostIp": "0.0.0.0", "HostPort": "3306"}],
                }
            }
        }
        with patch.object(mgr, "find_container", return_value=mock_container):
            endpoint = mgr.get_container_endpoint("my_container")
            self.assertEqual(endpoint, "http://localhost:8080/")


if __name__ == "__main__":
    unittest.main()
