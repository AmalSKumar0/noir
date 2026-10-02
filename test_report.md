# Noir Selenium Automated E2E Test Execution Report

> **Execution Date:** September 28, 2026  
> **Target Environment:** Local Full-Stack Development Environment  
> **Status:** **ALL TESTS PASSED (100% Success Rate)**

---

## 1. Executive Summary

An automated End-to-End (E2E) Selenium testing session was executed across the entire Noir enterprise platform. The test suite exercises user-facing web interfaces, cross-role workflows, live validations, authentication lifecycles, and route security policies against active backend and frontend services.

### Key Metrics

| Metric | Result |
|---|---|
| **Total Test Suites** | 7 Suites |
| **Total Test Cases** | 48 Tests |
| **Passed** | **48 (100%)** |
| **Failed** | **0 (0%)** |
| **Skipped / Blocked** | **0 (0%)** |
| **Total Duration** | **320.11 seconds (~5m 20s)** |
| **Exit Code** | `0` (Success) |
| **HTML Report Artifact** | `test/reports/report.html` |

```
============================== 48 passed in 320.11s (0:05:20) ==============================
```

| Component | Specification / Version | Notes |
|---|---|---|
| **Operating System** | Linux (Kernel 7.2.3-arch1-3-x86_64, glibc 2.44) | Native Linux environment |
| **Python Runtime** | Python 3.14.7 (`backend/venv/bin/python`) | Isolated virtualenv |
| **Pytest Version** | `pytest 9.1.1` | Core test framework |
| **Selenium Version** | `selenium 4.49.0` | Browser automation engine with automatic driver manager |
| **Reporting Plugin** | `pytest-html 4.2.0` | Self-contained HTML report generator |
| **Browser** | Mozilla Firefox (`/usr/bin/firefox`) | Headless Mode (`--headless`), resolution 1920×1080 |
| **Frontend Endpoint** | `http://localhost:3000` | React / Vite Single Page Application (Active) |
| **Backend Endpoint** | `http://localhost:8000` | Django REST Framework API + SimpleJWT (Active) |
| **Database State** | PostgreSQL / SQLite seeded with test accounts | `admin@noir.ai`, `company@noir.ai`, `tester@noir.ai` |

---

## 3. Comprehensive Test Results by Suite

### Suite 01: Landing & Public Navigation (`test_01_landing_and_public.py`)
- **Status:** **6 / 6 PASSED**
- **Focus:** Landing page layout, header/footer branding, public routing, contact submission, and 404 fallback routing.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 1 | `test_landing_page_renders_properly` | **PASSED** | Verifies Noir brand title, global navbar visibility, and footer links. |
| 2 | `test_navigation_to_login` | **PASSED** | Validates navigation from landing hero/nav CTA to `/login`. |
| 3 | `test_navigation_to_join_company` | **PASSED** | Validates navigation from landing page CTA to `/register/company`. |
| 4 | `test_navigation_to_contact` | **PASSED** | Validates navigation from landing page footer/nav to `/contact`. |
| 5 | `test_contact_form_submission` | **PASSED** | Fills full contact inquiry form, submits, and asserts confirmation toast/banner. |
| 6 | `test_wildcard_fallback_redirects_to_home` | **PASSED** | Tests unknown route fallback (`/some-unknown-fallback-path-xyz`) redirects to `/`. |

---

### Suite 02: Authentication & Registration (`test_02_auth_and_registration.py`)
- **Status:** **10 / 10 PASSED**
- **Focus:** Live form input validation, bad credentials error banners, multi-role login redirection, password visibility toggles, developer self-registration, and company 2-stage verification with PDF certificate upload.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 7 | `test_login_live_email_validation` | **PASSED** | Asserts inline red border and visual validation feedback on invalid email format. |
| 8 | `test_login_invalid_credentials_shows_error` | **PASSED** | Enters invalid email/password; verifies error banner displays and user remains on `/login`. |
| 9 | `test_login_valid_developer_redirects_to_dashboard` | **PASSED** | Authenticates developer (`tester@noir.ai`) and asserts redirect to `/dashboard`. |
| 10 | `test_login_valid_company_redirects_to_company_dashboard` | **PASSED** | Authenticates company (`company@noir.ai`) and asserts redirect to `/company/dashboard`. |
| 11 | `test_login_valid_admin_redirects_to_admin_dashboard` | **PASSED** | Authenticates admin (`admin@noir.ai`) and asserts redirect to `/admin/dashboard`. |
| 12 | `test_login_password_visibility_toggle` | **PASSED** | Toggles password visibility eye button; validates input type alternates between `password` and `text`. |
| 13 | `test_developer_registration_live_validation` | **PASSED** | Tests short username, invalid email format, and password mismatch triggers inline error tags. |
| 14 | `test_developer_successful_registration` | **PASSED** | Completes registration for new unique developer account and verifies automatic login and dashboard entry. |
| 15 | `test_company_registration_step_1_and_step_2_fields` | **PASSED** | Verifies Stage 1 personal credentials proceed to Stage 2 enterprise Tax ID & PDF upload fields. |
| 16 | `test_company_full_registration_submission` | **PASSED** | Fills Step 1 & Step 2 with real PDF document attachment (`test_cert.pdf`), submits, and asserts routing to `/company/status`. |

