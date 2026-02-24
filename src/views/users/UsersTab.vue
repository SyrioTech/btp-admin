<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useTenantUsers } from '@/composables/useTenants'
import type { ClientUser } from '@/api/types'
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
import { Plus, Pencil } from 'lucide-vue-next'

const props = defineProps<{ tenantId: string }>()

const { users, createUser, updateUser } = useTenantUsers(() => props.tenantId)

// --- Create dialog ---
const createOpen = ref(false)
const createSchema = toTypedSchema(
  z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'At least 8 characters'),
    role: z.enum(['admin', 'viewer']),
  }),
)
const createForm = useForm({ validationSchema: createSchema })
const [cEmail, cEmailAttrs] = createForm.defineField('email')
const [cPassword, cPasswordAttrs] = createForm.defineField('password')
const [cRole] = createForm.defineField('role')

const onCreateSubmit = createForm.handleSubmit(async (values) => {
  try {
    await createUser.mutateAsync(values)
    toast.success(`User ${values.email} created`)
    createOpen.value = false
    createForm.resetForm()
  } catch {
    toast.error('Failed to create user')
  }
})

// --- Edit dialog ---
const editOpen = ref(false)
const editingUser = ref<ClientUser | null>(null)
const editSchema = toTypedSchema(
  z.object({
    role: z.enum(['admin', 'viewer']),
    isActive: z.boolean(),
  }),
)
const editForm = useForm({ validationSchema: editSchema })
const [eRole] = editForm.defineField('role')
const [eIsActive, eIsActiveAttrs] = editForm.defineField('isActive')

function openEdit(user: ClientUser) {
  editingUser.value = user
  editForm.setValues({ role: user.role, isActive: user.isActive })
  editOpen.value = true
}

const onEditSubmit = editForm.handleSubmit(async (values) => {
  if (!editingUser.value) return
  try {
    await updateUser.mutateAsync({ userId: editingUser.value.id, dto: values })
    toast.success('User updated')
    editOpen.value = false
  } catch {
    toast.error('Failed to update user')
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">Manage users for this tenant</p>
      <Dialog v-model:open="createOpen">
        <DialogTrigger as-child>
          <Button size="sm">
            <Plus class="mr-1.5 h-4 w-4" />
            Add User
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form class="space-y-4 py-2" @submit="onCreateSubmit">
            <div class="space-y-2">
              <Label>Email</Label>
              <Input v-model="cEmail" v-bind="cEmailAttrs" type="email" placeholder="user@example.com" />
              <p v-if="createForm.errors.value.email" class="text-xs text-destructive">
                {{ createForm.errors.value.email }}
              </p>
            </div>
            <div class="space-y-2">
              <Label>Password</Label>
              <Input v-model="cPassword" v-bind="cPasswordAttrs" type="password" />
              <p v-if="createForm.errors.value.password" class="text-xs text-destructive">
                {{ createForm.errors.value.password }}
              </p>
            </div>
            <div class="space-y-2">
              <Label>Role</Label>
              <Select v-model="cRole">
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="createForm.errors.value.role" class="text-xs text-destructive">
                {{ createForm.errors.value.role }}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="createOpen = false">Cancel</Button>
              <Button type="submit" :disabled="createUser.isPending.value">
                {{ createUser.isPending.value ? 'Adding…' : 'Add User' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div v-if="users.isLoading.value" class="text-sm text-muted-foreground">Loading…</div>
    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="user in users.data.value" :key="user.id">
          <TableCell>{{ user.email }}</TableCell>
          <TableCell>
            <Badge variant="outline" class="capitalize">{{ user.role }}</Badge>
          </TableCell>
          <TableCell>
            <Badge :variant="user.isActive ? 'default' : 'secondary'">
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </Badge>
          </TableCell>
          <TableCell class="text-sm text-muted-foreground">
            {{ new Date(user.createdAt).toLocaleDateString() }}
          </TableCell>
          <TableCell>
            <Button size="sm" variant="ghost" class="h-7 w-7 p-0" @click="openEdit(user)">
              <Pencil class="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        </TableRow>
        <TableRow v-if="!users.data.value?.length">
          <TableCell colspan="5" class="py-8 text-center text-muted-foreground">
            No users yet.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- Edit dialog -->
    <Dialog v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form class="space-y-4 py-2" @submit="onEditSubmit">
          <p class="text-sm text-muted-foreground">{{ editingUser?.email }}</p>
          <div class="space-y-2">
            <Label>Role</Label>
            <Select v-model="eRole">
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-2">
            <input
              id="e-active"
              v-model="eIsActive"
              v-bind="eIsActiveAttrs"
              type="checkbox"
              class="h-4 w-4 rounded border-border"
            />
            <Label for="e-active">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="editOpen = false">Cancel</Button>
            <Button type="submit" :disabled="updateUser.isPending.value">
              {{ updateUser.isPending.value ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
