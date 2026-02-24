<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { LayoutDashboard, Building2, LogOut } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
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
    <div class="flex h-14 items-center border-b px-4">
      <span class="text-sm font-semibold tracking-tight">BTP Admin</span>
    </div>

    <nav class="flex-1 space-y-1 p-3">
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
