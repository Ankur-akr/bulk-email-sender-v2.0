import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCampaigns } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'

const rateColor = (rate) => (rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-orange-500' : 'text-red-500')
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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

  const q = search.trim().toLowerCase()
  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)
  )
  const rateOf = (c) => (c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-0.5">{campaigns.length} total campaigns</p>
        </div>
      </div>

      <div className="relative">
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <Spinner className="h-48" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 px-4">
            <p className="text-slate-500 text-sm">{search ? 'No campaigns match your search' : 'No campaigns yet'}</p>
            {!search && (
              <Link to="/new-campaign" className="mt-3 inline-block text-blue-600 text-sm hover:underline">
                Create your first campaign
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filtered.map(c => {
                const rate = rateOf(c)
                return (
                  <li key={c.id}>
                    <Link to={`/campaigns/${c.id}`} className="block px-4 py-3.5 active:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{c.name}</p>
                          <p className="text-xs text-slate-400 truncate">{c.subject}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                        <div><p className="text-sm font-semibold text-slate-700">{c.stats.total}</p><p className="text-[11px] text-slate-400">Total</p></div>
                        <div><p className="text-sm font-semibold text-green-600">{c.stats.sent}</p><p className="text-[11px] text-slate-400">Sent</p></div>
                        <div><p className="text-sm font-semibold text-red-500">{c.stats.failed}</p><p className="text-[11px] text-slate-400">Failed</p></div>
                        <div><p className={`text-sm font-semibold ${rateColor(rate)}`}>{rate}%</p><p className="text-[11px] text-slate-400">Success</p></div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">{fmtDate(c.created_at)}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
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
                    const rate = rateOf(c)
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm block">{c.name}</Link>
                          <p className="text-xs text-slate-400 truncate max-w-xs">{c.subject}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3.5 text-right text-sm font-medium text-slate-700">{c.stats.total}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-medium text-green-600">{c.stats.sent}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-medium text-red-500">{c.stats.failed}</td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`text-sm font-semibold ${rateColor(rate)}`}>{rate}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
