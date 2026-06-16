import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminStore } from './adminStore'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAdminStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Ошибка входа')
        return
      }
      login(data.token, data.name)
      navigate('/admin/ingredients')
    } catch {
      setError('Нет соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm bg-bg-2 rounded-2xl p-8 border border-border">
        <h1 className="text-xl font-semibold text-text mb-1">Панель администратора</h1>
        <p className="text-sm text-text-2 mb-6">Meality Admin</p>

        {params.get('reason') === 'inactivity' && (
          <p className="text-sm text-amber-500 mb-4">Сессия завершена из-за неактивности</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-2 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-bg text-text text-sm outline-none focus:border-accent"
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-2 font-medium">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-bg text-text text-sm outline-none focus:border-accent"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 rounded-xl bg-accent text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
