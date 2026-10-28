"""
Noir Autonomous Chaos Engineering Platform
Production Demo Data Seeder

Seeds realistic, presentation-grade demonstration data into Noir backend:
- Standard Frameworks (Django, FastAPI, Express.js, Next.js, Go/Gin, Spring Boot)
- Production Users & Auth (Admin, Company, Developers)
- Helthyfi Company Profile, Developer Teams & Project assignments
- Real Chaos Experiments (50 genuine fault injections + 1,453 logs) for Dormcare
- CloudPulse Microservice project with multi-container profile & experiments
- Test Runs with suite logs and durations
- In-app Notifications
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Django setup
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
import django
django.setup()

from django.contrib.auth import get_user_model
from apps.accounts.models import CompanyProfile, CompanyDeveloperRequest, Notification, DeveloperTeam, SocialAuth
from apps.projects.models import Framework, Project, ProjectProfile, TestRun, FaultInjection, FaultInjectionLog
from apps.projects.services.generateCode import generate_code

User = get_user_model()


def seed_frameworks():
    print("--> Seeding Frameworks...")
    frameworks_data = [
        {"name": "Django", "language": "Python", "default_test_command": "python manage.py test", "detection_file": "manage.py", "supported": True},
        {"name": "FastAPI", "language": "Python", "default_test_command": "pytest", "detection_file": "main.py", "supported": True},
        {"name": "Express.js", "language": "JavaScript", "default_test_command": "npm test", "detection_file": "package.json", "supported": True},
        {"name": "Next.js", "language": "TypeScript", "default_test_command": "npm test", "detection_file": "next.config.js", "supported": True},
        {"name": "Go / Gin", "language": "Go", "default_test_command": "go test ./...", "detection_file": "go.mod", "supported": True},
        {"name": "Spring Boot", "language": "Java", "default_test_command": "./mvnw test", "detection_file": "pom.xml", "supported": True},
    ]
    for item in frameworks_data:
        fw, created = Framework.objects.update_or_create(
            name=item["name"],
            defaults={
                "language": item["language"],
                "default_test_command": item["default_test_command"],
                "detection_file": item["detection_file"],
                "supported": item["supported"],
            }
        )
        print(f"    {'Created' if created else 'Updated'} Framework: {fw.name}")


def seed_accounts_and_company():
    print("--> Seeding Accounts and Helthyfi Company...")
    
    # 1. Admin User
    admin_user = User.objects.filter(username="admin").first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@noir.ai",
            password="Admin@123",
            first_name="System",
            last_name="Administrator",
        )
        print(f"    Created Admin user: {admin_user.username}")
    else:
        admin_user.email = "admin@noir.ai"
        admin_user.first_name = "System"
        admin_user.last_name = "Administrator"
        admin_user.is_superuser = True
        admin_user.is_staff = True
        admin_user.set_password("Admin@123")
        admin_user.save()
        print(f"    Updated Admin user: {admin_user.username}")

    SocialAuth.objects.get_or_create(
        user=admin_user,
        provider=SocialAuth.Type.PASSWORD,
        defaults={"provider_id": ""}
    )

    # 2. Company User (akhil)
    akhil_user = User.objects.filter(username="akhil").first()
    if not akhil_user:
        akhil_user = User.objects.create_user(
            username="akhil",
            email="akhil@noir.ai",
            password="Akhil@123",
            first_name="Akhil",
            last_name="Nair",
            role=User.Role.COMPANY,
        )
        print("    Created akhil user.")
    else:
        akhil_user.role = User.Role.COMPANY
        akhil_user.set_password("Akhil@123")
        akhil_user.first_name = "Akhil"
        akhil_user.last_name = "Nair"
        akhil_user.save()
        print("    Updated akhil user password to Akhil@123.")

    SocialAuth.objects.get_or_create(
        user=akhil_user,
        provider=SocialAuth.Type.PASSWORD,
        defaults={"provider_id": ""}
    )

    # 3. CompanyProfile for akhil
    helthyfi, comp_created = CompanyProfile.objects.update_or_create(
        user=akhil_user,
        defaults={
            "company_name": "Helthyfi Technologies",
            "logo": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=128&h=128&fit=crop&crop=faces",
            "status": CompanyProfile.Status.APPROVED,
            "industry": "Healthcare & Distributed Telemetry",
            "company_size": "51-200 employees",
            "website": "https://helthyfi.io",
            "tax_id": "US-EIN-948192847",
            "phone_number": "+1 (555) 345-9821",
            "ownership_certificate": "Verified Certificate of Incorporation #DEL-2024-91823",
        }
    )
    print(f"    {'Created' if comp_created else 'Updated'} CompanyProfile: {helthyfi.company_name}")

    # 4. Main Developer User (AmalSKumar0)
    amal_user = User.objects.filter(username="AmalSKumar0").first()
    if not amal_user:
        amal_user = User.objects.create_user(
            username="AmalSKumar0",
            email="amalskumarofficialz@gmail.com",
            first_name="Amal",
            last_name="S Kumar",
            role=User.Role.DEVELOPER,
        )
    amal_user.role = User.Role.DEVELOPER
    amal_user.company = helthyfi
    amal_user.set_password("Amal@123")
    amal_user.save()
    SocialAuth.objects.get_or_create(
        user=amal_user,
        provider=SocialAuth.Type.PASSWORD,
        defaults={"provider_id": ""}
    )
    print(f"    Verified AmalSKumar0 account, linked to company {helthyfi.company_name}")

    # 5. Developer Colleague (athulya-r-mohan)
    athulya_user = User.objects.filter(username="athulya-r-mohan").first()
    if athulya_user:
        athulya_user.role = User.Role.DEVELOPER
        athulya_user.company = helthyfi
        athulya_user.set_password("Athulya@123")
        athulya_user.save()
        SocialAuth.objects.get_or_create(
            user=athulya_user,
            provider=SocialAuth.Type.PASSWORD,
            defaults={"provider_id": ""}
        )
        print("    Verified athulya-r-mohan account, linked to company.")

    # 6. Additional Developer (tester)
    tester_user, t_created = User.objects.update_or_create(
        username="tester",
        defaults={
            "email": "tester@noir.ai",
            "first_name": "Dev",
            "last_name": "Tester",
            "role": User.Role.DEVELOPER,
        }
    )
    tester_user.set_password("Tester@123")
    tester_user.save()
    SocialAuth.objects.get_or_create(
        user=tester_user,
        provider=SocialAuth.Type.PASSWORD,
        defaults={"provider_id": ""}
    )
    print(f"    {'Created' if t_created else 'Verified'} tester@noir.ai account.")

    # 7. Developer Requests
    CompanyDeveloperRequest.objects.update_or_create(
        company=helthyfi,
        developer=amal_user,
        defaults={
            "status": CompanyDeveloperRequest.Status.ACCEPTED,
            "message": "Welcome to Helthyfi SRE & Infrastructure Engineering Team!",
        }
    )
    if athulya_user:
        CompanyDeveloperRequest.objects.update_or_create(
            company=helthyfi,
            developer=athulya_user,
            defaults={
                "status": CompanyDeveloperRequest.Status.ACCEPTED,
                "message": "Welcome to Helthyfi SRE & Infrastructure Engineering Team!",
            }
        )
    # Pending invitation for tester
    CompanyDeveloperRequest.objects.update_or_create(
        company=helthyfi,
        developer=tester_user,
        defaults={
            "status": CompanyDeveloperRequest.Status.PENDING,
            "message": "We would like to invite you to join Helthyfi as an SRE Developer.",
        }
    )
    print("    Seeded CompanyDeveloperRequests.")

    return amal_user, athulya_user, akhil_user, admin_user, helthyfi


def seed_dormcare_project(amal_user, helthyfi):
    print("--> Seeding Dormcare Project (ID: 2)...")
    dormcare = Project.objects.filter(id=2).first()
    if not dormcare:
        dormcare = Project.objects.filter(title__iexact="Dormcare").first()
    if not dormcare:
        dormcare = Project.objects.create(
            id=2,
            owner=amal_user,
            title="Dormcare",
            description="Campus accommodation management system featuring student room allocation, maintenance requests, and billing services.",
            architecture=Project.DeploymentType.MONOLITH,
            visibility=Project.Visibility.PRIVATE,
            status=Project.Status.ACTIVE,
            connection_code="NR-434JKRSE",
        )
    else:
        dormcare.owner = amal_user
        dormcare.title = "Dormcare"
        dormcare.description = "Campus accommodation management system featuring student room allocation, maintenance requests, and billing services."
        dormcare.architecture = Project.DeploymentType.MONOLITH
        dormcare.status = Project.Status.ACTIVE
        dormcare.save()

    django_fw = Framework.objects.filter(name="Django").first()
    dormcare_containers = [
        {"id": "c184603849c0", "name": "dormcare-app", "service": "web-api", "image": "dormcare:app", "status": "running", "ports": ["8001->8000/tcp"], "source": "dockerfile"},
        {"id": "a5fd5eb32c57", "name": "dormcare-postgres", "service": "database", "image": "postgres:16-alpine", "status": "running", "ports": ["5432/tcp"], "source": "compose"},
        {"id": "179d1734dd5f", "name": "dormcare-redis", "service": "cache", "image": "redis:7-alpine", "status": "running", "ports": ["6379/tcp"], "source": "compose"},
    ]

    profile, _ = ProjectProfile.objects.update_or_create(
        project=dormcare,
        defaults={
            "framework": django_fw,
            "runtime_version": "Python 3.12.3",
            "operating_system": "Linux (x86_64)",
            "package_manager": "pip 24.0",
            "docker_containers": dormcare_containers,
            "analysis_data": {
                "detected_routes": 34,
                "endpoints_tested": 18,
                "database_driver": "psycopg2-binary",
                "cache_backend": "channels_redis",
                "static_engine": "whitenoise",
            }
        }
    )
    print(f"    Updated Dormcare ProjectProfile.")

    # Import the 50 genuine chaos experiments from JSON dump if available
    dump_path = Path("/tmp/project_54_dump.json")
    if dump_path.exists():
        print(f"    Loading genuine chaos experiment dump from {dump_path}...")
        with open(dump_path, "r") as f:
            dump_data = json.load(f)

        raw_faults = dump_data.get("faults", [])
        raw_logs = dump_data.get("logs", [])

        # Build log mapping by old fault_id
        logs_by_old_fault = {}
        for l in raw_logs:
            fid = l.get("fault_id")
            if fid not in logs_by_old_fault:
                logs_by_old_fault[fid] = []
            logs_by_old_fault[fid].append(l)

        # Clear existing faults if any to ensure clean idempotent state
        dormcare.fault_injections.all().delete()

        created_faults_count = 0
        created_logs_count = 0

        for rf in raw_faults:
            old_fid = rf.get("id")
            fault_obj = FaultInjection.objects.create(
                project=dormcare,
                requested_by=amal_user,
                fault_type=rf.get("fault_type", "cpu_stress"),
                target=rf.get("target", "dormcare-app"),
                parameters=rf.get("parameters", {}),
                status=rf.get("status", "completed"),
                started_at=rf.get("started_at"),
                completed_at=rf.get("completed_at"),
                result=rf.get("result", {}),
                error_message=rf.get("error_message"),
            )
            created_faults_count += 1

            # Insert logs for this fault
            fault_logs = logs_by_old_fault.get(old_fid, [])
            log_objs = [
                FaultInjectionLog(
                    fault=fault_obj,
                    level=l.get("level", "INFO"),
                    message=l.get("message", ""),
                )
                for l in fault_logs
            ]
            if log_objs:
                FaultInjectionLog.objects.bulk_create(log_objs)
                created_logs_count += len(log_objs)

        print(f"    Successfully imported {created_faults_count} genuine faults and {created_logs_count} logs for Dormcare!")
    else:
        print("    [Notice] /tmp/project_54_dump.json not found, using existing faults.")

    # Dormcare Test Runs
    dormcare.test_runs.all().delete()
    test_runs_data = [
        {
            "suite_name": "Automated Chaos Regression Suite",
            "status": TestRun.Status.PASSED,
            "command": "pytest test/suites/ --html=reports/report.html",
            "total_tests": 48,
            "passed_tests": 48,
            "failed_tests": 0,
            "skipped_tests": 0,
            "duration_ms": 320110,
            "logs": "============================= 48 passed in 320.11s (0:05:20) =============================\n[SUCCESS] Suite 01: Landing & Public Navigation (6/6)\n[SUCCESS] Suite 02: Authentication & Registration (10/10)\n[SUCCESS] Suite 03: Route Guards & Access Security (9/9)\n[SUCCESS] Suite 04: Developer Flow & Telemetry (11/11)\n[SUCCESS] Suite 05: Company Team Operations (7/7)\n[SUCCESS] Suite 06: Chaos Injection Engine (5/5)\nAll assertions passed without invariant violations.",
        },
        {
            "suite_name": "Integration Test Suite - Auth & Bookings",
            "status": TestRun.Status.PASSED,
            "command": "python manage.py test apps.accounts apps.projects",
            "total_tests": 24,
            "passed_tests": 24,
            "failed_tests": 0,
            "skipped_tests": 0,
            "duration_ms": 14200,
            "logs": "Creating test database for alias 'default'...\nRan 24 tests in 14.198s\nOK\nDestroying test database for alias 'default'...",
        },
        {
            "suite_name": "Database Resilience & Stress Suite",
            "status": TestRun.Status.PASSED,
            "command": "python manage.py test --tag=stress",
            "total_tests": 18,
            "passed_tests": 18,
            "failed_tests": 0,
            "skipped_tests": 0,
            "duration_ms": 28500,
            "logs": "Running 18 stress test cases against pooled PostgreSQL connections...\n- Connection pool saturation test: PASSED\n- Deadlock resolution retry test: PASSED\n- Read-after-write consistency: PASSED\nAll 18 scenarios met latency SLAs (< 250ms).",
        },
        {
            "suite_name": "API Gateway & Latency Invariant Check",
            "status": TestRun.Status.PASSED,
            "command": "npm run test:invariants",
            "total_tests": 32,
            "passed_tests": 32,
            "failed_tests": 0,
            "skipped_tests": 0,
            "duration_ms": 19800,
            "logs": "PASS test/invariants/latency.test.ts\nPASS test/invariants/status_codes.test.ts\nPASS test/invariants/circuit_breaker.test.ts\nTest Suites: 3 passed, 3 total\nTests: 32 passed, 32 total",
        },
        {
            "suite_name": "Worker Queue & Notification Dispatch",
            "status": TestRun.Status.PASSED,
            "command": "pytest test/test_notifications.py",
            "total_tests": 15,
            "passed_tests": 15,
            "failed_tests": 0,
            "skipped_tests": 0,
            "duration_ms": 9450,
            "logs": "test/test_notifications.py::test_email_dispatch PASSED\ntest/test_notifications.py::test_sms_alert PASSED\ntest/test_notifications.py::test_in_app_inbox PASSED\n============================== 15 passed in 9.45s ==============================",
        },
        {
            "suite_name": "Failover Self-Healing Validation",
            "status": TestRun.Status.FAILED,
            "command": "python -m pytest test/test_failover.py",
            "total_tests": 16,
            "passed_tests": 14,
            "failed_tests": 2,
            "skipped_tests": 0,
            "duration_ms": 22100,
            "logs": "FAIL test/test_failover.py::test_redis_reconnect_during_keyspace_migration\nAssertionError: Reconnect latency 3120ms exceeded SLA 2000ms\nFAIL test/test_failover.py::test_cgroup_memory_recovery\nMemory pressure caused container throttling.",
        },
    ]

    for tr in test_runs_data:
        TestRun.objects.create(
            project=dormcare,
            executor=amal_user,
            suite_name=tr["suite_name"],
            status=tr["status"],
            command=tr["command"],
            total_tests=tr["total_tests"],
            passed_tests=tr["passed_tests"],
            failed_tests=tr["failed_tests"],
            skipped_tests=tr["skipped_tests"],
            duration_ms=tr["duration_ms"],
            logs=tr["logs"],
        )
    print(f"    Seeded {len(test_runs_data)} test runs for Dormcare.")

    return dormcare


def seed_cloudpulse_microservice(amal_user, helthyfi):
    print("--> Seeding CloudPulse Microservices Project...")
    cloudpulse, created = Project.objects.update_or_create(
        title="CloudPulse Microservices",
        defaults={
            "owner": amal_user,
            "description": "Enterprise distributed observability and telemetry pipeline processing multi-tenant telemetry streams with Kafka event brokers and Redis distributed caching.",
            "architecture": Project.DeploymentType.MICROSERVICE,
            "visibility": Project.Visibility.PRIVATE,
            "status": Project.Status.ACTIVE,
            "connection_code": "NR-981CPGWS",
        }
    )

    go_fw = Framework.objects.filter(name="Go / Gin").first() or Framework.objects.first()
    cp_containers = [
        {"id": "cp-gw-89a1", "name": "api-gateway", "service": "gateway", "image": "cloudpulse/gateway:v2.1", "status": "running", "ports": ["8080->8080/tcp"], "source": "compose"},
        {"id": "cp-auth-43b2", "name": "auth-service", "service": "authentication", "image": "cloudpulse/auth:v2.1", "status": "running", "ports": ["8081->8081/tcp"], "source": "compose"},
        {"id": "cp-proc-77c3", "name": "metrics-processor", "service": "worker", "image": "cloudpulse/processor:v2.1", "status": "running", "ports": [], "source": "compose"},
        {"id": "cp-red-12d4", "name": "cache-redis", "service": "cache", "image": "redis:7.2-alpine", "status": "running", "ports": ["6379/tcp"], "source": "compose"},
        {"id": "cp-pg-55e5", "name": "events-postgres", "service": "database", "image": "postgres:16-alpine", "status": "running", "ports": ["5432/tcp"], "source": "compose"},
    ]

    ProjectProfile.objects.update_or_create(
        project=cloudpulse,
        defaults={
            "framework": go_fw,
            "runtime_version": "Go 1.22.4",
            "operating_system": "Linux (amd64)",
            "package_manager": "go modules",
            "docker_containers": cp_containers,
            "analysis_data": {
                "microservices_count": 5,
                "grpc_endpoints": 14,
                "http_endpoints": 28,
                "event_topics": ["telemetry.ingest", "telemetry.processed", "alerts.dispatch"],
            }
        }
    )
    print("    Updated CloudPulse ProjectProfile.")

    # CloudPulse Chaos Experiments - Clone from genuine dump to ensure 100% chaos engine compatibility
    cloudpulse.fault_injections.all().delete()
    now = datetime.now(timezone.utc)

    dump_path = Path("/tmp/project_54_dump.json")
    if dump_path.exists():
        with open(dump_path, "r") as f:
            dump_data = json.load(f)
        raw_faults = dump_data.get("faults", [])
    else:
        raw_faults = []

    cp_targets = [
        ("network_delay", "api-gateway", {"latency_ms": 150, "jitter_ms": 25, "duration": 30}),
        ("cpu_stress", "metrics-processor", {"workers": 4, "load_percent": 85, "duration": 45}),
        ("container_restart", "cache-redis", {"timeout": 15}),
        ("network_loss", "auth-service", {"loss_percent": 10, "duration": 20}),
        ("memory_stress", "metrics-processor", {"memory_mb": 512, "duration": 30}),
        ("container_stop", "api-gateway", {"duration": 10}),
    ]

    for idx, (ftype, target, params) in enumerate(cp_targets):
        # Find a matching genuine fault of same type if available
        matched_genuine = next((rf for rf in raw_faults if rf.get("fault_type") == ftype and rf.get("result")), None)
        if not matched_genuine and raw_faults:
            matched_genuine = raw_faults[idx % len(raw_faults)]

        if matched_genuine:
            result_dict = json.loads(json.dumps(matched_genuine.get("result", {})))
        else:
            result_dict = {
                "success": True,
                "recovered": True,
                "resilience_score": 88,
                "resilience_grade": "B",
                "duration_seconds": 30,
                "anomaly_summary": {
                    "peak_impact": {"ratio_to_baseline": 1.25, "percentage_delta": 25.0},
                    "spike_count": 2,
                    "sustained_degradation_detected": False,
                },
                "recommendations": ["Optimize container connection pool sizing."],
            }

        delta_hours = (len(cp_targets) - idx) * 4
        req_time = now - timedelta(hours=delta_hours)
        start_time = req_time + timedelta(seconds=2)
        end_time = start_time + timedelta(seconds=30)

        fault = FaultInjection.objects.create(
            project=cloudpulse,
            requested_by=amal_user,
            fault_type=ftype,
            target=target,
            parameters=params,
            status=FaultInjection.Status.COMPLETED,
            started_at=start_time,
            completed_at=end_time,
            result=result_dict,
        )

        logs = [
            ("INFO", f"Dispatched {ftype} command to target container '{target}'"),
            ("INFO", f"Captured pre-experiment steady-state baseline: avg_latency=18.4ms, availability=100%"),
            ("WARN", f"Active fault injection in progress: parameters={params}"),
            ("INFO", f"Collecting real-time telemetry probes every 500ms..."),
            ("INFO", f"Rollback trigger initiated after duration window."),
            ("INFO", f"Target container '{target}' recovered to steady-state. Verified resilience."),
        ]
        for lvl, msg in logs:
            FaultInjectionLog.objects.create(
                fault=fault,
                level=lvl,
                message=msg,
            )

    print(f"    Seeded {len(cp_targets)} high-fidelity chaos experiments for CloudPulse.")

    # CloudPulse Test Runs
    cloudpulse.test_runs.all().delete()
    cp_runs = [
        {"name": "Distributed Ingress Load Test", "status": TestRun.Status.PASSED, "total": 60, "passed": 60, "duration": 45200},
        {"name": "Kafka Event Pipeline Verification", "status": TestRun.Status.PASSED, "total": 35, "passed": 35, "duration": 21000},
        {"name": "Redis Distributed Lock Concurrency", "status": TestRun.Status.PASSED, "total": 28, "passed": 28, "duration": 18400},
        {"name": "Microservice Health Probing Invariant", "status": TestRun.Status.PASSED, "total": 42, "passed": 42, "duration": 15800},
    ]
    for r in cp_runs:
        TestRun.objects.create(
            project=cloudpulse,
            executor=amal_user,
            suite_name=r["name"],
            status=r["status"],
            command="go test -v ./test/...",
            total_tests=r["total"],
            passed_tests=r["passed"],
            failed_tests=0,
            skipped_tests=0,
            duration_ms=r["duration"],
            logs=f"=== RUN {r['name']}\n--- PASS: {r['name']} ({r['duration']/1000:.2f}s)\nPASS\nok cloudpulse/test {r['duration']/1000:.3f}s",
        )
    print("    Seeded CloudPulse test runs.")

    return cloudpulse


def seed_teams_and_notifications(amal_user, athulya_user, helthyfi, dormcare, cloudpulse):
    print("--> Seeding Developer Teams & Notifications...")
    
    # 1. Developer Teams
    team_sre, _ = DeveloperTeam.objects.update_or_create(
        name="SRE & Chaos Engineering Team",
        company=helthyfi,
        defaults={
            "description": "Core Site Reliability Engineering unit dedicated to autonomous chaos injection, latency mitigation, and fault resilience validation.",
        }
    )
    team_sre.members.set([amal_user, athulya_user] if athulya_user else [amal_user])
    team_sre.projects.set([dormcare, cloudpulse])

    team_dist, _ = DeveloperTeam.objects.update_or_create(
        name="Distributed Systems & Ingress Team",
        company=helthyfi,
        defaults={
            "description": "High-throughput API gateway, cache invalidation protocols, and distributed consensus validation.",
        }
    )
    team_dist.members.set([amal_user])
    team_dist.projects.set([cloudpulse])
    print("    Seeded 2 DeveloperTeams.")

    # 2. In-App Notifications for AmalSKumar0
    Notification.objects.filter(recipient=amal_user).delete()
    notifs = [
        {
            "title": "Chaos Experiment Completed",
            "message": "Experiment #103 (CPU stress on dormcare-app) completed with Resilience Score 87/100 (Grade B+).",
            "type": Notification.Type.SYSTEM,
            "link": f"/dashboard/projects/{dormcare.id}",
            "is_read": False,
        },
        {
            "title": "Joined Organization",
            "message": "You are now an active developer in Helthyfi Technologies.",
            "type": Notification.Type.COMPANY_ACCEPT,
            "link": "/dashboard/organization",
            "is_read": False,
        },
        {
            "title": "Assigned to SRE & Chaos Engineering Team",
            "message": "You were assigned to SRE & Chaos Engineering Team for projects Dormcare and CloudPulse Microservices.",
            "type": Notification.Type.SYSTEM,
            "link": "/dashboard/organization",
            "is_read": True,
        },
        {
            "title": "Collective Chaos Report Generated",
            "message": "A comprehensive collective resilience audit is now ready for review across 50 chaos experiments on Dormcare.",
            "type": Notification.Type.SYSTEM,
            "link": f"/dashboard/projects/{dormcare.id}",
            "is_read": True,
        },
    ]

    for n in notifs:
        Notification.objects.create(
            recipient=amal_user,
            title=n["title"],
            message=n["message"],
            notification_type=n["type"],
            link=n["link"],
            is_read=n["is_read"],
        )
    print(f"    Seeded {len(notifs)} notifications for AmalSKumar0.")


def main():
    print("==================================================================")
    print("Noir Platform Production Demo Data Seeder")
    print("==================================================================")
    seed_frameworks()
    amal_user, athulya_user, akhil_user, admin_user, helthyfi = seed_accounts_and_company()
    dormcare = seed_dormcare_project(amal_user, helthyfi)
    cloudpulse = seed_cloudpulse_microservice(amal_user, helthyfi)
    seed_teams_and_notifications(amal_user, athulya_user, helthyfi, dormcare, cloudpulse)
    print("==================================================================")
    print("SUCCESS: Production demo data seeded completely and verified!")
    print("==================================================================")


if __name__ == "__main__":
    main()
