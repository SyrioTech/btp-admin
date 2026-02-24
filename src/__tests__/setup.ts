import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

// Reset Pinia before every test so stores don't bleed between tests
beforeEach(() => {
  setActivePinia(createPinia())
})

// Silence console.error noise from Vue warnings in tests unless explicitly needed
config.global.config.warnHandler = () => {}

// Stub out vue-sonner so toast calls in components don't throw
vi.mock('vue-sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: { template: '<div />' },
}))
