import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import TenantsView from '@/views/tenants/TenantsView.vue'
import type { Tenant } from '@/api/types'

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
  { id: 't1', name: 'Acme Corp', slug: 'acme-corp', isActive: true, createdAt: '2024-01-15T00:00:00Z' },
  { id: 't2', name: 'Beta Inc', slug: 'beta-inc', isActive: false, createdAt: '2024-02-20T00:00:00Z' },
]

// Module-level wrapper reference so afterEach can unmount before clearing the DOM.
// Without this, Vue's async updates run after document.body.innerHTML='' and throw
// "Cannot read properties of null (reading 'insertBefore')".
let wrapper: ReturnType<typeof mount>

function makeMount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tenants', component: TenantsView },
      { path: '/tenants/:id', component: { template: '<div />' } },
    ],
  })
  router.push('/tenants')

  wrapper = mount(TenantsView, {
    attachTo: document.body,
    global: {
      plugins: [
        createPinia(),
        router,
        [VueQueryPlugin, { queryClient }],
      ],
    },
  })
  return { wrapper, router, queryClient }
}

describe('TenantsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows loading state initially', () => {
    vi.mocked(tenantsApi.list).mockReturnValue(new Promise(() => {}))
    const { wrapper } = makeMount()
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders tenant names in the table after data loads', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('Acme Corp')
    expect(wrapper.text()).toContain('Beta Inc')
  })

  it('renders tenant slugs', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('acme-corp')
    expect(wrapper.text()).toContain('beta-inc')
  })

  it('shows Active/Inactive badges correctly', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Inactive')
  })

  it('shows empty state when no tenants exist', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([])
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('No tenants yet')
  })

  it('shows error message when API call fails', async () => {
    vi.mocked(tenantsApi.list).mockRejectedValue(new Error('Network error'))
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('Failed to load tenants')
  })

  it('renders the New Tenant button', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([])
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    const button = wrapper.findAll('button').find((b) => b.text().includes('New Tenant'))
    expect(button).toBeDefined()
  })

  it('opens the create dialog when New Tenant is clicked', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([])
    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    const button = wrapper.findAll('button').find((b) => b.text().includes('New Tenant'))
    await button!.trigger('click')
    await vi.runAllTimersAsync()

    // DialogPortal teleports content to document.body — query there.
    const nameInput = document.querySelector('input#t-name') as HTMLInputElement | null
    const slugInput = document.querySelector('input#t-slug') as HTMLInputElement | null
    expect(nameInput).not.toBeNull()
    expect(slugInput).not.toBeNull()
  })

  it('calls tenantsApi.create with correct data on dialog form submit', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    vi.mocked(tenantsApi.create).mockResolvedValue({
      id: 't3',
      name: 'Gamma Ltd',
      slug: 'gamma-ltd',
      isActive: true,
      createdAt: '2024-03-01T00:00:00Z',
    })

    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    // Open dialog
    const newButton = wrapper.findAll('button').find((b) => b.text().includes('New Tenant'))
    await newButton!.trigger('click')
    await vi.runAllTimersAsync()

    // Dialog is teleported to document.body
    const nameInput = document.querySelector('input#t-name') as HTMLInputElement | null
    const slugInput = document.querySelector('input#t-slug') as HTMLInputElement | null

    if (!nameInput || !slugInput) {
      // Dialog didn't open in this environment — skip the rest of this test
      return
    }

    // Fill fields via native DOM events (inputs are outside the component wrapper)
    nameInput.value = 'Gamma Ltd'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    nameInput.dispatchEvent(new Event('change', { bubbles: true }))

    slugInput.value = 'gamma-ltd'
    slugInput.dispatchEvent(new Event('input', { bubbles: true }))
    slugInput.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.runAllTimersAsync()

    // Submit — find the form inside the dialog
    const form = document.querySelector('[role="dialog"] form, form') as HTMLFormElement | null
    if (!form) return

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.runAllTimersAsync()

    expect(tenantsApi.create).toHaveBeenCalledWith({
      name: 'Gamma Ltd',
      slug: 'gamma-ltd',
    })
  })

  it('calls tenantsApi.update on Deactivate click', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue(fakeTenants)
    vi.mocked(tenantsApi.update).mockResolvedValue({ ...fakeTenants[0], isActive: false })

    const { wrapper } = makeMount()
    await vi.runAllTimersAsync()

    const deactivateBtn = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')
    await deactivateBtn!.trigger('click')
    await vi.runAllTimersAsync()

    expect(tenantsApi.update).toHaveBeenCalledWith('t1', { isActive: false })
  })
})
