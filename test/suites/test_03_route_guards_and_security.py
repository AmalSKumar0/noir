import pytest
from selenium.webdriver.support.ui import WebDriverWait
from test import config
from test.utils.helpers import clear_browser_storage

class TestRouteGuardsAndSecurity:
    """Verifies access control, role boundaries, and protected route enforcement."""

    def test_unauthenticated_dashboard_redirects_to_login(self, driver):
        clear_browser_storage(driver)
        driver.get(f"{config.FRONTEND_URL}/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Unauthenticated user should be redirected to /login, got: {driver.current_url}"

    def test_unauthenticated_company_dashboard_redirects_to_login(self, driver):
        clear_browser_storage(driver)
        driver.get(f"{config.FRONTEND_URL}/company/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Unauthenticated company route should redirect to /login, got: {driver.current_url}"

    def test_unauthenticated_admin_dashboard_redirects_to_login(self, driver):
        clear_browser_storage(driver)
        driver.get(f"{config.FRONTEND_URL}/admin/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Unauthenticated admin route should redirect to /login, got: {driver.current_url}"

    def test_unauthenticated_quickstart_redirects_to_login(self, driver):
        clear_browser_storage(driver)
        driver.get(f"{config.FRONTEND_URL}/quickstart")

        WebDriverWait(driver, 10).until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Unauthenticated quickstart should redirect to /login, got: {driver.current_url}"

    def test_unauthenticated_projects_redirects_to_login(self, driver):
        clear_browser_storage(driver)
        driver.get(f"{config.FRONTEND_URL}/dashboard/projects")

        WebDriverWait(driver, 10).until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Unauthenticated projects should redirect to /login, got: {driver.current_url}"

    def test_developer_cannot_access_admin_dashboard(self, auth_driver):
        driver, _ = auth_driver("developer")
        driver.get(f"{config.FRONTEND_URL}/admin/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/admin/dashboard" not in d.current_url)
        assert "/admin/dashboard" not in driver.current_url, (
            f"Developer must not be allowed on /admin/dashboard, current URL: {driver.current_url}"
        )
        assert "/dashboard" in driver.current_url, f"Developer should be redirected to role home, got: {driver.current_url}"

    def test_developer_cannot_access_company_dashboard(self, auth_driver):
        driver, _ = auth_driver("developer")
        driver.get(f"{config.FRONTEND_URL}/company/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/company/dashboard" not in d.current_url)
        assert "/company/dashboard" not in driver.current_url, (
            f"Developer must not be allowed on /company/dashboard, current URL: {driver.current_url}"
        )
        assert "/dashboard" in driver.current_url, f"Developer should be redirected to role home, got: {driver.current_url}"

    def test_company_cannot_access_admin_dashboard(self, auth_driver):
        driver, _ = auth_driver("company")
        driver.get(f"{config.FRONTEND_URL}/admin/dashboard")

        WebDriverWait(driver, 10).until(lambda d: "/admin/dashboard" not in d.current_url)
        assert "/admin/dashboard" not in driver.current_url, (
            f"Company must not be allowed on /admin/dashboard, current URL: {driver.current_url}"
        )
        assert "/company/dashboard" in driver.current_url, f"Company should be redirected to company dashboard, got: {driver.current_url}"

    def test_authenticated_user_accessing_login_redirects_to_dashboard(self, auth_driver):
        driver, _ = auth_driver("developer")
        driver.get(f"{config.FRONTEND_URL}/login")

        WebDriverWait(driver, 10).until(lambda d: "/login" not in d.current_url)
        assert "/login" not in driver.current_url, (
            f"PublicOnlyRoute should redirect logged-in user away from /login, got: {driver.current_url}"
        )
        assert "/dashboard" in driver.current_url, f"Expected redirect to /dashboard, got: {driver.current_url}"
