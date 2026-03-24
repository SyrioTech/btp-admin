import { type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { budgetsApi } from '@/api/budgets'

export function useBudgets(accountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['budgets', accountId],
    queryFn: () => budgetsApi.list(accountId.value!),
    enabled: () => !!accountId.value,
  })
}
