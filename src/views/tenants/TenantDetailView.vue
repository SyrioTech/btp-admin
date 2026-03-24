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
  <div class="page-root">
    <div class="page-filter-bar">
      <div class="mr-auto flex flex-col gap-0.5">
        <div v-if="isLoading" class="h-4 w-40 rounded bg-muted animate-pulse" />
        <template v-else-if="tenant">
          <div class="flex items-center gap-2 flex-wrap">
            <RouterLink
              to="/tenants"
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft class="h-3 w-3" />
              Tenants
            </RouterLink>
            <span class="text-muted-foreground text-xs">/</span>
            <h2 class="text-base font-semibold leading-none">{{ tenant.name }}</h2>
            <Badge :variant="tenant.isActive ? 'success' : 'secondary'">
              {{ tenant.isActive ? 'Active' : 'Inactive' }}
            </Badge>
          </div>
          <p class="font-mono text-xs text-muted-foreground">{{ tenant.slug }}</p>
        </template>
        <div v-else-if="error" class="text-sm text-destructive">Failed to load tenant.</div>
      </div>
    </div>

    <div class="page-content">
      <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>
      <template v-else-if="tenant">
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
  </div>
</template>
