<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useBtpAccounts } from '@/composables/useBtpAccounts'
import {
  LayoutDashboard, Building2, LogOut, LineChart, Network,
  ListTodo, KeySquare, FileSearch, Server,
} from 'lucide-vue-next'
import syrioIcon from '@/assets/syrio-icon.png'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const btpAccountStore = useBtpAccountStore()

const { accounts } = useBtpAccounts()

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
  { to: '/environments', label: 'Environments', icon: Server },
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
  <aside class="flex h-full w-60 shrink-0 flex-col bg-sidebar">
    <!-- Brand header -->
    <div class="flex h-14 items-center gap-3 px-4 shrink-0 border-b border-sidebar-border">
      <img :src="syrioIcon" class="h-8 w-8 shrink-0 rounded-full object-contain" alt="Syrio" />
      <div class="min-w-0">
        <p class="text-sm font-semibold text-sidebar-accent-foreground leading-tight truncate">Syrio</p>
        <p class="text-[10px] text-sidebar-muted leading-tight">BTP Inspector</p>
      </div>
    </div>

    <!-- Account picker -->
    <div class="border-b border-sidebar-border px-4 py-3 shrink-0">
      <div v-if="accounts.isLoading.value" class="space-y-1.5">
        <Skeleton class="h-3 w-24 bg-sidebar-accent" />
        <Skeleton class="h-8 w-full bg-sidebar-accent" />
      </div>
      <div v-else class="flex flex-col gap-1.5">
        <label class="text-[10px] font-semibold text-sidebar-muted uppercase tracking-widest">
          Active Account
        </label>
        <Select
          :model-value="btpAccountStore.selectedAccountId ?? undefined"
          @update:model-value="(val) => btpAccountStore.setAccount(val as string)"
        >
          <SelectTrigger class="w-full h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground focus:ring-sidebar-primary">
            <SelectValue placeholder="Select account…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="acc in accounts.data.value"
              :key="acc.id"
              :value="acc.id"
            >
              <div class="flex flex-col">
                <span class="text-xs">{{ acc.displayName }}</span>
                <span class="text-[10px] text-muted-foreground">{{ acc.region }}</span>
              </div>
            </SelectItem>
            <div v-if="!accounts.data.value?.length" class="p-2 text-xs text-muted-foreground text-center">
              No accounts available
            </div>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-2.5 rounded-md py-2 pl-2.5 pr-3 text-sm transition-all duration-150 border-l-2"
        :class="isActive(item.to)
          ? 'bg-sidebar-accent border-sidebar-primary text-sidebar-primary font-semibold'
          : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'"
      >
        <component
          :is="item.icon"
          class="h-4 w-4 shrink-0 transition-colors"
          :class="isActive(item.to) ? 'text-sidebar-primary' : 'text-sidebar-muted'"
        />
        {{ item.label }}
      </RouterLink>
    </nav>

    <!-- User / logout -->
    <div class="border-t border-sidebar-border p-3 space-y-1 shrink-0">
      <div v-if="auth.user" class="px-2.5 py-1.5 rounded-md">
        <p class="truncate text-xs font-medium text-sidebar-accent-foreground">{{ auth.user.email }}</p>
        <p class="text-[10px] text-sidebar-muted capitalize">{{ auth.user.role }}</p>
      </div>
      <button
        class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-destructive/20 hover:text-red-400 border-l-2 border-transparent"
        @click="logout"
      >
        <LogOut class="h-4 w-4 shrink-0 text-sidebar-muted" />
        Sign out
      </button>
    </div>
  </aside>
</template>
