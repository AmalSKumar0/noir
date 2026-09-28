from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class UserManagementAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin_user = User.objects.create_superuser(
            username="admin_user",
            email="admin@noir.ai",
            password="AdminPass123!",
        )
        self.dev_user_1 = User.objects.create_user(
            username="developer_one",
            email="dev1@noir.ai",
            password="DevPass123!",
            role=User.Role.DEVELOPER,
        )
        self.dev_user_2 = User.objects.create_user(
            username="developer_two",
            email="dev2@noir.ai",
            password="DevPass123!",
            role=User.Role.DEVELOPER,
        )

    def test_list_users_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/user/all/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return non-superuser accounts
        results = response.data.get("results", response.data)
        usernames = [u["username"] for u in results]
        self.assertIn("developer_one", usernames)
        self.assertIn("developer_two", usernames)
        self.assertNotIn("admin_user", usernames)

    def test_list_users_forbidden_for_developer(self):
        self.client.force_authenticate(user=self.dev_user_1)
        response = self.client.get("/api/user/all/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_users_unauthenticated(self):
        response = self.client.get("/api/user/all/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_user_detail_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f"/api/user/{self.dev_user_1.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "developer_one")
        self.assertEqual(response.data["email"], "dev1@noir.ai")

    def test_retrieve_user_detail_forbidden_for_regular_user(self):
        self.client.force_authenticate(user=self.dev_user_1)
        response = self.client.get(f"/api/user/{self.dev_user_2.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_user_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(f"/api/user/{self.dev_user_2.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(User.objects.filter(id=self.dev_user_2.id).count(), 0)
