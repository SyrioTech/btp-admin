<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useGlobalAccount, useSubaccounts } from '@/composables/useAccountsBtp'
import { useGlobalAssignments } from '@/composables/useEntitlements'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import AccountTreeNode from '@/components/accounts/AccountTreeNode.vue'
import type { SubaccountNode, DirectoryNode } from '@/components/accounts/AccountTreeNode.vue'
import type { GlobalAccount, Directory, TreeChild } from '@/api/types'
import {
  Globe, CalendarDays, User, MapPin, Server, Tag,
  Search, ArrowUpAZ, ArrowDownAZ, ChevronsDown, ChevronsUp,
} from 'lucide-vue-next'

type GlobalAccountTree = GlobalAccount & {
  type: 'global_account'
  childDirs: DirectoryNode[]
  childSubs: SubaccountNode[]
}

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

// Label filter
const selectedLabels = ref<string[]>([])
const labelFilterParam = computed(() => ({
  labelFilter: selectedLabels.value.length
    ? selectedLabels.value.map(l => {
        const parts = l.split(':')
        const key = parts[0] ?? ''
        const val = parts.slice(1).join(':').trim()
        return `${key.trim()} eq '${val}'`
      }).join(' and ')
    : undefined,
}))

// Two queries: directories come from expand=true, subaccounts from dedicated endpoint
const { data: globalAccount, isLoading: loadingGlobal, error: errorGlobal } = useGlobalAccount(accountId, true)
const subaccountsParams = computed(() => labelFilterParam.value)
const { data: subaccounts, isLoading: loadingSubs, error: errorSubs } = useSubaccounts(accountId, subaccountsParams)

const isLoading = computed(() => loadingGlobal.value || loadingSubs.value)
const error = computed(() => errorGlobal.value ?? errorSubs.value)

const selectedNode = ref<SubaccountNode | null>(null)
const showEntitlements = ref(false)

// Entitlements for the selected subaccount — use the global assignments endpoint
// with a subaccountGuid filter. This is the same endpoint EntitlementsView uses and
// reliably returns assignedServices[] with assignmentInfo. The per-subaccount endpoint
// only returns entitledServices (catalog) which does NOT carry assignmentInfo.
const entitlementParams = computed(() => ({ subaccountGuid: selectedNode.value?.guid ?? undefined }))
const { data: subEntitlements, isLoading: entLoading } = useGlobalAssignments(accountId, entitlementParams)

