import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Analyze from './pages/Analyze'
import Archive from './pages/Archive'
import PatternDetail from './pages/PatternDetail'
import Settings from './pages/Settings'
import { Toast } from './lib/types'

export const ToastContext = {
  show: (_msg: string, _type: Toast['type']) => {},
}

function App() {
  const { initialize, initialized, user } = useAuthStore()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    initialize()
  }, [initialize])

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    const toast: Toast = { id, message, type }
    setToasts((prev) => [...prev, toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }

  ToastContext.show = showToast

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all duration-300 max-w-xs ${
              toast.type === 'success'
                ? 'bg-green-500'
                : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-gray-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Layout>
                <Inventory showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyze"
          element={
            <ProtectedRoute>
              <Layout>
                <Analyze showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/archive"
          element={
            <ProtectedRoute>
              <Layout>
                <Archive showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/archive/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PatternDetail showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <Settings showToast={showToast} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
