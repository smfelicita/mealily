// ChatPage — ИИ-помощник.
// Без артефакта, по brief-chat.md и паттернам других редизайн-страниц.
// Layout даёт mode='none' для /chat — мы рисуем свой mini top-bar и sticky input.
//
// Состояния: guest / empty (welcome+suggestions) / active (messages).
// Pro-бейдж и счётчик "N из 50" не реализованы — нет на бэке. При limitReached → input
// заменяется на блокирующую плашку.
//
// Inline-dish-card в bubble — компактная строка (variant A из брифа): фото 48×48
// + название + meta (Clock+время, Flame+калории) + ChevronRight.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Sparkles, Trash2, ArrowUp, Lock, ChevronRight, Clock, Flame, ChefHat,
} from 'lucide-react'

import { api } from '../api'
import { useStore } from '../store'

// ─── Константы ────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Что приготовить на завтрак?',
  'Хочу что-то лёгкое на обед',
  'Быстрый ужин за 15 минут',
  'Вегетарианский вариант',
  'Что можно из яиц и молока?',
]

const SUPABASE_IMG = 'https://nwtqeytmmqmkwqafkgin.supabase.co/storage/v1/object/public/media/images'

// ─── Helpers ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Текст ассистента: убираем маркеры [DISH:id], переносы → <br>, **bold**
function cleanAndFormat(text) {
  return escapeHtml(text.replace(/\[DISH:[a-z0-9]+\]/gi, ''))
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

function dishImage(dish) {
  if (!dish) return null
  const uploaded = dish.images?.[0] || dish.imageUrl
  if (uploaded) return uploaded
  const cat = dish.categories?.[0]
  return cat ? `${SUPABASE_IMG}/${cat.toLowerCase()}.jpg` : null
}

// ═══ Mini top bar ═════════════════════════════════════════════════
function MiniTopBar({ canClear, onClear }) {
  return (
    <div className="shrink-0 flex items-center justify-between h-11 px-4 border-b border-border bg-bg-2">
      <div className="flex items-center gap-1.5 text-text">
        <Sparkles size={15} strokeWidth={2.2} className="text-accent" />
        <span className="text-[15px] font-bold">ИИ-помощник</span>
      </div>
      {canClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[12.5px] font-bold text-text-3 hover:text-text-2"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          Очистить
        </button>
      )}
    </div>
  )
}

// ═══ Inline dish card (внутри assistant bubble) ═══════════════════
function InlineDishCard({ dish, onClick }) {
  const img = dishImage(dish)
  const cookTime = dish.cookTime
  const cal = dish.nutrition?.calories ?? dish.calories
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl bg-bg-3 p-2 flex items-center gap-2.5 active:scale-[0.99] transition-transform"
    >
      <div className="w-12 h-12 rounded-lg bg-bg-2 border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {img
          ? <img src={img} alt="" className="w-full h-full object-cover" />
          : <ChefHat size={18} strokeWidth={1.6} className="text-text-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-semibold leading-snug text-text"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {dish.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-3">
          {cookTime != null && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Clock size={10} strokeWidth={2.2} />
              {cookTime} мин
            </span>
          )}
          {cal != null && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Flame size={10} strokeWidth={2.2} />
              {cal}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={14} strokeWidth={2} className="text-text-3 shrink-0" />
    </button>
  )
}

// ═══ Bubbles ══════════════════════════════════════════════════════
function UserBubble({ children }) {
  return (
    <div className="self-end max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5
      bg-accent text-white text-[14px] leading-relaxed"
      style={{ textWrap: 'pretty' }}
    >
      {children}
    </div>
  )
}

