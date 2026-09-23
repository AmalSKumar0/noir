import pytest
import time
from selenium.webdriver.support.ui import WebDriverWait
from test.pages.home_page import HomePage
from test.pages.login_page import LoginPage
from test.pages.contact_page import ContactPage
from test import config

class TestLandingAndPublic:
    """Verifies public landing pages, navigation bars, and routing fallbacks."""

    def test_landing_page_renders_properly(self, driver):
        home_page = HomePage(driver)
        home_page.open()

        assert "Noir" in home_page.get_title(), f"Expected 'Noir' in title, got: {home_page.get_title()}"
        assert home_page.has_navbar(), "Navbar should be visible on landing page"
        assert home_page.has_footer(), "Footer should be visible on landing page"

    def test_navigation_to_login(self, driver):
        home_page = HomePage(driver)
        home_page.open()
        home_page.click_login()

        assert "/login" in driver.current_url, f"Expected to navigate to /login, got: {driver.current_url}"

    def test_navigation_to_join_company(self, driver):
        home_page = HomePage(driver)
        home_page.open()
        home_page.click_join_company()

        assert "/register/company" in driver.current_url, f"Expected to navigate to /register/company, got: {driver.current_url}"

    def test_navigation_to_contact(self, driver):
        home_page = HomePage(driver)
        home_page.open()
        home_page.click_contact()

        assert "/contact" in driver.current_url, f"Expected to navigate to /contact, got: {driver.current_url}"

    def test_contact_form_submission(self, driver):
        contact_page = ContactPage(driver)
        contact_page.open()

        assert contact_page.is_loaded(), "Contact page heading should be visible"
        contact_page.submit_contact_form(
            first_name="Alex",
            last_name="Tester",
            email="alex.tester@noir.ai",
            message="Evaluating Noir platform for enterprise chaos telemetry.",
        )
        assert contact_page.is_submission_successful(), "Submission success message should be displayed"

    def test_wildcard_fallback_redirects_to_home(self, driver):
        driver.get(f"{config.FRONTEND_URL}/some-unknown-fallback-path-xyz")
        
        # Wait for React Router's Navigate component to redirect to home
        WebDriverWait(driver, 5).until(
            lambda d: d.current_url.rstrip("/") == config.FRONTEND_URL.rstrip("/")
        )

        assert driver.current_url.rstrip("/") == config.FRONTEND_URL.rstrip("/"), (
            f"Expected redirection to root URL, got: {driver.current_url}"
        )

