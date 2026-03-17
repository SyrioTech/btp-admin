import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { consumptionApi } from '@/api/consumption'

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
