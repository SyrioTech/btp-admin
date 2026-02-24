import api from '@/lib/axios'
import type { AuthUser, LoginDto } from './types'

export interface LoginResponse {
  access_token: string
  user: AuthUser
}

export const authApi = {
  login(dto: LoginDto): Promise<LoginResponse> {
    return api.post<LoginResponse>('/auth/login', dto).then((r) => r.data)
  },

  me(): Promise<AuthUser> {
    return api.get<AuthUser>('/auth/me').then((r) => r.data)
  },
}
