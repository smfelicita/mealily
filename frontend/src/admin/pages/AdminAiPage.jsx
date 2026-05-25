import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

const PERIODS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: '7 дней' },
  { value: 'month', label: '30 дней' },
]

function adminFetch(path, token) {
  return fetch('/api/admin' + path, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
}

function fmtCost(cost) {
  return '$' + (cost ?? 0).toFixed(4)
}

function fmtDate(d) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-bg-2 border border-border rounded-xl p-4">
      <p className="text-xs text-text-2 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text">{value}</p>
      {sub && <p className="text-xs text-text-2 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminAiPage() {
  const token = useAdminStore(s => s.token)
  const [period, setPeriod] = useState('today')
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const LIMIT = 50

  const loadStats = useCallback(async () => {
    const data = await adminFetch(`/analytics/ai?period=${period}`, token)
    setStats(data)
  }, [token, period])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch(`/analytics/ai/requests?limit=${LIMIT}&offset=${offset}`, token)
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, offset])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRows() }, [loadRows])
  useEffect(() => { setOffset(0) }, [period])

  const pages = Math.ceil(total / LIMIT)
  const page = Math.floor(offset / LIMIT) + 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">AI — статистика</h1>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                period === p.value ? 'bg-accent text-white' : 'bg-bg-2 text-text-2 hover:bg-bg border border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Запросы" value={stats.requests} />
          <StatCard label="Input токены" value={(stats.inputTokens ?? 0).toLocaleString('ru')} />
          <StatCard label="Output токены" value={(stats.outputTokens ?? 0).toLocaleString('ru')} />
          <StatCard label="Стоимость" value={fmtCost(stats.cost)} />
          <StatCard label="Ошибки" value={stats.errors} sub={stats.requests > 0 ? `${((stats.errors / stats.requests) * 100).toFixed(1)}%` : null} />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Последние запросы</h2>
        <p className="text-sm text-text-2">Всего: {total}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-text-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Дата</th>
              <th className="px-3 py-2 text-left font-medium">Пользователь</th>
              <th className="px-3 py-2 text-left font-medium">Модель</th>
              <th className="px-3 py-2 text-right font-medium">In</th>
              <th className="px-3 py-2 text-right font-medium">Out</th>
              <th className="px-3 py-2 text-right font-medium">Стоимость</th>
              <th className="px-3 py-2 text-center font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-text-2">Нет данных</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-bg-2 transition-colors">
                <td className="px-3 py-2 text-text-2 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2 text-text-2 font-mono text-xs">{r.userId ? r.userId.slice(-8) : '—'}</td>
                <td className="px-3 py-2 text-text-2 text-xs">{r.model}</td>
                <td className="px-3 py-2 text-right">{(r.inputTokens ?? 0).toLocaleString('ru')}</td>
                <td className="px-3 py-2 text-right">{(r.outputTokens ?? 0).toLocaleString('ru')}</td>
                <td className="px-3 py-2 text-right">{fmtCost(r.cost)}</td>
                <td className="px-3 py-2 text-center">
                  {r.status === 'success' ? (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">ok</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs" title={r.errorMessage || ''}>err</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            className="px-3 py-1.5 text-sm bg-bg-2 border border-border rounded-lg disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-sm text-text-2">{page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setOffset(o => o + LIMIT)}
            className="px-3 py-1.5 text-sm bg-bg-2 border border-border rounded-lg disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  )
}
