from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class DeveloperRegisterPage(BasePage):
    """Page Object for Developer Registration ('/register')."""

    USERNAME_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Username' i]")
    EMAIL_INPUT = (By.CSS_SELECTOR, "input[type='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Password' i]:not([placeholder*='Confirm' i])")
    CONFIRM_PASSWORD_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Confirm' i]")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    ERROR_BANNER = (By.CSS_SELECTOR, "div.text-red-400, div[class*='border-red-500']")
    LOGIN_LINK = (By.XPATH, "//a[contains(@href, '/login')]")
    INLINE_ERRORS = (By.CSS_SELECTOR, "span.text-red-400")
    CHECK_ICONS = (By.CSS_SELECTOR, "svg.text-emerald-400")

    def open(self):
        return super().open("/register")

    def register(self, username: str, email: str, password: str, confirm_password: str = None):
        self.type(self.USERNAME_INPUT, username)
        self.type(self.EMAIL_INPUT, email)
        self.type(self.PASSWORD_INPUT, password)
        self.type(self.CONFIRM_PASSWORD_INPUT, confirm_password or password)
        self.click(self.SUBMIT_BUTTON)

    def get_error_message(self) -> str:
        if self.is_visible(self.ERROR_BANNER, timeout=5):
            return self.get_text(self.ERROR_BANNER)
        return ""

    def get_inline_errors(self) -> list[str]:
        return [elem.text for elem in self.find_all(self.INLINE_ERRORS) if elem.text.strip()]

    def has_valid_check_icons(self) -> bool:
        return len(self.find_all(self.CHECK_ICONS)) > 0


class CompanyRegisterPage(BasePage):
    """Page Object for Company Registration ('/register/company')."""

    # Stage 1: Admin Account
    FIRST_NAME_INPUT = (By.CSS_SELECTOR, "input[placeholder*='First' i]")
    LAST_NAME_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Last' i]")
    EMAIL_INPUT = (By.CSS_SELECTOR, "input[type='email'], input[placeholder*='Email' i]")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Password' i]:not([placeholder*='Confirm' i])")
    CONFIRM_PASSWORD_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Confirm' i]")
    NEXT_BUTTON = (By.XPATH, "//button[contains(., 'Next') or @type='submit']")

    # Stage 2: Company Details & Verification
    COMPANY_NAME_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Company' i]")
    TAX_ID_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Tax ID' i]")
    CERTIFICATE_INPUT = (By.CSS_SELECTOR, "input[type='file'][accept*='pdf']")
    WEBSITE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Website' i]")
    PHONE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Phone' i]")
    SUBMIT_BUTTON = (By.XPATH, "//button[contains(., 'Complete') or contains(., 'Register') or @type='submit']")
    ERROR_BANNER = (By.CSS_SELECTOR, "div.text-red-400, div[class*='border-red-500']")
    INLINE_ERRORS = (By.CSS_SELECTOR, "span.text-red-400")

    def open(self):
        return super().open("/register/company")

    def fill_stage_1(self, first_name: str, last_name: str, email: str, password: str, confirm_password: str = None):
        self.type(self.FIRST_NAME_INPUT, first_name)
        self.type(self.LAST_NAME_INPUT, last_name)
        self.type(self.EMAIL_INPUT, email)
        self.type(self.PASSWORD_INPUT, password)
        self.type(self.CONFIRM_PASSWORD_INPUT, confirm_password or password)
        self.click(self.NEXT_BUTTON)

    def fill_stage_2(self, company_name: str, tax_id: str, website: str = "", phone: str = "", certificate_path: str = ""):
        self.type(self.COMPANY_NAME_INPUT, company_name)
        self.type(self.TAX_ID_INPUT, tax_id)
        if website:
            self.type(self.WEBSITE_INPUT, website)
        if phone:
            self.type(self.PHONE_INPUT, phone)
        if certificate_path and self.is_visible(self.CERTIFICATE_INPUT, timeout=2):
            self.find(self.CERTIFICATE_INPUT).send_keys(certificate_path)
        self.click(self.SUBMIT_BUTTON)

    def get_error_message(self) -> str:
        if self.is_visible(self.ERROR_BANNER, timeout=5):
            return self.get_text(self.ERROR_BANNER)
        return ""
