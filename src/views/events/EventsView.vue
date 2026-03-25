<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useEvents, useEventTypes } from '@/composables/useEvents'
import { useSubaccounts } from '@/composables/useAccountsBtp'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarClock, CheckCircle2, XCircle, Info, Search, Filter, X } from 'lucide-vue-next'
import type { EventRecord, EventsFilter } from '@/api/types'
import EventDetailDialog from '@/components/events/EventDetailDialog.vue'
import { filterEventsByDate } from '@/utils/filterEventsByDate'

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

const { data: eventTypesData } = useEventTypes(accountId)

const eventTypesList = computed(() => {
  if (!eventTypesData.value) return []
  return Object.values(eventTypesData.value)
})

// Filters
const selectedType = ref<string>('all')
// Displayed in the inputs — not sent to the API until the user clicks Apply
const fromDate = ref<string>('')
const toDate = ref<string>('')
const pageSize = 50

// Committed values — only updated on Apply click, these drive the actual query
const appliedFromDate = ref<string>('')
const appliedToDate = ref<string>('')

const hasDateFilter = computed(() => !!(appliedFromDate.value || appliedToDate.value))
const isPendingApply = computed(
  () => fromDate.value !== appliedFromDate.value || toDate.value !== appliedToDate.value,
)

function applyDateFilter() {
  appliedFromDate.value = fromDate.value
  appliedToDate.value = toDate.value
  currentPage.value = 1
}

function clearDateFilter() {
  fromDate.value = ''
  toDate.value = ''
  appliedFromDate.value = ''
  appliedToDate.value = ''
  currentPage.value = 1
}

// Pagination — reset to page 1 whenever any filter changes
const currentPage = ref(1)
watch([selectedType, appliedFromDate, appliedToDate], () => { currentPage.value = 1 })

const selectedEvent = ref<EventRecord | null>(null)

const filters = computed<EventsFilter>(() => {
  const f: EventsFilter = { pageSize, page: currentPage.value }
  if (selectedType.value !== 'all') f.eventType = selectedType.value
  // Send dates to SAP as full ISO-8601 timestamps so it filters server-side.
  // Pagination then works on the filtered result set — all matching events are reachable.
  if (appliedFromDate.value) f.fromTime = `${appliedFromDate.value}T00:00:00.000Z`
  if (appliedToDate.value) f.toTime = `${appliedToDate.value}T23:59:59.999Z`
  return f
})

const { data: eventsResponse, isLoading } = useEvents(accountId, filters)

// Client-side date filter using the tested pure utility function.
const filteredEvents = computed(() =>
  filterEventsByDate(
    eventsResponse.value?.events ?? [],
    appliedFromDate.value,
    appliedToDate.value,
  ),
)

// Subaccount name lookup: maps guid → displayName for enriching event entity labels.
// For entitlement events (e.g. SubaccountEntitlements_Update) the top-level entityId
// may be the global account GUID; the actual subaccount GUID lives in details.entityId.
const { data: subaccounts } = useSubaccounts(accountId)
const subaccountMap = computed((): Record<string, string> => {
  const map: Record<string, string> = {}
  subaccounts.value?.forEach(sa => { map[sa.guid] = sa.displayName })
  return map
})
function subaccountName(event: EventRecord): string | null {
  return subaccountMap.value[event.entityId]
    ?? subaccountMap.value[event.details?.entityId as string]
    ?? null
}

const getEventIcon = (eventType: string) => {
  if (!eventType) return Info;
  if (eventType.includes('Create') || eventType.includes('Add')) return CheckCircle2;
  if (eventType.includes('Delete') || eventType.includes('Remove')) return XCircle;
  return Info;
}

const getEventColor = (eventType: string) => {
  if (!eventType) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  if (eventType.includes('error') || eventType.includes('Delete') || eventType.includes('Remove')) return 'text-destructive bg-destructive/10 border-destructive/20';
  if (eventType.includes('Create') || eventType.includes('Add') || eventType.includes('Success')) return 'text-green-500 bg-green-500/10 border-green-500/20';
  return 'text-muted-foreground bg-muted border-muted-foreground/20';
}

