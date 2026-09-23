import pytest
import time
from test.pages.company_pages import (
    CompanyDashboardPage,
    CompanyProjectsPage,
    CompanyDevelopersPage,
)
from test import config

class TestCompanyFlow:
    """Verifies company dashboard, managed projects, and developer collaboration."""

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
