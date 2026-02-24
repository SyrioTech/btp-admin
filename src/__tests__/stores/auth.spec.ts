import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/api/types'

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'admin',
  tenantId: 'tenant-1',
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes with null token when localStorage is empty', () => {
    const store = useAuthStore()
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('initializes token from localStorage when present', () => {
    localStorage.setItem('auth_token', 'existing-token')
    const store = useAuthStore()
    expect(store.token).toBe('existing-token')
    expect(store.isAuthenticated).toBe(true)
  })

  it('setAuth stores token, user, and persists to localStorage', () => {
    const store = useAuthStore()
    store.setAuth('new-token', mockUser)

    expect(store.token).toBe('new-token')
    expect(store.user).toEqual(mockUser)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe('new-token')
  })

  it('clearAuth removes token, user, and clears localStorage', () => {
    const store = useAuthStore()
    store.setAuth('some-token', mockUser)
    store.clearAuth()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('isAuthenticated is reactive — updates when token changes', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    store.setAuth('tok', mockUser)
    expect(store.isAuthenticated).toBe(true)
    store.clearAuth()
    expect(store.isAuthenticated).toBe(false)
  })

  it('setAuth overwrites an existing session', () => {
    const store = useAuthStore()
    const userA: AuthUser = { ...mockUser, email: 'a@example.com' }
    const userB: AuthUser = { ...mockUser, email: 'b@example.com' }

    store.setAuth('token-a', userA)
    store.setAuth('token-b', userB)

    expect(store.token).toBe('token-b')
    expect(store.user?.email).toBe('b@example.com')
    expect(localStorage.getItem('auth_token')).toBe('token-b')
  })
})
