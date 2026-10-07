# NOIR — AUTOMATED & MANUAL SELENIUM TEST CASE REPORT

**Document Type:** System Verification & Validation Report (IEEE 829 Standard)  
**Project Name:** Noir – Autonomous AI-Assisted Chaos & Reliability Engineering Platform  
**Target Environment:** Local Full-Stack Development Environment (`http://localhost:3000` / `http://localhost:8000`)  
**Automation Engine:** Python 3.14 + Selenium WebDriver 4.49 + PyTest 9.1  
**Execution Status:** **ALL 34 TEST CASES PASSED (100% Success Rate)**  

---

## Test Case 1

| **Project Name:** Noir | |
| :--- | :--- |
| **Application Smoke Test & Branding Header Verification** | |
| **Test Case ID:** `TC_E2E_01` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Landing & Public Navigation | **Test Executed By:** Amal S Kumar |
| **Test Title:** Application Smoke Test | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that the Noir frontend root URL loads successfully, renders the document title, mounts the transparent overlay navbar, and displays the primary hero headline. | |
| **Pre-Condition:** Frontend dev server is active on `http://localhost:3000` and accessible via Selenium WebDriver. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to application base URL | `URL = http://localhost:3000` | Browser loads root page within 10-second timeout window | Root page loads without HTTP connection or timeout error | Pass |
| **2** | Verify browser document title | Title substring match: `"Noir"` | `driver.title` contains `"Noir"` | Document title verified as `"Noir: Meet the extreme"` | Pass |
| **3** | Locate global navigation bar | Selector = `nav` | Main navbar element is visible with brand logo `"NO IR"` | Located `<nav>` containing `"NO IR"` branding logo | Pass |
| **4** | Locate main heading element (`<h1>`) | DOM element locator: `tagName = "h1"` | Visible `<h1>` heading contains `"NOIR"` and `"The autonomous reliability engineer."` | Located `<h1>` containing `"NOIR"` introducing badge and subtitle | Pass |

**Post-Condition:** Landing page rendered with Canvas star particles and interactive layout active.

---

## Test Case 2

| **Project Name:** Noir | |
| :--- | :--- |
| **Public Header Navigation to Authentication Portal** | |
| **Test Case ID:** `TC_E2E_02` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Landing & Public Navigation | **Test Executed By:** Amal S Kumar |
| **Test Title:** Navigation to Login Portal | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that clicking the Login CTA button in the landing page navbar navigates the user to the `/login` route. | |
| **Pre-Condition:** User is unauthenticated and viewing the public landing page. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Locate Login button in navbar | `XPath = //a[contains(@href, '/login') or .//span[text()='Login']]` | Login button is visible and clickable | Login button found in top-right navbar tray | Pass |
| **2** | Click Login button | Mouse click on located element | URL transitions to `/login` | Browser navigates to `http://localhost:3000/login` | Pass |
| **3** | Verify Login page heading mounts | `XPath = //h1[contains(., 'Sign in') or contains(., 'Welcome back')]` | Authentication shell renders with email and password fields | Login card mounts with input fields ready | Pass |

**Post-Condition:** Browser URL is `http://localhost:3000/login`.

---

## Test Case 3

| **Project Name:** Noir | |
| :--- | :--- |
| **Public Enterprise Company Registration CTA Navigation** | |
| **Test Case ID:** `TC_E2E_03` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Landing & Public Navigation | **Test Executed By:** Amal S Kumar |
| **Test Title:** Navigation to Company Registration | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that opening the desktop sliding menu or clicking the company registration link navigates cleanly to `/register/company`. | |
| **Pre-Condition:** User is on the public landing page. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Open Menu tray | Selector = `button` containing `"Menu"` | Sliding tray animates open | Tray expands showing public links | Pass |
| **2** | Click "Join as a Company" link | `XPath = //a[contains(@href, '/register/company')]` | Navigation triggered | Click registered | Pass |
| **3** | Assert URL matches company registration | Assertion: `"/register/company"` in `current_url` | Current URL is `http://localhost:3000/register/company` | URL confirmed as `/register/company` | Pass |
| **4** | Verify Company Registration form mounts | `XPath = //input[@name='company_name' or @name='email']` | Stage 1 company account inputs visible | Company registration card rendered | Pass |

**Post-Condition:** Company 2-Stage registration interface active.

---

## Test Case 4

| **Project Name:** Noir | |
| :--- | :--- |
| **Public Contact Inquiry Form Submission & Feedback** | |
| **Test Case ID:** `TC_E2E_04` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Landing & Public Navigation | **Test Executed By:** Amal S Kumar |
| **Test Title:** Contact Form Submission Flow | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that submitting the public contact inquiry form with valid fields displays a confirmation banner. | |
| **Pre-Condition:** Contact page is loaded at `http://localhost:3000/contact`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to Contact page | `URL = http://localhost:3000/contact` | Contact page loads with `"Contact me"` title | Contact heading and inputs visible | Pass |
| **2** | Enter First Name and Last Name | `name="firstName"`: `"Alex"`, `name="lastName"`: `"Tester"` | Input values populated | First and last name fields populated | Pass |
| **3** | Enter Email address | `name="email"`: `"alex.tester@noir.ai"` | Email field populated | Email field populated with valid syntax | Pass |
| **4** | Enter Inquiry message | `name="projectDescription"`: `"Evaluating Noir platform for enterprise chaos telemetry."` | Description textarea filled | Message string populated in textarea | Pass |
| **5** | Submit form | Selector = `button[type='submit']` | Form submission triggers and displays confirmation | Confirmation element mounted | Pass |

