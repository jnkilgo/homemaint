import { useState, useEffect } from 'react'
import TaskDetailModal from '../components/TaskDetailModal'
import { api } from '../api'
import { LoadingSpinner, formatDate, Modal } from '../components/shared'


export default function Dashboard({ onNavigate, hasNoProperties, onStartOnboarding, onAddProperty }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loans, setLoans] = useState([])

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
    api.getLoans(true).then(setLoans).catch(() => {})
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

      {/* Category filter */}
      {data && (overdue_tasks_all => {
        const allTasks = [...data.overdue_tasks, ...data.due_soon_tasks]
        const categories = [...new Set(allTasks.map(t => t.asset_category).filter(Boolean))].sort()
        return categories.length > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter by category:</span>
            <button onClick={() => setCategoryFilter('')}
              className={`btn btn-sm ${categoryFilter === '' ? 'btn-primary' : 'btn-ghost'}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
                className={`btn btn-sm ${categoryFilter === c ? 'btn-primary' : 'btn-ghost'}`}>
                {c}
              </button>
            ))}
          </div>
        ) : null
      })()}

      <div className="grid-2" style={{ gap: '20px' }}>
        {/* Overdue tasks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: data.overdue_tasks.length > 0 ? 'var(--status-overdue)' : 'inherit' }}>
              Overdue Tasks
            </span>
            <span className="badge badge-overdue">{data.overdue_tasks.filter(t => !categoryFilter || t.asset_category === categoryFilter).length}</span>
          </div>
          {data.overdue_tasks.length === 0
            ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">All caught up</div></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Task</th><th>Asset</th><th>Property</th><th>Overdue</th>
                </tr></thead>
                <tbody>
                  {data.overdue_tasks.filter(t => !categoryFilter || t.asset_category === categoryFilter).map(t => (
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
            <span className="badge badge-due_soon">{data.due_soon_tasks.filter(t => !categoryFilter || t.asset_category === categoryFilter).length}</span>
          </div>
          {data.due_soon_tasks.length === 0
            ? <div className="empty"><div className="empty-text">Nothing due in the next 2 weeks</div></div>
            : <table className="data-table">
                <thead><tr>
                  <th>Task</th><th>Asset</th><th>Property</th><th>In</th>
                </tr></thead>
                <tbody>
                  {data.due_soon_tasks.filter(t => !categoryFilter || t.asset_category === categoryFilter).map(t => (
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

      {loans.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">🤝 Loaned Out</span>
            <span className="badge badge-due_soon">{loans.length}</span>
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Asset</th><th>Loaned To</th><th>Property</th><th>Expected Back</th><th>Status</th>
            </tr></thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.asset_name}</td>
                  <td>{l.loaned_to}</td>
                  <td className="text-muted">{l.property_name}</td>
                  <td className="mono">{l.expected_return_date ? formatDate(l.expected_return_date) : '—'}</td>
                  <td>
                    {l.status === 'overdue' && <span className="badge badge-overdue">Overdue</span>}
                    {l.status === 'due_soon' && <span className="badge badge-due_soon">Due Soon</span>}
                    {l.status === 'ok' && <span className="badge badge-ok">OK</span>}
                    {!l.status && <span className="text-muted" style={{ fontSize: 12 }}>No return date</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
