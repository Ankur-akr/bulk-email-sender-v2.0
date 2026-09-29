import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getCampaign, getCampaignResults, downloadReport } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'

const PAGE_SIZE = 50
const LIVE = ['pending', 'sending']

export default function CampaignDetailPage() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState('')

  const loadCampaign = useCallback(
    () => getCampaign(id).then(r => setCampaign(r.data)).catch(console.error),
    [id],
  )

  const loadResults = useCallback(
    () =>
      getCampaignResults(id, { status: filter || undefined, search: search || undefined, page, page_size: PAGE_SIZE })
        .then(r => { setResults(r.data.results); setTotal(r.data.total) })
        .catch(console.error)
        .finally(() => setLoading(false)),
    [id, filter, search, page],
  )

  useEffect(() => { loadCampaign() }, [loadCampaign])
  useEffect(() => { loadResults() }, [loadResults])

  // While a campaign is still sending, refresh every 3s so the page updates by itself
  const isLive = campaign && LIVE.includes(campaign.status)
  useEffect(() => {
    if (!isLive) return
    const t = setInterval(() => { loadCampaign(); loadResults() }, 3000)
    return () => clearInterval(t)
  }, [isLive, loadCampaign, loadResults])

  const handleDownload = async (type) => {
    setDownloading(type)
    try {
      await downloadReport(id, type, campaign.name)
    } catch {
      /* the axios interceptor already shows a toast for API errors */
      toast.error('Failed to download report. Please try again.')
    } finally {
      setDownloading('')
    }
  }

  if (!campaign && loading) return <Spinner />
  if (!campaign) return <p className="text-slate-500">Campaign not found.</p>

  const rate = campaign.stats.total > 0 ? Math.round((campaign.stats.sent / campaign.stats.total) * 100) : 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canDownload = campaign.status === 'completed' || campaign.status === 'failed'

  const DownloadIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/campaigns" className="mt-1 p-1 -ml-1 text-slate-400 hover:text-slate-600" aria-label="Back to campaigns">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 break-words">{campaign.name}</h1>
          <p className="text-slate-400 text-sm break-words">{campaign.subject}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: campaign.stats.total, color: 'text-slate-800' },
          { label: 'Sent', value: campaign.stats.sent, color: 'text-green-600' },
          { label: 'Failed', value: campaign.stats.failed, color: 'text-red-500' },
          { label: 'Success Rate', value: `${rate}%`, color: rate >= 90 ? 'text-green-600' : 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-center">
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Delivery Progress{isLive ? ' (live)' : ''}</span>
          <span className="text-sm font-semibold text-slate-800">{rate}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full bg-green-500 rounded-full transition-all duration-500 ${isLive ? 'progress-striped' : ''}`} style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* Reports */}
      {canDownload && (
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
          <button
            onClick={() => handleDownload('sent')}
            disabled={!!downloading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {DownloadIcon}
            {downloading === 'sent' ? 'Preparing…' : 'Download Sent Report'}
          </button>
          <button
            onClick={() => handleDownload('failed')}
            disabled={!!downloading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {DownloadIcon}
            {downloading === 'failed' ? 'Preparing…' : 'Download Failed Report'}
          </button>
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3 sm:items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1">
            {['', 'sent', 'failed'].map(f => (
              <button
                key={f || 'all'}
                onClick={() => { setFilter(f); setPage(1) }}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f || 'All'}
              </button>
            ))}
            <p className="text-xs text-slate-400 ml-auto sm:ml-3">{total} results</p>
          </div>
        </div>

        {results.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No results found</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {results.map((r, i) => (
                <li key={`${r.email}-${i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.name}</p>
                      <p className="text-xs text-slate-500 break-all">{r.email}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {(r.error || r.message_id) && (
                    <p className={`mt-1.5 text-xs break-all ${r.error ? 'text-red-500' : 'text-slate-400 font-mono'}`}>
                      {r.error || r.message_id}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(r.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-5 py-2.5">Name</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-2.5">Email</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-2.5">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-2.5">Timestamp</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-2.5">Message ID / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.map((r, i) => (
                    <tr key={`${r.email}-${i}`} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-sm font-medium text-slate-900">{r.name}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{r.email}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {r.message_id ? (
                          <span className="text-slate-500 font-mono">{r.message_id.slice(0, 20)}...</span>
                        ) : r.error ? (
                          <span className="text-red-500">{r.error}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {total > PAGE_SIZE && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
