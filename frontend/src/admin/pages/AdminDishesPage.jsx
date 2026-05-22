import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

const VISIBILITY = [
  { value: 'PRIVATE',    label: 'Личное'       },
  { value: 'FAMILY',     label: 'Семья'        },
  { value: 'ALL_GROUPS', label: 'Все группы'   },
  { value: 'PUBLIC',     label: 'Публичное'    },
]

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

export default function AdminDishesPage() {
  const token = useAdminStore(s => s.token)

  const [dishes, setDishes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [visibility, setVisibility] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState(null)

  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      if (q) params.set('q', q)
      if (visibility) params.set('visibility', visibility)
      const data = await adminFetch(`/dishes?${params}`, token)
      setDishes(data.dishes || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, q, visibility, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, visibility])

  async function changeVisibility(id, newVisibility) {
    setActionId(id)
    try {
      const res = await adminFetch(`/dishes/${id}/visibility`, token, {
        method: 'PATCH',
        body: { visibility: newVisibility },
      })
      if (res.id) setDishes(prev => prev.map(d => d.id === id ? { ...d, visibility: res.visibility } : d))
      else alert(res.error || 'Ошибка')
    } finally {
      setActionId(null)
    }
  }

  async function deleteDish(id, name) {
    if (!confirm(`Удалить блюдо «${name}»? Это действие необратимо.`)) return
    setActionId(id)
    try {
      const res = await adminFetch(`/dishes/${id}`, token, { method: 'DELETE' })
      if (res.ok) {
        setDishes(prev => prev.filter(d => d.id !== id))
        setTotal(t => t - 1)
      } else {
        alert(res.error || 'Ошибка удаления')
      }
    } finally {
      setActionId(null)
    }
  }

  const visLabel = v => VISIBILITY.find(x => x.value === v)?.label || v

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-text">Блюда</h2>
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
          value={visibility}
          onChange={e => setVisibility(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent"
        >
          <option value="">Вся видимость</option>
          {VISIBILITY.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Блюдо</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Автор</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Видимость</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Создано</th>
              <th className="px-4 py-2.5 font-medium text-text-2">Ингр. / Ком.</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && dishes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-2">Ничего не найдено</td></tr>
            )}
            {dishes.map(d => (
              <tr key={d.id} className="hover:bg-bg-2 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {(d.imageUrl || d.images?.[0]) ? (
                      <img
                        src={d.imageUrl || d.images[0]}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0 bg-bg-2"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-bg-2 border border-border shrink-0" />
                    )}
                    <span className="font-medium text-text">{d.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-text-2 text-xs">
                  {d.author ? (
                    <>
                      <p>{d.author.name || '—'}</p>
                      <p className="text-border">{d.author.email}</p>
                    </>
                  ) : (
                    <span className="text-accent font-medium">MealBot</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={d.visibility}
                    onChange={e => changeVisibility(d.id, e.target.value)}
                    disabled={actionId === d.id}
                    className="px-2 py-1 rounded border border-border bg-bg text-text text-xs outline-none focus:border-accent disabled:opacity-50"
                  >
                    {VISIBILITY.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-text-2 text-xs">{fmt(d.createdAt)}</td>
                <td className="px-4 py-2.5 text-center text-text-2 text-xs">
                  {d._count.ingredients} / {d._count.comments}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => deleteDish(d.id, d.name)}
                    disabled={actionId === d.id}
                    className="text-xs px-2.5 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {actionId === d.id ? '...' : 'Удалить'}
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
