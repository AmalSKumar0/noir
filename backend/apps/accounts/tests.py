from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import CompanyProfile, Notification, DeveloperTeam, SocialAuth

User = get_user_model()


class AccountsAuthAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.dev_password = "SecurePassword123!"
        self.dev_user = User.objects.create_user(
            username="dev_tester",
            email="developer@noir.ai",
            password=self.dev_password,
            role=User.Role.DEVELOPER,
            first_name="Dev",
            last_name="Tester",
        )
        SocialAuth.objects.create(user=self.dev_user, provider=SocialAuth.Type.PASSWORD)

        self.company_user = User.objects.create_user(
            username="company_admin",
            email="company@noir.ai",
            password="CompanyPassword123!",
            role=User.Role.COMPANY,
            first_name="Corp",
            last_name="Admin",
        )
        self.company_profile = CompanyProfile.objects.create(
            user=self.company_user,
            company_name="Acme Corp",
            status=CompanyProfile.Status.APPROVED,
            industry="Cloud Engineering",
            company_size="50-100",
            tax_id="TAX-998877",
        )

        self.admin_user = User.objects.create_superuser(
            username="super_admin",
            email="admin@noir.ai",
            password="AdminPassword123!",
        )

    def test_developer_registration_success(self):
        url = "/api/accounts/register/"
        payload = {
            "username": "new_dev",
            "email": "newdev@noir.ai",
            "password": "Password789!",
            "first_name": "New",
            "last_name": "Dev",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.DEVELOPER)

        # Verify password in DB
        created_user = User.objects.get(username="new_dev")
        self.assertTrue(created_user.check_password("Password789!"))
        self.assertEqual(created_user.role, User.Role.DEVELOPER)

    def test_registration_duplicate_email_with_existing_password_fails(self):
        url = "/api/accounts/register/"
        payload = {
            "username": "another_dev",
            "email": "developer@noir.ai",  # same email as self.dev_user
            "password": "DifferentPass123!",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_company_registration_creates_pending_profile(self):
        url = "/api/accounts/register/company/"
        payload = {
            "first_name": "Chief",
            "last_name": "Officer",
            "email": "newcorp@noir.ai",
            "password": "CorporatePass123!",
            "company_name": "Reliability Labs Inc",
            "tax_id": "REG-123456",
            "industry": "Chaos Engineering",
            "website": "https://rellabs.ai",
            "company_size": "10-50",
            "phone_number": "+1234567890",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.COMPANY)

        # Verify CompanyProfile is PENDING
        created_user = User.objects.get(email="newcorp@noir.ai")
        self.assertTrue(hasattr(created_user, "company_profile"))
        self.assertEqual(created_user.company_profile.status, CompanyProfile.Status.PENDING)
        self.assertEqual(created_user.company_profile.tax_id, "REG-123456")

    def test_login_valid_credentials_developer(self):
        url = "/api/accounts/login/"
        payload = {
            "email": "developer@noir.ai",
            "password": self.dev_password,
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.DEVELOPER)

    def test_login_case_insensitive_email(self):
        url = "/api/accounts/login/"
        payload = {
            "email": "DEVELOPER@NOIR.AI",
            "password": self.dev_password,
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_invalid_password(self):
        url = "/api/accounts/login/"
        payload = {
            "email": "developer@noir.ai",
            "password": "wrong_password_here",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_email(self):
        url = "/api/accounts/login/"
        payload = {
            "email": "unknown_ghost@noir.ai",
            "password": "Password123!",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_valid(self):
        refresh = RefreshToken.for_user(self.dev_user)
        url = "/api/accounts/token/refresh/"
        payload = {"refresh": str(refresh)}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_token_refresh_invalid(self):
        url = "/api/accounts/token/refresh/"
        payload = {"refresh": "invalid.jwt.token"}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_whoami_authenticated(self):
        self.client.force_authenticate(user=self.dev_user)
        url = "/api/accounts/me/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "developer@noir.ai")
        self.assertEqual(response.data["role"], User.Role.DEVELOPER)

    def test_whoami_unauthenticated(self):
        url = "/api/accounts/me/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_company_me_endpoint_as_company(self):
        self.client.force_authenticate(user=self.company_user)
        url = "/api/accounts/company/me/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data.get("company_profile"))
        self.assertEqual(response.data["company_profile"]["company_name"], "Acme Corp")
        self.assertEqual(response.data["company_profile"]["status"], CompanyProfile.Status.APPROVED)

    def test_company_me_endpoint_as_developer_returns_null_profile(self):
        self.client.force_authenticate(user=self.dev_user)
        url = "/api/accounts/company/me/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get("company_profile"))
        self.assertEqual(response.data["role"], User.Role.DEVELOPER)

    def test_notifications_crud(self):
        self.client.force_authenticate(user=self.dev_user)
        notif = Notification.objects.create(
            recipient=self.dev_user,
            title="Experiment Completed",
            message="Your CPU stress test has finished with Grade A.",
            notification_type=Notification.Type.SYSTEM,
        )

        # 1. List
        list_url = "/api/accounts/notifications/"
        res_list = self.client.get(list_url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data["notifications"]), 1)
        self.assertEqual(res_list.data["unread_count"], 1)
        self.assertFalse(res_list.data["notifications"][0]["is_read"])

        # 2. Mark Read (POST)
        read_url = f"/api/accounts/notifications/{notif.id}/read/"
        res_read = self.client.post(read_url)
        self.assertEqual(res_read.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

        # 3. Delete
        del_url = f"/api/accounts/notifications/{notif.id}/"
        res_del = self.client.delete(del_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(id=notif.id).count(), 0)

    def test_developer_team_creation_by_company(self):
        self.client.force_authenticate(user=self.company_user)
        url = "/api/accounts/company/teams/"
        payload = {
            "name": "Reliability SRE Core",
            "description": "Cross-functional reliability squad",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Reliability SRE Core")
        self.assertEqual(response.data["company"], self.company_profile.id)
