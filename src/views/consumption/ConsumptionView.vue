<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useMonthlyUsage, useSubaccountCosts, useCloudCredits } from '@/composables/useConsumption'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const btpAccount = useBtpAccountStore()

// State for Date Selection
const currentYear = new Date().getFullYear()
const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0')

const selectedYear = ref(currentYear.toString())
const selectedMonth = ref(currentMonthStr)

const yearNum = computed(() => parseInt(selectedYear.value, 10))
const monthNum = computed(() => parseInt(selectedMonth.value, 10))

// Queries
const { data: credits, isLoading: creditsLoading } = useCloudCredits(computed(() => btpAccount.selectedAccountId))
const { data: monthlyUsage, isLoading: usageLoading } = useMonthlyUsage(computed(() => btpAccount.selectedAccountId), yearNum, monthNum)
const { data: subCosts, isLoading: costsLoading } = useSubaccountCosts(computed(() => btpAccount.selectedAccountId), yearNum, monthNum)

// Chart 1: Top Services — aggregate flat content[] by serviceName
const topServicesChartData = computed(() => {
  const rows = monthlyUsage.value?.content
  if (!rows?.length) return { labels: [], datasets: [] }

  const totals = new Map<string, number>()
  rows.forEach(row => {
    const key = row.serviceName
    totals.set(key, (totals.get(key) ?? 0) + (row.usage ?? 0))
  })

  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return {
    labels: sorted.map(([name]) => name),
    datasets: [{ label: 'Usage Quantity', backgroundColor: '#3b82f6', data: sorted.map(([, v]) => v) }],
  }
})

// Chart 2: Top Subaccounts by Cost — aggregate flat content[] by subaccountId
const subCostsChartData = computed(() => {
  const rows = subCosts.value?.content
  if (!rows?.length) return { labels: [], datasets: [] }

  const totals = new Map<string, { name: string; cost: number; currency: string }>()
  rows.forEach(row => {
    const existing = totals.get(row.subaccountId)
    if (existing) {
      existing.cost += row.cost ?? 0
    } else {
      totals.set(row.subaccountId, {
        name: row.subaccountName || row.subaccountId,
        cost: row.cost ?? 0,
        currency: row.currency ?? 'EUR',
      })
    }
  })

  const sorted = Array.from(totals.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15)

  return {
    labels: sorted.map(item => item.name),
    datasets: [{
      label: `Cost (${sorted[0]?.currency ?? 'EUR'})`,
      backgroundColor: '#10b981',
      data: sorted.map(item => item.cost),
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}

// Generate last 5 years
const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Consumption & Costs</h2>
        <p class="text-muted-foreground mt-1">Review cloud credits, monthly usage, and cost distribution.</p>
      </div>

      <div class="flex items-center gap-2" v-if="btpAccount.selectedAccountId">
        <Select v-model="selectedYear">
          <SelectTrigger class="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="y in years" :key="y" :value="y">{{ y }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="selectedMonth">
          <SelectTrigger class="w-[120px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m in months" :key="m" :value="m">{{ m }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    
    <div v-if="!btpAccount.selectedAccountId" class="flex h-[400px] items-center justify-center rounded-md border border-dashed">
      <div class="text-center">
        <h3 class="text-lg font-semibold">No Account Selected</h3>
        <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar to view its consumption data.</p>
      </div>
    </div>
    
    <div v-else class="space-y-6">
      <!-- Cloud Credits Section -->
      <div class="grid gap-4 md:grid-cols-3">
        <Card class="md:col-span-3 lg:col-span-1">
          <CardHeader>
            <CardTitle>Cloud Credits Balance</CardTitle>
            <CardDescription>Overall contract status</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="creditsLoading" class="space-y-2">
              <Skeleton class="h-8 w-24" />
              <Skeleton class="h-4 w-48" />
            </div>
            <div v-else-if="credits?.contracts?.[0]">
              <!-- Current balance lives in the latest phase's latest phaseUpdate -->
              <template v-if="credits?.contracts?.[0]?.phases?.length">
                <div class="text-3xl font-bold">
                  {{ credits?.contracts?.[0]?.phases?.slice(-1)?.[0]?.phaseUpdates?.slice(-1)?.[0]?.balance?.toLocaleString() ?? '—' }}
                  {{ credits?.contracts?.[0]?.currency }}
                </div>
                <p class="text-sm text-muted-foreground mt-1">
                  Phase total:
                  {{ credits?.contracts?.[0]?.phases?.slice(-1)?.[0]?.phaseUpdates?.slice(-1)?.[0]?.cloudCreditsForPhase?.toLocaleString() ?? '—' }}
                  {{ credits?.contracts?.[0]?.currency }}
                </p>
              </template>
              <div class="mt-4 text-xs text-muted-foreground space-y-1">
                <p>Started: {{ new Date(credits.contracts[0].contractStartDate).toLocaleDateString() }}</p>
                <p>Ends: {{ new Date(credits.contracts[0].contractEndDate).toLocaleDateString() }}</p>
              </div>
            </div>
            <div v-else class="text-sm text-muted-foreground">
              No cloud credits data found or account uses Pay-As-You-Go.
            </div>
          </CardContent>
        </Card>

        <!-- Subaccounts Costs Summary Card -->
        <Card class="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Subaccounts by Cost</CardTitle>
            <CardDescription>Filtering for {{ selectedYear }}-{{ selectedMonth }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="costsLoading" class="h-[200px] w-full flex items-center justify-center">
               <Skeleton class="h-full w-full" />
            </div>
            <div v-else-if="subCosts?.content?.length" class="h-[200px] w-full relative">
              <Bar :data="subCostsChartData" :options="chartOptions" />
            </div>
            <div v-else class="h-[200px] flex items-center justify-center text-muted-foreground">
              No cost data for this period.
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Top Services Usage -->
      <Card>
        <CardHeader>
          <CardTitle>Top Services Usage Quantity</CardTitle>
          <CardDescription>Aggregated usage units across all subaccounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="usageLoading" class="h-[300px] w-full flex items-center justify-center">
             <Skeleton class="h-full w-full" />
          </div>
          <div v-else-if="topServicesChartData.labels?.length" class="h-[300px] w-full relative">
            <Bar :data="topServicesChartData" :options="chartOptions" />
          </div>
          <div v-else class="h-[300px] flex items-center justify-center text-muted-foreground">
            No aggregated usage data for this period.
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
