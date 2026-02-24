import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/api/types'

const mockUser: AuthUser = {
  id: 'u1',
  email: 'admin@test.com',
  role: 'admin',
  tenantId: 't1',
}

function makeRouter(initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tenants', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
  router.push(initialPath)
  return router
}

describe('Sidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the application title', () => {
    const wrapper = mount(Sidebar, {
      global: { plugins: [makeRouter()] },
    })
    expect(wrapper.text()).toContain('BTP Admin')
  })

  it('renders Dashboard and Tenants navigation links', () => {
    const wrapper = mount(Sidebar, {
      global: { plugins: [makeRouter()] },
    })
    const links = wrapper.findAll('a')
    const hrefs = links.map((l) => l.attributes('href'))
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/tenants')
  })

  it('shows user email and role when authenticated', () => {
    const store = useAuthStore()
    store.setAuth('tok', mockUser)

    const wrapper = mount(Sidebar, {
      global: { plugins: [makeRouter()] },
    })

    expect(wrapper.text()).toContain('admin@test.com')
    expect(wrapper.text()).toContain('admin')
  })

  it('does not show user email section when not authenticated', () => {
    const wrapper = mount(Sidebar, {
      global: { plugins: [makeRouter()] },
    })
    expect(wrapper.text()).not.toContain('@')
  })

  it('calls clearAuth and navigates to /login on sign out', async () => {
    const store = useAuthStore()
    store.setAuth('tok', mockUser)

    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(Sidebar, {
      global: { plugins: [router] },
    })

    const signOutButton = wrapper.findAll('button').find((b) =>
      b.text().includes('Sign out'),
    )
    expect(signOutButton).toBeDefined()

    await signOutButton!.trigger('click')

    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(pushSpy).toHaveBeenCalledWith('/login')
  })

  it('applies active class to the link that matches current route', async () => {
    const router = makeRouter('/tenants')
    await router.isReady()

    const wrapper = mount(Sidebar, {
      global: { plugins: [router] },
    })

    const tenantsLink = wrapper.findAll('a').find((a) => a.attributes('href') === '/tenants')
    expect(tenantsLink?.classes()).toContain('bg-accent')
  })
})
