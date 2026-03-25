<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import syrioIcon from '@/assets/syrio-icon.png'

const schema = toTypedSchema(
  z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    tenantSlug: z.string().min(1, 'Tenant slug is required'),
  }),
)

const { handleSubmit, defineField, errors } = useForm({ validationSchema: schema })
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [tenantSlug, tenantSlugAttrs] = defineField('tenantSlug')

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const serverError = ref('')

const onSubmit = handleSubmit(async (values) => {
  loading.value = true
  serverError.value = ''
  try {
    const { accessToken, user } = await authApi.login(values)
    auth.setAuth(accessToken, user)
    await router.push('/')
  } catch (err: any) {
    if (err.response?.status === 401) {
      serverError.value = 'Invalid credentials. Please check your email, password, and tenant.'
    } else {
      serverError.value = 'An unexpected error occurred. Please try again.'
      toast.error('Login failed')
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-sidebar p-4">
    <div class="w-full max-w-sm space-y-6">
      <!-- Brand header -->
      <div class="flex flex-col items-center gap-3">
        <div class="h-16 w-16 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-sidebar-accent/20">
          <img :src="syrioIcon" class="h-full w-full object-cover" alt="Syrio" />
        </div>
        <div class="text-center">
          <h1 class="text-lg font-bold text-sidebar-foreground">BTP Inspector</h1>
          <p class="text-xs text-sidebar-muted">Syrio Administration Portal</p>
        </div>
      </div>

    <Card class="w-full border-sidebar-border bg-background shadow-xl">
      <CardHeader class="space-y-1">
        <CardTitle class="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your credentials to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit="onSubmit">
          <div class="space-y-2">
            <Label for="tenantSlug">Tenant</Label>
            <Input
              id="tenantSlug"
              v-model="tenantSlug"
              v-bind="tenantSlugAttrs"
              placeholder="my-tenant"
              autocomplete="organization"
            />
            <p v-if="errors.tenantSlug" class="text-xs text-destructive">
              {{ errors.tenantSlug }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              placeholder="admin@example.com"
              autocomplete="email"
            />
            <p v-if="errors.email" class="text-xs text-destructive">
              {{ errors.email }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              v-bind="passwordAttrs"
              type="password"
              autocomplete="current-password"
            />
            <p v-if="errors.password" class="text-xs text-destructive">
              {{ errors.password }}
            </p>
          </div>

          <p v-if="serverError" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {{ serverError }}
          </p>

          <Button type="submit" variant="success" class="w-full" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>
    </Card>
    </div>
  </div>
</template>
