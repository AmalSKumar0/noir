import time
import json
from pathlib import Path
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException, StaleElementReferenceException
from test import config

def wait_for_element(driver: WebDriver, locator: tuple[str, str], timeout: int = config.DEFAULT_TIMEOUT) -> WebElement:
    """Waits until an element is present in the DOM and visible."""
    wait = WebDriverWait(driver, timeout, poll_frequency=config.POLL_FREQUENCY)
    return wait.until(EC.visibility_of_element_located(locator))

def wait_for_clickable(driver: WebDriver, locator: tuple[str, str], timeout: int = config.DEFAULT_TIMEOUT) -> WebElement:
    """Waits until an element is clickable."""
    wait = WebDriverWait(driver, timeout, poll_frequency=config.POLL_FREQUENCY)
    return wait.until(EC.element_to_be_clickable(locator))

def wait_for_url_contains(driver: WebDriver, fragment: str, timeout: int = config.DEFAULT_TIMEOUT) -> bool:
    """Waits until the current URL contains the given substring."""
    wait = WebDriverWait(driver, timeout, poll_frequency=config.POLL_FREQUENCY)
    return wait.until(EC.url_contains(fragment))

def safe_click(driver: WebDriver, locator_or_element, timeout: int = config.DEFAULT_TIMEOUT):
    """
    Clicks an element with retry logic and fallback to JavaScript click if intercepted.
    """
    if isinstance(locator_or_element, tuple):
        element = wait_for_clickable(driver, locator_or_element, timeout)
    else:
        element = locator_or_element

    try:
        element.click()
    except (ElementClickInterceptedException, StaleElementReferenceException):
        # Fallback to JavaScript click
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        time.sleep(0.3)
        driver.execute_script("arguments[0].click();", element)

def fill_input(driver: WebDriver, locator: tuple[str, str], text: str, clear: bool = True, timeout: int = config.DEFAULT_TIMEOUT):
    """Waits for an input field, optionally clears it, and types text."""
    element = wait_for_element(driver, locator, timeout)
    if clear:
        element.clear()
    element.send_keys(text)
    return element

def inject_tokens(driver: WebDriver, access_token: str, refresh_token: str = None, role: str = "developer", user_data: dict = None):
    """
    Injects authentication tokens directly into localStorage and triggers the global auth event.
    Must be called after navigating to the app domain (e.g. driver.get(config.FRONTEND_URL)).
    """
    user_json = json.dumps(user_data or {"role": role, "email": f"{role}@noir.ai"})
    script = f"""
    localStorage.setItem('access_token', '{access_token}');
    {f"localStorage.setItem('refresh_token', '{refresh_token}');" if refresh_token else ""}
    localStorage.setItem('user_role', '{role}');
    localStorage.setItem('user', '{user_json}');
    window.dispatchEvent(new Event('noir_auth_state_change'));
    """
    driver.execute_script(script)
    time.sleep(0.3)

def clear_browser_storage(driver: WebDriver):
    """Clears localStorage, sessionStorage, and cookies."""
    try:
        driver.execute_script("localStorage.clear(); sessionStorage.clear();")
    except Exception:
        pass
    driver.delete_all_cookies()

def take_screenshot(driver: WebDriver, name: str) -> str:
    """Takes a full page screenshot and saves it in the screenshots directory."""
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    filename = f"{name}_{timestamp}.png"
    filepath = config.SCREENSHOTS_DIR / filename
    driver.save_screenshot(str(filepath))
    return str(filepath)
