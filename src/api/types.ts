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
  tenantSlug: string
  tenantName: string
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

// ─── Consumption ────────────────────────────────────────────────────────────

// Flat usage line item from /reports/v1/monthlyUsage response { content: [...] }
export interface MonthlyUsageItem {
  serviceName: string
  serviceId?: string
  subaccountId: string
  subaccountName?: string
  plan?: string
  planName?: string
  usage: number
  metricName?: string
  unitSingular?: string
  unitPlural?: string
  reportYearMonth?: number
  directoryId?: string
  directoryName?: string
  globalAccountId?: string
  dataCenter?: string
}

export interface MonthlyUsageResponse {
  content: MonthlyUsageItem[]
}

// Flat cost line item from /reports/v1/monthlySubaccountsCost response { content: [...] }
export interface MonthlyCostItem {
  subaccountId: string
  subaccountName?: string
  cost: number
  currency?: string
  serviceName?: string
  serviceId?: string
  plan?: string
  planName?: string
  usage?: number
  reportYearMonth?: number
  directoryId?: string
  directoryName?: string
  estimated?: boolean
  cloudCreditsCost?: number
  paygCost?: number
}

export interface MonthlyCostResponse {
  content: MonthlyCostItem[]
}

// Cloud credits from /reports/v1/cloudCreditsDetails
export interface PhaseUpdate {
  balance: number
  cloudCreditsForPhase: number
  phaseUpdatedOn: string
}

export interface CreditsPhase {
  phaseStartDate: string
  phaseEndDate: string
  phaseUpdates: PhaseUpdate[]
}

export interface CreditsContract {
  contractStartDate: string
  contractEndDate: string
  currency: string
  phases: CreditsPhase[]
}

export interface CloudCreditsResponse {
  contracts: CreditsContract[]
  globalAccountId?: string
  globalAccountName?: string
}

// ─── Accounts ───────────────────────────────────────────────────────────────

// Polymorphic child type returned in globalAccount?expand=true children arrays.
// SAP mixes directories and subaccounts in the same children array; discriminate by
// checking whether directoryFeatures is present (directory) or region is present (subaccount).
export type TreeChild = Directory | Subaccount

export interface GlobalAccount {
  guid: string
  displayName: string
  description?: string
  state: string
  stateMessage?: string
  contractStatus?: string
  commercialModel?: string
  consumptionBased?: boolean
  region?: string
  subdomain?: string
  customProperties?: Record<string, string>
  labels?: Record<string, string[]>
  createdDate?: number
  modifiedDate?: number
  subaccounts?: Subaccount[]
  // Populated when fetched with ?expand=true. Contains a mix of Directory and Subaccount objects.
  children?: TreeChild[]
}

export interface Directory {
  guid: string
  displayName: string
  description?: string
  directoryType?: string
  directoryFeatures?: string[]
  // SAP uses 'entityState' for directories in the expand response; we normalise to 'state' when parsing.
  state: string
  entityState?: string
  stateMessage?: string
  parentGUID?: string
  globalAccountGUID?: string
  customProperties?: Record<string, string>
  labels?: Record<string, string[]>
  createdDate?: number | string
  modifiedDate?: number | string
  createdBy?: string
  subaccounts?: Subaccount[]
  // Nested children (dirs + subaccounts) when fetched as part of expand=true
  children?: TreeChild[]
}

