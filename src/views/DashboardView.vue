<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { authApi } from '@/api/auth'
import { tenantsApi } from '@/api/tenants'
import { btpAccountsApi } from '@/api/btp-accounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Server, User } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const auth = useAuthStore()

const { data: me } = useQuery({
  queryKey: ['me'],
  queryFn: authApi.me,
})

const { data: tenants } = useQuery({
  queryKey: ['tenants'],
  queryFn: tenantsApi.list,
})

const { data: accounts } = useQuery({
  queryKey: ['btp-accounts'],
  queryFn: () => btpAccountsApi.list(),
})

const activeTenants = computed(() =>
  (tenants.value ?? []).filter((t) => t.isActive).length,
)
const totalAccounts = computed(() => accounts.value?.length ?? 0)
const activeAccounts = computed(() =>
  (accounts.value ?? []).filter((a) => a.isActive).length,
)
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p class="text-sm text-muted-foreground">
        Welcome back<template v-if="me">, {{ me.email }}</template>.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Active Tenants</CardTitle>
          <Building2 class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ activeTenants }}</div>
          <p class="text-xs text-muted-foreground">of {{ tenants?.length ?? 0 }} total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">BTP Accounts</CardTitle>
          <Server class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ activeAccounts }}</div>
          <p class="text-xs text-muted-foreground">of {{ totalAccounts }} total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Signed In As</CardTitle>
          <User class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="truncate text-sm font-bold">{{ me?.email ?? auth.user?.email ?? '—' }}</div>
          <p class="text-xs capitalize text-muted-foreground">{{ me?.role ?? '—' }}</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
