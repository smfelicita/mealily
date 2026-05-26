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

function inferType(value) {
  if (value === 'true' || value === 'false') return 'bool'
  if (value !== '' && !isNaN(Number(value))) return 'number'
  return 'string'
}

const GROUP_LABELS = {
  'ai': 'ИИ-чат',
  'telegram': 'Telegram',
  'notifications': 'Уведомления',
}

function groupKey(key) {
  return key.split('.')[0]
}

export default function AdminFlagsPage() {
  const token = useAdminStore(s => s.token)
  const [flags, setFlags] = useState([])
  const [saving, setSaving] = useState(null)
  const [edited, setEdited] = useState({})

  const load = useCallback(async () => {
    const data = await adminFetch('/flags', token)
    setFlags(Array.isArray(data) ? data : [])
  }, [token])

  useEffect(() => { load() }, [load])

  async function save(key, value) {
    setSaving(key)
    try {
      await adminFetch(`/flags/${key}`, token, { method: 'PATCH', body: { value } })
      setFlags(prev => prev.map(f => f.key === key ? { ...f, value } : f))
      setEdited(prev => { const n = { ...prev }; delete n[key]; return n })
    } finally {
      setSaving(null)
    }
  }

  async function toggleBool(key, currentValue) {
    const next = currentValue === 'true' ? 'false' : 'true'
    await save(key, next)
  }

  const HIDDEN = new Set(['telegram.commands.aiEnabled'])

  const groups = {}
  for (const flag of flags) {
    if (HIDDEN.has(flag.key)) continue
    const g = groupKey(flag.key)
    if (!groups[g]) groups[g] = []
    groups[g].push(flag)
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Feature Flags</h1>

      <div className="flex flex-col gap-6">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <h2 className="text-xs font-medium text-text-2 uppercase tracking-wide mb-2">
              {GROUP_LABELS[group] || group}
            </h2>
            <div className="rounded-xl border border-border overflow-hidden">
              {items.map((flag, i) => {
                const type = inferType(flag.value)
                const isDirty = edited[flag.key] !== undefined
                const displayValue = isDirty ? edited[flag.key] : flag.value

                return (
                  <div
                    key={flag.key}
                    className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''} bg-bg-2`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-text">{flag.key}</p>
                      {flag.description && (
                        <p className="text-xs text-text-2 mt-0.5">{flag.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {type === 'bool' ? (
                        <button
                          onClick={() => toggleBool(flag.key, flag.value)}
                          disabled={saving === flag.key}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            flag.value === 'true' ? 'bg-accent' : 'bg-border'
                          } disabled:opacity-50`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            flag.value === 'true' ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type={type === 'number' ? 'number' : 'text'}
                            value={displayValue}
                            onChange={e => setEdited(prev => ({ ...prev, [flag.key]: e.target.value }))}
                            className="w-44 text-sm px-2 py-1 bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-accent"
                          />
                          {isDirty && (
                            <button
                              onClick={() => save(flag.key, edited[flag.key])}
                              disabled={saving === flag.key}
                              className="px-3 py-1 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
                            >
                              {saving === flag.key ? '...' : 'Сохранить'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {flags.length === 0 && (
          <p className="text-text-2 text-sm py-8 text-center">Флаги не найдены</p>
        )}
      </div>
    </div>
  )
}
