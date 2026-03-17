<script setup lang="ts">
import { computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useAuditLogs } from '@/composables/useAuditLogs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { FileSearch, Clock, Activity } from 'lucide-vue-next'

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

// Let's just fetch the latest logs for now
const filters = computed(() => ({ top: 100 }))

const { data: auditLogs, isLoading } = useAuditLogs(accountId, filters)

const safeParseDetails = (message: string) => {
  try {
    return JSON.parse(message)
  } catch (e) {
    return null
  }
}

const getCategoryBadge = (category?: string) => {
  if (!category) return 'default'
  if (category.toLowerCase() === 'audit.security-events') return 'destructive'
  if (category.toLowerCase().includes('config')) return 'secondary'
  return 'outline'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Audit Logs</h2>
        <p class="text-muted-foreground mt-1">Platform and security audit records.</p>
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

    <div v-else-if="auditLogs?.length" class="space-y-4">
      <div 
        v-for="log in auditLogs" 
        :key="log.message_uuid"
        class="flex gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all"
      >
        <div class="flex-shrink-0 h-10 w-10 text-muted-foreground bg-muted rounded-full flex items-center justify-center border">
          <Activity class="h-5 w-5" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium truncate flex items-center gap-2">
                {{ log.org_id || log.space_id || log.category || 'Audit Event' }}
                <Badge :variant="getCategoryBadge(log.category)" class="text-[10px] font-mono h-5">{{ log.category }}</Badge>
              </p>
              
              <!-- Parsed message logic -->
              <div class="text-sm text-muted-foreground mt-1" v-if="log.parsedMessage || safeParseDetails(log.message)">
                 <span class="font-mono bg-muted px-1 rounded text-xs">
                   {{ (log.parsedMessage || safeParseDetails(log.message))?.type || 'Record' }}
                 </span>
                 - {{ (log.parsedMessage || safeParseDetails(log.message))?.object?.id || 'Unknown Object' }}
                 <span v-if="(log.parsedMessage || safeParseDetails(log.message))?.user">
                   by {{ (log.parsedMessage || safeParseDetails(log.message))?.user }}
                 </span>
              </div>
              <p class="text-sm text-muted-foreground mt-1 font-mono text-xs overflow-hidden text-ellipsis" v-else>
                {{ log.message.substring(0, 150) }}{{ log.message.length > 150 ? '...' : '' }}
              </p>
            </div>
            
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
              <span class="text-xs text-muted-foreground flex items-center gap-1">
                <Clock class="h-3 w-3" />
                {{ new Date(log.time).toLocaleString() }}
              </span>
              <span class="text-xs text-muted-foreground mt-1" v-if="log.user">
                User: {{ log.user }}
              </span>
            </div>
          </div>
          
          <div class="flex flex-wrap items-center gap-4 mt-4 text-xs">
            <div class="flex items-center gap-1.5" v-if="log.tenant">
              <span class="text-muted-foreground">Tenant:</span>
              <span class="font-mono bg-secondary px-1.5 py-0.5 rounded">{{ log.tenant }}</span>
            </div>
            <div class="flex items-center gap-1.5 text-muted-foreground" v-if="log.message_uuid">
               ID: <span class="font-mono">{{ log.message_uuid }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex h-[300px] flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground">
      <FileSearch class="h-10 w-10 mb-3 opacity-20" />
      <p>No audit logs found for the selected criteria.</p>
    </div>
  </div>
</template>
