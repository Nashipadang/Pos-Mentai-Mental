import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const formatTxId = (id: string) => {
  if (!id) return ''

  // Format check 1: DDMMYYYY-XXXX-0000-0000-XXXXXXXXXXXX (Our new sequential format)
  if (/^\d{8}-\d{4}-0000-0000-[a-f0-9]{12}$/i.test(id)) {
    const parts = id.split('-')
    const dateStr = parts[0] // e.g. "01062026"
    const seqStr = parts[1]  // e.g. "0001"
    
    // We want output: TX-DDMMYY-XXXX (e.g. TX-010626-0001)
    const day = dateStr.slice(0, 2)
    const month = dateStr.slice(2, 4)
    const yearShort = dateStr.slice(6, 8) // e.g. "26" from "2026"
    
    return `TX-${day}${month}${yearShort}-${seqStr}`
  }

  // Format check 2: YYYYMMDD-HHMM-SS00-0000-XXXXXXXXXXXX (Legacy format)
  if (/^\d{8}-\d{4}-\d{4}-0000-[a-f0-9]{12}$/i.test(id)) {
    const parts = id.split('-')
    const date = parts[0] // 20260601
    const time = parts[1] // 1632
    const random = parts[4].slice(0, 4) // first 4 chars of the random hex
    return `TX-${date.slice(2)}-${time}-${random}` // e.g. TX-260601-1632-a1b2
  }

  // Fallback
  return id.length > 8 ? `TX-${id.slice(0, 8).toUpperCase()}` : id
}

export default api
