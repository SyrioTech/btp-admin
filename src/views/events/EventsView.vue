<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useEvents, useEventTypes } from '@/composables/useEvents'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CalendarClock, CheckCircle2, XCircle, Info, Search } from 'lucide-vue-next'
import type { EventRecord } from '@/api/types'

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

const { data: eventTypesData } = useEventTypes(accountId)

const eventTypesList = computed(() => {
  if (!eventTypesData.value) return []
  return Object.values(eventTypesData.value)
})

// Filters
const selectedType = ref<string>('all')
const fromDate = ref<string>('')
const toDate = ref<string>('')
const limit = ref<number>(50)

const selectedEvent = ref<EventRecord | null>(null)

const filters = computed(() => {
  const f: any = { maxNumberOfEvents: limit.value }
  if (selectedType.value !== 'all') f.eventType = selectedType.value
  
  // Try to parse dates to Unix milliseconds strings as expected by the API
  if (fromDate.value) {
    const time = new Date(fromDate.value).getTime()
    if (!isNaN(time)) f.fromTime = time.toString()
  }
  if (toDate.value) {
    // Add 24h to include the entire end date selected
    const time = new Date(toDate.value).getTime() + (24 * 60 * 60 * 1000) - 1
    if (!isNaN(time)) f.toTime = time.toString()
  }
  
  return f
})

const { data: eventsResponse, isLoading } = useEvents(accountId, filters)

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

const parsePlanAssignments = (assignments: any) => {
  if (!assignments) return [];
  
  let parsed = assignments;
  if (typeof assignments === 'string') {
    try {
      parsed = JSON.parse(assignments);
    } catch (e) {
      return [{ raw: assignments }];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map(a => typeof a === 'object' ? a : { raw: String(a) });
  }
  
  if (typeof parsed === 'object') {
    const plans = [];
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'object' && val !== null) {
        plans.push({
          _id: key,
          ...val
        });
      } else {
        plans.push({ [key]: val });
      }
    }
    return plans;
  }

  return [{ raw: String(parsed) }];
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
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Administrative Events</h2>
        <p class="text-muted-foreground mt-1">Platform events for your global account and subaccounts.</p>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto" v-if="accountId">
        <Input 
          type="date" 
          v-model="fromDate"
          class="w-full sm:w-auto"
          title="From Date"
        />
        <span class="text-muted-foreground hidden sm:inline">-</span>
        <Input 
          type="date" 
          v-model="toDate"
          class="w-full sm:w-auto"
          title="To Date"
        />
        <Select v-model="selectedType">
          <SelectTrigger class="w-full sm:w-[320px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            <SelectItem v-for="t in eventTypesList" :key="t.type" :value="t.type">
              [{{ t.category }}] {{ t.type }} {{ t.description ? `- ${t.description}` : '' }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
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

    <div v-else-if="eventsResponse?.events.length" class="space-y-4">
      <div 
        v-for="event in eventsResponse.events" 
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
            <div class="flex items-center gap-1.5" v-if="event.entityId">
              <span class="text-muted-foreground">Target {{ event.entityType }}:</span>
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
      <p>No events found matching your criteria.</p>
    </div>

    <!-- Event Detail Dialog -->
    <Dialog :open="!!selectedEvent" @update:open="(val) => !val && (selectedEvent = null)">
      <DialogContent class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-xl">
            <component :is="getEventIcon(selectedEvent?.eventType || '')" class="h-6 w-6" :class="getEventColor(selectedEvent?.eventType || '')" />
            {{ selectedEvent?.eventType }}
          </DialogTitle>
          <DialogDescription class="hidden">Full details and JSON payload for the selected event.</DialogDescription>
        </DialogHeader>
        
        <div class="overflow-y-auto pr-2 mt-4 space-y-6" v-if="selectedEvent">
          <div class="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
            <div>
              <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Entity</p>
              <p class="font-medium">{{ selectedEvent.entityType }}</p>
              <p class="font-mono text-xs text-muted-foreground mt-1">{{ selectedEvent.entityId }}</p>
            </div>
            <div>
              <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Time</p>
              <p class="font-medium">{{ new Date(selectedEvent.actionTime).toLocaleString() }}</p>
              <p class="text-xs text-muted-foreground mt-1">Created: {{ new Date(selectedEvent.creationTime).toLocaleString() }}</p>
            </div>
          </div>

          <div v-if="selectedEvent.details?.servicePlanAssignments">
            <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
              Plan Assignments
            </h4>
            <div class="space-y-2 mb-6">
              <div 
                v-for="(plan, idx) in parsePlanAssignments(selectedEvent.details.servicePlanAssignments)" 
                :key="idx"
                class="rounded-md border bg-muted/40 overflow-hidden"
              >
                <div v-if="plan.raw" class="p-2 text-xs text-muted-foreground">{{ plan.raw }}</div>
                <table v-else class="w-full text-xs text-left">
                  <tbody class="divide-y divide-border">
                    <tr v-for="(v, k) in plan" :key="k" class="divide-x divide-border">
                      <td class="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 w-1/4 align-top">{{ k === '_id' ? 'ID' : k }}</td>
                      <td class="px-2 py-1.5 font-mono text-[10px] break-all align-top text-foreground bg-card">
                        <span v-if="typeof v === 'object' && v !== null && Object.keys(v).length === 0" class="text-muted-foreground italic">none</span>
                        <pre v-else-if="typeof v === 'object' && v !== null" class="whitespace-pre-wrap m-0 font-inherit">{{ JSON.stringify(v, null, 2) }}</pre>
                        <span v-else>{{ String(v) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
              Event Details Payload
            </h4>
            <div class="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              <pre>{{ JSON.stringify(selectedEvent.details, null, 2) }}</pre>
            </div>
          </div>
          
          <div class="text-xs text-muted-foreground flex justify-between border-t pt-4">
            <span><strong>Event ID:</strong> {{ selectedEvent.id }}</span>
            <span><strong>Global Account:</strong> {{ selectedEvent.globalAccountGUID }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
