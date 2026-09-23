from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class LoginPage(BasePage):
    """Page Object for the Login Page ('/login')."""

    EMAIL_INPUT = (By.CSS_SELECTOR, "input[type='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[type='password'], input[placeholder*='Password']")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    ERROR_BANNER = (By.CSS_SELECTOR, "div.text-red-400, div[class*='border-red-500']")
    REGISTER_LINK = (By.XPATH, "//a[contains(@href, '/register') and not(contains(@href, '/register/company'))]")
    COMPANY_REGISTER_LINK = (By.XPATH, "//a[contains(@href, '/register/company')]")

    PASSWORD_TOGGLE_BUTTON = (By.CSS_SELECTOR, "form button[type='button']")

    def open(self):
        return super().open("/login")

    def enter_email(self, email: str):
        self.type(self.EMAIL_INPUT, email)

    def enter_password(self, password: str):
        self.type(self.PASSWORD_INPUT, password)

    def toggle_password_visibility(self):
        self.click(self.PASSWORD_TOGGLE_BUTTON)

    def get_password_input_type(self) -> str:
        return self.find(self.PASSWORD_INPUT).get_attribute("type")

    def submit(self):
        self.click(self.SUBMIT_BUTTON)

    def login(self, email: str, password: str):
        """Fills credentials and submits the login form."""
        self.enter_email(email)
        self.enter_password(password)
        self.submit()

    def get_error_message(self) -> str:
        if self.is_visible(self.ERROR_BANNER, timeout=5):
            return self.get_text(self.ERROR_BANNER)
        return ""

    def click_register(self):
        self.click(self.REGISTER_LINK)
        self.wait_for_url("/register")

    def click_company_register(self):
        self.click(self.COMPANY_REGISTER_LINK)
        self.wait_for_url("/register/company")

