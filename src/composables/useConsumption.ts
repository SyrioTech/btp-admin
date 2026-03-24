import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import type { AxiosError } from 'axios'
import { consumptionApi } from '@/api/consumption'
import type { MonthlyUsageResponse } from '@/api/types'

export function useMonthlyUsage(accountId: Ref<string | null>, year: Ref<number>, month: Ref<number>) {
  return useQuery({
    queryKey: ['consumption', 'monthly', accountId, year, month],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return consumptionApi.getMonthlyUsage(accountId.value, year.value, month.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useSubaccountCosts(accountId: Ref<string | null>, year: Ref<number>, month: Ref<number>) {
  return useQuery({
    queryKey: ['consumption', 'subaccount-costs', accountId, year, month],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return consumptionApi.getSubaccountCosts(accountId.value, year.value, month.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useCloudCredits(accountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['consumption', 'credits', accountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return consumptionApi.getCloudCredits(accountId.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useSubaccountCostsRange(accountId: Ref<string | null>, fromDate: Ref<number>, toDate: Ref<number>) {
  return useQuery({
    queryKey: ['consumption', 'subaccount-costs-range', accountId, fromDate, toDate],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return consumptionApi.getSubaccountCostsRange(accountId.value, fromDate.value, toDate.value)
    },
    enabled: () => !!accountId.value,
  })
}

// Directory usage is optional — the query never retries and failures are handled in the
// UI as informational banners, not errors. 404 = no UDM_DIRECTORY credential configured.
export function useDirectoryUsage(accountId: Ref<string | null>, year: Ref<number>, month: Ref<number>) {
  return useQuery<MonthlyUsageResponse, AxiosError>({
    queryKey: ['consumption', 'directory', accountId, year, month],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return consumptionApi.getDirectoryUsage(accountId.value, year.value, month.value)
    },
    enabled: () => !!accountId.value,
    retry: 0,
  })
}
