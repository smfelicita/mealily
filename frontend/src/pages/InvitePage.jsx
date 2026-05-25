import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useStore } from '../store'
import { Button, Loader } from '../components/ui'

export default function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('groups')
  const user = useStore(s => s.user)

  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    api.getInvite(token)
      .then(setInvite)
      .catch(err => setError(err.message || t('invitePage.notFound')))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    if (!user) {
      navigate(`/auth?redirect=/invite/${token}`)
      return
    }
    setAccepting(true)
    try {
      const res = await api.acceptInvite(token)
      navigate(`/groups/${res.groupId}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setAccepting(false)
    }
  }

  if (loading) return <Loader fullPage />

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-bg fade-in">
      <div className="text-[40px] mb-1">🍽️</div>
      <h1 className="font-serif text-3xl2 font-extrabold mb-8">MealBot</h1>

      <div className="w-full max-w-[360px] bg-bg-2 border border-border rounded-DEFAULT p-6 fade-up">
        {error ? (
          <>
            <p className="text-[32px] text-center mb-3">❌</p>
            <h2 className="font-serif text-xl font-extrabold mb-2 text-center">{t('invitePage.invalidTitle')}</h2>
            <p className="text-sm2 text-text-2 text-center mb-5">{error}</p>
            <Button className="w-full" onClick={() => navigate('/')}>{t('invitePage.toHome')}</Button>
          </>
        ) : (
          <>
            <div className="text-[48px] text-center mb-3">
              {invite.groupType === 'FAMILY' ? '👨‍👩‍👧' : '👥'}
            </div>
            <h2 className="font-serif text-xl font-extrabold mb-1 text-center">
              {invite.groupName}
            </h2>
            {invite.groupType === 'FAMILY' && (
              <p className="text-xs text-accent text-center mb-1">{t('invitePage.familyBadge')}</p>
            )}
            <p className="text-sm2 text-text-2 text-center mb-1">
              {invite.membersCount} {t('member', { count: invite.membersCount })}
            </p>
            <p className="text-sm2 text-text-2 text-center mb-5">
              {t('invitePage.invitedBy', { name: invite.invitedBy })}
            </p>

            {!user && (
              <p className="text-xs text-text-3 text-center mb-4">
                {t('invitePage.loginRequired')}
              </p>
            )}

            <Button className="w-full" loading={accepting} onClick={handleAccept}>
              {!accepting && t(user ? 'invitePage.joinButton' : 'invitePage.loginAndJoin')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
