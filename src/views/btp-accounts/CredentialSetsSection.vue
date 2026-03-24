<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useCredentialSets } from '@/composables/useBtpAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, FlaskConical, Trash2 } from 'lucide-vue-next'

const props = defineProps<{ accountId: string }>()

const { credentials, createCredential, testCredential, deleteCredential } =
  useCredentialSets(() => props.accountId)

// Test result per credential
const testResults = ref<Record<string, { success: boolean; message?: string }>>({})

async function runTest(credId: string) {
  try {
    const result = await testCredential.mutateAsync(credId)
    testResults.value[credId] = result
    if (result.success) toast.success('Credential test passed')
    else toast.error(`Test failed: ${result.message ?? 'Unknown error'}`)
  } catch {
    testResults.value[credId] = { success: false, message: 'Request failed' }
    toast.error('Test request failed')
  }
}

const deleteConfirmId = ref<string | null>(null)

async function confirmDelete() {
  if (!deleteConfirmId.value) return
  try {
    await deleteCredential.mutateAsync(deleteConfirmId.value)
    toast.success('Credential deleted')
  } catch {
    toast.error('Failed to delete credential')
  } finally {
    deleteConfirmId.value = null
  }
}

// --- Create dialog ---
const createOpen = ref(false)
const createSchema = toTypedSchema(
  z.object({
    credentialType: z.enum(['CIS', 'UDM', 'AUDIT_LOG']),
    tokenUrl: z.string().url('Must be a valid URL'),
    clientId: z.string().min(1, 'Required'),
    clientSecret: z.string().min(1, 'Required'),
    serviceUrl: z.string().url('Must be a valid URL'),
  }),
)
const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: createSchema,
})
const [credType] = defineField('credentialType')
const [tokenUrl, tokenUrlAttrs] = defineField('tokenUrl')
const [clientId, clientIdAttrs] = defineField('clientId')
const [clientSecret, clientSecretAttrs] = defineField('clientSecret')
const [serviceUrl, serviceUrlAttrs] = defineField('serviceUrl')

const credHelp: Record<string, string> = {
  CIS: 'Cloud Integration Suite — use the CIS service key from your BTP subaccount.',
  UDM: 'Unified Data Management — use the UDM service key from your BTP subaccount.',
  AUDIT_LOG: 'Audit Log Service — use the Audit Log OAuth2 credentials.',
}

const onCreateSubmit = handleSubmit(async (vals) => {
  try {
    await createCredential.mutateAsync(vals)
    toast.success('Credential added')
    createOpen.value = false
    resetForm()
  } catch {
    toast.error('Failed to add credential')
  }
})
</script>

<template>
  <div class="space-y-3 py-2 pl-4">
    <div class="flex items-center justify-between">
      <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Credential Sets
      </p>
      <Dialog v-model:open="createOpen">
        <DialogTrigger as-child>
          <Button size="sm" variant="success">
            <Plus class="mr-1.5 h-3.5 w-3.5" />
            Add Credential
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credential Set</DialogTitle>
          </DialogHeader>
          <form class="space-y-4 py-2" @submit="onCreateSubmit">
            <div class="space-y-2">
              <Label>Type</Label>
              <Select v-model="credType">
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIS">CIS</SelectItem>
                  <SelectItem value="UDM">UDM</SelectItem>
                  <SelectItem value="AUDIT_LOG">Audit Log</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="credType && credHelp[credType]" class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {{ credHelp[credType] }}
              </p>
              <p v-if="errors.credentialType" class="text-xs text-destructive">
                {{ errors.credentialType }}
              </p>
            </div>
            <div class="space-y-2">
              <Label>Token URL</Label>
              <Input v-model="tokenUrl" v-bind="tokenUrlAttrs" placeholder="https://…/oauth/token" />
              <p v-if="errors.tokenUrl" class="text-xs text-destructive">{{ errors.tokenUrl }}</p>
            </div>
            <div class="space-y-2">
              <Label>Client ID</Label>
              <Input v-model="clientId" v-bind="clientIdAttrs" autocomplete="off" />
              <p v-if="errors.clientId" class="text-xs text-destructive">{{ errors.clientId }}</p>
            </div>
            <div class="space-y-2">
              <Label>Client Secret</Label>
              <Input v-model="clientSecret" v-bind="clientSecretAttrs" type="password" autocomplete="off" />
              <p v-if="errors.clientSecret" class="text-xs text-destructive">{{ errors.clientSecret }}</p>
            </div>
            <div class="space-y-2">
              <Label>Service URL</Label>
              <Input v-model="serviceUrl" v-bind="serviceUrlAttrs" placeholder="https://…" />
              <p v-if="errors.serviceUrl" class="text-xs text-destructive">{{ errors.serviceUrl }}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="createOpen = false">Cancel</Button>
              <Button type="submit" :disabled="createCredential.isPending.value">
                {{ createCredential.isPending.value ? 'Adding…' : 'Add' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div v-if="credentials.isLoading.value" class="text-xs text-muted-foreground">Loading…</div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead class="text-xs">Type</TableHead>
          <TableHead class="text-xs">Status</TableHead>
          <TableHead class="text-xs">Created</TableHead>
          <TableHead class="text-xs">Test Result</TableHead>
          <TableHead class="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="cred in credentials.data.value" :key="cred.id">
          <TableCell class="font-mono text-xs font-medium">{{ cred.credentialType }}</TableCell>
          <TableCell>
            <Badge :variant="cred.isActive ? 'success' : 'secondary'" class="text-xs">
              {{ cred.isActive ? 'Active' : 'Inactive' }}
            </Badge>
          </TableCell>
          <TableCell class="text-xs text-muted-foreground">
            {{ new Date(cred.createdAt).toLocaleDateString() }}
          </TableCell>
          <TableCell>
            <template v-if="testResults[cred.id]">
              <Badge
                :variant="testResults[cred.id]?.success ? 'success' : 'destructive'"
                class="text-xs"
              >
                {{ testResults[cred.id]?.success ? 'Pass' : 'Fail' }}
              </Badge>
              <p v-if="!testResults[cred.id]?.success && testResults[cred.id]?.message" class="mt-1 text-xs text-destructive">
                {{ testResults[cred.id]?.message }}
              </p>
            </template>
            <span v-else class="text-xs text-muted-foreground">—</span>
          </TableCell>
          <TableCell class="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              class="h-7 w-7 p-0"
              title="Test credential"
              @click="runTest(cred.id)"
            >
              <FlaskConical class="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              class="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Delete credential"
              @click="deleteConfirmId = cred.id"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        </TableRow>
        <TableRow v-if="!credentials.data.value?.length">
          <TableCell colspan="5" class="py-4 text-center text-xs text-muted-foreground">
            No credentials configured.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- Delete confirmation dialog -->
    <Dialog :open="!!deleteConfirmId" @update:open="(v) => !v && (deleteConfirmId = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Credential</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          This action cannot be undone. The credential set will be permanently removed.
        </p>
        <DialogFooter>
          <Button variant="outline" @click="deleteConfirmId = null">Cancel</Button>
          <Button variant="destructive" :disabled="deleteCredential.isPending.value" @click="confirmDelete">
            {{ deleteCredential.isPending.value ? 'Deleting…' : 'Delete' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
