<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useGlobalAssignments } from '@/composables/useEntitlements'
import { useSubaccounts } from '@/composables/useAccountsBtp'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { KeySquare, Layers, Box, Search, ChevronDown, ChevronRight, Users } from 'lucide-vue-next'
import type { AssignmentInfo } from '@/api/types'

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

const { data: entitlements, isLoading } = useGlobalAssignments(accountId)
const { data: subaccounts } = useSubaccounts(accountId)

// GUID → { displayName, description } map for enriching assignment entityIds
const subaccountMap = computed(() => {
  const m = new Map<string, { displayName: string; description?: string }>()
  subaccounts.value?.forEach((s) => m.set(s.guid, { displayName: s.displayName, description: s.description }))
  return m
})

// ── Assignment lookup from assignedServices ────────────────────────────────
// entitledServices plans do NOT carry assignmentInfo — that data lives only in
// the assignedServices array returned by the same endpoint.

const assignedPlanMap = computed(() => {
  const m = new Map<string, AssignmentInfo[]>()
  entitlements.value?.assignedServices?.forEach((svc) => {
    svc.servicePlans?.forEach((plan) => {
      m.set(planKey(svc.name, plan.name), plan.assignmentInfo ?? [])
    })
  })
  return m
})

// ── Service-level status ──────────────────────────────────────────────────────
// active   = appears in assignedServices with at least one SUBACCOUNT OK assignment
// assigned = appears in assignedServices but no OK assignment yet
// entitled = in the entitlements catalog but not assigned to any subaccount

const serviceStatusMap = computed(() => {
  const m = new Map<string, 'active' | 'assigned' | 'entitled'>()
  entitlements.value?.entitledServices?.forEach((svc) => m.set(svc.name, 'entitled'))
  entitlements.value?.assignedServices?.forEach((svc) => {
    const hasActive = svc.servicePlans?.some((p) =>
      (p.assignmentInfo ?? []).some((a) => a.entityType === 'SUBACCOUNT' && a.entityState === 'OK'),
    )
    m.set(svc.name, hasActive ? 'active' : 'assigned')
  })
  return m
})

function serviceStatus(name: string): 'active' | 'assigned' | 'entitled' {
  return serviceStatusMap.value?.get(name) ?? 'entitled'
}

function serviceStatusVariant(name: string): 'success' | 'secondary' | 'outline' {
  const s = serviceStatus(name)
  if (s === 'active') return 'success'
  if (s === 'assigned') return 'secondary'
  return 'outline'
}

function serviceStatusLabel(name: string): string {
  const s = serviceStatus(name)
  if (s === 'active') return 'Active'
  if (s === 'assigned') return 'Assigned'
  return 'Entitled only'
}

function planActiveCount(serviceName: string, planName: string): number {
  return subaccountAssignments(serviceName, planName).filter((a) => a.entityState === 'OK').length
}

// ── Filters ──────────────────────────────────────────────────────────────────

const searchQuery = ref('')
const selectedCategory = ref('all')
const showOnlyAssigned = ref(false)

const availableCategories = computed(() => {
  const cats = new Set<string>()
  entitlements.value?.entitledServices?.forEach((svc) =>
    svc.servicePlans?.forEach((p) => { if (p.category) cats.add(p.category) }),
  )
  return [...cats].sort()
})

const filteredServices = computed(() => {
  const services = entitlements.value?.entitledServices ?? []
  const q = searchQuery.value.trim().toLowerCase()

  return services
    .filter((svc) => {
      const nameMatch =
        !q ||
        svc.name.toLowerCase().includes(q) ||
        (svc.displayName ?? '').toLowerCase().includes(q)
      if (!nameMatch) return false

      if (selectedCategory.value !== 'all') {
        if (!svc.servicePlans?.some((p) => p.category === selectedCategory.value)) return false
      }

      if (showOnlyAssigned.value) {
        return svc.servicePlans?.some(
          (p) => subaccountAssignments(svc.name, p.name).length > 0
        )
      }

      return true
    })
    .map((svc) => {
      if (selectedCategory.value === 'all') return svc
      return { ...svc, servicePlans: svc.servicePlans?.filter((p) => p.category === selectedCategory.value) }
    })
})

const totalPlans = computed(() =>
  filteredServices.value.reduce((sum, s) => sum + (s.servicePlans?.length ?? 0), 0),
)

// ── Expand / collapse plan rows ───────────────────────────────────────────────

const expandedPlans = ref(new Set<string>())

