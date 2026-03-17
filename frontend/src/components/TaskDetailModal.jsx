import { useState, useEffect } from 'react'
import { api } from '../api'
import { Modal, LoadingSpinner, formatDate } from './shared'

// Accepts two shapes:
// Dashboard shape: { task_id, task_name, asset_id, asset_name, property_name, property_id, days_until_due }
// PropertyView shape: { id, name, asset_id, days_until_due, status } + assetName + propertyName props
export default function TaskDetailModal({ task, onClose, onNavigate, assetName, propertyName }) {
  const [parts, setParts] = useState([])
  const [fullTask, setFullTask] = useState(null)
  const [loading, setLoading] = useState(true)

  // Normalize between dashboard and property view shapes
  const taskId     = task.task_id ?? task.id
  const taskName   = task.task_name ?? task.name
  const assetId    = task.asset_id
  const resolvedAssetName    = task.asset_name ?? assetName ?? ''
  const resolvedPropertyName = task.property_name ?? propertyName ?? ''
  const propertyId = task.property_id ?? null

  useEffect(() => {
    Promise.all([
      api.getTask(taskId),
      api.getAssetParts(assetId),
    ]).then(([t, p]) => {
      setFullTask(t)
      const linkedIds = new Set((t.task_parts || []).map(tp => tp.part_id))
      setParts(p.filter(p => linkedIds.has(p.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [taskId, assetId])

  const isOverdue = task.days_until_due !== null && task.days_until_due < 0
  const statusColor = isOverdue ? 'var(--status-overdue)' : 'var(--status-soon)'
  const statusText = isOverdue
    ? `${Math.abs(task.days_until_due)} days overdue`
    : task.days_until_due === null ? 'No due date'
    : `Due in ${task.days_until_due} days`

  const footer = (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', width: '100%' }}>
      {onNavigate && propertyId && (
        <button className="btn btn-ghost" onClick={() => { onClose(); onNavigate('property', propertyId, assetId) }}>
          Go to Asset →
        </button>
      )}
      <button className="btn btn-ghost" onClick={onClose}>Close</button>
    </div>
  )

  return (
    <Modal title={taskName} onClose={onClose} footer={footer}>
      {/* Asset / status banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{resolvedAssetName}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{resolvedPropertyName}</div>
        </div>
        {task.days_until_due !== undefined && task.days_until_due !== null && (
          <div style={{ fontSize: '12px', fontWeight: 600, color: statusColor,
            background: isOverdue ? 'var(--status-overdue-bg)' : 'var(--status-soon-bg)',
            padding: '4px 10px', borderRadius: '12px', border: `1px solid ${statusColor}` }}>
            {statusText}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner /> : <>
        {fullTask?.description && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            {fullTask.description}
          </div>
        )}

        {/* Schedule info */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {fullTask?.interval && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-raised)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              Every {fullTask.interval} {fullTask.interval_type}
            </div>
          )}
          {fullTask?.last_completed_at && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-raised)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              Last done: {formatDate(fullTask.last_completed_at)}
            </div>
          )}
          {fullTask?.is_critical && (
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-overdue)', background: 'var(--status-overdue-bg)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--status-overdue)' }}>
              🔴 Critical
            </div>
          )}
        </div>

        {/* Parts needed */}
        {parts.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Parts needed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {parts.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {p.spec_notes && <span style={{ color: 'var(--accent)' }}>{p.spec_notes}</span>}
                      {p.part_number && <span>#{p.part_number}</span>}
                      {p.supplier && <span>{p.supplier}</span>}
                      {p.last_price && <span>${p.last_price.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', flexShrink: 0, fontWeight: 600,
                    color: p.qty_on_hand > 0 ? 'var(--status-ok)' : 'var(--status-overdue)',
                    background: p.qty_on_hand > 0 ? 'var(--status-ok-bg)' : 'var(--status-overdue-bg)',
                    border: `1px solid ${p.qty_on_hand > 0 ? 'var(--status-ok)' : 'var(--status-overdue)'}`,
                    padding: '2px 8px', borderRadius: '10px' }}>
                    {p.qty_on_hand} on hand
                  </div>
                  {p.qty > 1 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>×{p.qty}</div>}
                  {p.reorder_url && (
                    <a href={p.reorder_url} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, flexShrink: 0,
                        padding: '4px 10px', border: '1px solid var(--accent)', borderRadius: '8px',
                        textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Order →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {parts.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>No parts linked to this task.</div>
        )}

        {/* Tools needed */}
        {fullTask?.tools && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Tools needed</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {fullTask.tools.split(',').map((t, i) => (
                <span key={i} style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                  🔧 {t.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </>}
    </Modal>
  )
}
