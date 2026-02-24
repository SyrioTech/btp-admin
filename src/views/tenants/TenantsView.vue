<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useTenants } from '@/composables/useTenants'
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
import { Plus } from 'lucide-vue-next'

const router = useRouter()
const { tenants, createTenant, updateTenant } = useTenants()

// --- Create dialog ---
const createOpen = ref(false)
const createSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  }),
)
const { handleSubmit, defineField, errors, resetForm } = useForm({
  validationSchema: createSchema,
})
const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')

const onCreateSubmit = handleSubmit(async (values) => {
  try {
    await createTenant.mutateAsync(values)
    toast.success(`Tenant "${values.name}" created`)
    createOpen.value = false
    resetForm()
  } catch {
    toast.error('Failed to create tenant')
  }
})

function navigateToDetail(id: string) {
  router.push(`/tenants/${id}`)
}

async function toggleActive(id: string, current: boolean) {
  try {
    await updateTenant.mutateAsync({ id, dto: { isActive: !current } })
    toast.success(current ? 'Tenant deactivated' : 'Tenant activated')
  } catch {
    toast.error('Failed to update tenant')
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Tenants</h1>
        <p class="text-sm text-muted-foreground">Manage all tenants in the system</p>
      </div>

      <Dialog v-model:open="createOpen">
        <DialogTrigger as-child>
          <Button size="sm">
            <Plus class="mr-1.5 h-4 w-4" />
            New Tenant
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
          </DialogHeader>
          <form class="space-y-4 py-2" @submit="onCreateSubmit">
            <div class="space-y-2">
              <Label for="t-name">Name</Label>
              <Input id="t-name" v-model="name" v-bind="nameAttrs" placeholder="Acme Corp" />
              <p v-if="errors.name" class="text-xs text-destructive">{{ errors.name }}</p>
            </div>
            <div class="space-y-2">
              <Label for="t-slug">Slug</Label>
              <Input id="t-slug" v-model="slug" v-bind="slugAttrs" placeholder="acme-corp" />
              <p v-if="errors.slug" class="text-xs text-destructive">{{ errors.slug }}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="createOpen = false">Cancel</Button>
              <Button type="submit" :disabled="createTenant.isPending.value">
                {{ createTenant.isPending.value ? 'Creating…' : 'Create' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div v-if="tenants.isLoading.value" class="text-sm text-muted-foreground">Loading…</div>
    <div v-else-if="tenants.error.value" class="text-sm text-destructive">
      Failed to load tenants.
    </div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="tenant in tenants.data.value"
          :key="tenant.id"
          class="cursor-pointer hover:bg-muted/50"
          @click="navigateToDetail(tenant.id)"
        >
          <TableCell class="font-medium">{{ tenant.name }}</TableCell>
          <TableCell class="font-mono text-xs text-muted-foreground">{{ tenant.slug }}</TableCell>
          <TableCell>
            <Badge :variant="tenant.isActive ? 'default' : 'secondary'">
              {{ tenant.isActive ? 'Active' : 'Inactive' }}
            </Badge>
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">
            {{ new Date(tenant.createdAt).toLocaleDateString() }}
          </TableCell>
          <TableCell>
            <Button
              size="sm"
              variant="ghost"
              class="h-7 text-xs"
              @click.stop="toggleActive(tenant.id, tenant.isActive)"
            >
              {{ tenant.isActive ? 'Deactivate' : 'Activate' }}
            </Button>
          </TableCell>
        </TableRow>
        <TableRow v-if="!tenants.data.value?.length">
          <TableCell colspan="5" class="py-8 text-center text-muted-foreground">
            No tenants yet. Create one to get started.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
