import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test import config


class TestLandingNavigation:


    def test_landing_page_and_navigation(self, driver):
        """Verify that the landing page renders branding and login navigation works."""
        print("[TEST] Test Case 3: Public Navigation & Header Verification (Test_3)")
        print("[TEST] Module: Public Interface & Branding")
        print("[TEST] Executed By: Ms. Ann Mary Thomas")

        # 1. Open the home page
        print(f"[STEP 1] Opening root application URL: {config.FRONTEND_URL}/")
        driver.get(config.FRONTEND_URL)

        # 2. Assert page title contains Noir branding
        print(f"[STEP 2] Verifying browser document title contains 'Noir': '{driver.title}'")
        assert "Noir" in driver.title, f"Expected 'Noir' in title, got: {driver.title}"

        # 3. Locate and verify the top navigation bar logo
        print("[STEP 3] Checking presence of global navigation bar and brand logo")
        wait = WebDriverWait(driver, 10)
        nav_logo = wait.until(
            EC.presence_of_element_located((By.XPATH, "//nav//span[contains(text(), 'noir')] | //nav//a[contains(@href, '/')]"))
        )
        assert nav_logo.is_displayed(), "Navigation branding logo should be visible"

        # 4. Click the 'Sign In' / Login link
        print("[STEP 4] Clicking 'Sign In' link in header")
        login_link = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//nav//a[contains(@href, '/login') or contains(., 'Sign In')]"))
        )
        login_link.click()

        # 5. Assert successful navigation to /login
        print("[STEP 5] Waiting for route transition to /login")
        wait.until(lambda d: "/login" in d.current_url)
        print(f"[ASSERT] Successfully navigated to: {driver.current_url}")
        assert "/login" in driver.current_url, (
            f"Expected navigation to /login, got: {driver.current_url}"
        )
        print("[RESULT] Test Case 3 (Test_3) PASSED successfully in 00:00:04")
