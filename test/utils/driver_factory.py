import shutil
import logging
from selenium import webdriver
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chrome.options import Options as ChromeOptions
from test import config

logger = logging.getLogger(__name__)

def create_driver(browser: str = None, headless: bool = None) -> webdriver.Remote:
    """
    Factory to instantiate and configure a Selenium WebDriver.
    Supports Firefox (default), Chrome, and Brave.
    """
    browser_name = (browser or config.DEFAULT_BROWSER).lower()
    is_headless = config.HEADLESS if headless is None else headless

    if browser_name == "firefox":
        options = FirefoxOptions()
        if is_headless:
            options.add_argument("-headless")
        options.add_argument(f"--width={config.WINDOW_WIDTH}")
        options.add_argument(f"--height={config.WINDOW_HEIGHT}")
        
        # Performance & stability preferences
        options.set_preference("dom.webnotifications.enabled", False)
        options.set_preference("media.volume_scale", "0.0")
        
        driver = webdriver.Firefox(options=options)

    elif browser_name in ("chrome", "brave", "chromium"):
        options = ChromeOptions()
        if is_headless:
            options.add_argument("--headless=new")
        options.add_argument(f"--window-size={config.WINDOW_WIDTH},{config.WINDOW_HEIGHT}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")

        if browser_name == "brave":
            brave_path = shutil.which("brave") or shutil.which("brave-browser")
            if brave_path:
                options.binary_location = brave_path

        driver = webdriver.Chrome(options=options)

    else:
        raise ValueError(f"Unsupported browser: {browser_name}. Choose 'firefox', 'chrome', or 'brave'.")

    driver.set_window_size(config.WINDOW_WIDTH, config.WINDOW_HEIGHT)
    driver.implicitly_wait(2)  # short baseline implicit wait, explicit waits preferred
    return driver
