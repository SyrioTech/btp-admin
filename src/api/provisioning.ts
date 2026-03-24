import api from '@/lib/axios'
import type { EnvironmentsResponse } from './types'

export const provisioningApi = {
  getEnvironments(accountId: string, subaccountId?: string): Promise<EnvironmentsResponse> {
    const params = subaccountId ? { subaccountId } : {}
    return api.get<EnvironmentsResponse>(`/provisioning/${accountId}/environments`, { params }).then(r => r.data)
  },

  getAvailableEnvironments(accountId: string): Promise<unknown> {
    return api.get(`/provisioning/${accountId}/environments/available`).then(r => r.data)
  },
}
