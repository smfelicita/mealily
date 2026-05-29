// FridgePage — страница холодильника.
// Портировано из context/design/fridge-v2.jsx.
// Три состояния: guest / user пустой / user рабочий вид + picker-modal.
// Токены через Tailwind (bg-accent, text-sage, bg-sage-muted и т.д.)

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getIngredientName } from '../utils/ingredient'
import {
  Refrigerator, Search, Plus, X, Check, Sparkles, Trash2, Users, Send,
} from 'lucide-react'

import { api } from '../api'
import { useStore } from '../store'
import { UNITS } from '../constants'
import { PageHeader, GuestBlock, useToast } from '../components/ui'

// ─── Категории ─────────────────────────────────────────────────────
// Эмодзи остаются хардкодом (универсальны для всех языков),
// названия берутся через t('common:ingCategory.<key>').
// pantry в схеме нет — используем emoji, label fallback на 'other'.
const CAT_EMOJI = {
  dairy: '🥛', protein: '🥚', vegetable: '🥕', fruit: '🍎', grain: '🌾',
  meat:  '🥩', fish: '🐟',     egg: '🥚',       bread: '🍞', spice: '🌶',
  herb:  '🌿', oil: '🫒',       sauce: '🫙',     nut: '🥜',   sweetener: '🍯',
  canned:'🥫', pantry: '🥫',   legume: '🫘',    other: '📦',
}

const CAT_ORDER = [
  'meat', 'fish', 'dairy', 'protein', 'egg', 'vegetable', 'herb',
  'fruit', 'grain', 'bread', 'legume', 'pantry', 'canned', 'oil',
  'sauce', 'spice', 'nut', 'sweetener', 'other',
]

// ─── Helpers ───────────────────────────────────────────────────────
function groupByCat(list) {
  const out = {}
  for (const it of list) {
    const cat = it.category || 'other'
    ;(out[cat] ||= []).push(it)
  }
  return out
}

