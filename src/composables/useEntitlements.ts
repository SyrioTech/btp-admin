import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { entitlementsBtpApi } from '@/api/entitlements-btp'

export function useGlobalAssignments(
  accountId: Ref<string | null>,
  params?: Ref<{ subaccountGuid?: string; directoryGuid?: string; serviceName?: string; planName?: string }>
) {
  return useQuery({
    queryKey: ['entitlements', 'global', accountId, params],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return entitlementsBtpApi.getGlobalAssignments(accountId.value, params?.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useSubaccountAssignments(accountId: Ref<string | null>, subaccountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['entitlements', 'subaccount', accountId, subaccountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      if (!subaccountId.value) throw new Error('No subaccount selected')
      return entitlementsBtpApi.getSubaccountAssignments(accountId.value, subaccountId.value)
    },
    enabled: () => !!accountId.value && !!subaccountId.value,
  })
}
