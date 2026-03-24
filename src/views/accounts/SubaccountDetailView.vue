<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useSubaccounts } from '@/composables/useAccountsBtp'
import { useSubaccountCostsRange } from '@/composables/useConsumption'
import { useGlobalAssignments } from '@/composables/useEntitlements'
import { useEvents } from '@/composables/useEvents'
import { useEnvironments } from '@/composables/useProvisioning'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, MapPin, Tag, Globe,
  CheckCircle2, XCircle, Info,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const guid = computed(() => route.params.guid as string)

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

// ── Subaccount metadata ────────────────────────────────────────────────────
const { data: subaccounts, isLoading: subsLoading } = useSubaccounts(accountId)
const subaccount = computed(() => subaccounts.value?.find(sa => sa.guid === guid.value) ?? null)

// ── Current month cost range ───────────────────────────────────────────────
const now = new Date()
const currentYYYYMM = now.getFullYear() * 100 + (now.getMonth() + 1)
const costFromDate = ref(currentYYYYMM)
const costToDate = ref(currentYYYYMM)

const { data: costsRange, isLoading: costsLoading } = useSubaccountCostsRange(accountId, costFromDate, costToDate)

const subCostRows = computed(() => {
  if (!costsRange.value?.content) return []
  return costsRange.value.content.filter(r => r.subaccountId === guid.value && (r.cost ?? 0) > 0)
})

const costByService = computed(() => {
  const map = new Map<string, number>()
  subCostRows.value.forEach(r => {
    const k = r.serviceName ?? 'Unknown'
    map.set(k, (map.get(k) ?? 0) + (r.cost ?? 0))
  })
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
})

const totalCost = computed(() => subCostRows.value.reduce((s, r) => s + (r.cost ?? 0), 0))
const costCurrency = computed(() => subCostRows.value.find(r => r.currency)?.currency ?? 'EUR')

// ── Entitlements ───────────────────────────────────────────────────────────
// Use the global assignments endpoint with subaccountGuid filter — same as EntitlementsView.
// The dedicated per-subaccount endpoint only returns entitledServices (catalog) which
// does NOT carry assignmentInfo; assignedServices is the correct source.
const entitlementParams = computed(() => ({ subaccountGuid: guid.value }))
const { data: entitlements, isLoading: entLoading } = useGlobalAssignments(accountId, entitlementParams)

