import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
REPORTS_DIR = BASE_DIR / "reports"
SCREENSHOTS_DIR = REPORTS_DIR / "screenshots"

# Ensure directories exist
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Application URLs
FRONTEND_URL = os.environ.get("NOIR_FRONTEND_URL", "http://localhost:3000").rstrip("/")
BACKEND_URL = os.environ.get("NOIR_BACKEND_URL", "http://localhost:8000").rstrip("/")

# Browser Settings
DEFAULT_BROWSER = os.environ.get("NOIR_BROWSER", "firefox").lower()  # 'firefox', 'chrome', 'brave'
HEADLESS = os.environ.get("NOIR_HEADLESS", "true").lower() in ("true", "1", "yes")
WINDOW_WIDTH = int(os.environ.get("NOIR_WINDOW_WIDTH", "1920"))
WINDOW_HEIGHT = int(os.environ.get("NOIR_WINDOW_HEIGHT", "1080"))

# Timeouts (seconds)
DEFAULT_TIMEOUT = int(os.environ.get("NOIR_TIMEOUT", "10"))
POLL_FREQUENCY = 0.5

# Test Users
DEV_USER = {
    "username": "tester",
    "email": "tester@noir.ai",
    "password": "testpass123",
    "first_name": "Developer",
    "last_name": "Tester",
    "role": "developer",
}

COMPANY_USER = {
    "username": "velora_company",
    "email": "company@noir.ai",
    "password": "testpass123",
    "first_name": "Velora",
    "last_name": "Lead",
    "role": "company",
    "company_name": "Velora Tech",
}

ADMIN_USER = {
    "username": "admin",
    "email": "admin@noir.ai",
    "password": "testpass123",
    "first_name": "System",
    "last_name": "Admin",
    "role": "admin",
}
