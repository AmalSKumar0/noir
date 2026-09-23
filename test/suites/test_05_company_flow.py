import pytest
from selenium.webdriver.support.ui import WebDriverWait
from test.pages.company_pages import (
    CompanyDashboardPage,
    CompanyProjectsPage,
    CompanyDevelopersPage,
    CompanyStatusPage,
)
from test import config

class TestCompanyFlow:
    """Verifies company dashboard, managed projects, developer collaboration, and status."""

    def test_company_dashboard_renders(self, auth_driver):
        driver, _ = auth_driver("company")
        dashboard = CompanyDashboardPage(driver)
        dashboard.open()

        assert "/company/dashboard" in driver.current_url
        assert dashboard.has_metrics(), "Company dashboard should display metrics overview"

    def test_company_projects_page(self, auth_driver):
        driver, _ = auth_driver("company")
        projects_page = CompanyProjectsPage(driver)
        projects_page.open()

        assert "/company/projects" in driver.current_url

    def test_company_developers_directory(self, auth_driver):
        driver, _ = auth_driver("company")
        devs_page = CompanyDevelopersPage(driver)
        devs_page.open()

        assert "/company/developers" in driver.current_url
        assert devs_page.has_developers_content(), "Developers directory should render content"

    def test_company_status_page(self, auth_driver):
        driver, _ = auth_driver("company")
        status_page = CompanyStatusPage(driver)
        status_page.open()

        assert status_page.has_status_content(), "Company status page should display verification or review details"

    def test_company_quickstart_page(self, auth_driver):
        driver, _ = auth_driver("company")
        driver.get(f"{config.FRONTEND_URL}/company/quickstart")

        WebDriverWait(driver, 5).until(lambda d: "/company/quickstart" in d.current_url)
        assert "/company/quickstart" in driver.current_url, f"Expected company quickstart route, got: {driver.current_url}"
