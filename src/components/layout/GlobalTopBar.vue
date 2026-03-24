<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Bell, User, LogOut, ChevronDown, Settings } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const auth = useAuthStore()
const router = useRouter()

// Live clock — ticks every second
const now = ref(new Date())
let timer: ReturnType<typeof setInterval>
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))

const dateStr = computed(() =>
  now.value.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
)
const timeStr = computed(() =>
  now.value.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
)

async function logout() {
  auth.clearAuth()
  await router.push('/login')
}
</script>

<template>
  <header class="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-6">

    <!-- Left: live date and time -->
    <div class="flex items-center gap-2 text-xs">
      <span class="font-medium text-foreground">{{ dateStr }}</span>
      <span class="text-muted-foreground select-none">·</span>
      <span class="font-mono tabular-nums text-muted-foreground">{{ timeStr }}</span>
    </div>

    <!-- Right: alerts + profile -->
    <div class="flex items-center gap-1">

      <!-- Notification bell (placeholder — no active alerts) -->
      <button
        class="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Notifications"
      >
        <Bell class="h-4 w-4" />
      </button>

      <!-- Profile dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            class="flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors hover:bg-muted"
            aria-label="Account menu"
          >
            <!-- Avatar circle -->
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
              <User class="h-3.5 w-3.5" />
            </span>
            <span class="hidden sm:block max-w-[160px] truncate font-medium text-foreground">
              {{ auth.user?.email }}
            </span>
            <ChevronDown class="h-3 w-3 text-muted-foreground opacity-70" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuLabel class="font-normal py-2">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold shrink-0">
                {{ auth.user?.email?.charAt(0).toUpperCase() }}
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium leading-tight truncate">{{ auth.user?.email }}</p>
                <p class="text-xs capitalize text-muted-foreground leading-tight mt-0.5">
                  {{ auth.user?.role }}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem class="cursor-pointer" @click="router.push('/tenants')">
            <Settings class="mr-2 h-4 w-4 text-muted-foreground" />
            Administration
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            class="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            @click="logout"
          >
            <LogOut class="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

  </header>
</template>
