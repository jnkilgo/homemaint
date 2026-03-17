import { useState, useEffect } from 'react'
import { api } from '../api'
import { LoadingSpinner, formatDate, Modal } from '../components/shared'

function TaskDetailModal({ task, onClose, onNavigate }) {
  const [parts, setParts] = useState([])
  const [fullTask, setFullTask] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getTask(task.task_id),
      api.getAssetParts(task.asset_id),
    ]).then(([t, p]) => {
      setFullTask(t)
      // Only show parts linked to this task
      const linkedIds = new Set((t.task_parts || []).map(tp => tp.part_id))
      setParts(p.filter(p => linkedIds.has(p.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [task.task_id, task.asset_id])

  const isOverdue = task.days_until_due !== null && task.days_until_due < 0
  const statusColor = isOverdue ? 'var(--status-overdue)' : 'var(--status-soon)'
  const statusText = isOverdue
    ? `${Math.abs(task.days_until_due)} days overdue`
    : `Due in ${task.days_until_due} days`

  return (
    <Modal title={task.task_name} onClose={onClose} footer={
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', width: '100%' }}>
        <button className="btn btn-ghost" onClick={() => { onClose(); onNavigate('property', task.property_id, task.asset_id) }}>
          Go to Asset →
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    }>
      {/* Asset / status banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{task.asset_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.property_name}</div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: statusColor,
          background: isOverdue ? 'var(--status-overdue-bg)' : 'var(--status-soon-bg)',
          padding: '4px 10px', borderRadius: '12px', border: `1px solid ${statusColor}` }}>
          {statusText}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : <>
        {/* Task details */}
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
          <div>
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
                  {p.qty > 1 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>×{p.qty}</div>
                  )}
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
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No parts linked to this task.</div>
        )}

        {/* Tools needed */}
        {fullTask?.tools && (
          <div style={{ marginTop: '14px' }}>
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

export default function Dashboard({ onNavigate, hasNoProperties, onStartOnboarding, onAddProperty }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />
  if (!data) return <div className="empty"><div className="empty-text">Failed to load dashboard</div></div>
  if (hasNoProperties) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 56 }}>🏠</div>
      <h2 style={{ color: 'var(--text)', margin: 0 }}>Welcome to HomeMaint</h2>
      <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        You don't have any properties yet. Use the setup wizard to get started quickly, or add a property manually.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onAddProperty}>+ Add Property</button>
        <button className="btn btn-primary" onClick={onStartOnboarding}>Setup Wizard →</button>
      </div>
    </div>
  )
  if (hasNoProperties) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 56 }}>🏠</div>
      <h2 style={{ color: 'var(--text)', margin: 0 }}>Welcome to HomeMaint</h2>
      <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        You don't have any properties yet. Use the setup wizard to get started quickly, or add a property manually.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onAddProperty}>+ Add Property</button>
        <button className="btn btn-primary" onClick={onStartOnboarding}>Setup Wizard →</button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderColor: data.overdue_count > 0 ? 'var(--status-overdue)' : 'var(--border)' }}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: data.overdue_count > 0 ? 'var(--status-overdue)' : 'inherit' }}>
            {data.overdue_count}
          </div>
          {data.overdue_count > 0 && <div className="stat-sub text-overdue">Needs attention</div>}
        </div>
        <div className="stat-card" style={{ borderColor: data.due_soon_count > 0 ? 'var(--status-soon)' : 'var(--border)' }}>
          <div className="stat-label">Due Soon</div>
          <div className="stat-value" style={{ color: data.due_soon_count > 0 ? 'var(--status-soon)' : 'inherit' }}>
            {data.due_soon_count}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px' }}>
        {/* Overdue tasks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: data.overdue_tasks.length > 0 ? 'var(--status-overdue)' : 'inherit' }}>
              Overdue Tasks
            </span>
            <span className="badge badge-overdue">{data.overdue_tasks.length}</span>
          </div>
          {data.overdue_tasks.length === 0
            ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">All caught up</div></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Task</th><th>Asset</th><th>Property</th><th>Overdue</th>
                </tr></thead>
                <tbody>
                  {data.overdue_tasks.map(t => (
                    <tr key={t.task_id} style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTask(t)}>
                      <td>{t.task_name}</td>
                      <td className="text-secondary">{t.asset_name}</td>
                      <td className="text-muted">{t.property_name}</td>
                      <td className="mono text-overdue">{t.days_until_due !== null ? `${Math.abs(t.days_until_due)}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Due soon */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Due Soon</span>
            <span className="badge badge-due_soon">{data.due_soon_tasks.length}</span>
          </div>
          {data.due_soon_tasks.length === 0
            ? <div className="empty"><div className="empty-text">Nothing due in the next 2 weeks</div></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Task</th><th>Asset</th><th>Property</th><th>In</th>
                </tr></thead>
                <tbody>
                  {data.due_soon_tasks.map(t => (
                    <tr key={t.task_id} style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTask(t)}>
                      <td>{t.task_name}</td>
                      <td className="text-secondary">{t.asset_name}</td>
                      <td className="text-muted">{t.property_name}</td>
                      <td className="mono text-soon">{t.days_until_due !== null ? `${t.days_until_due}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Warranty expiring */}
        {data.warranty_expiring.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Warranties Expiring</span>
              <span className="badge badge-due_soon">{data.warranty_expiring.length}</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Property</th><th>Expires</th><th>Days</th></tr></thead>
              <tbody>
                {data.warranty_expiring.map((w, i) => (
                  <tr key={i}>
                    <td>{w.asset_name}</td>
                    <td className="text-muted">{w.property_name}</td>
                    <td className="mono">{formatDate(w.warranty_expires)}</td>
                    <td className="mono text-soon">{w.days_remaining}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Aging systems */}
        {data.aging_systems.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Aging Systems</span>
              <span className="badge badge-due_soon">{data.aging_systems.length}</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Property</th><th>Replace By</th></tr></thead>
              <tbody>
                {data.aging_systems.map((a, i) => (
                  <tr key={i}>
                    <td>{a.asset_name}</td>
                    <td className="text-muted">{a.property_name}</td>
                    <td className="mono text-soon">{formatDate(a.replace_by)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