---

### Suite 03: Route Guards & Access Security (`test_03_route_guards_and_security.py`)
- **Status:** **9 / 9 PASSED**
- **Focus:** Authentication boundaries, unauthenticated access denials, role-based boundary enforcement, and logged-in user redirection away from auth pages.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 17 | `test_unauthenticated_dashboard_redirects_to_login` | **PASSED** | Direct visit to `/dashboard` without tokens redirects immediately to `/login`. |
| 18 | `test_unauthenticated_company_dashboard_redirects_to_login` | **PASSED** | Direct visit to `/company/dashboard` without tokens redirects to `/login`. |
| 19 | `test_unauthenticated_admin_dashboard_redirects_to_login` | **PASSED** | Direct visit to `/admin/dashboard` without tokens redirects to `/login`. |
| 20 | `test_unauthenticated_quickstart_redirects_to_login` | **PASSED** | Direct visit to `/quickstart` without tokens redirects to `/login`. |
| 21 | `test_unauthenticated_projects_redirects_to_login` | **PASSED** | Direct visit to `/dashboard/projects` without tokens redirects to `/login`. |
| 22 | `test_developer_cannot_access_admin_dashboard` | **PASSED** | Authenticated developer attempting to load `/admin/dashboard` is barred and redirected to `/dashboard`. |
| 23 | `test_developer_cannot_access_company_dashboard` | **PASSED** | Authenticated developer attempting to load `/company/dashboard` is barred and redirected to `/dashboard`. |
| 24 | `test_company_cannot_access_admin_dashboard` | **PASSED** | Authenticated company user attempting to load `/admin/dashboard` is barred and redirected to `/company/dashboard`. |
| 25 | `test_authenticated_user_accessing_login_redirects_to_dashboard` | **PASSED** | `PublicOnlyRoute` enforcement: logged-in user visiting `/login` is automatically redirected to `/dashboard`. |

---

### Suite 04: Developer Flow & Telemetry (`test_04_developer_flow.py`)
- **Status:** **11 / 11 PASSED**
- **Focus:** Developer workspace, project creation modal, live search, telemetry dashboards, chaos engineering reports, quickstart CLI instructions, and profile views.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 26 | `test_developer_dashboard_renders` | **PASSED** | Validates dashboard view, telemetry overview cards, and "Create Project" action button. |
| 27 | `test_create_project_modal_opens` | **PASSED** | Clicks "Create Project" button; verifies modal opens with inputs for title and description. |
| 28 | `test_create_project_full_flow` | **PASSED** | Submits new microservice project via modal; verifies new project card appears in the workspace grid. |
| 29 | `test_developer_search_projects` | **PASSED** | Tests client-side search filtering input for project names. |
| 30 | `test_project_detail_and_telemetry` | **PASSED** | Opens project detail page; asserts generated `connection_code` is displayed for daemon linkage. |
| 31 | `test_project_analytics_page` | **PASSED** | Navigates to `/dashboard/projects/:id/analytics`; validates latency/error rate chart containers. |
| 32 | `test_chaos_report_page` | **PASSED** | Navigates to `/dashboard/projects/:id/reports`; validates chaos experiment execution records. |
| 33 | `test_developer_quickstart_page` | **PASSED** | Validates CLI installation instructions and interactive command search bar. |
| 34 | `test_developer_user_projects_list` | **PASSED** | Verifies full projects list at `/dashboard/projects`. |
| 35 | `test_user_profile_page` | **PASSED** | Validates developer account settings page at `/dashboard/profile`. |
| 36 | `test_organization_profile_page` | **PASSED** | Validates organization / workspace settings page at `/dashboard/organization`. |

---

