import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

const ROLES = ['USER', 'PRO', 'ADMIN']

function adminFetch(path, token, options = {}) {
  return fetch('/api/admin' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(r => r.json())
}

function fmt(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function AdminUsersPage() {
  const token = useAdminStore(s => s.token)

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState(null)

  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      if (q) params.set('q', q)
      if (role) params.set('role', role)
      const data = await adminFetch(`/users?${params}`, token)
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, q, role, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, role])

  async function changeRole(id, newRole) {
    setActionId(id)
    try {
      const res = await adminFetch(`/users/${id}/role`, token, { method: 'PATCH', body: { role: newRole } })
      if (res.id) setUsers(prev => prev.map(u => u.id === id ? { ...u, role: res.role } : u))
      else alert(res.error || 'Ошибка')
    } finally {
      setActionId(null)
    }
  }

  async function toggleDeactivate(id, isActive) {
    const msg = isActive ? 'Разблокировать пользователя?' : 'Заблокировать пользователя? Все его сессии будут завершены.'
    if (!confirm(msg)) return
    setActionId(id)
    try {
      const res = await adminFetch(`/users/${id}/deactivate`, token, { method: 'PATCH' })
      if (res.id !== undefined) setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: res.isActive } : u))
      else alert(res.error || 'Ошибка')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-text">Пользователи</h2>
        <span className="text-sm text-text-2">{total} чел.</span>
      </div>

      {/* Фильтры */}
      <div className="flex gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Email или имя..."
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent w-56"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent"
        >
          <option value="">Все роли</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Пользователь</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Роль</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Провайдеры</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">AI сегодня</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Активность</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Регистрация</th>
              <th className="px-4 py-2.5 font-medium text-text-2">Блюд / Групп</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Ничего не найдено</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-bg-2 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-text">{u.name || <span className="text-text-2">—</span>}</p>
                  <p className="text-xs text-text-2">{u.email || '—'}</p>
                  {!u.isActive && <span className="text-xs text-red-400 font-medium">заблокирован</span>}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.id, e.target.value)}
                    disabled={actionId === u.id}
                    className="px-2 py-1 rounded border border-border bg-bg text-text text-xs outline-none focus:border-accent disabled:opacity-50"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-xs text-text-2">
                  <div className="flex gap-1 flex-wrap">
                    {u.emailVerified && <span className="bg-bg-2 border border-border rounded px-1.5 py-0.5">email</span>}
                    {u.googleId && <span className="bg-bg-2 border border-border rounded px-1.5 py-0.5">google</span>}
                    {u.telegramId && (
                      <span className="bg-bg-2 border border-border rounded px-1.5 py-0.5">
                        tg{u.telegramUsername ? ` @${u.telegramUsername}` : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-text-2 text-center">{u.aiMessagesDay}</td>
                <td className="px-4 py-2.5 text-text-2 text-xs">{fmt(u.lastActiveAt)}</td>
                <td className="px-4 py-2.5 text-text-2 text-xs">{fmt(u.createdAt)}</td>
                <td className="px-4 py-2.5 text-center text-text-2 text-xs">
                  {u._count.dishes} / {u._count.groupMembers}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleDeactivate(u.id, u.isActive)}
                    disabled={actionId === u.id}
                    className={`text-xs px-2.5 py-1 rounded border disabled:opacity-40 transition-colors ${
                      u.isActive
                        ? 'border-red-300 text-red-500 hover:bg-red-50'
                        : 'border-border text-text-2 hover:bg-bg-2'
                    }`}
                  >
                    {actionId === u.id ? '...' : u.isActive ? 'Блок.' : 'Разблок.'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {total > LIMIT && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded border border-border text-text-2 disabled:opacity-40"
          >← Назад</button>
          <span className="text-text-2">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} из {total}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * LIMIT >= total}
            className="px-3 py-1.5 rounded border border-border text-text-2 disabled:opacity-40"
          >Вперёд →</button>
        </div>
      )}
    </div>
  )
}
