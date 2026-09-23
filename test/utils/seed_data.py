import os
import sys
from pathlib import Path

# Add project root and backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Disambiguate local 'test' package from Python stdlib 'test'
sys.modules.pop("test", None)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django
django.setup()

from apps.accounts.models import User, CompanyProfile
from apps.projects.models import Project
from rest_framework_simplejwt.tokens import RefreshToken
from test import config

def seed_test_database():
    """
    Provisions or updates standard test users and seed data in the backend database.
    Ensures repeatable tests across public, developer, company, and admin workflows.
    """
    print("[seed_data] Checking and seeding test database...")

    # 1. Superuser / Admin
    admin_data = config.ADMIN_USER
    admin_user = User.objects.filter(email=admin_data["email"]).first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username=admin_data["username"],
            email=admin_data["email"],
            password=admin_data["password"],
            first_name=admin_data["first_name"],
            last_name=admin_data["last_name"],
        )
        print(f"[seed_data] Created Admin user: {admin_user.email}")
    else:
        admin_user.set_password(admin_data["password"])
        admin_user.is_superuser = True
        admin_user.is_staff = True
        admin_user.save()
        print(f"[seed_data] Verified Admin user: {admin_user.email}")

    # 2. Company User & CompanyProfile
    comp_data = config.COMPANY_USER
    company_user = User.objects.filter(email=comp_data["email"]).first()
    if not company_user:
        company_user = User.objects.create_user(
            username=comp_data["username"],
            email=comp_data["email"],
            password=comp_data["password"],
            first_name=comp_data["first_name"],
            last_name=comp_data["last_name"],
            role=User.Role.COMPANY,
        )
        print(f"[seed_data] Created Company user: {company_user.email}")
    else:
        company_user.role = User.Role.COMPANY
        company_user.set_password(comp_data["password"])
        company_user.save()
        print(f"[seed_data] Verified Company user: {company_user.email}")

    # Ensure CompanyProfile exists and is approved
    company_profile = CompanyProfile.objects.filter(user=company_user).first()
    if not company_profile:
        company_profile = CompanyProfile.objects.create(
            user=company_user,
            company_name=comp_data.get("company_name", "Velora Tech"),
            status=CompanyProfile.Status.APPROVED,
            industry="Software & Infrastructure",
            company_size="51-200 employees",
            website="https://velora.test",
        )
        print(f"[seed_data] Created approved CompanyProfile for {company_user.email}")
    else:
        company_profile.status = CompanyProfile.Status.APPROVED
        company_profile.company_name = comp_data.get("company_name", "Velora Tech")
        company_profile.save()

    # 3. Developer User
    dev_data = config.DEV_USER
    dev_user = User.objects.filter(email=dev_data["email"]).first()
    if not dev_user:
        dev_user = User.objects.create_user(
            username=dev_data["username"],
            email=dev_data["email"],
            password=dev_data["password"],
            first_name=dev_data["first_name"],
            last_name=dev_data["last_name"],
            role=User.Role.DEVELOPER,
        )
        print(f"[seed_data] Created Developer user: {dev_user.email}")
    else:
        dev_user.role = User.Role.DEVELOPER
        dev_user.set_password(dev_data["password"])
        dev_user.save()
        print(f"[seed_data] Verified Developer user: {dev_user.email}")

    # 4. Test Project for Developer
    test_project = Project.objects.filter(owner=dev_user, title="Noir Test Microservice").first()
    if not test_project:
        test_project = Project.objects.create(
            owner=dev_user,
            title="Noir Test Microservice",
            description="Automated E2E test project for chaos and telemetry validation.",
            architecture=Project.DeploymentType.MICROSERVICE,
            visibility=Project.Visibility.PRIVATE,
            status=Project.Status.ACTIVE,
        )
        print(f"[seed_data] Created test project: {test_project.title} (code: {test_project.connection_code})")
    else:
        print(f"[seed_data] Verified test project: {test_project.title} (code: {test_project.connection_code})")

    return {
        "admin": admin_user,
        "company": company_user,
        "developer": dev_user,
        "project": test_project,
    }

def get_tokens_for_user(user: User) -> dict[str, str]:
    """Generates access and refresh JWT tokens for a test user."""
    refresh = RefreshToken.for_user(user)
    effective_role = "admin" if user.is_superuser else user.role
    refresh["role"] = effective_role
    refresh["email"] = user.email
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "role": effective_role,
        "email": user.email,
        "username": user.username,
        "id": user.id,
    }

if __name__ == "__main__":
    data = seed_test_database()
    print("\nDatabase seeded successfully!")
    print(f"Developer Token generated: {get_tokens_for_user(data['developer'])['access'][:30]}...")