### Suite 05: Company Workspace & Status Review (`test_05_company_flow.py`)
- **Status:** **5 / 5 PASSED**
- **Focus:** Company dashboard, managed infrastructure projects, developer collaboration roster, status review views, and company quickstart.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 37 | `test_company_dashboard_renders` | **PASSED** | Verifies company executive dashboard metrics, service health, and team stats. |
| 38 | `test_company_projects_page` | **PASSED** | Navigates to `/company/projects`; confirms project oversight table renders. |
| 39 | `test_company_developers_directory` | **PASSED** | Navigates to `/company/developers`; confirms developer directory and invite interfaces render. |
| 40 | `test_company_status_page` | **PASSED** | Navigates to `/company/status`; asserts pending verification details and certificate audit status. |
| 41 | `test_company_quickstart_page` | **PASSED** | Verifies `/company/quickstart` workflow and setup guides. |

---

### Suite 06: Administrative Flow & Governance (`test_06_admin_flow.py`)
- **Status:** **4 / 4 PASSED**
- **Focus:** Admin global dashboard, user management table, company verification and document review modal, and global project listings.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 42 | `test_admin_dashboard_renders` | **PASSED** | Asserts admin header, system metrics, and administrative menu links render. |
| 43 | `test_admin_manage_users` | **PASSED** | Navigates to `/admin/users`; verifies table of registered users across all roles. |
| 44 | `test_admin_manage_companies` | **PASSED** | Navigates to `/admin/companies`; applies pending filter, inspects verification modal, and closes. |
| 45 | `test_admin_manage_projects` | **PASSED** | Navigates to `/admin/projects`; asserts global project listing and telemetry status. |

---

### Suite 07: Notifications & Session Lifecycle (`test_07_notifications_and_logout.py`)
- **Status:** **3 / 3 PASSED**
- **Focus:** Notification center dropdown, clean token purging, session revocation, and navbar logout button.

| # | Test Case Identifier | Result | Description / Coverage |
|---|---|:---:|---|
| 46 | `test_notification_inbox_toggle` | **PASSED** | Clicks notification bell in navigation header; verifies dropdown drawer toggles properly. |
| 47 | `test_logout_clears_tokens_and_redirects` | **PASSED** | Triggers `/logout`; verifies redirect to `/login`, verifies `access_token` and `refresh_token` are wiped from `localStorage`, and asserts back-navigation to protected `/dashboard` is rejected. |
| 48 | `test_logout_via_navbar_button` | **PASSED** | Authenticates user, clicks UI logout button in navbar dropdown; asserts immediate redirect to `/login`. |

---

## 4. Key Functional & Security Validations Verified

1. **Client-Side Live Validation Feedback**
   - Real-time format validation on input fields without requiring full form submission.
   - Inline color-coded feedback (`border-red-500`) and warning badges on invalid username, email, and password confirmations.
   - Interactive password visibility toggles (`type="password"` ↔ `type="text"`).

2. **Enterprise Company Onboarding & KYC Document Ingestion**
   - Multi-step registration flow preserving data across stages.
   - Mandatory Tax ID / Business Registration validation.
   - File attachment handling for business incorporation certificates (`PDF`), routing new companies directly to `/company/status` until reviewed.

3. **Strict Role-Based Access Control (RBAC)**
   - Unauthenticated visitors are blocked from all dashboard, telemetry, project, and admin paths with guaranteed redirection to `/login`.
   - Role separation: Developers cannot access `/admin/*` or `/company/*`; Company users cannot access `/admin/*`.
   - `PublicOnlyRoute` prevents authenticated users from re-entering `/login` or `/register` inadvertently.

4. **Session Termination & Token Invalidation**
   - Complete purging of JWT tokens (`access_token`, `refresh_token`) from browser `localStorage` on logout.
   - Guard against browser history replay (back button attacks) to protected routes.

---

## 5. Artifacts and How to Re-run

### Artifact Locations
- **HTML Report:** [`test/reports/report.html`](file:///home/amalskumar/projects/College%20Projects/Continues/noir/test/reports/report.html)
- **Screenshots Directory:** [`test/reports/screenshots/`](file:///home/amalskumar/projects/College%20Projects/Continues/noir/test/reports/screenshots/) *(Clean: 0 failure screenshots generated)*
- **Seed Fixture:** [`test/reports/test_cert.pdf`](file:///home/amalskumar/projects/College%20Projects/Continues/noir/test/reports/test_cert.pdf)

### Re-running the Tests
To reproduce or re-run the entire test suite:
```bash
./backend/venv/bin/python test/run_tests.py --suite all --report
```

To run a specific module (e.g. security guards):
```bash
./backend/venv/bin/python test/run_tests.py --suite security
```

To run tests with visible graphical browser (headed mode):
```bash
./backend/venv/bin/python test/run_tests.py --suite all --headed
```
