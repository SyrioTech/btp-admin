# BTP Gateway — Admin UI Implementation Plan

A dedicated administration SPA for managing the `btp-gateway` backend: tenants, BTP accounts, credential sets, and users. Pure ops/admin tool — no dashboards or charts (those belong to the separate client frontend).

---

## Repository Layout

```
btp-inspector/                  ← existing parent directory
├── btp-gateway/                ← existing NestJS backend (unchanged)
└── btp-admin/                  ← NEW — this project (Option A: sibling)
```

The two projects are **fully independent**: separate `package.json`, separate `node_modules`, separate deployment. The admin UI communicates with the gateway exclusively via its REST API.

---

## Technology Decision: Vue 3 + Vite (not Nuxt)

> [!IMPORTANT]
> **Use Vue 3 + Vite SPA, not Nuxt.** Nuxt adds SSR complexity that has zero benefit for a private admin tool. Vue 3 with Composition API + TypeScript is the optimal fit.

| Criteria         | Nuxt                       | Vue 3 + Vite SPA                |
| ---------------- | -------------------------- | ------------------------------- |
| SSR / SEO needed | No — private admin tool    | Not applicable                  |
| Complexity       | Server routes, hydration   | Simple SPA                      |
| Auth model       | Needs SSR session handling | JWT in `localStorage`, standard |
| Build output     | Node server or static      | Static bundle — deploy anywhere |
| UI ecosystem     | Nuxt UI / Vuetify          | shadcn-vue (top-tier)           |

---

## Stack

| Layer         | Choice                                   | Notes                                                       |
| ------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Framework     | **Vue 3 + Vite 5**                       | Composition API, TypeScript strict                          |
| Routing       | **Vue Router v4**                        | Nested routes, navigation guards                            |
| UI Components | **shadcn-vue** (Radix Vue + Tailwind v3) | Accessible, copy-paste components                           |
| Global State  | **Pinia**                                | Official Vue store, TypeScript-native                       |
| Server State  | **@tanstack/vue-query**                  | Query caching, mutations, loading states                    |
| Forms         | **VeeValidate + Zod**                    | Composition API-based; schemas mirror backend DTOs          |
| HTTP          | **Axios**                                | Request interceptor (JWT), response interceptor (401→login) |
| Icons         | **Lucide Vue Next**                      | Included with shadcn-vue                                    |
| Toasts        | **Vue Sonner**                           | Notification feedback                                       |
| Language      | **TypeScript** (strict)                  |                                                             |

---

## Project Structure

```
btp-admin/
├── .env.local                   # VITE_API_BASE_URL=http://localhost:3000
├── src/
│   ├── main.ts                  # App bootstrap: Vue, Router, Pinia, vue-query
│   ├── App.vue
│   │
│   ├── api/                     # Typed async functions — one file per resource
│   │   ├── types.ts             # Shared TS interfaces (Tenant, BtpAccount, etc.)
│   │   ├── auth.ts              # login(), me()
│   │   ├── tenants.ts           # CRUD for tenants + users
│   │   └── btp-accounts.ts      # CRUD for accounts + credential sets
│   │
│   ├── composables/             # useQuery / useMutation wrappers (vue-query)
│   │   ├── useTenants.ts
│   │   └── useBtpAccounts.ts
│   │
│   ├── stores/
│   │   └── auth.ts              # Pinia: token, user, setAuth(), clearAuth()
│   │
│   ├── lib/
│   │   └── axios.ts             # Axios instance + interceptors
│   │
│   ├── router/
│   │   └── index.ts             # Routes + beforeEach guard
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue     # Sidebar + <RouterView>
│   │   │   └── Sidebar.vue      # Nav links, active state via useRoute()
│   │   └── ui/                  # shadcn-vue generated components
│   │
│   └── views/
│       ├── LoginView.vue
│       ├── DashboardView.vue
│       ├── tenants/
│       │   ├── TenantsView.vue           # List + Create dialog
│       │   └── TenantDetailView.vue      # Tabbed: BTP Accounts | Users
│       ├── btp-accounts/
│       │   ├── BtpAccountsTab.vue        # Account list + Create dialog
│       │   └── CredentialSetsSection.vue # Credentials table per account
│       └── users/
│           └── UsersTab.vue              # User list + Create/Edit dialogs
└── package.json
```

---

## Screens & Features

### 1. Login — `/login`

- Fields: `email`, `password`, `tenantSlug` (maps to `POST /auth/login`)
- On success → store JWT in Pinia + `localStorage`, redirect to `/`
- On 401 → show inline validation error

### 2. Dashboard — `/`

- Summary cards: active tenants, BTP accounts, credential sets configured
- Current user info via `GET /auth/me`

### 3. Tenants — `/tenants`

- Table: Name, Slug, Active, Created, Actions
- **Create Tenant** dialog → `POST /tenants` (name, slug)
- **Edit** inline → `PATCH /tenants/:id` (name, isActive toggle)
- Row click → navigate to Tenant Detail

### 4. Tenant Detail — `/tenants/:id`

Two tabs:

#### Tab A — BTP Accounts

