import { useState, useEffect } from 'react'
import { useAdminStore } from '../adminStore'

function adminFetch(path, token) {
  return fetch('/api/admin' + path, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
}

function fmtCost(cost) {
  return '$' + (cost ?? 0).toFixed(4)
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`border rounded-xl p-5 ${accent ? 'bg-accent/10 border-accent/30' : 'bg-bg-2 border-border'}`}>
      <p className="text-xs text-text-2 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const token = useAdminStore(s => s.token)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch('/analytics/dashboard', token)
      .then(setData)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="text-text-2 py-12 text-center">Загрузка...</div>
  }

  if (!data || data.error) {
    return <div className="text-red-500 py-12 text-center">Ошибка загрузки</div>
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Аналитика</h1>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-text-2 uppercase tracking-wide mb-3">Пользователи</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Всего пользователей" value={data.totalUsers.toLocaleString('ru')} accent />
          <StatCard label="Новых за 7 дней" value={data.newUsersLast7Days.toLocaleString('ru')} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-2 uppercase tracking-wide mb-3">AI — сегодня</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Запросы" value={data.aiRequestsToday.toLocaleString('ru')} />
          <StatCard label="Стоимость" value={fmtCost(data.aiCostToday)} />
          <StatCard label="Ошибки" value={data.aiErrorsToday} />
        </div>
        <p className="text-xs text-text-2 mt-3">
          Подробная AI-статистика по периодам — в разделе{' '}
          <a href="/admin/ai" className="text-accent hover:underline">AI-статистика</a>.
        </p>
      </section>
    </div>
  )
}
