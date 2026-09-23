import pytest
import time
from test.pages.login_page import LoginPage
from test.pages.register_page import DeveloperRegisterPage, CompanyRegisterPage
from test import config

class TestAuthAndRegistration:
    """Verifies login, live input validations, and developer/company registration."""

    def test_login_live_email_validation(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        # Type an invalid email format
        login_page.enter_email("not-an-email")
        login_page.enter_password("somepassword")

        # Check inline error indicator
        assert login_page.is_visible(
            (LoginPage.EMAIL_INPUT[0], f"{LoginPage.EMAIL_INPUT[1]}[class*='border-red-500']")
        ), "Invalid email should trigger red border in live validation"

    def test_login_invalid_credentials_shows_error(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        login_page.login("nonexistent_user@noir.ai", "wrongpassword123")
        error_msg = login_page.get_error_message()

        assert error_msg, "Expected error message banner on invalid credentials"
        assert "/login" in driver.current_url, "User should remain on /login after failed attempt"

    def test_login_valid_developer_redirects_to_dashboard(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        login_page.login(config.DEV_USER["email"], config.DEV_USER["password"])
        login_page.wait_for_url("/dashboard")

        assert "/dashboard" in driver.current_url, f"Expected redirect to /dashboard, got: {driver.current_url}"

    def test_developer_registration_live_validation(self, driver):
        reg_page = DeveloperRegisterPage(driver)
        reg_page.open()

        # Type invalid short username and bad email
        reg_page.type(DeveloperRegisterPage.USERNAME_INPUT, "ab")
        reg_page.type(DeveloperRegisterPage.EMAIL_INPUT, "bademail")
        reg_page.type(DeveloperRegisterPage.PASSWORD_INPUT, "short")
        reg_page.type(DeveloperRegisterPage.CONFIRM_PASSWORD_INPUT, "mismatch")

        errors = reg_page.get_inline_errors()
        assert len(errors) > 0, f"Expected live inline errors for invalid inputs, found: {errors}"

    def test_company_registration_step_1_and_step_2_fields(self, driver):
        company_page = CompanyRegisterPage(driver)
        company_page.open()

        # Fill Step 1 with valid credentials
        company_page.fill_stage_1(
            first_name="Jane",
            last_name="Doe",
            email="jane.doe@enterprise.test",
            password="EnterprisePass123!",
            confirm_password="EnterprisePass123!",
        )

        # Should advance to Step 2
        assert company_page.is_visible(CompanyRegisterPage.COMPANY_NAME_INPUT, timeout=5), (
            "Step 2 company name input should appear after completing Step 1"
        )
        assert company_page.is_visible(CompanyRegisterPage.TAX_ID_INPUT, timeout=5), (
            "Step 2 Tax ID / Business Registration input must be visible"
        )
        assert company_page.is_visible(CompanyRegisterPage.CERTIFICATE_INPUT, timeout=5), (
            "Step 2 Ownership / Incorporation Certificate upload input must be present"
        )
