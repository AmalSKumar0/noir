from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class AdminDashboardPage(BasePage):
    """Page Object for Admin Dashboard ('/admin/dashboard')."""

    NAV_OVERVIEW = (By.XPATH, "//nav//a[contains(@href, '/admin/dashboard') or contains(text(), 'Overview')]")
    NAV_USERS = (By.XPATH, "//nav//a[contains(@href, '/admin/users') or contains(text(), 'Users')]")
    NAV_COMPANIES = (By.XPATH, "//nav//a[contains(@href, '/admin/companies') or contains(text(), 'Companies')]")
    NAV_PROJECTS = (By.XPATH, "//nav//a[contains(@href, '/admin/projects') or contains(text(), 'Projects')]")
    METRIC_CARDS = (By.XPATH, "//div[contains(@class, 'rounded') and (.//span or .//h3)]")

    def open(self):
        return super().open("/admin/dashboard")

    def has_admin_navbar(self) -> bool:
        return self.is_visible(self.NAV_OVERVIEW)

    def click_users(self):
        self.click(self.NAV_USERS)
        self.wait_for_url("/admin/users")

    def click_companies(self):
        self.click(self.NAV_COMPANIES)
        self.wait_for_url("/admin/companies")

    def click_projects(self):
        self.click(self.NAV_PROJECTS)
        self.wait_for_url("/admin/projects")


class AdminManageUsersPage(BasePage):
    """Page Object for Admin Users Management ('/admin/users')."""

    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Search' i]")
    USERS_TABLE = (By.XPATH, "//table | //div[contains(@class, 'overflow-x-auto')]")
    USER_ROWS = (By.XPATH, "//tbody//tr | //div[contains(@class, 'rounded') and .//span[contains(text(), '@')]]")

    def open(self):
        return super().open("/admin/users")

    def has_users_table(self) -> bool:
        return self.is_visible(self.USERS_TABLE)

    def search_users(self, query: str):
        self.type(self.SEARCH_INPUT, query)


class AdminManageCompaniesPage(BasePage):
    """Page Object for Admin Companies Management ('/admin/companies')."""

    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Search' i]")
    FILTER_PENDING = (By.XPATH, "//button[contains(text(), 'Pending') or contains(., 'pending')]")
    FILTER_APPROVED = (By.XPATH, "//button[contains(text(), 'Approved') or contains(., 'approved')]")
    COMPANY_ROWS = (By.XPATH, "//tbody//tr | //div[contains(@class, 'rounded') and .//button[contains(text(), 'View')]]")
    VIEW_BUTTON = (By.XPATH, "//button[contains(., 'View') or .//*[name()='svg' and contains(@class, 'lucide-eye')]]")

    def open(self):
        return super().open("/admin/companies")

    def click_pending_filter(self):
        if self.is_visible(self.FILTER_PENDING, timeout=3):
            self.click(self.FILTER_PENDING)

    def click_view_first_company(self):
        if self.is_visible(self.VIEW_BUTTON, timeout=3):
            self.click(self.VIEW_BUTTON)


class AdminManageProjectsPage(BasePage):
    """Page Object for Admin Global Projects Management ('/admin/projects')."""

    PROJECTS_TABLE = (By.XPATH, "//table | //div[contains(@class, 'overflow-x-auto')]")
    PROJECT_ROWS = (By.XPATH, "//tbody//tr | //div[contains(@class, 'rounded') and (.//h3 or .//span[contains(@class, 'font-mono')])] ")

    def open(self):
        return super().open("/admin/projects")

    def has_projects_table(self) -> bool:
        return self.is_visible(self.PROJECTS_TABLE)
