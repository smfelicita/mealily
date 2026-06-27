import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useStore } from '../store'

// Обработчик редиректа с oauth.yandex.ru: ?code=...&state=...
// Проверяет state (CSRF), меняет code на сессию через POST /auth/yandex.
export default function YandexCallbackPage() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const { setAuth, user } = useStore()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  useEffect(() => {
    if (user) { navigate('/', { replace: true }); return }

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')
    const savedState = sessionStorage.getItem('yandex_oauth_state')
    const redirectTo = sessionStorage.getItem('yandex_oauth_redirect') || '/'
    sessionStorage.removeItem('yandex_oauth_state')
    sessionStorage.removeItem('yandex_oauth_redirect')

    if (oauthError) { setError(t('yandexCallback.declined')); return }
    if (!code) { setError(t('yandexCallback.noCode')); return }
    if (!state || state !== savedState) { setError(t('yandexCallback.badState')); return }

    api.yandexAuth(code)
      .then(res => {
        setAuth(res.user, res.token)
        navigate(redirectTo, { replace: true })
      })
      .catch(err => setError(err.message || t('yandexCallback.failed')))
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 fade-in">
      <p className="text-2xl font-bold text-text mb-6">🍽️ Meality</p>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card px-6 py-8 text-center fade-up">
        {error ? (
          <>
            <p className="text-[32px] mb-3">❌</p>
            <h2 className="font-bold text-lg text-text mb-2">{t('yandexCallback.errorTitle')}</h2>
            <p className="text-sm text-text-2 mb-5">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/auth', { replace: true })}
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm"
            >
              {t('yandexCallback.backToAuth')}
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-4" />
            <h2 className="font-bold text-lg text-text mb-1">{t('yandexCallback.loading')}</h2>
            <p className="text-sm text-text-2">{t('yandexCallback.loadingDesc')}</p>
          </>
        )}
      </div>
    </div>
  )
}
