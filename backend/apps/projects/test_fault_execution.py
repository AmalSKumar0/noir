import time
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project, FaultInjection, FaultInjectionLog

User = get_user_model()


class FaultExecutionSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123",
            role=User.Role.DEVELOPER,
        )
        self.client.force_authenticate(user=self.user)

        self.project = Project.objects.create(
            title="Chaos Test Project",
            connection_code="CHAOS-001",
            owner=self.user,
        )

    def test_create_fault_returns_immediately_and_status_is_queued(self):
        """Starting an injection creates a job in QUEUED state without blocking."""
        url = f"/api/projects/{self.project.id}/faults/"
        payload = {
            "fault_type": "cpu_stress",
            "target": "api-server",
            "parameters": {"workers": 2, "duration": 15},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("id", data)
        self.assertEqual(data["status"], FaultInjection.Status.QUEUED)
        self.assertEqual(data["target"], "api-server")

        # Verify database record
        fault = FaultInjection.objects.get(pk=data["id"])
        self.assertEqual(fault.status, FaultInjection.Status.QUEUED)
        self.assertEqual(fault.logs.count(), 1)
        self.assertIn("queued", fault.logs.first().message.lower())

    def test_fifo_queue_ordering(self):
        """Jobs should be queued and retrieved in FIFO order (created_at / requested_at ASC)."""
        f1 = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-1",
            status=FaultInjection.Status.QUEUED,
        )
        time.sleep(0.01)
        f2 = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="network_delay",
            target="api-2",
            status=FaultInjection.Status.QUEUED,
        )

        resp = self.client.get(f"/api/projects/{self.project.id}/faults/pending/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data["pending"])
        self.assertEqual(data["fault"]["id"], f1.id)

    def test_concurrency_policy_enforcement(self):
        """When max_concurrent_injections is reached, pending endpoint returns concurrency_limit_reached."""
        # Active running job
        FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-running",
            status=FaultInjection.Status.RUNNING,
        )
        # Queued job
        f_queued = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="network_delay",
            target="api-queued",
            status=FaultInjection.Status.QUEUED,
        )

        # Default concurrency is 1, so pending should say concurrency_limit_reached
        resp = self.client.get(f"/api/projects/{self.project.id}/faults/pending/?concurrency=1")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertFalse(data["pending"])
        self.assertEqual(data.get("reason"), "concurrency_limit_reached")

        # If concurrency allowed is 2, it should return the queued fault
        resp2 = self.client.get(f"/api/projects/{self.project.id}/faults/pending/?concurrency=2")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        data2 = resp2.json()
        self.assertTrue(data2["pending"])
        self.assertEqual(data2["fault"]["id"], f_queued.id)

    def test_claim_queued_transitions_to_running(self):
        """Worker claiming a queued job transitions it to RUNNING and sets started_at."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-server",
            status=FaultInjection.Status.QUEUED,
        )
        url = f"/api/projects/{self.project.id}/faults/{fault.id}/claim/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], FaultInjection.Status.RUNNING)
        self.assertIsNotNone(data["started_at"])

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.RUNNING)
        self.assertIsNotNone(fault.started_at)

    def test_invalid_claim_transition_rejected(self):
        """Cannot claim a fault that is not in QUEUED state."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-server",
            status=FaultInjection.Status.COMPLETED,
        )
        url = f"/api/projects/{self.project.id}/faults/{fault.id}/claim/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_queued_fault_immediately_cancels(self):
        """Cancelling a QUEUED fault immediately marks it CANCELLED and it is never claimed."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="network_loss",
            target="api-server",
            status=FaultInjection.Status.QUEUED,
        )
        url = f"/api/projects/{self.project.id}/faults/{fault.id}/cancel/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], FaultInjection.Status.CANCELLED)

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.CANCELLED)

        # Verify it won't appear in pending
        pending_resp = self.client.get(f"/api/projects/{self.project.id}/faults/pending/")
        self.assertFalse(pending_resp.json()["pending"])

    def test_cancel_running_fault_sets_cancel_requested(self):
        """Cancelling a RUNNING fault transitions to CANCEL_REQUESTED for worker termination."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-server",
            status=FaultInjection.Status.RUNNING,
        )
        url = f"/api/projects/{self.project.id}/faults/{fault.id}/cancel/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], FaultInjection.Status.CANCEL_REQUESTED)

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.CANCEL_REQUESTED)

    def test_idempotent_cancellation(self):
        """Calling cancel multiple times does not corrupt state or return error."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="api-server",
            status=FaultInjection.Status.RUNNING,
        )
        url = f"/api/projects/{self.project.id}/faults/{fault.id}/cancel/"
        # First call -> CANCEL_REQUESTED
        r1 = self.client.post(url)
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.json()["status"], FaultInjection.Status.CANCEL_REQUESTED)

        # Second call -> idempotent 200 with CANCEL_REQUESTED
        r2 = self.client.post(url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.json()["status"], FaultInjection.Status.CANCEL_REQUESTED)

        # Worker reports CANCELLED
        report_url = f"/api/projects/{self.project.id}/faults/{fault.id}/report/"
        r_rep = self.client.post(report_url, {"status": "cancelled", "result": {"aborted": True}}, format="json")
        self.assertEqual(r_rep.status_code, status.HTTP_200_OK)

        # Third cancel call when already CANCELLED -> idempotent 200
        r3 = self.client.post(url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.json()["status"], FaultInjection.Status.CANCELLED)

    def test_persistent_logs_and_streaming_endpoint(self):
        """Logs can be appended via API and retrieved with ordering and time filtering."""
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.user,
            fault_type="memory_stress",
            target="worker-1",
            status=FaultInjection.Status.RUNNING,
        )

        log_url = f"/api/projects/{self.project.id}/faults/{fault.id}/log/"
        # Append 2 logs
        r1 = self.client.post(log_url, {"level": "INFO", "message": "Allocating 256MB..."}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

        r2 = self.client.post(log_url, {"level": "INFO", "message": "Memory held for 10s..."}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

        # Fetch logs
        get_logs_url = f"/api/projects/{self.project.id}/faults/{fault.id}/logs/"
        resp = self.client.get(get_logs_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        logs = resp.json()
        self.assertEqual(len(logs), 2)
        self.assertEqual(logs[0]["message"], "Allocating 256MB...")
        self.assertEqual(logs[1]["message"], "Memory held for 10s...")
