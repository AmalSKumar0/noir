import threading
import time
from unittest.mock import MagicMock, patch
import pytest

from noir.commands.fault import _execute_single_fault, LogBatcher
from noir.faults.base import FaultResult, FaultExecutor
from noir.faults import registry


class TestFaultLifecycleSafety:

    def test_cancellation_before_execution_aborts_cleanly(self):
        client = MagicMock()
        docker_mgr = MagicMock()
        docker_mgr.get_container_endpoint.return_value = None
        cancel_event = threading.Event()
        cancel_event.set()  # Cancelled before running

        fault_payload = {
            "id": 999,
            "fault_type": "cpu_stress",
            "target": "web-container",
            "parameters": {"duration": 10, "workers": 2},
        }

        with patch.object(registry, "get") as mock_get_executor:
            _execute_single_fault(
                fault=fault_payload,
                project_id="PROJ-123",
                client=client,
                docker_mgr=docker_mgr,
                cancel_event=cancel_event,
            )
            # Executor should NOT have been invoked
            mock_get_executor.assert_not_called()

        # Should have claimed and then sent report with cancelled status
        claim_calls = [c for c in client.send_request_to_backend.call_args_list if "claim" in c[0][0]]
        assert len(claim_calls) >= 1

        report_calls = [c for c in client.send_request_to_backend.call_args_list if "report" in c[0][0]]
        assert len(report_calls) >= 1
        assert report_calls[0][1]["data"]["status"] == "cancelled"

    def test_log_batcher_flushes_and_handles_network_error(self):
        client = MagicMock()
        client.send_request_to_backend.side_effect = Exception("Network blip")

        batcher = LogBatcher(client, "PROJ-1", 100, max_batch_size=2, flush_interval=0.1)
        batcher.add("INFO", "Log message 1")
        batcher.add("INFO", "Log message 2")

        # Even with network exception in batch endpoint, it shouldn't crash
        batcher.flush()
        batcher.close()

    def test_unsupported_fault_type_fails_gracefully(self):
        client = MagicMock()
        docker_mgr = MagicMock()
        docker_mgr.get_container_endpoint.return_value = None
        cancel_event = threading.Event()

        fault_payload = {
            "id": 1001,
            "fault_type": "unsupported_chaos_type",
            "target": "web",
            "parameters": {},
        }

        _execute_single_fault(
            fault=fault_payload,
            project_id="PROJ-1",
            client=client,
            docker_mgr=docker_mgr,
            cancel_event=cancel_event,
        )

        # Should have sent failed report
        report_calls = [c for c in client.send_request_to_backend.call_args_list if "report" in c[0][0]]
        assert len(report_calls) >= 1
        assert report_calls[0][1]["data"]["status"] == "failed"
        assert "does not support" in report_calls[0][1]["data"]["error_message"]

    def test_executor_exception_triggers_failed_report_and_rollback(self):
        client = MagicMock()
        docker_mgr = MagicMock()
        docker_mgr.get_container_endpoint.return_value = None
        cancel_event = threading.Event()

        mock_executor = MagicMock()
        mock_executor.validate_parameters.return_value = {"duration": 1}
        mock_executor.execute.side_effect = RuntimeError("Docker API timeout during injection")

        fault_payload = {
            "id": 1002,
            "fault_type": "cpu_stress",
            "target": "web",
            "parameters": {"duration": 1},
        }

        with patch.object(registry, "get", return_value=mock_executor):
            _execute_single_fault(
                fault=fault_payload,
                project_id="PROJ-1",
                client=client,
                docker_mgr=docker_mgr,
                cancel_event=cancel_event,
            )

        report_calls = [c for c in client.send_request_to_backend.call_args_list if "report" in c[0][0]]
        assert len(report_calls) >= 1
        assert report_calls[0][1]["data"]["status"] == "failed"
        assert "Docker API timeout" in report_calls[0][1]["data"]["error_message"]