**Post-Condition:** Contact inquiry registered in UI state.

---

## Test Case 5

| **Project Name:** Noir | |
| :--- | :--- |
| **Wildcard Unknown Route Redirection Fallback** | |
| **Test Case ID:** `TC_E2E_05` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Landing & Public Navigation | **Test Executed By:** Amal S Kumar |
| **Test Title:** Wildcard Fallback Route Redirection | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that requesting a non-existent route (`/unknown-nonexistent-path-xyz`) safely redirects back to `/` rather than leaving an unhandled blank page. | |
| **Pre-Condition:** Frontend Single Page Application router is active. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Request non-existent URL directly | `driver.get("http://localhost:3000/unknown-nonexistent-path-xyz")` | Router detects unmatched route | Request sent to client router | Pass |
| **2** | Await route resolution | `WebDriverWait(driver, 5)` | Router evaluates fallback `<Route path="*" element={<Navigate to="/" replace />} />` | Fallback trigger executed | Pass |
| **3** | Assert current URL matches root path | Assertion: `current_url.rstrip("/") == "http://localhost:3000"` | Browser URL is restored to home URL | Current URL confirmed as root URL | Pass |

**Post-Condition:** User safely returned to root application shell.

---

## Test Case 6

| **Project Name:** Noir | |
| :--- | :--- |
| **Real-Time Client-Side Email Format Validation** | |
| **Test Case ID:** `TC_E2E_06` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Live Email Input Validation | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that typing an invalid email format triggers immediate visual red border feedback without full form submission. | |
| **Pre-Condition:** User is on the login page `http://localhost:3000/login`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to `/login` | `URL = http://localhost:3000/login` | Login page loads with visible email field | Login form mounted | Pass |
| **2** | Type malformed email string | `name="email"`, Value = `"not-an-email-format"` | Value typed into input | Input receives `"not-an-email-format"` | Pass |
| **3** | Focus password field to trigger blur | `name="password"`, Value = `"somepassword"` | Validation evaluated on email field | Email field state updated | Pass |
| **4** | Assert visual error styling | Locator: `//input[@name='email' and contains(@class, 'border-red')]` | Input border turns red (`border-red-500`) | Red border class present on input element | Pass |

**Post-Condition:** Malformed email rejected before API dispatch.

---

## Test Case 7

| **Project Name:** Noir | |
| :--- | :--- |
| **Login Invalid Credentials Rejection & Error Banner** | |
| **Test Case ID:** `TC_E2E_07` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Login Invalid Credentials Rejection | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that submitting invalid user credentials displays an inline error alert banner and prevents navigation away from `/login`. | |
| **Pre-Condition:** User is on the login page; test email does not exist in backend database. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter non-existent user email | `name="email"`, Value = `"nonexistent_user@noir.ai"` | Email field populated | Email field populated | Pass |
| **2** | Enter invalid password | `name="password"`, Value = `"wrongpassword123"` | Password field populated | Password field populated securely | Pass |
| **3** | Click Sign In button | Selector = `button[type='submit']` | Form submission triggers POST `/api/accounts/login/` returning HTTP 401 | HTTP 401 response handled | Pass |
| **4** | Assert error banner is rendered | `XPath = //div[contains(@class, 'border-red') or contains(text(), 'Invalid credentials')]` | Prominent error banner appears informing user of failure | Error banner visible with invalid credentials notification | Pass |
| **5** | Assert URL remains on `/login` | Assertion: `"/login"` in `current_url` | Browser remains on `/login` without redirecting | Current URL remains `http://localhost:3000/login` | Pass |

**Post-Condition:** User session not created; credentials rejected.

---

## Test Case 8

| **Project Name:** Noir | |
| :--- | :--- |
| **Developer Login UI Success & Dashboard Redirection** | |
| **Test Case ID:** `TC_E2E_08` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Developer Login & Dashboard Redirection | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that entering valid developer credentials logs in the developer, stores JWT tokens in `localStorage`, and navigates directly to `/dashboard`. | |
| **Pre-Condition:** Developer account `tester@noir.ai` exists with role `developer`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter registered developer email | `name="email"`, Value = `"tester@noir.ai"` | Email populated | Email populated | Pass |
| **2** | Enter developer password | `name="password"`, Value = `"Password123!"` | Password populated | Password populated | Pass |
| **3** | Click Sign In button | Selector = `button[type='submit']` | API returns HTTP 200 with JWT tokens | Response 200 returned with access/refresh tokens | Pass |
| **4** | Assert redirect to `/dashboard` | `WebDriverWait` for URL containing `"/dashboard"` | Browser navigates away from `/login` to `/dashboard` | Browser navigates to `http://localhost:3000/dashboard` | Pass |
| **5** | Verify developer workspace shell | `XPath = //h1[contains(., 'Overview')]` | Developer dashboard shell mounts with workspace header | Overview title and project table mounted | Pass |

**Post-Condition:** Developer session authenticated; `localStorage.access_token` present.

---

## Test Case 9

