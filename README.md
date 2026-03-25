# BTP Admin UI — v0.3.1

A multi-tenant administration SPA for the **btp-gateway** backend. Manages tenants, BTP accounts, credential sets, and users — and provides operational views for BTP Account hierarchy, Events, Entitlements, Consumption/Cost data, Budget alerts, and Environment Instances.

---

## Table of Contents

1. [Stack](#stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [First-Time Setup](#first-time-setup)
5. [Running with the Backend](#running-with-the-backend)
6. [User Guide](#user-guide)
   - [Login](#login)
   - [Dashboard](#dashboard)
   - [Tenants](#tenants)
   - [Onboarding a New Customer — Step-by-Step](#onboarding-a-new-customer--step-by-step)
   - [Settings — BTP Accounts](#settings--btp-accounts)
   - [Managing Credentials](#managing-credentials)
   - [Managing Users](#managing-users)
   - [Accounts (BTP Hierarchy)](#accounts-btp-hierarchy)
   - [Subaccount Detail](#subaccount-detail)
   - [Events](#events)
   - [Entitlements](#entitlements)
   - [Environments](#environments)
   - [Consumption & Costs](#consumption--costs)
   - [Budgets & Alerts](#budget-overview)
   - [Audit Logs](#audit-logs)
7. [Environment Variables](#environment-variables)
8. [Building for Production](#building-for-production)
9. [Changelog](#changelog)
10. [Testing](#testing)

---

## Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | Vue 3 + Vite 5 (Composition API + TS)   |
| Routing       | Vue Router v4                           |
| UI Components | shadcn-vue (Radix Vue + Tailwind v3)    |
| Global State  | Pinia                                   |
| Server State  | @tanstack/vue-query                     |
| Forms         | VeeValidate + Zod                       |
| HTTP          | Axios (JWT interceptor + 401 redirect)  |
| Icons         | Lucide Vue Next                         |
| Toasts        | Vue Sonner                              |

---

## Project Structure

```
btp-admin/
├── .env.local                 # VITE_API_BASE_URL (not committed)
├── src/
│   ├── main.ts                # App bootstrap: Vue, Pinia, Router, vue-query
│   ├── App.vue                # Root: <RouterView> + <Toaster>
│   │
│   ├── api/                   # Typed async functions — one file per resource
│   │   ├── types.ts           # Shared TS interfaces and request DTOs
│   │   ├── auth.ts            # login(), me()
│   │   ├── tenants.ts         # Tenant + User CRUD
│   │   └── btp-accounts.ts    # BtpAccount + CredentialSet CRUD
│   │
│   ├── composables/           # vue-query wrappers
│   │   ├── useTenants.ts      # useTenants(), useTenant(), useTenantUsers()
│   │   └── useBtpAccounts.ts  # useBtpAccounts(), useCredentialSets()
│   │
│   ├── stores/
│   │   └── auth.ts            # Pinia: token, user, setAuth(), clearAuth()
│   │
│   ├── lib/
│   │   ├── axios.ts           # Axios instance + JWT + 401 interceptors
│   │   └── utils.ts           # cn() helper (Tailwind class merging)
│   │
│   ├── router/
│   │   └── index.ts           # Routes + requiresAuth navigation guard
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue   # Fixed sidebar + scrollable <RouterView>
│   │   │   └── Sidebar.vue    # Nav links, user info, sign-out
│   │   └── ui/                # shadcn-vue auto-generated components
│   │
│   └── views/
│       ├── LoginView.vue
│       ├── DashboardView.vue
│       ├── tenants/
│       │   ├── TenantsView.vue        # Tenant list + Create dialog
│       │   └── TenantDetailView.vue   # Tenant header + Users section
│       ├── btp-accounts/
│       │   ├── BtpAccountsTab.vue          # Account list + expandable rows
│       │   └── CredentialSetsSection.vue   # Credentials per account
│       ├── settings/
│       │   └── SettingsView.vue       # Self-service BTP account + credential management
│       ├── users/
│       │   └── UsersTab.vue           # User list + Create/Edit dialogs
│       ├── accounts/
│       │   └── AccountsView.vue       # Global account hierarchy (tree: dirs + subaccounts)
│       ├── events/
│       │   └── EventsView.vue         # BTP platform events with filters and pagination
│       ├── entitlements/
│       │   └── EntitlementsView.vue   # Service catalog cards with assignment panel
│       ├── audit/
│       │   └── AuditLogsView.vue      # Audit log viewer with time-range and OData filters
│       └── consumption/
│           └── ConsumptionView.vue    # Monthly usage + cost charts + cloud credits balance
└── src/__tests__/             # Vitest test suite
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- The **btp-gateway** backend running (see [Running with the Backend](#running-with-the-backend))

### Install and run

```bash
# From the btp-admin directory
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

### First-time environment setup

Create `.env.local` in the project root (already created, but verify):

```env
VITE_API_BASE_URL=http://localhost:3001
```

Change the URL to match wherever your `btp-gateway` instance is running (default port is `3000`; use `3001` or any other value if that port is already in use on your machine).

---

## First-Time Setup

This section covers the complete process for getting the platform running from scratch. You only need to do this once per deployment.

### Step 1 — Configure the backend

```bash
cd btp-inspector/btp-gateway
cp .env.example .env
```

Edit `.env` and fill in every required value. Pay special attention to the bootstrap section:

```env
# Generate two random 64-char hex strings (one for JWT, one for encryption):
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<64-char-hex>
ENCRYPTION_KEY=<64-char-hex>

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=btp_gateway
DB_PASSWORD=<your-db-password>
DB_DATABASE=btp_gateway

# Initial admin credentials — change these before any real deployment
BOOTSTRAP_TENANT_NAME=Platform Admin
BOOTSTRAP_TENANT_SLUG=platform
BOOTSTRAP_EMAIL=admin@example.com
BOOTSTRAP_PASSWORD=<strong-password>
```

### Step 2 — Start PostgreSQL

```bash
cd btp-inspector/btp-gateway
docker-compose up -d postgres
```

### Step 3 — Seed the database

```bash
cd btp-inspector/btp-gateway
npm run bootstrap
```

This creates the schema, the initial tenant, and the admin user. Output:

```
✓ Tenant created: Platform Admin (slug: platform, id: <uuid>)
✓ Admin user created: admin@example.com

──────────────────────────────────────────────────────────────────
Bootstrap complete. Log in to the admin UI with:
  Tenant slug  →  platform
  Email        →  admin@example.com
  Password     →  (value of BOOTSTRAP_PASSWORD in .env)
──────────────────────────────────────────────────────────────────
```

### Step 4 — Start both services

**Terminal 1 — Backend**
```bash
cd btp-inspector/btp-gateway
npm run start:dev        # http://localhost:${PORT} — see PORT in .env (default 3000)
```

**Terminal 2 — Admin UI**
```bash
cd btp-inspector/btp-admin
npm run dev              # http://localhost:5173
```

### Step 5 — Log in and complete the setup

1. Open **http://localhost:5173**
2. Log in with the bootstrap credentials printed in Step 3
3. Follow the [Onboarding a New Customer](#onboarding-a-new-customer--step-by-step) guide to create your real tenants, BTP accounts, and credential sets
4. When your real setup is done, go to **Tenant → Users** and deactivate or delete the bootstrap admin user

> The `platform` tenant and its admin user are purely for initial configuration. Once you have created your real tenant structure, this bootstrap tenant is no longer needed.

---

## Running with the Backend

The admin UI is **fully independent** from the backend — it communicates exclusively via the REST API. They are sibling directories:

```
btp-inspector/
├── btp-gateway/    ← NestJS backend
└── btp-admin/      ← This project
```

### Development (two terminals)

**Terminal 1 — Backend**
```bash
cd btp-inspector/btp-gateway
npm run start:dev        # NestJS on http://localhost:${PORT} — see PORT in .env
```

**Terminal 2 — Admin UI**
```bash
cd btp-inspector/btp-admin
npm run dev              # Vite on http://localhost:5173
```

The `VITE_API_BASE_URL` in `.env.local` must match the gateway's port (e.g. `http://localhost:3001`).

### Production

Both services are independently deployed:

| Service    | Deployment              | Notes                                         |
| ---------- | ----------------------- | --------------------------------------------- |
| btp-gateway | Node.js / Docker       | Exposes REST API on a configured port          |
| btp-admin  | Static files (nginx)    | `VITE_API_BASE_URL` injected at **build time** |

The admin UI build output (`dist/`) is pure static HTML/CSS/JS that can be served from any CDN or nginx. The backend URL must be known at build time:

```bash
VITE_API_BASE_URL=https://api.your-domain.com npm run build
```

See the Dockerfile in CLAUDE.md for the full containerized setup.

---

## User Guide

### Login

Navigate to `/login`. You need three pieces of information:

| Field       | Description                                        |
| ----------- | -------------------------------------------------- |
| Tenant      | The slug of the tenant your admin account belongs to |
| Email       | Your admin user's email address                    |
| Password    | Your admin user's password                         |

On success you are redirected to the Dashboard. Your JWT is stored in `localStorage` and automatically attached to all subsequent API calls. The session persists across page reloads until you sign out or the token expires.

---

### Dashboard

Shows a live summary of the system state:

- **Active Tenants** — number of tenants with `isActive: true`
- **BTP Accounts** — number of active accounts across all tenants
- **Signed In As** — the currently authenticated user's email and role

---

### Tenants

`/tenants` — the central management screen. Every customer in the system is represented as a tenant.

| Column   | Description                                       |
| -------- | ------------------------------------------------- |
| Name     | Human-readable label                              |
| Slug     | URL-safe identifier used in API calls             |
| Status   | Active / Inactive badge                           |
| Created  | Creation date                                     |
| Actions  | Activate / Deactivate toggle                      |

Clicking a row navigates to **Tenant Detail** (`/tenants/:id`).

---

### Onboarding a New Customer — Step-by-Step

This is the most common workflow. Follow these steps to go from zero to a fully configured customer.

#### Step 1 — Create the tenant

1. Go to **Tenants** (`/tenants`)
2. Click **New Tenant**
3. Fill in:
   - **Name** — e.g. `Acme Corporation`
   - **Slug** — e.g. `acme-corp` (lowercase, hyphens only — this is permanent)
4. Click **Create** → the tenant appears in the table

#### Step 2 — Create an admin user for the tenant

1. Click the tenant row to open **Tenant Detail**
2. Click **Add User**
3. Fill in email, a strong password, and select **Role**:
   - `admin` — full read/write access
   - `viewer` — read-only access
4. Click **Add User**

The new user can now log in with the tenant slug, email, and password.

#### Step 3 — Configure BTP Accounts (self-service)

BTP account and credential management is self-service — each tenant configures their own accounts after logging in. Share the tenant slug and the credentials from Step 2 with the customer, then ask them to:

1. Log in with their tenant slug, email, and password
2. Click **Settings** in the left sidebar (gear icon)
3. Click **Add Account** and fill in the BTP account details (see [Settings — BTP Accounts](#settings--btp-accounts) for the full walkthrough)

> If you are setting up accounts on behalf of a tenant (e.g. during onboarding), log in as that tenant's admin user and follow the same Settings flow.

---

### Settings — BTP Accounts

`/settings` — accessible from the **Settings** item (gear icon) at the bottom of the left sidebar. This is where each tenant configures the BTP accounts and credentials that power all data views (Accounts, Events, Consumption, etc.).

#### Adding a BTP Account

1. Click **Add Account**
2. Fill in:
   - **Display Name** — a friendly label, e.g. `Production Global Account`
   - **Global Account ID** — the UUID from the SAP BTP cockpit (Global Account → GUID)
   - **Region** — the data-center region code, e.g. `eu10`, `us10`, `ap10`
3. Click **Add** → the account appears in the table

#### Adding Credential Sets

Each BTP account needs credentials for each service it will communicate with:

| Type        | Service                  |
| ----------- | ------------------------ |
| `CIS`       | Cloud Integration Suite  |
| `UDM`       | Unified Data Management  |
| `AUDIT_LOG` | SAP Audit Log Service    |

1. Click the **chevron (›)** on the account row to expand it
2. Click **Add Credential**
3. Select the **Type** — a contextual help message explains where to find the values
4. Fill in the four OAuth2 fields:
   - **Token URL** — the OAuth2 token endpoint from the service key
   - **Client ID** — from the service key
   - **Client Secret** — from the service key (stored encrypted; never shown again)
   - **Service URL** — the base URL of the target service
5. Click **Add**

> **Where to find service keys**: In the SAP BTP cockpit, navigate to your subaccount → **Services** → **Instances and Subscriptions** → click your service instance → **Service Keys** tab → create or copy an existing key.

#### Testing Credentials

After adding a credential set, verify it works before using any data views:

1. In the expanded credential row, click the **flask icon**
2. The result badge updates inline:
   - **Pass** (green) — the gateway successfully obtained a token and reached the service
   - **Fail** (red) — error shown inline; check the Token URL, Client ID/Secret, and that the service is reachable from the gateway host

---

### Managing Credentials

Credential sets live under a BTP Account in **Settings**. Expand any account row to see its credential sets and:

- **Test** (flask icon) — runs a live connectivity check against the gateway backend
- **Delete** (trash icon) — shows a confirmation dialog before permanently removing the credential

> Secrets are write-only. If a secret rotates, delete the old credential set and create a new one.

---

### Managing Users

The **Users** tab on Tenant Detail shows all users scoped to that tenant.

- **Add User** — create a new user with email, password, and role
- **Edit** (pencil icon) — change role or toggle `isActive` without resetting the password

Deactivating a user (`isActive: false`) prevents them from logging in while preserving their account for audit purposes.

---

### Accounts (BTP Hierarchy)

`/accounts` — displays the full BTP Global Account structure as an interactive tree.

- **Global Account** info card (display name, state, commercial model, contract status)
- **Directories** shown as collapsible tree nodes with nested sub-directories and subaccounts
- **Subaccounts** as leaf nodes with region, state badge, and quick-link to BTP cockpit
- **Label filter chips** — filter subaccounts by key:value labels from the BTP cockpit
- **View Details** icon (↗) on each subaccount row opens the Subaccount Detail page
- The account selector in the sidebar determines which BTP account's hierarchy is shown

---

### Subaccount Detail

`/accounts/:guid` — dedicated drill-down page for a single subaccount.

| Section               | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| Header                | Display name, GUID chip, state badge, region, subdomain, label chips        |
| Current Month Cost    | Total spend this month + top-5 services table                               |
| Entitlements          | All service plans assigned to this subaccount with quota and state          |
| Recent Events         | Latest platform events filtered to this subaccount's GUID                  |
| Environment Instances | CF orgs, Kyma clusters, and other environments linked to this subaccount    |

Navigate back to the full tree with the breadcrumb back button.

---

### Events

`/events` — paginated view of SAP BTP platform events (account management, entitlement, provisioning actions).

| Filter      | Description                                     |
| ----------- | ----------------------------------------------- |
| Event Type  | Drop-down of all known event type categories    |
| Entity Type | Filter by entity kind (Subaccount, Directory…)  |
| Entity ID   | Filter by a specific entity GUID                |
| Date range  | From / To timestamps (datetime-local inputs)    |
| Page size   | 10 / 25 / 50 / 100 events per page              |

Each event row expands to show the full `details` JSON payload.

---

### Entitlements

`/entitlements` — service catalog view with subaccount assignment information.

- **Service cards** — one card per entitled service with icon, display name, and status badge:
  - `Active` — service is subscribed/provisioned in at least one subaccount (state OK)
  - `Assigned` — quota is distributed but no active subscription yet
  - `Entitled only` — service is available in the global account but not assigned anywhere
- **Plan list** — click the chevron on any service card to expand the plan list, showing assigned quota per subaccount
- **Assignment panel** — click a plan row to open the panel with a list of all subaccount assignments, showing display name, description, GUID, state badge, and auto-assign flags
- **Filter bar** — search by service name, filter by category, toggle "Assigned only" to hide services with no assignments
- **Subaccount filter** — select a subaccount from the drop-down to see only services assigned to it

---

### Environments

`/environments` — all provisioned environment instances (Cloud Foundry orgs, Kyma clusters, etc.) across the global account.

| Column      | Description                                       |
| ----------- | ------------------------------------------------- |
| Name        | Instance display name                             |
| Type        | Environment type badge (cloudfoundry, kyma, …)   |
| Subaccount  | Owning subaccount GUID                            |
| State       | OK / CREATING / DELETING / CREATION_FAILED badge  |
| Created     | Provisioning timestamp                            |

- Filter by environment type using pill tabs
- Filter by subaccount using the searchable combobox
- Click any row to expand the full JSON detail

---

### Consumption & Costs

`/consumption` — monthly usage and cost overview powered by SAP BTP Usage Data Management (UDM) and Budgets APIs.

Requires a **UDM** credential set (for cost/usage data) and a **CIS** credential set (for budgets and cloud credits) to be configured for the selected BTP account.

| Card / Section            | Description                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Cloud Credits Balance     | Current balance from the latest contract phase, with start/end dates. Scrollable phase breakdown |
| Credit Runway             | Projected depletion month based on average monthly burn rate over the last 3 months              |
| Top Subaccounts by Cost   | Bar chart of up to 15 subaccounts sorted by total cost — click a bar to drill down               |
| Top Services by Cost      | Pie chart of top 10 cost-generating services for the selected period                             |
| Subaccount Consumption    | Historical cost trend and full service breakdown for a selected subaccount                       |
| Budget Overview           | Budgets configured in the BTP cockpit with alert thresholds and current month utilization        |
| Directory Usage           | Usage data from a directory-scoped UDM service instance (optional)                              |

#### Budget Overview

The **Budget Overview** section reads from the SAP Account Budgets Service (`account-budgets-service.cfapps.<region>.hana.ondemand.com`) using the same CIS credentials. It shows:

- Budget name, ceiling amount, currency, and type (COST / CHARGED_USAGE)
- Reset interval (MONTHLY)
- Alert thresholds — e.g. "Alert at 80%", "Alert at 100%" — shown as amber badges; disabled thresholds are struck through
- Scope: which subaccounts or products the budget applies to (empty = global account scope)
- **Current utilization bar** — for COST-type budgets, computes this-month spend from the already-loaded subaccount cost data and renders a coloured progress bar (green → amber at 80% → red at 100%)
- Start / end dates

> **Note:** The SAP Budget API returns budget definitions only — it does not expose a real-time "consumed so far" counter. The utilization bar is an approximation based on the subaccount cost data for the currently selected month.

Use the **Year** and **Month** selectors in the header to switch the reporting period.

---

## Environment Variables

| Variable           | Required | Description                                 |
| ------------------ | -------- | ------------------------------------------- |
| `VITE_API_BASE_URL` | Yes      | Base URL of the btp-gateway REST API, e.g. `http://localhost:3001` |

Vite exposes only variables prefixed with `VITE_` to the browser bundle. Never put secrets in this file — it is baked into the client JavaScript at build time.

---

## Building for Production

```bash
npm run build
```

Output is written to `dist/`. The build fails on any TypeScript errors.

For nginx, route all requests to `index.html` (required for Vue Router's history mode):

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## Changelog

### v0.3.1 — 2026-03-25

**Architecture**
- **BTP account management moved to Settings** — BTP accounts and credentials are now managed from `/settings` (sidebar gear icon) instead of the Tenant Detail page. This correctly models the self-service flow: each tenant configures their own accounts after logging in, and the backend always scopes accounts to the JWT tenant.
- **Tenant Detail simplified** — the BTP Accounts tab has been removed; the page now shows the Users section directly.
- **`GET /tenants` scoped to own tenant** — the backend now returns only the authenticated user's own tenant record instead of all tenants, preventing cross-tenant data exposure.

---

### v0.3.0 — 2026-03-23

**New features**
- **Global top bar** — persistent header on every page showing live date/time, notification bell, and profile dropdown (with sign-out and administration shortcut)
- **Syrio branding** — real Syrio logo icon in the sidebar brand header and login screen; teal → blue gradient accent line on every page's filter bar
- **Budget Overview** — new section in Consumption view showing all budgets configured in the BTP cockpit, alert thresholds, scope (resolved subaccount names), and a current-month utilization bar
- **Subaccount Detail page** (`/accounts/:guid`) — full drill-down with cost, entitlements, events, and environment instances
- **Environments view** (`/environments`) — lists all provisioned CF orgs, Kyma clusters, and other environment instances with type/state filtering
- **Credential Health** on the Dashboard — table of all credential sets across all accounts with inline Test All button
- **Burn Rate / Runway card** in Consumption — projected credit depletion date based on 3-month average spend
- **Label filter chips** in Accounts and Consumption — filter subaccounts by BTP cockpit labels
- **Recent Events feed** on the Dashboard

**Bug fixes**
- Fixed duplicate entitlement entries in Subaccount Detail and Accounts view — `assignmentInfo` now filtered by `entityId` to match only the current subaccount
- Fixed chart white space in Consumption layout — charts now stack in a right column with `items-start` grid

**Backend (btp-gateway v0.3.0)**
- New `BudgetsModule` — full CRUD proxy for the SAP Account Budgets Service
- `BtpHttpService` extended to route `serviceType: 'budgets'` to `account-budgets-service.cfapps.<region>.hana.ondemand.com`
- New `ProvisioningModule` — environment instances endpoints

---

### v0.2.0

- Events, Entitlements, Accounts hierarchy views
- Consumption view with cloud credits and UDM cost data
- Dashboard with summary cards

### v0.1.x

- Initial release — Auth, Tenants, BTP Accounts, Credential Sets, Users

---

## Testing

```bash
# Run all tests once
npm test

# Watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

The test suite uses **Vitest** + **@vue/test-utils** + **happy-dom**.

### What is tested

| Area                      | File                                                       | Type        |
| ------------------------- | ---------------------------------------------------------- | ----------- |
| Auth store                | `src/__tests__/stores/auth.spec.ts`                        | Unit        |
| Axios interceptors        | `src/__tests__/lib/axios.spec.ts`                          | Unit        |
| useTenants composable     | `src/__tests__/composables/useTenants.spec.ts`             | Unit        |
| useBtpAccounts composable | `src/__tests__/composables/useBtpAccounts.spec.ts`         | Unit        |
| LoginView                 | `src/__tests__/views/LoginView.spec.ts`                    | Component   |
| Sidebar                   | `src/__tests__/components/Sidebar.spec.ts`                 | Component   |
| AccountTreeNode           | `src/__tests__/components/AccountTreeNode.spec.ts`         | Component   |
| TenantsView               | `src/__tests__/views/TenantsView.spec.ts`                  | Component   |
| TenantDetailView          | `src/__tests__/views/TenantDetailView.spec.ts`             | Component   |
| AccountsView              | `src/__tests__/views/AccountsView.spec.ts`                 | Component   |
| Tenant onboarding flow    | `src/__tests__/integration/tenantFlow.spec.ts`             | Integration |
| Credential flow           | `src/__tests__/integration/credentialFlow.spec.ts`         | Integration |
