// Общая обёртка юридических страниц (/privacy, /terms).
// Standalone-страницы без основного Layout — доступны гостям, в т.ч. со страницы регистрации.

import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChefHat } from 'lucide-react'

export function LegalLayout({ title, updated, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-bg fade-in">
      <div className="max-w-[640px] mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="inline-flex items-center gap-1.5 text-sm2 text-text-2 hover:text-text"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Назад
          </button>
          <Link to="/" className="inline-flex items-center gap-1.5 text-accent font-extrabold">
            <ChefHat size={18} strokeWidth={2.2} />
            Meality
          </Link>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-text mb-1">{title}</h1>
        <p className="text-sm2 text-text-3 mb-6">Редакция от {updated}</p>

        <div className="flex flex-col gap-5 pb-10">{children}</div>
      </div>
    </div>
  )
}

export function LegalSection({ n, title, children }) {
  return (
    <section>
      <h2 className="text-base font-bold text-text mb-2">{n}. {title}</h2>
      <div className="flex flex-col gap-2 text-sm2 text-text-2 leading-relaxed" style={{ textWrap: 'pretty' }}>
        {children}
      </div>
    </section>
  )
}

export function LegalList({ items }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4" style={{ listStyleType: 'disc' }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
