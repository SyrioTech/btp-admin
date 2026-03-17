import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useBtpAccountStore = defineStore('btp-account', () => {
  // Read initial from localStorage
  const savedAccountId = localStorage.getItem('btp-admin-selected-account')
  const selectedAccountId = ref<string | null>(savedAccountId)

  function setAccount(id: string | null) {
    selectedAccountId.value = id
    if (id) {
      localStorage.setItem('btp-admin-selected-account', id)
    } else {
      localStorage.removeItem('btp-admin-selected-account')
    }
  }

  return { selectedAccountId, setAccount }
})
