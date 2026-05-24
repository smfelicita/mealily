import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

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

export default function AdminGroupsPage() {
  const token = useAdminStore(s => s.token)

  const [groups, setGroups] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState(null)

  // Transfer ownership modal state
  const [transferGroup, setTransferGroup] = useState(null)
  const [newOwnerId, setNewOwnerId] = useState('')

  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      if (q) params.set('q', q)
      if (type) params.set('type', type)
      const data = await adminFetch(`/groups?${params}`, token)
      setGroups(data.groups || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, q, type, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, type])

  async function deleteGroup(id, name) {
    if (!confirm(`Удалить группу «${name}»? Все данные группы будут удалены.`)) return
    setActionId(id)
    try {
      const res = await adminFetch(`/groups/${id}`, token, { method: 'DELETE' })
      if (res.ok) {
        setGroups(prev => prev.filter(g => g.id !== id))
        setTotal(t => t - 1)
      } else {
        alert(res.error || 'Ошибка удаления')
      }
    } finally {
      setActionId(null)
    }
  }

  async function resetInvite(id) {
    setActionId(id)
    try {
      const res = await adminFetch(`/groups/${id}/reset-invite`, token, { method: 'PATCH' })
      if (res.joinCode) {
        setGroups(prev => prev.map(g =>
          g.id === id ? { ...g, joinCode: res.joinCode, joinCodeExpiresAt: res.joinCodeExpiresAt } : g
        ))
      } else {
        alert(res.error || 'Ошибка')
      }
    } finally {
      setActionId(null)
    }
  }

  async function transferOwner() {
    if (!newOwnerId) return
    setActionId(transferGroup.id)
    try {
      const res = await adminFetch(`/groups/${transferGroup.id}/owner`, token, {
        method: 'PATCH',
        body: { userId: newOwnerId },
      })
      if (res.ok) {
        const member = transferGroup.members.find(m => m.userId === newOwnerId)
        setGroups(prev => prev.map(g =>
          g.id === transferGroup.id
            ? { ...g, owner: { id: newOwnerId, name: '(обновлено)', email: '' } }
            : g
        ))
        setTransferGroup(null)
        setNewOwnerId('')
        load()
      } else {
        alert(res.error || 'Ошибка')
      }
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-text">Группы</h2>
        <span className="text-sm text-text-2">{total} шт.</span>
      </div>

      {/* Фильтры */}
      <div className="flex gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Название..."
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent w-56"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent"
        >
          <option value="">Все типы</option>
          <option value="FAMILY">FAMILY</option>
          <option value="REGULAR">REGULAR</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Название</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Тип</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Владелец</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Участники</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Invite code</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Создана</th>
              <th className="px-4 py-2.5 font-medium text-text-2">Блюд</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && groups.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Ничего не найдено</td></tr>
            )}
            {groups.map(g => (
              <tr key={g.id} className="hover:bg-bg-2 transition-colors">
                <td className="px-4 py-2.5 font-medium text-text">{g.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    g.type === 'FAMILY'
                      ? 'border-accent text-accent'
                      : 'border-border text-text-2'
                  }`}>{g.type}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-text-2">
                  <p>{g.owner?.name || '—'}</p>
                  <p className="text-border">{g.owner?.email}</p>
                </td>
                <td className="px-4 py-2.5 text-center text-text-2">{g.members.length}</td>
                <td className="px-4 py-2.5 text-xs text-text-2">
                  {g.type === 'REGULAR' ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{g.joinCode || '—'}</span>
                      {g.joinCodeExpiresAt && (
                        <span className="text-border">до {fmt(g.joinCodeExpiresAt)}</span>
                      )}
                      <button
                        onClick={() => resetInvite(g.id)}
                        disabled={actionId === g.id}
                        className="text-accent hover:underline disabled:opacity-40 text-xs"
                      >сбросить</button>
                    </div>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-text-2 text-xs">{fmt(g.createdAt)}</td>
                <td className="px-4 py-2.5 text-center text-text-2">{g._count.dishes}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setTransferGroup(g); setNewOwnerId('') }}
                      className="text-xs text-accent hover:underline"
                    >Передать</button>
                    <button
                      onClick={() => deleteGroup(g.id, g.name)}
                      disabled={actionId === g.id}
                      className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >{actionId === g.id ? '...' : 'Удалить'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {total > LIMIT && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded border border-border text-text-2 disabled:opacity-40">← Назад</button>
          <span className="text-text-2">{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} из {total}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}
            className="px-3 py-1.5 rounded border border-border text-text-2 disabled:opacity-40">Вперёд →</button>
        </div>
      )}

      {/* Transfer ownership modal */}
      {transferGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-bg rounded-2xl border border-border p-6 w-96 shadow-xl">
            <h3 className="font-semibold text-text mb-1">Передать владение</h3>
            <p className="text-text-2 text-sm mb-4">Группа: <strong>{transferGroup.name}</strong></p>
            <p className="text-sm text-text-2 mb-2">Выбери нового владельца из участников:</p>
            <select
              value={newOwnerId}
              onChange={e => setNewOwnerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent mb-4"
            >
              <option value="">— выбери участника —</option>
              {transferGroup.members
                .filter(m => m.userId !== transferGroup.owner?.id)
                .map(m => (
                  <option key={m.userId} value={m.userId}>{m.userId}</option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setTransferGroup(null)}
                className="px-4 py-2 rounded-lg border border-border text-text-2 text-sm"
              >Отмена</button>
              <button
                onClick={transferOwner}
                disabled={!newOwnerId || actionId === transferGroup.id}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
              >{actionId === transferGroup.id ? '...' : 'Передать'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
