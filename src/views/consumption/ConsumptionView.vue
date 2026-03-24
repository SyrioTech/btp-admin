<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useSubaccountCosts, useCloudCredits, useDirectoryUsage, useSubaccountCostsRange } from '@/composables/useConsumption'
import { useSubaccounts } from '@/composables/useAccountsBtp'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Info, AlertTriangle, X, Search, TrendingDown, Bell, BellOff } from 'lucide-vue-next'
import { Bar, Pie } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  type ChartEvent,
  type ActiveElement,
} from 'chart.js'
import type { CreditsPhase } from '@/api/types'
import { useBudgets } from '@/composables/useBudgets'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const btpAccount = useBtpAccountStore()
const accountId = computed(() => btpAccount.selectedAccountId)

const currentYear = new Date().getFullYear()
const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0')

// Global month selector (credits, monthly costs, directory usage)
const selectedYear = ref(currentYear.toString())
const selectedMonth = ref(currentMonthStr)
const yearNum = computed(() => parseInt(selectedYear.value, 10))
const monthNum = computed(() => parseInt(selectedMonth.value, 10))

// Subaccount section date range — default last 3 months
function nMonthsAgo(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
const from2Ago = nMonthsAgo(2)
const subFromYear = ref(from2Ago.year.toString())
const subFromMonth = ref(String(from2Ago.month).padStart(2, '0'))
const subToYear = ref(currentYear.toString())
const subToMonth = ref(currentMonthStr)
const subFromDate = computed(() => parseInt(subFromYear.value, 10) * 100 + parseInt(subFromMonth.value, 10))
const subToDate = computed(() => parseInt(subToYear.value, 10) * 100 + parseInt(subToMonth.value, 10))

// Subaccount combobox state
const selectedSubaccountGuid = ref('')
const subaccountSearch = ref('')
const comboboxOpen = ref(false)
const comboboxWrapperRef = ref<HTMLElement | null>(null)
const subaccountSectionRef = ref<HTMLElement | null>(null)

// Queries
const { data: credits, isLoading: creditsLoading } = useCloudCredits(accountId)
const { data: subCosts, isLoading: costsLoading } = useSubaccountCosts(accountId, yearNum, monthNum)
const { data: directoryUsage, isLoading: directoryLoading, error: directoryError } = useDirectoryUsage(accountId, yearNum, monthNum)
const { data: subaccounts } = useSubaccounts(accountId)
const { data: subCostsRange, isLoading: rangeLoading } = useSubaccountCostsRange(accountId, subFromDate, subToDate)

const directoryErrorStatus = computed(() => (directoryError.value as { response?: { status?: number } } | null)?.response?.status ?? null)

// All contracts — SAP creates one entry per renewal cycle in contracts[]
const allContracts = computed(() => credits.value?.contracts ?? [])

// ── Label filter for subaccount combobox ──────────────────────────────────

const selectedLabelChips = ref<string[]>([])

const availableLabelChips = computed(() => {
  const chips = new Set<string>()
  ;(subaccounts.value ?? []).forEach(sa => {
    if (sa.labels) {
      Object.entries(sa.labels).forEach(([key, values]) => {
        values.forEach(val => chips.add(`${key}: ${val}`))
      })
    }
  })
  return Array.from(chips).sort()
})

function toggleLabelChip(chip: string) {
  const idx = selectedLabelChips.value.indexOf(chip)
  if (idx >= 0) selectedLabelChips.value.splice(idx, 1)
  else selectedLabelChips.value.push(chip)
}

// ── Combobox helpers ───────────────────────────────────────────────────────

const filteredSubaccounts = computed(() => {
  const q = subaccountSearch.value.toLowerCase().trim()
  let list = subaccounts.value ?? []
  if (selectedLabelChips.value.length) {
    list = list.filter(sa => {
      if (!sa.labels) return false
      return selectedLabelChips.value.every(chip => {
        const parts = chip.split(':')
        const key = (parts[0] ?? '').trim()
        const val = parts.slice(1).join(':').trim()
        return sa.labels?.[key]?.includes(val) ?? false
      })
    })
  }
  if (!q) return list
  return list.filter(sa =>
    sa.displayName.toLowerCase().includes(q) || sa.guid.toLowerCase().includes(q)
  )
})

function selectSubaccount(guid: string, name: string) {
  selectedSubaccountGuid.value = guid
  subaccountSearch.value = name
  comboboxOpen.value = false
}

function clearSubaccountSelection() {
  selectedSubaccountGuid.value = ''
  subaccountSearch.value = ''
  comboboxOpen.value = false
}

// When bar chart click updates selectedSubaccountGuid, sync the search input text
watch(selectedSubaccountGuid, (guid) => {
  if (!guid) { subaccountSearch.value = ''; return }
  const sa = subaccounts.value?.find(s => s.guid === guid)
  if (sa) subaccountSearch.value = sa.displayName
})

function handleClickOutside(e: MouseEvent) {
  if (comboboxWrapperRef.value && !comboboxWrapperRef.value.contains(e.target as Node)) {
    comboboxOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

// ── Credits helpers ────────────────────────────────────────────────────────

const today = new Date()

function phaseStatus(phase: CreditsPhase): 'active' | 'expired' | 'upcoming' {
  const start = new Date(phase.phaseStartDate)
  const end = new Date(phase.phaseEndDate)
  if (today < start) return 'upcoming'
  if (today > end) return 'expired'
  return 'active'
}

function contractStatus(c: { contractStartDate: string; contractEndDate: string }): 'active' | 'expired' | 'upcoming' {
  const start = new Date(c.contractStartDate)
  const end = new Date(c.contractEndDate)
  if (today < start) return 'upcoming'
  if (today > end) return 'expired'
  return 'active'
}

// Headline balance: active contract's active phase, or fall back to the last contract/phase
const activeContract = computed(() =>
  allContracts.value.find(c => contractStatus(c) === 'active')
  ?? allContracts.value[allContracts.value.length - 1]
  ?? null
)

const activePhase = computed(() => {
  const phases = activeContract.value?.phases
  if (!phases?.length) return null
  return phases.find(p => phaseStatus(p) === 'active') ?? phases[phases.length - 1] ?? null
})

const headlineIsActive = computed(() =>
  !!activeContract.value && contractStatus(activeContract.value) === 'active'
)

function latestUpdate(phase: CreditsPhase) {
  return phase.phaseUpdates?.slice(-1)?.[0] ?? null
}

function phaseConsumedPct(phase: CreditsPhase): number {
  const latest = latestUpdate(phase)
  if (!latest || latest.cloudCreditsForPhase === 0) return 0
  return Math.min(100, Math.round(((latest.cloudCreditsForPhase - latest.balance) / latest.cloudCreditsForPhase) * 100))
}

// ── Burn Rate / Runway ─────────────────────────────────────────────────────

// Separate 3-month range query for burn rate (always last 3 months, independent of sub date range)
function nMonthsAgoYYYYMM(n: number): number {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.getFullYear() * 100 + (d.getMonth() + 1)
}
const burnFromDate = ref(nMonthsAgoYYYYMM(3))
const burnToDate = ref(parseInt(currentYear.toString() + currentMonthStr, 10))
const { data: burnCostsRange } = useSubaccountCostsRange(accountId, burnFromDate, burnToDate)

const burnRate = computed(() => {
  const rows = burnCostsRange.value?.content
  if (!rows?.length) return null

  // Group by reportYearMonth and sum
  const byMonth = new Map<number, number>()
  rows.forEach(r => {
    if (r.reportYearMonth) {
      byMonth.set(r.reportYearMonth, (byMonth.get(r.reportYearMonth) ?? 0) + (r.cost ?? 0))
    }
  })
  if (byMonth.size === 0) return null

  const monthsWithData = byMonth.size
  const totalSpend = Array.from(byMonth.values()).reduce((s, v) => s + v, 0)
  const avgMonthly = totalSpend / monthsWithData

  const currency = rows.find(r => r.currency)?.currency ?? 'EUR'

  const phase = activePhase.value
  const update = phase ? (phase.phaseUpdates?.slice(-1)?.[0] ?? null) : null
  const balance = update?.balance ?? null

  let runwayMonths: number | null = null
  let projectedDepletionDate: string | null = null

  if (balance !== null && avgMonthly > 0) {
    runwayMonths = balance / avgMonthly
    const depletion = new Date()
    depletion.setMonth(depletion.getMonth() + Math.round(runwayMonths))
    projectedDepletionDate = depletion.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Progress: months elapsed in phase
  let phaseProgressPct = 0
  if (phase) {
    const phaseStart = new Date(phase.phaseStartDate).getTime()
    const phaseEnd = new Date(phase.phaseEndDate).getTime()
    const now = Date.now()
    if (phaseEnd > phaseStart) {
      phaseProgressPct = Math.min(100, Math.round(((now - phaseStart) / (phaseEnd - phaseStart)) * 100))
    }
  }

  return { avgMonthly, currency, monthsWithData, balance, runwayMonths, projectedDepletionDate, phaseProgressPct }
})

// ── Bar chart with GUID map for click-to-select ────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

// Preserve GUID alongside name+cost so bar click can look up the right subaccount
const subCostsSorted = computed(() => {
  const rows = subCosts.value?.content
  if (!rows?.length) return []
  const totals = new Map<string, { guid: string; name: string; cost: number; currency: string }>()
  rows.forEach(row => {
    const ex = totals.get(row.subaccountId)
    if (ex) { ex.cost += row.cost ?? 0 }
    else totals.set(row.subaccountId, { guid: row.subaccountId, name: row.subaccountName || row.subaccountId, cost: row.cost ?? 0, currency: row.currency ?? 'EUR' })
  })
  return Array.from(totals.values()).sort((a, b) => b.cost - a.cost).slice(0, 15)
})

const subCostsChartData = computed(() => {
  const sorted = subCostsSorted.value
  if (!sorted.length) return { labels: [], datasets: [] }
  return {
    labels: sorted.map(item => item.name),
    datasets: [{ label: `Cost (${sorted[0]?.currency ?? 'EUR'})`, backgroundColor: '#10b981', data: sorted.map(item => item.cost) }],
  }
})

async function onSubCostsBarClick(_event: ChartEvent, elements: ActiveElement[]) {
  const first = elements[0]
  if (!first) return
  const item = subCostsSorted.value[first.index]
  if (!item) return
  selectedSubaccountGuid.value = item.guid
  await nextTick()
  subaccountSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const subCostsChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  onClick: onSubCostsBarClick,
  onHover: (_event: ChartEvent, elements: ActiveElement[]) => {
    const canvas = (_event.native?.target as HTMLElement)
    if (canvas) canvas.style.cursor = elements.length ? 'pointer' : 'default'
  },
}

// Top 10 services by cost — pie chart (cost > 0, global month)
const topServicesPieData = computed(() => {
  const rows = (subCosts.value?.content ?? []).filter(r => (r.cost ?? 0) > 0)
  if (!rows.length) return { labels: [], datasets: [] }
  const byService = new Map<string, number>()
  rows.forEach(r => { const k = r.serviceName ?? 'Unknown'; byService.set(k, (byService.get(k) ?? 0) + (r.cost ?? 0)) })
  const sorted = Array.from(byService.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  return {
    labels: sorted.map(([name]) => name),
    datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: PIE_COLORS.slice(0, sorted.length) }],
  }
})

const subCostCurrency = computed(() => subCosts.value?.content?.find(r => r.currency)?.currency ?? 'EUR')

// ── Subaccount drill-down data ─────────────────────────────────────────────

const subRangeFiltered = computed(() => {
  if (!selectedSubaccountGuid.value || !subCostsRange.value?.content) return []
  return subCostsRange.value.content.filter(r => r.subaccountId === selectedSubaccountGuid.value && (r.cost ?? 0) > 0)
})

const subaccountTrendData = computed(() => {
  const rows = subRangeFiltered.value
  if (!rows.length) return { labels: [], datasets: [] }
  const byMonth = new Map<number, number>()
  rows.forEach(r => { if (r.reportYearMonth) byMonth.set(r.reportYearMonth, (byMonth.get(r.reportYearMonth) ?? 0) + (r.cost ?? 0)) })
  const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0] - b[0])
  const currency = rows.find(r => r.currency)?.currency ?? 'EUR'
  return {
    labels: sorted.map(([ym]) => `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}`),
    datasets: [{ label: `Cost (${currency})`, backgroundColor: '#3b82f6', data: sorted.map(([, v]) => v) }],
  }
})

// All cost-generating services for the selected subaccount — no slice limit
const subaccountServiceList = computed(() => {
  const rows = subRangeFiltered.value
  if (!rows.length) return []
  const byService = new Map<string, number>()
  rows.forEach(r => { const k = r.serviceName ?? 'Unknown'; byService.set(k, (byService.get(k) ?? 0) + (r.cost ?? 0)) })
  return Array.from(byService.entries()).sort((a, b) => b[1] - a[1])
})

const rangeCurrency = computed(() => subRangeFiltered.value.find(r => r.currency)?.currency ?? 'EUR')
const rangeTotalCost = computed(() => subaccountServiceList.value.reduce((s, [, v]) => s + v, 0))

// Top 10 directory services by usage
const directoryTopServices = computed(() => {
  const rows = directoryUsage.value?.content
  if (!rows?.length) return []
  const totals = new Map<string, number>()
  rows.forEach(row => totals.set(row.serviceName, (totals.get(row.serviceName) ?? 0) + (row.usage ?? 0)))
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
})

// ── Budgets ────────────────────────────────────────────────────────────────

const { data: budgetsResponse, isLoading: budgetsLoading } = useBudgets(accountId)
const budgetsList = computed(() => budgetsResponse.value?.value ?? [])

// Map subaccount GUID → display name for scope resolution
const subaccountNameMap = computed(() => {
  const map = new Map<string, string>()
  ;(subaccounts.value ?? []).forEach(sa => map.set(sa.guid, sa.displayName))
  return map
})

// For each budget: compute utilization from the current month's costs if scope matches a subaccount
const budgetsWithUtilization = computed(() => {
  const costs = subCosts.value?.content ?? []
  return budgetsList.value.map(b => {
    if (b.budgetType !== 'COST' || !b.amount) return { ...b, utilization: null }
    let spent = 0
    if (b.scope?.length) {
      const subGuids = new Set(
        b.scope.filter(s => s.scopeType === 'SUBACCOUNT_GUID').map(s => s.value)
      )
      if (subGuids.size > 0) {
        spent = costs
          .filter(r => subGuids.has(r.subaccountId))
          .reduce((s, r) => s + (r.cost ?? 0), 0)
      } else {
        // Scope is product-based or unknown — sum all costs as proxy
        spent = costs.reduce((s, r) => s + (r.cost ?? 0), 0)
      }
    } else {
      // No scope = global account level — sum all costs
      spent = costs.reduce((s, r) => s + (r.cost ?? 0), 0)
    }
    return { ...b, utilization: spent }
  })
})

const chartOptions = { responsive: true, maintainAspectRatio: false }
const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'right' as const } },
}

