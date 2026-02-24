import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { btpAccountsApi } from '@/api/btp-accounts'
import type {
  CreateBtpAccountDto,
  UpdateBtpAccountDto,
  CreateCredentialSetDto,
} from '@/api/types'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export function useBtpAccounts(tenantId?: MaybeRefOrGetter<string | undefined>) {
  const queryClient = useQueryClient()

  const accounts = useQuery({
    queryKey: ['btp-accounts', tenantId],
    queryFn: () => btpAccountsApi.list(tenantId ? toValue(tenantId) : undefined),
  })

  const createAccount = useMutation({
    mutationFn: (dto: CreateBtpAccountDto) => btpAccountsApi.create(dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['btp-accounts'] }),
  })

  const updateAccount = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBtpAccountDto }) =>
      btpAccountsApi.update(id, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['btp-accounts'] }),
  })

  return { accounts, createAccount, updateAccount }
}

export function useCredentialSets(accountId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()

  const credentials = useQuery({
    queryKey: ['credentials', accountId],
    queryFn: () => btpAccountsApi.listCredentials(toValue(accountId)),
  })

  const createCredential = useMutation({
    mutationFn: (dto: CreateCredentialSetDto) =>
      btpAccountsApi.createCredential(toValue(accountId), dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['credentials', toValue(accountId)] }),
  })

  const testCredential = useMutation({
    mutationFn: (credId: string) =>
      btpAccountsApi.testCredential(toValue(accountId), credId),
  })

  const deleteCredential = useMutation({
    mutationFn: (credId: string) =>
      btpAccountsApi.deleteCredential(toValue(accountId), credId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['credentials', toValue(accountId)] }),
  })

  return { credentials, createCredential, testCredential, deleteCredential }
}
