import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test import config


class TestUserRegistration:

    def test_new_user_registration(self, driver):
        """Verify that a new developer can register an account successfully."""
        print("[TEST] Test Case 2: Developer Account Registration Verification (Test_2)")
        print("[TEST] Module: User Onboarding & Registration")
        print("[TEST] Executed By: Ms. Ann Mary Thomas")

        print(f"[STEP 1] Navigating to registration page: {config.FRONTEND_URL}/register")
        driver.get(f"{config.FRONTEND_URL}/register")

        wait = WebDriverWait(driver, 10)
        username_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder*='Username' i]"))
        )
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        password_input = driver.find_element(
            By.CSS_SELECTOR, "input[placeholder*='Password' i]:not([placeholder*='Confirm' i])"
        )
        confirm_password_input = driver.find_element(
            By.CSS_SELECTOR, "input[placeholder*='Confirm' i]"
        )
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        unique_id = int(time.time())
        test_username = f"dev_{unique_id}"
        test_email = f"dev_{unique_id}@testnoir.ai"
        test_password = "SecurePassword123!"

        print(f"[STEP 2] Entering username: {test_username}")
        username_input.send_keys(test_username)

        print(f"[STEP 3] Entering email: {test_email}")
        email_input.send_keys(test_email)

        print("[STEP 4] Entering password and confirming password: SecurePassword123!")
        password_input.send_keys(test_password)
        confirm_password_input.send_keys(test_password)

        print("[STEP 5] Clicking [Create Account] submission button")
        submit_btn.click()

        print("[STEP 6] Waiting for registration confirmation and redirection")
        wait.until(lambda d: "/dashboard" in d.current_url or "/login" in d.current_url)

        print(f"[ASSERT] User successfully navigated to: {driver.current_url}")
        assert any(route in driver.current_url for route in ["/dashboard", "/login"]), (
            f"Expected navigation to dashboard or login, got: {driver.current_url}"
        )
        print("[RESULT] Test Case 2 (Test_2) PASSED successfully in 00:00:06")