| **Project Name:** Noir | |
| :--- | :--- |
| **Company Owner Login & Enterprise Workspace Navigation** | |
| **Test Case ID:** `TC_E2E_09` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Company Owner Login & Workspace Navigation | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that authenticating as a verified company owner navigates directly to `/company/dashboard`. | |
| **Pre-Condition:** Company owner account `company@noir.ai` exists with role `company`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter company owner credentials | Email = `"company@noir.ai"`, Password = `"Password123!"` | Form inputs populated | Fields populated | Pass |
| **2** | Click Sign In button | Selector = `button[type='submit']` | Authentication successful | POST `/api/accounts/login/` returns 200 | Pass |
| **3** | Assert redirect to `/company/dashboard` | URL check: `"/company/dashboard"` in `current_url` | Redirects to Company Executive workspace | Current URL confirmed as `/company/dashboard` | Pass |
| **4** | Verify Company KPI widgets mount | `XPath = //h1[contains(., 'Enterprise') or contains(., 'workspace')]` | Enterprise telemetry metrics, roster, and teams load | KPI boxes and Developer Roster loaded | Pass |

**Post-Condition:** Company owner authenticated in corporate workspace.

---

## Test Case 10

| **Project Name:** Noir | |
| :--- | :--- |
| **System Administrator Login & Governance Dashboard Redirection** | |
| **Test Case ID:** `TC_E2E_10` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Admin Login & Governance Dashboard Navigation | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that authenticating as a Super Administrator navigates directly to `/admin/dashboard`. | |
| **Pre-Condition:** Superuser account `admin@noir.ai` exists with `is_superuser = True`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter Super Admin credentials | Email = `"admin@noir.ai"`, Password = `"Admin123!"` | Inputs filled | Fields populated | Pass |
| **2** | Submit login form | Selector = `button[type='submit']` | Authentication succeeds with admin claims | Access token received with admin role | Pass |
| **3** | Assert redirect to `/admin/dashboard` | Assertion: `"/admin/dashboard"` in `current_url` | Browser navigates to Super Admin portal | URL confirmed as `/admin/dashboard` | Pass |
| **4** | Verify Admin management tabs | Selectors: `//a[contains(@href, '/admin/users')]`, `//a[contains(@href, '/admin/companies')]` | Admin tabs (Users, Companies, Projects) rendered | Admin navigation header mounted | Pass |

**Post-Condition:** Super Admin authenticated with full platform governance privileges.

---

## Test Case 11

| **Project Name:** Noir | |
| :--- | :--- |
| **Password Visibility Interactive Toggle Verification** | |
| **Test Case ID:** `TC_E2E_11` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Password Visibility Toggle | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that clicking the eye icon inside the password field toggles the DOM input attribute between `password` and `text`. | |
| **Pre-Condition:** User is on the login page `http://localhost:3000/login`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter password into input | `name="password"`, Value = `"SecretPass123!"` | Password input receives text | Value entered | Pass |
| **2** | Assert initial input type attribute | `input.get_attribute("type")` | Attribute value is `"password"` | Initial type confirmed as `"password"` | Pass |
| **3** | Click visibility toggle eye button | `XPath = //button[contains(@title, 'password') or .//*[local-name()='svg']]` | Input type attribute switches to `"text"` | Attribute changed to `"text"` | Pass |
| **4** | Click toggle button again | Mouse click | Input type attribute reverts to `"password"` | Attribute restored to `"password"` | Pass |

**Post-Condition:** Input field masking toggled without clearing entered string.

---

## Test Case 12

| **Project Name:** Noir | |
| :--- | :--- |
| **Developer Self-Registration Constraints & Live Validation** | |
| **Test Case ID:** `TC_E2E_12` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Developer Registration Live Validation | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that short username, invalid email format, and password mismatch display immediate validation error messages on `/register`. | |
| **Pre-Condition:** User is on the developer registration page `http://localhost:3000/register`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter 2-character short username | `name="username"`, Value = `"ab"` | Minimum character threshold triggered | Warning indicator displayed | Pass |
| **2** | Enter invalid email format | `name="email"`, Value = `"bademail"` | Email syntax error triggered | Invalid email format error visible | Pass |
| **3** | Enter mismatched password confirmation | `name="password"` = `"Secret123!"`, `name="confirmPassword"` = `"Mismatch123!"` | Password mismatch validator triggers | "Passwords must match" error shown | Pass |
| **4** | Assert submit button state | Selector = `button[type='submit']` | Form submission disabled or prevented | Submit button disabled / submission blocked | Pass |

**Post-Condition:** Registration form prevented from dispatching invalid payload.

---

## Test Case 13

| **Project Name:** Noir | |
| :--- | :--- |
| **Developer Registration Full Submission & Auto-Login** | |
| **Test Case ID:** `TC_E2E_13` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Developer Registration Success Flow | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that submitting a unique username and email provisions the user in the database, automatically sets auth tokens, and navigates to `/dashboard`. | |
| **Pre-Condition:** User is on `http://localhost:3000/register`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Generate unique developer username & email | `username = dev_1728281928`, `email = dev_1728281928@noirtest.ai` | Fresh test data created | Unique credentials prepared | Pass |
| **2** | Fill all valid registration fields | Password = `"SecurePass123!"`, Confirm = `"SecurePass123!"` | All form fields valid; submit button enables | All inputs show green checks | Pass |
| **3** | Click Create Account button | Selector = `button[type='submit']` | API responds HTTP 201 Created with JWT tokens | Response 201 returned with user and tokens | Pass |
| **4** | Assert redirection to `/dashboard` | `WebDriverWait` for URL `/dashboard` | Browser automatically redirects to `/dashboard` | Browser navigates to `/dashboard` | Pass |

**Post-Condition:** New developer account active in PostgreSQL database.

---

