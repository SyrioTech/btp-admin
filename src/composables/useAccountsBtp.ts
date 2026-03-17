import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { accountsBtpApi } from '@/api/accounts-btp'

export function useGlobalAccount(accountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['accounts', 'global-account', accountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return accountsBtpApi.getGlobalAccount(accountId.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useSubaccounts(
  accountId: Ref<string | null>,
  params?: Ref<{ derivedAuthorizations?: string; labelFilter?: string }>
) {
  return useQuery({
    queryKey: ['accounts', 'subaccounts', accountId, params],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return accountsBtpApi.listSubaccounts(accountId.value, params?.value)
    },
    enabled: () => !!accountId.value,
  })
}

export function useDirectories(
  accountId: Ref<string | null>,
  params?: Ref<{ expandChildren?: string }>
) {
  return useQuery({
    queryKey: ['accounts', 'directories', accountId, params],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return accountsBtpApi.listDirectories(accountId.value, params?.value)
    },
    enabled: () => !!accountId.value,
  })
}
