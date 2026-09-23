import pytest
import time
from test.pages.admin_pages import (
    AdminDashboardPage,
    AdminManageUsersPage,
    AdminManageCompaniesPage,
    AdminManageProjectsPage,
)
from test import config

class TestAdminFlow:
    """Verifies admin dashboard, user administration, company approvals, and global projects."""

    def test_admin_dashboard_renders(self, auth_driver):
        driver, _ = auth_driver("admin")
        dashboard = AdminDashboardPage(driver)
        dashboard.open()

        assert "/admin/dashboard" in driver.current_url
        assert dashboard.has_admin_navbar(), "Admin navigation header should be visible"

    def test_admin_manage_users(self, auth_driver):
        driver, _ = auth_driver("admin")
        users_page = AdminManageUsersPage(driver)
        users_page.open()

        assert "/admin/users" in driver.current_url
        assert users_page.has_users_table(), "Users table should render on /admin/users"

    def test_admin_manage_companies(self, auth_driver):
        driver, _ = auth_driver("admin")
        companies_page = AdminManageCompaniesPage(driver)
        companies_page.open()

        assert "/admin/companies" in driver.current_url
        # Test clicking status filter
        companies_page.click_pending_filter()

    def test_admin_manage_projects(self, auth_driver):
        driver, _ = auth_driver("admin")
        projects_page = AdminManageProjectsPage(driver)
        projects_page.open()

        assert "/admin/projects" in driver.current_url
        assert projects_page.has_projects_table(), "Projects table should render on /admin/projects"
