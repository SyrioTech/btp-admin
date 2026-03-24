import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { provisioningApi } from '@/api/provisioning'

export function useEnvironments(accountId: Ref<string | null>, subaccountId?: Ref<string | null>) {
  return useQuery({
    queryKey: ['provisioning', 'environments', accountId, subaccountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return provisioningApi.getEnvironments(accountId.value, subaccountId?.value ?? undefined)
    },
    enabled: () => !!accountId.value,
  })
}

export function useAvailableEnvironments(accountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['provisioning', 'available-environments', accountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return provisioningApi.getAvailableEnvironments(accountId.value)
    },
    enabled: () => !!accountId.value,
  })
}
