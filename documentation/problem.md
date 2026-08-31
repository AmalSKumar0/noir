# Comprehensive System Audit: Identified Architectural, Security, and Code Quality Issues

This document presents a comprehensive technical audit of the **Noir** enterprise platform, covering the Django REST backend, ASGI/Channels WebSocket layer, React frontend client, and Python CLI agent. A total of **20 critical problems** have been identified, analyzed, and categorized below along with their potential impact and recommended remediations.

---

## Table of Contents
1. [Backend & Infrastructure Issues](#1-backend--infrastructure-issues)
2. [Security & Access Control Vulnerabilities](#2-security--access-control-vulnerabilities)
3. [CLI Agent & Telemetry Vulnerabilities](#3-cli-agent--telemetry-vulnerabilities)
4. [Frontend State & Performance Bottlenecks](#4-frontend-state--performance-bottlenecks)
5. [Database & Query Performance Issues](#5-database--query-performance-issues)

---

## 1. Backend & Infrastructure Issues

### Problem 1: In-Memory Channel Layer Used in ASGI Production Configuration
* **Location:** `backend/backend/settings.py` (Lines 109–113)
* **Category:** Infrastructure / Scalability
* **Description:** The Channels WebSocket configuration relies on `channels.layers.InMemoryChannelLayer`. 
* **Impact:** In multi-process or multi-instance production environments (e.g., Daphne or Gunicorn running with multiple worker processes), WebSocket messages broadcasted by worker A will fail to reach clients connected to worker B.
* **Remediation:** Replace `InMemoryChannelLayer` with `channels_redis.core.RedisChannelLayer` backed by the existing Redis cache cluster (`REDIS_HOST`, `REDIS_PORT`).

---

### Problem 2: Undefined Attribute Runtime Error in WebSocket Consumer (`AttributeError`)
* **Location:** `backend/apps/projects/consumers.py` (Line 34)
* **Category:** Bug / Runtime Crash
* **Description:** The `ProjectLogsConsumer.receive()` method calls `self.channel_layer.group_send(self.room_group_name, ...)` when handling incoming WebSocket text messages. However, `self.room_group_name` is never defined during connection initialization in `connect()` (where `self.group_upper` and `self.group_lower` are set instead).
* **Impact:** Sending any incoming message via the WebSocket connection immediately triggers an uncaught `AttributeError: 'ProjectLogsConsumer' object has no attribute 'room_group_name'`, crashing the consumer worker.
* **Remediation:** Define `self.room_group_name = self.group_upper` inside `connect()` or pass `self.group_upper` directly in `group_send`.

---

### Problem 3: Hardcoded Fallback Secret Key in Production Settings
* **Location:** `backend/backend/settings.py` (Line 43)
* **Category:** Security / Configuration
* **Description:** `SECRET_KEY` falls back to a hardcoded string (`'django-insecure-2qx=0=y&(p@o9s%59obad+$q1lz%m)dv-lf4392o2b$*9&5ze0'`) when the environment variable is not supplied.
* **Impact:** If deployed to production without an explicit environment file, cryptographic signatures for JWT tokens, password reset hashes, and sessions become compromised and reproducible by attackers.
* **Remediation:** Enforce `os.environ["SECRET_KEY"]` or raise an explicit `ImproperlyConfigured` error during startup if `SECRET_KEY` is missing in production mode (`DEBUG=False`).

---

### Problem 4: Hard Deletion of Company Entities Without Audit Archival
* **Location:** `backend/apps/accounts/views.py` (Lines 235–240)
* **Category:** Data Integrity / Compliance
* **Description:** When an administrator deletes a company via `AdminCompanyDetailView.delete()`, the system executes `company.delete()` followed by `user.delete()`.
* **Impact:** Hard deleting company profiles triggers database cascading deletes across all associated developer requests, projects, and historical `TestRun` records. Critical enterprise telemetry and audit history are permanently lost without recovery options.
* **Remediation:** Implement soft-deletion (e.g., `is_deleted=True` or archiving status flag) for `CompanyProfile` and related projects to preserve historical compliance logs.

---

## 2. Security & Access Control Vulnerabilities

### Problem 5: Unauthenticated and Unrestricted WebSocket Stream Access
* **Location:** `backend/apps/projects/consumers.py` (Lines 5–14)
* **Category:** Security / Authorization
* **Description:** The `ProjectLogsConsumer.connect()` handler accepts all incoming WebSocket connections without validating JWT tokens or checking if the client has authorization to access `project_code`.
* **Impact:** Any unauthenticated external user who guesses or discovers a project connection code can establish a WebSocket connection (`ws://<host>/ws/project/<code?>/logs/`) and intercept live terminal output, stdout/stderr streams, and environment variables.
* **Remediation:** Implement token-based authentication (e.g., query param JWT verification) in Channels middleware and check user project authorization before calling `await self.accept()`.

---

### Problem 6: Broken Authorization Checks in `TestRunDetailView`
* **Location:** `backend/apps/projects/views.py` (Lines 167–184)
* **Category:** Security / Privilege Escalation
* **Description:** `TestRunDetailView.get()` and `delete()` perform direct object lookups via `TestRun.objects.get(pk=pk)` without scoping the query to the authenticated user or company.
* **Impact:** Any authenticated user can read or delete test run execution logs belonging to any external organization simply by modifying the integer ID parameter (`GET /api/project/test-runs/<id>/`).
* **Remediation:** Apply proper organization scoping filters or check ownership permissions using DRF object-level permission classes (`has_object_permission`).

---

### Problem 7: Unrestricted Log Injection Vulnerability in `StreamProjectLogsAPIView`
* **Location:** `backend/apps/projects/views.py` (Lines 256–299)
* **Category:** Security / Data Tampering
* **Description:** `StreamProjectLogsAPIView.post()` enforces `IsAuthenticated`, but fails to verify if `request.user` is the owner or an assigned developer of the target project.
* **Impact:** Any authenticated developer account can send POST requests to `/api/project/<connection_code>/stream-logs/` with arbitrary text payload or fake `run_end` events, spoofing execution output or prematurely terminating live streams for other projects.
* **Remediation:** Add project authorization validation: verify that `request.user` equals `project.owner` or belongs to a team assigned to `project`.

---

### Problem 8: CSRF Vulnerability in OAuth2 Callback Handling
* **Location:** `backend/apps/accounts/views.py` (Lines 279–363)
* **Category:** Security / OAuth2
* **Description:** In `github_login` and `google_login`, the `state` parameter is populated only with the static client string (`"frontend"` or `"cli"`) rather than a cryptographically random, session-bound CSRF state token.
* **Impact:** Susceptible to OAuth Account Linking CSRF attacks, where an attacker can trick a victim into linking their Noir account to the attacker's social profile.
* **Remediation:** Generate a random state token stored in session/cache, verify state token validity upon callback, and attach `client` type as a separate parameter or encoded state JSON.

---

## 3. CLI Agent & Telemetry Vulnerabilities

### Problem 9: Shell Command Injection in CLI Container Execution
* **Location:** `agent/noir/commands/run.py` (Lines 139, 146, 153, 166)
* **Category:** Security / Remote Code Execution
* **Description:** Subprocess invocations for building Docker images and executing tests use `shell=True` with unescaped string formatting (e.g., `subprocess.run(f"docker build -t {image_name} .", shell=True)` and `subprocess.Popen(f"docker exec {container_name} {container_test_cmd}", shell=True)`).
* **Impact:** If `container_test_cmd`, `image_name`, or `command` contains shell control characters (e.g., `; rm -rf /`), arbitrary commands will execute on the developer's host environment.
* **Remediation:** Execute subprocesses using argument lists without `shell=True` (e.g., `subprocess.run(["docker", "build", "-t", image_name, "."])`) and sanitize user inputs using `shlex.quote`.

---

### Problem 10: Inaccurate Test Run Metrics Recording in Agent Telemetry
* **Location:** `agent/noir/commands/run.py` (Lines 203–206)
* **Category:** Telemetry Integrity / Data Quality
* **Description:** When pushing execution metrics to the backend `/project/test-runs/` endpoint, the CLI agent hardcodes test statistics:
  ```python
  "total_tests": 1,
  "passed_tests": 1 if test_success else 0,
  "failed_tests": 0 if test_success else 1
  ```
* **Impact:** Real test runner output (e.g., PyTest or Jest reporting 45 passing tests and 2 failing tests) is recorded in backend database records as 1 total test. Organization telemetry metrics and developer performance reports become inaccurate.
* **Remediation:** Implement output parsing (e.g., regex extraction for PyTest/Jest/JUnit summaries) to extract actual `passed`, `failed`, and `total` test counts.

---

### Problem 11: Missing HTTP Request Timeouts in CLI API Client
* **Location:** `agent/noir/api/client.py` (Line 22)
* **Category:** Reliability / Resource Hanging
* **Description:** The `ApiClient` class initializes `httpx.Client()` without specifying default connection or read timeouts.
* **Impact:** If the backend host experiences network partitioning or dropped packets, `httpx` API calls will block indefinitely, causing CLI commands (`noir run`, `noir connect`) to freeze without returning feedback or throwing timeouts.
* **Remediation:** Configure explicit timeouts on client initialization: `httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0))`.

---

### Problem 12: Silent Failure in Agent Telemetry Log Streaming
* **Location:** `agent/noir/commands/run.py` (Lines 24–41)
* **Category:** Observability / Error Masking
* **Description:** The `send_log_telemetry` function wraps network telemetry dispatches in a generic `try...except Exception: pass` block.
* **Impact:** Network failures, API authentication issues, and invalid connection codes fail completely silently, leaving the developer unaware that their live log stream is disconnected from the frontend dashboard.
* **Remediation:** Log verbose debug warnings when telemetry requests fail, or notify the developer if authentication expires during run execution.

---

## 4. Frontend State & Performance Bottlenecks

### Problem 13: Overlapping Interval Memory Leak in `apiFetch` Throttle Handler
* **Location:** `frontend/src/utils/api.ts` (Lines 125–139)
* **Category:** Memory Leak / UI Stability
* **Description:** When `apiFetch` intercepts HTTP 429 (Too Many Requests) responses, it spawns a `setInterval` timer to update global throttle countdown state. However, existing active interval references are not cleared before creating a new interval.
* **Impact:** Rapid requests during a throttled state launch multiple parallel interval loops, resulting in memory leaks and erratic countdown timer flickering across UI components.
* **Remediation:** Store a global `activeIntervalId` reference and invoke `clearInterval(activeIntervalId)` prior to spawning a new countdown timer.

---

### Problem 14: Sensitive Token Storage in Browser LocalStorage (XSS Vulnerability)
* **Location:** `frontend/src/utils/auth.ts` (Lines 12–17)
* **Category:** Security / Storage
* **Description:** JWT `access_token` and `refresh_token` strings are stored in `window.localStorage`.
* **Impact:** LocalStorage is accessible to any JavaScript code executing on the domain. If a Cross-Site Scripting (XSS) vulnerability occurs (or via third-party npm package injection), attackers can extract refresh tokens and gain persistent unauthorized account access.
* **Remediation:** Transition to issuing refresh tokens via `httpOnly`, `secure`, `SameSite=Lax` cookies from the Django backend.

---

### Problem 15: Unthrottled Frontend Polling for Telemetry Stream Status
* **Location:** `frontend/src/components/LiveStreamTerminal.tsx` (Lines 114–118)
* **Category:** Performance / Server Load
* **Description:** `LiveStreamTerminal.tsx` polls the `/project/<code?>/stream-status/` endpoint every 1500 milliseconds per mounted component instance, and the backend view disables throttling (`throttle_classes = []`).
* **Impact:** Multiple open browser tabs or active project dashboards will flood the backend with dozens of HTTP requests per second, needlessly increasing database cache queries and CPU load.
* **Remediation:** Increase polling interval (e.g., 5000ms) or replace HTTP polling with WebSocket state event pushes.

---

### Problem 16: DOM Memory Overhead in Live Telemetry Terminal
* **Location:** `frontend/src/components/LiveStreamTerminal.tsx` (Lines 201–211)
* **Category:** Frontend Performance / Memory
* **Description:** The live stream terminal renders up to 400 individual DOM `<div>` nodes using inline array `.map()` without list virtualization.
* **Impact:** During high-frequency log streams, frequent state updates trigger heavy layout recalculations and DOM re-renders, causing browser UI thread stuttering on low-spec hardware.
* **Remediation:** Utilize a virtualized list library (such as `react-window` or `react-virtualized`) or render plain text buffer chunks inside a single `pre`/`code` block.

---

## 5. Database & Query Performance Issues

### Problem 17: N+1 Database Query Pattern in Available Developers Roster
* **Location:** `backend/apps/accounts/views.py` (Lines 551–576)
* **Category:** Database Performance / N+1 Query
* **Description:** `CompanyAvailableDevelopersView.get()` retrieves developers with `User.objects.filter(...)` and serializes them using `DeveloperUserSerializer`. The serializer accesses related fields (e.g., social accounts and profile status) without prefetching relations.
* **Impact:** As the user base expands, fetching the developer list generates dozens of duplicate SQL queries per request ($N+1$ performance drop), causing UI response latency.
* **Remediation:** Apply `select_related('company_profile')` and `prefetch_related('social_accounts')` to the initial queryset before passing to the serializer.

### Problem 18: Unindexed Foreign Keys and Frequently Filtered Fields
* **Location:** `backend/apps/projects/models.py` & `backend/apps/accounts/models.py`
* **Category:** Database Indexing / Latency
* **Description:** Key relation and filter fields—such as `TestRun.executor`, `CompanyDeveloperRequest.developer`, `Notification.recipient`, and `Project.connection_code` lookups—lack explicit composite indexes.
* **Impact:** As table sizes grow into hundreds of thousands of test runs and notifications, queries filtering by `executor_id` or `recipient_id` require full table scans, resulting in database slow queries.
* **Remediation:** Add `db_index=True` or `Meta.indexes` (e.g., `models.Index(fields=['recipient', 'is_read'])`) on high-frequency lookup fields.

---

### Problem 19: Unrestricted Base64 Upload Size for Company Logos
* **Location:** `backend/apps/accounts/views.py` (Lines 101, 146)
* **Category:** Data Validation / Memory Usage
* **Description:** `CompanyRegisterView` and `CompanyMeView` accept arbitrary raw Base64 data strings for the `logo` text field without validating MIME type, image dimensions, or encoding length.
* **Impact:** Submitting multi-megabyte image strings bloats PostgreSQL storage, exceeds JSON serialization limits, and causes severe rendering lag when loading logos in organization lists across the frontend.
* **Remediation:** Validate file uploads using Django's file storage handling (`FileField`/`ImageField`), validate MIME type, and restrict max image upload size to 2MB.

---

### Problem 20: Missing Pagination on Team Roster & Organization API Views
* **Location:** `backend/apps/accounts/views.py` (Lines 890–905, 1019–1065)
* **Category:** API Design / Memory Exhaustion
* **Description:** `CompanyTeamListCreateView` and `DeveloperOrganizationDetailView` return all teams, projects, and active developers in a single unpaginated JSON response payload.
* **Impact:** Large enterprise accounts managing hundreds of developers and projects will generate massive HTTP payload sizes, causing API response timeouts and excessive memory consumption on both client and server.
* **Remediation:** Implement cursor or page-number pagination (`DefaultPagination`) for team member lists and organization project lists.
