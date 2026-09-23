import time
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from test import config
from test.utils import helpers

class BasePage:
    """Base class for all Page Objects in the Noir test suite."""

    def __init__(self, driver: WebDriver):
        self.driver = driver
        self.base_url = config.FRONTEND_URL

    def open(self, path: str = ""):
        """Navigates to the specified path under base_url."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        self.driver.get(url)
        self.wait_for_page_ready()
        return self

    def wait_for_page_ready(self, timeout: int = 5):
        """Waits for document.readyState and smooth page transition animations."""
        time.sleep(0.3)
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
        except Exception:
            pass

    def get_current_url(self) -> str:
        return self.driver.current_url

    def get_title(self) -> str:
        return self.driver.title

    def find(self, locator: tuple[str, str], timeout: int = config.DEFAULT_TIMEOUT) -> WebElement:
        return helpers.wait_for_element(self.driver, locator, timeout)

    def find_all(self, locator: tuple[str, str]) -> list[WebElement]:
        return self.driver.find_elements(*locator)

    def is_visible(self, locator: tuple[str, str], timeout: int = 3) -> bool:
        try:
            helpers.wait_for_element(self.driver, locator, timeout)
            return True
        except Exception:
            return False

    def click(self, locator: tuple[str, str], timeout: int = config.DEFAULT_TIMEOUT):
        helpers.safe_click(self.driver, locator, timeout)

    def type(self, locator: tuple[str, str], text: str, clear: bool = True, timeout: int = config.DEFAULT_TIMEOUT) -> WebElement:
        return helpers.fill_input(self.driver, locator, text, clear=clear, timeout=timeout)

    def get_text(self, locator: tuple[str, str], timeout: int = config.DEFAULT_TIMEOUT) -> str:
        return self.find(locator, timeout).text

    def wait_for_url(self, fragment: str, timeout: int = config.DEFAULT_TIMEOUT) -> bool:
        return helpers.wait_for_url_contains(self.driver, fragment, timeout)
