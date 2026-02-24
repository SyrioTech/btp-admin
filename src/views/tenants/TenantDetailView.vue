<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useTenant } from '@/composables/useTenants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import BtpAccountsTab from '@/views/btp-accounts/BtpAccountsTab.vue'
import UsersTab from '@/views/users/UsersTab.vue'
import { ArrowLeft } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

const route = useRoute()
const tenantId = computed(() => route.params.id as string)

const { data: tenant, isLoading, error } = useTenant(tenantId)
</script>

<template>
  <div class="p-6">
    <RouterLink
      to="/tenants"
      class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      Tenants
    </RouterLink>

    <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>
    <div v-else-if="error" class="text-sm text-destructive">Failed to load tenant.</div>
    <template v-else-if="tenant">
      <div class="mb-6">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">{{ tenant.name }}</h1>
          <Badge :variant="tenant.isActive ? 'default' : 'secondary'">
            {{ tenant.isActive ? 'Active' : 'Inactive' }}
          </Badge>
        </div>
        <p class="mt-0.5 font-mono text-sm text-muted-foreground">{{ tenant.slug }}</p>
      </div>

      <Tabs default-value="accounts">
        <TabsList>
          <TabsTrigger value="accounts">BTP Accounts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" class="mt-4">
          <BtpAccountsTab :tenant-id="tenantId" />
        </TabsContent>
        <TabsContent value="users" class="mt-4">
          <UsersTab :tenant-id="tenantId" />
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
