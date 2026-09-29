import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats, getCampaigns } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'

const ICONS = {
  contacts:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  sent:      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  failed:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  pending:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  rate:      'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  campaigns: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
}

const COLORS = {
  blue:   'bg-blue-50 text-blue-600 border-blue-100',
  green:  'bg-green-50 text-green-600 border-green-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center border ${COLORS[color]}`}>
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[icon]} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{value}</p>
        <p className="text-xs sm:text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(), getCampaigns()])
      .then(([statsRes, campRes]) => {
        setStats(statsRes.data)
        setCampaigns(campRes.data.slice(0, 5))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const n = (v) => (v ?? 0).toLocaleString()

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of your email campaigns</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Contacts"   value={n(stats?.total_contacts)}  color="blue"   icon="contacts" />
        <StatCard label="Emails Sent"      value={n(stats?.emails_sent)}     color="green"  icon="sent" />
        <StatCard label="Failed Emails"    value={n(stats?.failed_emails)}   color="red"    icon="failed" />
        <StatCard label="Pending Emails"   value={n(stats?.pending_emails)}  color="orange" icon="pending" />
        <StatCard label="Success Rate"     value={`${stats?.success_rate ?? 0}%`} color="green" icon="rate" />
        <StatCard label="Total Campaigns"  value={n(stats?.total_campaigns)} color="purple" icon="campaigns" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Campaigns</h2>
          <Link to="/campaigns" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">No campaigns yet</p>
            <Link to="/new-campaign"
                  className="mt-3 inline-flex items-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Create your first campaign
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {campaigns.map(c => (
                <li key={c.id}>
                  <Link to={`/campaigns/${c.id}`} className="block px-4 py-3 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.subject}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="text-green-600 font-medium">{c.stats.sent} sent</span>
                      <span className="text-red-500 font-medium">{c.stats.failed} failed</span>
                      <span className="text-slate-500">{c.stats.total} total</span>
                      <span className="ml-auto text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Campaign</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Sent</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Failed</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm">{c.name}</Link>
                        <p className="text-xs text-slate-400 truncate max-w-xs">{c.subject}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">{c.stats.sent}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-500 font-medium">{c.stats.failed}</td>
                      <td className="px-6 py-3 text-right text-sm text-slate-600 font-medium">{c.stats.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
