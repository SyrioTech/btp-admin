export interface Tenant {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
}

export interface BtpAccount {
  id: string
  tenantId: string
  globalAccountId: string
  displayName: string
  region: string
  isActive: boolean
  createdAt: string
}

export interface CredentialSet {
  id: string
  btpAccountId: string
  credentialType: 'CIS' | 'UDM' | 'AUDIT_LOG'
  isActive: boolean
  createdAt: string
}

export interface ClientUser {
  id: string
  tenantId: string
  email: string
  role: 'admin' | 'viewer'
  isActive: boolean
  createdAt: string
}

export interface AuthUser {
  id: string
  email: string
  role: string
  tenantId: string
}

// --- Request DTOs ---

export interface LoginDto {
  email: string
  password: string
  tenantSlug: string
}

export interface CreateTenantDto {
  name: string
  slug: string
}

export interface UpdateTenantDto {
  name?: string
  isActive?: boolean
}

export interface CreateBtpAccountDto {
  tenantId: string
  globalAccountId: string
  displayName: string
  region: string
}

export interface UpdateBtpAccountDto {
  displayName?: string
  region?: string
  isActive?: boolean
}

export interface CreateCredentialSetDto {
  credentialType: 'CIS' | 'UDM' | 'AUDIT_LOG'
  tokenUrl: string
  clientId: string
  clientSecret: string
  serviceUrl: string
}

export interface CreateUserDto {
  email: string
  password: string
  role: 'admin' | 'viewer'
}

export interface UpdateUserDto {
  role?: 'admin' | 'viewer'
  isActive?: boolean
}
