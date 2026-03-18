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
    const detail = Array.isArray(err.detail) ? err.detail.map(e => e.msg || JSON.stringify(e)).join(', ') : (err.detail || 'Request failed')
    throw new Error(detail)
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
  register: (data) => req('POST', '/auth/register', data),
  forgotPassword: (email) => req('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => req('POST', '/auth/reset-password', { token, new_password }),

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
  reorderTasks: (items) => req('POST', '/tasks/reorder', items),
  deleteTask: (id) => req('DELETE', `/tasks/${id}`),

  // Parts
  getAssetParts: (assetId) => req('GET', `/parts/?asset_id=${assetId}`),
  getTaskParts: (taskId) => req('GET', `/task-parts/?task_id=${taskId}`),
  createPart: (data) => {
    const { asset_id, task_id, ...body } = data
    const q = new URLSearchParams()
    if (asset_id) q.set('asset_id', asset_id)
    if (task_id) q.set('task_id', task_id)
    return req('POST', `/parts/?${q.toString()}`, body)
  },
  updatePart: (id, data) => req('PUT', `/parts/${id}`, data),
  updatePartQty: (id, qty) => req('PATCH', `/parts/${id}/qty`, { qty }),
  snoozeTask: (id, snoozed_until) => req('PATCH', `/tasks/${id}/snooze`, { snoozed_until }),
  deletePart: (id) => req('DELETE', `/parts/${id}`),

  // Completion logs
  getUsageLogs: (assetId) => req('GET', `/assets/${assetId}/usage_logs`),
  deleteUsageLog: (assetId, logId) => req('DELETE', `/assets/${assetId}/usage_logs/${logId}`),
  getLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/logs/?${q}`)
  },
  logCompletion: (data) => req('POST', '/logs/', data),
  createLog: (data) => req('POST', `/logs/`, data),

  // Asset loans
  getLoans: (activeOnly = false) => req('GET', `/asset-loans/?active_only=${activeOnly}`),
  getAssetLoans: (assetId) => req('GET', `/asset-loans/asset/${assetId}`),
  createLoan: (data) => req('POST', '/asset-loans/', data),
  returnLoan: (id, data) => req('PATCH', `/asset-loans/${id}/return`, data),
  deleteLoan: (id) => req('DELETE', `/asset-loans/${id}`),
  deleteLog: (id) => req('DELETE', `/logs/${id}`),
  updateLog: (id, data) => req('PATCH', `/logs/${id}`, data),
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
  getAssetContractors: (assetId) => req('GET', `/contractors/assets/${assetId}/contractors`),
  addAssetContractor: (assetId, data) => req('POST', `/contractors/assets/${assetId}/contractors`, data),
  removeAssetContractor: (assetId, contractorId) => req('DELETE', `/contractors/assets/${assetId}/contractors/${contractorId}`),

  // Notes
  getNotes: (assetId) => req('GET', `/notes/?asset_id=${assetId}`),
  addNote: (data) => req('POST', '/notes/', data),

  // Task Parts (links to spare inventory)
  getTask: (taskId) => req('GET', `/tasks/${taskId}`),
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
  getUsageReminderSettings: () => req('GET', '/settings/usage-reminders'),
  updateUsageReminderSettings: (data) => req('PUT', '/settings/usage-reminders', data),
  getUsageRemindersDue: () => req('GET', '/settings/usage-reminders/due'),

  // Users
  getUsers: () => req('GET', '/users/'),
  createUser: (data) => req('POST', '/users/', data),
  updateUser: (id, data) => req('PUT', `/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
}