- Table: Display Name, Global Account ID, Region, Active, # Credentials, Actions
- **Add Account** dialog → `POST /btp-accounts` (globalAccountId, displayName, region)
- **Edit** → `PATCH /btp-accounts/:id`
- Expandable row → **CredentialSetsSection**:
  - Table: Type (CIS / UDM / AUDIT_LOG), Active, Created, Actions
  - **Add Credential** modal:
    - `credentialType` selector
    - `tokenUrl`, `clientId`, `clientSecret`, `serviceUrl` fields
    - Contextual help text per type (sourced from CREDENTIAL_SETUP.md)
  - **Test** button → `POST /btp-accounts/:id/credentials/:credId/test` → inline success/fail badge
  - **Delete** → confirmation dialog → `DELETE /btp-accounts/:id/credentials/:credId`

#### Tab B — Users

- Table: Email, Role, Active, Created, Actions
- **Add User** dialog → `POST /tenants/:id/users` (email, password, role)
- **Edit** dialog → `PATCH /tenants/:id/users/:userId` (role, isActive)

---

## API Layer

### `src/api/types.ts`

```typescript
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}
export interface BtpAccount {
  id: string;
  tenantId: string;
  globalAccountId: string;
  displayName: string;
  region: string;
  isActive: boolean;
  createdAt: string;
}
export interface CredentialSet {
  id: string;
  btpAccountId: string;
  credentialType: "CIS" | "UDM" | "AUDIT_LOG";
  isActive: boolean;
  createdAt: string;
}
export interface ClientUser {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "viewer";
  isActive: boolean;
  createdAt: string;
}
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}
```

### `src/lib/axios.ts`

```typescript
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(null, (error) => {
  if (error.response?.status === 401) {
    useAuthStore().clearAuth();
    router.push("/login");
  }
  return Promise.reject(error);
});
```

### `src/router/index.ts`

```typescript
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.token) return "/login";
  if (to.path === "/login" && auth.token) return "/";
});
```

### Composable pattern (`src/composables/useBtpAccounts.ts`)

```typescript
export function useBtpAccounts() {
  const accounts = useQuery({
    queryKey: ["btp-accounts"],
    queryFn: btpAccountsApi.list,
  });
  const createAccount = useMutation({
    mutationFn: btpAccountsApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["btp-accounts"] }),
  });
  return { accounts, createAccount };
}
```

---

## Files to Create

### Bootstrap

#### [NEW] `btp-inspector/btp-admin/` — initialize project

```bash
cd /Users/rodrigo/Delling/Workbench/Syrio/Projects/btp-inspector
npm create vite@latest btp-admin -- --template vue-ts
cd btp-admin
npm install vue-router@4 pinia axios @tanstack/vue-query vee-validate zod @vee-validate/zod lucide-vue-next vue-sonner
npx shadcn-vue@latest init
```

#### [NEW] `btp-admin/.env.local`

```
VITE_API_BASE_URL=http://localhost:3000
```

---

### Core

#### [NEW] `src/lib/axios.ts` — Axios instance with JWT + 401 interceptors

#### [NEW] `src/stores/auth.ts` — Pinia auth store with `localStorage` persistence

#### [NEW] `src/router/index.ts` — Vue Router v4 with `requiresAuth` guard

---

### API Layer

#### [NEW] `src/api/types.ts` — shared TypeScript interfaces

#### [NEW] `src/api/auth.ts` — `login()`, `me()`

#### [NEW] `src/api/tenants.ts` — tenant and user CRUD

#### [NEW] `src/api/btp-accounts.ts` — account and credential set CRUD

---

### Composables

#### [NEW] `src/composables/useTenants.ts` — vue-query wrappers for tenants

#### [NEW] `src/composables/useBtpAccounts.ts` — vue-query wrappers for accounts + credentials

---

### Layout

#### [NEW] `src/components/layout/AppShell.vue` — two-column shell with `<RouterView>`

#### [NEW] `src/components/layout/Sidebar.vue` — nav links, active state via `useRoute()`

---

### Views

#### [NEW] `src/views/LoginView.vue` — VeeValidate + Zod form, 3 fields

#### [NEW] `src/views/DashboardView.vue` — summary cards + `GET /auth/me`

#### [NEW] `src/views/tenants/TenantsView.vue` — tenant list + Create dialog

#### [NEW] `src/views/tenants/TenantDetailView.vue` — tabbed (BTP Accounts | Users)

#### [NEW] `src/views/btp-accounts/BtpAccountsTab.vue` — account list + Create dialog

#### [NEW] `src/views/btp-accounts/CredentialSetsSection.vue` — credentials table, Test/Delete

#### [NEW] `src/views/users/UsersTab.vue` — user list + Create/Edit dialogs

---

## Verification Plan

### Build checks

```bash
npm run build   # zero TS errors, no missing imports
npm run dev     # Vite dev server starts on port 5173
```

### Manual browser checklist

1. **Login** with valid creds → JWT stored, redirect to `/`
2. **401 guard** → clear `localStorage`, navigate to `/` → redirected to `/login`
3. **Create Tenant** → appears in table
4. **Create BTP Account** → appears under correct tenant
5. **Add Credential Set** → appears in credentials table, `clientSecret` not shown anywhere
6. **Test Credential** → success or failure badge shown inline
7. **Delete Credential** → confirmation dialog → removed from table
8. **Create User** → appears in Users tab with correct role
9. **Cross-tenant isolation** → log in as Tenant A, confirm Tenant B's accounts are not visible

---

## Deployment

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

> [!NOTE]
> `nginx.conf` must rewrite all routes to `index.html` for Vue Router history mode.
> `VITE_API_BASE_URL` is injected at **build time**. For runtime config injection, use a small `config.js` served by Nginx and fetched on app startup.
