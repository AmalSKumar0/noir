from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class DeveloperDashboardPage(BasePage):
    """Page Object for the Developer Dashboard ('/dashboard')."""

    CREATE_PROJECT_BUTTON = (By.XPATH, "//button[contains(., 'New Project') or contains(., 'Create Project')]")
    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Search' i]")
    PROJECT_CARDS = (By.XPATH, "//div[contains(@class, 'group') and (.//h3 or .//span[contains(@class, 'font-mono')])] | //div[contains(@class, 'rounded') and .//a[contains(@href, '/projects/')]]")
    AGENT_FEED_SECTION = (By.XPATH, "//*[contains(text(), 'Live Feed') or contains(text(), 'Agent') or contains(text(), 'Terminal')]")
    NAV_PROJECTS = (By.XPATH, "//a[contains(@href, '/dashboard/projects') or contains(@href, '/projects')]")
    NAV_QUICKSTART = (By.XPATH, "//a[contains(@href, '/quickstart')]")
    NAV_ORGANIZATION = (By.XPATH, "//a[contains(@href, '/organization')]")
    NAV_PROFILE = (By.XPATH, "//a[contains(@href, '/profile')]")
    NAV_NOTIFICATIONS = (By.XPATH, "//button[contains(@aria-label, 'notification') or .//*[name()='svg' and contains(@class, 'lucide-bell')]]")
    NAV_LOGOUT = (By.XPATH, "//button[contains(@aria-label, 'logout') or contains(., 'Logout') or .//*[name()='svg' and contains(@class, 'lucide-log-out')]]")

    def open(self):
        return super().open("/dashboard")

    def click_create_project(self):
        self.click(self.CREATE_PROJECT_BUTTON)

    def is_create_modal_visible(self) -> bool:
        modal_locator = (By.XPATH, "//div[contains(@class, 'fixed') and .//h3[contains(., 'Project') or contains(., 'Create')]]")
        return self.is_visible(modal_locator, timeout=3)

    def search_projects(self, query: str):
        self.type(self.SEARCH_INPUT, query)

    def get_project_cards_count(self) -> int:
        return len(self.find_all(self.PROJECT_CARDS))

    def click_first_project(self):
        project_link = (By.XPATH, "//a[contains(@href, '/dashboard/projects/') or contains(@href, '/projects/')]")
        self.click(project_link)


class ProjectDetailPage(BasePage):
    """Page Object for Project Detail ('/dashboard/projects/:id')."""

    CONNECTION_CODE = (By.XPATH, "//*[contains(text(), 'NR-') or contains(@class, 'font-mono')]")
    TABS = (By.XPATH, "//button[contains(@role, 'tab') or contains(text(), 'Overview') or contains(text(), 'Terminal') or contains(text(), 'Chaos')]")
    ANALYTICS_LINK = (By.XPATH, "//a[contains(@href, '/analytics')]")
    CHAOS_REPORT_LINK = (By.XPATH, "//a[contains(@href, '/chaos-report')]")

    def open(self, project_id: str):
        return super().open(f"/dashboard/projects/{project_id}")

    def has_connection_code(self) -> bool:
        return self.is_visible(self.CONNECTION_CODE)

    def click_analytics(self):
        self.click(self.ANALYTICS_LINK)
        self.wait_for_url("/analytics")

    def click_chaos_report(self):
        self.click(self.CHAOS_REPORT_LINK)
        self.wait_for_url("/chaos-report")


class ProjectAnalyticsPage(BasePage):
    """Page Object for Project Analytics ('/dashboard/projects/:id/analytics')."""

    ANALYTICS_HEADER = (By.XPATH, "//*[contains(text(), 'Analytics') or contains(text(), 'Metrics') or contains(text(), 'Telemetry')]")
    CHARTS_CONTAINER = (By.XPATH, "//div[contains(@class, 'recharts') or contains(@class, 'chart')] | //svg")

    def open(self, project_id: str):
        return super().open(f"/dashboard/projects/{project_id}/analytics")

    def has_analytics_content(self) -> bool:
        return self.is_visible(self.ANALYTICS_HEADER)


class ChaosReportPage(BasePage):
    """Page Object for Chaos Report ('/dashboard/projects/:id/chaos-report')."""

    REPORT_HEADER = (By.XPATH, "//*[contains(text(), 'Chaos') or contains(text(), 'Report') or contains(text(), 'Experiment')]")

    def open(self, project_id: str):
        return super().open(f"/dashboard/projects/{project_id}/chaos-report")

    def has_report_content(self) -> bool:
        return self.is_visible(self.REPORT_HEADER)


class UserProfilePage(BasePage):
    """Page Object for User Profile ('/profile')."""

    PROFILE_HEADER = (By.XPATH, "//*[contains(text(), 'Profile') or contains(text(), 'Account')]")
    ROLE_BADGE = (By.XPATH, "//*[contains(text(), 'developer') or contains(text(), 'company') or contains(text(), 'admin')]")

    def open(self):
        return super().open("/profile")

    def has_profile_data(self) -> bool:
        return self.is_visible(self.PROFILE_HEADER)


class OrganizationProfilePage(BasePage):
    """Page Object for Organization Profile ('/organization')."""

    ORG_HEADER = (By.XPATH, "//*[contains(text(), 'Organization') or contains(text(), 'Company') or contains(text(), 'Team')]")

    def open(self):
        return super().open("/organization")

    def has_organization_content(self) -> bool:
        return self.is_visible(self.ORG_HEADER)
