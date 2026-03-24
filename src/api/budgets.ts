import api from '@/lib/axios'
import type { Budget, BudgetsResponse } from './types'

export const budgetsApi = {
  list: (btpAccountId: string): Promise<BudgetsResponse> =>
    api.get(`/budgets/${btpAccountId}`).then(r => r.data),

  get: (btpAccountId: string, budgetGuid: string): Promise<Budget> =>
    api.get(`/budgets/${btpAccountId}/${budgetGuid}`).then(r => r.data),

  create: (btpAccountId: string, body: Partial<Budget>): Promise<Budget> =>
    api.post(`/budgets/${btpAccountId}`, body).then(r => r.data),

  update: (btpAccountId: string, budgetGuid: string, body: Partial<Budget>): Promise<Budget> =>
    api.put(`/budgets/${btpAccountId}/${budgetGuid}`, body).then(r => r.data),

  delete: (btpAccountId: string, budgetGuid: string): Promise<void> =>
    api.delete(`/budgets/${btpAccountId}/${budgetGuid}`).then(r => r.data),
}