const activeEntitlements = computed(() => {
  const resp = subEntitlements.value
  if (!resp) return []

  const subGuid = selectedNode.value?.guid
  const seen = new Set<string>()
  const result: Array<{
    service: string; plan: string; state: string
    amount: number | null; unlimited: boolean; autoAssigned: boolean
  }> = []

  // assignedServices carries the actual assignment info (amount, entityState, etc.)
  for (const svc of (resp.assignedServices ?? [])) {
    for (const plan of (svc.servicePlans ?? [])) {
      // Match only the entry for this specific subaccount — the global assignments
      // endpoint returns one assignmentInfo per entity globally, so filtering by
      // entityType alone shows the plan once per subaccount that has it assigned.
      const info = (plan.assignmentInfo ?? []).find(
        i => i.entityType === 'SUBACCOUNT' && i.entityId === subGuid,
      )
      if (!info) continue
      const key = `${svc.name}::${plan.name}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        service: svc.displayName ?? svc.name,
        plan: plan.displayName ?? plan.name,
        state: info.entityState ?? 'OK',
        amount: info.amount ?? null,
        unlimited: info.unlimitedAmountAssigned ?? false,
        autoAssigned: info.autoAssigned ?? false,
      })
    }
  }

  return result
})

watch(selectedNode, () => { showEntitlements.value = false })

// Toolbar state
const searchQuery = ref('')
const sortOrder = ref<'asc' | 'desc' | null>(null)
const expandGeneration = ref(0)
const collapseGeneration = ref(0)

// Auto-expand all when search is active
watch(searchQuery, (q) => { if (q.trim()) expandGeneration.value++ })

// Discriminate between directories and subaccounts.
// Subaccounts always have 'region' (required string field); directories never do.
function isDirectory(child: TreeChild): child is Directory {
  return !('region' in child) || typeof (child as { region?: unknown }).region !== 'string'
}

// Walk the expand=true children tree — only extract directories into dirMap.
// Subaccounts are NOT embedded in the SAP expand response; they come from listSubaccounts.
function flattenDirectories(
  children: TreeChild[] | undefined,
  dirMap: Map<string, DirectoryNode>,
) {
  children?.forEach((child) => {
    if (isDirectory(child)) {
      const node: DirectoryNode = {
        ...child,
        state: (child as Directory).entityState ?? child.state,
        type: 'directory',
        childDirs: [],
        childSubs: [],
      }
      dirMap.set(child.guid, node)
      flattenDirectories(child.children, dirMap)
    }
    // Subaccounts in children[] are ignored here — wired in via subaccounts query below
  })
}

const tree = computed((): GlobalAccountTree | null => {
  if (!globalAccount.value) return null

  const globalGuid = globalAccount.value.guid
  const dirMap = new Map<string, DirectoryNode>()

  flattenDirectories(globalAccount.value.children, dirMap)

  // Wire up directory parent→child relationships
  const rootDirs: DirectoryNode[] = []
  dirMap.forEach((dir) => {
    if (dir.parentGUID && dir.parentGUID !== globalGuid && dirMap.has(dir.parentGUID)) {
      dirMap.get(dir.parentGUID)!.childDirs.push(dir)
    } else {
      rootDirs.push(dir)
    }
  })

  // Place subaccounts from the dedicated listSubaccounts call
  const rootSubs: SubaccountNode[] = []
  ;(subaccounts.value ?? []).forEach((sub) => {
    const node: SubaccountNode = { ...sub, type: 'subaccount' }
    if (sub.parentGUID && dirMap.has(sub.parentGUID)) {
      dirMap.get(sub.parentGUID)!.childSubs.push(node)
    } else {
      rootSubs.push(node)
    }
  })

  return {
    ...globalAccount.value,
    type: 'global_account',
    childDirs: rootDirs,
    childSubs: rootSubs,
  }
})

// Filtered + sorted tree for display
const displayTree = computed((): GlobalAccountTree | null => {
  if (!tree.value) return null

  const q = searchQuery.value.trim().toLowerCase()
  const ord = sortOrder.value

  function sorted<T extends { displayName: string }>(arr: T[]): T[] {
    if (!ord) return arr
    return [...arr].sort((a, b) =>
      ord === 'asc'
        ? a.displayName.localeCompare(b.displayName)
        : b.displayName.localeCompare(a.displayName),
    )
  }

  function filterDir(dir: DirectoryNode): DirectoryNode | null {
    const matchesSelf = !q || dir.displayName.toLowerCase().includes(q)
    const filteredChildDirs = dir.childDirs
      .map(filterDir)
      .filter((d): d is DirectoryNode => d !== null)
    const filteredChildSubs = dir.childSubs.filter(
      (s) => !q || s.displayName.toLowerCase().includes(q),
    )

    if (matchesSelf || filteredChildDirs.length > 0 || filteredChildSubs.length > 0) {
      return { ...dir, childDirs: sorted(filteredChildDirs), childSubs: sorted(filteredChildSubs) }
    }
    return null
  }

  const filteredDirs = tree.value.childDirs
    .map(filterDir)
    .filter((d): d is DirectoryNode => d !== null)
  const filteredSubs = tree.value.childSubs.filter(
    (s) => !q || s.displayName.toLowerCase().includes(q),
  )

  return {
    ...tree.value,
    childDirs: sorted(filteredDirs),
    childSubs: sorted(filteredSubs),
  }
})

const totalSubaccounts = computed(() => {
  let n = 0
  const count = (dirs: DirectoryNode[]) => {
    dirs.forEach(d => { n += d.childSubs.length; count(d.childDirs) })
  }
  if (tree.value) { n += tree.value.childSubs.length; count(tree.value.childDirs) }
  return n
})
const totalDirectories = computed(() => {
  let n = 0
  const count = (dirs: DirectoryNode[]) => { dirs.forEach(d => { n++; count(d.childDirs) }) }
  if (tree.value) count(tree.value.childDirs)
  return n
})

// Unique label chips — we compute these from unfiltered subaccounts to always show full set
// We use a second unfiltered query just for label collection
const { data: allSubaccountsForLabels } = useSubaccounts(accountId)
const availableLabelChips = computed(() => {
  const chips = new Set<string>()
  ;(allSubaccountsForLabels.value ?? []).forEach(sa => {
    if (sa.labels) {
      Object.entries(sa.labels).forEach(([key, values]) => {
        values.forEach(val => chips.add(`${key}: ${val}`))
      })
    }
  })
  return Array.from(chips).sort()
})

function toggleLabel(chip: string) {
  const idx = selectedLabels.value.indexOf(chip)
  if (idx >= 0) {
    selectedLabels.value.splice(idx, 1)
  } else {
    selectedLabels.value.push(chip)
  }
}

function formatDate(epoch?: number | string | null): string {
  if (!epoch) return '—'
  const d = new Date(epoch)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function stateVariant(state?: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (state === 'OK') return 'success'
  if (state?.includes('FAILED') || state === 'SUSPENDED') return 'destructive'
  if (state?.includes('CREATING') || state?.includes('PROCESSING') || state === 'STARTED') return 'warning'
  return 'outline'
}

function toggleSort() {
  if (sortOrder.value === null) sortOrder.value = 'asc'
  else if (sortOrder.value === 'asc') sortOrder.value = 'desc'
  else sortOrder.value = null
}
</script>

<template>
  <div class="page-root">
    <!-- Filter bar -->
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <h2 class="text-base font-semibold leading-none">Accounts Structure</h2>
        <p class="text-xs text-muted-foreground">Hierarchical view of directories and subaccounts</p>
      </div>
      <div v-if="tree" class="flex gap-4 text-xs text-muted-foreground">
        <span><strong class="text-foreground">{{ totalDirectories }}</strong> directories</span>
        <span><strong class="text-foreground">{{ totalSubaccounts }}</strong> subaccounts</span>
      </div>
    </div>

  <div class="page-content">
    <!-- Empty state — no account selected -->
    <div
      v-if="!accountId"
      class="flex h-[400px] items-center justify-center rounded-md border border-dashed"
    >
      <div class="text-center">
        <h3 class="text-lg font-semibold">No Account Selected</h3>
        <p class="text-sm text-muted-foreground mt-1">Select a BTP Account from the sidebar.</p>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-else-if="isLoading" class="space-y-3">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-10 w-11/12 ml-6" />
      <Skeleton class="h-10 w-10/12 ml-10" />
      <Skeleton class="h-10 w-11/12 ml-6" />
      <Skeleton class="h-10 w-10/12 ml-10" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex h-[200px] items-center justify-center rounded-md border border-dashed border-destructive/40"
    >
      <div class="text-center space-y-1">
        <p class="text-sm font-medium text-destructive">Failed to load account structure</p>
        <p class="text-xs text-muted-foreground">{{ (error as any)?.response?.data?.message ?? (error as Error).message }}</p>
      </div>
    </div>

    <!-- Account tree -->
    <div v-else-if="displayTree" class="rounded-md border bg-card">
      <!-- Global Account root row -->
      <div class="flex items-center gap-4 p-4 border-b">
        <div class="bg-primary/10 p-2.5 rounded-md shrink-0">
          <Globe class="h-5 w-5 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base font-semibold">{{ displayTree.displayName }}</span>
            <Badge :variant="stateVariant(displayTree.state)">{{ displayTree.state }}</Badge>
            <Badge v-if="displayTree.contractStatus" variant="outline" class="text-[10px]">
              {{ displayTree.contractStatus }}
            </Badge>
          </div>
          <div class="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
            <span class="font-mono">{{ displayTree.guid }}</span>
            <span v-if="displayTree.region">{{ displayTree.region }}</span>
            <span v-if="displayTree.commercialModel">{{ displayTree.commercialModel }}</span>
          </div>
        </div>
      </div>

      <!-- Label filter chips -->
      <div v-if="availableLabelChips.length" class="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b bg-muted/10">
        <span class="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mr-1">Labels:</span>
        <button
          v-for="chip in availableLabelChips"
          :key="chip"
          type="button"
          class="px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
          :class="selectedLabels.includes(chip)
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'"
          @click="toggleLabel(chip)"
        >
          {{ chip }}
        </button>
        <button
          v-if="selectedLabels.length"
          type="button"
          class="px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          @click="selectedLabels = []"
        >
          Clear
        </button>
      </div>

      <!-- Toolbar: search + expand/collapse + sort -->
      <div class="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
        <div class="relative flex-1 max-w-xs">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchQuery"
            placeholder="Search..."
            class="pl-8 h-8 text-sm"
          />
        </div>
        <div class="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-xs"
            @click="expandGeneration++"
          >
            <ChevronsDown class="h-3.5 w-3.5" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-xs"
            @click="collapseGeneration++"
          >
            <ChevronsUp class="h-3.5 w-3.5" />
            Collapse All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-xs"
            :class="sortOrder ? 'text-primary' : ''"
            @click="toggleSort"
          >
            <ArrowUpAZ v-if="sortOrder !== 'desc'" class="h-3.5 w-3.5" />
            <ArrowDownAZ v-else class="h-3.5 w-3.5" />
            {{ sortOrder === 'asc' ? 'A → Z' : sortOrder === 'desc' ? 'Z → A' : 'Sort' }}
          </Button>
        </div>
      </div>

      <!-- Tree nodes -->
      <div class="py-2">
        <AccountTreeNode
          v-for="dir in displayTree.childDirs"
          :key="dir.guid"
          :node="dir"
          :depth="0"
          :selected-guid="selectedNode?.guid"
          :expand-generation="expandGeneration"
          :collapse-generation="collapseGeneration"
          @select="selectedNode = $event"
        />
        <AccountTreeNode
          v-for="sub in displayTree.childSubs"
          :key="sub.guid"
          :node="sub"
          :depth="0"
          :selected-guid="selectedNode?.guid"
          :expand-generation="expandGeneration"
          :collapse-generation="collapseGeneration"
          @select="selectedNode = $event"
        />

        <!-- Empty / no results -->
        <p
          v-if="displayTree.childDirs.length === 0 && displayTree.childSubs.length === 0"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          {{ searchQuery.trim() ? 'No results match your search.' : 'No directories or subaccounts found.' }}
        </p>
      </div>
    </div>
  </div>

  <!-- Subaccount detail dialog -->
  <Dialog :open="!!selectedNode" @update:open="(val) => !val && (selectedNode = null)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-xl">
          <Server class="h-5 w-5 text-blue-500" />
          {{ selectedNode?.displayName }}
        </DialogTitle>
        <DialogDescription class="hidden">Subaccount details</DialogDescription>
      </DialogHeader>

      <div v-if="selectedNode" class="space-y-5 mt-2">
        <!-- State + region row -->
        <div class="flex items-center gap-3 flex-wrap">
          <Badge :variant="stateVariant(selectedNode.state)">{{ selectedNode.state }}</Badge>
          <span v-if="selectedNode.stateMessage" class="text-xs text-muted-foreground">
            {{ selectedNode.stateMessage }}
          </span>
          <div class="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <MapPin class="h-3.5 w-3.5" />
            {{ selectedNode.region }}
          </div>
        </div>

        <!-- Description -->
        <p v-if="selectedNode.description" class="text-sm text-muted-foreground">
          {{ selectedNode.description }}
        </p>

        <!-- Key-value grid -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm bg-muted/30 rounded-lg p-4 border">
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">GUID</p>
            <p class="font-mono text-xs break-all">{{ selectedNode.guid }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Subdomain</p>
            <p class="font-mono text-xs">{{ selectedNode.subdomain || '—' }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Technical Name</p>
            <p class="font-mono text-xs">{{ selectedNode.technicalName || '—' }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Used for Production</p>
            <p class="text-xs">{{ selectedNode.usedForProduction || '—' }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Beta Enabled</p>
            <p class="text-xs">{{ selectedNode.betaEnabled ? 'Yes' : 'No' }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Parent GUID</p>
            <p class="font-mono text-xs truncate" :title="selectedNode.parentGUID">
              {{ selectedNode.parentGUID || '—' }}
            </p>
          </div>
        </div>

        <!-- Dates + created by -->
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div class="flex items-start gap-2">
            <CalendarDays class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p class="text-xs text-muted-foreground">Created</p>
              <p class="font-medium text-xs">{{ formatDate(selectedNode.createdDate) }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <CalendarDays class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p class="text-xs text-muted-foreground">Modified</p>
              <p class="font-medium text-xs">{{ formatDate(selectedNode.modifiedDate) }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <User class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p class="text-xs text-muted-foreground">Created by</p>
              <p class="font-medium text-xs break-all">{{ selectedNode.createdBy || '—' }}</p>
            </div>
          </div>
        </div>

        <!-- Labels -->
        <div v-if="selectedNode.labels && Object.keys(selectedNode.labels).length > 0">
          <div class="flex items-center gap-1.5 mb-2">
            <Tag class="h-4 w-4 text-muted-foreground" />
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <template v-for="(values, key) in selectedNode.labels" :key="key">
              <Badge
                v-for="val in values"
                :key="val"
                variant="secondary"
                class="text-[11px] font-normal"
              >
                {{ key }}: {{ val }}
              </Badge>
            </template>
          </div>
        </div>

        <!-- Entitlements -->
        <div class="border-t pt-4 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ showEntitlements ? 'Service entitlements assigned to this subaccount.' : 'Show service entitlements assigned to this subaccount.' }}
            </p>
            <Button variant="outline" size="sm" @click="showEntitlements = !showEntitlements">
              {{ showEntitlements ? 'Hide Entitlements' : 'View Entitlements' }}
            </Button>
          </div>

          <div v-if="showEntitlements">
            <div v-if="entLoading" class="space-y-2">
              <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
            </div>
            <p v-else-if="activeEntitlements.length === 0" class="text-xs text-muted-foreground text-center py-4">
              No entitlements assigned to this subaccount.
            </p>
            <div v-else class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              <div
                v-for="(ent, i) in activeEntitlements"
                :key="i"
                class="flex items-center gap-3 text-xs px-3 py-2 rounded-md bg-muted/30 border"
              >
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{{ ent.service }}</p>
                  <p class="text-muted-foreground truncate">{{ ent.plan }}</p>
                </div>
                <Badge
                  :variant="ent.state === 'OK' ? 'success' : ent.state?.includes('FAILED') ? 'destructive' : 'warning'"
                  class="text-[10px] shrink-0"
                >
                  {{ ent.state }}
                </Badge>
                <span class="text-muted-foreground shrink-0 font-mono min-w-[2rem] text-right">
                  {{ ent.unlimited ? '∞' : ent.amount ?? '—' }}
                </span>
                <Badge v-if="ent.autoAssigned" variant="outline" class="text-[10px] shrink-0">auto</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</div><!-- end page-root -->
</template>
