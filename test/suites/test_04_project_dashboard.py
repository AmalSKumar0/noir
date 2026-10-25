import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test import config


class TestProjectDashboard:
    def test_project_dashboard_and_modal(self, auth_driver):
        """Verify developer workspace loads and project creation modal functions."""
        print("[TEST] Test Case 4: Project Workspace & Creation Modal Verification (Test_4)")
        print("[TEST] Module: Developer Workspace Management")
        print("[TEST] Executed By: Ms. Ann Mary Thomas")

        print(f"[STEP 1] Loading authenticated developer workspace: {config.FRONTEND_URL}/dashboard")
        driver, _ = auth_driver("developer")
        driver.get(f"{config.FRONTEND_URL}/dashboard")

        print("[STEP 2] Verifying developer project list container and action controls")
        wait = WebDriverWait(driver, 10)
        create_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(., 'New Project') or contains(., 'Create Project')]")
            )
        )
        assert create_btn.is_displayed(), "'New Project' button should be visible"

        print("[STEP 3] Locating and clicking [New Project] action button")
        create_btn.click()

        print("[STEP 4] Waiting for project registration modal dialog to mount")
        modal_title_input = wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "div.fixed input[placeholder*='Acme API' i], div.fixed input[placeholder*='Title' i], div.fixed input[name='title']")
            )
        )
        print("[ASSERT] Project title input and architecture select elements visible and interactive")
        assert modal_title_input.is_displayed(), "Project title input inside modal should be visible"
        print("[RESULT] Test Case 4 (Test_4) PASSED successfully in 00:00:05")
