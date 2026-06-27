import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { getCampaign, getCampaignResults } from '../services/api'

const statusBadge = (status) => {
  const map = {
    pending: 'bg-slate-100 text-slate-600',
    sending: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    sent: 'bg-green-100 text-green-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>{status}</span>
}

export default function CampaignDetailPage() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    getCampaign(id).then(r => setCampaign(r.data)).catch(console.error)
  }, [id])

  useEffect(() => {
    getCampaignResults(id, { status: filter || undefined, search: search || undefined, page })
      .then(r => {
        setResults(r.data.results)
        setTotal(r.data.total)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, filter, search, page])

  if (!campaign && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) return <p className="text-slate-500">Campaign not found.</p>

  const rate = campaign.stats.total > 0 ? Math.round(campaign.stats.sent / campaign.stats.total * 100) : 0
  const downloadReport = async (type) => {
  try {
    const response = await api.get(
      `/reports/${id}/download/${type}`,
      {
        responseType: "blob",
      }
    );

    const blob = new Blob([response.data], {
      type: "text/csv",
    });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.name}_${type}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Failed to download report.");
  }
};
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/campaigns" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{campaign.name}</h1>
          <p className="text-slate-400 text-sm">{campaign.subject}</p>
        </div>
        <div className="ml-auto">{statusBadge(campaign.status)}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: campaign.stats.total, color: 'text-slate-800' },
          { label: 'Sent', value: campaign.stats.sent, color: 'text-green-600' },
          { label: 'Failed', value: campaign.stats.failed, color: 'text-red-500' },
          { label: 'Success Rate', value: `${rate}%`, color: rate >= 90 ? 'text-green-600' : 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Delivery Progress</span>
          <span className="text-sm font-semibold text-slate-800">{rate}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* Download reports */}
{campaign.status === 'completed' && (
  <div className="flex flex-wrap gap-2">
    <button
      onClick={() => downloadReport("sent")}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download Sent Report
    </button>

    <button
      onClick={() => downloadReport("failed")}
      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download Failed Report
    </button>
  </div>
)}

      {/* Results table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1">
            {['', 'sent', 'failed'].map(f => (
              <button
                key={f || 'all'}
                onClick={() => { setFilter(f); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 ml-auto">{total} results</p>
        </div>

        <div className="overflow-x-auto">
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
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-sm font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">{r.email}</td>
                  <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
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
          {results.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">No results found</p>
          )}
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {page} of {Math.ceil(total / 50)}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.ceil(total / 50)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
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
