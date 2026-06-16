import { create } from 'zustand'

const STORAGE_KEY = 'meality_admin_token'
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000 // 30 минут

export const useAdminStore = create((set, get) => ({
  token: sessionStorage.getItem(STORAGE_KEY),
  name: null,
  lastActivity: Date.now(),
  _inactivityTimer: null,

  login(token, name) {
    sessionStorage.setItem(STORAGE_KEY, token)
    set({ token, name, lastActivity: Date.now() })
    get()._resetInactivityTimer()
  },

  logout() {
    sessionStorage.removeItem(STORAGE_KEY)
    const timer = get()._inactivityTimer
    if (timer) clearTimeout(timer)
    set({ token: null, name: null, _inactivityTimer: null })
  },

  refreshToken(token) {
    sessionStorage.setItem(STORAGE_KEY, token)
    set({ token, lastActivity: Date.now() })
    get()._resetInactivityTimer()
  },

  recordActivity() {
    set({ lastActivity: Date.now() })
    get()._resetInactivityTimer()
  },

  _resetInactivityTimer() {
    const prev = get()._inactivityTimer
    if (prev) clearTimeout(prev)
    const timer = setTimeout(() => {
      get().logout()
      window.location.href = '/admin/login?reason=inactivity'
    }, INACTIVITY_LIMIT_MS)
    set({ _inactivityTimer: timer })
  },

  isAuthenticated() {
    return Boolean(get().token)
  },
}))
