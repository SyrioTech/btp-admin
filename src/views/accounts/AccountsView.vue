<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBtpAccountStore } from '@/stores/btpAccount'
import { useGlobalAccount, useDirectories, useSubaccounts } from '@/composables/useAccountsBtp'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import AccountTreeNode from '@/components/accounts/AccountTreeNode.vue'
import type { SubaccountNode, DirectoryNode } from '@/components/accounts/AccountTreeNode.vue'
import type { GlobalAccount, Subaccount, Directory } from '@/api/types'
import { Globe, CalendarDays, User, MapPin, Server, Tag } from 'lucide-vue-next'

type GlobalAccountTree = GlobalAccount & {
  type: 'global_account'
  childDirs: DirectoryNode[]
  childSubs: SubaccountNode[]
}

const btpAccountStore = useBtpAccountStore()
const accountId = computed(() => btpAccountStore.selectedAccountId)

const { data: globalAccount, isLoading: isGlobalLoading } = useGlobalAccount(accountId)
const { data: directories, isLoading: isDirsLoading } = useDirectories(accountId)
const { data: subaccounts, isLoading: isSubsLoading } = useSubaccounts(accountId)

const isLoading = computed(
  () => isGlobalLoading.value || isDirsLoading.value || isSubsLoading.value,
)

const selectedNode = ref<SubaccountNode | null>(null)

// Build a proper nested hierarchy from the flat lists
const tree = computed((): GlobalAccountTree | null => {
  if (!globalAccount.value || !directories.value || !subaccounts.value) return null

  const globalGuid = globalAccount.value.guid

  // Build directory map with empty children arrays
  const dirMap = new Map<string, DirectoryNode>()
  directories.value.forEach((dir: Directory) => {
    dirMap.set(dir.guid, { ...dir, type: 'directory', childDirs: [], childSubs: [] })
  })

  // Place subaccounts under their parent directory, or at root
  const rootSubs: SubaccountNode[] = []
  subaccounts.value.forEach((sub: Subaccount) => {
    const node: SubaccountNode = { ...sub, type: 'subaccount' }
    if (sub.parentGUID && dirMap.has(sub.parentGUID)) {
      dirMap.get(sub.parentGUID)!.childSubs.push(node)
    } else {
      rootSubs.push(node)
    }
  })

  // Nest directories within their parent directory, or at root
  const rootDirs: DirectoryNode[] = []
  dirMap.forEach((dir) => {
    if (dir.parentGUID && dir.parentGUID !== globalGuid && dirMap.has(dir.parentGUID)) {
      dirMap.get(dir.parentGUID)!.childDirs.push(dir)
    } else {
      rootDirs.push(dir)
    }
  })

  return {
    ...globalAccount.value,
    type: 'global_account',
    childDirs: rootDirs,
    childSubs: rootSubs,
  }
})

const totalSubaccounts = computed(() => subaccounts.value?.length ?? 0)
const totalDirectories = computed(() => directories.value?.length ?? 0)

function formatDate(epoch?: number | string | null): string {
  if (!epoch) return '—'
  const d = new Date(epoch)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function stateVariant(state?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 'OK') return 'default'
  if (state?.includes('FAILED') || state === 'SUSPENDED') return 'destructive'
  return 'secondary'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Accounts Structure</h2>
        <p class="text-muted-foreground mt-1">
          Hierarchical view of directories and subaccounts in your global account.
        </p>
      </div>
      <div v-if="tree" class="flex gap-4 text-sm text-muted-foreground">
        <span><strong class="text-foreground">{{ totalDirectories }}</strong> directories</span>
        <span><strong class="text-foreground">{{ totalSubaccounts }}</strong> subaccounts</span>
      </div>
    </div>

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

    <!-- Account tree -->
    <div v-else-if="tree" class="rounded-md border bg-card">
      <!-- Global Account root row -->
      <div class="flex items-center gap-4 p-4 border-b">
        <div class="bg-primary/10 p-2.5 rounded-md shrink-0">
          <Globe class="h-5 w-5 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base font-semibold">{{ tree.displayName }}</span>
            <Badge :variant="stateVariant(tree.state)">{{ tree.state }}</Badge>
            <Badge v-if="tree.contractStatus" variant="outline" class="text-[10px]">
              {{ tree.contractStatus }}
            </Badge>
          </div>
          <div class="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
            <span class="font-mono">{{ tree.guid }}</span>
            <span v-if="tree.region">{{ tree.region }}</span>
            <span v-if="tree.commercialModel">{{ tree.commercialModel }}</span>
          </div>
        </div>
      </div>

      <!-- Tree nodes -->
      <div class="py-2">
        <AccountTreeNode
          v-for="dir in tree.childDirs"
          :key="dir.guid"
          :node="dir"
          :depth="0"
          :selected-guid="selectedNode?.guid"
          @select="selectedNode = $event"
        />
        <AccountTreeNode
          v-for="sub in tree.childSubs"
          :key="sub.guid"
          :node="sub"
          :depth="0"
          :selected-guid="selectedNode?.guid"
          @select="selectedNode = $event"
        />

        <!-- Empty global account -->
        <p
          v-if="tree.childDirs.length === 0 && tree.childSubs.length === 0"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          No directories or subaccounts found.
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

        <!-- Future: Entitlements -->
        <div class="flex items-center justify-between border-t pt-4">
          <p class="text-xs text-muted-foreground">
            Entitlements view coming soon for this subaccount.
          </p>
          <Button variant="outline" size="sm" disabled>
            View Entitlements
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
