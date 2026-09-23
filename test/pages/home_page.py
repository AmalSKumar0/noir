import time
from selenium.webdriver.common.by import By
from test.pages.base_page import BasePage

class HomePage(BasePage):
    """Page Object for the Noir Landing / Home Page ('/')."""

    NAVBAR_LOGO = (By.XPATH, "//nav//span[contains(text(), 'noir')] | //nav//a[contains(@href, '/')]")
    MENU_BUTTON = (By.XPATH, "//nav//button[contains(., 'Menu') or contains(., 'Close')]")
    LOGIN_BUTTON = (By.XPATH, "//nav//a[contains(@href, '/login') or contains(., 'Sign In')]")
    GET_STARTED_BUTTON = (By.XPATH, "//button[contains(., 'GET STARTED')]")
    CONTACT_LINK = (By.XPATH, "//a[contains(@href, '/contact') or contains(., 'Contact')]")
    COMPANY_REGISTER_LINK = (By.XPATH, "//a[contains(@href, '/register/company') or contains(., 'Join as a Company')]")
    HERO_HEADING = (By.XPATH, "//h1 | //main//section")
    FOOTER = (By.TAG_NAME, "footer")

    def open(self):
        return super().open("/")

    def open_menu_if_closed(self):
        """Opens the top sliding tray menu if it's currently closed."""
        if self.is_visible(self.MENU_BUTTON, timeout=3):
            btn = self.find(self.MENU_BUTTON)
            if "menu" in btn.text.lower():
                self.click(self.MENU_BUTTON)
                time.sleep(0.8)

    def click_login(self):
        self.click(self.LOGIN_BUTTON)
        self.wait_for_url("/login")

    def click_get_started(self):
        self.click(self.GET_STARTED_BUTTON)
        self.wait_for_url("/login")

    def click_contact(self):
        self.open_menu_if_closed()
        self.click(self.CONTACT_LINK)
        self.wait_for_url("/contact")

    def click_join_company(self):
        self.open_menu_if_closed()
        self.click(self.COMPANY_REGISTER_LINK)
        self.wait_for_url("/register/company")

    def has_navbar(self) -> bool:
        return self.is_visible(self.NAVBAR_LOGO)

    def has_footer(self) -> bool:
        return self.is_visible(self.FOOTER)
