import unittest
from unittest.mock import MagicMock, patch

from noir.faults import registry, SUPPORTED_FAULTS
from noir.faults.executors import (
    ContainerRestartExecutor,
    ContainerStopExecutor,
    NetworkDelayExecutor,
    NetworkLossExecutor,
    CpuStressExecutor,
    MemoryStressExecutor,
)
from noir.faults.base import FaultResult


class TestFaultRegistry(unittest.TestCase):
    def test_all_six_faults_registered(self):
        expected = {
            "container_restart",
            "container_stop",
            "network_delay",
            "network_loss",
            "cpu_stress",
            "memory_stress",
        }
        self.assertEqual(set(SUPPORTED_FAULTS), expected)
        for name in expected:
            self.assertTrue(registry.is_supported(name))
            self.assertIsNotNone(registry.get(name))

    def test_unsupported_fault_rejected(self):
        self.assertFalse(registry.is_supported("arbitrary_exec"))
        self.assertFalse(registry.is_supported("rm_rf"))
        self.assertIsNone(registry.get("invalid_fault"))


class TestParameterValidation(unittest.TestCase):
    def test_container_restart_params(self):
        executor = ContainerRestartExecutor()
        val = executor.validate_parameters({"timeout": 15})
        self.assertEqual(val["timeout"], 15)

        # Default fallback
        val_default = executor.validate_parameters({})
        self.assertEqual(val_default["timeout"], 10)

        # Invalid bounds
        with self.assertRaises(ValueError):
            executor.validate_parameters({"timeout": 0})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"timeout": 100})

    def test_network_delay_params(self):
        executor = NetworkDelayExecutor()
        val = executor.validate_parameters({
            "latency_ms": 300,
            "jitter_ms": 20,
            "duration": 5,
        })
        self.assertEqual(val["latency_ms"], 300)
        self.assertEqual(val["jitter_ms"], 20)
        self.assertEqual(val["duration"], 5)

        # Out of bounds
        with self.assertRaises(ValueError):
            executor.validate_parameters({"latency_ms": 6000})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"jitter_ms": -1})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"duration": 400})

    def test_network_loss_params(self):
        executor = NetworkLossExecutor()
        val = executor.validate_parameters({"loss_percent": 15.5, "duration": 8})
        self.assertEqual(val["loss_percent"], 15.5)
        self.assertEqual(val["duration"], 8)

        with self.assertRaises(ValueError):
            executor.validate_parameters({"loss_percent": 0})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"loss_percent": 105})

    def test_cpu_stress_params(self):
        executor = CpuStressExecutor()
        val = executor.validate_parameters({"workers": 4, "duration": 12})
        self.assertEqual(val["workers"], 4)
        self.assertEqual(val["duration"], 12)

        with self.assertRaises(ValueError):
            executor.validate_parameters({"workers": 0})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"workers": 32})

    def test_memory_stress_params(self):
        executor = MemoryStressExecutor()
        val = executor.validate_parameters({"memory_mb": 512, "duration": 15})
        self.assertEqual(val["memory_mb"], 512)
        self.assertEqual(val["duration"], 15)

        with self.assertRaises(ValueError):
            executor.validate_parameters({"memory_mb": 10})
        with self.assertRaises(ValueError):
            executor.validate_parameters({"memory_mb": 10000})


class TestExecutorExecutionWithMocks(unittest.TestCase):
    def setUp(self):
        self.mock_docker = MagicMock()

    def test_restart_execution_success(self):
        executor = ContainerRestartExecutor()
        self.mock_docker.restart_container.return_value = {
            "container_name": "web",
            "restarted": True,
            "status": "running",
            "running": True,
        }

        res: FaultResult = executor.execute(self.mock_docker, "web", {"timeout": 10})
        self.assertTrue(res.success)
        self.assertTrue(res.recovered)
        self.mock_docker.restart_container.assert_called_once_with("web", timeout=10)

    def test_restart_execution_failure(self):
        executor = ContainerRestartExecutor()
        self.mock_docker.restart_container.side_effect = RuntimeError("Container crashed")

        res: FaultResult = executor.execute(self.mock_docker, "web", {"timeout": 10})
        self.assertFalse(res.success)
        self.assertIn("Container crashed", res.error)

    @patch("time.sleep")
    def test_stop_execution_and_recovery(self, mock_sleep):
        executor = ContainerStopExecutor()
        self.mock_docker.stop_container.return_value = {"container_name": "redis", "stopped": True, "running": False}
        self.mock_docker.start_container.return_value = {"container_name": "redis", "started": True, "running": True}

        res: FaultResult = executor.execute(self.mock_docker, "redis", {"duration": 5, "timeout": 10})
        self.assertTrue(res.success)
        self.assertTrue(res.recovered)
        self.mock_docker.stop_container.assert_called_once_with("redis", timeout=10)
        self.mock_docker.start_container.assert_called_once_with("redis")

    @patch("time.sleep")
    def test_network_delay_execution_and_rollback(self, mock_sleep):
        executor = NetworkDelayExecutor()
        self.mock_docker.apply_network_delay.return_value = {"applied": True}
        self.mock_docker.remove_network_delay.return_value = True

        res: FaultResult = executor.execute(
            self.mock_docker, "app", {"latency_ms": 200, "jitter_ms": 20, "duration": 5}
        )
        self.assertTrue(res.success)
        self.mock_docker.apply_network_delay.assert_called_once()
        self.mock_docker.remove_network_delay.assert_called_once_with("app", interface="eth0")

    @patch("time.sleep")
    def test_network_loss_execution(self, mock_sleep):
        executor = NetworkLossExecutor()
        self.mock_docker.apply_network_loss.return_value = {"applied": True}
        self.mock_docker.remove_network_delay.return_value = True

        res: FaultResult = executor.execute(
            self.mock_docker, "app", {"loss_percent": 10, "duration": 5}
        )
        self.assertTrue(res.success)
        self.mock_docker.apply_network_loss.assert_called_once()
        self.mock_docker.remove_network_delay.assert_called_once()

    def test_cpu_stress_execution(self):
        executor = CpuStressExecutor()
        self.mock_docker.apply_cpu_stress.return_value = {"exit_code": 0}

        res: FaultResult = executor.execute(self.mock_docker, "worker", {"workers": 2, "duration": 5})
        self.assertTrue(res.success)
        self.mock_docker.apply_cpu_stress.assert_called_once_with("worker", workers=2, duration_sec=5)

    def test_memory_stress_execution(self):
        executor = MemoryStressExecutor()
        self.mock_docker.apply_memory_stress.return_value = {"exit_code": 0}

        res: FaultResult = executor.execute(self.mock_docker, "worker", {"memory_mb": 128, "duration": 5})
        self.assertTrue(res.success)
        self.mock_docker.apply_memory_stress.assert_called_once_with("worker", memory_mb=128, duration_sec=5)


if __name__ == "__main__":
    unittest.main()