const formatDetailList = (assignments: any) => {
  if (!assignments) return '';
  
  let parsed = assignments;
  if (typeof assignments === 'string') {
    try {
      parsed = JSON.parse(assignments);
    } catch (e) {
      return assignments;
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map(a => typeof a === 'object' ? a?.name || a?.displayName || a?.servicePlanName || JSON.stringify(a) : a).join(', ');
  }
  
  if (typeof parsed === 'object') {
    const plans = [];
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'object' && val !== null) {
        let text = (val as any).servicePlanName || key;
        
        let amountAdded = 0;
        let amountRemoved = 0;
        
        if ((val as any).increased && typeof (val as any).increased === 'object') {
          Object.values((val as any).increased).forEach((inc: any) => {
            if (inc && typeof inc.amount === 'number') amountAdded += inc.amount;
          });
        }
        
        if ((val as any).decreased && typeof (val as any).decreased === 'object') {
          Object.values((val as any).decreased).forEach((dec: any) => {
            if (dec && typeof dec.amount === 'number') amountRemoved += dec.amount;
          });
        }
        
        if (amountAdded > 0) text += ` (+${amountAdded})`;
        if (amountRemoved > 0) text += ` (-${amountRemoved})`;
        
        plans.push(text);
      }
    }
    return plans.length > 0 ? plans.join(', ') : JSON.stringify(parsed);
  }

  return String(parsed);
}
</script>

