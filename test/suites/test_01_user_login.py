import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test import config


class TestUserLogin:
    """
    Test Case 1: User Login Verification
    Test Case ID: Test_1
    Module: Authentication & Access Control
    Executed By: Ms. Ann Mary Thomas
    """

    def test_valid_user_login(self, driver):
        """Verify that a valid user can successfully log into the dashboard."""
        print("[TEST] Test Case 1: User Login Verification (Test_1)")
        print("[TEST] Module: Authentication & Access Control")
        print("[TEST] Executed By: Ms. Ann Mary Thomas")

        # 1. Open the login page
        print(f"[STEP 1] Launching browser and navigating to {config.FRONTEND_URL}/login")
        driver.get(f"{config.FRONTEND_URL}/login")

        # 2. Locate inputs and submit button
        print("[STEP 2] Locating email and password input elements")
        wait = WebDriverWait(driver, 10)
        email_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
        )
        password_input = driver.find_element(
            By.CSS_SELECTOR, "input[type='password'], input[placeholder*='Password']"
        )
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        # 3. Enter credentials
        print(f"[STEP 3] Entering registered developer email: {config.DEV_USER['email']}")
        email_input.clear()
        email_input.send_keys(config.DEV_USER["email"])

        print("[STEP 4] Entering developer password: •••••••••••")
        password_input.clear()
        password_input.send_keys(config.DEV_USER["password"])
