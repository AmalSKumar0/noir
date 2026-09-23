import pytest
import time
from test.pages.developer_pages import DeveloperDashboardPage
from test import config

class TestNotificationsAndLogout:
    """Verifies notification center and logout/session invalidation."""

    def test_notification_inbox_toggle(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        if dashboard.is_visible(DeveloperDashboardPage.NAV_NOTIFICATIONS, timeout=5):
            dashboard.click(DeveloperDashboardPage.NAV_NOTIFICATIONS)
            time.sleep(0.5)

    def test_logout_clears_tokens_and_redirects(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        # Trigger logout by navigating to /logout
        driver.get(f"{config.FRONTEND_URL}/logout")
        time.sleep(1.5)

        # Assert redirected to /login
        assert "/login" in driver.current_url, f"Expected redirect to /login after logout, got: {driver.current_url}"

        # Assert tokens are cleared from localStorage
        access_token = driver.execute_script("return localStorage.getItem('access_token');")
        assert access_token is None, "access_token should be deleted from localStorage after logout"

        # Attempt to access protected dashboard after logout
        driver.get(f"{config.FRONTEND_URL}/dashboard")
        time.sleep(1)
        assert "/login" in driver.current_url, "Accessing /dashboard after logout should redirect to /login"
