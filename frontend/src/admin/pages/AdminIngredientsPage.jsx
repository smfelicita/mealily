import { useState, useEffect, useCallback } from 'react'
import { useAdminStore } from '../adminStore'

const ING_CATEGORIES = [
  { value: 'dairy',     label: 'Молочное' },
  { value: 'meat',      label: 'Мясо'     },
  { value: 'fish',      label: 'Рыба'     },
  { value: 'vegetable', label: 'Овощи'    },
  { value: 'fruit',     label: 'Фрукты'   },
  { value: 'grain',     label: 'Злаки'    },
  { value: 'legume',    label: 'Бобовые'  },
  { value: 'egg',       label: 'Яйца'     },
  { value: 'bread',     label: 'Хлеб'     },
  { value: 'oil',       label: 'Масла'    },
  { value: 'sauce',     label: 'Соусы'    },
  { value: 'spice',     label: 'Специи'   },
  { value: 'herb',      label: 'Зелень'   },
  { value: 'nut',       label: 'Орехи'    },
  { value: 'sweetener', label: 'Сладкое'  },
  { value: 'canned',    label: 'Консервы' },
  { value: 'other',     label: 'Другое'   },
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

export default function AdminIngredientsPage() {
  const token = useAdminStore(s => s.token)

  const [ingredients, setIngredients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState(null)    // id редактируемого
  const [editData, setEditData] = useState({})    // поля формы
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [aliasInput, setAliasInput] = useState({}) // id → текст нового алиаса

  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      const data = await adminFetch(`/ingredients?${params}`, token)
      setIngredients(data.ingredients || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [token, q, category, page])

  useEffect(() => { load() }, [load])

  // Сброс страницы при изменении фильтров
  useEffect(() => { setPage(1) }, [q, category])

  function startEdit(ing) {
    setEditing(ing.id)
    setEditData({
      nameRu: ing.nameRu,
      nameEn: ing.nameEn || '',
      category: ing.category,
      protein: ing.protein ?? '',
      fat: ing.fat ?? '',
      carbs: ing.carbs ?? '',
      avgWeightG: ing.avgWeightG ?? '',
      isBasic: ing.isBasic,
      ignoreInFridgeFilter: ing.ignoreInFridgeFilter,
    })
  }

  function cancelEdit() {
    setEditing(null)
    setEditData({})
  }

  async function saveEdit(id) {
    setSavingId(id)
    try {
      const updated = await adminFetch(`/ingredients/${id}`, token, {
        method: 'PATCH',
        body: editData,
      })
      if (updated.id) {
        setIngredients(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
        setEditing(null)
      }
    } finally {
      setSavingId(null)
    }
  }

  async function deleteIngredient(id) {
    if (!confirm('Удалить ингредиент?')) return
    setDeletingId(id)
    try {
      const res = await adminFetch(`/ingredients/${id}`, token, { method: 'DELETE' })
      if (res.ok) {
        setIngredients(prev => prev.filter(i => i.id !== id))
        setTotal(t => t - 1)
      } else {
        alert(res.error || 'Ошибка удаления')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function addAlias(ingredientId) {
    const alias = aliasInput[ingredientId]?.trim()
    if (!alias) return
    const res = await adminFetch(`/ingredients/${ingredientId}/aliases`, token, {
      method: 'POST',
      body: { alias },
    })
    if (res.id) {
      setIngredients(prev => prev.map(i =>
        i.id === ingredientId ? { ...i, aliases: [...i.aliases, res] } : i
      ))
      setAliasInput(prev => ({ ...prev, [ingredientId]: '' }))
    } else {
      alert(res.error || 'Ошибка')
    }
  }

  async function deleteAlias(ingredientId, aliasId) {
    await adminFetch(`/ingredients/aliases/${aliasId}`, token, { method: 'DELETE' })
    setIngredients(prev => prev.map(i =>
      i.id === ingredientId ? { ...i, aliases: i.aliases.filter(a => a.id !== aliasId) } : i
    ))
  }

  const catLabel = v => ING_CATEGORIES.find(c => c.value === v)?.label || v

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-text">Ингредиенты</h2>
        <span className="text-sm text-text-2">{total} шт.</span>
      </div>

      {/* Фильтры */}
      <div className="flex gap-3 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Поиск..."
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent w-56"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm outline-none focus:border-accent"
        >
          <option value="">Все категории</option>
          {ING_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Название</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">EN</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Категория</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Б/Ж/У</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Флаги</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-2">Алиасы</th>
              <th className="px-4 py-2.5 font-medium text-text-2">Блюд</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Загрузка...</td></tr>
            )}
            {!loading && ingredients.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-2">Ничего не найдено</td></tr>
            )}
            {ingredients.map(ing => (
              <tr key={ing.id} className="hover:bg-bg-2 transition-colors">
                {editing === ing.id ? (
                  // ── Режим редактирования ──────────────────────────
                  <>
                    <td className="px-3 py-2">
                      <input
                        value={editData.nameRu}
                        onChange={e => setEditData(d => ({ ...d, nameRu: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-sm outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={editData.nameEn}
                        onChange={e => setEditData(d => ({ ...d, nameEn: e.target.value }))}
                        placeholder="en name"
                        className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-sm outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editData.category}
                        onChange={e => setEditData(d => ({ ...d, category: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-sm outline-none focus:border-accent"
                      >
                        {ING_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {['protein','fat','carbs'].map(field => (
                          <input
                            key={field}
                            type="number"
                            value={editData[field]}
                            onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))}
                            placeholder={field[0].toUpperCase()}
                            className="w-14 px-1.5 py-1 rounded border border-border bg-bg text-text text-xs outline-none focus:border-accent"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editData.isBasic}
                            onChange={e => setEditData(d => ({ ...d, isBasic: e.target.checked }))}
                          />
                          базовый
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editData.ignoreInFridgeFilter}
                            onChange={e => setEditData(d => ({ ...d, ignoreInFridgeFilter: e.target.checked }))}
                          />
                          игнор.
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-2 text-xs">{ing.aliases.map(a => a.alias).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-center text-text-2">{ing._count.dishes}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveEdit(ing.id)}
                          disabled={savingId === ing.id}
                          className="px-3 py-1 rounded bg-accent text-white text-xs disabled:opacity-50"
                        >
                          {savingId === ing.id ? '...' : 'Сохранить'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 rounded border border-border text-xs text-text-2"
                        >
                          Отмена
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  // ── Режим просмотра ───────────────────────────────
                  <>
                    <td className="px-4 py-2.5 font-medium text-text">{ing.nameRu}</td>
                    <td className="px-4 py-2.5 text-text-2">{ing.nameEn || <span className="text-border">—</span>}</td>
                    <td className="px-4 py-2.5 text-text-2">{catLabel(ing.category)}</td>
                    <td className="px-4 py-2.5 text-text-2 text-xs">
                      {ing.protein != null || ing.fat != null || ing.carbs != null
                        ? `${ing.protein ?? '?'}/${ing.fat ?? '?'}/${ing.carbs ?? '?'}`
                        : <span className="text-border">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-2">
                      {ing.isBasic && <span className="bg-bg-2 border border-border rounded px-1.5 py-0.5 mr-1">базовый</span>}
                      {ing.ignoreInFridgeFilter && <span className="bg-bg-2 border border-border rounded px-1.5 py-0.5">игнор.</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1 items-center">
                        {ing.aliases.map(a => (
                          <span
                            key={a.id}
                            className="flex items-center gap-0.5 bg-bg-2 border border-border rounded px-1.5 py-0.5 text-xs text-text-2"
                          >
                            {a.alias}
                            <button
                              onClick={() => deleteAlias(ing.id, a.id)}
                              className="text-red-400 hover:text-red-600 ml-0.5 leading-none"
                            >×</button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            value={aliasInput[ing.id] || ''}
                            onChange={e => setAliasInput(p => ({ ...p, [ing.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && addAlias(ing.id)}
                            placeholder="+ алиас"
                            className="w-20 px-1.5 py-0.5 rounded border border-border bg-bg text-xs outline-none focus:border-accent"
                          />
                          <button
                            onClick={() => addAlias(ing.id)}
                            className="text-accent text-xs hover:underline"
                          >добавить</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-text-2">{ing._count.dishes}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(ing)}
                          className="text-accent text-xs hover:underline"
                        >Ред.</button>
                        <button
                          onClick={() => deleteIngredient(ing.id)}
                          disabled={deletingId === ing.id || ing._count.dishes > 0}
                          className="text-red-400 text-xs hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                          title={ing._count.dishes > 0 ? `Используется в ${ing._count.dishes} блюдах` : ''}
                        >Удал.</button>
                      </div>
                    </td>
                  </>
                )}
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
