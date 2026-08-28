# NOIR - Frontend Pages & Content Catalog

Welcome to the comprehensive content catalog for **NOIR**, the autonomous reliability engineering platform. This document outlines the application's page structure, routing paths, navigation, and details the content and logic for all 11 views within the frontend codebase.

---

## 🧩 Shared Layouts & Common Content Elements

These components define the structure and content frames of the application:
1.  **Navbar (`Navbar.tsx`)**: The public website navigation header. Contains links for home page section navigation and entry buttons to sign in/get started.
2.  **Footer (`Footer.tsx`)**: Public site footer. Houses links for site navigation (Marketplace, Creators, Developers, Pricing), company info (About Us, Careers, Privacy Policy, Terms of Service), copyright info, and social media links (Twitter, GitHub, Discord).
3.  **UserLayout (`UserLayout.tsx`) & UserNavBar (`UserNavBar.tsx`)**: The framing layout for logged-in standard users. Displays page navigation, notifications, search bar, active user profiles, and logout button.
4.  **AdminLayout (`AdminLayout.tsx`) & AdminNavBar (`AdminNavBar.tsx`)**: Layout framing for admin-level pages. Standardizes navigation across administration directories.
5.  **Modal (`Modal.tsx`)**: Dialog overlay template container for contextual information, workspace configurations, and forms.
6.  **Skeleton (`Skeleton.tsx`)**: Content loading placeholder components used while waiting for API data.

---

## 📄 Page Breakdown & Content Logic

### 1. Home / Landing Page (`pages/Home.tsx`)
*   **Route**: `/`
*   **Access**: Public
*   **Layout Sections**:
    1.  `Navbar`
    2.  `Hero`: Brand introduction section.
    3.  `Marquee`: Loop displaying system features.
    4.  `About`: Core overview pitch about distributed system resilience.
    5.  `Projects`: Features grid showcasing system simulation protocols.
    6.  `CampaignBanner`: Marketing display segment.
    7.  `GetInvolved`: Step-by-step setup guides.
    8.  `Footer`
*   **Core Content & Copy**:
    *   *Introduction Badge*: "Introducing NOIR — The autonomous reliability engineer."
    *   *Hero Text*: "NOIR is an AI-assisted reliability engineering platform that automates fault injection, monitors application behavior, and generates actionable insights to identify reliability issues before deployment."
    *   *About Headline*: "We ensure your distributed systems maintain absolute resilience."
    *   *Resilience Accordion / FAQ*:
        *   "01. Install our unified telemetry client": Command parameters to run native client.
        *   "02. Define custom chaos & fault specs": Standard YAML options for targeting containers, nodes, and scheduling parameters.
        *   "03. Inject failures in sandbox or staging": Failure drill mockups for crashes, corruption, and network loss.
        *   "04. Auto-generate resilience diagnostics": Post-run diagnostics details and mitigation proposals.

### 2. Login Page (`pages/Login.tsx`)
*   **Route**: `/login`
*   **Access**: Public Only
*   **Layout**: Column-based splitting for oauth buttons and authentication credentials forms.
*   **Core Content & Copy**:
    *   *Branding*: "Welcome back to your workspace. The autonomous reliability engineer for modern applications."
    *   *Form Fields*: Email address, Password.
    *   *OAuth Integrations*: Trigger handlers for GitHub OAuth and Google OAuth.
    *   *Redirect Logic*: Checks if the user is already authenticated. If yes, redirects to `/dashboard`. Upon successful submit, sets auth tokens and routes to the dashboard.

### 3. Register Page (`pages/Register.tsx`)
*   **Route**: `/register`
*   **Access**: Public Only
*   **Layout**: Authentication form container.
*   **Core Content & Copy**:
    *   *Branding*: "Join the workspace. Register to monitor cascades and access telemetry."
    *   *Form Fields*: Username, Email address, Password, Confirm Password.
    *   *Logic*: Registration endpoint call with fields validation. Intercepts URL callbacks to process third-party authentication.