export interface Subaccount {
  guid: string
  displayName: string
  description?: string
  region: string
  subdomain: string
  state: string
  stateMessage?: string
  parentGUID?: string
  globalAccountGUID?: string
  technicalName?: string
  usedForProduction?: string
  betaEnabled?: boolean
  customProperties?: Record<string, string>
  labels?: Record<string, string[]>
  createdDate?: number
  modifiedDate?: number
  createdBy?: string
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface EventRecord {
  id: number
  actionTime: string
  creationTime: string
  eventType: string
  entityId: string
  entityType: string
  eventOrigin: string
  globalAccountGUID: string
  details: Record<string, unknown>
}

export interface EventsResponse {
  events: EventRecord[]
  total: number
  totalPages: number
  pageNum: number
  morePages: boolean
}

export interface EventType {
  type: string
  category: 'LOCAL' | 'CENTRAL' | 'NOTIFICATION'
  description?: string
  searchParams?: string[]
}

export interface EventsFilter {
  eventType?: string
  entityType?: string
  entityId?: string
  fromTime?: string
  toTime?: string
  page?: number      // gateway reads @Query('page')
  pageSize?: number
}

// ─── Entitlements ─────────────────────────────────────────────────────────

export interface AssignmentInfo {
  entityId: string
  entityType: 'SUBACCOUNT' | 'DIRECTORY' | 'GLOBAL_ACCOUNT'
  amount?: number
  requestedAmount?: number
  entityState?: string
  stateMessage?: string
  autoAssigned?: boolean
  autoAssign?: boolean
  autoDistributeAmount?: number
  unlimitedAmountAssigned?: boolean
  parentId?: string
  parentType?: string
  createdDate?: number
  modifiedDate?: number
}

export interface AssignedServicePlan {
  name: string
  displayName?: string
  uniqueIdentifier?: string
  category?: string
  beta?: boolean
  unlimited?: boolean
  maxAllowedSubaccountQuota?: number
  assignmentInfo?: AssignmentInfo[]
}

export interface EntitledService {
  name: string
  displayName?: string
  description?: string
  businessCategory?: { id: string; displayName: string }
  iconBase64?: string
  servicePlans?: AssignedServicePlan[]
}

export interface EntitlementsResponse {
  entitledServices?: EntitledService[]
  assignedServices?: EntitledService[]
}

// ─── Provisioning / Environments ────────────────────────────────────────────

export interface EnvironmentInstance {
  id: string
  name: string
  environmentType: string
  subaccountGUID: string   // SAP field name
  globalAccountGUID?: string
  state: string            // 'OK' | 'CREATING' | 'DELETING' | 'CREATION_FAILED' | …
  stateMessage?: string
  createdDate: number      // epoch milliseconds
  modifiedDate: number     // epoch milliseconds
  parameters?: string      // raw JSON string from SAP
  landscapeLabel?: string
  planName?: string
  serviceName?: string
}

export interface EnvironmentsResponse {
  environmentInstances: EnvironmentInstance[]
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export interface BudgetAlertThreshold {
  guid: string
  thresholdValue: number
  thresholdValueType: 'PERCENTAGE' | 'FIXED'
  measurementSource: 'ACTUAL'
  disabled?: boolean
}

export interface BudgetScope {
  scopeType: 'SUBACCOUNT_GUID' | 'PRODUCT_ID'
  value: string
}

export interface Budget {
  guid: string
  displayName: string
  description?: string
  amount: number
  currency?: string
  budgetType: 'COST' | 'CHARGED_USAGE'
  budgetPeriodInterval?: 'MONTHLY'
  startDate: string
  endDate?: string
  createdDate: string
  createdBy?: string
  modifiedDate?: string
  modifiedBy?: string
  globalAccountGUID: string
  enableAutomaticNotifications: boolean
  alertThresholds?: BudgetAlertThreshold[]
  scope?: BudgetScope[]
}

export interface BudgetsResponse {
  value: Budget[]
}

// ─── Audit Logs ────────────────────────────────────────────────────────────

export interface AuditLogRecord {
  message_uuid: string
  time: string
  tenant?: string
  org_id?: string
  space_id?: string
  app_or_service_id?: string
  als_service_id?: string
  user?: string
  category?: string
  format_version?: string
  message: string          // raw JSON string from SAP
  parsedMessage?: Record<string, unknown>  // client-side parsed
}

export interface AuditLogsFilter {
  timeFrom?: string
  timeTo?: string
  top?: number
  skip?: number
  filter?: string
}
