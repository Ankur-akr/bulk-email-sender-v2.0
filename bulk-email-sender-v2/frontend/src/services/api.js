/**
 * API service layer — uses JWT Bearer token stored in localStorage.
 * Token-based auth works seamlessly with Render backend + Vercel frontend.
 */
import axios from 'axios'
import { toast } from 'react-toastify'

// In production this points to your Render backend URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,   // JWT in header, not cookie
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'An error occurred'
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (err.response?.status !== 404) {
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const googleLogin = (credential) =>
  api.post('/auth/google', { credential })

export const adminLogin = (username, password) =>
  api.post('/auth/login', { username, password })

export const getMe = () => api.get('/auth/me')

export const getGoogleClientId = () => api.get('/auth/google-client-id')

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/campaigns/dashboard')

// ── Campaigns ─────────────────────────────────────────────────────────────────
export const getCampaigns = () => api.get('/campaigns/')
export const getCampaign = (id) => api.get(`/campaigns/${id}`)
export const getCampaignResults = (id, params) =>
  api.get(`/campaigns/${id}/results`, { params })

// ── Contacts ──────────────────────────────────────────────────────────────────
export const uploadCSV = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/contacts/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// ── Emails ────────────────────────────────────────────────────────────────────
export const sendEmails = (data) => api.post('/emails/send', data)
export const getProgress = (campaignId) => api.get(`/emails/progress/${campaignId}`)
export const verifyCredentials = () => api.post('/emails/verify-credentials')

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReportUrl = (campaignId, type) => {
  const token = localStorage.getItem('access_token')
  const base = import.meta.env.VITE_API_URL || '/api'
  return `${base}/reports/${campaignId}/download/${type}?token=${token}`
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = () => api.get('/settings/')
export const updateSettings = (data) => api.put('/settings/', data)

export default api