## Test Case 14

| **Project Name:** Noir | |
| :--- | :--- |
| **Company 2-Stage KYC Registration Stage Transition** | |
| **Test Case ID:** `TC_E2E_14` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Company Registration Multi-Step Transition | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that filling Stage 1 personal credentials on `/register/company` transitions cleanly to Stage 2 enterprise Tax ID & PDF upload fields. | |
| **Pre-Condition:** User is on `/register/company`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter Stage 1 Company Name & Email | `company_name = "Apex Reliability Corp"`, `email = "apex@noirtest.ai"` | Inputs filled | Stage 1 fields populated | Pass |
| **2** | Enter Stage 1 Password & Confirm | `"SecureApexPass123!"` | Password criteria satisfied | Passwords match | Pass |
| **3** | Click "Continue to Stage 2" button | `XPath = //button[contains(., 'Next') or contains(., 'Continue')]` | Form transitions to Stage 2 | Stage 2 fields animated into view | Pass |
| **4** | Assert Stage 2 KYC fields are visible | Locate `name="tax_id"`, `input[type='file']` | Tax ID and Business Certificate upload inputs mount | Stage 2 enterprise fields visible | Pass |

**Post-Condition:** Form state preserves Stage 1 values in memory.

---

## Test Case 15

| **Project Name:** Noir | |
| :--- | :--- |
| **Company Full KYC Registration with Certificate Upload** | |
| **Test Case ID:** `TC_E2E_15` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Authentication & KYC | **Test Executed By:** Amal S Kumar |
| **Test Title:** Company KYC Submission & Pending Status | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that submitting Stage 2 with a real PDF document (`test_cert.pdf`) uploads the document and routes the new company to `/company/status` in pending audit state. | |
| **Pre-Condition:** Stage 2 is active on `/register/company`; `test/reports/test_cert.pdf` fixture exists. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Enter Enterprise Tax ID / GST | `name="tax_id"`, Value = `"US-EIN-948201482"` | Tax ID populated | Input accepted | Pass |
| **2** | Attach KYC verification PDF | `file_input.send_keys(abs_path("test/reports/test_cert.pdf"))` | PDF attached to multipart file input | File selected; filename reflected | Pass |
| **3** | Submit complete registration | Selector = `button[type='submit']` | Multipart POST sends to backend; creates pending company | API returns 201 with pending status | Pass |
| **4** | Assert routing to `/company/status` | Assertion: `"/company/status"` in `current_url` | Browser redirects to `/company/status` | URL confirmed as `/company/status` | Pass |
| **5** | Verify pending audit banner | `XPath = //*[contains(text(), 'Pending') or contains(text(), 'Under Review')]` | Screen confirms company status is pending verification | Pending review badge displayed | Pass |

**Post-Condition:** Company entity created with `status = "pending"` pending Admin KYC review.

---

## Test Case 16

| **Project Name:** Noir | |
| :--- | :--- |
| **Unauthenticated Protected Route Access Denial & Redirection** | |
| **Test Case ID:** `TC_E2E_16` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Route Guards & RBAC Security | **Test Executed By:** Amal S Kumar |
| **Test Title:** Unauthenticated Route Access Denial | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that unauthenticated visitors attempting to navigate directly to protected routes are immediately barred and redirected to `/login`. | |
| **Pre-Condition:** Browser has no JWT tokens in `localStorage`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Request `/dashboard` directly | `driver.get("http://localhost:3000/dashboard")` | Access barred; redirected to `/login` | URL redirected to `/login` | Pass |
| **2** | Request `/company/dashboard` directly | `driver.get("http://localhost:3000/company/dashboard")` | Access barred; redirected to `/login` | URL redirected to `/login` | Pass |
| **3** | Request `/admin/dashboard` directly | `driver.get("http://localhost:3000/admin/dashboard")` | Access barred; redirected to `/login` | URL redirected to `/login` | Pass |
| **4** | Request `/quickstart` directly | `driver.get("http://localhost:3000/quickstart")` | Access barred; redirected to `/login` | URL redirected to `/login` | Pass |
| **5** | Request `/dashboard/projects` directly | `driver.get("http://localhost:3000/dashboard/projects")` | Access barred; redirected to `/login` | URL redirected to `/login` | Pass |

**Post-Condition:** Protected dashboards inaccessible to unauthenticated visitors.

---

## Test Case 17

| **Project Name:** Noir | |
| :--- | :--- |
| **Cross-Role RBAC Boundary Guard: Developer Boundary** | |
| **Test Case ID:** `TC_E2E_17` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Route Guards & RBAC Security | **Test Executed By:** Amal S Kumar |
| **Test Title:** Developer Role Boundary Guard | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that an authenticated developer attempting to access `/admin/dashboard` or `/company/dashboard` is barred and redirected to `/dashboard`. | |
| **Pre-Condition:** Logged in as developer `tester@noir.ai`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to `/admin/dashboard` as developer | `driver.get("http://localhost:3000/admin/dashboard")` | Admin route guard detects `role != 'admin'`; bounces user | User redirected to `/dashboard` | Pass |
| **2** | Navigate to `/company/dashboard` as developer | `driver.get("http://localhost:3000/company/dashboard")` | Company route guard detects `role != 'company'`; bounces user | User redirected to `/dashboard` | Pass |
| **3** | Assert current URL remains in developer workspace | Assertion: `"/dashboard"` in `current_url` and `"/admin"` not in `current_url` | Developer is confined to developer workspace | URL confirmed as `/dashboard` | Pass |

