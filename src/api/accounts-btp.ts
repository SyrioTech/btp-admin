import api from '@/lib/axios'
import type { GlobalAccount, Subaccount, Directory } from './types'

export const accountsBtpApi = {
  getGlobalAccount: (accountId: string, expand?: boolean) =>
    api.get<GlobalAccount>(`/accounts/${accountId}/global-account`, {
      params: expand ? { expand: 'true' } : undefined,
    }).then((r) => r.data),

  listSubaccounts: (accountId: string, params?: { derivedAuthorizations?: string; labelFilter?: string }) =>
    api.get<{ value: Subaccount[] }>(`/accounts/${accountId}/subaccounts`, { params }).then((r) => r.data.value),

  getSubaccount: (accountId: string, subaccountId: string) =>
    api.get<Subaccount>(`/accounts/${accountId}/subaccounts/${subaccountId}`).then((r) => r.data),

  listDirectories: (accountId: string, params?: { expandChildren?: string }) =>
    api.get<{ value: Directory[] }>(`/accounts/${accountId}/directories`, { params }).then((r) => r.data.value),

  getDirectory: (accountId: string, directoryId: string) =>
    api.get<Directory>(`/accounts/${accountId}/directories/${directoryId}`).then((r) => r.data),
}
