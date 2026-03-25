<script setup lang="ts">
import type { EventRecord } from '@/api/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle, Info } from 'lucide-vue-next'

const props = defineProps<{
  event: EventRecord | null
  subaccountMap?: Record<string, string>
}>()

const emit = defineEmits<{ close: [] }>()

function getEventIcon(eventType: string) {
  if (eventType?.includes('Create') || eventType?.includes('Add')) return CheckCircle2
  if (eventType?.includes('Delete') || eventType?.includes('Remove')) return XCircle
  return Info
}

function getEventColor(eventType: string): string {
  if (eventType?.includes('error') || eventType?.includes('Delete') || eventType?.includes('Remove'))
    return 'text-destructive'
  if (eventType?.includes('Create') || eventType?.includes('Add') || eventType?.includes('Success'))
    return 'text-green-500'
  return 'text-muted-foreground'
}

function subaccountName(event: EventRecord): string | null {
  if (!props.subaccountMap) return null
  return props.subaccountMap[event.entityId]
    ?? props.subaccountMap[(event.details as Record<string, unknown>)?.entityId as string]
    ?? null
}

// SAP BTP events store the acting user in several possible detail fields
function getPerformedBy(event: EventRecord): string | null {
  const d = event.details as Record<string, unknown>
  if (!d) return null
  for (const field of ['user', 'createdBy', 'changedBy', 'modifiedBy', 'updatedBy', 'performedBy']) {
    if (d[field] && typeof d[field] === 'string') return d[field] as string
  }
  return null
}

function parsePlanAssignments(assignments: unknown): Record<string, unknown>[] {
  if (!assignments) return []
  let parsed: unknown = assignments
  if (typeof assignments === 'string') {
    try { parsed = JSON.parse(assignments) } catch { return [{ raw: assignments }] }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(a => (typeof a === 'object' && a !== null ? a : { raw: String(a) }))
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return Object.entries(parsed).map(([key, val]) =>
      typeof val === 'object' && val !== null ? { _id: key, ...(val as object) } : { [key]: val },
    )
  }
  return [{ raw: String(parsed) }]
}
</script>

<template>
  <Dialog :open="!!event" @update:open="(val) => !val && emit('close')">
    <DialogContent class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-xl">
          <component
            :is="getEventIcon(event?.eventType || '')"
            class="h-6 w-6"
            :class="getEventColor(event?.eventType || '')"
          />
          {{ event?.eventType }}
        </DialogTitle>
        <DialogDescription class="hidden">Full details and JSON payload for the selected event.</DialogDescription>
      </DialogHeader>

      <div v-if="event" class="overflow-y-auto pr-2 mt-4 space-y-6">
        <!-- Summary grid -->
        <div class="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
          <div>
            <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Entity</p>
            <p class="font-medium">{{ event.entityType }}</p>
            <p v-if="subaccountName(event)" class="font-medium text-sm mt-0.5">{{ subaccountName(event) }}</p>
            <p class="font-mono text-xs text-muted-foreground mt-1">{{ event.entityId }}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Time</p>
            <p class="font-medium">{{ new Date(event.actionTime).toLocaleString() }}</p>
            <p class="text-xs text-muted-foreground mt-1">
              Created: {{ new Date(event.creationTime).toLocaleString() }}
            </p>
          </div>
          <!-- Performed By — shown when SAP populates any user attribution field -->
          <div v-if="getPerformedBy(event)" class="col-span-2 border-t pt-3">
            <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Performed By</p>
            <p class="font-medium">{{ getPerformedBy(event) }}</p>
          </div>
          <!-- Display name / description of the target entity -->
          <div v-if="(event.details as Record<string,unknown>)?.displayName" class="col-span-2 border-t pt-3">
            <p class="text-muted-foreground text-xs font-medium uppercase mb-1">Target</p>
            <p class="font-medium">{{ (event.details as Record<string,unknown>).displayName as string }}</p>
            <p
              v-if="(event.details as Record<string,unknown>)?.description"
              class="text-xs text-muted-foreground mt-0.5"
            >{{ (event.details as Record<string,unknown>).description as string }}</p>
          </div>
        </div>

        <!-- Plan assignments (entitlement events) -->
        <div v-if="(event.details as Record<string,unknown>)?.servicePlanAssignments">
          <h4 class="text-sm font-semibold mb-2">Plan Assignments</h4>
          <div class="space-y-2 mb-6">
            <div
              v-for="(plan, idx) in parsePlanAssignments((event.details as Record<string,unknown>).servicePlanAssignments)"
              :key="idx"
              class="rounded-md border bg-muted/40 overflow-hidden"
            >
              <div v-if="'raw' in plan" class="p-2 text-xs text-muted-foreground">{{ plan.raw }}</div>
              <table v-else class="w-full text-xs text-left">
                <tbody class="divide-y divide-border">
                  <tr v-for="(v, k) in plan" :key="k" class="divide-x divide-border">
                    <td class="px-2 py-1.5 font-medium text-muted-foreground bg-muted/30 w-1/4 align-top">
                      {{ k === '_id' ? 'ID' : k }}
                    </td>
                    <td class="px-2 py-1.5 font-mono text-[10px] break-all align-top text-foreground bg-card">
                      <span v-if="typeof v === 'object' && v !== null && Object.keys(v as object).length === 0" class="text-muted-foreground italic">none</span>
                      <pre v-else-if="typeof v === 'object' && v !== null" class="whitespace-pre-wrap m-0 font-inherit">{{ JSON.stringify(v, null, 2) }}</pre>
                      <span v-else>{{ String(v) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Raw JSON payload -->
        <div>
          <h4 class="text-sm font-semibold mb-2">Event Details Payload</h4>
          <div class="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            <pre>{{ JSON.stringify(event.details, null, 2) }}</pre>
          </div>
        </div>

        <div class="text-xs text-muted-foreground flex justify-between border-t pt-4">
          <span><strong>Event ID:</strong> {{ event.id }}</span>
          <span><strong>Global Account:</strong> {{ event.globalAccountGUID }}</span>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
