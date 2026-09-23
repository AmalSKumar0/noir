#!/usr/bin/env python3
"""
Noir Selenium E2E Test Suite Runner
Execute the entire app test suite or specific modules.
"""

import sys
import os
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.modules.pop("test", None)

from test import config
from test.utils.seed_data import seed_test_database

SUITE_MAPPING = {
    "public": "test/suites/test_01_landing_and_public.py",
    "auth": "test/suites/test_02_auth_and_registration.py",
    "security": "test/suites/test_03_route_guards_and_security.py",
    "developer": "test/suites/test_04_developer_flow.py",
    "company": "test/suites/test_05_company_flow.py",
    "admin": "test/suites/test_06_admin_flow.py",
    "logout": "test/suites/test_07_notifications_and_logout.py",
}

def main():
    parser = argparse.ArgumentParser(description="Noir Automated Selenium E2E Test Runner")
    parser.add_argument(
        "--suite",
        choices=["all", "public", "auth", "security", "developer", "company", "admin", "logout"],
        default="all",
        help="Specify which test suite to run (default: all)",
    )
    parser.add_argument(
        "--browser",
        choices=["firefox", "chrome", "brave"],
        default=config.DEFAULT_BROWSER,
        help="Browser to run tests with (default: firefox)",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        default=False,
        help="Run browser with visible graphical UI (default: headless)",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        default=True,
        help="Seed test database with required test users & projects (default: True)",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        default=False,
        help="Generate an HTML test report in test/reports/report.html",
    )
    parser.add_argument(
        "-k",
        "--keyword",
        help="Filter tests by keyword expression (pytest -k)",
    )

    args, unknown = parser.parse_known_args()

    # Step 1: Ensure database is seeded
    if args.seed:
        print("\n==========================================")
        print("  STEP 1: SEEDING TEST DATABASE")
        print("==========================================")
        try:
            seed_test_database()
        except Exception as e:
            print(f"[Warning] Seeding encountered an error: {e}")

    # Step 2: Build pytest arguments
    print("\n==========================================")
    print(f"  STEP 2: RUNNING SELENIUM E2E SUITE: {args.suite.upper()}")
    print("==========================================")

    pytest_args = ["pytest", "-v"]

    if args.suite == "all":
        pytest_args.append("test/suites")
    else:
        pytest_args.append(SUITE_MAPPING[args.suite])

    pytest_args.extend(["--browser", args.browser])
    if args.headed:
        pytest_args.append("--headed")

    if args.keyword:
        pytest_args.extend(["-k", args.keyword])

    if args.report:
        report_file = config.REPORTS_DIR / "report.html"
        pytest_args.extend([f"--html={report_file}", "--self-contained-html"])

    pytest_args.extend(unknown)

    # Set environment variables for the test process
    env = os.environ.copy()
    env["NOIR_BROWSER"] = args.browser
    env["NOIR_HEADLESS"] = "false" if args.headed else "true"

    import pytest
    exit_code = pytest.main(pytest_args[1:])
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
