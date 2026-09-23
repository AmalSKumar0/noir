from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.projects.models import Project, FaultInjection

User = get_user_model()


class FaultInjectionAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_user",
            email="owner@example.com",
            password="testpassword123",
        )
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="testpassword123",
        )
        self.project = Project.objects.create(
            title="Chaos Test Project",
            connection_code="NR-TEST1234",
            owner=self.owner,
            status=Project.Status.ACTIVE,
            visibility=Project.Visibility.PRIVATE,
            architecture=Project.DeploymentType.MONOLITH,
            analysis_mode=Project.AnalysisMode.MANUAL,
        )

    def test_create_fault_success(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/faults/"
        payload = {
            "fault_type": "container_restart",
            "target": "web-service",
            "parameters": {"timeout": 15},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["fault_type"], "container_restart")
        self.assertEqual(response.data["target"], "web-service")
        self.assertEqual(response.data["status"], FaultInjection.Status.QUEUED)
        self.assertEqual(response.data["parameters"]["timeout"], 15)

        # Verify database record
        fault = FaultInjection.objects.get(id=response.data["id"])
        self.assertEqual(fault.project, self.project)
        self.assertEqual(fault.requested_by, self.owner)
        self.assertEqual(fault.status, FaultInjection.Status.QUEUED)


    def test_create_fault_unapproved_type_rejected(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/faults/"
        payload = {
            "fault_type": "arbitrary_shell_command",
            "target": "web-service",
            "parameters": {"cmd": "rm -rf /"},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fault_type", response.data)

    def test_create_fault_parameter_boundary_validation(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/faults/"

        # Latency out of range (> 5000)
        payload = {
            "fault_type": "network_delay",
            "target": "api-service",
            "parameters": {"latency_ms": 10000, "duration": 10},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Duration out of range (> 300)
        payload = {
            "fault_type": "cpu_stress",
            "target": "api-service",
            "parameters": {"workers": 2, "duration": 500},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_fetch_pending_fault(self):
        self.client.force_authenticate(user=self.owner)
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.owner,
            fault_type="network_delay",
            target="redis",
            parameters={"latency_ms": 200, "duration": 15},
            status=FaultInjection.Status.PENDING,
        )

        url = f"/api/projects/{self.project.connection_code}/faults/pending/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["fault"])
        self.assertEqual(response.data["fault"]["id"], fault.id)
        self.assertEqual(response.data["fault"]["target"], "redis")

    def test_claim_and_report_lifecycle(self):
        self.client.force_authenticate(user=self.owner)
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.owner,
            fault_type="container_stop",
            target="payment-service",
            parameters={"duration": 10, "timeout": 5},
            status=FaultInjection.Status.PENDING,
        )

        # 1. Claim fault: pending -> running
        claim_url = f"/api/projects/{self.project.id}/faults/{fault.id}/claim/"
        claim_resp = self.client.post(claim_url)
        self.assertEqual(claim_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(claim_resp.data["status"], "running")

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.RUNNING)
        self.assertIsNotNone(fault.started_at)

        # 2. Report fault: running -> completed
        report_url = f"/api/projects/{self.project.id}/faults/{fault.id}/report/"
        report_payload = {
            "status": "completed",
            "result": {"recovered": True, "duration_seconds": 10.2},
            "error_message": "",
        }
        report_resp = self.client.post(report_url, report_payload, format="json")
        self.assertEqual(report_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(report_resp.data["status"], "completed")

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.COMPLETED)
        self.assertIsNotNone(fault.completed_at)
        self.assertTrue(fault.result.get("recovered"))

    def test_cancel_pending_fault(self):
        self.client.force_authenticate(user=self.owner)
        fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.owner,
            fault_type="memory_stress",
            target="cache",
            parameters={"memory_mb": 512, "duration": 20},
            status=FaultInjection.Status.PENDING,
        )

        cancel_url = f"/api/projects/{self.project.id}/faults/{fault.id}/cancel/"
        response = self.client.post(cancel_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "cancelled")

        fault.refresh_from_db()
        self.assertEqual(fault.status, FaultInjection.Status.CANCELLED)

        # Calling cancel again is idempotent and returns 200 without error
        response2 = self.client.post(cancel_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.data["status"], "cancelled")


    def test_unauthorized_user_forbidden(self):
        self.client.force_authenticate(user=self.other_user)
        url = f"/api/projects/{self.project.id}/faults/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        payload = {
            "fault_type": "container_restart",
            "target": "web-service",
            "parameters": {"timeout": 10},
        }
        post_resp = self.client.post(url, payload, format="json")
        self.assertEqual(post_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_project_containers_sync_and_retrieve(self):
        self.client.force_authenticate(user=self.owner)
        profile_url = f"/api/projects/{self.project.connection_code}/profile/"
        containers_payload = [
            {
                "id": "c1a2b3c4d5e6",
                "name": "noir-test-web",
                "service": "web",
                "image": "python:3.11-slim",
                "status": "running",
                "ports": ["8000:8000"],
                "source": "compose",
            },
            {
                "id": "d7e8f9a0b1c2",
                "name": "noir-test-db",
                "service": "db",
                "image": "postgres:16-alpine",
                "status": "running",
                "ports": ["5432:5432"],
                "source": "compose",
            }
        ]
        res = self.client.post(profile_url, {
            "framework_name": "Django",
            "language": "Python",
            "runtime_version": "3.12.0",
            "package_manager": "pip",
            "operating_system": "Linux",
            "docker_containers": containers_payload
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["profile"]["docker_containers"]), 2)

        # Retrieve via containers endpoint
        containers_url = f"/api/projects/{self.project.connection_code}/containers/"
        get_res = self.client.get(containers_url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data["total"], 2)
        self.assertEqual(get_res.data["containers"][0]["name"], "noir-test-web")

        # Update via containers endpoint POST
        post_res = self.client.post(containers_url, {"containers": [containers_payload[0]]}, format="json")
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        self.assertEqual(post_res.data["total"], 1)


class ProjectDeletionAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="project_owner",
            email="owner@example.com",
            password="testpassword123",
            role=User.Role.DEVELOPER,
        )
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="testpassword123",
            is_superuser=True,
            is_staff=True,
        )
        self.other_user = User.objects.create_user(
            username="unauthorized_user",
            email="unauth@example.com",
            password="testpassword123",
            role=User.Role.DEVELOPER,
        )
        self.project = Project.objects.create(
            title="Project To Delete",
            connection_code="NR-DELTEST",
            owner=self.owner,
            status=Project.Status.ACTIVE,
            visibility=Project.Visibility.PRIVATE,
            architecture=Project.DeploymentType.MONOLITH,
            analysis_mode=Project.AnalysisMode.MANUAL,
        )

    def test_admin_can_retrieve_and_delete_any_project(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/projects/{self.project.id}/"

        # Verify admin can retrieve project details
        get_res = self.client.get(url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data["title"], "Project To Delete")

        # Verify admin can delete project
        del_res = self.client.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertFalse(Project.objects.filter(id=self.project.id).exists())

    def test_owner_can_delete_own_project(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/"
        del_res = self.client.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertFalse(Project.objects.filter(id=self.project.id).exists())

    def test_unauthorized_user_cannot_delete_project(self):
        self.client.force_authenticate(user=self.other_user)
        url = f"/api/projects/{self.project.id}/"
        del_res = self.client.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Project.objects.filter(id=self.project.id).exists())