function planKey(serviceName: string, planName: string) {
  return `${serviceName}::${planName}`
}
function togglePlan(serviceName: string, planName: string) {
  const key = planKey(serviceName, planName)
  const next = new Set(expandedPlans.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expandedPlans.value = next
}
function isPlanExpanded(serviceName: string, planName: string) {
  return expandedPlans.value.has(planKey(serviceName, planName))
}

// ── Assignment helpers ────────────────────────────────────────────────────────

function subaccountAssignments(serviceName: string, planName: string): AssignmentInfo[] {
  const all = assignedPlanMap.value.get(planKey(serviceName, planName)) ?? []
  return all.filter((a) => a.entityType === 'SUBACCOUNT')
}

function stateVariant(state?: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (state === 'OK') return 'success'
  if (state === 'PROCESSING_FAILED') return 'destructive'
  if (state === 'PROCESSING' || state === 'STARTED') return 'warning'
  return 'outline'
}

function stateLabel(state?: string): string {
  const labels: Record<string, string> = {
    OK: 'Active',
    PROCESSING: 'Processing',
    PROCESSING_FAILED: 'Failed',
    STARTED: 'Starting',
  }
  return labels[state ?? ''] ?? (state ?? '—')
}

function quotaLabel(a: AssignmentInfo): string {
  if (a.unlimitedAmountAssigned) return 'Unlimited'
  if (a.amount !== undefined && a.amount !== null) return String(a.amount)
  return '—'
}

function subaccountName(guid: string): string {
  return subaccountMap.value?.get(guid)?.displayName ?? guid
}

function subaccountDescription(guid: string): string | undefined {
  return subaccountMap.value?.get(guid)?.description
}

// Category badge colours
const categoryVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  APPLICATION: 'default',
  QUOTA_BASED_APPLICATION: 'default',
  SERVICE: 'secondary',
  ELASTIC_SERVICE: 'secondary',
  ELASTIC_LIMITED: 'outline',
  PLATFORM: 'outline',
  ENVIRONMENT: 'outline',
}
function catVariant(cat?: string): 'default' | 'secondary' | 'outline' {
  return categoryVariant[cat ?? ''] ?? 'secondary'
}
</script>