<template>
  <div class="page-root">
    <!-- Sticky filter bar -->
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Administrative Events</h2>
        <p class="text-xs text-muted-foreground">Platform events for your global account and subaccounts</p>
      </div>

      <template v-if="accountId">
        <!-- Date range — committed only on Apply click -->
        <div class="flex items-center gap-1.5">
          <input
            type="date"
            v-model="fromDate"
            class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
            title="From Date"
          />
          <span class="text-muted-foreground text-xs">–</span>
          <input
            type="date"
            v-model="toDate"
            class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
            title="To Date"
          />
          <Button
            size="sm"
            variant="default"
            class="h-8 gap-1 text-xs px-2.5"
            :class="isPendingApply ? 'ring-1 ring-primary' : ''"
            @click="applyDateFilter"
          >
            <Filter class="h-3 w-3" />
            Apply
          </Button>
          <Button
            v-if="hasDateFilter"
            size="sm"
            variant="ghost"
            class="h-8 w-8 p-0"
            title="Clear date filter"
            @click="clearDateFilter"
          >
            <X class="h-3.5 w-3.5" />
          </Button>
        </div>

        <Select v-model="selectedType">
          <SelectTrigger class="h-8 text-xs w-56">
            <SelectValue placeholder="All Event Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            <SelectItem v-for="t in eventTypesList" :key="t.type" :value="t.type">
              [{{ t.category }}] {{ t.type }} {{ t.description ? `- ${t.description}` : '' }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
    </div>

    <div class="page-content">

    <!-- Active date filter summary -->
    <div v-if="hasDateFilter" class="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <Filter class="h-3 w-3 shrink-0" />
      <span>
        Date filter
        <span class="font-medium text-foreground">{{ appliedFromDate || '…' }}</span>
        →
        <span class="font-medium text-foreground">{{ appliedToDate || '…' }}</span>
        <template v-if="eventsResponse">
          ·
          <span class="font-medium text-foreground">{{ eventsResponse.total }}</span>
          matching events
        </template>
      </span>
      <button class="hover:text-foreground underline underline-offset-2 shrink-0" @click="clearDateFilter">clear</button>
    </div>

    <div v-if="!accountId" class="flex h-[400px] items-center justify-center rounded-md border border-dashed">
      <div class="text-center">
        <h3 class="text-lg font-semibold">No Account Selected</h3>
        <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar.</p>
      </div>
    </div>
    
    <div v-else-if="isLoading" class="space-y-4">
      <Skeleton class="h-24 w-full" v-for="i in 5" :key="i" />
    </div>

    <div v-else-if="filteredEvents.length" class="space-y-4">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="flex gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:border-primary/50 cursor-pointer transition-all hover:bg-muted/50"
        @click="selectedEvent = event"
      >
        <!-- Icon -->
        <div 
          class="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border"
          :class="getEventColor(event.eventType)"
        >
          <component :is="getEventIcon(event.eventType)" class="h-5 w-5" />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate text-lg">{{ event.eventType }}</p>
              
              <!-- Dynamic Details Preview -->
              <div class="text-sm mt-1 space-y-1">
                <p v-if="event.details?.displayName" class="font-medium text-foreground">
                  {{ event.details.displayName }} 
                  <span v-if="event.details.region" class="text-muted-foreground font-normal">({{ event.details.region }})</span>
                </p>
                <p v-if="event.details?.description" class="text-muted-foreground line-clamp-1">{{ event.details.description }}</p>
                <div v-if="event.details?.labels && Object.keys(event.details.labels).length > 0" class="flex gap-1.5 flex-wrap mt-1">
                  <Badge variant="secondary" class="text-[10px]" v-for="(vals, key) in event.details.labels" :key="key">
                    {{ key }}: {{ (vals as string[]).join(', ') }}
                  </Badge>
                </div>
                <!-- Entitlement specific -->
                <p v-if="event.details?.servicePlanAssignments" class="text-muted-foreground text-xs mt-1 truncate" :title="formatDetailList(event.details.servicePlanAssignments)">
                  <span class="font-medium text-foreground">Plans:</span> {{ formatDetailList(event.details.servicePlanAssignments) }}
                </p>
                <!-- Reuse Service / App Subscriptions -->
                <p v-if="event.details?.appName" class="text-muted-foreground text-xs mt-1">
                  <span class="font-medium text-foreground">App Name:</span> {{ event.details.appName }}
                  <span v-if="event.details?.planName">({{ event.details.planName }})</span>
                </p>
              </div>

            </div>
            <div class="flex flex-col sm:items-end gap-1 flex-shrink-0 mt-2 sm:mt-0">
              <span class="text-xs text-muted-foreground flex items-center gap-1.5 whitespace-nowrap bg-muted px-2 py-1 rounded border">
                <CalendarClock class="h-3.5 w-3.5" />
                {{ new Date(event.actionTime).toLocaleString() }}
              </span>
              <div class="flex gap-2 items-center mt-2">
                <span class="text-[10px] text-muted-foreground leading-none">ORIGIN: {{ event.eventOrigin }}</span>
                <Badge variant="outline" class="text-[10px] font-mono leading-none">{{ event.entityType }}</Badge>
              </div>
            </div>
          </div>
          
          <div class="flex flex-wrap items-center gap-4 mt-4 text-xs">
            <div class="flex items-center gap-1.5 flex-wrap" v-if="event.entityId">
              <span class="text-muted-foreground">Target {{ event.entityType }}:</span>
              <span v-if="subaccountName(event)" class="font-medium text-foreground">
                {{ subaccountName(event) }}
              </span>
              <span class="font-mono text-muted-foreground">{{ event.entityId }}</span>
            </div>
            <div class="flex items-center gap-1.5" v-if="event.details?.user || event.details?.createdBy">
              <span class="text-muted-foreground">User:</span>
              <span class="text-muted-foreground font-medium">{{ event.details.user || event.details.createdBy }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex h-[300px] flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground">
      <Search class="h-10 w-10 mb-3 opacity-20" />
      <p v-if="hasDateFilter">
        No events found in the selected date range.
        <button class="ml-1 underline underline-offset-2 hover:text-foreground" @click="clearDateFilter">Clear filter</button>
      </p>
      <p v-else>No events found matching your criteria.</p>
    </div>

    <!-- Pagination -->
    <div
      v-if="eventsResponse && !isLoading"
      class="flex items-center justify-between mt-4 pt-4 border-t text-xs text-muted-foreground"
    >
      <span>
        Page
        <span class="font-medium text-foreground">{{ eventsResponse.pageNum }}</span>
        <template v-if="eventsResponse.totalPages > 0">
          of <span class="font-medium text-foreground">{{ eventsResponse.totalPages }}</span>
        </template>
        · <span class="font-medium text-foreground">{{ eventsResponse.total }}</span> total events
      </span>
      <div class="flex items-center gap-1">
        <Button
          size="sm" variant="outline" class="h-7 px-2 text-xs"
          :disabled="currentPage <= 1"
          title="First page"
          @click="currentPage = 1"
        >«</Button>
        <Button
          size="sm" variant="outline" class="h-7 px-2.5 text-xs"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >‹ Prev</Button>
        <span class="px-2 tabular-nums font-medium text-foreground">{{ currentPage }}</span>
        <Button
          size="sm" variant="outline" class="h-7 px-2.5 text-xs"
          :disabled="!eventsResponse.morePages"
          @click="currentPage++"
        >Next ›</Button>
        <Button
          size="sm" variant="outline" class="h-7 px-2 text-xs"
          :disabled="!eventsResponse.morePages"
          title="Last page"
          @click="currentPage = eventsResponse.totalPages"
        >»</Button>
      </div>
    </div>

    </div><!-- end page-content -->

    <EventDetailDialog
      :event="selectedEvent"
      :subaccountMap="subaccountMap"
      @close="selectedEvent = null"
    />
  </div><!-- end page-root -->
</template>
