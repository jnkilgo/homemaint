import { useState, useEffect } from 'react'
import { api, getUser } from '../api'
import { Modal, ConfirmModal, LoadingSpinner, formatDate, useForm } from '../components/shared'

function UserForm({ initial, onSave, onClose, isAdmin }) {
  const { values, bind } = useForm(initial
    ? { display_name: initial.display_name, password: '', role: initial.role }
    : { username: '', display_name: '', password: '', role: 'member' }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true); setError('')
    try {
      const data = { ...values }
      if (!data.password) delete data.password
      if (initial?.id) await api.updateUser(initial.id, data)
      else await api.createUser(data)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={initial ? 'Edit User' : 'Add User'} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>Save</button>
      </>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      {!initial && (
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input {...bind('username')} />
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Display Name *</label>
        <input {...bind('display_name')} />
      </div>
      <div className="form-group">
        <label className="form-label">{initial ? 'New Password (leave blank to keep)' : 'Password *'}</label>
        <input type="password" {...bind('password')} />
      </div>
      {isAdmin && (
        <div className="form-group">
          <label className="form-label">Role</label>
          <select {...bind('role')}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}
    </Modal>
  )
}

function Toggle({ checked, onChange, label, sub, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)', opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: checked && !disabled ? 'var(--accent)' : 'var(--border-strong)',
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
          transition: 'background 0.2s'
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 22 : 3,
          width: 18, height: 18, borderRadius: 9,
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  )
}

function NotificationSettings({ properties }) {
  const [ns, setNs] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getNotificationSettings().then(setNs)
  }, [])

  async function update(patch) {
    const updated = { ...ns, ...patch }
    setNs(updated)
    setSaving(true); setSaved(false)
    try {
      const result = await api.updateNotificationSettings(updated)
      setNs(result)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  function toggleProperty(propId) {
    const ids = ns.disabled_properties || []
    const updated = ids.includes(propId)
      ? ids.filter(id => id !== propId)
      : [...ids, propId]
    update({ disabled_properties: updated })
  }

  if (!ns) return <div style={{ padding: '16px' }}><LoadingSpinner /></div>

  return (
    <div>
      <Toggle
        checked={ns.notifications_enabled}
        onChange={v => update({ notifications_enabled: v })}
        label="Push notifications"
        sub="Enable or disable all push notifications globally"
      />

      <div style={{ padding: '12px 0 4px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Notify me when
        </div>
        {[
          { key: 'notify_critical', label: '🔴 Critical tasks are overdue', sub: 'Tasks flagged as critical — always use sparingly' },
          { key: 'notify_overdue',  label: 'Tasks are overdue', sub: 'Any task past its due date' },
          { key: 'notify_due_soon', label: 'Tasks are coming up', sub: 'Within the advance warning window' },
        ].map(({ key, label, sub }) => (
          <Toggle key={key} checked={ns[key]} onChange={v => update({ [key]: v })} label={label} sub={sub} disabled={!ns.notifications_enabled} />
        ))}
      </div>

      <div style={{ padding: '12px 0' }}>
        <Toggle
          checked={ns.quiet_hours_enabled}
          onChange={v => update({ quiet_hours_enabled: v })}
          label="Quiet hours"
          sub="Suppress notifications during these hours"
          disabled={!ns.notifications_enabled}
        />
        {ns.quiet_hours_enabled && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'center' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Start</label>
              <input type="time" value={ns.quiet_start} onChange={e => update({ quiet_start: e.target.value })} />
            </div>
            <div style={{ color: 'var(--text-muted)', paddingTop: '20px' }}>to</div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">End</label>
              <input type="time" value={ns.quiet_end} onChange={e => update({ quiet_end: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {properties.length > 1 && (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Per-property
          </div>
          {properties.map(p => (
            <Toggle
              key={p.id}
              checked={!(ns.disabled_properties || []).includes(p.id)}
              onChange={() => toggleProperty(p.id)}
              label={p.name}
              sub={`Notifications ${(ns.disabled_properties || []).includes(p.id) ? 'paused' : 'active'} for this property`}
              disabled={!ns.notifications_enabled}
            />
          ))}
        </div>
      )}

      {(saving || saved) && (
        <div style={{ fontSize: '12px', color: saved ? 'var(--status-ok)' : 'var(--text-muted)', marginTop: '8px' }}>
          {saving ? 'Saving…' : '✓ Saved'}
        </div>
      )}
    </div>
  )
}


function ImportAssets({ properties: propsProp = [] }) {
  const [properties, setProperties] = useState(propsProp)
  const [file, setFile] = useState(null)
  const [propertyId, setPropertyId] = useState(propsProp[0]?.id || '')

  useEffect(() => {
    if (propsProp.length === 0) {
      api.getProperties().then(data => {
        setProperties(data)
        setPropertyId(data[0]?.id || '')
      })
    }
  }, [])
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file || !propertyId) return
    setStatus('loading'); setError(''); setResult(null)
    try {
      const text = await file.text()
      const assets = JSON.parse(text)
      if (!Array.isArray(assets)) throw new Error('File must contain a JSON array of assets')
      const res = await api.importAssets(parseInt(propertyId), assets)
      setResult(res)
      setStatus('success')
      setFile(null)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
        Upload a JSON file generated by the HomeMaint import prompt in Claude. Assets, tasks, and parts will be created under the selected property.
      </div>

      <div className="form-group">
        <label className="form-label">Import into property</label>
        <select value={propertyId} onChange={e => setPropertyId(e.target.value)}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">JSON file</label>
        <div
          onClick={() => document.getElementById('import-file-input').click()}
          style={{
            border: '2px dashed var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: file ? 'var(--bg-raised)' : 'transparent',
            transition: 'background 0.15s'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
          <div style={{ fontSize: '13px', color: file ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {file ? file.name : 'Click to choose a .json file'}
          </div>
          {file && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>
        <input
          id="import-file-input"
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={e => { setFile(e.target.files[0] || null); setStatus(null); setResult(null) }}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={!file || !propertyId || status === 'loading'}
        style={{ width: '100%' }}
      >
        {status === 'loading' ? 'Importing…' : 'Import Assets'}
      </button>

      {status === 'success' && result && (
        <div style={{
          marginTop: '16px', padding: '14px 16px',
          background: 'var(--bg-raised)', borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--status-ok)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--status-ok)', marginBottom: '6px' }}>✓ Import complete</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {result.assets_created} asset{result.assets_created !== 1 ? 's' : ''} · {result.tasks_created} tasks · {result.parts_created} parts
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {result.asset_names.join(', ')}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: '12px' }}>{error}</div>
      )}
    </div>
  )
}


function AISettings() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyInputs, setKeyInputs] = useState({ ai_anthropic_key: '', ai_openai_key: '' })

  useEffect(() => {
    api.getAISettings().then(s => {
      setSettings(s)
      setKeyInputs({ ai_anthropic_key: '', ai_openai_key: '' })
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      const payload = { ...settings }
      if (keyInputs.ai_anthropic_key) payload.ai_anthropic_key = keyInputs.ai_anthropic_key
      if (keyInputs.ai_openai_key) payload.ai_openai_key = keyInputs.ai_openai_key
      const updated = await api.updateAISettings(payload)
      setSettings(updated)
      setKeyInputs({ ai_anthropic_key: '', ai_openai_key: '' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  if (!settings) return <LoadingSpinner />

  const PROVIDERS = [
    { value: 'openai',    label: 'OpenAI (GPT)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'ollama',    label: 'Ollama (local)' },
  ]
  const MODELS = {
    openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    ollama:    ['llama3', 'mistral', 'gemma2'],
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: settings.ai_enabled ? 'var(--accent-soft)' : 'var(--bg-raised)', borderRadius: 'var(--radius)', border: `1px solid ${settings.ai_enabled ? 'var(--accent)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>AI Assistant</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Suggest maintenance schedules and parts based on asset details</div>
        </div>
        <input type="checkbox" checked={settings.ai_enabled} onChange={e => setSettings(s => ({ ...s, ai_enabled: e.target.checked }))} style={{ width: 'auto', transform: 'scale(1.3)', cursor: 'pointer' }} />
      </div>

      {settings.ai_enabled && (<>
        {/* Provider */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Provider</label>
            <select value={settings.ai_provider} onChange={e => setSettings(s => ({ ...s, ai_provider: e.target.value, ai_model: MODELS[e.target.value][0] }))}>
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Model</label>
            {settings.ai_provider === 'ollama' ? (
              <input value={settings.ai_model} onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))} placeholder="llama3" list="ollama-models" />
            ) : (
              <select value={settings.ai_model} onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))}>
                {(MODELS[settings.ai_provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <datalist id="ollama-models">{MODELS.ollama.map(m => <option key={m} value={m} />)}</datalist>
          </div>
        </div>

        {/* API Keys */}
        {settings.ai_provider === 'anthropic' && (
          <div className="form-group">
            <label className="form-label">Anthropic API Key</label>
            <input type="password" value={keyInputs.ai_anthropic_key} onChange={e => setKeyInputs(k => ({ ...k, ai_anthropic_key: e.target.value }))} placeholder={settings.ai_anthropic_key ? '••••••••••••• (set — enter new to change)' : 'sk-ant-...'} />
          </div>
        )}
        {settings.ai_provider === 'openai' && (
          <div className="form-group">
            <label className="form-label">OpenAI API Key</label>
            <input type="password" value={keyInputs.ai_openai_key} onChange={e => setKeyInputs(k => ({ ...k, ai_openai_key: e.target.value }))} placeholder={settings.ai_openai_key ? '••••••••••••• (set — enter new to change)' : 'sk-...'} />
          </div>
        )}
        {settings.ai_provider === 'ollama' && (
          <div className="form-group">
            <label className="form-label">Ollama Base URL</label>
            <input value={settings.ai_ollama_url} onChange={e => setSettings(s => ({ ...s, ai_ollama_url: e.target.value }))} placeholder="http://localhost:11434" />
          </div>
        )}
      </>)}

      <div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save AI Settings'}
        </button>
      </div>
    </div>
  )
}

function UsageReminderSettings() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getUsageReminderSettings().then(setSettings)
  }, [])

  async function update(patch) {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    setSaving(true); setSaved(false)
    try {
      const result = await api.updateUsageReminderSettings(updated)
      setSettings(result)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  if (!settings) return <div style={{ padding: '16px' }}><LoadingSpinner /></div>

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
        Get reminded when assets that track hours or miles haven't had usage logged in a while.
      </div>

      <div className="form-group">
        <label className="form-label">Default reminder interval (days)</label>
        <input
          type="number"
          className="form-input"
          value={settings.usage_reminder_global_days}
          onChange={e => setSettings(s => ({ ...s, usage_reminder_global_days: parseInt(e.target.value) || 90 }))}
          min="1"
          max="365"
          style={{ maxWidth: '120px' }}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Per-asset overrides can be set in the asset edit panel. Leave blank on an asset to use this default.
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><span className="card-title">Setup</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Property Setup Wizard</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Add a new property with suggested assets based on your profile
              </div>
            </div>
            <button className="btn btn-primary" onClick={onStartOnboarding}>Launch Wizard →</button>
          </div>
        </div>
      </div>


      <Toggle
        checked={settings.usage_reminder_ha_notify}
        onChange={v => update({ usage_reminder_ha_notify: v })}
        label="Send HA push notification"
        sub="Fire a Home Assistant notification when an asset is overdue for usage logging"
      />

      <div style={{ marginTop: '12px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => update({})} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function BackupRestore() {
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)
  const [status, setStatus] = useState(null) // null | 'success' | 'error'
  const [message, setMessage] = useState('')

  async function handleRestore() {
    if (!restoreFile) return
    if (!window.confirm('This will replace ALL current data with the backup. Are you sure?')) return
    setRestoring(true); setStatus(null)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Restore failed')
      }
      setStatus('success')
      setMessage('Restore complete. Reloading in 3 seconds…')
      setTimeout(() => window.location.reload(), 3000)
    } catch (e) {
      setStatus('error')
      setMessage(e.message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Backup */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Download Backup</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
          Downloads a zip file containing your database and any uploaded files. Store it somewhere safe.
        </div>
        <a
          href="/api/backup/download"
          download
          onClick={e => {
            e.preventDefault()
            fetch('/api/backup/download', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            .then(r => r.blob())
            .then(blob => {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `homemaint_backup_${new Date().toISOString().slice(0,10)}.zip`
              a.click()
              URL.revokeObjectURL(url)
            })
          }}
          className="btn btn-primary"
          style={{ display: 'inline-block' }}
        >
          ⬇ Download Backup
        </a>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Restore */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Restore from Backup</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
          Upload a <code>.zip</code> backup file to restore. <strong style={{ color: 'var(--status-overdue)' }}>This will replace all current data.</strong>
        </div>
        <div
          onClick={() => document.getElementById('restore-file-input').click()}
          style={{
            border: '2px dashed var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: restoreFile ? 'var(--bg-raised)' : 'transparent',
            marginBottom: '12px'
          }}
        >
          <div style={{ fontSize: '22px', marginBottom: '6px' }}>📦</div>
          <div style={{ fontSize: '13px', color: restoreFile ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {restoreFile ? restoreFile.name : 'Click to choose a backup .zip file'}
          </div>
          {restoreFile && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {(restoreFile.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>
        <input
          id="restore-file-input"
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={e => { setRestoreFile(e.target.files[0] || null); setStatus(null) }}
        />
        <button
          className="btn btn-primary"
          onClick={handleRestore}
          disabled={!restoreFile || restoring}
          style={{ background: 'var(--status-overdue)', borderColor: 'var(--status-overdue)' }}
        >
          {restoring ? 'Restoring…' : '⚠ Restore & Replace All Data'}
        </button>

        {status === 'success' && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--status-ok)', fontSize: '13px', color: 'var(--status-ok)' }}>
            ✓ {message}
          </div>
        )}
        {status === 'error' && (
          <div className="alert alert-error" style={{ marginTop: '12px' }}>{message}</div>
        )}
      </div>
    </div>
  )
}

export default function SettingsView({ onLogout, properties = [], onStartOnboarding }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const currentUser = getUser()
  const isAdmin = currentUser?.role === 'admin'

  function load() {
    if (isAdmin) {
      api.getUsers().then(setUsers).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><span className="card-title">My Account</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{currentUser?.display_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                @{currentUser?.username} · {currentUser?.role}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setEditUser(currentUser)}>Change Password</button>
              <button className="btn btn-ghost" onClick={onLogout}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><span className="card-title">Notifications</span></div>
          <div className="card-body">
            <NotificationSettings properties={properties} />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><span className="card-title">🤖 AI Assistant</span></div>
          <div className="card-body">
            <AISettings />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><span className="card-title">Usage Reminders</span></div>
          <div className="card-body">
            <UsageReminderSettings />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><span className="card-title">Import Assets</span></div>
        <div className="card-body">
          <ImportAssets properties={properties} />
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><span className="card-title">Backup & Restore</span></div>
          <div className="card-body">
            <BackupRestore />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Users</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add User</button>
          </div>
          {loading ? <LoadingSpinner /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.display_name}</td>
                      <td className="mono text-secondary">@{u.username}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'badge-due_soon' : 'badge-unknown'}`}>{u.role}</span></td>
                      <td className="mono text-muted">{formatDate(u.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                          {u.id !== currentUser?.id && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(u)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(showForm || editUser) && (
        <UserForm
          initial={editUser}
          isAdmin={isAdmin}
          onSave={() => { setShowForm(false); setEditUser(null); load() }}
          onClose={() => { setShowForm(false); setEditUser(null) }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete user "${confirmDelete.display_name}"?`}
          onConfirm={async () => { await api.deleteUser(confirmDelete.id); setConfirmDelete(null); load() }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
