import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { getSettings, updateSettings, verifyCredentials } from '../services/api'
import Spinner from '../components/Spinner'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    sender_email: '',
    aws_region: 'us-east-1',
    delay_between_emails: 0.1,
    max_retry_count: 3
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    getSettings().then(r => setSettings(r.data)).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({
        ...settings,
        delay_between_emails: settings.delay_between_emails === '' ? 0.1 : settings.delay_between_emails,
        max_retry_count: settings.max_retry_count === '' ? 3 : settings.max_retry_count,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await verifyCredentials()
      if (res.data.valid) {
        toast.success('AWS credentials verified successfully!')
      } else {
        toast.error(`Credential check failed: ${res.data.error}`)
      }
    } catch {
      toast.error('Failed to verify credentials')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-2xl mx-auto lg:mx-0 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your email sending preferences</p>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
        <h2 className="font-semibold text-slate-900">Amazon SES Configuration</h2>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Security note:</strong> AWS credentials are read from the <code className="bg-amber-100 px-1 rounded text-xs">.env</code> file on the server and are never exposed to the frontend.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Sender Email Address</label>
            <input
              type="email"
              value={settings.sender_email}
              onChange={e => setSettings({ ...settings, sender_email: e.target.value })}
              placeholder="verified@yourdomain.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Must be a verified sender in your AWS SES account</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">AWS Region</label>
            <select
              value={settings.aws_region}
              onChange={e => setSettings({ ...settings, aws_region: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="us-east-1">US East (N. Virginia) — us-east-1</option>
              <option value="us-west-2">US West (Oregon) — us-west-2</option>
              <option value="eu-west-1">EU (Ireland) — eu-west-1</option>
              <option value="eu-central-1">EU (Frankfurt) — eu-central-1</option>
              <option value="ap-south-1">Asia Pacific (Mumbai) — ap-south-1</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore) — ap-southeast-1</option>
              <option value="ap-northeast-1">Asia Pacific (Tokyo) — ap-northeast-1</option>
            </select>
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 disabled:opacity-60 transition-colors"
          >
            {verifying ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Test AWS Connection
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sending Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
        <h2 className="font-semibold text-slate-900">Sending Configuration</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Delay Between Emails (seconds)</label>
            <input
              type="number"
              min={0.01}
              max={10}
              step={0.05}
              value={settings.delay_between_emails}
              onChange={e => setSettings({ ...settings, delay_between_emails: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Increase to avoid SES rate limits</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Retry Count</label>
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={settings.max_retry_count}
              onChange={e => setSettings({ ...settings, max_retry_count: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Retries per failed email</p>
          </div>
        </div>
      </div>

      {/* Environment info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Required Environment Variables</h3>
        <div className="space-y-1 font-mono text-xs text-slate-600">
          {['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'SENDER_EMAIL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'].map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-slate-400">#</span>
              <span>{v}=</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Set these in your <code className="bg-slate-100 px-1 rounded">.env</code> file in the backend directory</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 sm:py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}
