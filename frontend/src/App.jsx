import { useEffect, useState, Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { api } from './api'
import Layout from './components/Layout'
import OnboardingModal from './components/domain/OnboardingModal'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import DishesPage from './pages/DishesPage'
import DishDetailPage from './pages/DishDetailPage'
import FridgePage from './pages/FridgePage'
import ChatPage from './pages/ChatPage'
import DishFormPage from './pages/DishFormPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import GroupFormPage from './pages/GroupFormPage'
import MealPlanPage from './pages/MealPlanPage'
import TelegramAuthPage from './pages/TelegramAuthPage'
import ProfilePage from './pages/ProfilePage'
import InvitePage from './pages/InvitePage'
import PrivacyPage from './pages/legal/PrivacyPage'
import TermsPage from './pages/legal/TermsPage'

const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminLoginPage = lazy(() => import('./admin/AdminLoginPage'))
const AdminIngredientsPage = lazy(() => import('./admin/pages/AdminIngredientsPage'))
const AdminUsersPage = lazy(() => import('./admin/pages/AdminUsersPage'))
const AdminDishesPage = lazy(() => import('./admin/pages/AdminDishesPage'))
const AdminGroupsPage = lazy(() => import('./admin/pages/AdminGroupsPage'))
const AdminAiPage = lazy(() => import('./admin/pages/AdminAiPage'))
const AdminAnalyticsPage = lazy(() => import('./admin/pages/AdminAnalyticsPage'))
const AdminLogsPage = lazy(() => import('./admin/pages/AdminLogsPage'))
const AdminFlagsPage = lazy(() => import('./admin/pages/AdminFlagsPage'))

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
          <p className="text-lg font-bold">Что-то пошло не так</p>
          <p className="text-text-2 text-sm">Перезагрузите страницу — данные в порядке</p>
          <button
            className="mt-2 px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function RequireAuth({ children }) {
  const token = useStore(s => s.token)
  return token ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const token          = useStore(s => s.token)
  const setAuth        = useStore(s => s.setAuth)
  const setPlanDishIds = useStore(s => s.setPlanDishIds)
  const setFridge      = useStore(s => s.setFridge)
  const setFlags       = useStore(s => s.setFlags)

  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('mealbot_show_onboarding') === '1'
  )

  useEffect(() => {
    api.getFlags().then(setFlags).catch(() => {})
  }, [])

  useEffect(() => {
    if (!token) return
    api.me().then(user => setAuth(user, token)).catch(() => {})
    api.getMealPlans().then(plans => setPlanDishIds(plans.map(p => p.dishId))).catch(() => {})
    api.getFridge().then(({ items }) => setFridge(items)).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) {
      setShowOnboarding(false)
    } else if (localStorage.getItem('mealbot_show_onboarding') === '1') {
      setShowOnboarding(true)
    }
  }, [token])

  return (
    <BrowserRouter>
      <ErrorBoundary>
      {showOnboarding && token && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      <Routes>
        {/* Admin panel — lazy, отдельный Layout */}
        <Route path="/admin/login" element={<Suspense fallback={null}><AdminLoginPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={null}><AdminLayout /></Suspense>}>
          <Route index element={<Navigate to="/admin/ingredients" replace />} />
          <Route path="ingredients" element={<Suspense fallback={null}><AdminIngredientsPage /></Suspense>} />
          <Route path="users"       element={<Suspense fallback={null}><AdminUsersPage /></Suspense>} />
          <Route path="dishes"      element={<Suspense fallback={null}><AdminDishesPage /></Suspense>} />
          <Route path="groups"      element={<Suspense fallback={null}><AdminGroupsPage /></Suspense>} />
          <Route path="ai"          element={<Suspense fallback={null}><AdminAiPage /></Suspense>} />
          <Route path="analytics"   element={<Suspense fallback={null}><AdminAnalyticsPage /></Suspense>} />
          <Route path="logs"        element={<Suspense fallback={null}><AdminLogsPage /></Suspense>} />
          <Route path="flags"       element={<Suspense fallback={null}><AdminFlagsPage /></Suspense>} />
        </Route>

        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/tg" element={<TelegramAuthPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="dishes/:id" element={<DishDetailPage />} />
          <Route path="fridge" element={<FridgePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="my-recipes" element={<Navigate to="/dishes" replace />} />
          <Route path="dishes/new" element={<RequireAuth><DishFormPage /></RequireAuth>} />
          <Route path="dishes/:id/edit" element={<RequireAuth><DishFormPage /></RequireAuth>} />
          <Route path="groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
          <Route path="groups/new" element={<RequireAuth><GroupFormPage /></RequireAuth>} />
          <Route path="groups/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
          <Route path="groups/:id/edit" element={<RequireAuth><GroupFormPage /></RequireAuth>} />
          <Route path="plan" element={<MealPlanPage />} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
