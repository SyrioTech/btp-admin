import api from '@/lib/axios'
import type { EntitlementsResponse } from './types'

export const entitlementsBtpApi = {
  getGlobalAssignments: (
    accountId: string,
    params?: { subaccountGuid?: string; directoryGuid?: string; serviceName?: string; planName?: string },
  ) => api.get<EntitlementsResponse>(`/entitlements/${accountId}/assignments`, { params }).then((r) => r.data),

  getSubaccountAssignments: (accountId: string, subaccountId: string) =>
    api.get<EntitlementsResponse>(`/entitlements/${accountId}/subaccounts/${subaccountId}/assignments`).then((r) => r.data),
}
