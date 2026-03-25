import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'

function storageKey(tenantId: string) {
  return `btp-selected-account-${tenantId}`
}

export const useBtpAccountStore = defineStore('btp-account', () => {
  const auth = useAuthStore()
  const selectedAccountId = ref<string | null>(null)

  function loadFromStorage() {
    const tenantId = auth.user?.tenantId
    if (!tenantId) {
      selectedAccountId.value = null
      return
    }
    selectedAccountId.value = localStorage.getItem(storageKey(tenantId))
  }

  function setAccount(id: string | null) {
    const tenantId = auth.user?.tenantId
    selectedAccountId.value = id
    if (!tenantId) return
    if (id) {
      localStorage.setItem(storageKey(tenantId), id)
    } else {
      localStorage.removeItem(storageKey(tenantId))
    }
  }

  // When user changes (login / logout / tenant switch) reload the appropriate account
  watch(() => auth.user, (newUser) => {
    if (newUser) {
      loadFromStorage()
    } else {
      selectedAccountId.value = null
    }
  }, { immediate: true })

  return { selectedAccountId, setAccount }
})
