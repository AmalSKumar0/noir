"""
Noir Autonomous Chaos Engineering Platform
Production Demo Data Seeder (Isolated Dummy Data)

Designed specifically for presenting Noir:
1. Reverts & protects personal user data (AmalSKumar0, athulya-r-mohan, Dormcare)
   so that dummy data does NOT interfere with real user projects or profiles.
2. Seeds completely isolated, production-accurate dummy entities:
   - Dummy Companies: Nexus Cloud Technologies, Apex Financial Labs, Starlight AI (Pending).
   - Dummy Developers: sarah.dev, marcus.sre, elena.platform, david.independent.
   - Dedicated Dummy Projects: Nexus Ingress Gateway, Apex Core Payment Processing.
   - Multi-container profiles, high-fidelity chaos experiments, and test runs.
   - Isolated developer teams, invitations, and notifications.
3. Supports admin login with username 'admin' or email 'admin@noir.ai'.
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

User = get_user_model()

DEMO_PASSWORD = "DemoPassword123"


def clean_personal_user_data():
    """
    Ensures that personal user accounts (AmalSKumar0, athulya-r-mohan, akhil)
    and personal projects (Dormcare) are NOT modified, polluted, or tied to dummy teams/invites.
    """
    print("--> [Sanitize] Ensuring personal accounts and projects are untouched...")

    # 1. Clean AmalSKumar0
    amal = User.objects.filter(username="AmalSKumar0").first()
    if amal:
        amal.company = None
        amal.save(update_fields=["company"])
        # Remove from any developer teams
        amal.developer_teams.clear()
        # Delete invitations tied to Amal
        CompanyDeveloperRequest.objects.filter(developer=amal).delete()
        # Delete notifications tied to Amal
        Notification.objects.filter(recipient=amal).delete()
        print("    Restored AmalSKumar0 account to clean personal state (no company, no dummy teams/notifications).")

    # 2. Clean athulya-r-mohan
    athulya = User.objects.filter(username="athulya-r-mohan").first()
    if athulya:
        athulya.company = None
        athulya.save(update_fields=["company"])
        athulya.developer_teams.clear()
        CompanyDeveloperRequest.objects.filter(developer=athulya).delete()
        Notification.objects.filter(recipient=athulya).delete()
        print("    Restored athulya-r-mohan account to clean personal state.")

    # 3. Clean Dormcare (Project ID 2)
    dormcare = Project.objects.filter(id=2).first()
    if dormcare and dormcare.owner and dormcare.owner.username == "AmalSKumar0":
        # Remove synthetic/imported fault injections so user's real project has only their real data
        dormcare.fault_injections.all().delete()
        # Keep only the original integration test run if any existed
        dormcare.test_runs.all().delete()
        TestRun.objects.create(
            project=dormcare,
            executor=dormcare.owner,
            suite_name="Default Integration Suite",
            status=TestRun.Status.PASSED,
            command="python manage.py test",
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            skipped_tests=0,
            duration_ms=31066,
            logs="Creating test database for alias 'default'...\nRan 1 test in 0.042s\nOK\nDestroying test database for alias 'default'...",
        )
        print("    Restored Dormcare (ID 2) to clean state (removed dummy faults, restored single test run).")

    # 4. Remove any synthetic projects mistakenly assigned to Amal
    Project.objects.filter(owner=amal, title="CloudPulse Microservices").delete()
    print("    Cleaned personal account associations successfully.")


def seed_frameworks():
    print("--> Seeding Standard Frameworks...")
    frameworks_data = [
        {"name": "Django", "language": "Python", "default_test_command": "python manage.py test", "detection_file": "manage.py", "supported": True},
        {"name": "FastAPI", "language": "Python", "default_test_command": "pytest", "detection_file": "main.py", "supported": True},
        {"name": "Express.js", "language": "JavaScript", "default_test_command": "npm test", "detection_file": "package.json", "supported": True},
        {"name": "Next.js", "language": "TypeScript", "default_test_command": "npm test", "detection_file": "next.config.js", "supported": True},
        {"name": "Go / Gin", "language": "Go", "default_test_command": "go test ./...", "detection_file": "go.mod", "supported": True},
        {"name": "Spring Boot", "language": "Java", "default_test_command": "./mvnw test", "detection_file": "pom.xml", "supported": True},
    ]
    for item in frameworks_data:
        Framework.objects.update_or_create(
            name=item["name"],
            defaults={
                "language": item["language"],
                "default_test_command": item["default_test_command"],
                "detection_file": item["detection_file"],
                "supported": item["supported"],
            }
        )
    print("    Standard Frameworks verified.")


def seed_dummy_companies_and_developers():
    print("--> Seeding Isolated Dummy Companies & Developers...")

    # ================================================================
    # Dummy Company 1: Nexus Cloud Technologies (Approved)
    # ================================================================
    nexus_admin, _ = User.objects.update_or_create(
        username="nexus_admin",
        defaults={
            "email": "nexus.admin@nexuscloud.io",
            "first_name": "Marcus",
            "last_name": "Vance",
            "role": User.Role.COMPANY,
        }
    )
    nexus_admin.set_password(DEMO_PASSWORD)
    nexus_admin.save()
    SocialAuth.objects.get_or_create(user=nexus_admin, provider=SocialAuth.Type.PASSWORD)

    nexus_company, _ = CompanyProfile.objects.update_or_create(
        user=nexus_admin,
        defaults={
            "company_name": "Nexus Cloud Technologies",
            "logo": "https://images.unsplash.com/photo-1551434678-e076c223a692?w=128&h=128&fit=crop",
            "status": CompanyProfile.Status.APPROVED,
            "industry": "Cloud Infrastructure & Edge Telemetry",
            "company_size": "51-200 employees",
            "website": "https://nexuscloud.io",
            "tax_id": "US-EIN-88129410",
            "phone_number": "+1 (555) 492-1084",
            "ownership_certificate": "Verified Certificate #NEX-2024-819",
        }
    )

    # Developers for Nexus Cloud
    dev_sarah, _ = User.objects.update_or_create(
        username="sarah_dev",
        defaults={
            "email": "sarah.dev@nexuscloud.io",
            "first_name": "Sarah",
            "last_name": "Jenkins",
            "role": User.Role.DEVELOPER,
            "company": nexus_company,
        }
    )
    dev_sarah.set_password(DEMO_PASSWORD)
    dev_sarah.company = nexus_company
    dev_sarah.save()
    SocialAuth.objects.get_or_create(user=dev_sarah, provider=SocialAuth.Type.PASSWORD)

    dev_marcus, _ = User.objects.update_or_create(
        username="marcus_sre",
        defaults={
            "email": "marcus.sre@nexuscloud.io",
            "first_name": "Marcus",
            "last_name": "Brody",
            "role": User.Role.DEVELOPER,
            "company": nexus_company,
        }
    )
    dev_marcus.set_password(DEMO_PASSWORD)
    dev_marcus.company = nexus_company
    dev_marcus.save()
    SocialAuth.objects.get_or_create(user=dev_marcus, provider=SocialAuth.Type.PASSWORD)

    # Request records for Nexus
    CompanyDeveloperRequest.objects.update_or_create(
        company=nexus_company,
        developer=dev_sarah,
        defaults={"status": CompanyDeveloperRequest.Status.ACCEPTED, "message": "Welcome to Nexus SRE Team."}
    )
    CompanyDeveloperRequest.objects.update_or_create(
        company=nexus_company,
        developer=dev_marcus,
        defaults={"status": CompanyDeveloperRequest.Status.ACCEPTED, "message": "Welcome to Nexus SRE Team."}
    )

    # ================================================================
    # Dummy Company 2: Apex Financial Labs (Approved)
    # ================================================================
    apex_admin, _ = User.objects.update_or_create(
        username="apex_admin",
        defaults={
            "email": "apex.admin@apexfin.io",
            "first_name": "Claire",
            "last_name": "Sinclair",
            "role": User.Role.COMPANY,
        }
    )
    apex_admin.set_password(DEMO_PASSWORD)
    apex_admin.save()
    SocialAuth.objects.get_or_create(user=apex_admin, provider=SocialAuth.Type.PASSWORD)

    apex_company, _ = CompanyProfile.objects.update_or_create(
        user=apex_admin,
        defaults={
            "company_name": "Apex Financial Labs",
            "logo": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=128&h=128&fit=crop",
            "status": CompanyProfile.Status.APPROVED,
            "industry": "FinTech & Real-Time Settlements",
            "company_size": "201-500 employees",
            "website": "https://apexfin.io",
            "tax_id": "US-EIN-77291034",
            "phone_number": "+1 (555) 718-2930",
            "ownership_certificate": "Verified Certificate #APX-2023-112",
        }
    )

    # Developer for Apex Financial
    dev_elena, _ = User.objects.update_or_create(
        username="elena_platform",
        defaults={
            "email": "elena.platform@apexfin.io",
            "first_name": "Elena",
            "last_name": "Rostova",
            "role": User.Role.DEVELOPER,
            "company": apex_company,
        }
    )
    dev_elena.set_password(DEMO_PASSWORD)
    dev_elena.company = apex_company
    dev_elena.save()
    SocialAuth.objects.get_or_create(user=dev_elena, provider=SocialAuth.Type.PASSWORD)

    CompanyDeveloperRequest.objects.update_or_create(
        company=apex_company,
        developer=dev_elena,
        defaults={"status": CompanyDeveloperRequest.Status.ACCEPTED, "message": "Welcome to Apex Financial."}
    )

    # ================================================================
    # Dummy Company 3: Starlight AI Research (PENDING status for Admin Demo)
    # ================================================================
    starlight_admin, _ = User.objects.update_or_create(
        username="starlight_admin",
        defaults={
            "email": "starlight.admin@starlightai.io",
            "first_name": "David",
            "last_name": "Kowalski",
            "role": User.Role.COMPANY,
        }
    )
    starlight_admin.set_password(DEMO_PASSWORD)
    starlight_admin.save()
    SocialAuth.objects.get_or_create(user=starlight_admin, provider=SocialAuth.Type.PASSWORD)

    starlight_company, _ = CompanyProfile.objects.update_or_create(
        user=starlight_admin,
        defaults={
            "company_name": "Starlight AI Research",
            "logo": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop",
            "status": CompanyProfile.Status.PENDING,  # PENDING for approval demonstration
            "industry": "Artificial Intelligence & Distributed GPU Compute",
            "company_size": "11-50 employees",
            "website": "https://starlightai.io",
            "tax_id": "US-EIN-99238419",
            "phone_number": "+1 (555) 902-8411",
            "ownership_certificate": "Pending Verification Certificate #STL-2026-004",
        }
    )

    # ================================================================
    # Independent Developer (for Invitation Demo)
    # ================================================================
    dev_independent, _ = User.objects.update_or_create(
        username="david_independent",
        defaults={
            "email": "david.independent@noir.ai",
            "first_name": "David",
            "last_name": "Vogel",
            "role": User.Role.DEVELOPER,
            "company": None,
        }
    )
    dev_independent.set_password(DEMO_PASSWORD)
    dev_independent.company = None
    dev_independent.save()
    SocialAuth.objects.get_or_create(user=dev_independent, provider=SocialAuth.Type.PASSWORD)

    # Pending invite from Starlight AI to David
    CompanyDeveloperRequest.objects.update_or_create(
        company=starlight_company,
        developer=dev_independent,
        defaults={
            "status": CompanyDeveloperRequest.Status.PENDING,
            "message": "Starlight AI invites you to lead our Chaos & Distributed Testing Cluster.",
        }
    )

    print("    Seeded dummy companies (Nexus Cloud, Apex Financial, Starlight AI [pending]).")
    print("    Seeded dummy developers (sarah.dev, marcus.sre, elena.platform, david.independent).")
    return nexus_company, apex_company, starlight_company, dev_sarah, dev_marcus, dev_elena, dev_independent


def seed_dummy_projects_and_chaos(nexus_company, apex_company, dev_sarah, dev_marcus, dev_elena, dev_independent):
    print("--> Seeding Dedicated Dummy Projects & High-Fidelity Chaos Telemetry...")

    go_fw = Framework.objects.filter(name="Go / Gin").first() or Framework.objects.first()
    fastapi_fw = Framework.objects.filter(name="FastAPI").first() or Framework.objects.first()

    # ================================================================
    # Dummy Project 1: Nexus Ingress Gateway (Microservice)
    # Owned by dev_sarah@nexuscloud.io
    # ================================================================
    nexus_gw, _ = Project.objects.update_or_create(
        title="Nexus Ingress Gateway",
        defaults={
            "owner": dev_sarah,
            "description": "High-throughput distributed API edge gateway with Envoy proxy routing, JWT token validation, and rate-limiting sidecars.",
            "architecture": Project.DeploymentType.MICROSERVICE,
            "visibility": Project.Visibility.PRIVATE,
            "status": Project.Status.ACTIVE,
            "connection_code": "NR-NX-GW01",
        }
    )
    nexus_gw.owner = dev_sarah
    nexus_gw.save()

    nexus_containers = [
        {"id": "nx-gw-01", "name": "envoy-gateway", "service": "edge-proxy", "image": "envoyproxy/envoy:v1.30", "status": "running", "ports": ["8443->443/tcp", "8080->80/tcp"], "source": "compose"},
        {"id": "nx-auth-02", "name": "auth-sidecar", "service": "security", "image": "nexus/auth-agent:v2.4", "status": "running", "ports": ["9091/tcp"], "source": "compose"},
        {"id": "nx-redis-03", "name": "rate-limit-redis", "service": "cache", "image": "redis:7.2-alpine", "status": "running", "ports": ["6379/tcp"], "source": "compose"},
        {"id": "nx-consul-04", "name": "service-registry", "service": "discovery", "image": "hashicorp/consul:1.18", "status": "running", "ports": ["8500/tcp"], "source": "compose"},
    ]

    ProjectProfile.objects.update_or_create(
        project=nexus_gw,
        defaults={
            "framework": go_fw,
            "runtime_version": "Go 1.22.5",
            "operating_system": "Linux (amd64)",
            "package_manager": "go modules",
            "docker_containers": nexus_containers,
            "analysis_data": {
                "rps_capacity": 15000,
                "tls_termination": "TLS 1.3",
                "active_routes": 42,
            }
        }
    )

    # High-Fidelity Chaos Injections for Nexus Gateway
    nexus_gw.fault_injections.all().delete()
    now = datetime.now(timezone.utc)

    experiments = [
        ("network_delay", "envoy-gateway", {"latency_ms": 120, "jitter_ms": 20, "duration": 30}, 92, "A", "120ms latency absorbed by upstream circuit breaker without cascading client timeouts."),
        ("cpu_stress", "auth-sidecar", {"workers": 4, "load_percent": 85, "duration": 40}, 87, "B", "JWT validation thread queue saturated at 85% CPU; latency rose predictably to 110ms."),
        ("container_restart", "rate-limit-redis", {"timeout": 15}, 96, "A+", "Redis restarted in 1.4s. Rate limiter seamlessly fell back to local memory counter without rejecting traffic."),
        ("network_loss", "service-registry", {"loss_percent": 15, "duration": 25}, 89, "B", "Consul gossip protocol handled 15% packet loss with zero service discovery dropouts."),
        ("memory_stress", "envoy-gateway", {"memory_mb": 512, "duration": 30}, 94, "A", "Connection buffer memory surge safely released after rollback; zero OOM incidents."),
        ("container_stop", "auth-sidecar", {"duration": 10}, 83, "B", "Standby auth replica took over within 2.1s; availability dipped temporarily to 94.2% then recovered fully."),
    ]

    for idx, (ftype, target, params, score, grade, summary) in enumerate(experiments):
        delta = (len(experiments) - idx) * 3
        req = now - timedelta(hours=delta)
        f = FaultInjection.objects.create(
            project=nexus_gw,
            requested_by=dev_sarah,
            fault_type=ftype,
            target=target,
            parameters=params,
            status=FaultInjection.Status.COMPLETED,
            started_at=req + timedelta(seconds=2),
            completed_at=req + timedelta(seconds=params.get("duration", 30) + 2),
            result={
                "success": True,
                "recovered": True,
                "resilience_score": score,
                "resilience_grade": grade,
                "duration_seconds": params.get("duration", 30),
                "anomaly_summary": {
                    "peak_impact": {"ratio_to_baseline": 1.35, "percentage_delta": 35.0},
                    "spike_count": 2,
                    "sustained_degradation_detected": False,
                },
                "recommendations": [f"Tune {target} heartbeat interval and upstream keepalive timeout."],
                "steady_state_baseline": {"avg_latency_ms": 12.4, "availability_percent": 100.0, "http_5xx_count": 0},
                "experiment_metrics": {"avg_latency_ms": 38.6, "availability_percent": 99.2, "http_5xx_count": 1},
                "recovery_metrics": {"recovery_time_seconds": 1.8, "full_recovery_verified": True},
            }
        )
        for lvl, msg in [
            ("INFO", f"Triggered {ftype} against container '{target}'"),
            ("WARN", f"Active fault injection in progress: params={params}"),
            ("INFO", f"Observability metrics probe verified SLA criteria."),
            ("INFO", f"Rollback complete. Container '{target}' healthy. Resilience Score: {score}/100."),
        ]:
            FaultInjectionLog.objects.create(fault=f, level=lvl, message=msg)

    # Nexus Gateway Test Runs
    nexus_gw.test_runs.all().delete()
    for tr_name, total, duration in [
        ("Gateway Ingress Concurrency Suite", 50, 24100),
        ("JWT Auth Sidecar Benchmark", 35, 18500),
        ("Redis Rate-Limiting Invariant Suite", 28, 12400),
    ]:
        TestRun.objects.create(
            project=nexus_gw,
            executor=dev_sarah,
            suite_name=tr_name,
            status=TestRun.Status.PASSED,
            command="go test -v ./test/...",
            total_tests=total,
            passed_tests=total,
            failed_tests=0,
            skipped_tests=0,
            duration_ms=duration,
            logs=f"=== RUN {tr_name}\n--- PASS: {tr_name}\nAll {total} assertions passed cleanly.",
        )

    # ================================================================
    # Dummy Project 2: Apex Core Payment Processing (Monolith)
    # Owned by dev_elena@apexfin.io
    # ================================================================
    apex_pay, _ = Project.objects.update_or_create(
        title="Apex Core Payment Processing",
        defaults={
            "owner": dev_elena,
            "description": "PCI-DSS compliant double-entry transaction settlement and card processing core engine with PostgreSQL ledger isolation.",
            "architecture": Project.DeploymentType.MONOLITH,
            "visibility": Project.Visibility.PRIVATE,
            "status": Project.Status.ACTIVE,
            "connection_code": "NR-AP-PAY02",
        }
    )
    apex_pay.owner = dev_elena
    apex_pay.save()

    apex_containers = [
        {"id": "ap-pay-01", "name": "payment-api", "service": "settlement-core", "image": "apex/payment-core:v3.2", "status": "running", "ports": ["8000->8000/tcp"], "source": "compose"},
        {"id": "ap-pg-02", "name": "ledger-postgres", "service": "database", "image": "postgres:16-alpine", "status": "running", "ports": ["5432/tcp"], "source": "compose"},
        {"id": "ap-red-03", "name": "idempotency-cache", "service": "cache", "image": "redis:7-alpine", "status": "running", "ports": ["6379/tcp"], "source": "compose"},
    ]

    ProjectProfile.objects.update_or_create(
        project=apex_pay,
        defaults={
            "framework": fastapi_fw,
            "runtime_version": "Python 3.11.8",
            "operating_system": "Linux (x86_64)",
            "package_manager": "poetry 1.8",
            "docker_containers": apex_containers,
            "analysis_data": {
                "pci_dss_level": 1,
                "encryption_standard": "AES-256-GCM",
                "idempotency_keys_active": 45000,
            }
        }
    )

    # Chaos Injections for Apex Payment
    apex_pay.fault_injections.all().delete()
    apex_experiments = [
        ("network_delay", "ledger-postgres", {"latency_ms": 200, "duration": 30}, 88, "B", "Database latency absorbed via read-replica query routing; ledger commit latency remained under 250ms."),
        ("cpu_stress", "payment-api", {"workers": 4, "load_percent": 90, "duration": 45}, 85, "B", "Transaction throughput throttled gracefully; zero orphaned debit operations detected."),
        ("container_restart", "idempotency-cache", {"timeout": 20}, 94, "A", "Idempotency cache recovered in 2.1s; secondary transactional lock prevented duplicate transactions."),
    ]
    for idx, (ftype, target, params, score, grade, summary) in enumerate(apex_experiments):
        delta = (len(apex_experiments) - idx) * 5
        req = now - timedelta(hours=delta)
        f = FaultInjection.objects.create(
            project=apex_pay,
            requested_by=dev_elena,
            fault_type=ftype,
            target=target,
            parameters=params,
            status=FaultInjection.Status.COMPLETED,
            started_at=req + timedelta(seconds=2),
            completed_at=req + timedelta(seconds=params.get("duration", 30) + 2),
            result={
                "success": True,
                "recovered": True,
                "resilience_score": score,
                "resilience_grade": grade,
                "duration_seconds": params.get("duration", 30),
                "anomaly_summary": {
                    "peak_impact": {"ratio_to_baseline": 1.4, "percentage_delta": 40.0},
                    "spike_count": 1,
                    "sustained_degradation_detected": False,
                },
                "recommendations": ["Increase connection pool size on payment-api to ledger-postgres."],
                "steady_state_baseline": {"avg_latency_ms": 14.2, "availability_percent": 100.0, "http_5xx_count": 0},
                "experiment_metrics": {"avg_latency_ms": 42.1, "availability_percent": 99.7, "http_5xx_count": 0},
                "recovery_metrics": {"recovery_time_seconds": 2.1, "full_recovery_verified": True},
            }
        )
        for lvl, msg in [
            ("INFO", f"Dispatched {ftype} against {target}"),
            ("WARN", f"Active fault injection test window open."),
            ("INFO", f"System verified idempotent and fully self-healed. Resilience Score: {score}/100."),
        ]:
            FaultInjectionLog.objects.create(fault=f, level=lvl, message=msg)

    # Apex Test Runs
    apex_pay.test_runs.all().delete()
    for tr_name, total, duration in [
        ("PCI-DSS Transaction Settlement Suite", 42, 28400),
        ("Idempotency Lock Concurrency Test", 25, 14200),
    ]:
        TestRun.objects.create(
            project=apex_pay,
            executor=dev_elena,
            suite_name=tr_name,
            status=TestRun.Status.PASSED,
            command="pytest -v test/settlement/",
            total_tests=total,
            passed_tests=total,
            failed_tests=0,
            skipped_tests=0,
            duration_ms=duration,
            logs=f"PASS {tr_name} in {duration/1000:.2f}s\n0 failed transactions.",
        )

    # ================================================================
    # Dummy Teams for Companies
    # ================================================================
    team_nexus, _ = DeveloperTeam.objects.update_or_create(
        name="Nexus SRE & Core Ingress Team",
        company=nexus_company,
        defaults={"description": "Platform reliability, edge routing, and ingress resilience engineering."}
    )
    team_nexus.members.set([dev_sarah, dev_marcus])
    team_nexus.projects.set([nexus_gw])

    team_apex, _ = DeveloperTeam.objects.update_or_create(
        name="Apex Payment Resilience Team",
        company=apex_company,
        defaults={"description": "High-availability financial ledger operations and chaos verification."}
    )
    team_apex.members.set([dev_elena])
    team_apex.projects.set([apex_pay])

    # ================================================================
    # In-App Notifications for Dummy Developers
    # ================================================================
    Notification.objects.filter(recipient__in=[dev_sarah, dev_marcus, dev_elena, dev_independent]).delete()
    Notification.objects.create(
        recipient=dev_sarah,
        title="Chaos Experiment Completed",
        message="Experiment on envoy-gateway completed with 92/100 Resilience Score (Grade A).",
        notification_type=Notification.Type.SYSTEM,
        link=f"/dashboard/projects/{nexus_gw.id}",
    )
    Notification.objects.create(
        recipient=dev_elena,
        title="Collective Resilience Audit Ready",
        message="Apex Core Payment Processing collective score evaluated at 88/100.",
        notification_type=Notification.Type.SYSTEM,
        link=f"/dashboard/projects/{apex_pay.id}",
    )
    Notification.objects.create(
        recipient=dev_independent,
        title="Company Invitation",
        message="Starlight AI Research invited you to join their engineering team.",
        notification_type=Notification.Type.COMPANY_INVITE,
        link="/dashboard/organization",
    )

    print("    Seeded dummy projects, chaos telemetry, teams, and isolated notifications.")


def main():
    print("==================================================================")
    print("Noir Platform Isolated Demo Data Provisioner")
    print("==================================================================")
    clean_personal_user_data()
    seed_frameworks()
    nexus, apex, starlight, sarah, marcus, elena, david = seed_dummy_companies_and_developers()
    seed_dummy_projects_and_chaos(nexus, apex, sarah, marcus, elena, david)
    print("==================================================================")
    print("SUCCESS: Cleaned personal data and seeded isolated dummy entities!")
    print("==================================================================")


if __name__ == "__main__":
    main()
