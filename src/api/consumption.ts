import api from '@/lib/axios'
import type { MonthlyUsageResponse, MonthlyCostResponse, CloudCreditsResponse } from './types'

export const consumptionApi = {
  getMonthlyUsage: (accountId: string, year: number, month: number) =>
    api.get<MonthlyUsageResponse>(`/consumption/${accountId}/monthly`, { params: { year, month } }).then((r) => r.data),

  getSubaccountCosts: (accountId: string, year: number, month: number) =>
    api.get<MonthlyCostResponse>(`/consumption/${accountId}/subaccounts/costs`, { params: { year, month } }).then((r) => r.data),

  getCloudCredits: (accountId: string) =>
    api.get<CloudCreditsResponse>(`/consumption/${accountId}/credits`).then((r) => r.data),
}
