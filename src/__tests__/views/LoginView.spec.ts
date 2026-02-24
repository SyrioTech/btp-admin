import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
  },
}))

import { authApi } from '@/api/auth'

// VeeValidate uses setTimeout internally — we must flush it with runAllTimersAsync.
// Setting the native input value + dispatching events propagates through the
// useVModel chain in shadcn's Input component to VeeValidate's reactive refs.
async function fillInput(wrapper: ReturnType<typeof mount>, id: string, value: string) {
  const el = wrapper.find(`input#${id}`)
  ;(el.element as HTMLInputElement).value = value
  await el.trigger('input')
  await el.trigger('change')
  await vi.runAllTimersAsync()
}

let wrapper: ReturnType<typeof mount>

function mountLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/', component: { template: '<div>Home</div>' } },
    ],
  })
  router.push('/login')
  wrapper = mount(LoginView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders the three required form fields', () => {
    const { wrapper } = mountLogin()
    expect(wrapper.find('input#tenantSlug').exists()).toBe(true)
    expect(wrapper.find('input#email').exists()).toBe(true)
    expect(wrapper.find('input#password').exists()).toBe(true)
  })

  it('renders the submit button with correct label', () => {
    const { wrapper } = mountLogin()
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Sign in')
  })

  it('shows validation errors when form is submitted empty', async () => {
    const { wrapper } = mountLogin()

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    // VeeValidate sets errors on required fields → p.text-destructive elements appear
    const errors = wrapper.findAll('p.text-destructive')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('shows email format validation error for an invalid email', async () => {
    const { wrapper } = mountLogin()

    await fillInput(wrapper, 'tenantSlug', 'acme')
    await fillInput(wrapper, 'email', 'not-an-email')
    await fillInput(wrapper, 'password', 'secret123')

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('Invalid email address')
  })

  it('calls authApi.login with correct payload on valid submit', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'test-token',
      user: { id: 'u1', email: 'admin@acme.com', role: 'admin', tenantId: 't1' },
    })

    const { wrapper } = mountLogin()

    await fillInput(wrapper, 'tenantSlug', 'acme-corp')
    await fillInput(wrapper, 'email', 'admin@acme.com')
    await fillInput(wrapper, 'password', 'password123')

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    expect(authApi.login).toHaveBeenCalledWith({
      tenantSlug: 'acme-corp',
      email: 'admin@acme.com',
      password: 'password123',
    })
  })

  it('stores auth token in Pinia after successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'jwt-token',
      user: { id: 'u1', email: 'admin@acme.com', role: 'admin', tenantId: 't1' },
    })

    const { wrapper } = mountLogin()

    await fillInput(wrapper, 'tenantSlug', 'acme')
    await fillInput(wrapper, 'email', 'admin@acme.com')
    await fillInput(wrapper, 'password', 'secret')

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    const store = useAuthStore()
    expect(store.token).toBe('jwt-token')
    expect(store.user?.email).toBe('admin@acme.com')
  })

  it('shows an inline error on 401 response', async () => {
    vi.mocked(authApi.login).mockRejectedValue({ response: { status: 401 } })

    const { wrapper } = mountLogin()

    await fillInput(wrapper, 'tenantSlug', 'acme')
    await fillInput(wrapper, 'email', 'admin@acme.com')
    await fillInput(wrapper, 'password', 'wrong-password')

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    expect(wrapper.text()).toContain('Invalid credentials')
  })

  it('disables the submit button while the request is in flight', async () => {
    // A promise that never resolves keeps loading=true
    vi.mocked(authApi.login).mockReturnValue(new Promise(() => {}))

    const { wrapper } = mountLogin()

    await fillInput(wrapper, 'tenantSlug', 'acme')
    await fillInput(wrapper, 'email', 'admin@acme.com')
    await fillInput(wrapper, 'password', 'secret')

    await wrapper.find('form').trigger('submit')
    await vi.runAllTimersAsync()

    const btn = wrapper.find('button[type="submit"]')
    const isDisabled =
      btn.attributes('disabled') !== undefined ||
      (btn.element as HTMLButtonElement).disabled === true
    expect(isDisabled).toBe(true)
  })
})
