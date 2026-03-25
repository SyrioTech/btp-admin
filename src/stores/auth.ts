import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '@/api/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<AuthUser | null>(
    JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
  )

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(newToken: string, newUser: AuthUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isAuthenticated, setAuth, clearAuth }
})
