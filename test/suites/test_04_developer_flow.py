import pytest
import time
from test.pages.developer_pages import (
    DeveloperDashboardPage,
    ProjectDetailPage,
    ProjectAnalyticsPage,
    ChaosReportPage,
    UserProfilePage,
    OrganizationProfilePage,
    QuickstartPage,
    UserProjectsPage,
)
from test import config

class TestDeveloperFlow:
    """Verifies developer dashboard, project creation, telemetry, analytics, and navigation."""

    def test_developer_dashboard_renders(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        assert "/dashboard" in driver.current_url
        assert dashboard.is_visible(DeveloperDashboardPage.CREATE_PROJECT_BUTTON)

    def test_create_project_modal_opens(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        dashboard.click_create_project()
        assert dashboard.is_create_modal_visible(), "Create Project modal should open on click"

    def test_create_project_full_flow(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        unique_title = f"Service-{int(time.time())}"
        dashboard.create_project(title=unique_title, description="Automated reliability telemetry test node.")
        time.sleep(1.5)
        assert dashboard.get_project_cards_count() >= 1

    def test_developer_search_projects(self, auth_driver):
        driver, _ = auth_driver("developer")
        dashboard = DeveloperDashboardPage(driver)
        dashboard.open()

        dashboard.search_projects("Noir Test")
        assert dashboard.get_project_cards_count() >= 1

    def test_project_detail_and_telemetry(self, auth_driver, ensure_test_database):
        driver, _ = auth_driver("developer")
        project = ensure_test_database["project"]
        
        detail_page = ProjectDetailPage(driver)
        detail_page.open(str(project.id))

        assert detail_page.has_connection_code(), f"Expected connection code {project.connection_code} to be visible"

    def test_project_analytics_page(self, auth_driver, ensure_test_database):
        driver, _ = auth_driver("developer")
        project = ensure_test_database["project"]

        analytics_page = ProjectAnalyticsPage(driver)
        analytics_page.open(str(project.id))

        assert analytics_page.has_analytics_content(), "Analytics page should display telemetry and charts"

    def test_chaos_report_page(self, auth_driver, ensure_test_database):
        driver, _ = auth_driver("developer")
        project = ensure_test_database["project"]

        report_page = ChaosReportPage(driver)
        report_page.open(str(project.id))

        assert report_page.has_report_content(), "Chaos Report page should display experiment report header"

    def test_developer_quickstart_page(self, auth_driver):
        driver, _ = auth_driver("developer")
        quickstart = QuickstartPage(driver)
        quickstart.open()

        assert quickstart.has_quickstart_content(), "Quickstart page should display CLI guide"
        quickstart.search_commands("connect")

    def test_developer_user_projects_list(self, auth_driver):
        driver, _ = auth_driver("developer")
        projects_page = UserProjectsPage(driver)
        projects_page.open()

        assert projects_page.has_projects_grid(), "User projects page should display projects grid"

    def test_user_profile_page(self, auth_driver):
        driver, _ = auth_driver("developer")
        profile_page = UserProfilePage(driver)
        profile_page.open()

        assert profile_page.has_profile_data(), "User profile page should display account details"

    def test_organization_profile_page(self, auth_driver):
        driver, _ = auth_driver("developer")
        org_page = OrganizationProfilePage(driver)
        org_page.open()

        assert org_page.has_organization_content(), "Organization page should render content"