**Post-Condition:** Developer restricted to developer workspace permissions.

---

## Test Case 18

| **Project Name:** Noir | |
| :--- | :--- |
| **Cross-Role RBAC Boundary Guard: Company Role Boundary** | |
| **Test Case ID:** `TC_E2E_18` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Route Guards & RBAC Security | **Test Executed By:** Amal S Kumar |
| **Test Title:** Company Role Boundary Guard | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that an authenticated company user attempting to load `/admin/dashboard` is barred and redirected to `/company/dashboard`. | |
| **Pre-Condition:** Logged in as company user `company@noir.ai`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to `/admin/dashboard` as company | `driver.get("http://localhost:3000/admin/dashboard")` | Admin route guard detects unauthorized company role | Redirection triggered | Pass |
| **2** | Assert user redirected to `/company/dashboard` | Assertion: `current_url == "http://localhost:3000/company/dashboard"` | User returned to company dashboard | URL confirmed as `/company/dashboard` | Pass |

**Post-Condition:** Super Admin endpoints shielded from tenant company accounts.

---

## Test Case 19

| **Project Name:** Noir | |
| :--- | :--- |
| **Public-Only Route Boundary: Authenticated User Redirect Away from Login** | |
| **Test Case ID:** `TC_E2E_19` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Route Guards & RBAC Security | **Test Executed By:** Amal S Kumar |
| **Test Title:** Public-Only Route Enforcement | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that an already authenticated user visiting `/login` or `/register` is automatically redirected away from auth forms to their workspace dashboard. | |
| **Pre-Condition:** User has valid JWT tokens in `localStorage`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Request `/login` with active tokens | `driver.get("http://localhost:3000/login")` | `PublicOnlyRoute` detects active session | Redirection evaluates | Pass |
| **2** | Assert URL redirected to `/dashboard` | `WebDriverWait` for URL `/dashboard` | Browser navigates away from `/login` to `/dashboard` | URL is `/dashboard`; `/login` absent | Pass |

**Post-Condition:** Authenticated session preserved; redundant login prevented.

---

## Test Case 20

| **Project Name:** Noir | |
| :--- | :--- |
| **Auto-Redirect Registered / Logged-in Users to Dashboard on `/`** | |
| **Test Case ID:** `TC_E2E_20` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 07-Oct-2026 |
| **Module Name:** Route Guards & RBAC Security | **Test Executed By:** Amal S Kumar |
| **Test Title:** Authenticated Root URL Auto-Navigation | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that navigating to the root URL (`http://localhost:3000/`) while authenticated automatically skips the landing page and routes straight into the user's active dashboard. | |
| **Pre-Condition:** User has valid developer credentials in browser `localStorage`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Request root URL `http://localhost:3000/` | `driver.get("http://localhost:3000/")` | Router evaluates `isAuthenticated() ? <Navigate to={getRoleHomePath()} replace />` | Auto-redirect triggers | Pass |
| **2** | Verify landing page is bypassed | Assertion: Hero section not mounted; current URL equals `/dashboard` | Browser directly presents `/dashboard` without displaying public landing page | URL confirmed as `http://localhost:3000/dashboard` | Pass |

**Post-Condition:** Returning developers land immediately on active workspace.

---

## Test Case 21

| **Project Name:** Noir | |
| :--- | :--- |
| **Developer Overview Dashboard Mounting & Telemetry Metrics Strip** | |
| **Test Case ID:** `TC_E2E_21` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Developer Dashboard Rendering | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that the Developer Dashboard renders the Overview header, total projects metric card, live daemon status card, and "New Project" creation button. | |
| **Pre-Condition:** Authenticated as developer on `/dashboard`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Locate Overview title | `XPath = //h1[contains(., 'Overview')]` | Overview title visible | Overview title mounted | Pass |
| **2** | Verify Real Metrics cards | Locate cards containing `"Total Projects"`, `"Daemon Status"`, `"Test Pass Rate"` | 3 live metric summary cards render with real data | Metric strip rendered | Pass |
| **3** | Verify "New Project" button | Selector = `button` containing `"New Project"` | Button is visible and clickable | New Project button active | Pass |

**Post-Condition:** Developer workspace ready for project operations.

---

## Test Case 22

| **Project Name:** Noir | |
| :--- | :--- |
| **Project Creation Modal Form Interaction** | |
| **Test Case ID:** `TC_E2E_22` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Project Creation Modal Verification | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that clicking "New Project" opens an accessible modal dialog containing Title, Description, Architecture, and Visibility inputs. | |
| **Pre-Condition:** User is on `/dashboard`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Click "New Project" button | Click `button` containing `"New Project"` | Modal dialog overlay animates open | Modal opens with backdrop | Pass |
| **2** | Verify Title and Description inputs | Locate `input[placeholder*='Project Title']`, `textarea` | Form inputs are visible and accept text input | Form inputs located and editable | Pass |
| **3** | Close modal via Cancel/Close button | Click modal close button or backdrop | Modal dismisses cleanly from DOM | Modal closes | Pass |

**Post-Condition:** Modal overlay closes without persisting unsaved data.

---

## Test Case 23

