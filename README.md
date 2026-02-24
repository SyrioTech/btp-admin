# BTP Admin UI

A dedicated administration SPA for the **btp-gateway** backend. Manages tenants, BTP accounts, credential sets, and users. No charts or dashboards — pure ops tooling.

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
   - [Managing Credentials](#managing-credentials)
   - [Managing Users](#managing-users)
6. [Environment Variables](#environment-variables)
7. [Building for Production](#building-for-production)
8. [Testing](#testing)

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
│       │   └── TenantDetailView.vue   # Tabbed: BTP Accounts | Users
│       ├── btp-accounts/
│       │   ├── BtpAccountsTab.vue          # Account list + expandable rows
│       │   └── CredentialSetsSection.vue   # Credentials per account
│       └── users/
│           └── UsersTab.vue           # User list + Create/Edit dialogs
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
VITE_API_BASE_URL=http://localhost:3000
```

Change the URL to match wherever your `btp-gateway` instance is running.

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
npm run start:dev        # http://localhost:3000
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
npm run start:dev        # NestJS on http://localhost:3000
```

**Terminal 2 — Admin UI**
```bash
cd btp-inspector/btp-admin
npm run dev              # Vite on http://localhost:5173
```

The `VITE_API_BASE_URL=http://localhost:3000` in `.env.local` points the UI at the local backend.

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

#### Step 2 — Add a BTP Account

1. Click the tenant row to open **Tenant Detail**
2. The **BTP Accounts** tab is selected by default
3. Click **Add Account**
4. Fill in:
   - **Display Name** — e.g. `Production Global Account`
   - **Global Account ID** — the UUID from the BTP cockpit (SAP BTP → Global Account → GUID)
   - **Region** — the data-center region code, e.g. `eu10`, `us10`, `ap10`
5. Click **Add** → the account appears in the table

#### Step 3 — Add Credential Sets

The BTP account needs credentials for each service it will communicate with. Each credential set covers one service type:

| Type        | Service                             |
| ----------- | ----------------------------------- |
| `CIS`       | Cloud Integration Suite             |
| `UDM`       | Unified Data Management             |
| `AUDIT_LOG` | SAP Audit Log Service               |

To add a credential set:

1. On the BTP Accounts tab, click the **chevron (›)** on the account row to expand it
2. Click **Add Credential**
3. Select the **Type** — a contextual help message explains where to find the values
4. Fill in the four OAuth2 fields:
   - **Token URL** — the OAuth2 token endpoint from the service key
   - **Client ID** — from the service key
   - **Client Secret** — from the service key (stored encrypted; never shown again)
   - **Service URL** — the base URL of the target service
5. Click **Add**

> **Where to find service keys**: In the SAP BTP cockpit, navigate to your subaccount → **Services** → **Instances and Subscriptions** → click your service instance → **Service Keys** tab → create or copy an existing key.

#### Step 4 — Test the credentials

After adding a credential set, verify it actually works before moving to production:

1. In the expanded credential row, click the **flask icon (⌥)**
2. The result badge updates inline:
   - **Pass** (green) — the gateway can successfully obtain a token and reach the service
   - **Fail** (red) — check the token URL, client ID, and secret; verify the service is reachable from the gateway host

#### Step 5 — Create an admin user for the tenant

1. Switch to the **Users** tab on the Tenant Detail page
2. Click **Add User**
3. Fill in email, a strong password, and select **Role**:
   - `admin` — full read/write access
   - `viewer` — read-only access
4. Click **Add User**

The new user can now log in with the tenant slug, email, and password.

---

### Managing Credentials

Credential sets live under a BTP Account. Expand any account row (click the row or the chevron) to see its credential sets and:

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

## Environment Variables

| Variable           | Required | Description                                 |
| ------------------ | -------- | ------------------------------------------- |
| `VITE_API_BASE_URL` | Yes      | Base URL of the btp-gateway REST API, e.g. `http://localhost:3000` |

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

| Area                   | File                                        | Type        |
| ---------------------- | ------------------------------------------- | ----------- |
| Auth store             | `src/__tests__/stores/auth.spec.ts`         | Unit        |
| Axios interceptors     | `src/__tests__/lib/axios.spec.ts`           | Unit        |
| useTenants composable  | `src/__tests__/composables/useTenants.spec.ts` | Unit     |
| useBtpAccounts composable | `src/__tests__/composables/useBtpAccounts.spec.ts` | Unit |
| LoginView              | `src/__tests__/views/LoginView.spec.ts`     | Component   |
| Sidebar                | `src/__tests__/components/Sidebar.spec.ts`  | Component   |
| TenantsView            | `src/__tests__/views/TenantsView.spec.ts`   | Component   |
| TenantDetailView       | `src/__tests__/views/TenantDetailView.spec.ts` | Component |
| Tenant onboarding flow | `src/__tests__/integration/tenantFlow.spec.ts` | Integration |
| Credential flow        | `src/__tests__/integration/credentialFlow.spec.ts` | Integration |
