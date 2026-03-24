<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { tenantsApi } from '@/api/tenants'
import { btpAccountsApi } from '@/api/btp-accounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Server, User, DollarSign, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useMonthlyUsage } from '@/composables/useConsumption'
import { useEvents } from '@/composables/useEvents'

const auth = useAuthStore()
const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

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

// ── This Month's Spend ─────────────────────────────────────────────────────
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)

const { data: monthlyUsage, isLoading: spendLoading } = useMonthlyUsage(accountId, currentYear, currentMonth)

const monthlySpend = computed(() => {
  const rows = monthlyUsage.value?.content ?? []
  // MonthlyUsageItems don't have cost; this endpoint may not have cost data.
  // Sum usage as a proxy, or show 0 if no cost field.
  return rows.length
})

// ── Recent Events ──────────────────────────────────────────────────────────
const eventsFilter = ref<any>({ maxNumberOfEvents: 8 })
const { data: eventsResponse, isLoading: eventsLoading } = useEvents(accountId, eventsFilter)
const recentEvents = computed(() => eventsResponse.value?.events?.slice(0, 8) ?? [])

function getEventIcon(eventType: string) {
  if (eventType?.includes('Create') || eventType?.includes('Add')) return CheckCircle2
  if (eventType?.includes('Delete') || eventType?.includes('Remove')) return XCircle
  return Info
}

