import api from '@/lib/axios'
import type { AuditLogRecord, AuditLogsFilter } from './types'

export const auditLogsApi = {
  getAuditLogs: (accountId: string, params?: AuditLogsFilter) =>
    api.get<AuditLogRecord[]>(`/audit-logs/${accountId}`, { params }).then((r) => r.data),
}