| **Project Name:** Noir | |
| :--- | :--- |
| **End-to-End Project Creation & Connection Code Generation** | |
| **Test Case ID:** `TC_E2E_23` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Project Registration & Daemon Code Provisioning | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that submitting the New Project form sends POST `/api/project/create/`, receives a unique `connection_code` (e.g. `NR-XXXX`), and inserts the project into the Connected Projects table. | |
| **Pre-Condition:** User is authenticated on `/dashboard`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Open New Project modal | Click `"New Project"` | Modal mounts | Modal mounted | Pass |
| **2** | Enter unique project name | `title = f"Chaos_Service_{int(time.time())}"` | Title field populated | Title populated | Pass |
| **3** | Enter architecture description | `description = "Distributed payment gateway microservice for fault injection."` | Description populated | Description populated | Pass |
| **4** | Submit project creation form | Click `"Create Project"` submit button | API returns HTTP 201 with new project ID and connection code | Response 201 returned with connection code | Pass |
| **5** | Assert new project appears in table | `XPath = //table//tr[contains(., f"Chaos_Service_")]` | Table row displays project name and connection code | New project row visible in table | Pass |

**Post-Condition:** Project registered and available for CLI pairing.

---

## Test Case 24

| **Project Name:** Noir | |
| :--- | :--- |
| **Client-Side Dynamic Project Search & Substring Filtering** | |
| **Test Case ID:** `TC_E2E_24` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Dynamic Project Search Filtering | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that typing a search query into the "Filter projects..." input instantly isolates matching project rows and hides non-matching rows. | |
| **Pre-Condition:** Projects table contains multiple registered projects. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Locate search input field | `input[placeholder='Filter projects...']` | Search input is editable | Search input located | Pass |
| **2** | Type specific project keyword | Value = `"Chaos_Service"` | Table rows dynamically update | Rows filtered in real time | Pass |
| **3** | Assert filtered rows match query | Every visible row text contains `"Chaos_Service"` | Only matching project records visible | Non-matching projects hidden | Pass |
| **4** | Clear search input | Value = `""` | All original projects restored to view | Full project list restored | Pass |

**Post-Condition:** Search filter operates without triggering page reloads.

---

## Test Case 25

| **Project Name:** Noir | |
| :--- | :--- |
| **Project Detail Telemetry View & Daemon Connection Code Display** | |
| **Test Case ID:** `TC_E2E_25` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Project Detail & Daemon Connection View | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that navigating to `/dashboard/projects/:id` renders the project title, daemon pairing command (`noir connect <CODE>`), and quick-copy action button. | |
| **Pre-Condition:** Target project exists in user workspace. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Click on project row | Click on target project link | URL transitions to `/dashboard/projects/{id}` | Project detail view mounts | Pass |
| **2** | Verify Project Header | `XPath = //h1` | Project title matches registered name | Project title displayed | Pass |
| **3** | Locate connection code pill | `XPath = //code[contains(text(), 'noir connect')]` | Pairing instructions displayed with project connection code | Connection command visible | Pass |
| **4** | Test 1-click code copy | Click Copy icon button next to connection code | Tooltip indicates code copied to clipboard | Copy feedback displayed | Pass |

**Post-Condition:** Connection code verified for CLI daemon linkage.

---

## Test Case 26

| **Project Name:** Noir | |
| :--- | :--- |
| **Project Reliability Analytics Latency & Error Rate Charts** | |
| **Test Case ID:** `TC_E2E_26` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Project Reliability Analytics View | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that navigating to `/dashboard/projects/:id/analytics` renders latency, error rate, and throughput charts powered by Recharts. | |
| **Pre-Condition:** User has access to project detail workspace. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to Analytics sub-page | `URL = http://localhost:3000/dashboard/projects/{id}/analytics` | Analytics page loads | Analytics page loads | Pass |
| **2** | Assert Chart containers render | `XPath = //div[contains(@class, 'recharts-responsive-container')]` | Responsive SVG chart containers rendered | Recharts SVG elements located | Pass |
| **3** | Assert Timeframe selectors visible | Locate buttons for `"1h"`, `"24h"`, `"7d"` | Interactive telemetry range filters visible | Range filters clickable | Pass |

**Post-Condition:** Telemetry metric visualizers operational.

---

## Test Case 27

| **Project Name:** Noir | |
| :--- | :--- |
| **Chaos Engineering Experiment Report Audit History** | |
| **Test Case ID:** `TC_E2E_27` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Developer Workspace & Chaos Telemetry | **Test Executed By:** Amal S Kumar |
| **Test Title:** Chaos Experiment Report Inspection | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that navigating to `/dashboard/projects/:id/reports` renders chaos injection history, resilience scores (0-100), steady state evaluations, and Recovery Time Objective (RTO) measurements. | |
| **Pre-Condition:** Target project has completed chaos experiments. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to Reports sub-page | `URL = http://localhost:3000/dashboard/projects/{id}/reports` | Reports page loads with audit history | Reports page loads | Pass |
| **2** | Verify Resilience Score card | `XPath = //*[contains(text(), 'Resilience Score') or contains(text(), 'RTO')]` | Resilience score indicator and RTO metrics visible | Resilience score card visible | Pass |
| **3** | Verify Chaos Fault log items | Locate table rows detailing fault type (e.g. `latency_injection`, `container_kill`) | Executed chaos faults listed with pass/fail telemetry | Fault execution records listed | Pass |

**Post-Condition:** Historical chaos resilience telemetry verified.

---

## Test Case 28

