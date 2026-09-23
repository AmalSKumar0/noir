# Noir Selenium Automated E2E Testing Suite

A complete, enterprise-grade Selenium end-to-end testing suite for the entire Noir application.

---

## Architecture Overview

```
test/
├── README.md                          # Documentation and execution instructions
├── requirements.txt                   # Test dependencies (selenium, pytest, pytest-html)
├── config.py                          # URLs, credentials, timeouts, browser options
├── conftest.py                        # Pytest fixtures, driver lifecycle, auto-screenshots
├── run_tests.py                       # CLI test runner with service health checks & aliases
├── reports/
│   ├── test_cert.pdf                  # Valid minimal PDF fixture for company registration
│   ├── screenshots/                   # Auto-captured failure screenshots
│   └── report.html                    # Generated HTML test execution report
├── utils/
│   ├── driver_factory.py              # Cross-browser WebDriver builder (Firefox, Chrome, Brave)
│   ├── helpers.py                     # Safe clicks, explicit waits, token injection, screenshots
│   └── seed_data.py                   # Automated Django test database seeder
├── pages/                             # Page Object Model (POM)
│   ├── base_page.py                   # Base abstractions & wait helpers
│   ├── home_page.py                   # Landing page elements and actions
│   ├── contact_page.py                # Contact form POM with fields and confirmation banner
│   ├── login_page.py                  # Login form with live email validation & password toggle
│   ├── register_page.py               # Developer & Company registration with Tax ID & PDF upload
│   ├── developer_pages.py             # Developer Dashboard, Project Creation, Analytics, Reports, Quickstart
│   ├── company_pages.py               # Company Dashboard, Status Review, Projects, Developers Directory
│   └── admin_pages.py                 # Admin Dashboard, Users, Company Approvals & Document Review
└── suites/                            # Modular Test Suites (48 E2E Tests)
    ├── test_01_landing_and_public.py      # Landing, Navigation, Contact Form, 404 fallback
    ├── test_02_auth_and_registration.py  # Live validation, Company/Dev/Admin login, Password toggle, PDF upload
    ├── test_03_route_guards_and_security.py # Unauthenticated redirects, Developer/Company/Admin boundaries
    ├── test_04_developer_flow.py         # Dashboard, Create project modal, Search, Telemetry, Analytics, Chaos
    ├── test_05_company_flow.py           # Company Dashboard, Pending review status, Projects, Developers
    ├── test_06_admin_flow.py             # Admin Dashboard, User table, Company approval modal, Project cards
    └── test_07_notifications_and_logout.py # Notifications dropdown toggle, Logout & token revocation
```

---

## Prerequisites

1. **Active Services**:
   - Backend running on `http://localhost:8000`
   - Frontend running on `http://localhost:3000`
2. **Browser**:
   - Firefox is installed on your Linux system (`/usr/bin/firefox`) and used by default.
   - Geckodriver is managed automatically by Selenium.

---

## Running Tests

### Option 1: Using the all-in-one CLI runner

Execute the entire test suite:
```bash
uv run --with selenium --with pytest --with pytest-html python test/run_tests.py
```
Or using your backend python virtual environment:
```bash
./backend/venv/bin/python test/run_tests.py
```

### Option 2: Running specific suites

Run only the public and navigation suite:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite public
```

Run only authentication and registration tests:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite auth
```

Run security and route guard tests:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite security
```

Run developer workflows:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite developer
```

Run company workflows:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite company
```

Run admin workflows:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite admin
```

Run session and logout tests:
```bash
uv run --with selenium --with pytest python test/run_tests.py --suite logout
```

---

## Runner Options & Flags

| Flag | Description | Default |
|---|---|---|
| `--suite <name>` | `all`, `public` (alias: `contact`), `auth`, `security`, `developer`, `company`, `admin`, `logout` (alias: `notifications`) | `all` |
| `--check-services` | Verify backend (http://localhost:8000) and frontend (http://localhost:3000) are healthy before running tests | False |
| `--browser <name>` | `firefox`, `chrome`, `brave` | `firefox` |
| `--headed` | Run browser in visible graphical window | Headless |
| `--report` | Generate self-contained HTML report in `test/reports/report.html` | False |
| `-k <keyword>` | Run only tests matching a name pattern (pytest filter) | None |

Example with service readiness check and HTML report:
```bash
./backend/venv/bin/python test/run_tests.py --check-services --report
```

---

## Key Features Tested

1. **Live Validation**:
   - Real-time format validation for email with visual feedback icons.
   - Password strength indicator (Weak, Medium, Strong) and length checks.
   - Real-time password confirmation match indicator.
2. **Company Verification**:
   - Compulsory Tax ID / Business Registration number input and verification format.
   - Business Ownership / Incorporation Certificate document upload (PDF, PNG, JPG).
   - Admin review and download of uploaded company verification documents.
3. **Role & Route Security**:
   - Route protection preventing unauthenticated users from accessing dashboards.
   - Strict role boundary checks (Developer blocked from Admin/Company routes, Company blocked from Developer routes).
   - `PublicOnlyRoute` redirecting authenticated users away from `/login`.
4. **Session & Token Invalidation**:
   - Complete cleanup of tokens on `/logout`.
   - Prevention of back-navigation to protected pages.