<template>
  <div class="page-root">
    <!-- Sticky filter bar -->
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Entitlements & Quotas</h2>
        <p class="text-xs text-muted-foreground">Global account service entitlements and subaccount assignments</p>
      </div>

      <span v-if="filteredServices.length > 0" class="text-xs text-muted-foreground shrink-0">
        <strong class="text-foreground">{{ filteredServices.length }}</strong> services ·
        <strong class="text-foreground">{{ totalPlans }}</strong> plans
      </span>

      <template v-if="accountId">
        <div class="relative w-52">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input v-model="searchQuery" placeholder="Filter by service name…" class="pl-8 h-8 text-xs" />
        </div>
        <Select v-model="selectedCategory">
          <SelectTrigger class="h-8 text-xs w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          :variant="showOnlyAssigned ? 'default' : 'outline'"
          size="sm"
          class="shrink-0"
          @click="showOnlyAssigned = !showOnlyAssigned"
        >
          <Users class="h-3.5 w-3.5 mr-1.5" />
          Assigned only
        </Button>
      </template>
    </div>

    <!-- No account -->
    <div v-if="!accountId" class="flex h-[400px] items-center justify-center rounded-md border border-dashed m-6">
      <div class="text-center">
        <h3 class="text-lg font-semibold">No Account Selected</h3>
        <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar.</p>
      </div>
    </div>

    <template v-else>

    <div class="page-content">
      <!-- Loading -->
      <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton class="h-48 w-full" v-for="i in 6" :key="i" />
      </div>

      <!-- Cards -->
      <div v-else-if="filteredServices.length" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="service in filteredServices"
          :key="service.name"
          class="flex flex-col overflow-hidden h-[480px]"
        >
          <!-- Service header -->
          <CardHeader class="border-b bg-muted/50 pb-4">
            <div class="flex items-start gap-3">
              <div class="bg-primary/10 p-2 rounded-lg shrink-0">
                <KeySquare class="h-5 w-5 text-primary" />
              </div>
              <div class="min-w-0">
                <CardTitle class="text-base line-clamp-1">
                  {{ service.displayName || service.name }}
                </CardTitle>
                <CardDescription class="mt-0.5 text-xs line-clamp-2" :title="service.description ?? ''">
                  {{ service.description || 'No description available' }}
                </CardDescription>
                <p v-if="service.businessCategory?.displayName" class="text-[10px] text-muted-foreground mt-1">
                  {{ service.businessCategory.displayName }}
                </p>
                <div class="flex items-center gap-2 mt-1.5">
                  <Badge :variant="serviceStatusVariant(service.name)" class="text-[10px]">
                    {{ serviceStatusLabel(service.name) }}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <!-- Plans -->
          <CardContent class="flex-1 p-0 overflow-y-auto min-h-0">
            <div class="divide-y">
              <div v-for="plan in service.servicePlans" :key="plan.name">

                <!-- Plan row (clickable when it has subaccount assignments) -->
                <div
                  class="p-3 transition-colors"
                  :class="subaccountAssignments(service.name, plan.name).length > 0 ? 'cursor-pointer hover:bg-muted/40' : ''"
                  @click="subaccountAssignments(service.name, plan.name).length > 0 && togglePlan(service.name, plan.name)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <!-- Plan info -->
                    <div class="flex items-center gap-2 min-w-0">
                      <Layers class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span class="font-medium text-sm truncate">
                        {{ plan.displayName || plan.name }}
                      </span>
                    </div>
                    <!-- Right side: category + expand button -->
                    <div class="flex items-center gap-1.5 shrink-0">
                      <Badge :variant="catVariant(plan.category)" class="text-[10px]" v-if="plan.category">
                        {{ plan.category }}
                      </Badge>
                      <button
                        v-if="subaccountAssignments(service.name, plan.name).length > 0"
                        type="button"
                        class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        @click.stop="togglePlan(service.name, plan.name)"
                      >
                        <Users class="h-3 w-3" />
                        <span>
                          {{ planActiveCount(service.name, plan.name) }}/{{ subaccountAssignments(service.name, plan.name).length }}
                          active
                        </span>
                        <ChevronDown
                          v-if="isPlanExpanded(service.name, plan.name)"
                          class="h-3 w-3"
                        />
                        <ChevronRight v-else class="h-3 w-3" />
                      </button>
                      <span
                        v-else
                        class="text-[10px] text-muted-foreground/50 italic"
                      >
                        Entitled only
                      </span>
                    </div>
                  </div>

                  <!-- Plan quota meta -->
                  <div class="flex items-center gap-3 mt-1 pl-5 text-xs text-muted-foreground">
                    <span v-if="plan.maxAllowedSubaccountQuota !== undefined && plan.maxAllowedSubaccountQuota !== null">
                      Max quota: <strong class="text-foreground">{{ plan.maxAllowedSubaccountQuota }}</strong>
                    </span>
                    <span v-if="plan.unlimited" class="text-muted-foreground">Unlimited</span>
                    <Badge v-if="plan.beta" variant="outline" class="text-[10px]">Beta</Badge>
                  </div>
                </div>

                <!-- Subaccount assignments panel -->
                <div
                  v-if="isPlanExpanded(service.name, plan.name)"
                  class="bg-muted/20 border-t px-3 py-2"
                >
                  <p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Subaccount Assignments
                  </p>
                  <div class="space-y-1.5">
                    <div
                      v-for="assignment in subaccountAssignments(service.name, plan.name)"
                      :key="assignment.entityId"
                      class="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <!-- Subaccount name / description / GUID -->
                      <div class="min-w-0 flex-1">
                        <p class="font-medium text-xs truncate" :title="assignment.entityId">
                          {{ subaccountName(assignment.entityId) }}
                        </p>
                        <p
                          v-if="subaccountDescription(assignment.entityId)"
                          class="text-[10px] text-muted-foreground truncate"
                          :title="subaccountDescription(assignment.entityId)"
                        >
                          {{ subaccountDescription(assignment.entityId) }}
                        </p>
                        <p class="font-mono text-[10px] text-muted-foreground/60 truncate">
                          {{ assignment.entityId }}
                        </p>
                      </div>

                      <!-- Right: quota + state + auto badge -->
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span
                          v-if="quotaLabel(assignment) !== '—'"
                          class="text-[10px] text-muted-foreground"
                        >
                          {{ quotaLabel(assignment) }}
                        </span>
                        <Badge
                          v-if="assignment.autoAssigned"
                          variant="outline"
                          class="text-[10px] font-normal"
                        >
                          Auto
                        </Badge>
                        <Badge
                          :variant="stateVariant(assignment.entityState)"
                          class="text-[10px]"
                        >
                          {{ stateLabel(assignment.entityState) }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p
                    v-for="assignment in subaccountAssignments(service.name, plan.name).filter(a => a.stateMessage)"
                    :key="assignment.entityId + '-msg'"
                    class="text-[10px] text-muted-foreground mt-1.5 italic"
                  >
                    {{ assignment.stateMessage }}
                  </p>
                </div>

              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- No results after filtering -->
      <div
        v-else-if="!isLoading && (searchQuery || selectedCategory !== 'all' || showOnlyAssigned)"
        class="flex h-[300px] flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground"
      >
        <Search class="h-10 w-10 mb-3 opacity-20" />
        <p>No entitlements match your filters.</p>
        <button
          class="text-sm text-primary hover:underline mt-2"
          @click="searchQuery = ''; selectedCategory = 'all'; showOnlyAssigned = false"
        >
          Clear filters
        </button>
      </div>

      <!-- Empty (no entitlements at all) -->
      <div
        v-else-if="!isLoading"
        class="flex h-[300px] flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground"
      >
        <Box class="h-10 w-10 mb-3 opacity-20" />
        <p>No entitlements available for this global account.</p>
      </div>
    </div><!-- end page-content -->
    </template>
  </div><!-- end page-root -->
</template>
