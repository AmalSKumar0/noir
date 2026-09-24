import json
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from apps.projects.models import Project, FaultInjection
from apps.projects.serializers import FaultInjectionSerializer

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
        cache.set(f"core_daemon_active_{self.project.connection_code}", True, timeout=3600)

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


class ChaosReportAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="chaos_owner",
            email="chaos_owner@example.com",
            password="testpassword123",
        )
        self.other_user = User.objects.create_user(
            username="chaos_other",
            email="chaos_other@example.com",
            password="testpassword123",
        )
        self.project = Project.objects.create(
            title="Chaos Audit Project",
            connection_code="NR-AUDIT001",
            owner=self.owner,
            status=Project.Status.ACTIVE,
            visibility=Project.Visibility.PRIVATE,
            architecture=Project.DeploymentType.MICROSERVICE,
            analysis_mode=Project.AnalysisMode.MANUAL,
        )
        cache.set(f"core_daemon_active_{self.project.connection_code}", True, timeout=3600)

        # Create sample completed fault injection with results
        self.fault = FaultInjection.objects.create(
            project=self.project,
            requested_by=self.owner,
            fault_type="cpu_stress",
            target="api-gateway",
            status=FaultInjection.Status.COMPLETED,
            parameters={
                "duration": 15,
                "workers": 2,
                "hypothesis": "Gateway maintains <50ms P95 latency under CPU stress",
                "expected_behavior": "Graceful degradation without socket timeouts",
                "rto_target_seconds": 4.0,
            },
            result={
                "steady_state_baseline": {
                    "available": True,
                    "avg_latency_ms": 18.5,
                    "sample_count": 5,
                    "success_rate_percent": 100.0,
                    "probe_url": "http://api-gateway:8000/health",
                },
                "experiment_metrics": {
                    "probes_count": 12,
                    "successful_probes": 12,
                    "failed_probes": 0,
                    "availability_percent": 100.0,
                    "p50_latency_ms": 22.0,
                    "p95_latency_ms": 38.0,
                    "latency_multiplier": 2.05,
                },
                "recovery_metrics": {
                    "recovered": True,
                    "recovery_time_seconds": 1.8,
                    "rto_target_seconds": 4.0,
                    "rto_target_met": True,
                },
                "recovered": True,
                "resilience_score": 92,
                "resilience_grade": "A",
            },
        )

    def test_create_fault_with_hypothesis_and_rto(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/faults/"
        payload = {
            "fault_type": "network_delay",
            "target": "payment-api",
            "hypothesis": "Service absorbs 500ms delay without dropping requests",
            "expected_behavior": "Fallback circuit breaker responds within 2s",
            "rto_target_seconds": 3.5,
            "parameters": {"latency_ms": 500, "duration": 10},
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["hypothesis"], "Service absorbs 500ms delay without dropping requests")
        self.assertEqual(res.data["rto_target_seconds"], 3.5)

    def test_get_individual_experiment_report(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/faults/{self.fault.id}/report/"
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("metadata", res.data)
        self.assertIn("score_summary", res.data)
        self.assertIn("hypothesis", res.data)
        self.assertIn("comparison_table", res.data)
        self.assertIn("recovery", res.data)
        self.assertIn("findings", res.data)
        self.assertIn("recommendations", res.data)

        # Check hypothesis evaluation
        hypo = res.data["hypothesis"]
        self.assertEqual(hypo["verdict"], "VALIDATED")

        # Check recovery metrics
        rec = res.data["recovery"]
        self.assertEqual(rec["recovery_time_seconds"], 1.8)
        self.assertEqual(rec["rto_target_seconds"], 4.0)
        self.assertTrue(rec["rto_target_met"])

        # Check recommendations have follow-up validation experiments
        recs = res.data["recommendations"]
        self.assertGreater(len(recs), 0)
        for r in recs:
            if "next_experiment" in r:
                self.assertIn("command", r["next_experiment"])

    def test_get_collective_chaos_report(self):
        self.client.force_authenticate(user=self.owner)
        url = f"/api/projects/{self.project.id}/chaos/collective-report/"
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("project", res.data)
        self.assertIn("summary", res.data)
        self.assertIn("overview_matrix", res.data)
        self.assertIn("outliers", res.data)
        self.assertIn("cross_experiment_patterns", res.data)
        self.assertIn("consolidated_recommendations", res.data)
        self.assertIn("follow_up_roadmap", res.data)

        self.assertEqual(res.data["summary"]["total_experiments"], 1)
        self.assertEqual(res.data["summary"]["completed"], 1)
        self.assertEqual(res.data["summary"]["hypotheses_validated"], 1)

    def test_unauthorized_user_cannot_access_reports(self):
        self.client.force_authenticate(user=self.other_user)
        report_url = f"/api/projects/{self.project.id}/faults/{self.fault.id}/report/"
        res_single = self.client.get(report_url)
        self.assertEqual(res_single.status_code, status.HTTP_403_FORBIDDEN)

        collective_url = f"/api/projects/{self.project.id}/chaos/collective-report/"
        res_collective = self.client.get(collective_url)
        self.assertEqual(res_collective.status_code, status.HTTP_403_FORBIDDEN)


class ProjectCreateValidationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="builder_user",
            email="builder@example.com",
            password="testpassword123",
            role=User.Role.DEVELOPER,
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/project/create/"

    def test_create_project_all_fields_success(self):
        payload = {
            "title": "Production Microservice",
            "description": "Core auth and transaction processing cluster",
            "architecture": "microservice",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "Production Microservice")
        self.assertEqual(res.data["description"], "Core auth and transaction processing cluster")
        self.assertEqual(res.data["architecture"], "microservice")
        self.assertEqual(res.data["visibility"], "private")
        self.assertEqual(res.data["analysis_mode"], "manual")
        self.assertTrue(res.data["connection_code"])

    def test_create_project_missing_title(self):
        payload = {
            "description": "Valid description",
            "architecture": "monolith",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", res.data)

    def test_create_project_blank_title(self):
        payload = {
            "title": "    ",
            "description": "Valid description",
            "architecture": "monolith",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", res.data)

    def test_create_project_missing_description(self):
        payload = {
            "title": "Valid Title",
            "architecture": "monolith",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", res.data)

    def test_create_project_blank_description(self):
        payload = {
            "title": "Valid Title",
            "description": "    ",
            "architecture": "monolith",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", res.data)

    def test_create_project_missing_architecture(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("architecture", res.data)

    def test_create_project_invalid_architecture(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "architecture": "serverless_invalid",
            "visibility": "private",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("architecture", res.data)

    def test_create_project_missing_visibility(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "architecture": "monolith",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("visibility", res.data)

    def test_create_project_invalid_visibility(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "architecture": "monolith",
            "visibility": "unlisted_invalid",
            "analysis_mode": "manual",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("visibility", res.data)

    def test_create_project_missing_analysis_mode(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "architecture": "monolith",
            "visibility": "private",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("analysis_mode", res.data)

    def test_create_project_invalid_analysis_mode(self):
        payload = {
            "title": "Valid Title",
            "description": "Valid description",
            "architecture": "monolith",
            "visibility": "private",
            "analysis_mode": "continuous_invalid",
        }
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("analysis_mode", res.data)

    def test_fault_injection_serializer_created_at_is_json_serializable(self):
        project = Project.objects.create(
            owner=self.user,
            title="Chaos Test",
            description="Testing chaos serialization",
            architecture="monolith",
        )
        fault = FaultInjection.objects.create(
            project=project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="web",
            status=FaultInjection.Status.RUNNING,
        )
        serializer_data = FaultInjectionSerializer(fault).data
        self.assertIsInstance(serializer_data["created_at"], str)
        # json.dumps standard Python dumps must succeed without TypeError
        dumped = json.dumps({"fault": serializer_data})
        self.assertIn("cpu_stress", dumped)

    def test_fault_injection_logs_batch_api(self):
        project = Project.objects.create(
            owner=self.user,
            title="Batch Log Project",
            description="Testing batch logs",
            architecture="monolith",
        )
        fault = FaultInjection.objects.create(
            project=project,
            requested_by=self.user,
            fault_type="network_delay",
            target="cache",
            status=FaultInjection.Status.RUNNING,
        )
        self.client.force_authenticate(user=self.user)
        url = f"/api/projects/{project.id}/faults/{fault.id}/logs/batch/"
        payload = {
            "logs": [
                {"level": "INFO", "message": "Probing steady state 1", "timestamp": "2026-09-24T00:00:01Z"},
                {"level": "WARN", "message": "Latency spiked by 40ms", "timestamp": "2026-09-24T00:00:02Z"},
                {"level": "INFO", "message": "Steady state restored", "timestamp": "2026-09-24T00:00:03Z"},
            ]
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["count"], 3)
        self.assertEqual(fault.logs.count(), 3)

    def test_fault_list_is_lightweight_without_structured_report(self):
        project = Project.objects.create(
            owner=self.user,
            title="List Test Project",
            description="Testing lightweight list",
            architecture="monolith",
        )
        FaultInjection.objects.create(
            project=project,
            requested_by=self.user,
            fault_type="cpu_stress",
            target="worker",
            status=FaultInjection.Status.COMPLETED,
        )
        self.client.force_authenticate(user=self.user)
        url = f"/api/projects/{project.id}/faults/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        # Verify structured_report is omitted from the list view (lazy loaded on report page)
        self.assertNotIn("structured_report", res.data[0])
        self.assertEqual(res.data[0]["fault_type"], "cpu_stress")





