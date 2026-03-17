import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'tenants',
          name: 'tenants',
          component: () => import('@/views/tenants/TenantsView.vue'),
        },
        {
          path: 'tenants/:id',
          name: 'tenant-detail',
          component: () => import('@/views/tenants/TenantDetailView.vue'),
        },
        {
          path: 'consumption',
          name: 'consumption',
          component: () => import('@/views/consumption/ConsumptionView.vue'),
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/accounts/AccountsView.vue'),
        },
        {
          path: 'events',
          name: 'events',
          component: () => import('@/views/events/EventsView.vue'),
        },
        {
          path: 'entitlements',
          name: 'entitlements',
          component: () => import('@/views/entitlements/EntitlementsView.vue'),
        },
        {
          path: 'audit',
          name: 'audit',
          component: () => import('@/views/audit/AuditView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) return '/login'
  if (to.path === '/login' && auth.token) return '/'
})

export default router