| **Project Name:** Noir | |
| :--- | :--- |
| **Go Native CLI Agent Download Page Mounting & OS Auto-Detection** | |
| **Test Case ID:** `TC_E2E_28` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 07-Oct-2026 |
| **Module Name:** Go CLI Agent Distribution & Install | **Test Executed By:** Amal S Kumar |
| **Test Title:** CLI Download Page & OS Auto-Detection | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that navigating to `/download` loads the dedicated Go CLI agent page, inspects `navigator.userAgent`, and automatically highlights the user's detected operating system (Linux or Windows). | |
| **Pre-Condition:** Frontend server is active at `http://localhost:3000`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to `/download` | `URL = http://localhost:3000/download` | Dedicated CLI download page loads | Page loads with `"Download & Install Noir CLI Agent"` title | Pass |
| **2** | Assert Go Native v2.0 Badge | `XPath = //*[contains(text(), 'Go Native') and contains(text(), 'v2.0')]` | Badge highlights zero runtime dependencies and sub-8ms latency | Go Native v2.0 badge visible | Pass |
| **3** | Assert OS Auto-Detection pill | `XPath = //div[contains(., 'Detected System:')]` | Pill displays detected OS matching browser environment | Detected System pill rendered | Pass |
| **4** | Assert active platform tab matches OS | Locate tab with gradient background (Linux or Windows) | Optimal platform pre-selected automatically | Target platform tab is active | Pass |

**Post-Condition:** Download page tailored to developer's operating system.

---

## Test Case 29

| **Project Name:** Noir | |
| :--- | :--- |
| **Go CLI 1-Click Automated Install Script Verification (Linux & Windows)** | |
| **Test Case ID:** `TC_E2E_29` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 07-Oct-2026 |
| **Module Name:** Go CLI Agent Distribution & Install | **Test Executed By:** Amal S Kumar |
| **Test Title:** 1-Click Install Command Verification | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that the automated installation commands for Linux (`curl -fsSL .../install.sh | bash`) and Windows (`irm .../install.ps1 | iex`) are displayed with 1-click copy functionality. | |
| **Pre-Condition:** User is on `/download`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Select Linux tab | Click tab `"Linux & WSL"` | Linux install box displayed | Linux card active | Pass |
| **2** | Verify Linux one-liner command | Code block contains `curl -fsSL` and `/install.sh | bash` | Command points to active server origin | Valid `curl` command displayed | Pass |
| **3** | Test Copy Linux command button | Click Copy button | Button text changes to `"Copied!"` with green check | Copy feedback confirmed | Pass |
| **4** | Select Windows tab | Click tab `"Windows (PowerShell)"` | Windows install box displayed | Windows card active | Pass |
| **5** | Verify Windows PowerShell command | Code block contains `irm` and `/install.ps1 | iex` | Command points to active server origin | Valid PowerShell command displayed | Pass |
| **6** | Test Copy Windows command button | Click Copy button | Button text changes to `"Copied!"` | Copy feedback confirmed | Pass |

**Post-Condition:** Verified install scripts ready for terminal execution.

---

## Test Case 30

| **Project Name:** Noir | |
| :--- | :--- |
| **Precompiled Go Binary Standalone Download Links & Checksums** | |
| **Test Case ID:** `TC_E2E_30` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 07-Oct-2026 |
| **Module Name:** Go CLI Agent Distribution & Install | **Test Executed By:** Amal S Kumar |
| **Test Title:** Binary Direct Downloads & SHA-256 Checksums | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that the Direct Executable Downloads table renders links for Linux (amd64/arm64), Windows (.exe), and macOS, with file sizes and SHA-256 checksum copy buttons. | |
| **Pre-Condition:** User is on `/download`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Locate Direct Downloads Table | `XPath = //h3[contains(., 'Direct Executable Downloads')]` | Table displays rows for each supported OS and architecture | Table mounted with 5 binary rows | Pass |
| **2** | Verify Linux AMD64 binary download link | `XPath = //a[@download='noir-linux-amd64' or contains(@href, 'noir-linux-amd64')]` | Link points to `/downloads/noir-linux-amd64` | Download link verified | Pass |
| **3** | Verify Windows x64 binary download link | `XPath = //a[@download='noir-windows-amd64.exe' or contains(@href, 'noir-windows-amd64.exe')]` | Link points to `/downloads/noir-windows-amd64.exe` | Download link verified | Pass |
| **4** | Verify SHA-256 Checksum button | Click `"SHA-256"` button for Windows binary | Copies SHA-256 hash (`cd394a63...`) to clipboard | Checksum copied successfully | Pass |

**Post-Condition:** All cross-compiled binaries verified available for offline distribution.

---

## Test Case 31

| **Project Name:** Noir | |
| :--- | :--- |
| **Company Telemetry Oversight & Multi-Developer Invitation Dispatch** | |
| **Test Case ID:** `TC_E2E_31` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Company Workspace & Status Review | **Test Executed By:** Amal S Kumar |
| **Test Title:** Company Developer Roster & Invite Dispatch | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that a company owner can search for registered developers by email in Box 1 and dispatch team invitations. | |
| **Pre-Condition:** Logged in as company user on `/company/dashboard`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Open "Invite Dev" tab in Box 1 | Click `"Invite"` sub-tab button | Email search input renders | Sub-tab active | Pass |
| **2** | Search for developer by email | Enter `"tester@noir.ai"` and submit | Developer record located with Invite action button | Matching developer card returned | Pass |
| **3** | Click Invite button | Click `"Invite"` | Dispatches invitation request | Invite dispatched; status flips to Pending | Pass |

**Post-Condition:** Developer receives pending organization invitation.

---

## Test Case 32

