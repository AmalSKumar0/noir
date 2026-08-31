# 🚀 Noir Project Roadmap, Accomplishments & Future Vision

This document tracks **what has been built to date**, **immediate upcoming engineering tasks**, and **long-term "nice-to-have" features** for the Noir Software Reliability Engineering platform.

---

## ✅ 1. What We Have Built & Accomplished Till Now

### 🔐 A. Authentication & Enterprise Identity Architecture
- **Dual-Role JWT Engine**: Extended Django user model supporting `developer` and `company` user roles with SimpleJWT 30m access / 12d refresh tokens.
- **Self-Healing Role Protection**: Automated logic across auth serializers and `me` endpoints that repairs orphaned `company` roles lacking valid profile records.
- **OS Native Keyring Credential Storage**: CLI agent securely stores access and refresh tokens using system Keyring (macOS Keychain, Linux SecretService, Windows Credential Manager).
- **Enterprise Approval Workflow**: Company registration lifecycle tracking (`PENDING`, `APPROVED`, `REJECTED`) with protective frontend route guards (`CompanyStatus` view).
- **Social OAuth Callback Handler**: Support for Google and GitHub OAuth flow callbacks across both browser dashboard and CLI agent.

### ⚡ B. High-Performance CLI Agent & Clean Architecture
- **Complete Command Refactoring**: Standardized and optimized all 10 CLI commands (`run`, `test`, `analyze`, `login`, `logout`, `whoami`, `connect`, `sync`, `status`, `doctor`).
- **Technical Debt Elimination**: Removed deprecated boilerplate files, 0-byte scripts, and redundant imports.
- **Robust Process & Container Management**: Isolated `noir run` container executions with auto-generation of fallback Dockerfiles and guaranteed process cleanup (`finally` block handler on SIGINT/Ctrl+C).
- **Rich Terminal Interface**: Built custom banners, progress spinners, and formatted profile tables using `rich`.

### 🐾 C. Lynx AST & Static Workspace Analysis Engine
- **Zero-Dependency Static Engine**: High-speed, non-intrusive workspace analyzer (`evidence_collector`, `scoring_engine`, `identification_engine`, `profiler`).
- **Multi-Stack Detection**: Identifies frameworks (Django, React, FastAPI, Next.js, Express, Pytest, Jest, Laravel, Spring Boot), primary languages, package managers (`uv`, `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `cargo`), and OS environments in under 50ms.
- **Offline Cache**: Automatically caches profile findings locally in `.noir/cache/analysis.json`.

### 📡 D. Telemetry Pipeline & On-Demand WebSockets
- **ASGI & Channels Integration**: Configured Daphne server and Channels group broadcasting for real-time log transmission.
- **On-Demand Socket Activation**: Implemented server-side cache tracking (`core_active_stream_<code?>`) and `/stream-status/` polling endpoint.
- **Resource Optimization**: WebSockets auto-connect **only** during active `noir run` container executions or `noir analyze` AST scans, disconnecting after a 5-second idle grace period to conserve server RAM and socket descriptors.

### 🌐 E. Enterprise Dashboard & Analytics UI
- **Unified Single-Page React App**: Navigation bar with role-based visibility, company status gating, and project management views.
- **Live Stream Terminal**: Interactive terminal component rendering real-time container log output with auto-scrolling and timestamp formatting.
- **Documentation & Quickstart Pages**: Integrated clean, README-style in-app guide pages (`QuickstartPage`) detailing CLI command usage and workflow instructions.
- **Test History Analytics**: Visualizer component (`TestHistoryAnalytics`) prepared for test suite pass/fail metrics and duration trends.

---

## 🎯 2. Immediate Next Steps (What Will Be Done Next)

| Priority | Task | Target Area | Description |
| :---: | :--- | :--- | :--- |
| **P0** | **Go-Binary CLI Migration** | CLI Agent | Migrate the CLI agent core from Python/Typer to a compiled Go binary (as outlined in ADR) to eliminate Python startup overhead (~250ms $\rightarrow$ <15ms). |
| **P1** | **TestRun Endpoints Data Binding** | Frontend / Backend | Connect `TestHistoryAnalytics.tsx` charts directly to backend database test run history endpoints (`/api/projects/test-runs/`). |
| **P1** | **Cursor-Based Endpoint Pagination** | Backend API | Implement cursor pagination on historical log and test run endpoints to ensure fast response times for projects with thousands of test runs. |
| **P2** | **One-Line Shell Installation Script** | CLI / Distribution | Provide an automated single-line install script (`curl -fsSL https://noir.dev/install.sh | sh`) for Linux and macOS environments. |

---

## 🌟 3. Future "Nice-to-Have" Features (Product Backlog)

### 🤖 A. AI-Powered Failure Analysis & Fix Generation
- Integrate LLMs (e.g. Gemini 1.5/3.0 Pro) into the backend telemetry stream to automatically analyze stack traces from failed `noir test` runs.
- Generate automated pull request comments containing suggested code fixes and root cause explanations.

### 🔄 B. GitHub Actions & Native CI/CD Integration
- Publish an official GitHub Action (`noir-ai/noir-action@v1`) enabling zero-config integration into existing CI/CD pipelines.
- Automatically comment test execution telemetry and Lynx profile diffs on pull requests.

### ⚡ C. Distributed Test Sharding
- Intelligent test runner partitioner that splits test suites across parallel Docker execution containers based on historical test duration metrics.

### 🔔 D. Real-Time Slack & Microsoft Teams Webhooks
- Out-of-the-box webhook integrations sending instant failure alerts and reliability health summaries to team communication channels.

### 🛡 E. Container Security Vulnerability Scanning
- Extend Lynx engine capabilities to scan Docker container base images for known CVEs and outdated dependency packages before execution.
