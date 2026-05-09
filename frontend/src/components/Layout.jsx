// Layout — основной каркас приложения (header + content + tab bar).
// Портировано из context/design/layout-v2.jsx, но адаптировано под продакшн:
// - корневые страницы (/, /dishes, /fridge, /plan): обычный header (лого + Bell + Avatar)
// - вложенные (/profile, /groups/*, /dishes/new, /dishes/:id/edit): back-header (← + title + Bell + Avatar)
// - деталка /dishes/:id: full-bleed (Layout НЕ рендерит свой header — деталка ставит свою back-кнопку поверх hero)
// - tab bar: 4 таба (Главная / Блюда / Холодильник / План). Чат скрыт флагом, легко вернуть.

import { useState } from 'react'
import { Outlet, useNavigate, NavLink, useLocation, matchPath } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home, ChefHat, Refrigerator, Calendar,
  Bell, ChevronLeft, Sparkles,
} from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import { Avatar, Modal, InstallPrompt } from './ui'

// ─── Tabs config ─────────────────────────────────────────────────
// CHAT_ENABLED — флаг скрытого чат-таба. Когда фича будет готова, переключить на true.
const CHAT_ENABLED = false

// Метки берутся через t('common:nav.<key>') в TabBar.
const TABS = [
  { to: '/',       Icon: Home,         labelKey: 'home'    },
  { to: '/dishes', Icon: ChefHat,      labelKey: 'dishes'  },
  { to: '/fridge', Icon: Refrigerator, labelKey: 'fridge'  },
  { to: '/plan',   Icon: Calendar,     labelKey: 'plan'    },
  ...(CHAT_ENABLED ? [{ to: '/chat', Icon: Sparkles, labelKey: 'chat' }] : []),
]

// Ровно те страницы которые в TabBar — корневые табы
const TAB_PATHS = TABS.map(t => t.to)

// ─── Header mode ─────────────────────────────────────────────────
// 'root'  — обычный (лого + Bell + Avatar)
// 'back'  — back-header (← + title + Bell + Avatar)
// 'none'  — Layout не рендерит header (например /dishes/:id full-bleed)
// ВАЖНО: full-bleed страницы (DishDetailPage, DishFormPage) рисуют свой header.
// Layout сюда не лезет, чтобы не было двойного хедера.
function getHeaderMode(pathname) {
  // Форма блюда (новое / редактирование) — full-bleed, свой sticky-header с «Сохранить»
  if (pathname === '/dishes/new')              return { mode: 'none' }
  if (matchPath('/dishes/:id/edit', pathname)) return { mode: 'none' }

  // Деталка блюда — full-bleed, без layout-header
  if (matchPath('/dishes/:id', pathname)) return { mode: 'none' }

  // Чат — full-bleed (свой mini top-bar + sticky input снизу)
  if (pathname === '/chat') return { mode: 'none' }

  // Корневые табы — обычный header
  if (TAB_PATHS.includes(pathname)) return { mode: 'root' }

  // Вложенные: явно мапим в title-key (читается через t('common:backTitles.<key>'))
  const backMap = [
    { pattern: '/profile',        titleKey: 'profile'   },
    { pattern: '/groups',         titleKey: 'groups'    },
    { pattern: '/groups/new',     titleKey: 'groupNew'  },
    { pattern: '/groups/:id',     titleKey: 'group'     },
    { pattern: '/groups/:id/edit',titleKey: 'groupEdit' },
  ]
  for (const { pattern, titleKey } of backMap) {
    if (matchPath(pattern, pathname)) return { mode: 'back', titleKey }
  }

  // Дефолт — back-header без явного title
  return { mode: 'back', titleKey: null }
}

// ─── Bell (заглушка) ──────────────────────────────────────────────
function Bell_({ count = 0, onClick }) {
  const { t } = useTranslation('common')
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-10 rounded-full flex items-center justify-center relative
        text-text-2 hover:bg-bg-3 transition-colors focus:outline-none"
      aria-label={t('header.notifications')}
    >
      <Bell size={20} strokeWidth={2} />
      {count > 0 && count <= 9 && (
        <span
          className="absolute rounded-full bg-red-500"
          style={{ top: 8, right: 8, width: 8, height: 8, border: '2px solid #fff' }}
        />
      )}
      {count > 9 && (
        <span
          className="absolute rounded-full flex items-center justify-center tabular-nums bg-red-500 text-white"
          style={{
            top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
            fontSize: 9, fontWeight: 800, lineHeight: 1,
          }}
        >9+</span>
      )}
    </button>
  )
}