const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
</script>

<template>
  <div class="page-root">
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Consumption & Costs</h2>
        <p class="text-xs text-muted-foreground">Cloud credits, monthly cost distribution, and subaccount drill-down</p>
      </div>
      <template v-if="btpAccount.selectedAccountId">
        <Select v-model="selectedYear">
          <SelectTrigger class="h-8 w-[90px] text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="y in years" :key="y" :value="y">{{ y }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="selectedMonth">
          <SelectTrigger class="h-8 w-[80px] text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m in months" :key="m" :value="m">{{ m }}</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </div>

    <div class="page-content space-y-6">

    <div v-if="!btpAccount.selectedAccountId" class="flex h-[400px] items-center justify-center rounded-md border border-dashed">
      <div class="text-center">
        <h3 class="text-lg font-semibold">No Account Selected</h3>
        <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar to view its consumption data.</p>
      </div>
    </div>

    <div v-else class="space-y-6">

      <!-- Main 2-column layout: Credits/Runway left, Charts right -->
      <div class="grid gap-4 lg:grid-cols-3 items-start">

        <!-- Left column: Cloud Credits + Runway stacked -->
        <div class="flex flex-col gap-4">

        <!-- Cloud Credits (with scrollable phase breakdown) -->
        <Card>
          <CardHeader>
            <CardTitle>Cloud Credits Balance</CardTitle>
            <CardDescription>Overall contract and phase status</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="creditsLoading" class="space-y-2">
              <Skeleton class="h-8 w-24" />
              <Skeleton class="h-4 w-48" />
              <Skeleton class="h-4 w-32" />
            </div>
            <template v-else-if="allContracts.length">
              <!-- Headline: balance from the active contract's active phase -->
              <div class="text-3xl font-bold">
                {{ latestUpdate(activePhase!)?.balance?.toLocaleString() ?? '—' }}
                <span class="text-base font-normal text-muted-foreground ml-1">{{ activeContract?.currency }}</span>
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                {{ headlineIsActive ? 'Available balance (current phase)' : 'Balance at contract end' }}
              </p>

              <!-- All contracts — scrollable so height stays controlled -->
              <div class="mt-4 max-h-[340px] overflow-y-auto space-y-4 pr-1">
                <div
                  v-for="(c, ci) in allContracts"
                  :key="ci"
                  class="rounded-md border overflow-hidden"
                  :class="contractStatus(c) === 'active' ? 'border-primary/30' : contractStatus(c) === 'expired' ? 'opacity-60' : ''"
                >
                  <!-- Contract header -->
                  <div
                    class="flex items-center justify-between px-3 py-2"
                    :class="contractStatus(c) === 'active' ? 'bg-primary/5' : 'bg-muted/50'"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-semibold">Contract {{ ci + 1 }}</span>
                      <span
                        class="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                        :class="contractStatus(c) === 'active'
                          ? 'bg-success/15 text-success border-success/30'
                          : contractStatus(c) === 'upcoming'
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground'"
                      >{{ contractStatus(c).toUpperCase() }}</span>
                    </div>
                    <span class="text-[10px] text-muted-foreground">
                      {{ new Date(c.contractStartDate).toLocaleDateString() }} –
                      {{ new Date(c.contractEndDate).toLocaleDateString() }}
                    </span>
                  </div>

                  <!-- Phases within this contract -->
                  <div class="divide-y divide-border">
                    <div
                      v-for="(phase, pi) in c.phases"
                      :key="pi"
                      class="px-3 py-2.5 space-y-2"
                      :class="phaseStatus(phase) === 'active' ? 'bg-primary/5' : ''"
                    >
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-medium">Phase {{ pi + 1 }}</span>
                          <span
                            class="text-[9px] font-bold px-1 py-0.5 rounded border"
                            :class="phaseStatus(phase) === 'active'
                              ? 'bg-success/15 text-success border-success/30'
                              : phaseStatus(phase) === 'upcoming'
                              ? 'bg-primary/15 text-primary border-primary/30'
                              : 'bg-muted text-muted-foreground'"
                          >{{ phaseStatus(phase).toUpperCase() }}</span>
                        </div>
                        <span class="text-[10px] text-muted-foreground">
                          {{ new Date(phase.phaseStartDate).toLocaleDateString() }} –
                          {{ new Date(phase.phaseEndDate).toLocaleDateString() }}
                        </span>
                      </div>
                      <template v-if="latestUpdate(phase)">
                        <div class="w-full bg-muted rounded-full h-1">
                          <div
                            class="bg-primary h-1 rounded-full"
                            :style="{ width: `${phaseConsumedPct(phase)}%` }"
                          />
                        </div>
                        <div class="grid grid-cols-3 text-[10px]">
                          <div>
                            <p class="font-semibold text-foreground">{{ latestUpdate(phase)!.cloudCreditsForPhase.toLocaleString() }}</p>
                            <p class="text-muted-foreground">Total</p>
                          </div>
                          <div class="text-center">
                            <p class="font-semibold text-foreground">{{ (latestUpdate(phase)!.cloudCreditsForPhase - latestUpdate(phase)!.balance).toLocaleString() }}</p>
                            <p class="text-muted-foreground">Consumed</p>
                          </div>
                          <div class="text-right">
                            <p class="font-semibold text-foreground">{{ latestUpdate(phase)!.balance.toLocaleString() }}</p>
                            <p class="text-muted-foreground">Remaining</p>
                          </div>
                        </div>
                        <p v-if="phaseStatus(phase) === 'expired'" class="text-[10px] text-muted-foreground italic">
                          Final recorded balance — phase expired.
                        </p>
                        <p v-else-if="phaseStatus(phase) === 'upcoming'" class="text-[10px] text-muted-foreground italic">
                          Credits available from {{ new Date(phase.phaseStartDate).toLocaleDateString() }}.
                        </p>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="text-sm text-muted-foreground">
              No cloud credits data found or account uses Pay-As-You-Go.
            </div>
          </CardContent>
        </Card>

        <!-- Credit Runway card -->
        <Card v-if="allContracts.length">
          <CardHeader class="pb-2">
            <div class="flex items-center gap-2">
              <TrendingDown class="h-4 w-4 text-muted-foreground" />
              <CardTitle class="text-sm">Credit Runway</CardTitle>
            </div>
            <CardDescription class="text-xs">Projected depletion based on last {{ burnRate?.monthsWithData ?? 3 }} months spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="burnRate">
              <div class="text-2xl font-bold">
                {{ burnRate.projectedDepletionDate ?? '—' }}
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Avg {{ burnRate.avgMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 }) }} {{ burnRate.currency }} / mo
                · {{ burnRate.monthsWithData }} month{{ burnRate.monthsWithData !== 1 ? 's' : '' }} of data
              </p>
              <div class="mt-3 space-y-1">
                <div class="flex justify-between text-[11px] text-muted-foreground">
                  <span>Phase elapsed</span>
                  <span>{{ burnRate.phaseProgressPct }}%</span>
                </div>
                <div class="w-full bg-muted rounded-full h-1.5">
                  <div
                    class="h-1.5 rounded-full"
                    :class="burnRate.phaseProgressPct > 80 ? 'bg-destructive' : burnRate.phaseProgressPct > 60 ? 'bg-amber-500' : 'bg-primary'"
                    :style="{ width: `${burnRate.phaseProgressPct}%` }"
                  />
                </div>
              </div>
              <p v-if="burnRate.balance !== null" class="text-[11px] text-muted-foreground mt-2">
                Balance: <span class="font-mono font-medium text-foreground">{{ burnRate.balance.toLocaleString() }} {{ burnRate.currency }}</span>
              </p>
            </div>
            <p v-else class="text-sm text-muted-foreground">
              Not enough cost data to compute runway.
            </p>
          </CardContent>
        </Card>

        </div><!-- end left column -->

        <!-- Right column: both charts stacked -->
        <div class="lg:col-span-2 flex flex-col gap-4">

          <!-- Top Subaccounts by Cost — click a bar to drill down -->
          <Card>
            <CardHeader>
              <CardTitle>Top Subaccounts by Cost</CardTitle>
              <CardDescription>{{ selectedYear }}-{{ selectedMonth }} · Click a bar to drill down below</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="costsLoading" class="h-[240px] flex items-center justify-center">
                <Skeleton class="h-full w-full" />
              </div>
              <div v-else-if="subCostsSorted.length" class="h-[240px] relative">
                <Bar :data="subCostsChartData" :options="subCostsChartOptions" />
              </div>
              <div v-else class="h-[240px] flex items-center justify-center text-muted-foreground">
                No cost data for this period.
              </div>
            </CardContent>
          </Card>

          <!-- Top Services by Cost — Pie Chart -->
          <Card>
            <CardHeader>
              <CardTitle>Top Services by Cost</CardTitle>
              <CardDescription>
                Top 10 cost-generating services for {{ selectedYear }}-{{ selectedMonth }} ({{ subCostCurrency }})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="costsLoading" class="h-[260px] flex items-center justify-center">
                <Skeleton class="h-full w-full" />
              </div>
              <div v-else-if="topServicesPieData.labels?.length" class="h-[260px] relative">
                <Pie :data="topServicesPieData" :options="pieOptions" />
              </div>
              <div v-else class="h-[260px] flex items-center justify-center text-muted-foreground">
                No cost-generating services found for this period.
              </div>
            </CardContent>
          </Card>

        </div><!-- end right column -->
      </div>

      <!-- Subaccount Consumption Section -->
      <Card ref="subaccountSectionRef">
        <CardHeader>
          <CardTitle>Subaccount Consumption</CardTitle>
          <CardDescription>Historical cost trend and full service breakdown for a specific subaccount</CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Label filter chips -->
          <div v-if="availableLabelChips.length" class="flex flex-wrap items-center gap-1.5 mb-3">
            <span class="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mr-1">Filter by label:</span>
            <button
              v-for="chip in availableLabelChips"
              :key="chip"
              type="button"
              class="px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
              :class="selectedLabelChips.includes(chip)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'"
              @click="toggleLabelChip(chip)"
            >
              {{ chip }}
            </button>
            <button
              v-if="selectedLabelChips.length"
              type="button"
              class="px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              @click="selectedLabelChips = []"
            >
              Clear
            </button>
          </div>

          <!-- Filters row -->
          <div class="flex flex-wrap items-center gap-3 mb-6">

            <!-- Searchable subaccount combobox -->
            <div class="relative" ref="comboboxWrapperRef">
              <div class="relative w-[280px]">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  v-model="subaccountSearch"
                  placeholder="Search subaccount..."
                  class="pl-8 pr-8"
                  @focus="comboboxOpen = true"
                  @input="comboboxOpen = true"
                  autocomplete="off"
                />
                <button
                  v-if="selectedSubaccountGuid"
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  @click="clearSubaccountSelection"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>

              <!-- Dropdown list -->
              <div
                v-if="comboboxOpen && filteredSubaccounts.length"
                class="absolute top-full mt-1 z-50 w-full max-h-52 overflow-auto rounded-md border bg-popover shadow-md"
              >
                <div
                  v-for="sa in filteredSubaccounts"
                  :key="sa.guid"
                  class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                  :class="sa.guid === selectedSubaccountGuid ? 'bg-accent text-accent-foreground' : ''"
                  @mousedown.prevent="selectSubaccount(sa.guid, sa.displayName)"
                >
                  <span class="truncate flex-1">{{ sa.displayName }}</span>
                  <span class="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">{{ sa.region ?? '' }}</span>
                </div>
                <div
                  v-if="subaccountSearch && filteredSubaccounts.length === 0"
                  class="px-3 py-4 text-sm text-muted-foreground text-center"
                >
                  No subaccounts match "{{ subaccountSearch }}"
                </div>
              </div>
            </div>

            <span class="text-sm text-muted-foreground">From</span>
            <Select v-model="subFromYear">
              <SelectTrigger class="w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="y in years" :key="y" :value="y">{{ y }}</SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="subFromMonth">
              <SelectTrigger class="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in months" :key="m" :value="m">{{ m }}</SelectItem>
              </SelectContent>
            </Select>

            <span class="text-sm text-muted-foreground">To</span>
            <Select v-model="subToYear">
              <SelectTrigger class="w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="y in years" :key="y" :value="y">{{ y }}</SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="subToMonth">
              <SelectTrigger class="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in months" :key="m" :value="m">{{ m }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- No subaccount selected -->
          <div v-if="!selectedSubaccountGuid" class="flex flex-col items-center gap-3 rounded-md border border-dashed py-10 text-center">
            <Info class="h-8 w-8 text-muted-foreground opacity-40" />
            <p class="text-sm text-muted-foreground">Search and select a subaccount above, or click a bar in the chart.</p>
          </div>

          <!-- Loading -->
          <div v-else-if="rangeLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton class="h-[250px]" />
            <Skeleton class="h-[300px]" />
          </div>

          <!-- Charts + service table -->
          <div v-else-if="subRangeFiltered.length" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Monthly cost trend -->
            <div>
              <p class="text-sm font-medium mb-3">Monthly Cost Trend</p>
              <div class="h-[250px] relative">
                <Bar :data="subaccountTrendData" :options="chartOptions" />
              </div>
            </div>

            <!-- All services with cost — scrollable table -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-medium">
                  All Cost-Generating Services
                  <span class="ml-1.5 text-xs text-muted-foreground">({{ subaccountServiceList.length }})</span>
                </p>
                <span class="text-xs text-muted-foreground font-mono">
                  Total: {{ rangeTotalCost.toLocaleString(undefined, { maximumFractionDigits: 2 }) }} {{ rangeCurrency }}
                </span>
              </div>
              <div class="max-h-[250px] overflow-y-auto rounded-md border">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 bg-muted border-b">
                    <tr>
                      <th class="text-left px-3 py-2 font-medium text-muted-foreground">Service</th>
                      <th class="text-right px-3 py-2 font-medium text-muted-foreground">Cost ({{ rangeCurrency }})</th>
                      <th class="text-right px-3 py-2 font-medium text-muted-foreground w-16">%</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr
                      v-for="[name, cost] in subaccountServiceList"
                      :key="name"
                      class="hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 truncate max-w-[200px]" :title="name">{{ name }}</td>
                      <td class="px-3 py-2 text-right font-mono">
                        {{ cost.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                      </td>
                      <td class="px-3 py-2 text-right text-muted-foreground">
                        {{ rangeTotalCost > 0 ? ((cost / rangeTotalCost) * 100).toFixed(1) : '0.0' }}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- No data for selection/range -->
          <div v-else class="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <p class="text-sm">No cost-generating data found for this subaccount in the selected range.</p>
          </div>
        </CardContent>
      </Card>

      <!-- Budget Overview -->
      <Card>
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
          <CardDescription>Budgets and alert thresholds configured in the BTP cockpit</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="budgetsLoading" class="space-y-2">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </div>

          <div v-else-if="budgetsList.length === 0" class="flex flex-col items-center gap-3 rounded-md border border-dashed py-8 text-center">
            <BellOff class="h-8 w-8 text-muted-foreground opacity-40" />
            <div>
              <p class="text-sm font-medium">No budgets configured</p>
              <p class="text-xs text-muted-foreground mt-1">
                Set up budgets and alerts in the SAP BTP cockpit under
                <span class="font-mono">Global Account → Budgets</span>.
              </p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="budget in budgetsWithUtilization"
              :key="budget.guid"
              class="rounded-md border overflow-hidden"
            >
              <!-- Budget header row -->
              <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
                <div class="flex items-center gap-2 min-w-0">
                  <Bell class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span class="font-medium text-sm truncate">{{ budget.displayName }}</span>
                  <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border text-muted-foreground shrink-0">
                    {{ budget.budgetType }}
                  </span>
                  <span v-if="budget.budgetPeriodInterval" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border text-muted-foreground shrink-0">
                    {{ budget.budgetPeriodInterval }}
                  </span>
                </div>
                <div class="text-right shrink-0 ml-4">
                  <span class="text-sm font-bold font-mono">
                    {{ budget.amount.toLocaleString() }}
                    <span class="text-xs font-normal text-muted-foreground">{{ budget.currency ?? '' }}</span>
                  </span>
                </div>
              </div>

              <!-- Utilization bar (COST budgets only, when we have cost data) -->
              <div v-if="budget.utilization !== null && budget.amount > 0" class="px-4 py-2 border-t border-border/50">
                <div class="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>This month's spend</span>
                  <span class="font-mono">
                    {{ budget.utilization.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                    / {{ budget.amount.toLocaleString() }} {{ budget.currency ?? '' }}
                    ({{ ((budget.utilization / budget.amount) * 100).toFixed(1) }}%)
                  </span>
                </div>
                <div class="w-full bg-muted rounded-full h-1.5">
                  <div
                    class="h-1.5 rounded-full transition-all"
                    :class="(budget.utilization / budget.amount) >= 1
                      ? 'bg-destructive'
                      : (budget.utilization / budget.amount) >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-primary'"
                    :style="{ width: `${Math.min(100, (budget.utilization / budget.amount) * 100).toFixed(1)}%` }"
                  />
                </div>
              </div>

              <!-- Alert thresholds + scope -->
              <div class="px-4 py-2.5 border-t border-border/50 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <!-- Alert thresholds -->
                <div v-if="budget.alertThresholds?.length" class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-medium text-foreground">Alerts:</span>
                  <span
                    v-for="t in budget.alertThresholds"
                    :key="t.guid"
                    class="px-1.5 py-0.5 rounded border font-mono text-[10px]"
                    :class="t.disabled
                      ? 'bg-muted text-muted-foreground border-muted-foreground/20 line-through'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/30'"
                  >
                    {{ t.thresholdValue }}{{ t.thresholdValueType === 'PERCENTAGE' ? '%' : ` ${budget.currency ?? ''}` }}
                  </span>
                </div>
                <span v-else class="italic">No alert thresholds defined</span>

                <!-- Scope -->
                <div v-if="budget.scope?.length" class="flex items-start gap-1.5 flex-wrap">
                  <span class="font-medium text-foreground shrink-0">Scope:</span>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="s in budget.scope.slice(0, 5)"
                      :key="s.value"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-muted text-[10px] max-w-[220px]"
                      :title="`${s.scopeType}: ${s.value}`"
                    >
                      <span class="text-muted-foreground shrink-0 uppercase tracking-wide" style="font-size:9px">
                        {{ s.scopeType === 'SUBACCOUNT_GUID' ? 'SA' : 'Product' }}
                      </span>
                      <span class="truncate font-medium">
                        {{ s.scopeType === 'SUBACCOUNT_GUID'
                          ? (subaccountNameMap.get(s.value) ?? s.value)
                          : s.value }}
                      </span>
                    </span>
                    <span v-if="budget.scope.length > 5" class="text-[10px] text-muted-foreground self-center">
                      +{{ budget.scope.length - 5 }} more
                    </span>
                  </div>
                </div>
                <span v-else class="text-[10px] italic">Global account scope</span>

                <!-- Dates -->
                <div class="ml-auto text-[10px] text-muted-foreground">
                  {{ new Date(budget.startDate).toLocaleDateString() }}
                  <template v-if="budget.endDate"> – {{ new Date(budget.endDate).toLocaleDateString() }}</template>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Directory Usage -->
      <Card>
        <CardHeader>
          <CardTitle>Directory Usage</CardTitle>
          <CardDescription>Usage data from a directory-scoped UDM service instance</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="directoryLoading" class="space-y-2">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </div>

          <!-- No credential configured (404) -->
          <div v-else-if="directoryErrorStatus === 404" class="flex flex-col items-center gap-3 rounded-md border border-dashed py-8 px-6 text-center">
            <Info class="h-8 w-8 text-muted-foreground" />
            <div>
              <p class="text-sm font-medium">Directory-scoped usage not configured</p>
              <p class="text-xs text-muted-foreground mt-1 max-w-md">
                This account does not have a <code class="font-mono">UDM_DIRECTORY</code> credential set.
                To enable directory-level consumption data, add a credential of this type in the account settings.
              </p>
            </div>
            <div class="rounded-md bg-muted px-4 py-3 text-left text-xs space-y-1 max-w-md w-full">
              <p class="font-medium text-muted-foreground">SAP BTP setup required:</p>
              <ol class="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Enable IAM on the target directory (Edit → "Use for authorization")</li>
                <li>Create a UAS service instance at directory level (plan: <code class="font-mono">reporting-directory-ga</code>)</li>
                <li>Generate a service key and add it here as a <code class="font-mono">UDM_DIRECTORY</code> credential</li>
              </ol>
            </div>
          </div>

          <!-- Other error -->
          <div v-else-if="directoryError" class="flex flex-col items-center gap-3 rounded-md border border-dashed border-amber-200 py-8 px-6 text-center">
            <AlertTriangle class="h-8 w-8 text-amber-500" />
            <div>
              <p class="text-sm font-medium">Could not load directory usage</p>
              <p class="text-xs text-muted-foreground mt-1">
                The <code class="font-mono">UDM_DIRECTORY</code> credential may lack the
                <code class="font-mono">reporting.Directory_Admin</code> scope, or the directory's
                IAM is not enabled. Check the service key and directory configuration in the BTP cockpit.
              </p>
            </div>
          </div>

          <!-- Data available -->
          <div v-else-if="directoryTopServices.length" class="space-y-2">
            <p class="text-xs text-muted-foreground mb-3">Top services by usage quantity for {{ selectedYear }}-{{ selectedMonth }}</p>
            <div
              v-for="[name, usage] in directoryTopServices"
              :key="name"
              class="flex items-center justify-between text-sm py-1 border-b last:border-0"
            >
              <span class="truncate max-w-[70%]">{{ name }}</span>
              <span class="font-mono text-xs text-muted-foreground">{{ usage.toLocaleString() }}</span>
            </div>
          </div>

          <!-- No data -->
          <div v-else class="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No directory usage data for this period.
          </div>
        </CardContent>
      </Card>
    </div>
    </div><!-- end page-content -->
  </div><!-- end page-root -->
</template>
