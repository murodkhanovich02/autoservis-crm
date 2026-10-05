import axios from 'axios'

export const TOKEN_KEY = 'autoservis_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // FastAPI ro'yxatlarni ?status=a&status=b ko'rinishida kutadi
  paramsSerializer: { indexes: null },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || ''
    if (err.response?.status === 401 && !url.includes('/auth/login') && !url.startsWith('/public')) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function errorText(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => String(d.msg || '').replace(/^Value error, /, '')).join('; ')
  }
  if (err?.response?.status >= 500) return 'Serverda xatolik yuz berdi'
  if (err?.code === 'ERR_NETWORK') return "Server bilan aloqa yo'q"
  return err?.message || 'Xatolik'
}

export const get = (url, params) => api.get(url, { params }).then((r) => r.data)
export const post = (url, data) => api.post(url, data).then((r) => r.data)
export const patch = (url, data) => api.patch(url, data).then((r) => r.data)
export const put = (url, data) => api.put(url, data).then((r) => r.data)
export const del = (url) => api.delete(url).then((r) => r.data)

export async function download(url, params, fallbackName) {
  const r = await api.get(url, { params, responseType: 'blob' })
  const disposition = r.headers['content-disposition'] || ''
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] || fallbackName
  const href = URL.createObjectURL(r.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}
