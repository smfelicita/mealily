import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

function adminFetch(path, token) {
  return fetch('/api/admin' + path, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
}

function fmtDate(d) {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function PayloadCell({ payload }) {
  const [open, setOpen] = useState(false)
  if (!payload) return <span className="text-text-2">—</span>
  const preview = JSON.stringify(payload)
  const short = preview.length > 60 ? preview.slice(0, 60) + '…' : preview
  return (
    <span>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-accent hover:underline text-xs font-mono text-left"
      >
        {open ? preview : short}
      </button>
    </span>
  )
}

const LIMIT = 50

export default function AdminLogsPage() {
  const token = useAdminStore(s => s.token)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [actions, setActions] = useState([])

  useEffect(() => {
    adminFetch('/audit/actions', token).then(a => setActions(Array.isArray(a) ? a : []))
  }, [token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset })
      if (actionFilter) params.set('action', actionFilter)
      if (fromFilter) params.set('from', fromFilter)
      if (toFilter) params.set('to', toFilter)
      const data = await adminFetch(`/audit?${params}`, token)
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, offset, actionFilter, fromFilter, toFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setOffset(0) }, [actionFilter, fromFilter, toFilter])

  const pages = Math.ceil(total / LIMIT)
  const page = Math.floor(offset / LIMIT) + 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <span className="text-sm text-text-2">Всего: {total}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-sm px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-text"
        >
          <option value="">Все действия</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-2">С</label>
          <input
            type="date"
            value={fromFilter}
            onChange={e => setFromFilter(e.target.value)}
            className="text-sm px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-text"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-2">По</label>
          <input
            type="date"
            value={toFilter}
            onChange={e => setToFilter(e.target.value)}
            className="text-sm px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-text"
          />
        </div>

        {(actionFilter || fromFilter || toFilter) && (
          <button
            onClick={() => { setActionFilter(''); setFromFilter(''); setToFilter('') }}
            className="text-sm px-3 py-1.5 text-red-500 hover:bg-bg-2 border border-border rounded-lg transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-text-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Дата</th>
              <th className="px-3 py-2 text-left font-medium">Администратор</th>
              <th className="px-3 py-2 text-left font-medium">Действие</th>
              <th className="px-3 py-2 text-left font-medium">Target ID</th>
              <th className="px-3 py-2 text-left font-medium">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-2">Нет записей</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-bg-2 transition-colors">
                <td className="px-3 py-2 text-text-2 whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2 text-xs">{r.adminName}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full bg-bg border border-border text-xs font-mono">{r.action}</span>
                </td>
                <td className="px-3 py-2 text-text-2 font-mono text-xs">{r.targetId || '—'}</td>
                <td className="px-3 py-2 max-w-xs"><PayloadCell payload={r.payload} /></td>
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
