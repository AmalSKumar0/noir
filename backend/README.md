# 🔮 Noir Backend API & Telemetry Engine

The **Noir Backend** is a high-performance Django REST & ASGI Channels application designed for enterprise software reliability monitoring, containerized test execution tracking, real-time log streaming, and organizational developer team management.

---

## 🏗 System Architecture & Technology Stack

- **Framework**: Django 6.0+ & Django REST Framework (DRF)
- **Real-Time Telemetry**: Django Channels & Daphne ASGI Server (WebSockets)
- **Authentication**: JWT (JSON Web Tokens) with Token Rotation & Keyring Storage (`rest_framework_simplejwt`)
- **Database**: PostgreSQL / SQLite (Configurable via Environment Variables)
- **Security & Rate Limiting**: Custom DRF Throttling (`UserRateThrottle`, `AnonRateThrottle`) & CORS Headers

---

## 🧩 Backend Applications Overview

The backend is modularized into distinct domain apps inside `backend/apps/` and shared utilities in `backend/core/`.

```
backend/
├── apps/
│   ├── accounts/     # Identity, Enterprise Organizations & Developer Teams
│   ├── projects/     # Project Telemetry, Test Runs, Lynx AST & WebSockets
│   ├── users/        # Administrative User Management & Directory
│   └── cli/          # CLI Agent Handshake & Token Verification Protocols
├── core/             # Shared Pagination, Middleware & Utilities
└── backend/          # Project Settings, ASGI/WSGI Routing & URLs
```

---

### 1. `apps.accounts` — Identity, Enterprise & Team Management

This application manages user authentication, user roles, corporate entity onboarding, developer team structures, and organization invitations.

#### Key Models
- **`User`**: Custom user model extending `AbstractUser`. Supports `developer` and `company` roles with direct relationship links to an organization (`CompanyProfile`).
- **`CompanyProfile`**: Holds enterprise organization details including company name, logo, industry, website, tax ID, phone number, and onboarding verification status (`PENDING`, `APPROVED`, `REJECTED`).
- **`DeveloperTeam`**: Cross-functional team structure owned by a company. Teams can have assigned developer members and linked reliability projects.
- **`CompanyDeveloperRequest`**: Manages formal joining requests and invitations between companies and developers (`PENDING`, `ACCEPTED`, `REJECTED`).
- **`Notification`**: System and organizational notification log (`company_invite`, `company_accept`, `company_remove`, `system`).
- **`SocialAuth`**: OAuth provider linkage tracking (Google, GitHub, Password).

#### Key API Endpoints
| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/accounts/register/` | Register standard developer or company account |
| `POST` | `/api/accounts/token/` | Generate JWT Access & Refresh token pair |
| `POST` | `/api/accounts/logout/` | Blacklist refresh token and terminate session |
| `GET` | `/api/accounts/me/` | Retrieve current authenticated user profile |
| `GET` / `POST` | `/api/accounts/companies/` | List and create company profiles |
| `PATCH` | `/api/accounts/companies/<id>/status/` | Admin endpoint to approve/reject company status |
| `GET` / `POST` | `/api/accounts/teams/` | List and create developer teams within organization |
| `POST` | `/api/accounts/teams/<id>/members/` | Add or remove developer members from a team |

---

### 2. `apps.projects` — Reliability Engine, Test Runs & Live Telemetry

The core engine responsible for managing Noir project metadata, Lynx AST profile reports, containerized test execution run histories, and live WebSocket streaming.

#### Key Models
- **`Project`**: Core project container featuring title, description, architecture (`monolith`, `microservice`), visibility (`public`, `private`), status, and a unique connection code (e.g. `NR-KO2Y3DZZ`).
- **`ProjectProfile`**: Auto-generated Lynx AST profiler snapshot store containing primary language, detected framework, runtime version, package manager, OS info, and raw analysis JSON (`analysis_data`).
- **`TestRun`**: Detailed record of local or containerized test executions. Tracks status (`PASSED`, `FAILED`, `ERROR`), command executed, test metrics (passed/failed/skipped/total), execution duration in milliseconds (`duration_ms`), and full console output logs.
- **`Framework`**: Reference model containing tech stack signatures and default test commands (e.g., Pytest, Jest, Cargo, Go Test).

#### Real-Time Telemetry & WebSockets
- **`ProjectLogsConsumer`** (`routing.py` & `consumers.py`): ASGI WebSocket consumer listening at `ws/project/<project_code>/logs/`. Broadcasts real-time stdout/stderr log lines dispatched by the CLI agent directly to frontend live terminal clients.

#### Key API Endpoints
| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/all/` | List all system projects |
| `POST` | `/api/projects/create/` | Create a new project workspace |
| `GET` | `/api/projects/my/` | Fetch projects owned by authenticated user or team |
| `GET` | `/api/projects/<id>/` | Fetch project details by primary key |
| `GET` | `/api/projects/connection-id/<code?>/` | Fetch project by connection code (used by CLI agent) |
| `POST` | `/api/projects/<identifier>/profile/` | Post updated Lynx AST profile scan data |
| `POST` | `/api/projects/<identifier>/stream-logs/` | Post CLI log lines to broadcast over WebSocket channels |
| `GET` | `/api/projects/<identifier>/stream-status/` | Polling endpoint checking if stream is currently active |
| `GET` / `POST` | `/api/projects/test-runs/` | List test run history or post new test run results |
| `GET` | `/api/projects/test-runs/<id>/` | Fetch detailed logs and metrics for a specific test run |

---

### 3. `apps.users` — Administrative User Management

Provides administrative control and monitoring over user accounts, permissions, directory filtering, and security throttling.

#### Key Endpoints
| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users/` | List all registered user accounts (Admin only, rate-limited) |
| `GET` / `PUT` / `DELETE` | `/api/users/<id>/` | Retrieve, update, or remove user account (Admin restricted) |

---

### 4. `apps.cli` — CLI Agent Integration Module

Serves as the specialized gateway and verification handshake protocol for the `noir` CLI command-line agent.

#### Key Features
- Connection code validation and authorization check.
- Token exchange protocol for CLI workspace linking (`noir connect <code>`).

---

### 5. `core/` — Infrastructure & Shared Utilities

Centralized folder containing reusable utility modules across all backend apps:
- **`pagination.py`**: Defines standard pagination response formatting (`DefaultPagination`, `StandardResultsSetPagination`).
- **`middleware.py`**: Provides security enhancements and request logging middleware.

---

## 🛠 Setup & Running Locally

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Apply Migrations**:
   ```bash
   python manage.py migrate
   ```

3. **Run Development Server (ASGI/Daphne Enabled)**:
   ```bash
   python manage.py runserver 8000
   ```
   *The server runs ASGI Daphne at `http://127.0.0.1:8000/` and supports WebSockets at `ws://127.0.0.1:8000/ws/project/<code?>/logs/`.*