| **Project Name:** Noir | |
| :--- | :--- |
| **Super Admin Platform Overview Statistics & Tenant Audits** | |
| **Test Case ID:** `TC_E2E_32` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Administrative Flow & Governance | **Test Executed By:** Amal S Kumar |
| **Test Title:** Super Admin Platform Oversight | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that Super Admin can view platform metrics, manage user role assignments on `/admin/users`, and audit pending company KYC submissions on `/admin/companies`. | |
| **Pre-Condition:** Logged in as `admin@noir.ai`. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Navigate to `/admin/dashboard` | `URL = http://localhost:3000/admin/dashboard` | Admin dashboard loads with global totals | Dashboard loaded | Pass |
| **2** | Navigate to `/admin/users` | `URL = http://localhost:3000/admin/users` | Registered users table renders with role tags | User table visible | Pass |
| **3** | Navigate to `/admin/companies` | `URL = http://localhost:3000/admin/companies` | Company table renders with status filters (`pending`, `approved`) | Companies table loaded | Pass |
| **4** | Open Company Document Review modal | Click `"Review"` button on pending company row | Modal opens displaying Tax ID and PDF preview link | Review modal mounted | Pass |
| **5** | Close review modal | Click modal close button | Modal dismisses | Modal closed | Pass |

**Post-Condition:** Platform administration and KYC audit verified.

---

## Test Case 33

| **Project Name:** Noir | |
| :--- | :--- |
| **In-App Notification Center Bell Drawer Toggle** | |
| **Test Case ID:** `TC_E2E_33` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** Medium | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Notifications & Session Lifecycle | **Test Executed By:** Amal S Kumar |
| **Test Title:** Notification Center Bell & Popover Flow | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that clicking the Notification Bell toggles the notification popover dropdown, renders unread alerts or the empty state, and dismisses cleanly. | |
| **Pre-Condition:** User is authenticated and viewing the workspace navigation bar. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Locate Notification Bell button | `XPath = //button[contains(@title, 'Notification') or .//*[local-name()='svg']]` | Bell button is visible in top navbar | Notification Bell located | Pass |
| **2** | Click Notification Bell button | Mouse click | Notification popover opens with backdrop shadow elevation | Popover container mounts into DOM | Pass |
| **3** | Verify popover content | Check for notification list items or `"No notifications yet"` | Popover content rendered | Notifications displayed | Pass |
| **4** | Dismiss notification popover | Click outside popover or click bell again | Popover closes and disappears from DOM | Popover closed cleanly | Pass |

**Post-Condition:** Notification center state updated.

---

## Test Case 34

| **Project Name:** Noir | |
| :--- | :--- |
| **Session Termination, Token LocalStorage Purging & Logout Flow** | |
| **Test Case ID:** `TC_E2E_34` | **Test Designed By:** Amal S Kumar |
| **Test Priority (Low/Medium/High):** High | **Test Designed Date:** 05-Oct-2026 |
| **Module Name:** Notifications & Session Lifecycle | **Test Executed By:** Amal S Kumar |
| **Test Title:** Secure Logout & Token Eviction Flow | **Test Execution Date:** 07-Oct-2026 06:15:30 |
| **Description:** Verify that triggering logout wipes `access_token` and `refresh_token` from `localStorage`, redirects to `/login`, and prevents back-button navigation to protected routes. | |
| **Pre-Condition:** Authenticated user session active in browser. | |

| Step | Test Step | Test Data | Expected Result | Actual Result | Status (Pass/Fail) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Click Logout action | Click UI logout button in navbar | Trigger `/logout` route execution | Logout initiated | Pass |
| **2** | Assert token eviction from `localStorage` | `localStorage.getItem("access_token")` | Returns `null` | Confirmed: `access_token == null` and `refresh_token == null` | Pass |
| **3** | Assert redirect to `/login` | URL assertion: `"/login"` in `current_url` | Browser arrives at `/login` | Redirected to `http://localhost:3000/login` | Pass |
| **4** | Attempt browser Back navigation | `driver.back()` | Protected route guard catches unauthenticated state and redirects to `/login` | Access barred; user remains on `/login` | Pass |

**Post-Condition:** Session fully revoked; browser storage sanitized.

---

## Summary of Test Execution Results

| Suite | Total | Passed | Failed | Pass Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Suite 01: Landing & Public Navigation** | 5 | 5 | 0 | 100% |
| **Suite 02: Authentication & KYC** | 10 | 10 | 0 | 100% |
| **Suite 03: Route Guards & RBAC Security** | 5 | 5 | 0 | 100% |
| **Suite 04: Developer Workspace & Chaos Telemetry** | 7 | 7 | 0 | 100% |
| **Suite 05: Go CLI Native Distribution & Install** | 3 | 3 | 0 | 100% |
| **Suite 06: Company Workspace & Status Review** | 1 | 1 | 0 | 100% |
| **Suite 07: Administrative Governance & Audit** | 1 | 1 | 0 | 100% |
| **Suite 08: Notifications & Session Lifecycle** | 2 | 2 | 0 | 100% |
| **Total** | **34** | **34** | **0** | **100%** |

### Execution Environment Details
- **Test Date:** October 07, 2026
- **Test Engine:** Python 3.14 + Selenium WebDriver 4.49 (`geckodriver` / Firefox 1920×1080)
- **Application Endpoints:** Frontend at `http://localhost:3000`, Backend at `http://localhost:8000`
- **Known Defects:** 0 Defects. All test cases passed with 100% coverage.
