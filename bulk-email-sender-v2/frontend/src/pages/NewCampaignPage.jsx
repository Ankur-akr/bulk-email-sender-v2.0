import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-toastify'
import { uploadCSV, sendEmails, getProgress, getSettings, downloadReport } from '../services/api'
import { fillTemplate } from '../utils/template'

// Steps
const STEPS = ['Upload CSV', 'Compose Email', 'Preview & Send']

function StepIndicator({ current }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-center">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                ${i < current ? 'bg-blue-600 text-white' :
                  i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                  'bg-slate-100 text-slate-400'}
              `}>
                {i < current ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i === current ? 'text-blue-700' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 sm:mx-3 min-w-[1.5rem] ${i < current ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Mobile: only the current step's name fits, so show it underneath */}
      <p className="sm:hidden text-center text-sm font-medium text-blue-700 mt-3">
        Step {current + 1} of {STEPS.length}: {STEPS[current]}
      </p>
    </div>
  )
}

function ProgressPanel({ campaignId, onDone, onFailed }) {
  const [progress, setProgress] = useState({ total: 0, sent: 0, failed: 0, pending: 0, percentage: 0, status: 'sending' })
  const intervalRef = useRef(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await getProgress(campaignId)
        setProgress(res.data)
        if (res.data.status === 'completed') {
          clearInterval(intervalRef.current)
          onDone(res.data)
        } else if (res.data.status === 'failed') {
          clearInterval(intervalRef.current)
          onFailed?.(res.data)
        }
      } catch (_) {}
    }
    poll()
    intervalRef.current = setInterval(poll, 1500)
    return () => clearInterval(intervalRef.current)
  }, [campaignId])

  const pct = Math.round(progress.percentage || 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        {progress.status === 'failed' ? (
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : progress.status !== 'completed' ? (
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">
            {progress.status === 'completed' ? 'Campaign Complete!' : progress.status === 'failed' ? 'Campaign failed' : 'Sending emails...'}
          </h3>
          {progress.current_email && progress.status !== 'completed' && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">Sending to: {progress.current_email}</p>
          )}
        </div>
        <span className="ml-auto pl-2 text-xl sm:text-2xl font-bold text-blue-600">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progress.status !== 'completed' ? 'progress-striped' : ''} bg-blue-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: progress.total, color: 'text-slate-700' },
          { label: 'Sent', value: progress.sent, color: 'text-green-600' },
          { label: 'Failed', value: progress.failed, color: 'text-red-500' },
          { label: 'Remaining', value: progress.pending, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-3 bg-slate-50 rounded-lg">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 0: CSV Upload
  const [csvData, setCsvData] = useState(null)
  const [csvErrors, setCsvErrors] = useState([])

  // Step 1: Email composition
  const [campaignName, setCampaignName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [useHtml, setUseHtml] = useState(false)
  const [bodyHtml, setBodyHtml] = useState('')

  // Step 2: Sending
  const [sending, setSending] = useState(false)
  const [campaignId, setCampaignId] = useState(null)
  const [done, setDone] = useState(false)
  const [settings, setSettings] = useState({ delay_between_emails: 0.1, max_retry_count: 3, sender_email: '' })

  useEffect(() => {
    getSettings().then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    try {
      const res = await uploadCSV(file)
      setCsvData(res.data)
      setCsvErrors(res.data.errors || [])
      if (res.data.valid_count > 0) {
        toast.success(`Loaded ${res.data.valid_count} valid contacts`)
      }
      if (res.data.error_count > 0) {
        toast.warning(`${res.data.error_count} rows had errors and were skipped`)
      }
    } catch (err) {
      toast.error('Failed to parse CSV')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],   // what Windows/Android report for .csv
      'text/plain': ['.csv'],
    },
    maxFiles: 1
  })

  const handleSend = async () => {
    if (!campaignName || !subject || !bodyText) {
      toast.error('Please fill in all required fields')
      return
    }
    setSending(true)
    try {
      const res = await sendEmails({
        campaign_name: campaignName,
        subject,
        body: bodyText,
        body_html: useHtml ? bodyHtml : null,
        contacts: csvData.contacts,
        delay_seconds: settings.delay_between_emails,
        max_retries: settings.max_retry_count,
        sender_email: settings.sender_email
      })
      setCampaignId(res.data.campaign_id)
      toast.success('Campaign started!')
    } catch (err) {
      setSending(false)
      toast.error('Failed to start campaign')
    }
  }

  const handleReport = async (type) => {
    try { await downloadReport(campaignId, type, campaignName) }
    catch { toast.error('Failed to download report. Please try again.') }
  }

  const PLACEHOLDER_EXAMPLE = `Dear {name},

Welcome! We're excited to reach you at {email}.

