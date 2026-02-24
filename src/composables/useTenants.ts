import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { tenantsApi } from '@/api/tenants'
import type { CreateTenantDto, UpdateTenantDto, CreateUserDto, UpdateUserDto } from '@/api/types'
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export function useTenants() {
  const queryClient = useQueryClient()

  const tenants = useQuery({
    queryKey: ['tenants'],
    queryFn: tenantsApi.list,
  })

  const createTenant = useMutation({
    mutationFn: (dto: CreateTenantDto) => tenantsApi.create(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const updateTenant = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTenantDto }) =>
      tenantsApi.update(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  return { tenants, createTenant, updateTenant }
}

export function useTenant(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: () => tenantsApi.get(toValue(id)),
  })
}

export function useTenantUsers(tenantId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()

  const users = useQuery({
    queryKey: ['tenants', tenantId, 'users'],
    queryFn: () => tenantsApi.listUsers(toValue(tenantId)),
  })

  const createUser = useMutation({
    mutationFn: (dto: CreateUserDto) =>
      tenantsApi.createUser(toValue(tenantId), dto),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenants', toValue(tenantId), 'users'],
      }),
  })

  const updateUser = useMutation({
    mutationFn: ({ userId, dto }: { userId: string; dto: UpdateUserDto }) =>
      tenantsApi.updateUser(toValue(tenantId), userId, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenants', toValue(tenantId), 'users'],
      }),
  })

  return { users, createUser, updateUser }
}
