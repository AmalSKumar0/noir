import sys
import os
from pathlib import Path
import pytest

# Ensure project root is in sys.path and stdlib 'test' module does not shadow local test package
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.modules.pop("test", None)

from test import config
from test.utils.driver_factory import create_driver
from test.utils.helpers import clear_browser_storage, inject_tokens, take_screenshot
from test.utils.seed_data import seed_test_database, get_tokens_for_user

def pytest_addoption(parser):
    parser.addoption(
        "--browser",
        action="store",
        default=config.DEFAULT_BROWSER,
        help="Browser to run tests against: 'firefox', 'chrome', 'brave'",
    )
    parser.addoption(
        "--headed",
        action="store_true",
        default=False,
        help="Run browser in visible graphical mode (default is headless)",
    )
    parser.addoption(
        "--app-url",
        action="store",
        default=config.FRONTEND_URL,
        help="Frontend application URL",
    )

@pytest.fixture(scope="session", autouse=True)
def ensure_test_database():
    """Seeds required test accounts and data once per test session."""
    return seed_test_database()

@pytest.fixture(scope="function")
def driver(request):
    """
    Function-scoped WebDriver fixture.
    Launches a clean browser session and ensures it is closed after each test.
    Captures a screenshot automatically if the test fails.
    """
    browser = request.config.getoption("--browser")
    headed = request.config.getoption("--headed")
    headless = not headed

    driver_instance = create_driver(browser=browser, headless=headless)
    
    # Clean initial state
    driver_instance.get(config.FRONTEND_URL)
    clear_browser_storage(driver_instance)

    yield driver_instance

    # Auto-screenshot on failure
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        test_name = request.node.name.replace("[", "_").replace("]", "_")
        try:
            path = take_screenshot(driver_instance, f"FAIL_{test_name}")
            print(f"\n[FAILURE SCREENSHOT] Saved to: {path}")
        except Exception as e:
            print(f"\n[FAILURE SCREENSHOT] Failed to capture: {e}")

    try:
        driver_instance.quit()
    except Exception:
        pass

@pytest.fixture
def auth_driver(driver, ensure_test_database):
    """
    Helper fixture factory that returns an authenticated driver for a specific role:
    usage: auth_driver("developer"), auth_driver("company"), auth_driver("admin")
    """
    def _authenticate(role: str = "developer"):
        user = ensure_test_database.get(role)
        if not user:
            raise ValueError(f"Unknown test role: {role}")

        tokens = get_tokens_for_user(user)
        driver.get(config.FRONTEND_URL)
        inject_tokens(
            driver=driver,
            access_token=tokens["access"],
            refresh_token=tokens["refresh"],
            role=tokens["role"],
            user_data=tokens,
        )
        return driver, tokens

    return _authenticate

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Stores test outcome in test node for report and screenshot hooks."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)
