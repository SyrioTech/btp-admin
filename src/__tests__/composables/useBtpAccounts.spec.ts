import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { useBtpAccounts, useCredentialSets } from '@/composables/useBtpAccounts'
import type { BtpAccount, CredentialSet } from '@/api/types'

vi.mock('@/api/btp-accounts', () => ({
  btpAccountsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listCredentials: vi.fn(),
    createCredential: vi.fn(),
    testCredential: vi.fn(),
    deleteCredential: vi.fn(),
  },
}))

import { btpAccountsApi } from '@/api/btp-accounts'

const fakeAccounts: BtpAccount[] = [
  {
    id: 'a1',
    tenantId: 't1',
    globalAccountId: 'ga-uuid',
    displayName: 'Prod GA',
    region: 'eu10',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
]

const fakeCredentials: CredentialSet[] = [
  {
    id: 'c1',
    btpAccountId: 'a1',
    credentialType: 'CIS',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
]

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapComposable<T>(composableFn: () => T) {
  const queryClient = makeQueryClient()
  let result!: T
  const Wrapper = defineComponent({
    setup() {
      result = composableFn()
      return () => h('div')
    },
  })
  mount(Wrapper, {
    global: { plugins: [[VueQueryPlugin, { queryClient }], createPinia()] },
  })
  return result
}

describe('useBtpAccounts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches accounts without a tenantId filter', async () => {
    vi.mocked(btpAccountsApi.list).mockResolvedValue(fakeAccounts)
    const { accounts } = wrapComposable(() => useBtpAccounts())
    await flushPromises()

    expect(btpAccountsApi.list).toHaveBeenCalledWith(undefined)
    expect(accounts.data.value).toEqual(fakeAccounts)
  })

  it('fetches accounts filtered by tenantId when provided', async () => {
    vi.mocked(btpAccountsApi.list).mockResolvedValue(fakeAccounts)
    const { accounts } = wrapComposable(() => useBtpAccounts('t1'))
    await flushPromises()

    expect(btpAccountsApi.list).toHaveBeenCalledWith('t1')
    expect(accounts.data.value).toEqual(fakeAccounts)
  })

  it('exposes createAccount and updateAccount mutations', () => {
    vi.mocked(btpAccountsApi.list).mockResolvedValue([])
    const { createAccount, updateAccount } = wrapComposable(() => useBtpAccounts())
    expect(typeof createAccount.mutateAsync).toBe('function')
    expect(typeof updateAccount.mutateAsync).toBe('function')
  })
})

describe('useCredentialSets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches credential sets for an account', async () => {
    vi.mocked(btpAccountsApi.listCredentials).mockResolvedValue(fakeCredentials)
    const { credentials } = wrapComposable(() => useCredentialSets('a1'))
    await flushPromises()

    expect(btpAccountsApi.listCredentials).toHaveBeenCalledWith('a1')
    expect(credentials.data.value).toEqual(fakeCredentials)
  })

  it('exposes all four credential mutations', () => {
    vi.mocked(btpAccountsApi.listCredentials).mockResolvedValue([])
    const { createCredential, testCredential, deleteCredential } =
      wrapComposable(() => useCredentialSets('a1'))
    expect(typeof createCredential.mutateAsync).toBe('function')
    expect(typeof testCredential.mutateAsync).toBe('function')
    expect(typeof deleteCredential.mutateAsync).toBe('function')
  })

  it('testCredential calls the API with correct ids', async () => {
    vi.mocked(btpAccountsApi.listCredentials).mockResolvedValue(fakeCredentials)
    vi.mocked(btpAccountsApi.testCredential).mockResolvedValue({ success: true })

    const { testCredential } = wrapComposable(() => useCredentialSets('a1'))
    await flushPromises()

    await testCredential.mutateAsync('c1')
    expect(btpAccountsApi.testCredential).toHaveBeenCalledWith('a1', 'c1')
  })

  it('deleteCredential calls the API with correct ids', async () => {
    vi.mocked(btpAccountsApi.listCredentials).mockResolvedValue(fakeCredentials)
    vi.mocked(btpAccountsApi.deleteCredential).mockResolvedValue(undefined)

    const { deleteCredential } = wrapComposable(() => useCredentialSets('a1'))
    await flushPromises()

    await deleteCredential.mutateAsync('c1')
    expect(btpAccountsApi.deleteCredential).toHaveBeenCalledWith('a1', 'c1')
  })
})
