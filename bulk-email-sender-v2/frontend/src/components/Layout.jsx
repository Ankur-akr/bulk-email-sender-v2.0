import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { toast } from 'react-toastify'

const icon = (d) => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',    icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') },
  { to: '/new-campaign', label: 'New Campaign', icon: icon('M12 4v16m8-8H4') },
  { to: '/campaigns',    label: 'Campaigns',    icon: icon('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z') },
  { to: '/settings',     label: 'Settings',     icon: icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z') },
]

function Avatar({ user }) {
  return user?.picture ? (
    <img src={user.picture} alt="" referrerPolicy="no-referrer"
         className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-100" />
  ) : (
    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
      <span className="text-blue-700 text-sm font-semibold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close the drawer whenever the route changes
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Lock page scroll behind the open drawer + close on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => e.key === 'Escape' && setSidebarOpen(false)
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [sidebarOpen])

  const handleLogout = () => {
    logout()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div className="min-h-[100dvh] flex bg-slate-50">
      {/* Sidebar (drawer on mobile, fixed column on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col
                    transform transition-transform duration-200 ease-out
                    lg:sticky lg:top-0 lg:h-[100dvh] lg:w-64 lg:max-w-none lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
        aria-label="Sidebar"
      >
        <div className="h-16 shrink-0 flex items-center justify-between lg:justify-center px-4 border-b border-slate-200">
          <img src="/logo.png" alt="Bulk Email Sender Pro" className="h-10 w-auto object-contain" />
          <button
            className="lg:hidden p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center px-3 sm:px-4 lg:px-6 gap-2 pt-[env(safe-area-inset-top)] box-content">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/logo.png" alt="" className="h-8 w-auto lg:hidden" />
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>
          <NavLink
            to="/new-campaign"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Campaign</span>
            <span className="sm:hidden">New</span>
          </NavLink>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
