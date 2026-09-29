import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewCampaignPage from './pages/NewCampaignPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import SettingsPage from './pages/SettingsPage'


class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected application error' }
  }

  componentDidCatch(error, info) {
    console.error('UI render error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">The page encountered an unexpected error. Reload the application to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Reload application
          </button>
          {this.state.message && <p className="mt-3 text-[11px] text-slate-400 break-words">{this.state.message}</p>}
        </div>
      </div>
    )
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
        <AppErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={<ProtectedRoute><Layout /></ProtectedRoute>}
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="campaigns/:id" element={<CampaignDetailPage />} />
                <Route path="new-campaign" element={<NewCampaignPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
            <ToastContainer position="top-center" autoClose={4000} newestOnTop limit={3} />
          </AuthProvider>
        </AppErrorBoundary>
    </BrowserRouter>
  )
}

export default App
