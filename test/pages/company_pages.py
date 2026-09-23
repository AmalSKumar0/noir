from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class CompanyDashboardPage(BasePage):
    """Page Object for Company Dashboard ('/company/dashboard')."""

    METRICS_CARDS = (By.XPATH, "//div[contains(@class, 'rounded') and (.//span or .//h3)]")
    PROJECTS_LINK = (By.XPATH, "//a[contains(@href, '/company/projects')]")
    DEVELOPERS_LINK = (By.XPATH, "//a[contains(@href, '/company/developers')]")
    QUICKSTART_LINK = (By.XPATH, "//a[contains(@href, '/company/quickstart')]")
    USER_NAVBAR = (By.XPATH, "//header | //nav")

    def open(self):
        return super().open("/company/dashboard")

    def has_metrics(self) -> bool:
        return len(self.find_all(self.METRICS_CARDS)) > 0

    def click_projects(self):
        self.click(self.PROJECTS_LINK)
        self.wait_for_url("/company/projects")

    def click_developers(self):
        self.click(self.DEVELOPERS_LINK)
        self.wait_for_url("/company/developers")


class CompanyProjectsPage(BasePage):
    """Page Object for Company Projects ('/company/projects')."""

    PROJECT_LIST = (By.XPATH, "//div[contains(@class, 'grid') or contains(@class, 'flex')]//div[contains(@class, 'group')] | //div[contains(@class, 'rounded') and .//h3]")

    def open(self):
        return super().open("/company/projects")

    def get_projects_count(self) -> int:
        return len(self.find_all(self.PROJECT_LIST))


class CompanyDevelopersPage(BasePage):
    """Page Object for Company Developers Directory ('/company/developers')."""

    DEVELOPERS_HEADER = (By.XPATH, "//*[contains(text(), 'Developers') or contains(text(), 'Directory') or contains(text(), 'Team')]")
    DEVELOPER_ITEMS = (By.XPATH, "//div[contains(@class, 'rounded') and (.//h3 or .//span[contains(@class, 'font-mono')])] | //table//tr")

    def open(self):
        return super().open("/company/developers")

    def has_developers_content(self) -> bool:
        return self.is_visible(self.DEVELOPERS_HEADER)
