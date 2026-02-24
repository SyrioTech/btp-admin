import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { useTenants, useTenant, useTenantUsers } from '@/composables/useTenants'
import type { Tenant, ClientUser } from '@/api/types'

// Mock the API layer — composables should not make real HTTP calls
vi.mock('@/api/tenants', () => ({
  tenantsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

import { tenantsApi } from '@/api/tenants'

const fakeTenants: Tenant[] = [
  { id: 't1', name: 'Acme', slug: 'acme', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 't2', name: 'Beta', slug: 'beta', isActive: false, createdAt: '2024-02-01T00:00:00Z' },
]

const fakeTenant: Tenant = fakeTenants[0]

const fakeUsers: ClientUser[] = [
  {
    id: 'u1',
    tenantId: 't1',
    email: 'alice@acme.com',
    role: 'admin',
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

describe('useTenants', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches tenant list on mount', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    const { tenants } = wrapComposable(useTenants)
    await flushPromises()

    expect(tenantsApi.list).toHaveBeenCalledOnce()
    expect(tenants.data.value).toEqual(fakeTenants)
  })

  it('exposes createTenant mutation', () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([])
    const { createTenant } = wrapComposable(useTenants)
    expect(typeof createTenant.mutateAsync).toBe('function')
  })

  it('exposes updateTenant mutation', () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([])
    const { updateTenant } = wrapComposable(useTenants)
    expect(typeof updateTenant.mutateAsync).toBe('function')
  })
})

describe('useTenant', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches a single tenant by id', async () => {
    vi.mocked(tenantsApi.get).mockResolvedValue(fakeTenant)
    const result = wrapComposable(() => useTenant('t1'))
    await flushPromises()

    expect(tenantsApi.get).toHaveBeenCalledWith('t1')
    expect(result.data.value).toEqual(fakeTenant)
  })
})

describe('useTenantUsers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches users for a given tenant', async () => {
    vi.mocked(tenantsApi.listUsers).mockResolvedValue(fakeUsers)
    const { users } = wrapComposable(() => useTenantUsers('t1'))
    await flushPromises()

    expect(tenantsApi.listUsers).toHaveBeenCalledWith('t1')
    expect(users.data.value).toEqual(fakeUsers)
  })

  it('exposes createUser and updateUser mutations', () => {
    vi.mocked(tenantsApi.listUsers).mockResolvedValue([])
    const { createUser, updateUser } = wrapComposable(() => useTenantUsers('t1'))
    expect(typeof createUser.mutateAsync).toBe('function')
    expect(typeof updateUser.mutateAsync).toBe('function')
  })
})
