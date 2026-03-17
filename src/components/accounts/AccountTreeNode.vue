<script setup lang="ts">
import { ref, computed } from 'vue'
import AccountTreeNode from './AccountTreeNode.vue'
import { Badge } from '@/components/ui/badge'
import { Folder, FolderOpen, Database, ChevronRight, ChevronDown } from 'lucide-vue-next'
import type { Directory, Subaccount } from '@/api/types'

export type SubaccountNode = Subaccount & { type: 'subaccount' }
export type DirectoryNode = Directory & {
  type: 'directory'
  childDirs: DirectoryNode[]
  childSubs: SubaccountNode[]
}
export type TreeNode = DirectoryNode | SubaccountNode

defineOptions({ name: 'AccountTreeNode' })

const props = defineProps<{
  node: TreeNode
  depth?: number
  selectedGuid?: string | null
}>()

const emit = defineEmits<{
  select: [node: SubaccountNode]
}>()

const isExpanded = ref(true)
const d = computed(() => props.depth ?? 0)
const dir = computed(() => props.node as DirectoryNode)
const isDir = computed(() => props.node.type === 'directory')
const childCount = computed(() => dir.value.childDirs.length + dir.value.childSubs.length)
</script>

<template>
  <div>
    <!-- Directory -->
    <template v-if="isDir">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
        :style="{ paddingLeft: `${d * 20 + 8}px` }"
        @click="isExpanded = !isExpanded"
      >
        <ChevronDown v-if="isExpanded" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <ChevronRight v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <FolderOpen v-if="isExpanded" class="h-4 w-4 shrink-0 text-amber-500" />
        <Folder v-else class="h-4 w-4 shrink-0 text-amber-500" />
        <span class="font-medium flex-1 truncate">{{ node.displayName }}</span>
        <span v-if="childCount > 0" class="text-[10px] text-muted-foreground shrink-0">
          {{ childCount }}
        </span>
      </button>

      <div v-show="isExpanded">
        <AccountTreeNode
          v-for="child in dir.childDirs"
          :key="child.guid"
          :node="child"
          :depth="d + 1"
          :selected-guid="selectedGuid"
          @select="emit('select', $event)"
        />
        <AccountTreeNode
          v-for="sub in dir.childSubs"
          :key="sub.guid"
          :node="sub"
          :depth="d + 1"
          :selected-guid="selectedGuid"
          @select="emit('select', $event)"
        />
        <!-- Empty directory hint -->
        <p
          v-if="childCount === 0"
          class="text-xs text-muted-foreground py-1"
          :style="{ paddingLeft: `${(d + 1) * 20 + 28}px` }"
        >
          Empty directory
        </p>
      </div>
    </template>

    <!-- Subaccount leaf -->
    <button
      v-else
      type="button"
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors"
      :class="selectedGuid === node.guid ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
      :style="{ paddingLeft: `${d * 20 + 28}px` }"
      @click="emit('select', node as SubaccountNode)"
    >
      <Database class="h-4 w-4 shrink-0 text-blue-500" />
      <span class="flex-1 truncate">{{ node.displayName }}</span>
      <Badge
        :variant="node.state === 'OK' ? 'default' : 'outline'"
        class="text-[10px] shrink-0"
      >
        {{ node.state }}
      </Badge>
    </button>
  </div>
</template>