### 4. Authentication Callback Page (`pages/AuthCallback.tsx`)
*   **Route**: `/auth/callback`
*   **Access**: Public
*   **Layout**: Blank page displaying loading indicator.
*   **Core Content & Copy**:
    *   *Logic*: Extracts search parameters (`access`, `access_token`, `refresh`, `refresh_token`, or `authcode`) from URL query. Submits `authcode` payload to `/api/accounts/common-auth/callback/` to exchange it for access/refresh JWT tokens, stores tokens, and redirects the authenticated session to the user dashboard.

### 5. Logout Page (`pages/Logout.tsx`)
*   **Route**: `/logout`
*   **Access**: Authenticated users
*   **Layout**: Redirection route.
*   **Core Content & Copy**:
    *   *Logic*: Empties JWT credentials, authentication flags, and roles caching from storage, then redirects the client to the login screen.

### 6. User Dashboard Page (`pages/Dashboard.tsx`)
*   **Route**: `/dashboard`
*   **Access**: Protected (Requires standard user authentication)
*   **Layout Sections**:
    *   *Top Section*: Core metrics widgets and telemetry performance charts.
    *   *Center Section*: Title block with project selection tabs and search.
    *   *Bottom Section*: Terminal log stream beside quickstart instructions.
*   **Core Content & Copy**:
    *   *Charts*: Analytics logs monitoring active spans and total requests.
    *   *Project Selector*: Filters metrics by active workspaces.
    *   *Console Feed*: Text feed simulation simulating agent startup logging, connection logs, and connection statuses.
    *   *Quickstart Integration*: Instructions detailing agent installation commands and workspace codes.

### 7. User Projects Page (`pages/UserProjects.tsx`)
*   **Route**: `/dashboard/projects`
*   **Access**: Protected (Requires standard user authentication)
*   **Layout**: Grid listing of projects with search filters and modal action triggers.
*   **Core Content & Copy**:
    *   *Project Cards*: Displays title, unique ID, active environment count, last updated timestamp, and status badges (Active, Error, Archived).
    *   *Operations*: Workspace search, details navigation links, project creation modals, and delete requests.

### 8. Project Detail Page (`pages/ProjectDetail.tsx`)
*   **Route**: `/dashboard/projects/:projectId`
*   **Access**: Protected (Requires standard user authentication)
*   **Layout**: Columns layout dividing specs tables, command console scripts, and telemetry properties sidebar.
*   **Core Content & Copy**:
    *   *Specifications*: Shows project metadata (Visibility, Owner, Analysis Routine, Synced Timestamp) and unique connection code.
    *   *Runtime Stack*: Lists detected environment information (Python version, Django framework, uv package manager, operating system).
    *   *Integration Terminal*: Code command lines for starting and linking client agents: `noir-agent connect --code=<connection_code>`.

### 9. Admin Dashboard Page (`pages/AdminDashboard.tsx`)
*   **Route**: `/admin/dashboard`
*   **Access**: Protected (Requires Admin privileges)
*   **Layout**: Stats cards grids containing system-wide telemetry charts.
*   **Core Content & Copy**:
    *   *Administration data*: Platform active users, global request volume, server uptime percentage, and platform registration stats.

### 10. Admin Manage Projects Page (`pages/AdminManageProjects.tsx`)
*   **Route**: `/admin/projects`
*   **Access**: Protected (Requires Admin privileges)
*   **Layout**: Table listing of registered projects with search bars, settings options, and detail modals.
*   **Core Content & Copy**:
    *   *Admin controls*: Lists platform projects with names, owners, progress percentage, and synchronization status.
    *   *Inputs*: Modals for editing project name, owner assignment, active state, and setting progress.

### 11. Admin Manage Users Page (`pages/AdminManageUsers.tsx`)
*   **Route**: `/admin/users`
*   **Access**: Protected (Requires Admin privileges)
*   **Layout**: User list directory table with CRUD action modals.
*   **Core Content & Copy**:
    *   *Directory columns*: Full name, email, credentials type, role, status.
    *   *Management Logic*: 
        *   **Create**: Form fields for username, name, email, role, and active status.
        *   **Update**: Edit user profiles and credentials settings.
        *   **Delete**: Confirmation popups to permanently remove users from the platform.
