import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/api/types'

// We test the interceptor behaviour by inspecting how the store and
// localStorage interact, rather than by firing real HTTP requests.
// Full interceptor integration is covered in integration tests.

const mockUser: AuthUser = {
  id: 'u1',
  email: 'admin@test.com',
  role: 'admin',
  tenantId: 't1',
}

describe('axios request interceptor (via auth store)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('token is null before authentication', () => {
    const store = useAuthStore()
    expect(store.token).toBeNull()
  })

  it('token is available after setAuth — interceptor would attach it', () => {
    const store = useAuthStore()
    store.setAuth('bearer-xyz', mockUser)
    // The request interceptor reads store.token; verify the value is correct
    expect(store.token).toBe('bearer-xyz')
  })

  it('token is removed after clearAuth — interceptor would not attach it', () => {
    const store = useAuthStore()
    store.setAuth('bearer-xyz', mockUser)
    store.clearAuth()
    expect(store.token).toBeNull()
  })
})

describe('axios 401 response interceptor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('clearAuth wipes state as the 401 interceptor would', () => {
    const store = useAuthStore()
    store.setAuth('expired-token', mockUser)

    // Simulate what the 401 interceptor does
    store.clearAuth()

    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})

describe('api/auth shapes', () => {
  it('LoginResponse type has access_token and user fields', () => {
    // Compile-time check via assignment — if types are wrong this file won't build
    const response: import('@/api/auth').LoginResponse = {
      accessToken: 'tok',
      user: mockUser,
    }
    expect(response.accessToken).toBe('tok')
    expect(response.user.email).toBe('admin@test.com')
  })
})
