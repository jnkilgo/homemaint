const BASE = '/api'

export function getToken() {
  return localStorage.getItem('hm_token')
}

export function setToken(token) {
  localStorage.setItem('hm_token', token)
}

export function clearToken() {
  localStorage.removeItem('hm_token')
  localStorage.removeItem('hm_user')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('hm_user')) } catch { return null }
}

export function setUser(user) {
  localStorage.setItem('hm_user', JSON.stringify(user))
}

async function req(method, path, body) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    window.location.reload()
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  login: async (username, password) => {
    const form = new URLSearchParams({ username, password })
    const res = await fetch(`${BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) throw new Error('Incorrect username or password')
    return res.json()
  },
  me: () => req('GET', '/auth/me'),

  // Properties
  getProperties: () => req('GET', '/properties/'),
  importAssets: (property_id, assets) => req('POST', '/import/assets', { property_id, assets }),
  getDefaultProperty: () => req('GET', '/properties/default'),
  getDashboard: () => req('GET', '/properties/dashboard'),
  createProperty: (data) => req('POST', '/properties/', data),
  updateProperty: (id, data) => req('PUT', `/properties/${id}`, data),
  deleteProperty: (id) => req('DELETE', `/properties/${id}`),

  // Assets
  getAssets: (propertyId) => req('GET', `/assets/?property_id=${propertyId}`),
  getAsset: (id) => req('GET', `/assets/${id}`),
  createAsset: (data) => req('POST', '/assets/', data),
  updateAsset: (id, data) => req('PUT', `/assets/${id}`, data),
  deleteAsset: (id) => req('DELETE', `/assets/${id}`),
  updateUsage: (id, data) => req('PUT', `/assets/${id}/usage`, data),

  // Tasks
  getTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/tasks/?${q}`)
  },
  createTask: (data) => req('POST', '/tasks/', data),
  updateTask: (id, data) => req('PUT', `/tasks/${id}`, data),
  deleteTask: (id) => req('DELETE', `/tasks/${id}`),

  // Parts
  getAssetParts: (assetId) => req('GET', `/parts/?asset_id=${assetId}`),
  getTaskParts: (taskId) => req('GET', `/task-parts/?task_id=${taskId}`),
  createPart: (data) => req('POST', `/parts/`, data),
  updatePart: (id, data) => req('PUT', `/parts/${id}`, data),
  deletePart: (id) => req('DELETE', `/parts/${id}`),

  // Completion logs
  getLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/logs/?${q}`)
  },
  logCompletion: (data) => req('POST', '/logs/', data),
  getAnnualSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/logs/summary/annual?${q}`)
  },

  // Spares
  getSpares: (assetId) => req('GET', `/spares/?asset_id=${assetId}`),
  createSpare: (data) => req('POST', '/spares/', data),
  updateSpare: (id, data) => req('PUT', `/spares/${id}`, data),
  deleteSpare: (id) => req('DELETE', `/spares/${id}`),

  // Paint
  getPaint: (propertyId) => req('GET', `/paint/?property_id=${propertyId}`),
  createPaint: (data) => req('POST', '/paint/', data),
  updatePaint: (id, data) => req('PUT', `/paint/${id}`, data),
  deletePaint: (id) => req('DELETE', `/paint/${id}`),

  // Contractors
  getContractors: () => req('GET', '/contractors/'),
  createContractor: (data) => req('POST', '/contractors/', data),
  updateContractor: (id, data) => req('PUT', `/contractors/${id}`, data),
  deleteContractor: (id) => req('DELETE', `/contractors/${id}`),

  // Notes
  getNotes: (assetId) => req('GET', `/notes/?asset_id=${assetId}`),
  addNote: (data) => req('POST', '/notes/', data),

  // Task Parts (links to spare inventory)
  getTask: (taskId) => req('GET', `/tasks/${taskId}`),
  getTaskParts: (taskId) => req('GET', `/task-parts/?task_id=${taskId}`),
  linkTaskPart: (taskId, data) => req('POST', `/task-parts/?task_id=${taskId}`, data),
  unlinkTaskPart: (id) => req('DELETE', `/task-parts/${id}`),

  // AI
  getAISettings: () => req('GET', '/ai/settings'),
  updateAISettings: (data) => req('PUT', '/ai/settings', data),
  getAISuggestions: (context) => req('POST', '/ai/suggest', context),

  // Components
  getComponents: (assetId) => req('GET', `/components/?asset_id=${assetId}`),
  createComponent: (assetId, data) => req('POST', `/components/?asset_id=${assetId}`, data),
  updateComponent: (id, data) => req('PUT', `/components/${id}`, data),
  deleteComponent: (id) => req('DELETE', `/components/${id}`),
  deleteNote: (id) => req('DELETE', `/notes/${id}`),

  // App Settings
  getNotificationSettings: () => req('GET', '/settings/notifications'),
  updateNotificationSettings: (data) => req('PUT', '/settings/notifications', data),

  // Users
  getUsers: () => req('GET', '/users/'),
  createUser: (data) => req('POST', '/users/', data),
  updateUser: (id, data) => req('PUT', `/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
}
