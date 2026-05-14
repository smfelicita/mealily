// GroupsPage — список групп пользователя.
// Портировано из context/design/groups-v2.jsx.
// Состояния: guest / empty / list (с входящими приглашениями сверху).
// FRIENDS из артефакта → REGULAR на бэке.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Crown, ChevronRight, Mail, X, Plus, Home, Heart,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { api } from '../api'
import { useStore } from '../store'
import { Loader, GuestBlock, PageHeader, useToast } from '../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────
function relativeTime(iso, t) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return t('relative.today')
  if (days === 1) return t('relative.yesterday')
  if (days < 7) return t('relative.daysAgo', { count: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return t('relative.weeksAgo', { count: weeks })
  const months = Math.floor(days / 30)
  return t('relative.monthsAgo', { count: months })
}

// ═══ TypeBadge ════════════════════════════════════════════════════
function TypeBadge({ type }) {
  const { t } = useTranslation('groups')
  const isFamily = type === 'FAMILY'
  return (
    <span className={[
      'inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border',
      isFamily
        ? 'bg-accent-muted border-accent-border text-accent'
        : 'bg-sage-muted border-sage-border text-sage',
    ].join(' ')}
    style={{ letterSpacing: 0.6 }}
    >
      {t(`typeBadge.${type}`)}
    </span>
  )
}

// ═══ SectionLabel ═════════════════════════════════════════════════
function SectionLabel({ children, count }) {
  return (
    <div
      className="text-[11px] font-bold uppercase tracking-wider text-text-2 mb-3"
      style={{ letterSpacing: 0.6 }}
    >
      {children}
      {count != null && <span className="tabular-nums"> · {count}</span>}
    </div>
  )
}

// ═══ Incoming invite card ═════════════════════════════════════════
function IncomingInviteCard({ invite, onAccept, onDecline }) {
  const { t } = useTranslation('groups')
  return (
    <div className="rounded-2xl bg-bg-2 border border-accent-border p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent-muted">
        <Mail size={18} strokeWidth={2} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold leading-tight text-text">
          {invite.groupName}
        </div>
        <div className="text-[12px] mt-0.5 text-text-3 truncate">
          {t('invite.from', { name: invite.invitedByName, time: relativeTime(invite.invitedAt, t) })}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onAccept(invite)}
          className="h-8 px-3 rounded-full text-white text-[12.5px] font-bold bg-accent"
        >
          {t('invite.accept')}
        </button>
        <button
          type="button"
          onClick={() => onDecline(invite)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-3"
          aria-label={t('invite.declineAria')}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

// ═══ Group card ═══════════════════════════════════════════════════
function GroupCard({ group, currentUserId, onClick }) {
  const { t } = useTranslation('groups')
  const isFamily = group.type === 'FAMILY'
  const TypeIcon = isFamily ? Home : Heart
  const meIsOwner = group.ownerId === currentUserId
  const memberCount = group.membersCount ?? 0
  const dishesCount = group.dishesCount ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-bg-2 border border-border p-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className={[
          'rounded-xl flex items-center justify-center shrink-0 border',
          isFamily ? 'bg-accent-muted border-accent-border' : 'bg-sage-muted border-sage-border',
        ].join(' ')}
        style={{ width: 48, height: 48 }}
        >
          <TypeIcon
            size={22}
            strokeWidth={2}
            className={isFamily ? 'text-accent' : 'text-sage'}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[16px] font-bold leading-tight truncate text-text">
              {group.name}
            </div>
            {meIsOwner && (
              <Crown size={12} strokeWidth={2.4} className="text-accent shrink-0" fill="currentColor" />
            )}
          </div>
          <TypeBadge type={group.type} />
        </div>
        <ChevronRight size={18} strokeWidth={2} className="text-text-3 shrink-0 mt-1" />
      </div>

      <div
        className="mt-3 pt-3 text-[12px] tabular-nums text-text-3"
        style={{ borderTop: '1px dashed var(--color-border)' }}
      >
        {memberCount} {t('member', { count: memberCount })} · {dishesCount} {t('dishesLabel')}
      </div>
    </button>
  )
}

// ═══ FAB ══════════════════════════════════════════════════════════
function FAB({ onClick }) {
  const { t } = useTranslation('groups')
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed h-12 px-4 rounded-full flex items-center gap-1.5 bg-accent text-white text-[13.5px] font-bold z-40
        active:scale-95 transition-transform"
      style={{ right: 16, bottom: 80, boxShadow: '0 8px 24px rgba(196,112,74,0.45)' }}
      aria-label={t('page.createFab')}
    >
      <Plus size={16} strokeWidth={2.4} />
      {t('page.createFab')}
    </button>
  )
}

// ═══ Empty state (нет групп) ══════════════════════════════════════
function NoGroupsEmpty({ onCreate }) {
  const { t } = useTranslation('groups')
  return (
    <div className="flex flex-col items-center text-center px-4" style={{ paddingTop: 40 }}>
      <div
        className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-accent-muted border border-accent-border"
      >
        <Users size={30} strokeWidth={2} className="text-accent" />
      </div>
      <h2 className="mt-4 text-[17px] font-bold text-text" style={{ textWrap: 'balance' }}>
        {t('empty.title')}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed max-w-[290px] text-text-2" style={{ textWrap: 'pretty' }}>
        {t('empty.desc')}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 h-12 px-6 rounded-full bg-accent text-white text-[13.5px] font-bold flex items-center gap-1.5"
        style={{ boxShadow: '0 6px 18px rgba(196,112,74,0.30)' }}
      >
        <Plus size={15} strokeWidth={2.4} />
        {t('empty.create')}
      </button>
    </div>
  )
}

// ═══ Guest block ══════════════════════════════════════════════════
function GuestGroupsBlock() {
  const { t } = useTranslation('groups')
  return (
    <div>
      <PageHeader title={t('page.title')} />
      <div className="px-5 pt-4">
        <GuestBlock
          icon={<Users size={26} strokeWidth={1.8} />}
          title={t('guest.title')}
          description={t('guest.desc')}
          registerText={t('guest.register')}
          loginText={t('guest.login')}
        />
      </div>
    </div>
  )
}

// ═══ Main page ════════════════════════════════════════════════════
export default function GroupsPage() {
  const { t } = useTranslation('groups')
  const navigate = useNavigate()
  const user  = useStore(s => s.user)
  const token = useStore(s => s.token)
  const { show, Toast } = useToast()

  const [groups, setGroups]     = useState([])
  const [invites, setInvites]   = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      api.getGroups().catch(() => []),
      api.getIncomingInvites().catch(() => []),
    ]).then(([g, i]) => {
      setGroups(g)
      setInvites(i)
    }).finally(() => setLoading(false))
  }, [token])

  async function handleAccept(invite) {
    try {
      await api.acceptInvite(invite.token)
      show(t('invite.acceptedSuccess', { name: invite.groupName }), 'success')
      const [g, i] = await Promise.all([api.getGroups(), api.getIncomingInvites()])
      setGroups(g)
      setInvites(i)
    } catch (e) { show(e.message, 'error') }
  }

  async function handleDecline(invite) {
    if (!confirm(t('invite.declineConfirm', { name: invite.groupName }))) return
    try {
      await api.revokeInvite(invite.groupId, invite.token)
      setInvites(prev => prev.filter(x => x.token !== invite.token))
      show(t('invite.declinedSuccess'), 'success')
    } catch (e) { show(e.message, 'error') }
  }

  if (!token) return <GuestGroupsBlock />
  if (loading) return <Loader fullPage />

  const isEmpty = groups.length === 0 && invites.length === 0

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        right={groups.length > 0 && (
          <span className="text-[12px] tabular-nums text-text-3">
            {groups.length} {t('group', { count: groups.length })}
          </span>
        )}
      />

      <div className="px-5 pt-1 pb-28">
        {isEmpty ? (
          <div className="mt-7">
            <NoGroupsEmpty onCreate={() => navigate('/groups/new')} />
          </div>
        ) : (
          <>
            {invites.length > 0 && (
              <div className="mt-7">
                <SectionLabel count={invites.length}>{t('sections.invites')}</SectionLabel>
                <div className="flex flex-col gap-2">
                  {invites.map(inv => (
                    <IncomingInviteCard
                      key={inv.token}
                      invite={inv}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <div className="mt-7">
                <SectionLabel count={groups.length}>{t('sections.myGroups')}</SectionLabel>
                <div className="flex flex-col gap-2">
                  {groups.map(g => (
                    <GroupCard
                      key={g.id}
                      group={g}
                      currentUserId={user?.id}
                      onClick={() => navigate(`/groups/${g.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <FAB onClick={() => navigate('/groups/new')} />

      {Toast}
    </div>
  )
}
