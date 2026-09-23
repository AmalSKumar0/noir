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

    def test_login_valid_company_redirects_to_company_dashboard(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        login_page.login(config.COMPANY_USER["email"], config.COMPANY_USER["password"])
        login_page.wait_for_url("/company/dashboard")

        assert "/company/dashboard" in driver.current_url, f"Expected redirect to /company/dashboard, got: {driver.current_url}"

    def test_login_valid_admin_redirects_to_admin_dashboard(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        login_page.login(config.ADMIN_USER["email"], config.ADMIN_USER["password"])
        login_page.wait_for_url("/admin/dashboard")

        assert "/admin/dashboard" in driver.current_url, f"Expected redirect to /admin/dashboard, got: {driver.current_url}"

    def test_login_password_visibility_toggle(self, driver):
        login_page = LoginPage(driver)
        login_page.open()

        login_page.enter_password("SecretPass123!")
        assert login_page.get_password_input_type() == "password", "Initial password input type must be password"

        login_page.toggle_password_visibility()
        assert login_page.get_password_input_type() == "text", "Password input type should become text after clicking toggle"

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

    def test_developer_successful_registration(self, driver):
        reg_page = DeveloperRegisterPage(driver)
        reg_page.open()

        unique_id = int(time.time())
        username = f"dev_{unique_id}"
        email = f"developer_{unique_id}@noirtest.ai"

        reg_page.register(
            username=username,
            email=email,
            password="SecurePass123!",
            confirm_password="SecurePass123!",
        )

        reg_page.wait_for_url("/dashboard")
        assert "/dashboard" in driver.current_url, f"Expected redirect to /dashboard after registration, got: {driver.current_url}"

    def test_company_registration_step_1_and_step_2_fields(self, driver):
        company_page = CompanyRegisterPage(driver)
        company_page.open()

        # Fill Step 1 with valid credentials
        unique_id = int(time.time())
        company_page.fill_stage_1(
            first_name="Jane",
            last_name="Doe",
            email=f"jane_{unique_id}@enterprise.test",
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

    def test_company_full_registration_submission(self, driver):
        company_page = CompanyRegisterPage(driver)
        company_page.open()

        unique_id = int(time.time())
        company_page.fill_stage_1(
            first_name="Atlas",
            last_name="Enterprise",
            email=f"corp_{unique_id}@noirtest.ai",
            password="EnterprisePass123!",
            confirm_password="EnterprisePass123!",
        )

        cert_file = str(config.REPORTS_DIR / "test_cert.pdf")
        company_page.fill_stage_2(
            company_name=f"Atlas Global {unique_id}",
            tax_id=f"TAX-{unique_id}",
            website="https://atlascorp.test",
            phone="+15559876543",
            certificate_path=cert_file,
        )

        # Pending company should be routed to /company/status
        company_page.wait_for_url("/company/status")
        assert "/company/status" in driver.current_url, (
            f"Expected redirect to /company/status after company registration, got: {driver.current_url}"
        )


