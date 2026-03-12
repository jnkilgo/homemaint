import { useState, useEffect } from 'react'
import { api } from '../api'
import { Modal, ConfirmModal, LoadingSpinner, useForm, formatDate } from '../components/shared'

function ContractorForm({ initial, onSave, onClose }) {
  const { values, bind } = useForm(initial || { name: '', trade: '', phone: '', email: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true); setError('')
    try {
      if (initial?.id) await api.updateContractor(initial.id, values)
      else await api.createContractor(values)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={initial ? 'Edit Contractor' : 'Add Contractor'} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>Save</button>
      </>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input placeholder="R&R Plumbing" {...bind('name')} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Trade / Specialty</label>
          <input placeholder="Plumbing, HVAC, Electrical…" {...bind('trade')} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input type="tel" placeholder="479-555-0100" {...bind('phone')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input type="email" {...bind('email')} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea rows={3} placeholder="Reliability, availability, notes from past jobs…" {...bind('notes')} />
      </div>
    </Modal>
  )
}

function ContractorCard({ c, onHistory, onEdit, onDelete, onShare }) {
  const [expanded, setExpanded] = useState(false)

  function callPhone(e, phone) {
    e.stopPropagation()
    if (window.confirm(`Call ${phone}?`)) {
      window.location.href = `tel:${phone}`
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{c.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
            {c.trade && <span>{c.trade}</span>}
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                onClick={e => callPhone(e, c.phone)}
                style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
              >{c.phone}</a>
            )}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px', background: 'var(--bg-raised)' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span>
              <strong>Jobs:</strong>{' '}
              {c.job_count > 0
                ? <span onClick={onHistory} style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>{c.job_count}</span>
                : '0'}
            </span>
            <span><strong>Spend:</strong> {c.total_spend > 0 ? `$${c.total_spend.toFixed(2)}` : '—'}</span>
            {c.notes && <span><strong>Notes:</strong> {c.notes}</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onShare() }} title="Share contact">📤 Share</button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEdit() }}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDelete() }} style={{ color: 'var(--status-overdue)' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ContractorHistory({ contractor, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLogs({ contractor_id: contractor.id, limit: 100 })
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [contractor.id])

  const totalSpend = logs.reduce((sum, l) => sum + (l.cost || 0), 0)

  return (
    <Modal title={`${contractor.name} — Job History`} onClose={onClose}>
      {loading ? <LoadingSpinner /> : (
        <>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>JOBS</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{logs.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>TOTAL SPEND</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totalSpend > 0 ? `$${totalSpend.toFixed(2)}` : '—'}</div>
            </div>
            {contractor.trade && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>TRADE</div>
                <div style={{ fontWeight: 600 }}>{contractor.trade}</div>
              </div>
            )}
            {contractor.phone && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>PHONE</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{contractor.phone}</div>
              </div>
            )}
          </div>

          {logs.length === 0
            ? <div className="empty"><div className="empty-text">No jobs logged for this contractor yet.</div></div>
            : (
              <div className="table-scroll">
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead><tr>
                    <th>Date</th><th>Property</th><th>Asset</th><th>Task</th><th>Cost</th><th>Note</th>
                  </tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="mono text-muted">{formatDate(l.completed_at)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{l.property_name || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{l.asset_name || '—'}</td>
                        <td>{l.task_name || '—'}</td>
                        <td className="mono">{l.cost ? `$${l.cost.toFixed(2)}` : '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{l.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}
    </Modal>
  )
}

export default function ContractorsView() {
  const [contractors, setContractors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)

  function load() {
    api.getContractors().then(setContractors).finally(() => setLoading(false))
  }

  function shareVCard(c) {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.name}`,
      c.trade ? `TITLE:${c.trade}` : '',
      c.phone ? `TEL;TYPE=WORK,VOICE:${c.phone}` : '',
      c.email ? `EMAIL;TYPE=WORK:${c.email}` : '',
      c.notes ? `NOTE:${c.notes}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      const file = new File([lines], `${c.name}.vcf`, { type: 'text/vcard' })
      navigator.share({ files: [file], title: c.name }).catch(() => {})
    } else {
      // Fallback: download the vcf
      const blob = new Blob([lines], { type: 'text/vcard' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${c.name}.vcf`; a.click()
      URL.revokeObjectURL(url)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Contractor</button>
      </div>

      {contractors.length === 0
        ? <div className="empty"><div className="empty-icon">👷</div><div className="empty-text">No contractors yet</div></div>
        : <div className="card">
            <style>{`
              @media (hover: none) and (pointer: coarse) {
                .contractor-table { display: none !important; }
                .contractor-cards { display: block !important; }
              }
              @media (hover: hover) and (pointer: fine) {
                .contractor-table { display: table !important; }
                .contractor-cards { display: none !important; }
              }
            `}</style>

            {/* Desktop table */}
            <table className="data-table contractor-table">
              <thead><tr>
                <th>Name</th><th>Trade</th><th>Phone</th><th>Jobs</th><th>Total Spend</th><th>Notes</th><th></th>
              </tr></thead>
              <tbody>
                {contractors.map(c => (
                  <tr key={c.id} style={{ cursor: c.job_count > 0 ? 'pointer' : 'default' }}
                    onClick={() => c.job_count > 0 && setHistoryItem(c)}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td className="text-secondary">{c.trade || '—'}</td>
                    <td className="mono">{c.phone || '—'}</td>
                    <td className="mono">
                      {c.job_count > 0
                        ? <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{c.job_count}</span>
                        : '0'}
                    </td>
                    <td className="mono">{c.total_spend > 0 ? `$${c.total_spend.toFixed(2)}` : '—'}</td>
                    <td className="text-muted" style={{ fontSize: '12px', maxWidth: '200px' }}>{c.notes || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => shareVCard(c)} title="Share contact">📤</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(c)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(c)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="contractor-cards" style={{ display: 'none' }}>
              {contractors.map(c => (
                <ContractorCard
                  key={c.id}
                  c={c}
                  onHistory={() => c.job_count > 0 && setHistoryItem(c)}
                  onEdit={() => setEditItem(c)}
                  onDelete={() => setConfirmDelete(c)}
                  onShare={() => shareVCard(c)}
                />
              ))}
            </div>
          </div>
      }

      {(showForm || editItem) && (
        <ContractorForm
          initial={editItem}
          onSave={() => { setShowForm(false); setEditItem(null); load() }}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete "${confirmDelete.name}"?`}
          onConfirm={async () => {
            await api.deleteContractor(confirmDelete.id)
            setConfirmDelete(null)
            load()
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {historyItem && (
        <ContractorHistory
          contractor={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}
