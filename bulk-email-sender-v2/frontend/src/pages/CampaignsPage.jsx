import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCampaigns } from '../services/api'

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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCampaigns()
      .then(r => setCampaigns(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-0.5">{campaigns.length} total campaigns</p>
        </div>
        <Link
          to="/new-campaign"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Campaign
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm">
              {search ? 'No campaigns match your search' : 'No campaigns yet'}
            </p>
            {!search && (
              <Link to="/new-campaign" className="mt-3 inline-block text-blue-600 text-sm hover:underline">
                Create your first campaign
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Sent</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Failed</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-6 py-3">Success</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => {
                  const rate = c.stats.total > 0 ? Math.round(c.stats.sent / c.stats.total * 100) : 0
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm block">
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-400 truncate max-w-xs">{c.subject}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-slate-700">{c.stats.total}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-green-600">{c.stats.sent}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-red-500">{c.stats.failed}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={`text-sm font-semibold ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-orange-500' : 'text-red-500'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
