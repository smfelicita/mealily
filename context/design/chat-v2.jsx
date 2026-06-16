// AIChatPage.jsx — Meality, страница ИИ-чата (4 состояния).
// Без app-header (52px) и tab bar (64px) — они в Layout.
// Mini top-bar 44px внутри страницы оставлен.
// Одиночный .jsx, моки инлайном, Tailwind core + lucide-react, useState.

import React, { useState } from 'react';
import {
  Sparkles, ArrowUp, Trash2, Crown, Lock, ChevronRight, MessageSquare,
  Clock, Flame,
} from 'lucide-react';

// ─── Токены ───────────────────────────────────────────────────
const C = {
  bg:           '#F6F4EF',
  card:         '#FFFFFF',
  bg3:          '#F5EFE6',
  border:       '#E5D8C8',
  accent:       '#C4704A',
  accentMuted:  'rgba(196,112,74,0.10)',
  accentBorder: 'rgba(196,112,74,0.25)',
  sage:         '#5C7A59',
  sageMuted:    'rgba(92,122,89,0.08)',
  text:         '#1C1917',
  text2:        '#78716C',
  text3:        '#A8A29E',
  pro:          '#B8935A',
  proMuted:     'rgba(184,147,90,0.12)',
  proBorder:    'rgba(184,147,90,0.30)',
};

// ─── Моки ─────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Что приготовить на завтрак?',
  'Хочу что-то лёгкое на обед',
  'Быстрый ужин за 15 минут',
  'Вегетарианский вариант',
  'Что можно из яиц и молока?',
];