// ─── Brand block (для root header) ─────────────────────────────
function Brand({ onClick }) {
  const { t } = useTranslation('common')
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 focus:outline-none"
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-muted">
        <ChefHat size={16} strokeWidth={2.2} className="text-accent" />
      </div>
      <div className="flex flex-col leading-tight items-start">
        <span className="text-[16px] font-extrabold tracking-tight text-text">{t('brand.name')}</span>
        <span className="text-[10.5px] text-text-3">{t('brand.subtitle')}</span>
      </div>
    </button>
  )
}

// ─── Header ──────────────────────────────────────────────────────
function Header({ mode, titleKey, token, user, onAvatarClick, onAuthClick, onBackClick, onBrandClick }) {
  const { t } = useTranslation('common')
  const title = titleKey ? t(`backTitles.${titleKey}`) : ''
  const rightSlot = (
    <div className="flex items-center gap-1">
      <Bell_ count={0} onClick={() => {/* TODO: notifications */}} />
      {token ? (
        <button
          type="button"
          onClick={onAvatarClick}
          className="focus:outline-none rounded-full"
          aria-label={t('header.profile')}
        >
          <Avatar name={user?.name} size="md" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onAuthClick}
          className="h-8 px-3 rounded-full text-[13px] font-bold text-white bg-accent"
        >
          {t('header.loginButton')}
        </button>
      )}
    </div>
  )

  return (
    <header
      className="h-[52px] px-3 flex items-center justify-between sticky top-0 z-40 bg-bg-2 border-b border-border relative"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
    >
      {mode === 'back' ? (
        <>
          <button
            type="button"
            onClick={onBackClick}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-2
              hover:bg-bg-3 transition-colors focus:outline-none"
            aria-label={t('actions.back')}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          {title && (
            <div
              className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold truncate max-w-[200px] text-text"
              title={title}
            >
              {title}
            </div>
          )}
          {rightSlot}
        </>
      ) : (
        <>
          <Brand onClick={onBrandClick} />
          {rightSlot}
        </>
      )}
    </header>
  )
}

// ─── Profile dropdown ────────────────────────────────────────────
function ProfileModal({ onClose }) {
  const { t }    = useTranslation('common')
  const user     = useStore(s => s.user)
  const logout   = useStore(s => s.logout)
  const navigate = useNavigate()
  const [tgLink, setTgLink]       = useState(null)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgError, setTgError]     = useState('')

  async function connectTelegram() {
    setTgLoading(true); setTgError('')
    try {
      const { url } = await api.generateTelegramLink()
      setTgLink(url)
    } catch (e) { setTgError(e.message || t('profileMenu.errorGeneric')) }
    setTgLoading(false)
  }

  function go(path) { navigate(path); onClose() }
  function handleLogout() { logout(); onClose(); navigate('/auth') }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 pb-4 mb-1 border-b border-border">
        <Avatar name={user?.name} size="md" />
        <div className="min-w-0">
          <p className="font-bold text-[15px] truncate">{user?.name || t('profileMenu.user')}</p>
          <p className="text-xs text-text-2 truncate">
            {user?.email || (user?.telegramUsername ? `@${user.telegramUsername}` : '')}
          </p>
        </div>
      </div>

      <MenuItem onClick={() => go('/groups')} icon={<IcoGroups />}>{t('profileMenu.myGroups')}</MenuItem>
      <MenuItem onClick={() => go('/groups?action=create')} icon={<IcoPlus />}>{t('profileMenu.createGroup')}</MenuItem>
      <MenuDivider />

      {!tgLink ? (
        <MenuItem onClick={connectTelegram} disabled={tgLoading} icon={<IcoTelegram />}>
          {tgLoading ? '...' : t('profileMenu.telegramBot')}
        </MenuItem>
      ) : (
        <a href={tgLink} target="_blank" rel="noopener noreferrer" onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm bg-sage/10 text-sage font-semibold">
          <IcoTelegram /><span>{t('profileMenu.openBot')}</span>
        </a>
      )}
      {tgError && <p className="text-xs text-red-400 px-3 mt-1">{tgError}</p>}

      <MenuDivider />
      <MenuItem onClick={() => go('/profile')} icon={<IcoUser />}>{t('profileMenu.profile')}</MenuItem>
      <MenuDivider />
      <MenuItem onClick={handleLogout} className="text-red-400" icon={<IcoLogout />}>{t('profileMenu.logout')}</MenuItem>
    </Modal>
  )
}

