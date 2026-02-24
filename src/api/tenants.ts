import api from '@/lib/axios'
import type {
  Tenant,
  ClientUser,
  CreateTenantDto,
  UpdateTenantDto,
  CreateUserDto,
  UpdateUserDto,
} from './types'

export const tenantsApi = {
  list(): Promise<Tenant[]> {
    return api.get<Tenant[]>('/tenants').then((r) => r.data)
  },

  get(id: string): Promise<Tenant> {
    return api.get<Tenant>(`/tenants/${id}`).then((r) => r.data)
  },

  create(dto: CreateTenantDto): Promise<Tenant> {
    return api.post<Tenant>('/tenants', dto).then((r) => r.data)
  },

  update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    return api.patch<Tenant>(`/tenants/${id}`, dto).then((r) => r.data)
  },

  // Users under a tenant
  listUsers(tenantId: string): Promise<ClientUser[]> {
    return api
      .get<ClientUser[]>(`/tenants/${tenantId}/users`)
      .then((r) => r.data)
  },

  createUser(tenantId: string, dto: CreateUserDto): Promise<ClientUser> {
    return api
      .post<ClientUser>(`/tenants/${tenantId}/users`, dto)
      .then((r) => r.data)
  },

  updateUser(
    tenantId: string,
    userId: string,
    dto: UpdateUserDto,
  ): Promise<ClientUser> {
    return api
      .patch<ClientUser>(`/tenants/${tenantId}/users/${userId}`, dto)
      .then((r) => r.data)
  },
}
