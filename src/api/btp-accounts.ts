import api from '@/lib/axios'
import type {
  BtpAccount,
  CredentialSet,
  CreateBtpAccountDto,
  UpdateBtpAccountDto,
  CreateCredentialSetDto,
} from './types'

export const btpAccountsApi = {
  list(tenantId?: string): Promise<BtpAccount[]> {
    const params = tenantId ? { tenantId } : {}
    return api.get<BtpAccount[]>('/btp-accounts', { params }).then((r) => r.data)
  },

  get(id: string): Promise<BtpAccount> {
    return api.get<BtpAccount>(`/btp-accounts/${id}`).then((r) => r.data)
  },

  create(dto: CreateBtpAccountDto): Promise<BtpAccount> {
    return api.post<BtpAccount>('/btp-accounts', dto).then((r) => r.data)
  },

  update(id: string, dto: UpdateBtpAccountDto): Promise<BtpAccount> {
    return api.patch<BtpAccount>(`/btp-accounts/${id}`, dto).then((r) => r.data)
  },

  // Credential sets
  listCredentials(accountId: string): Promise<CredentialSet[]> {
    return api
      .get<CredentialSet[]>(`/btp-accounts/${accountId}/credentials`)
      .then((r) => r.data)
  },

  createCredential(
    accountId: string,
    dto: CreateCredentialSetDto,
  ): Promise<CredentialSet> {
    return api
      .post<CredentialSet>(`/btp-accounts/${accountId}/credentials`, dto)
      .then((r) => r.data)
  },

  testCredential(accountId: string, credId: string): Promise<{ success: boolean; message?: string }> {
    return api
      .post<{ success: boolean; message?: string }>(
        `/btp-accounts/${accountId}/credentials/${credId}/test`,
      )
      .then((r) => r.data)
  },

  deleteCredential(accountId: string, credId: string): Promise<void> {
    return api
      .delete(`/btp-accounts/${accountId}/credentials/${credId}`)
      .then(() => undefined)
  },
}
