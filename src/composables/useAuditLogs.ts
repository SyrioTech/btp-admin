import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { auditLogsApi } from '@/api/audit'
import type { AuditLogsFilter } from '@/api/types'

export function useAuditLogs(accountId: Ref<string | null>, filters: Ref<AuditLogsFilter>) {
  return useQuery({
    queryKey: ['audit-logs', 'list', accountId, filters],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return auditLogsApi.getAuditLogs(accountId.value, filters.value)
    },
    enabled: () => !!accountId.value,
    placeholderData: (previousData) => previousData, // keep old data while fetching to avoid layout shift
  })
}