const activeEntitlements = computed(() => {
  const resp = entitlements.value
  if (!resp) return []
  const seen = new Set<string>()
  const result: Array<{ service: string; plan: string; state: string; amount: number | null; unlimited: boolean }> = []
  for (const svc of (resp.assignedServices ?? [])) {
    for (const plan of (svc.servicePlans ?? [])) {
      // Filter to the assignment for THIS subaccount only — the API returns one
      // assignmentInfo entry per entity globally, so without the entityId check the
      // same plan appears once per subaccount that has it assigned.
      const info = (plan.assignmentInfo ?? []).find(
        i => i.entityType === 'SUBACCOUNT' && i.entityId === guid.value,
      )
      if (!info) continue
      // Deduplicate by service+plan in case SAP returns the same pair twice
      const key = `${svc.name}::${plan.name}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        service: svc.displayName ?? svc.name,
        plan: plan.displayName ?? plan.name,
        state: info.entityState ?? 'OK',
        amount: info.amount ?? null,
        unlimited: info.unlimitedAmountAssigned ?? false,
      })
    }
  }
  return result
})

// ── Recent Events ──────────────────────────────────────────────────────────
const eventsFilter = ref<any>({ maxNumberOfEvents: 10 })
const { data: eventsResponse, isLoading: eventsLoading } = useEvents(accountId, eventsFilter)

const recentEvents = computed(() => {
  const all = eventsResponse.value?.events ?? []
  // Try to filter by subaccount guid — events may have entityId === guid
  const filtered = all.filter(e => e.entityId === guid.value || (e.details?.entityId as string) === guid.value)
  return filtered.length > 0 ? filtered.slice(0, 10) : all.slice(0, 5)
})

// ── Environment Instances ──────────────────────────────────────────────────
const envSubaccountId = computed<string | null>(() => guid.value)
const { data: environments, isLoading: envLoading } = useEnvironments(accountId, envSubaccountId)
const envInstances = computed(() => environments.value?.environmentInstances ?? [])

// ── Helpers ────────────────────────────────────────────────────────────────
function stateVariant(state?: string): 'success' | 'secondary' | 'destructive' | 'outline' | 'warning' {
  if (state === 'OK') return 'success'
  if (state?.includes('FAILED') || state === 'SUSPENDED') return 'destructive'
  if (state?.includes('CREATING') || state?.includes('PROCESSING') || state?.includes('DELETING')) return 'warning'
  return 'secondary'
}

function formatDate(epoch?: number | string | null): string {
  if (!epoch) return '—'
  const d = new Date(typeof epoch === 'number' && epoch < 1e12 ? epoch * 1000 : epoch)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
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
</script>

<template>
  <div class="page-root">
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <div v-if="subsLoading" class="h-4 w-40 rounded bg-muted animate-pulse" />
        <template v-else-if="subaccount">
          <div class="flex items-center gap-2 flex-wrap">
            <button
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              @click="router.push('/accounts')"
            >
              <ArrowLeft class="h-3 w-3" />
              Accounts
            </button>
            <span class="text-muted-foreground text-xs">/</span>
            <h2 class="text-base font-semibold leading-none">{{ subaccount.displayName }}</h2>
            <Badge :variant="stateVariant(subaccount.state)">{{ subaccount.state }}</Badge>
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin class="h-3 w-3" />
              {{ subaccount.region }}
            </div>
            <div v-if="subaccount.subdomain" class="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe class="h-3 w-3" />
              {{ subaccount.subdomain }}
            </div>
          </div>
          <p class="font-mono text-xs text-muted-foreground">{{ subaccount.guid }}</p>
        </template>
        <div v-else-if="!subsLoading" class="text-sm text-muted-foreground">
          Subaccount not found.
        </div>
      </div>
    </div>

    <div class="page-content space-y-6">

    <!-- Labels -->
    <div v-if="subaccount?.labels && Object.keys(subaccount.labels).length">
      <div class="flex items-center gap-1.5 mb-2">
        <Tag class="h-4 w-4 text-muted-foreground" />
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <template v-for="(values, key) in subaccount.labels" :key="key">
          <Badge v-for="val in values" :key="val" variant="secondary" class="text-[11px] font-normal">
            {{ key }}: {{ val }}
          </Badge>
        </template>
      </div>
    </div>

    <!-- Two-column grid for cost + entitlements -->
    <div class="grid gap-4 lg:grid-cols-2">

      <!-- Current Month Cost -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Current Month Cost</CardTitle>
          <CardDescription>
            {{ now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="costsLoading" class="space-y-2">
            <Skeleton class="h-6 w-32" />
            <Skeleton v-for="i in 4" :key="i" class="h-8 w-full" />
          </div>
          <div v-else-if="costByService.length">
            <div class="text-2xl font-bold mb-3">
              {{ totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
              <span class="text-sm font-normal text-muted-foreground ml-1">{{ costCurrency }}</span>
            </div>
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-1.5 font-medium text-muted-foreground">Service</th>
                  <th class="text-right py-1.5 font-medium text-muted-foreground">Cost</th>
                  <th class="text-right py-1.5 font-medium text-muted-foreground w-12">%</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="[name, cost] in costByService" :key="name" class="hover:bg-muted/30">
                  <td class="py-1.5 truncate max-w-[180px]" :title="name">{{ name }}</td>
                  <td class="py-1.5 text-right font-mono">{{ cost.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  <td class="py-1.5 text-right text-muted-foreground">
                    {{ totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : '0.0' }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-muted-foreground">No cost-generating services this month.</p>
        </CardContent>
      </Card>

      <!-- Entitlements -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Entitlements</CardTitle>
          <CardDescription>Service plans assigned to this subaccount</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="entLoading" class="space-y-2">
            <Skeleton v-for="i in 5" :key="i" class="h-9 w-full" />
          </div>
          <p v-else-if="activeEntitlements.length === 0" class="text-sm text-muted-foreground">
            No entitlements assigned.
          </p>
          <div v-else class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="(ent, i) in activeEntitlements"
              :key="i"
              class="flex items-center gap-3 text-xs px-3 py-2 rounded-md bg-muted/30 border"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ ent.service }}</p>
                <p class="text-muted-foreground truncate">{{ ent.plan }}</p>
              </div>
              <Badge
                :variant="ent.state === 'OK' ? 'success' : ent.state?.includes('FAILED') ? 'destructive' : 'secondary'"
                class="text-[10px] shrink-0"
              >{{ ent.state }}</Badge>
              <span class="text-muted-foreground font-mono min-w-[2rem] text-right shrink-0">
                {{ ent.unlimited ? '∞' : ent.amount ?? '—' }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Recent Events -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Recent Events</CardTitle>
        <CardDescription>
          Latest events
          <span v-if="recentEvents.length !== (eventsResponse?.events?.length ?? 0)" class="text-xs">
            (filtered to this subaccount; showing {{ recentEvents.length }})
          </span>
          · <RouterLink to="/events" class="text-primary hover:underline text-xs">View all events →</RouterLink>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="eventsLoading" class="space-y-2">
          <Skeleton v-for="i in 4" :key="i" class="h-10 w-full rounded-md" />
        </div>
        <div v-else-if="recentEvents.length === 0" class="text-sm text-muted-foreground py-2">
          No recent events found.
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="event in recentEvents"
            :key="event.id"
            class="flex items-start gap-3 px-3 py-2 rounded-md border text-xs"
          >
            <span
              class="inline-flex items-center justify-center h-6 w-6 rounded border shrink-0 mt-0.5"
              :class="getEventColor(event.eventType)"
            >
              <component :is="getEventIcon(event.eventType)" class="h-3.5 w-3.5" />
            </span>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ event.eventType }}</p>
              <p class="text-muted-foreground truncate">{{ event.entityType }} · {{ event.entityId }}</p>
            </div>
            <span class="text-muted-foreground shrink-0">{{ relativeTime(event.actionTime) }}</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Environment Instances -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Environment Instances</CardTitle>
        <CardDescription>CF orgs, Kyma clusters, and other environments in this subaccount</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="envLoading" class="space-y-2">
          <Skeleton v-for="i in 3" :key="i" class="h-9 w-full" />
        </div>
        <p v-else-if="envInstances.length === 0" class="text-sm text-muted-foreground">
          No environment instances found for this subaccount.
        </p>
        <div v-else class="rounded-md border overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-muted/50 border-b">
              <tr>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">State</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="env in envInstances" :key="env.id" class="hover:bg-muted/20">
                <td class="px-3 py-2 font-medium">{{ env.name || '—' }}</td>
                <td class="px-3 py-2">
                  <Badge variant="outline" class="text-[10px]">{{ env.environmentType }}</Badge>
                </td>
                <td class="px-3 py-2">
                  <Badge
                    :variant="stateVariant(env.state)"
                    class="text-[10px]"
                  >{{ env.state }}</Badge>
                </td>
                <td class="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  {{ formatDate(env.createdDate) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </div><!-- end page-content -->
  </div><!-- end page-root -->
</template>