Best regards,
Your Team`

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">New Campaign</h1>
        <p className="text-slate-500 text-sm mt-1">Upload contacts and compose your personalized email</p>
      </div>

      <StepIndicator current={step} />

      {/* STEP 0: Upload CSV */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Upload Contact List</h2>
          <p className="text-sm text-slate-500">
            Upload a CSV file with <code className="bg-slate-100 px-1 rounded text-xs">Name</code> and{' '}
            <code className="bg-slate-100 px-1 rounded text-xs">Email</code> columns.
          </p>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}
            `}
          >
            <input {...getInputProps()} />
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop your CSV here</p>
            ) : (
              <>
                <p className="text-slate-700 font-medium">
                  <span className="hidden sm:inline">Drag & drop your CSV file</span>
                  <span className="sm:hidden">Tap to choose a CSV file</span>
                </p>
                <p className="text-slate-400 text-sm mt-1 hidden sm:block">or click to browse</p>
              </>
            )}
          </div>

          {/* CSV sample */}
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs font-medium text-slate-500 mb-1">Expected format:</p>
            <pre className="text-xs text-slate-600 font-mono">
{`Name,Email
Alice,alice@example.com
Bob,bob@example.com`}
            </pre>
          </div>

          {/* Errors */}
          {csvErrors.length > 0 && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-800 mb-2">Rows with errors (skipped):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {csvErrors.map((e, i) => (
                  <p key={i} className="text-xs text-orange-700">
                    Row {e.row}: {e.errors.join(', ')}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {csvData && csvData.contacts.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Preview ({csvData.valid_count} contacts loaded)
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(csvData.contacts[0]).map(k => (
                        <th key={k} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvData.contacts.slice(0, 5).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {Object.values(c).map((v, j) => (
                          <td key={j} className="px-4 py-2 text-slate-700">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.contacts.length > 5 && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    +{csvData.contacts.length - 5} more contacts
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              disabled={!csvData || csvData.valid_count === 0}
              onClick={() => setStep(1)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Compose */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Compose Email</h2>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. Welcome Emails - June 2025"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Welcome {name}! Your invitation is here"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Message Body <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">HTML mode</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useHtml}
                    aria-label="HTML mode"
                    onClick={() => setUseHtml(!useHtml)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${useHtml ? 'bg-blue-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${useHtml ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                rows={10}
                placeholder={PLACEHOLDER_EXAMPLE}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
              />
              {useHtml && (
                <>
                  <p className="text-xs text-slate-500 mt-2 mb-1.5">HTML version (optional, for rich email clients):</p>
                  <textarea
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    rows={8}
                    placeholder="<p>Dear <strong>{name}</strong>,</p>"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                  />
                </>
              )}
            </div>
          </div>

          {/* Placeholder guide */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Available Placeholders</p>
            <div className="flex flex-wrap gap-2">
              {['name', 'email', ...(csvData?.contacts[0] ? Object.keys(csvData.contacts[0]).filter(k => k !== 'name' && k !== 'email') : [])].map(ph => (
                <code key={ph} className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 font-mono">
                  {`{${ph}}`}
                </code>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button onClick={() => setStep(0)} className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
              ← Back
            </button>
            <button
              disabled={!campaignName || !subject || !bodyText}
              onClick={() => setStep(2)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Preview & Send */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Campaign summary */}
          {!campaignId && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Preview & Send</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs font-medium mb-0.5">Campaign</p>
                  <p className="font-medium text-slate-900">{campaignName}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs font-medium mb-0.5">Recipients</p>
                  <p className="font-medium text-slate-900">{csvData?.valid_count} contacts</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                  <p className="text-slate-500 text-xs font-medium mb-0.5">Subject</p>
                  <p className="font-medium text-slate-900">{subject}</p>
                </div>
              </div>

              {/* Email preview with first contact */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Email preview (first contact):</p>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">Subject: {fillTemplate(subject, csvData?.contacts[0])}</p>
                  <hr className="border-slate-200 my-2" />
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {fillTemplate(bodyText, csvData?.contacts[0])}
                  </pre>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send {csvData?.valid_count} Emails
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Live progress */}
          {campaignId && (
            <ProgressPanel
              campaignId={campaignId}
              onFailed={() => toast.error('Campaign failed. Check the campaign page for details.')}
              onDone={(finalStats) => {
                setDone(true)
                toast.success(`Campaign complete! ${finalStats.sent} sent, ${finalStats.failed} failed.`)
              }}
            />
          )}

          {/* Done actions */}
          {done && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <p className="text-green-800 font-medium">Campaign finished!</p>
              <div className="grid grid-cols-1 sm:flex gap-2 sm:gap-3">
                <button
                  onClick={() => handleReport('sent')}
                  className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Download Sent Report
                </button>
                <button
                  onClick={() => handleReport('failed')}
                  className="px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  Download Failed Report
                </button>
                <button
                  onClick={() => navigate(`/campaigns/${campaignId}`)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-white transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
