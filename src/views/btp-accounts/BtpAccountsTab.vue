<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useBtpAccounts } from '@/composables/useBtpAccounts'
import CredentialSetsSection from './CredentialSetsSection.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ tenantId: string }>()

const { accounts, createAccount, updateAccount } = useBtpAccounts(() => props.tenantId)

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
}

// --- Create dialog ---
const createOpen = ref(false)
const createSchema = toTypedSchema(
  z.object({
    globalAccountId: z.string().min(1, 'Required'),
    displayName: z.string().min(1, 'Required'),
    region: z.string().min(1, 'Required'),
  }),
)
const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: createSchema,
})
const [globalAccountId, gaiAttrs] = defineField('globalAccountId')
const [displayName, dnAttrs] = defineField('displayName')
const [region, regionAttrs] = defineField('region')

const onCreateSubmit = handleSubmit(async (values) => {
  try {
    await createAccount.mutateAsync({ ...values, tenantId: props.tenantId })
    toast.success(`Account "${values.displayName}" added`)
    createOpen.value = false
    resetForm()
  } catch {
    toast.error('Failed to create account')
  }
})

async function toggleActive(id: string, current: boolean) {
  try {
    await updateAccount.mutateAsync({ id, dto: { isActive: !current } })
    toast.success(current ? 'Account deactivated' : 'Account activated')
  } catch {
    toast.error('Failed to update account')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">BTP accounts linked to this tenant</p>
      <Dialog v-model:open="createOpen">
        <DialogTrigger as-child>
          <Button size="sm">
            <Plus class="mr-1.5 h-4 w-4" />
            Add Account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BTP Account</DialogTitle>
          </DialogHeader>
          <form class="space-y-4 py-2" @submit="onCreateSubmit">
            <div class="space-y-2">
              <Label>Display Name</Label>
              <Input v-model="displayName" v-bind="dnAttrs" placeholder="Production GA" />
              <p v-if="errors.displayName" class="text-xs text-destructive">{{ errors.displayName }}</p>
            </div>
            <div class="space-y-2">
              <Label>Global Account ID</Label>
              <Input v-model="globalAccountId" v-bind="gaiAttrs" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <p v-if="errors.globalAccountId" class="text-xs text-destructive">{{ errors.globalAccountId }}</p>
            </div>
            <div class="space-y-2">
              <Label>Region</Label>
              <Input v-model="region" v-bind="regionAttrs" placeholder="eu10" />
              <p v-if="errors.region" class="text-xs text-destructive">{{ errors.region }}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="createOpen = false">Cancel</Button>
              <Button type="submit" :disabled="createAccount.isPending.value">
                {{ createAccount.isPending.value ? 'Adding…' : 'Add' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div v-if="accounts.isLoading.value" class="text-sm text-muted-foreground">Loading…</div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead class="w-8" />
          <TableHead>Display Name</TableHead>
          <TableHead>Global Account ID</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="account in accounts.data.value" :key="account.id">
          <TableRow class="cursor-pointer" @click="toggleExpand(account.id)">
            <TableCell>
              <component
                :is="expandedIds.has(account.id) ? ChevronDown : ChevronRight"
                class="h-4 w-4 text-muted-foreground"
              />
            </TableCell>
            <TableCell class="font-medium">{{ account.displayName }}</TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ account.globalAccountId }}
            </TableCell>
            <TableCell class="text-sm">{{ account.region }}</TableCell>
            <TableCell>
              <Badge :variant="account.isActive ? 'default' : 'secondary'">
                {{ account.isActive ? 'Active' : 'Inactive' }}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                class="h-7 text-xs"
                @click.stop="toggleActive(account.id, account.isActive)"
              >
                {{ account.isActive ? 'Deactivate' : 'Activate' }}
              </Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="expandedIds.has(account.id)">
            <TableCell colspan="6" class="bg-muted/30 p-0">
              <CredentialSetsSection :account-id="account.id" />
            </TableCell>
          </TableRow>
        </template>
        <TableRow v-if="!accounts.data.value?.length">
          <TableCell colspan="6" class="py-8 text-center text-muted-foreground">
            No BTP accounts yet.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
