<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useBtpAccounts } from '@/composables/useBtpAccounts'
import {
  LayoutDashboard,
  Building2,
  LogOut,
  LineChart,
  Network,
  ListTodo,
  KeySquare,
  FileSearch,
} from 'lucide-vue-next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const btpAccountStore = useBtpAccountStore()

// Fetch all BTP accounts
const { accounts } = useBtpAccounts()

// When accounts load, if we have none selected (or selected one doesn't exist anymore), 
// auto-select the first purely as a convenience
watch(() => accounts.data.value, (newAccounts) => {
  if (newAccounts && newAccounts.length > 0) {
    const current = btpAccountStore.selectedAccountId
    const exists = newAccounts?.find((a: any) => a.id === current)
    if (!current || !exists) {
      const firstId = newAccounts[0]?.id
      if (firstId) btpAccountStore.setAccount(firstId)
    }
  }
}, { immediate: true })

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/consumption', label: 'Consumption', icon: LineChart },
  { to: '/accounts', label: 'Accounts', icon: Network },
  { to: '/events', label: 'Events', icon: ListTodo },
  { to: '/entitlements', label: 'Entitlements', icon: KeySquare },
  { to: '/audit', label: 'Audit Logs', icon: FileSearch },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

async function logout() {
  auth.clearAuth()
  await router.push('/login')
}
</script>

<template>
  <aside class="flex h-full w-56 flex-col border-r bg-background">
    <div class="flex h-14 items-center border-b px-4 shrink-0">
      <span class="text-sm font-semibold tracking-tight">BTP Admin</span>
    </div>

    <!-- Account Picker -->
    <div class="border-b px-4 py-3 shrink-0">
      <div v-if="accounts.isLoading.value" class="space-y-2">
        <Skeleton class="h-4 w-20" />
        <Skeleton class="h-9 w-full" />
      </div>
      <div v-else class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Active Account
        </label>
        <Select
          :model-value="btpAccountStore.selectedAccountId ?? undefined"
          @update:model-value="(val) => btpAccountStore.setAccount(val as string)"
        >
          <SelectTrigger class="w-full text-left">
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="acc in accounts.data.value"
              :key="acc.id"
              :value="acc.id"
            >
              <div class="flex flex-col">
                <span>{{ acc.displayName }}</span>
                <span class="text-xs text-muted-foreground">{{ acc.region }}</span>
              </div>
            </SelectItem>
            <div v-if="!accounts.data.value?.length" class="p-2 text-sm text-muted-foreground text-center">
              No accounts available
            </div>
          </SelectContent>
        </Select>
      </div>
    </div>

    <nav class="flex-1 space-y-1 p-3 overflow-y-auto">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
        :class="
          isActive(item.to)
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        "
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="border-t p-3">
      <div v-if="auth.user" class="mb-2 px-3 py-1">
        <p class="truncate text-xs font-medium">{{ auth.user.email }}</p>
        <p class="text-xs text-muted-foreground capitalize">{{ auth.user.role }}</p>
      </div>
      <button
        class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="logout"
      >
        <LogOut class="h-4 w-4 shrink-0" />
        Sign out
      </button>
    </div>
  </aside>
</template>
