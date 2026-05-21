import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAdminStore } from './adminStore'

const NAV = [
  { to: '/admin/ingredients', label: 'Ингредиенты' },
  { to: '/admin/users',       label: 'Пользователи' },
  { to: '/admin/dishes',      label: 'Блюда' },
  { to: '/admin/groups',      label: 'Группы' },
  { to: '/admin/ai',          label: 'AI-статистика' },
  { to: '/admin/analytics',   label: 'Аналитика' },
  { to: '/admin/logs',        label: 'Логи' },
]

export default function AdminLayout() {
  const { token, name, logout, recordActivity } = useAdminStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) navigate('/admin/login', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, recordActivity))
  }, [recordActivity])

  if (!token) return null

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <aside className="w-52 shrink-0 flex flex-col border-r border-border bg-bg-2">
        <div className="px-4 py-5 border-b border-border">
          <p className="font-semibold text-accent text-sm">MealBot Admin</p>
          {name && <p className="text-xs text-text-2 mt-0.5">{name}</p>}
        </div>
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-accent text-white' : 'text-text hover:bg-bg'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-bg transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
