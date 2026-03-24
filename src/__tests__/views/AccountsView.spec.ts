import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import AccountsView from '@/views/accounts/AccountsView.vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import type { GlobalAccount, Directory, Subaccount } from '@/api/types'

// ── Mock the API layer ───────────────────────────────────────────────────────

vi.mock('@/api/accounts-btp', () => ({
  accountsBtpApi: {
    getGlobalAccount: vi.fn(),
    listSubaccounts: vi.fn(),
    listDirectories: vi.fn(),
    getSubaccount: vi.fn(),
    getDirectory: vi.fn(),
  },
}))

vi.mock('@/api/entitlements-btp', () => ({
  entitlementsBtpApi: {
    getGlobalAssignments: vi.fn(),
    getSubaccountAssignments: vi.fn(),
  },
}))

import { accountsBtpApi } from '@/api/accounts-btp'
import { entitlementsBtpApi } from '@/api/entitlements-btp'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fakeGlobalAccount: GlobalAccount = {
  guid: 'ga-001',
  displayName: 'Acme Global Account',
  state: 'OK',
  contractStatus: 'ACTIVE',
  commercialModel: 'BTPEA',
  region: 'eu10',
}

// Directories only — SAP expand=true response embeds only dirs in children[]
const dirA: Directory = {
  guid: 'dir-a',
  displayName: 'Directory Alpha',
  state: 'OK',
  parentGUID: 'ga-001',
}

const dirB: Directory = {
  guid: 'dir-b',
  displayName: 'Directory Beta',
  state: 'OK',
  parentGUID: 'dir-a',   // nested under dirA
}

// Subaccounts come from listSubaccounts, not from expand children[]
const subInDirA: Subaccount = {
  guid: 'sa-alpha',
  displayName: 'Alpha Subaccount',
  region: 'eu10',
  subdomain: 'alpha-sub',
  state: 'OK',
  parentGUID: 'dir-a',
  createdDate: 1700000000000,
  modifiedDate: 1700086400000,
  createdBy: 'admin@acme.com',
  labels: { env: ['prod'], team: ['platform'] },
}

const subInDirB: Subaccount = {
  guid: 'sa-beta',
  displayName: 'Beta Subaccount',
  region: 'us10',
  subdomain: 'beta-sub',
  state: 'OK',
  parentGUID: 'dir-b',
  usedForProduction: 'NOT_USED_FOR_PRODUCTION',
  betaEnabled: true,
}

const rootSub: Subaccount = {
  guid: 'sa-root',
  displayName: 'Root Subaccount',
  region: 'ap10',
  subdomain: 'root-sub',
  state: 'CREATING',
  parentGUID: 'ga-001',   // directly under global account
  description: 'A root-level subaccount.',
}

// Helper: compose an expanded GlobalAccount response (dirs only in children[]).
function ga(dirs: Directory[] = []): GlobalAccount {
  return { ...fakeGlobalAccount, children: dirs }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

let wrapper: ReturnType<typeof mount>

function makeMount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/accounts', component: AccountsView }],
  })
  router.push('/accounts')

  wrapper = mount(AccountsView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router, [VueQueryPlugin, { queryClient }]],
    },
  })

  // Pre-set a selected BTP account so queries are enabled
  const store = useBtpAccountStore()
  store.setAccount('btp-acc-1')

  return { wrapper, store, queryClient }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AccountsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Defaults
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([])
    vi.mocked(entitlementsBtpApi.getSubaccountAssignments).mockResolvedValue({ assignedServices: [], entitledServices: [] })
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // ── No account selected ────────────────────────────────────────────────────

  it('shows "No Account Selected" when no BTP account is active', () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockReturnValue(new Promise(() => {}))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/accounts', component: AccountsView }],
    })
    router.push('/accounts')

    wrapper = mount(AccountsView, {
      attachTo: document.body,
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })
    // Do NOT call store.setAccount → selectedAccountId stays null

    expect(wrapper.text()).toContain('No Account Selected')
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows loading skeletons while the query is in flight', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockReturnValue(new Promise(() => {}))

    // Pre-seed localStorage so the store initialises with the account already set
    localStorage.setItem('btp-admin-selected-account', 'btp-acc-1')
    makeMount()
    await flushPromises()

    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ── Successful data render ─────────────────────────────────────────────────

  it('renders the global account display name', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Acme Global Account')
  })

  it('shows the global account GUID', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga())

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('ga-001')
  })

  it('shows the contract status badge', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga())

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('ACTIVE')
  })

  it('displays summary counters for directories and subaccounts', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA, dirB]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA, rootSub])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('2')           // 2 directories
    expect(wrapper.text()).toContain('directories')
    expect(wrapper.text()).toContain('subaccounts')
  })

  // ── Tree hierarchy ─────────────────────────────────────────────────────────

  it('renders directory names in the tree', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Directory Alpha')
  })

  it('renders subaccount names in the tree', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Alpha Subaccount')
  })

  it('renders a root-level subaccount (parentGUID = global account GUID)', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga())
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([rootSub])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Root Subaccount')
  })

  it('properly nests a directory inside its parent directory', async () => {
    // dirB.parentGUID = 'dir-a' → should be nested under dirA
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA, dirB]))

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Directory Alpha')
    expect(wrapper.text()).toContain('Directory Beta')
  })

  it('places a nested subaccount under the correct directory', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA, dirB]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirB])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('Beta Subaccount')
  })

  it('shows "No directories or subaccounts found" for an empty global account', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga())

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(wrapper.text()).toContain('No directories or subaccounts found')
  })

  // ── Subaccount detail dialog ───────────────────────────────────────────────

  it('opens detail dialog when a subaccount is clicked', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    expect(subBtn).toBeDefined()
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
  })

  it('dialog shows subaccount display name as title', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Alpha Subaccount')
  })

  it('dialog shows the subaccount GUID', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('sa-alpha')
  })

  it('dialog shows the subaccount region', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('eu10')
  })

  it('dialog shows the createdBy field', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('admin@acme.com')
  })

  it('dialog shows the formatted created date', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    // epoch 1700000000000 → 2023
    expect(dialog?.textContent).toContain('2023')
  })

  it('dialog renders labels as key:value badges', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('env: prod')
    expect(dialog?.textContent).toContain('team: platform')
  })

  it('dialog shows an enabled "View Entitlements" button', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirA])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Alpha Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const entBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('View Entitlements'),
    ) as HTMLButtonElement | undefined
    expect(entBtn).toBeDefined()
    expect(entBtn?.disabled).toBe(false)
  })

  it('dialog shows description when present', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga())
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([rootSub])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Root Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('A root-level subaccount.')
  })

  it('dialog shows beta enabled for a subaccount with betaEnabled=true', async () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockResolvedValue(ga([dirA, dirB]))
    vi.mocked(accountsBtpApi.listSubaccounts).mockResolvedValue([subInDirB])

    makeMount()
    await vi.runAllTimersAsync()
    await flushPromises()

    const subBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Beta Subaccount'),
    )
    subBtn!.click()
    await vi.runAllTimersAsync()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Yes')  // betaEnabled = true
  })

  // ── Page header ────────────────────────────────────────────────────────────

  it('renders the page heading "Accounts Structure"', () => {
    vi.mocked(accountsBtpApi.getGlobalAccount).mockReturnValue(new Promise(() => {}))

    makeMount()
    expect(wrapper.text()).toContain('Accounts Structure')
  })
})
