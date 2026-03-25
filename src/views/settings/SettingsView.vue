<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import BtpAccountsTab from '@/views/btp-accounts/BtpAccountsTab.vue'

const auth = useAuthStore()
</script>

<template>
  <div class="page-root">
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Settings</h2>
        <p class="text-xs text-muted-foreground">Manage BTP accounts and credentials for your tenant</p>
      </div>
    </div>

    <div class="page-content">
      <BtpAccountsTab v-if="auth.user" :tenant-id="auth.user.tenantId" />
    </div>
  </div>
</template>