const MESSAGES = [
  {
    id: 1, role: 'user',
    content: 'Хочу приготовить что-то быстрое из курицы',
  },
  {
    id: 2, role: 'assistant',
    content: 'Смотри, из того что есть в твоём холодильнике, могу предложить несколько быстрых вариантов с курицей:',
    dishes: [
      { id: 'a', name: 'Курица с грибами в сливочном соусе', img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=300', time: 25, cal: 420, tags: ['быстро'] },
      { id: 'b', name: 'Курица терияки с рисом',            img: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300', time: 30, cal: 480, tags: ['азия'] },
    ],
  },
  {
    id: 3, role: 'user',
    content: 'А совсем быстро, минут 15?',
  },
  {
    id: 4, role: 'assistant',
    content: 'Тогда вот — **куриные шашлычки на сковороде**. 15 минут, ничего сложного:',
    dishes: [
      { id: 'c', name: 'Быстрые куриные шашлычки', img: 'https://images.unsplash.com/photo-1552332386-f8dd00bc2f85?w=300', time: 15, cal: 290, tags: ['15 мин'] },
    ],
  },
];

const userName = 'Марина';
const messagesLeft = 3;
const dailyLimit = 50;
const isPro = false;

// ═══ MarkdownInline ═══════════════════════════════════════════
function MarkdownInline({ text }) {
  // только **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} style={{ color: C.accent, fontWeight: 700 }}>{p.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

// ═══ MiniTopBar ═══════════════════════════════════════════════
function MiniTopBar({ variant }) {
  return (
    <div
      className="h-11 flex items-center justify-between px-5"
      style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} strokeWidth={2.2} color={C.accent} />
        <span className="text-[15px] font-bold" style={{ color: C.text }}>
          ИИ-помощник
        </span>
      </div>
      <div className="flex items-center gap-2">
        {variant === 'active' && (
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'transparent', border: 'none', color: C.text3 }}
            aria-label="Очистить"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
        {isPro ? (
          <span
            className="inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: C.proMuted, color: C.pro, border: `1px solid ${C.proBorder}`, letterSpacing: 0.8 }}
          >
            <Crown size={10} strokeWidth={2.4} color={C.pro} />
            Pro
          </span>
        ) : variant !== 'guest' && (
          <span className="text-[11.5px] tabular-nums" style={{ color: C.text3 }}>
            {variant === 'limit' ? `0 из ${dailyLimit}` : `${messagesLeft} из ${dailyLimit}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══ Inline dish card (variant A — compact row) ═══════════════
function InlineDishCardA({ dish }) {
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-xl"
      style={{ background: C.bg3, border: `1px solid ${C.border}` }}
    >
      <img
        src={dish.img}
        alt=""
        style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', flexShrink: 0 }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-semibold leading-snug"
          style={{
            color: C.text,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {dish.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5" style={{ color: C.text3 }}>
          <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums">
            <Clock size={10} strokeWidth={2.2} />{dish.time} мин
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums">
            <Flame size={10} strokeWidth={2.2} />{dish.cal}
          </span>
        </div>
      </div>
      <ChevronRight size={14} strokeWidth={2} color={C.text3} style={{ flexShrink: 0 }} />
    </div>
  );
}

// ═══ Inline dish card (variant B — bigger, with tag) ══════════
function InlineDishCardB({ dish }) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <img
        src={dish.img}
        alt=""
        style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', display: 'block', flexShrink: 0 }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[13.5px] font-semibold leading-snug"
          style={{
            color: C.text,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {dish.name}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap" style={{ color: C.text3 }}>
          {dish.tags?.[0] && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ padding: '1px 6px', borderRadius: 9999, background: C.accentMuted, color: C.accent, letterSpacing: 0.4 }}
            >
              {dish.tags[0]}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums">
            <Clock size={10} strokeWidth={2.2} />{dish.time} мин
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums">
            <Flame size={10} strokeWidth={2.2} />{dish.cal}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══ Bubble ═══════════════════════════════════════════════════
function UserBubble({ children }) {
  return (
    <div
      className="self-end max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed"
      style={{
        background: C.accent, color: '#fff',
        borderRadius: 16, borderBottomRightRadius: 6,
        textWrap: 'pretty',
      }}
    >
      {children}
    </div>
  );
}

function AssistantBubble({ children }) {
  return (
    <div
      className="self-start max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed"
      style={{
        background: C.card, color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 16, borderBottomLeftRadius: 6,
        textWrap: 'pretty',
      }}
    >
      {children}
    </div>
  );
}

// ═══ Typing indicator ═════════════════════════════════════════
function TypingIndicator() {
  return (
    <div
      className="self-start px-3.5 py-3 flex items-center gap-1"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16, borderBottomLeftRadius: 6,
      }}
    >
      {[0, 150, 300].map(d => (
        <span
          key={d}
          className="rounded-full inline-block animate-bounce"
          style={{
            width: 6, height: 6, background: C.text3,
            animationDelay: `${d}ms`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}

// ═══ Suggestion card ══════════════════════════════════════════
function SuggestionCard({ text }) {
  return (
    <button
      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-left"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: C.accentMuted }}
        >
          <Sparkles size={11} strokeWidth={2.4} color={C.accent} />
        </span>
        <span className="text-[14px] truncate" style={{ color: C.text2 }}>
          {text}
        </span>
      </div>
      <ChevronRight size={16} strokeWidth={2} color={C.text3} style={{ flexShrink: 0 }} />
    </button>
  );
}

// ═══ Input bar ════════════════════════════════════════════════
function InputBar({ disabled, lockIcon }) {
  const [val, setVal] = useState('');
  const empty = val.trim().length === 0;
  return (
    <div
      className="flex items-end gap-2 px-3 py-2.5"
      style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}
    >
      <div
        className="flex-1 flex items-center pl-4 pr-2 py-2 rounded-full"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          value={val}
          onChange={e => !disabled && setVal(e.target.value)}
          placeholder={disabled ? 'Войдите чтобы спросить ИИ…' : 'Спросить про блюда…'}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-[14px]"
          style={{ color: C.text, fontFamily: 'inherit' }}
        />
      </div>
      <button
        disabled={empty || disabled}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: empty || disabled ? C.border : C.accent,
          color: '#fff',
          border: 'none',
          cursor: empty || disabled ? 'not-allowed' : 'pointer',
        }}
        aria-label="Отправить"
      >
        {lockIcon
          ? <Lock size={16} strokeWidth={2.2} />
          : <ArrowUp size={18} strokeWidth={2.4} />
        }
      </button>
    </div>
  );
}

// ═══ ProUpgradeBlock (state 4) ════════════════════════════════
function ProUpgradeBlock() {
  return (
    <div
      className="rounded-2xl p-4 mx-3 my-3"
      style={{ background: C.proMuted, border: `1px solid ${C.proBorder}` }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: '#fff', border: `1px solid ${C.proBorder}` }}
        >
          <Crown size={20} strokeWidth={2.2} color={C.pro} />
        </div>
        <h3 className="mt-2.5 text-[15px] font-bold" style={{ color: C.text }}>
          Достигнут дневной лимит
        </h3>
        <p
          className="mt-1 text-[13px] leading-relaxed max-w-[280px]"
          style={{ color: C.text2, textWrap: 'pretty' }}
        >
          Апгрейд на Pro — безлимитный ИИ-чат и доступ к фичам Pro-уровня
        </p>
        <button
          className="mt-3 h-11 px-5 rounded-full text-white text-[13.5px] font-bold"
          style={{
            background: C.pro, border: 'none',
            boxShadow: '0 6px 18px rgba(184,147,90,0.40)',
          }}
        >
          Попробовать Pro
        </button>
        <button
          className="mt-1 h-9 px-3 text-[12px] font-bold"
          style={{ background: 'transparent', color: C.text3, border: 'none' }}
        >
          Узнать больше
        </button>
      </div>
    </div>
  );
}

// ═══ Guest CTA ════════════════════════════════════════════════
function GuestCTA() {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center text-center mx-1"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: 80, height: 80, background: C.accentMuted, border: `1px solid ${C.accentBorder}` }}
      >
        <Sparkles size={32} strokeWidth={2} color={C.accent} />
      </div>
      <h2 className="mt-4 text-[17px] font-bold" style={{ color: C.text }}>
        ИИ-помощник
      </h2>
      <p
        className="mt-2 text-[14px] leading-relaxed max-w-[280px]"
        style={{ color: C.text2, textWrap: 'pretty' }}
      >
        Подберу блюда с учётом твоего холодильника и предпочтений. Доступно после регистрации.
      </p>
      <button
        className="mt-5 w-full h-12 rounded-full text-white text-[14px] font-bold"
        style={{ background: C.accent, border: 'none', boxShadow: '0 6px 18px rgba(196,112,74,0.35)' }}
      >
        Зарегистрироваться бесплатно
      </button>
      <button
        className="mt-2 h-10 px-4 rounded-full text-[13px] font-bold"
        style={{ background: 'transparent', color: C.text2, border: 'none' }}
      >
        Уже есть аккаунт? Войти
      </button>
    </div>
  );
}

// ═══ Empty welcome ════════════════════════════════════════════
function EmptyWelcome() {
  return (
    <div className="flex flex-col items-center text-center py-3">
      <Sparkles size={40} strokeWidth={1.8} color={C.accent} />
      <h2 className="mt-3 text-[17px] font-bold" style={{ color: C.text }}>
        Привет, {userName}!
      </h2>
      <p
        className="mt-1.5 text-[14px] leading-relaxed max-w-[300px]"
        style={{ color: C.text2, textWrap: 'pretty' }}
      >
        Расскажи, что хочешь съесть — подберу варианты с учётом твоего холодильника
      </p>
    </div>
  );
}

// ═══ Screen ═══════════════════════════════════════════════════
function Screen({ variant }) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: C.bg, color: C.text,
        fontFamily: 'Nunito, system-ui, sans-serif', textWrap: 'pretty',
        minHeight: 760,
      }}
    >
      <MiniTopBar variant={variant} />

      {/* CONTENT */}
      <div className="flex-1 flex flex-col">
        {variant === 'guest' && (
          <div className="flex-1 flex items-center px-5 py-7">
            <div className="w-full">
              <GuestCTA />
            </div>
          </div>
        )}

        {variant === 'empty' && (
          <div className="px-5 pt-7 pb-4 flex flex-col">
            <EmptyWelcome />
            <div className="mt-7 flex flex-col gap-2">
              {SUGGESTIONS.map(s => <SuggestionCard key={s} text={s} />)}
            </div>
          </div>
        )}

        {variant === 'active' && (
          <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
            {/* m1 user */}
            <UserBubble>{MESSAGES[0].content}</UserBubble>
            {/* m2 assistant + cards (variant A) */}
            <AssistantBubble>
              <MarkdownInline text={MESSAGES[1].content} />
              <div className="mt-2.5 flex flex-col gap-1.5">
                {MESSAGES[1].dishes.map(d => <InlineDishCardA key={d.id} dish={d} />)}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider" style={{ color: C.text3, letterSpacing: 0.6 }}>
                — вариант A · компактная строка —
              </div>
            </AssistantBubble>
            {/* m3 user */}
            <UserBubble>{MESSAGES[2].content}</UserBubble>
            {/* m4 assistant + bigger card (variant B) */}
            <AssistantBubble>
              <MarkdownInline text={MESSAGES[3].content} />
              <div className="mt-2.5 flex flex-col gap-1.5">
                {MESSAGES[3].dishes.map(d => <InlineDishCardB key={d.id} dish={d} />)}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider" style={{ color: C.text3, letterSpacing: 0.6 }}>
                — вариант B · с тегом и бóльшим фото —
              </div>
            </AssistantBubble>
            {/* typing */}
            <TypingIndicator />
          </div>
        )}

        {variant === 'limit' && (
          <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
            <UserBubble>{MESSAGES[0].content}</UserBubble>
            <AssistantBubble>
              <MarkdownInline text={MESSAGES[1].content} />
              <div className="mt-2.5 flex flex-col gap-1.5">
                {MESSAGES[1].dishes.map(d => <InlineDishCardA key={d.id} dish={d} />)}
              </div>
            </AssistantBubble>
          </div>
        )}
      </div>

      {/* BOTTOM (input bar / pro / guest-disabled) */}
      <div className="pb-24">
        {variant === 'guest' && <InputBar disabled lockIcon />}
        {variant === 'empty' && <InputBar />}
        {variant === 'active' && <InputBar />}
        {variant === 'limit' && <ProUpgradeBlock />}
      </div>
    </div>
  );
}

// ═══ Divider ══════════════════════════════════════════════════
function Divider({ label }) {
  return (
    <div className="h-8 flex items-center justify-center" style={{ background: '#E5E7EB' }}>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#4B5563' }}>{label}</span>
    </div>
  );
}

// ═══ Default export ═══════════════════════════════════════════
export default function AIChatPageArtefact() {
  return (
    <div style={{ background: '#E5E7EB', fontFamily: 'Nunito, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[430px]">
        <Divider label="— 1. Гость (CTA + lock-input) —" />
        <Screen variant="guest" />
        <Divider label="— 2. Пустой чат + suggestions —" />
        <Screen variant="empty" />
        <Divider label="— 3. Активный чат + 2 варианта inline-карточек + typing —" />
        <Screen variant="active" />
        <Divider label="— 4. Лимит исчерпан · Pro-upgrade —" />
        <Screen variant="limit" />
        <div className="py-4 text-center text-[10.5px]" style={{ color: '#6B7280', background: '#E5E7EB' }}>
          Без app-header / tab bar — только контент. Mini top-bar 44px внутри страницы.
        </div>
      </div>
    </div>
  );
}
