import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats, getCampaigns } from '../services/api'

function StatCard({ label, value, icon, color, sub }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const statusBadge = (status) => {
  const map = {
    pending: 'bg-slate-100 text-slate-600',
    sending: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>
      {status}
    </span>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of your email campaigns</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Total Contacts"
          value={stats?.total_contacts?.toLocaleString() || 0}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Emails Sent"
          value={stats?.emails_sent?.toLocaleString() || 0}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Failed Emails"
          value={stats?.failed_emails?.toLocaleString() || 0}
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Emails"
          value={stats?.pending_emails?.toLocaleString() || 0}
          color="orange"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.success_rate || 0}%`}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Total Campaigns"
          value={stats?.total_campaigns || 0}
          color="purple"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Recent campaigns */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Campaigns</h2>
          <Link to="/campaigns" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm">No campaigns yet</p>
            <Link
              to="/new-campaign"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm">
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{c.subject}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">{c.stats.sent}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-500 font-medium">{c.stats.failed}</td>
                    <td className="px-6 py-3 text-right text-sm text-slate-600 font-medium">{c.stats.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
