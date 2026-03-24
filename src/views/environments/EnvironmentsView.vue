<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useEnvironments } from '@/composables/useProvisioning'
import { useSubaccounts } from '@/composables/useAccountsBtp'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Server, Search, X, ChevronDown, ChevronRight } from 'lucide-vue-next'

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

const selectedSubaccountId = ref<string | null>(null)
const { data: environments, isLoading, error } = useEnvironments(accountId, selectedSubaccountId)
const { data: subaccounts } = useSubaccounts(accountId)

const activeTypeFilter = ref<string>('all')
const searchQuery = ref('')
const expandedRows = ref<Set<string>>(new Set())

const instances = computed(() => environments.value?.environmentInstances ?? [])

const availableTypes = computed(() => {
  const types = new Set<string>()
  instances.value.forEach(e => types.add(e.environmentType))
  return Array.from(types).sort()
})

const filteredInstances = computed(() => {
  let list = instances.value
  if (activeTypeFilter.value !== 'all') {
    list = list.filter(e => e.environmentType === activeTypeFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(e =>
      (e.name ?? '').toLowerCase().includes(q) ||
      (e.subaccountGUID ?? '').toLowerCase().includes(q) ||
      (e.environmentType ?? '').toLowerCase().includes(q)
    )
  }
  return list
})

function subaccountName(guid: string): string {
  return subaccounts.value?.find(sa => sa.guid === guid)?.displayName ?? guid
}

function parsedParameters(raw?: string): Record<string, unknown> | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function stateBadgeVariant(state: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  if (state === 'OK') return 'success'
  if (state?.includes('FAILED') || state === 'ERROR') return 'destructive'
  if (state?.includes('CREATING') || state?.includes('DELETING')) return 'warning'
  return 'outline'
}

function toggleExpand(id: string) {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

function formatDate(d?: number | string) {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString()
}
</script>

<template>
  <div class="page-root">
    <!-- Sticky filter bar -->
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Environment Instances</h2>
        <p class="text-xs text-muted-foreground">Provisioned CF orgs, Kyma clusters, and other environments</p>
      </div>

      <span v-if="instances.length" class="text-xs text-muted-foreground shrink-0">
        <strong class="text-foreground">{{ filteredInstances.length }}</strong> / {{ instances.length }}
      </span>

      <template v-if="accountId">
        <!-- Search -->
        <div class="relative w-52">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input v-model="searchQuery" placeholder="Search environments…" class="pl-8 pr-7 h-8 text-xs" />
          <button v-if="searchQuery" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" @click="searchQuery = ''">
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Type pill filters -->
        <div class="flex flex-wrap items-center gap-1">
          <button
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors border"
            :class="activeTypeFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'"
            @click="activeTypeFilter = 'all'"
          >All</button>
          <button
            v-for="t in availableTypes"
            :key="t"
            class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors border"
            :class="activeTypeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'"
            @click="activeTypeFilter = t"
          >{{ t }}</button>
        </div>
      </template>
    </div>

    <!-- Content -->
    <div class="page-content">
      <div v-if="!accountId" class="flex h-[400px] items-center justify-center rounded-md border border-dashed">
        <div class="text-center">
          <h3 class="text-lg font-semibold">No Account Selected</h3>
          <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar.</p>
        </div>
      </div>

      <template v-else>
        <!-- Loading -->
        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-md" />
        </div>

        <!-- Error -->
        <Card v-else-if="error">
          <CardContent class="py-8 text-center text-sm">
            <template v-if="(error as any)?.response?.status === 403">
              <p class="font-semibold text-destructive mb-1">Access denied (403)</p>
              <p class="text-muted-foreground">
                The CIS credential does not have permission to read environment instances.
                This API requires a CIS service instance with the <strong>central</strong> plan
                (not <em>local</em>). Verify your credential set's plan in the SAP BTP cockpit and
                ensure the OAuth client has the <code>Manage Environment Instances</code> scope.
              </p>
            </template>
            <template v-else>
              <p class="text-destructive">
                Failed to load environments: {{ (error as any)?.response?.data?.message ?? (error as Error).message }}
              </p>
            </template>
          </CardContent>
        </Card>

        <!-- Empty -->
        <Card v-else-if="filteredInstances.length === 0">
          <CardContent class="flex flex-col items-center gap-3 py-12 text-center">
            <Server class="h-8 w-8 text-muted-foreground opacity-40" />
            <p class="text-sm text-muted-foreground">
              {{ instances.length === 0 ? 'No environment instances found for this account.' : 'No instances match your filters.' }}
            </p>
          </CardContent>
        </Card>

        <!-- Table -->
        <Card v-else>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium">Instances</CardTitle>
            <CardDescription>Click a row to expand full details</CardDescription>
          </CardHeader>
          <CardContent class="p-0">
            <div class="rounded-b-md overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-muted/50 border-b">
                  <tr>
                    <th class="w-6 px-3 py-2"></th>
                    <th class="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th class="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th class="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Subaccount</th>
                    <th class="text-left px-3 py-2 font-medium text-muted-foreground">State</th>
                    <th class="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template v-for="env in filteredInstances" :key="env.id">
                    <tr
                      class="hover:bg-muted/30 cursor-pointer transition-colors"
                      @click="toggleExpand(env.id)"
                    >
                      <td class="px-3 py-3">
                        <ChevronRight v-if="!expandedRows.has(env.id)" class="h-3.5 w-3.5 text-muted-foreground" />
                        <ChevronDown v-else class="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                      <td class="px-3 py-3 font-medium">{{ env.name || '—' }}</td>
                      <td class="px-3 py-3">
                        <Badge variant="outline" class="text-xs">{{ env.environmentType }}</Badge>
                      </td>
                      <td class="px-3 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate" :title="subaccountName(env.subaccountGUID)">
                        {{ subaccountName(env.subaccountGUID) }}
                      </td>
                      <td class="px-3 py-3">
                        <Badge :variant="stateBadgeVariant(env.state)" class="text-xs">{{ env.state }}</Badge>
                      </td>
                      <td class="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">{{ formatDate(env.createdDate) }}</td>
                    </tr>
                    <!-- Expanded details row -->
                    <tr v-if="expandedRows.has(env.id)">
                      <td colspan="6" class="px-4 py-3 bg-muted/20 border-t">
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs mb-3">
                          <div>
                            <p class="text-muted-foreground font-medium mb-0.5">Instance ID</p>
                            <p class="font-mono break-all">{{ env.id }}</p>
                          </div>
                          <div>
                            <p class="text-muted-foreground font-medium mb-0.5">Subaccount GUID</p>
                            <p class="font-mono break-all">{{ env.subaccountGUID }}</p>
                          </div>
                          <div v-if="env.landscapeLabel">
                            <p class="text-muted-foreground font-medium mb-0.5">Landscape</p>
                            <p>{{ env.landscapeLabel }}</p>
                          </div>
                          <div>
                            <p class="text-muted-foreground font-medium mb-0.5">Modified</p>
                            <p>{{ formatDate(env.modifiedDate) }}</p>
                          </div>
                          <div v-if="env.stateMessage" class="col-span-2">
                            <p class="text-muted-foreground font-medium mb-0.5">State Message</p>
                            <p>{{ env.stateMessage }}</p>
                          </div>
                        </div>
                        <div v-if="parsedParameters(env.parameters)">
                          <p class="text-muted-foreground text-xs font-medium mb-1.5">Parameters</p>
                          <pre class="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48">{{ JSON.stringify(parsedParameters(env.parameters), null, 2) }}</pre>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>
