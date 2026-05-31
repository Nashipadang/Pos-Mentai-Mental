import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export type UserRole = 'owner' | 'kasir' | 'staff'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        try {
          const resp = await api.post('/auth/login', { email, password })
          const { access_token, refresh_token, user } = resp.data.data
          
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          
          set({ user, accessToken: access_token, isAuthenticated: true })
          return { success: true }
        } catch (err: any) {
          const msg = err.response?.data?.message || 'Email atau password salah'
          return { success: false, error: msg }
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (e) {
          console.error("Gagal blacklist token di backend saat logout:", e)
        } finally {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null, accessToken: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