// ═══ Telegram banner ════════════════════════════════════════════════
function TelegramBanner({ onLinked, onError, onClose }) {
  const { t } = useTranslation('fridge')
  const [status, setStatus] = useState('idle') // idle | loading | polling
  const pollRef    = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => () => {
    if (pollRef.current)    clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  async function connect() {
    setStatus('loading')
    try {
      const { url } = await api.generateTelegramLink()
      window.open(url, '_blank')
      setStatus('polling')

      pollRef.current = setInterval(async () => {
        try {
          const d = await api.getTelegramLinkStatus()
          if (d.linked) { clearInterval(pollRef.current); onLinked() }
        } catch {}
      }, 3000)

      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current); pollRef.current = null; setStatus('idle')
        }
      }, 180_000)
    } catch (err) {
      setStatus('idle')
      onError?.(err.message || t('telegram.errorLink'))
    }
  }

  const label =
    status === 'loading' ? t('telegram.loading') :
    status === 'polling' ? t('telegram.polling') :
    t('telegram.connect')

  return (
    <div className="mx-4 mt-3 rounded-2xl flex items-center gap-3 relative
      bg-bg-2 border border-accent-border px-3.5 py-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#E6F3FB]">
        <Send size={16} strokeWidth={2} className="text-[#2AABEE]" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <div className="text-[13.5px] font-bold leading-snug text-text">
          {t('telegram.title')}
        </div>
        <div className="text-[11.5px] text-text-3 mt-0.5">
          {t('telegram.subtitle')}
        </div>
      </div>
      <button
        onClick={connect}
        disabled={status !== 'idle'}
        className="px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0
          bg-accent-muted text-accent border border-accent-border disabled:opacity-60"
      >
        {label}
      </button>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-text-3"
        aria-label={t('telegram.closeAria')}
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

// ═══ Family banner ═══════════════════════════════════════════════════
function FamilyBanner({ count }) {
  const { t } = useTranslation('fridge')
  return (
    <div className="mx-4 mt-3 rounded-xl flex items-center gap-2
      bg-sage-muted border border-sage-border px-3.5 py-2.5">
      <Users size={15} strokeWidth={2.2} className="text-sage" />
      <div className="text-sm2 font-semibold flex-1 text-sage">
        {t('family.title')}
      </div>
      {count != null && (
        <span className="text-2xs font-bold px-2 py-0.5 rounded-full
          bg-bg-2 text-sage border border-sage-border">
          {t('family.memberCount', { count })}
        </span>
      )}
    </div>
  )
}

// ═══ Meta strip (всего / базовых) ══════════════════════════════════
function FridgeMetaStrip({ total, basic }) {
  const { t } = useTranslation('fridge')
  const items = [
    { value: total, label: t('metaStrip.total') },
    { value: basic, label: t('metaStrip.basic') },
  ]
  return (
    <div className="mx-4 mt-4 rounded-2xl flex items-stretch justify-between
      bg-bg-2 border border-border px-1.5 py-3">
      {items.map((it, i) => (
        <div key={i} className="flex-1 flex items-stretch">
          <div className="flex-1 flex flex-col items-center gap-0.5 px-1">
            <div className="text-lg2 font-extrabold tabular-nums tracking-tight text-text">
              {it.value}
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">
              {it.label}
            </div>
          </div>
          {i < items.length - 1 && <div className="w-px my-1 bg-border" />}
        </div>
      ))}
    </div>
  )
}

// ═══ AI cook CTA ═══════════════════════════════════════════════════
function AICookCTA({ onClick }) {
  const { t } = useTranslation('fridge')
  return (
    <div className="px-4 mt-4">
      <button
        type="button"
        onClick={onClick}
        className="w-full h-12 rounded-full flex items-center justify-center gap-2
          bg-sage text-white text-sm font-bold"
        style={{ boxShadow: '0 6px 18px rgba(92,122,89,0.35)' }}
      >
        <Sparkles size={16} strokeWidth={2.2} />
        {t('cookCta.button')}
      </button>
      <div className="text-[11.5px] text-center mt-1.5 text-text-3">
        {t('cookCta.subtitle')}
      </div>
    </div>
  )
}

// ═══ Product card ══════════════════════════════════════════════════
function ProductCard({ item, editing, onEdit, onDelete, onSave, onCancel }) {
  const { t, i18n } = useTranslation('fridge')
  const displayName = getIngredientName({ name: item.name, nameEn: item.nameEn }, i18n.language)
  const [qty, setQty]   = useState(item.quantityValue != null ? String(item.quantityValue) : '')
  const [unit, setUnit] = useState(item.quantityUnit || UNITS[0])

  useEffect(() => {
    setQty(item.quantityValue != null ? String(item.quantityValue) : '')
    setUnit(item.quantityUnit || UNITS[0])
  }, [item.quantityValue, item.quantityUnit, editing])

  return (
    <div className={[
      'rounded-xl flex flex-col bg-bg-2 p-2.5 border',
      item.isBasic ? 'border-accent-border' : 'border-border',
    ].join(' ')}>
      <div className="flex items-start gap-2">
        <div className="text-xl leading-none select-none shrink-0 mt-0.5">
          {item.emoji || '📦'}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm2 font-semibold flex-1 min-w-0 text-left truncate text-text"
          title={displayName}
        >
          {displayName}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-text-3"
          aria-label={t('card.deleteAria')}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {item.isBasic && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md
            bg-sage-muted text-sage border border-sage-border">
            {t('card.basicBadge')}
          </span>
        )}
        {item.quantityValue != null && !editing && (
          <span className="text-2xs tabular-nums text-text-3">
            {item.quantityValue} {item.quantityUnit}
          </span>
        )}
      </div>

      {editing && (
        <div className="flex gap-1.5 mt-2">
          <input
            type="number"
            min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            autoFocus
            placeholder={t('card.qtyPlaceholder')}
            className="flex-1 min-w-0 h-8 px-2 rounded-lg text-[12.5px] outline-none tabular-nums
              bg-bg-3 border border-border text-text focus:border-accent"
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="h-8 px-1.5 rounded-lg text-[12px] outline-none
              bg-bg-3 border border-border text-text focus:border-accent"
            style={{ maxWidth: 62 }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button
            type="button"
            onClick={() => onSave(qty, unit)}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-sage text-white"
            aria-label={t('card.saveAria')}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              bg-bg-3 border border-border text-text-2"
            aria-label={t('card.cancelAria')}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  )
}

// ═══ Category block ═════════════════════════════════════════════════
function CategoryBlock({ cat, items, editingId, setEditingId, onDelete, onSave }) {
  const { t } = useTranslation('common')
  const emoji = CAT_EMOJI[cat] || CAT_EMOJI.other
  // pantry → other (нет в ingCategory) — фолбэк на 'other'
  const labelKey = cat === 'pantry' ? 'other' : cat
  const label = t(`ingCategory.${labelKey}`, { defaultValue: t('ingCategory.other') })
  return (
    <section className="mt-6 px-4">
      <div className="text-2xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-text-2">
        <span className="text-sm2 leading-none">{emoji}</span>
        <span>{label}</span>
        <span className="text-text-3">· {items.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(it => (
          <ProductCard
            key={it.ingredientId}
            item={it}
            editing={editingId === it.ingredientId}
            onEdit={() => setEditingId(editingId === it.ingredientId ? null : it.ingredientId)}
            onDelete={() => onDelete(it.ingredientId, it.name)}
            onSave={(qty, unit) => onSave(it.ingredientId, qty, unit)}
            onCancel={() => setEditingId(null)}
          />
        ))}
      </div>
    </section>
  )
}

// ═══ Picker modal ═══════════════════════════════════════════════════
function PickerSheet({ open, onClose, allIngredients, fridgeIds, onAdd, loading }) {
  const { t, i18n } = useTranslation(['fridge', 'common'])
  const ingName = ing => getIngredientName(ing, i18n.language)
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery]       = useState('')

  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setQuery('')
    }
  }, [open])

  const available = useMemo(
    () => allIngredients.filter(ing => !fridgeIds.has(ing.id)),
    [allIngredients, fridgeIds]
  )

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return available.filter(ing =>
      ing.nameRu.toLowerCase().includes(q) ||
      (ing.nameEn && ing.nameEn.toLowerCase().includes(q))
    )
  }, [available, query])

  const groupedAdd = useMemo(() => {
    const g = {}
    for (const ing of available) {
      const cat = ing.category || 'other'
      ;(g[cat] ||= []).push(ing)
    }
    return g
  }, [available])

  const orderedCats = useMemo(
    () => CAT_ORDER.filter(c => groupedAdd[c]?.length),
    [groupedAdd]
  )

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!open) return null
  const count = selected.size

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(28,25,23,0.45)' }}>
      {/* tap-to-close backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="flex-1"
        aria-label={t('picker.closeAria')}
      />

      {/* sheet */}
      <div
        className="relative flex flex-col bg-bg-2 overflow-hidden"
        style={{ maxHeight: '85dvh', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      >
        {/* handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
          <h2 className="text-lg2 font-bold text-text">{t('picker.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-bg-3 text-text-2"
            aria-label={t('picker.closeAria')}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-full h-10 px-3.5 bg-bg-3 border border-border">
            <Search size={15} strokeWidth={2} className="text-text-3" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('picker.searchPlaceholder')}
              className="flex-1 bg-transparent outline-none text-[13.5px] text-text"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-border text-text-2"
                aria-label={t('picker.clearAria')}
              >
                <X size={11} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
          {searchResults ? (
            <div className="flex flex-col gap-1">
              <div className="text-2xs font-bold uppercase tracking-wider mb-1 text-text-3">
                {t('picker.searchResultsLabel', { query })}
              </div>
              {searchResults.length === 0 && (
                <div className="text-sm2 text-center py-8 text-text-3">
                  {t('picker.nothingFound')}
                </div>
              )}
              {searchResults.map(it => {
                const on = selected.has(it.id)
                const catKey = it.category === 'pantry' ? 'other' : (it.category || 'other')
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    className={[
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border',
                      on ? 'bg-accent-muted border-accent-border' : 'bg-bg-2 border-border',
                    ].join(' ')}
                  >
                    <span className="text-xl leading-none">{it.emoji || '📦'}</span>
                    <span className="flex-1 text-[13.5px] font-semibold text-text">{ingName(it)}</span>
                    <span className="text-2xs text-text-3">
                      {t(`common:ingCategory.${catKey}`, { defaultValue: '' })}
                    </span>
                    <div className={[
                      'w-7 h-7 rounded-full flex items-center justify-center',
                      on ? 'bg-accent text-white' : 'bg-transparent border border-border text-accent',
                    ].join(' ')}>
                      {on ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={2.4} />}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orderedCats.length === 0 && (
                <div className="text-sm2 text-center py-8 text-text-3">
                  {t('picker.allInFridge')}
                </div>
              )}
              {orderedCats.map(cat => {
                const emoji = CAT_EMOJI[cat] || CAT_EMOJI.other
                const labelKey = cat === 'pantry' ? 'other' : cat
                const label = t(`common:ingCategory.${labelKey}`, { defaultValue: t('common:ingCategory.other') })
                return (
                  <div key={cat}>
                    <div className="text-2xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-text-2">
                      <span className="text-sm2 leading-none">{emoji}</span>
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupedAdd[cat].map(it => {
                        const on = selected.has(it.id)
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => toggle(it.id)}
                            className={[
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition',
                              on
                                ? 'bg-accent-muted border-accent text-accent'
                                : 'bg-bg-3 border-border text-text-2',
                            ].join(' ')}
                          >
                            <span className="text-sm2 leading-none">{it.emoji || '📦'}</span>
                            {ingName(it)}
                            {on && <Check size={11} strokeWidth={3} className="text-accent" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 pb-5 pt-2 border-t border-border bg-bg-2 shrink-0">
          <button
            type="button"
            disabled={count === 0 || loading}
            onClick={() => onAdd(Array.from(selected))}
            className={[
              'w-full h-12 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition',
              count > 0
                ? 'bg-accent text-white'
                : 'bg-bg-3 text-text-3 border border-border',
            ].join(' ')}
            style={count > 0 ? { boxShadow: '0 6px 18px rgba(196,112,74,0.35)' } : undefined}
          >
            {count > 0 ? (
              <>
                <Plus size={16} strokeWidth={2.4} />
                {loading ? t('picker.addingMany') : t('picker.addCount', { count })}
              </>
            ) : t('picker.doneEmpty')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══ Empty state ════════════════════════════════════════════════════
function FridgeEmpty({ onAdd }) {
  const { t } = useTranslation('fridge')
  return (
    <div className="px-5 mt-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center
        bg-bg-3 border border-border">
        <Refrigerator size={28} strokeWidth={1.8} className="text-accent" />
      </div>
      <h2 className="mt-4 text-lg2 font-bold text-text">{t('empty.title')}</h2>
      <p className="mt-2 text-sm2 max-w-[280px] leading-relaxed text-text-2">
        {t('empty.description')}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 h-11 px-5 rounded-full flex items-center gap-2
          bg-accent text-white text-[13.5px] font-bold"
        style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
      >
        <Plus size={16} strokeWidth={2.4} />
        {t('empty.addButton')}
      </button>
    </div>
  )
}

// ═══ Guest block ═══════════════════════════════════════════════════
function GuestFridgeBlock() {
  const { t } = useTranslation('fridge')
  return (
    <div className="pt-5 pb-24 px-4">
      <PageHeader title={t('title')} />
      <div className="mt-4">
        <GuestBlock
          icon={<Refrigerator size={26} strokeWidth={1.8} />}
          title={t('guest.title')}
          description={t('guest.description')}
          registerText={t('guest.register')}
          loginText={t('guest.login')}
        />
      </div>
    </div>
  )
}

// ═══ Main page ══════════════════════════════════════════════════════
export default function FridgePage() {
  const { token } = useStore()
  if (!token) return <GuestFridgeBlock />

  const { t } = useTranslation('fridge')
  const { fridge, setFridge, addToFridge, removeFromFridge, updateFridgeItem } = useStore()
  const { show, Toast } = useToast()
  const navigate = useNavigate()

  const [allIngredients, setAllIngredients] = useState([])
  const [familyGroupId,  setFamilyGroupId]  = useState(null)
  const [familyCount,    setFamilyCount]    = useState(null)
  const [telegramLinked, setTelegramLinked] = useState(null)
  const [tgBannerOpen,   setTgBannerOpen]   = useState(true)
  const [showPicker,     setShowPicker]     = useState(false)
  const [editingId,      setEditingId]      = useState(null)
  const [loadingBulk,    setLoadingBulk]    = useState(false)

  useEffect(() => {
    api.getFridge().then(data => {
      setFridge(data.items)
      setFamilyGroupId(data.familyGroupId || null)
      if (data.familyMemberCount != null) setFamilyCount(data.familyMemberCount)
    }).catch(() => {})
    api.getIngredients().then(setAllIngredients).catch(() => {})
    api.getTelegramLinkStatus().then(d => setTelegramLinked(d.linked)).catch(() => setTelegramLinked(false))
  }, [])

  // ── Derived ──────────────────────────────────────────────────────
  const fridgeIds = useMemo(() => new Set(fridge.map(f => f.ingredientId)), [fridge])

  const grouped = useMemo(() => groupByCat(fridge), [fridge])

  const orderedCats = useMemo(
    () => CAT_ORDER.filter(c => grouped[c]?.length),
    [grouped]
  )

  const total = fridge.length
  const basic = fridge.filter(i => i.isBasic).length

  // ── Handlers ─────────────────────────────────────────────────────
  async function handleBulkAdd(ids) {
    if (!ids.length) return
    setLoadingBulk(true)
    try {
      await api.bulkAddFridge(ids)
      const added = allIngredients.filter(i => ids.includes(i.id))
      added.forEach(ing => addToFridge({
        ingredientId: ing.id,
        name:         ing.nameRu,
        emoji:        ing.emoji,
        category:     ing.category,
        isBasic:      ing.isBasic || false,
      }))
      show(t('toast.addedList', { names: added.map(i => i.nameRu).join(', ') }), 'success')
      setShowPicker(false)
    } catch (e) {
      show(e.message, 'error')
    } finally {
      setLoadingBulk(false)
    }
  }

  async function removeItem(ingredientId, name) {
    try {
      await api.removeFromFridge(ingredientId)
      removeFromFridge(ingredientId)
      show(t('toast.removed', { name }), 'success')
    } catch (e) { show(e.message, 'error') }
  }

  async function saveQuantity(ingredientId, qty, unit) {
    try {
      const quantityValue = qty !== '' ? Number(qty) : null
      const quantityUnit  = quantityValue != null ? unit : null
      await api.updateFridgeItem(ingredientId, { quantityValue, quantityUnit })
      updateFridgeItem(ingredientId, { quantityValue, quantityUnit })
      setEditingId(null)
    } catch (e) { show(e.message, 'error') }
  }

  async function clearAll() {
    if (!confirm(t('actions.clearAllConfirm'))) return
    try {
      await api.clearFridge()
      setFridge([])
      show(t('actions.clearAllToast'), 'success')
    } catch (e) { show(e.message, 'error') }
  }

  function goAICook() {
    navigate('/chat?prompt=' + encodeURIComponent(t('aiPrompt')))
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="pb-28">
      <PageHeader title={t('title')} />

      {telegramLinked === false && tgBannerOpen && (
        <TelegramBanner
          onLinked={() => { setTelegramLinked(true); show(t('telegram.linkedToast'), 'success') }}
          onError={(msg) => show(msg, 'error')}
          onClose={() => setTgBannerOpen(false)}
        />
      )}

      {familyGroupId && <FamilyBanner count={familyCount} />}

      {total === 0 ? (
        <FridgeEmpty onAdd={() => setShowPicker(true)} />
      ) : (
        <>
          <FridgeMetaStrip total={total} basic={basic} />
          <AICookCTA onClick={goAICook} />

          {orderedCats.map(cat => (
            <CategoryBlock
              key={cat}
              cat={cat}
              items={grouped[cat]}
              editingId={editingId}
              setEditingId={setEditingId}
              onDelete={removeItem}
              onSave={saveQuantity}
            />
          ))}

          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-[12.5px] text-text-3"
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {t('actions.clearAll')}
            </button>
          </div>
        </>
      )}

      {/* FAB */}
      {total > 0 && !showPicker && (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="fixed bottom-[76px] right-4 h-12 px-4 rounded-full flex items-center gap-2
            bg-accent text-white text-[13.5px] font-bold z-40 active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(196,112,74,0.45)' }}
          aria-label={t('actions.fabAria')}
        >
          <Plus size={16} strokeWidth={2.4} />
          {t('actions.fab')}
        </button>
      )}

      <PickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        allIngredients={allIngredients}
        fridgeIds={fridgeIds}
        onAdd={handleBulkAdd}
        loading={loadingBulk}
      />

      {Toast}
    </div>
  )
}