function getEventColor(eventType: string): string {
  if (eventType?.includes('error') || eventType?.includes('Delete') || eventType?.includes('Remove'))
    return 'text-destructive bg-destructive/10 border-destructive/20'
  if (eventType?.includes('Create') || eventType?.includes('Add') || eventType?.includes('Success'))
    return 'text-green-500 bg-green-500/10 border-green-500/20'
  return 'text-muted-foreground bg-muted border-muted-foreground/20'
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Credential Health ──────────────────────────────────────────────────────
// Fetch all credentials for all accounts in one aggregate query
interface CredRow {
  accountName: string
  credentialType: string
  isActive: boolean
  createdAt: string
  accountId: string
  credId: string
}

const accountsList = computed(() => accounts.value ?? [])

const { data: allCredentials, isLoading: credLoading } = useQuery<CredRow[]>({
  queryKey: ['credentials', 'all', accountsList],
  queryFn: async () => {
    const accs = accountsList.value
    if (!accs.length) return []
    const results = await Promise.all(
      accs.map(acc =>
        btpAccountsApi.listCredentials(acc.id).then(creds =>
          creds.map((c): CredRow => ({
            accountName: acc.displayName,
            credentialType: c.credentialType,
            isActive: c.isActive,
            createdAt: c.createdAt,
            accountId: acc.id,
            credId: c.id,
          }))
        )
      )
    )
    return results.flat()
  },
  enabled: () => accountsList.value.length > 0,
})

// Test All credentials
const testResults = ref<Record<string, 'pending' | 'success' | 'error'>>({})
const testingAll = ref(false)

async function testAll() {
  testingAll.value = true
  testResults.value = {}
  for (const row of (allCredentials.value ?? [])) {
    const key = `${row.accountId}:${row.credId}`
    testResults.value[key] = 'pending'
    try {
      await btpAccountsApi.testCredential(row.accountId, row.credId)
      testResults.value[key] = 'success'
    } catch {
      testResults.value[key] = 'error'
    }
  }
  testingAll.value = false
}
</script>

<template>
  <div class="page-root">
    <div class="page-filter-bar">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Dashboard</h2>
        <p class="text-xs text-muted-foreground">
          Welcome back<template v-if="me">, {{ me.email }}</template>.
        </p>
      </div>
    </div>
  <div class="p-6 space-y-6">

    <!-- Summary cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">This Month's Usage</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="spendLoading">
            <Skeleton class="h-7 w-16" />
          </div>
          <template v-else>
            <div class="text-2xl font-bold">{{ monthlySpend }}</div>
            <p class="text-xs text-muted-foreground">
              {{ accountId ? 'service lines this month' : 'Select an account' }}
            </p>
          </template>
        </CardContent>
      </Card>
    </div>

    <!-- Bottom row: events + credential health -->
    <div class="grid gap-4 lg:grid-cols-2">

      <!-- Recent Events -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Recent Events</CardTitle>
          <RouterLink to="/events" class="text-xs text-primary hover:underline">View all →</RouterLink>
        </CardHeader>
        <CardContent>
          <div v-if="!accountId" class="py-4 text-center text-xs text-muted-foreground">
            Select a BTP account to see recent events.
          </div>
          <div v-else-if="eventsLoading" class="space-y-2">
            <Skeleton v-for="i in 5" :key="i" class="h-10 w-full rounded-md" />
          </div>
          <div v-else-if="recentEvents.length === 0" class="py-4 text-center text-xs text-muted-foreground">
            No recent events.
          </div>
          <div v-else class="space-y-1.5">
            <div
              v-for="event in recentEvents"
              :key="event.id"
              class="flex items-start gap-2.5 px-2 py-1.5 rounded-md border text-xs hover:bg-muted/30 transition-colors"
            >
              <span
                class="inline-flex items-center justify-center h-5 w-5 rounded border shrink-0 mt-0.5"
                :class="getEventColor(event.eventType)"
              >
                <component :is="getEventIcon(event.eventType)" class="h-3 w-3" />
              </span>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ event.eventType }}</p>
                <p class="text-muted-foreground truncate">{{ event.entityType }}</p>
              </div>
              <span class="text-muted-foreground shrink-0 text-[10px]">{{ relativeTime(event.actionTime) }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Credential Health -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Credential Health</CardTitle>
          <button
            class="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            :disabled="testingAll || (allCredentials?.length ?? 0) === 0"
            @click="testAll"
          >
            <Loader2 v-if="testingAll" class="h-3 w-3 animate-spin" />
            Test All
          </button>
        </CardHeader>
        <CardContent>
          <div v-if="credLoading" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" class="h-8 w-full" />
          </div>
          <p v-else-if="(allCredentials?.length ?? 0) === 0" class="text-xs text-muted-foreground py-2">
            No credential sets found.
          </p>
          <div v-else class="rounded-md border overflow-hidden">
            <table class="w-full text-xs">
              <thead class="bg-muted/50 border-b">
                <tr>
                  <th class="text-left px-3 py-1.5 font-medium text-muted-foreground">Account</th>
                  <th class="text-left px-3 py-1.5 font-medium text-muted-foreground">Type</th>
                  <th class="text-center px-3 py-1.5 font-medium text-muted-foreground">Status</th>
                  <th class="text-center px-3 py-1.5 font-medium text-muted-foreground">Test</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="row in allCredentials" :key="`${row.accountId}:${row.credId}`" class="hover:bg-muted/20">
                  <td class="px-3 py-2 truncate max-w-[100px]" :title="row.accountName">{{ row.accountName }}</td>
                  <td class="px-3 py-2 font-mono">{{ row.credentialType }}</td>
                  <td class="px-3 py-2 text-center">
                    <Badge
                      :variant="row.isActive ? 'success' : 'destructive'"
                      class="text-[10px]"
                    >{{ row.isActive ? 'active' : 'inactive' }}</Badge>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <template v-if="testResults[`${row.accountId}:${row.credId}`]">
                      <span v-if="testResults[`${row.accountId}:${row.credId}`] === 'pending'">
                        <Loader2 class="h-3.5 w-3.5 animate-spin text-muted-foreground inline" />
                      </span>
                      <Badge v-else-if="testResults[`${row.accountId}:${row.credId}`] === 'success'" variant="success" class="text-[10px]">OK</Badge>
                      <Badge v-else variant="destructive" class="text-[10px]">Fail</Badge>
                    </template>
                    <span v-else class="text-muted-foreground text-[10px]">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  </div><!-- end p-6 -->
  </div><!-- end page-root -->
</template>