function AssistantBubble({ msg, onDishClick }) {
  return (
    <div className="self-start max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5
      bg-bg-2 border border-border text-text text-[14px] leading-relaxed"
      style={{ textWrap: 'pretty' }}
    >
      <span dangerouslySetInnerHTML={{ __html: cleanAndFormat(msg.content) }} />
      {msg.dishes?.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {msg.dishes.map(d => (
            <InlineDishCard key={d.id} dish={d} onClick={() => onDishClick(d.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="self-start rounded-2xl rounded-bl-md px-3.5 py-3 bg-bg-2 border border-border">
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-text-3 inline-block animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

// ═══ Suggestion card ══════════════════════════════════════════════
function SuggestionCard({ text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-bg-2 border border-border px-4 py-3
        flex items-center justify-between gap-2 text-left
        active:bg-bg-3 transition-colors"
    >
      <span className="text-[14px] text-text-2 flex-1" style={{ textWrap: 'pretty' }}>
        {text}
      </span>
      <ChevronRight size={16} strokeWidth={2} className="text-text-3 shrink-0" />
    </button>
  )
}

// ═══ Empty welcome (для залогиненного, чат пуст) ═══════════════════
function EmptyWelcome({ onSuggest }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center pt-6 pb-3">
        <div className="w-16 h-16 rounded-full bg-accent-muted border border-accent-border
          flex items-center justify-center mx-auto mb-3">
          <Sparkles size={28} strokeWidth={2} className="text-accent" />
        </div>
        <h2
          className="text-[19px] font-extrabold tracking-tight text-text mb-1.5"
          style={{ textWrap: 'balance' }}
        >
          ИИ-помощник
        </h2>
        <p
          className="text-[14px] text-text-2 leading-relaxed max-w-[280px] mx-auto"
          style={{ textWrap: 'pretty' }}
        >
          Расскажи, что хочешь съесть — подберу варианты с учётом твоего холодильника
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map(s => (
          <SuggestionCard key={s} text={s} onClick={() => onSuggest(s)} />
        ))}
      </div>
    </div>
  )
}

// ═══ Guest block (центрированная карточка) ════════════════════════
function GuestBlock({ onRegister, onLogin }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[360px] rounded-2xl bg-bg-2 border border-border p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-accent-muted border border-accent-border
          flex items-center justify-center mx-auto mb-4">
          <Sparkles size={32} strokeWidth={2} className="text-accent" />
        </div>
        <h2
          className="text-[17px] font-bold tracking-tight text-text mb-2"
          style={{ textWrap: 'balance' }}
        >
          ИИ-помощник
        </h2>
        <p
          className="text-[14px] text-text-2 leading-relaxed mb-5"
          style={{ textWrap: 'pretty' }}
        >
          Подберу блюда с учётом твоего холодильника и предпочтений. Доступно после регистрации.
        </p>
        <button
          type="button"
          onClick={onRegister}
          className="w-full h-12 rounded-full bg-accent text-white text-[14px] font-bold mb-2"
          style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
        >
          Зарегистрироваться бесплатно
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="w-full h-10 text-[13px] font-bold text-text-2"
        >
          Уже есть аккаунт? Войти
        </button>
      </div>
    </div>
  )
}

// ═══ Input bar ════════════════════════════════════════════════════
function InputBar({ value, onChange, onSend, disabled, loading, locked }) {
  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  if (locked) {
    return (
      <div className="shrink-0 px-3 py-3 border-t border-border bg-bg-2">
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-3 border border-border">
          <Lock size={15} strokeWidth={2} className="text-text-3 shrink-0" />
          <span className="text-[13px] text-text-2 leading-snug" style={{ textWrap: 'pretty' }}>
            Дневной лимит сообщений исчерпан. Возвращайся завтра.
          </span>
        </div>
      </div>
    )
  }

  const canSend = !disabled && !loading && value.trim().length > 0

  return (
    <div className="shrink-0 px-3 py-2.5 border-t border-border bg-bg-2 flex items-end gap-2">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={disabled ? 'Войди, чтобы общаться' : 'Спросить про блюда…'}
        disabled={disabled || loading}
        className="flex-1 h-11 px-4 rounded-full bg-bg-2 border border-border
          text-[14.5px] text-text placeholder:text-text-3 outline-none
          focus:border-accent disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className={[
          'w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white transition-opacity',
          canSend ? 'bg-accent' : 'bg-border',
        ].join(' ')}
        style={canSend ? { boxShadow: '0 4px 12px rgba(196,112,74,0.30)' } : undefined}
        aria-label="Отправить"
      >
        {loading
          ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : <ArrowUp size={18} strokeWidth={2.4} />}
      </button>
    </div>
  )
}

// ═══ Main ═════════════════════════════════════════════════════════
export default function ChatPage() {
  const { chatMessages, addChatMessage, clearChatMessages, token, user, fridge } = useStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [input, setInput]           = useState(() => searchParams.get('prompt') || '')
  const [loading, setLoading]       = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const bottomRef = useRef(null)

  const isGuest = !token

  // Авто-скролл вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading || isGuest || limitReached) return

    setInput('')
    addChatMessage({ role: 'user', content: msg, id: Date.now() })
    setLoading(true)
    try {
      const res = await api.sendMessage(msg, chatMessages, user?.role, fridge)
      addChatMessage({
        role: 'assistant',
        content: res.message,
        dishes: res.dishes || [],
        id: Date.now() + 1,
      })
    } catch (e) {
      // 429 — лимит исчерпан
      if (e.data?.limitReached || /лимит/i.test(e.message)) {
        setLimitReached(true)
        addChatMessage({
          role: 'assistant',
          content: '⚠️ Дневной лимит сообщений исчерпан. Возвращайся завтра.',
          id: Date.now() + 1,
        })
      } else {
        addChatMessage({
          role: 'assistant',
          content: '⚠️ Ошибка: ' + e.message,
          id: Date.now() + 1,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const showWelcome = !isGuest && chatMessages.length === 0

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] bg-bg max-w-app mx-auto">
      <MiniTopBar
        canClear={!isGuest && chatMessages.length > 0}
        onClear={clearChatMessages}
      />

      {/* Body — guest / welcome / messages */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {isGuest ? (
          <GuestBlock
            onRegister={() => navigate('/auth?mode=register')}
            onLogin={() => navigate('/auth')}
          />
        ) : showWelcome ? (
          <div className="flex-1 px-5 py-5 fade-in">
            <EmptyWelcome onSuggest={send} />
          </div>
        ) : (
          <div className="px-4 py-3 flex flex-col gap-3 fade-in">
            {chatMessages.map(msg =>
              msg.role === 'user'
                ? <UserBubble key={msg.id}>{msg.content}</UserBubble>
                : <AssistantBubble
                    key={msg.id}
                    msg={msg}
                    onDishClick={id => navigate(`/dishes/${id}`)}
                  />
            )}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <InputBar
        value={input}
        onChange={setInput}
        onSend={() => send()}
        disabled={isGuest}
        loading={loading}
        locked={limitReached}
      />
    </div>
  )
}
