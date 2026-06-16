// DishesPage — каталог блюд.
// Портировано из context/design/dishes-v2.jsx.
// Состояния: initial / search / filters-открыты / empty.
// Реальные API + store, IntersectionObserver paging, BulkAddModal,
// поиск с debounce, токены через Tailwind (bg-accent, text-sage и т.д.)

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search, Heart, Refrigerator, SlidersHorizontal, ArrowUpDown,
  Plus, Clock, Flame, X, Check,
} from 'lucide-react'

import { api } from '../api'
import { useStore } from '../store'
import { BulkAddModal } from '../components/domain'
import { PageHeader, useToast } from '../components/ui'
import { useHintDismiss } from '../hooks/useHintDismiss'

// ─── Константы / справочники ────────────────────────────────────
// Метки берутся через t('common:mealTimeShort.<VALUE>')
const MEAL_TIME_IDS = ['', 'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

// Сложность — id совпадает с ключом common:difficulty.<id>
const DIFFICULTIES = [
  { id: 'easy'   },
  { id: 'medium' },
  { id: 'hard'   },
]

// Пресет кухонь — value (русское) уходит на бэк, key — для t()
const CUISINE_LIST = [
  { value: 'Русская',           key: 'russian'       },
  { value: 'Итальянская',       key: 'italian'       },
  { value: 'Азиатская',         key: 'asian'         },
  { value: 'Средиземноморская', key: 'mediterranean' },
  { value: 'Грузинская',        key: 'georgian'      },
  { value: 'Французская',       key: 'french'        },
  { value: 'Японская',          key: 'japanese'      },
  { value: 'Мексиканская',      key: 'mexican'       },
]

// Популярные теги: value (русский) уходит на бэк, key — для t()
const POPULAR_TAGS = [
  { value: 'быстро',       key: 'fast'        },
  { value: 'сытно',        key: 'filling'     },
  { value: 'лёгкое',       key: 'light'       },
  { value: 'постно',       key: 'lent'        },
  { value: 'суп',          key: 'soup'        },
  { value: 'салат',        key: 'salad'       },
  { value: 'просто',       key: 'simple'      },
  { value: 'мясо',         key: 'meat'        },
  { value: 'без глютена',  key: 'glutenFree'  },
]

const LIMIT = 20

// ═══ SearchInput ═══════════════════════════════════════════════════
function SearchInput({ value, onChange }) {
  const { t } = useTranslation('dish')
  const [focused, setFocused] = useState(false)
  return (
    <div
      className={[
        'flex items-center gap-2 h-11 px-4 rounded-full bg-bg-2 border transition-colors',
        focused ? 'border-accent' : 'border-border',
      ].join(' ')}
      style={focused ? { boxShadow: '0 0 0 3px rgba(196,112,74,0.10)' } : undefined}
    >
      <Search size={18} strokeWidth={2} className="text-text-3 shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('list.searchPlaceholder')}
        className="flex-1 bg-transparent outline-none text-sm text-text"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="w-5 h-5 rounded-full flex items-center justify-center bg-border text-text-2"
          aria-label={t('common.clearAria')}
        >
          <X size={11} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}

// ═══ MealTypeChips ═══════════════════════════════════════════════════
function MealTypeChips({ active, onChange }) {
  const { t } = useTranslation('common')
  return (
    <div className="-mx-5 px-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="flex gap-2" style={{ width: 'max-content' }}>
        {MEAL_TIME_IDS.map(id => {
          const on = id === active
          const label = id ? t(`mealTimeShort.${id}`) : t('mealAll')
          return (
            <button
              key={id || 'all'}
              type="button"
              onClick={() => onChange(id)}
              className={[
                'h-9 px-3.5 rounded-full text-sm2 font-bold whitespace-nowrap shrink-0 border',
                on
                  ? 'bg-accent-muted border-accent-border text-accent'
                  : 'bg-bg-2 border-border text-text-2',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══ QuickFilters ═══════════════════════════════════════════════════
function QuickFilters({ inFridge, fav, hasFilters, onToggleFridge, onToggleFav, onOpenFilters }) {
  const { t } = useTranslation('dish')
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleFridge}
        className={[
          'h-9 px-3 rounded-full text-[12.5px] font-bold flex items-center gap-1.5 border',
          inFridge
            ? 'bg-sage-muted border-sage-border text-sage'
            : 'bg-bg-2 border-border text-text-2',
        ].join(' ')}
      >
        <Refrigerator size={14} strokeWidth={2} />
        {t('list.fridge')}
      </button>
      <button
        type="button"
        onClick={onToggleFav}
        className={[
          'h-9 px-3 rounded-full text-[12.5px] font-bold flex items-center gap-1.5 border',
          fav
            ? 'bg-accent-muted border-accent-border text-accent'
            : 'bg-bg-2 border-border text-text-2',
        ].join(' ')}
      >
        <Heart size={14} strokeWidth={2} fill={fav ? 'currentColor' : 'none'} />
        {t('list.favorites')}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        className="w-9 h-9 rounded-full flex items-center justify-center bg-bg-2 border border-border text-text-2"
        aria-label={t('list.sortAria')}
        title={t('list.sortTitleSoon')}
      >
        <ArrowUpDown size={15} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onOpenFilters}
        className={[
          'w-9 h-9 rounded-full flex items-center justify-center relative border',
          hasFilters
            ? 'bg-accent border-accent text-white'
            : 'bg-bg-2 border-border text-text-2',
        ].join(' ')}
        aria-label={t('list.filtersAria')}
      >
        <SlidersHorizontal size={15} strokeWidth={2} />
        {hasFilters && (
          <span
            className="absolute rounded-full bg-sage"
            style={{ top: -2, right: -2, width: 8, height: 8, border: '2px solid #fff' }}
          />
        )}
      </button>
    </div>
  )
}

// ═══ HintBanner ═══════════════════════════════════════════════════
function HintBanner({ onClose, onClick }) {
  const { t } = useTranslation('dish')
  return (
    <div className="rounded-xl flex items-center gap-2 relative bg-bg-2 px-3.5 py-2.5"
      style={{ border: '1px dashed rgba(196,112,74,0.25)' }}>
      <span className="text-base">✨</span>
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-[12.5px] leading-snug text-text-2 text-left"
      >
        {t('list.bulkHint')}{' '}
        <span className="text-accent font-bold">{t('list.bulkHintAccent')}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-6 h-6 rounded-full flex items-center justify-center text-text-3"
        aria-label={t('common.closeAria')}
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

// ═══ DishRow ═══════════════════════════════════════════════════════
function DishRow({ dish, isFav, missing, inFridge, onClick, onToggleFav, onAddToPlan }) {
  const { t } = useTranslation('dish')
  const tags = (dish.tags || []).slice(0, 2)
  const cookTime = dish.cookTime
  const cal = dish.nutrition?.calories ?? dish.calories

  return (
    <div
      className="rounded-2xl flex items-center gap-3 bg-bg-2 border border-border p-3
        active:scale-[0.99] transition-transform cursor-pointer"
      onClick={onClick}
    >
      <div className="relative shrink-0">
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt=""
            style={{
              width: 72, height: 72, borderRadius: 12, objectFit: 'cover',
              border: '1px solid var(--color-border)', display: 'block',
            }}
          />
        ) : (
          <div
            className="bg-bg-3 border border-border flex items-center justify-center text-text-3"
            style={{ width: 72, height: 72, borderRadius: 12 }}
          >
            <Flame size={20} strokeWidth={1.6} />
          </div>
        )}
        {inFridge && (
          <div
            className="absolute flex items-center justify-center bg-sage"
            style={{
              top: -4, right: -4, width: 18, height: 18, borderRadius: '50%',
              border: '2px solid #fff',
            }}
          >
            <Check size={10} strokeWidth={3} color="#fff" />
          </div>
        )}
        {missing > 0 && (
          <div
            className="absolute flex items-center justify-center tabular-nums bg-accent text-white"
            style={{
              bottom: -4, right: -4, minWidth: 22, height: 18, padding: '0 5px',
              borderRadius: 9999, fontSize: 10.5, fontWeight: 800,
              border: '2px solid #fff', lineHeight: 1,
            }}
          >
            −{missing}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[14.5px] font-semibold leading-snug text-text"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textWrap: 'pretty',
          }}
        >
          {dish.name}
        </div>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-text-3">
          {cookTime != null && (
            <span className="inline-flex items-center gap-1 text-[12px] tabular-nums whitespace-nowrap">
              <Clock size={11} strokeWidth={2.2} />
              {cookTime} {t('list.minSuffix')}
            </span>
          )}
          {cal != null && (
            <span className="inline-flex items-center gap-1 text-[12px] tabular-nums whitespace-nowrap">
              <Flame size={11} strokeWidth={2.2} />
              {cal}
            </span>
          )}
          {tags.map(t => (
            <span
              key={t}
              className="text-[10.5px] font-bold uppercase tracking-wide bg-bg-3 text-text-2"
              style={{ padding: '1px 7px', borderRadius: 9999, letterSpacing: 0.4 }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 items-center shrink-0">
        {onToggleFav && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFav(dish.id) }}
            className={[
              'w-8 h-8 rounded-full flex items-center justify-center border',
              isFav ? 'bg-accent border-accent text-white' : 'bg-bg-3 border-border text-text-3',
            ].join(' ')}
            aria-label={t('list.addToFavoritesAria')}
          >
            <Heart size={14} strokeWidth={2.2} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        )}
        {onAddToPlan && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddToPlan(dish) }}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-bg-3 border border-border text-text-2"
            aria-label={t('list.addToPlanAria')}
          >
            <Plus size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  )
}

// ═══ Sentinel (paging spinner) ═══════════════════════════════════
function Sentinel() {
  return (
    <div className="flex justify-center mt-5">
      <div
        className="w-6 h-6 rounded-full animate-spin"
        style={{ border: '2.5px solid rgba(196,112,74,0.10)', borderTopColor: 'var(--color-accent)' }}
      />
    </div>
  )
}

// ═══ FAB ═══════════════════════════════════════════════════════════
function FAB({ onClick }) {
  const { t } = useTranslation('dish')
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed h-12 px-4 rounded-full flex items-center gap-2 bg-accent text-white text-[13.5px] font-bold z-40
        active:scale-95 transition-transform"
      style={{ right: 16, bottom: 80, boxShadow: '0 8px 24px rgba(196,112,74,0.45)' }}
      aria-label={t('list.fab')}
    >
      <Plus size={16} strokeWidth={2.4} />
      {t('list.fab')}
    </button>
  )
}

// ═══ EmptyState ═══════════════════════════════════════════════════
function EmptyState({ onReset, hasFilters, isGuest, onRegister, onLogin, onAddDish, ownEmpty }) {
  const { t } = useTranslation('dish')
  if (ownEmpty) {
    return (
      <div className="flex flex-col items-center text-center px-4" style={{ paddingTop: 56 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-bg-3 border border-border text-accent">
          <Flame size={24} strokeWidth={1.8} />
        </div>
        <div className="mt-4 text-base font-bold text-text">{t('empty.ownTitle')}</div>
        <p className="mt-1 text-sm2 max-w-[280px] text-text-2 leading-relaxed" style={{ textWrap: 'pretty' }}>
          {t('empty.ownBody')}
        </p>
        <button
          type="button"
          onClick={onAddDish}
          className="mt-4 h-11 px-5 rounded-full bg-accent text-white text-[13.5px] font-bold"
          style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
        >
          {t('empty.ownButton')}
        </button>
      </div>
    )
  }

  if (isGuest && !hasFilters) {
    return (
      <div className="flex flex-col items-center text-center px-4" style={{ paddingTop: 56 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-bg-3 border border-border text-accent">
          <Heart size={22} strokeWidth={1.8} />
        </div>
        <div className="mt-4 text-base font-bold text-text">{t('empty.guestTitle')}</div>
        <p className="mt-1 text-sm2 max-w-[280px] text-text-2 leading-relaxed" style={{ textWrap: 'pretty' }}>
          {t('empty.guestBody')}
        </p>
        <button
          type="button"
          onClick={onRegister}
          className="mt-4 h-11 px-5 rounded-full bg-accent text-white text-[13.5px] font-bold"
          style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
        >
          {t('empty.guestRegister')}
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="mt-2 text-sm2 text-text-3"
        >
          {t('empty.guestLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center text-center px-4" style={{ paddingTop: 56 }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-bg-3 border border-border text-text-3">
        <Search size={22} strokeWidth={2} />
      </div>
      <div className="mt-4 text-md2 font-bold text-text">{t('empty.filteredTitle')}</div>
      <p className="mt-1 text-sm2 max-w-[260px] text-text-2 leading-relaxed" style={{ textWrap: 'pretty' }}>
        {t('empty.filteredBody')}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 h-10 px-4 rounded-full text-sm2 font-bold text-accent"
      >
        {t('empty.filteredReset')}
      </button>
    </div>
  )
}

// ═══ FilterSection ═════════════════════════════════════════════════
function FilterSection({ title, children }) {
  return (
    <div className="mt-6">
      <div className="text-[11.5px] font-bold uppercase tracking-wider mb-2.5 text-text-3">
        {title}
      </div>
      {children}
    </div>
  )
}

// ═══ FilterSheet ═══════════════════════════════════════════════════
function FilterSheet({
  open, onClose,
  tags, setTags,
  cuisines, setCuisines,
  difficulty, setDifficulty,
  countLabel,
}) {
  const { t } = useTranslation(['dish', 'common'])
  if (!open) return null

  const toggle = (set, setter) => (v) => setter(s => {
    const n = new Set(s)
    n.has(v) ? n.delete(v) : n.add(v)
    return n
  })
  const reset = () => { setTags(new Set()); setCuisines(new Set()); setDifficulty(null) }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(28,25,23,0.45)' }}>
      <button type="button" onClick={onClose} className="flex-1" aria-label={t('common.closeAria')} />
      <div
        className="bg-bg-2 px-5 pt-3 pb-6 overflow-y-auto"
        style={{
          maxHeight: '85dvh',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex justify-center mb-3">
          <div className="bg-border" style={{ width: 40, height: 4, borderRadius: 9999 }} />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg2 font-bold text-text">{t('filters.title')}</h2>
          <button type="button" onClick={reset} className="text-sm2 font-bold text-accent">
            {t('filters.reset')}
          </button>
        </div>

        <FilterSection title={t('filters.tags')}>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TAGS.map(tag => {
              const on = tags.has(tag.value)
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggle(tags, setTags)(tag.value)}
                  className={[
                    'h-8 px-3 rounded-full text-[12.5px] font-bold border',
                    on
                      ? 'bg-accent-muted border-accent-border text-accent'
                      : 'bg-bg-2 border-border text-text-2',
                  ].join(' ')}
                >
                  {t(`popularTags.${tag.key}`)}
                </button>
              )
            })}
          </div>
        </FilterSection>

        <FilterSection title={t('filters.cuisine')}>
          <div className="flex flex-wrap gap-2">
            {CUISINE_LIST.map(c => {
              const on = cuisines.has(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggle(cuisines, setCuisines)(c.value)}
                  className={[
                    'h-8 px-3 rounded-full text-[12.5px] font-bold border',
                    on
                      ? 'bg-accent-muted border-accent-border text-accent'
                      : 'bg-bg-2 border-border text-text-2',
                  ].join(' ')}
                >
                  {t(`common:cuisines.${c.key}`)}
                </button>
              )
            })}
          </div>
        </FilterSection>

        <FilterSection title={t('filters.difficulty')}>
          <div className="flex rounded-full p-1 bg-bg-3 border border-border">
            {DIFFICULTIES.map(d => {
              const on = difficulty === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(on ? null : d.id)}
                  className={[
                    'flex-1 h-9 rounded-full text-sm2 font-bold transition-colors',
                    on ? 'bg-accent text-white' : 'bg-transparent text-text-2',
                  ].join(' ')}
                >
                  {t(`common:difficulty.${d.id}`)}
                </button>
              )
            })}
          </div>
        </FilterSection>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full h-12 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center gap-2"
          style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
        >
          {countLabel}
        </button>
      </div>
    </div>
  )
}

// ═══ Main page ═════════════════════════════════════════════════════
export default function DishesPage() {
  const { t } = useTranslation('dish')
  const navigate = useNavigate()
  const { token, fridge } = useStore()
  const { show, Toast } = useToast()

  const [dishes, setDishes]             = useState([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [hasMore, setHasMore]           = useState(false)

  const [q, setQ]                       = useState('')
  const [mealTime, setMealTime]         = useState('')
  const [inFridge, setInFridge]         = useState(false)
  const [favOnly, setFavOnly]           = useState(false)

  const [tags, setTags]                 = useState(() => new Set())
  const [cuisines, setCuisines]         = useState(() => new Set())
  const [difficulty, setDifficulty]     = useState(null)
  const [showFilters, setShowFilters]   = useState(false)

  const [favIds, setFavIds]             = useState(new Set())
  const [showBulkAdd, setShowBulkAdd]   = useState(false)
  const [bulkHintHidden, dismissBulkHint] = useHintDismiss('meality_hint_bulkAdd_seen')

  const offsetRef     = useRef(0)
  const sentinelRef   = useRef(null)
  const loadMoreFnRef = useRef(null)
  const canLoadRef    = useRef(false)

  // ── Загрузка избранного ──────────────────────────────────────
  useEffect(() => {
    if (!token) return
    api.getFavoriteIds().then(({ dishIds }) => setFavIds(new Set(dishIds))).catch(() => {})
  }, [token])

  // ── Параметры запроса ────────────────────────────────────────
  const fridgeIds = useMemo(
    () => new Set((fridge || []).map(f => f.ingredientId)),
    [fridge]
  )

  const hasFilters = tags.size > 0 || cuisines.size > 0 || !!difficulty

  const getParams = useCallback(() => ({
    q:          q || undefined,
    mealTime:   mealTime || undefined,
    fridgeMode: inFridge ? 'true' : undefined,
    myKitchen:  token ? 'true' : undefined,
    favorites:  (token && favOnly) ? 'true' : undefined,
    tags:       tags.size ? [...tags].join(',') : undefined,
    cuisine:    cuisines.size ? [...cuisines][0] : undefined, // backend поддерживает один cuisine
    difficulty: difficulty || undefined,
    limit:      LIMIT,
  }), [q, mealTime, inFridge, favOnly, tags, cuisines, difficulty, token])

  // ── Загрузка ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    canLoadRef.current = false
    setLoading(true)
    offsetRef.current = 0
    try {
      const data = await api.getDishes({ ...getParams(), offset: 0 })
      const fetched = data.dishes ?? []
      const totalCnt = data.total ?? fetched.length
      setDishes(fetched)
      setTotal(totalCnt)
      offsetRef.current = fetched.length
      setHasMore(fetched.length < totalCnt)
    } catch (e) {
      setDishes([])
      setHasMore(false)
      show(e.message || t('list.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [getParams, show, t])

  const loadMore = useCallback(async () => {
    if (!canLoadRef.current) return
    canLoadRef.current = false
    setLoadingMore(true)
    try {
      const data = await api.getDishes({ ...getParams(), offset: offsetRef.current })
      const fetched = data.dishes ?? []
      const totalCnt = data.total ?? 0
      setDishes(prev => {
        const seen = new Set(prev.map(d => d.id))
        return [...prev, ...fetched.filter(d => !seen.has(d.id))]
      })
      offsetRef.current += fetched.length
      setHasMore(offsetRef.current < totalCnt)
    } catch {
      // тихо
    } finally {
      setLoadingMore(false)
    }
  }, [getParams])

  useEffect(() => { loadMoreFnRef.current = loadMore }, [loadMore])
  useEffect(() => {
    canLoadRef.current = hasMore && !loadingMore && !loading
  }, [hasMore, loadingMore, loading])

  // debounce при смене фильтров / поиска
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  // IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && canLoadRef.current) loadMoreFnRef.current?.()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────
  function handleToggleFav(dishId) {
    const isFav = favIds.has(dishId)
    setFavIds(prev => {
      const next = new Set(prev)
      isFav ? next.delete(dishId) : next.add(dishId)
      return next
    })
    isFav ? api.removeFavorite(dishId).catch(() => {}) : api.addFavorite(dishId).catch(() => {})
  }

  async function handleAddToPlan(dish) {
    try {
      await api.addMealPlan({ dishId: dish.id })
      show(t('list.addToPlanSuccess', { name: dish.name }), 'success')
    } catch (e) {
      show(e.message || t('list.addToPlanError'), 'error')
    }
  }

  function resetAll() {
    setQ(''); setMealTime(''); setInFridge(false); setFavOnly(false)
    setTags(new Set()); setCuisines(new Set()); setDifficulty(null)
  }

  // подсчёт missing/inFridge для конкретного блюда (по ингредиентам в холодильнике)
  function getDishStats(dish) {
    const ings = dish.ingredients || []
    const nonBasic = ings.filter(i => {
      const ingId = i.ingredientId ?? i.id
      const isBasic = i.ingredient?.isBasic || i.isBasic
      return !isBasic && ingId
    })
    const have = nonBasic.filter(i => fridgeIds.has(i.ingredientId ?? i.id)).length
    const missing = nonBasic.length - have
    const inFridgeFlag = nonBasic.length > 0 && missing === 0
    return { missing, inFridge: inFridgeFlag }
  }

  const isGuest = !token
  const ownKitchenEmpty = !isGuest && !loading && dishes.length === 0 &&
    !q && !mealTime && !inFridge && !favOnly && !hasFilters
  const filteredEmpty = !loading && dishes.length === 0 && !ownKitchenEmpty

  // Плюрализация «блюдо/блюда/блюд» через i18next
  const dishWord = (n) => t('list.countDish', { count: n })
  const countLabel = total
    ? `${t('list.countLabelShow')} ${total} ${dishWord(total)}`
    : t('filters.applyClose')

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      <div className="px-5 pt-1 pb-24">
        <PageHeader
          title={t('list.pageTitle')}
          right={total > 0 && (
            <span className="text-[12px] tabular-nums text-text-3">
              {total} {dishWord(total)}
            </span>
          )}
          className="!px-0 !pt-4 !pb-0"
        />

        <div className="mt-7">
          <SearchInput value={q} onChange={setQ} />
        </div>

        <div className="mt-7">
          <MealTypeChips active={mealTime} onChange={setMealTime} />
        </div>

        {token && (
          <div className="mt-7">
            <QuickFilters
              inFridge={inFridge}
              fav={favOnly}
              hasFilters={hasFilters}
              onToggleFridge={() => setInFridge(v => !v)}
              onToggleFav={() => setFavOnly(v => !v)}
              onOpenFilters={() => setShowFilters(true)}
            />
          </div>
        )}

        {token && !bulkHintHidden && dishes.length > 0 && (
          <div className="mt-5">
            <HintBanner
              onClose={dismissBulkHint}
              onClick={() => setShowBulkAdd(true)}
            />
          </div>
        )}

        {/* Список / loader / empty */}
        {loading ? (
          <div className="mt-7 flex flex-col gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[96px] bg-bg-2 rounded-2xl animate-pulse border border-border" />
            ))}
          </div>
        ) : filteredEmpty || ownKitchenEmpty ? (
          <div className="mt-7">
            <EmptyState
              hasFilters={!!q || !!mealTime || inFridge || favOnly || hasFilters}
              ownEmpty={ownKitchenEmpty}
              isGuest={isGuest}
              onReset={resetAll}
              onAddDish={() => navigate('/dishes/new')}
              onRegister={() => navigate('/auth?mode=register')}
              onLogin={() => navigate('/auth')}
            />
          </div>
        ) : (
          <>
            <div className="mt-7 flex flex-col gap-2">
              {dishes.map(d => {
                const { missing, inFridge: inFridgeFlag } = getDishStats(d)
                return (
                  <DishRow
                    key={d.id}
                    dish={d}
                    isFav={favIds.has(d.id)}
                    missing={missing}
                    inFridge={inFridgeFlag}
                    onClick={() => navigate(`/dishes/${d.id}`)}
                    onToggleFav={token ? handleToggleFav : undefined}
                    onAddToPlan={token ? handleAddToPlan : undefined}
                  />
                )
              })}
            </div>
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && <Sentinel />}
          </>
        )}
      </div>

      {/* FAB */}
      {token && <FAB onClick={() => navigate('/dishes/new')} />}

      {/* Filter bottom-sheet */}
      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        tags={tags} setTags={setTags}
        cuisines={cuisines} setCuisines={setCuisines}
        difficulty={difficulty} setDifficulty={setDifficulty}
        countLabel={countLabel}
      />

      {/* BulkAdd modal */}
      {showBulkAdd && (
        <BulkAddModal
          onClose={() => setShowBulkAdd(false)}
          onDone={() => { setShowBulkAdd(false); load() }}
        />
      )}

      {Toast}
    </div>
  )
}
