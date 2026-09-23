from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class ContactPage(BasePage):
    """Page Object for the Contact Page ('/contact')."""

    HEADING = (By.XPATH, "//h1[contains(text(), 'Contact')]")
    FIRST_NAME_INPUT = (By.CSS_SELECTOR, "input[name='firstName']")
    LAST_NAME_INPUT = (By.CSS_SELECTOR, "input[name='lastName']")
    EMAIL_INPUT = (By.CSS_SELECTOR, "input[name='email']")
    PROJECT_DESC_INPUT = (By.CSS_SELECTOR, "textarea[name='projectDescription']")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    SUCCESS_BANNER = (By.XPATH, "//*[contains(text(), 'Message Received') or contains(text(), 'Thank you')]")

    def open(self):
        return super().open("/contact")

    def is_loaded(self) -> bool:
        return self.is_visible(self.HEADING, timeout=5)

    def submit_contact_form(self, first_name: str, last_name: str, email: str, message: str):
        if self.is_visible(self.FIRST_NAME_INPUT, timeout=5):
            self.type(self.FIRST_NAME_INPUT, first_name)
        if self.is_visible(self.LAST_NAME_INPUT, timeout=5):
            self.type(self.LAST_NAME_INPUT, last_name)
        self.type(self.EMAIL_INPUT, email)
        if self.is_visible(self.PROJECT_DESC_INPUT, timeout=5):
            self.type(self.PROJECT_DESC_INPUT, message)
        self.click(self.SUBMIT_BUTTON)

    def is_submission_successful(self) -> bool:
        return self.is_visible(self.SUCCESS_BANNER, timeout=5)
