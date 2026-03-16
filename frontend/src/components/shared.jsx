import { useState } from 'react'

export function StatusBadge({ status }) {
  const labels = { ok: 'OK', due_soon: 'Due Soon', overdue: 'Overdue', unknown: 'Unknown', snoozed: 'Snoozed' }
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>
}

export function StatusDot({ status }) {
  return <span className={`dot dot-${status}`} />
}

export function DueLabel({ task }) {
  if (!task) return null
  const { status, days_until_due, usage_until_due, interval_type } = task

  if (interval_type === 'hours' || interval_type === 'miles') {
    const unit = interval_type === 'hours' ? 'h' : 'mi'
    const val = usage_until_due
    if (val === null || val === undefined) return <span className="text-muted mono">—</span>
    if (val <= 0) return <span className="text-overdue mono">{Math.abs(Math.round(val))}{unit} overdue</span>
    return <span className={status === 'due_soon' ? 'text-soon mono' : 'mono'}>{Math.round(val)}{unit} left</span>
  }

  const days = days_until_due
  if (days === null || days === undefined) return <span className="text-muted mono">—</span>
  if (days <= -1) return <span className="text-overdue mono">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-overdue mono">Due today</span>
  return <span className={status === 'due_soon' ? 'text-soon mono' : 'mono'}>{days}d</span>
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
      </>
    }>
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </Modal>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const set = (k, v) => setValues(prev => ({ ...prev, [k]: v }))
  const bind = (k) => ({ value: values[k] ?? '', onChange: e => set(k, e.target.value) })
  const reset = () => setValues(initial)
  return { values, set, bind, reset }
}

export function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function intervalLabel(task) {
  if (!task) return ''
  if (task.interval_type === 'seasonal') return `${task.season || ''} annual`.trim()
  if (task.interval_type === 'months') return `Every ${task.interval}mo`
  if (task.interval_type === 'days') return `Every ${task.interval}d`
  if (task.interval_type === 'hours') return `Every ${task.interval}h`
  if (task.interval_type === 'miles') return `Every ${task.interval}mi`
  return task.interval_type
}

export function paintHex(code) {
  // Very rough SW/BM hex lookup for swatch preview
  const known = {
    'SW 7036': '#c8b89a', 'SW 7015': '#b5b0a8', 'SW 7006': '#f2efe8',
    'SW 6244': '#1a3a5c', 'BM OC-17': '#f0ece0', 'BM HC-172': '#8c9e8e',
  }
  return known[code] || null
}