const IcoGroups   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a5 5 0 0 1 5-5h2"/><circle cx="17" cy="9" r="3"/><path d="M21 21v-2a5 5 0 0 0-5-5h-1"/></svg>
const IcoPlus     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IcoTelegram = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
const IcoUser     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
const IcoLogout   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>

function MenuItem({ children, onClick, disabled, className = '', icon }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={[
        'w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium',
        'transition-colors hover:bg-bg-3 disabled:opacity-40',
        className,
      ].join(' ')}>
      {icon && <span className="shrink-0 text-text-2">{icon}</span>}
      {children}
    </button>
  )
}

function MenuDivider() { return <div className="h-px bg-border my-1.5 mx-3" /> }

// ─── TabBar ──────────────────────────────────────────────────────
function TabBar({ tabs, planBadge = 0, chatDot = false }) {
  const { t: tr } = useTranslation('common')
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-app mx-auto
        flex bg-bg-2 border-t border-border z-[100] pb-safe"
      style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.04)' }}
    >
      {tabs.map(tab => {
        const Icon = tab.Icon
        const badge = tab.to === '/plan' && planBadge > 0 ? planBadge : 0
        const dot   = tab.to === '/chat' && chatDot
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => [
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative min-h-[52px]',
              'focus:outline-none transition-colors',
              isActive ? 'text-accent' : 'text-text-3',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute rounded-full bg-accent"
                    style={{ top: 0, width: 32, height: 2 }}
                  />
                )}
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <Icon size={22} strokeWidth={2} />
                  {badge > 0 && (
                    <span
                      className="absolute rounded-full flex items-center justify-center tabular-nums bg-accent text-white"
                      style={{
                        top: -2, right: -4, minWidth: 16, height: 16, padding: '0 4px',
                        fontSize: 9, fontWeight: 800, lineHeight: 1,
                        border: '2px solid var(--color-bg-2)',
                      }}
                    >{badge}</span>
                  )}
                  {dot && (
                    <span
                      className="absolute rounded-full bg-accent"
                      style={{
                        top: 2, right: 2, width: 8, height: 8,
                        border: '2px solid var(--color-bg-2)',
                      }}
                    />
                  )}
                </div>
                <span
                  className="text-[10.5px] leading-none font-semibold"
                  style={{ fontWeight: isActive ? 700 : 600 }}
                >
                  {tr(`nav.${tab.labelKey}`)}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

// ─── Layout ──────────────────────────────────────────────────────
export default function Layout() {
  const token    = useStore(s => s.token)
  const user     = useStore(s => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)

  const headerInfo = getHeaderMode(location.pathname)
  // Гость видит только корневые / каталог (профиль/группы — за RequireAuth, до сюда не дойдёт)
  const tabs = token ? TABS : TABS.filter(t => t.to === '/' || t.to === '/dishes')

  return (
    <div className="flex flex-col min-h-dvh bg-bg max-w-app mx-auto">

      {headerInfo.mode !== 'none' && (
        <Header
          mode={headerInfo.mode}
          titleKey={headerInfo.titleKey}
          token={token}
          user={user}
          onAvatarClick={() => setProfileOpen(p => !p)}
          onAuthClick={() => navigate('/auth')}
          onBackClick={() => navigate(-1)}
          onBrandClick={() => navigate('/')}
        />
      )}

      <InstallPrompt />

      <main className="flex-1 flex flex-col pb-[64px]">
        <Outlet />
      </main>

      <TabBar tabs={tabs} />

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
