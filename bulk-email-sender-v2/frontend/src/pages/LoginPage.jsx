import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { googleLogin, adminLogin, getGoogleClientId } from '../services/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false)
  const [checkingGoogle, setCheckingGoogle] = useState(true)
  const { setAuth, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
      return
    }

    const fetchGoogleConfig = async (retry = 5) => {
      try {
        const res = await getGoogleClientId()

        setHasGoogleAuth(!!res.data.client_id)
        setCheckingGoogle(false)

      } catch (err) {

        if (retry > 0) {
          console.log(`Backend waking up... Retrying (${retry})`)

          setTimeout(() => {
            fetchGoogleConfig(retry - 1)
          }, 3000)

        } else {
          setHasGoogleAuth(false)
          setCheckingGoogle(false)
        }
      }
    }

    fetchGoogleConfig()
  }, [user, navigate])

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true)
    try {
      const token = credentialResponse.access_token || credentialResponse.credential
      const res = await googleLogin(token)
      setAuth(res.data.access_token, res.data.user)
      toast.success(`Welcome, ${res.data.user.name}!`)
      navigate('/dashboard')
    } catch {
      toast.error('Google login failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const googleSignIn = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => toast.error('Google login failed'),
    flow: 'implicit',
  })

  const handleAdminLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Please enter username and password')
      return
    }
    setLoading(true)
    try {
      const res = await adminLogin(username, password)
      setAuth(res.data.access_token, res.data.user)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/30">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Bulk Email Sender</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8 relative">
          <button
            type="button"
            onClick={toggleTheme}
            className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>

          {/* Demo Notice */}
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86l-7.55 13.09A1 1 0 003.6 18.5h16.8a1 1 0 00.86-1.55L13.71 3.86a1 1 0 00-1.72 0z"
                />
              </svg>

              <div>
                <h3 className="text-sm font-semibold text-amber-900">
                  Demo Version
                </h3>

                <p className="mt-1 text-sm text-amber-800">
                  This application is publicly hosted for demonstration purposes.
                  <strong> Google Sign-In is fully functional.</strong> However, email
                  sending and certain backend integrations have been disabled because the
                  production API credentials have been revoked for security reasons.
                </p>

                <p className="mt-2 text-xs text-amber-700">
                  Please contact the developer for a full demonstration.
                </p>
              </div>
            </div>
          </div>

          {/* Google Sign-In — always shown */}
          <div className="mb-6">
            {checkingGoogle ? (
              <div className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>

                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Connecting to server...
                  </p>
                  <p className="text-xs text-slate-500">
                    Waking up backend (this may take 20–30 seconds)
                  </p>
                </div>
              </div>

            ) : hasGoogleAuth ? (

              <button
                onClick={() => googleSignIn()}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}

                {googleLoading ? "Signing in..." : "Continue with Google"}

              </button>

            ) : (

              <div className="w-full flex items-center justify-center px-4 py-3 border-2 border-red-200 rounded-xl bg-red-50">
                <div className="text-center">
                  <p className="text-sm font-semibold text-red-600">
                    Unable to connect to the server
                  </p>

                  <p className="text-xs text-red-500 mt-1">
                    Please refresh the page or try again.
                  </p>
                </div>
              </div>

            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Admin login */}
          {!showAdminForm ? (
            <button
              onClick={() => setShowAdminForm(true)}
              className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Sign in with admin credentials →
            </button>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      /* Eye-off icon */
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      /* Eye icon */
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdminForm(false)}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Secured with Google OAuth 2.0 + JWT
        </p>
      </div>
    </div>
  )
}