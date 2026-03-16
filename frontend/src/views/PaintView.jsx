import { useState, useEffect } from 'react'
import { api } from '../api'
import { Modal, ConfirmModal, LoadingSpinner, formatDate, useForm, paintHex } from '../components/shared'

function PaintForm({ initial, propertyId, onSave, onClose }) {
  const { values, bind, set } = useForm(initial || {
    property_id: propertyId, room_surface: '', brand: '', color_name: '',
    color_code: '', sheen: '', date_painted: '', painted_by: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contractors, setContractors] = useState([])

  useEffect(() => { api.getContractors().then(setContractors) }, [])

  async function submit() {
    setLoading(true); setError('')
    try {
      const data = { ...values, property_id: propertyId }
      if (initial?.id) await api.updatePaint(initial.id, data)
      else await api.createPaint(data)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const hex = paintHex(values.color_code)

  return (
    <Modal title={initial ? 'Edit Paint Record' : 'Add Paint Record'} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>Save</button>
      </>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Room / Surface *</label>
        <input placeholder="e.g. Living Room Walls, Front Door" {...bind('room_surface')} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Brand</label>
          <input placeholder="Sherwin-Williams, Benjamin Moore…" {...bind('brand')} />
        </div>
        <div className="form-group">
          <label className="form-label">Sheen</label>
          <select {...bind('sheen')}>
            <option value="">—</option>
            {['Flat', 'Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss'].map(s =>
              <option key={s}>{s}</option>
            )}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Color Name</label>
          <input placeholder="Accessible Beige" {...bind('color_name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Color Code</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input placeholder="SW 7036" {...bind('color_code')} />
            {hex && <div className="paint-swatch" style={{ background: hex }} />}
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Date Painted</label>
          <input type="date" {...bind('date_painted')} />
        </div>
        <div className="form-group">
          <label className="form-label">Painted By</label>
          <select {...bind('painted_by')}>
            <option value="">— Select —</option>
            <option value="DIY">DIY (Self)</option>
            {contractors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea rows={2} {...bind('notes')} />
      </div>
    </Modal>
  )
}

export default function PaintView({ propertyId, properties }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [selectedProp, setSelectedProp] = useState(propertyId)

  function load(pid) {
    setLoading(true)
    api.getPaint(pid).then(setRecords).finally(() => setLoading(false))
  }

  useEffect(() => { load(selectedProp) }, [selectedProp])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Property:</label>
          <select value={selectedProp} onChange={e => setSelectedProp(parseInt(e.target.value))} style={{ width: 'auto' }}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Color</button>
      </div>

      {records.length === 0
        ? <div className="empty"><div className="empty-icon">🎨</div><div className="empty-text">No paint records yet</div></div>
        : <div className="card"><div className="table-scroll">
            <table className="data-table">
              <thead><tr>
                <th>Swatch</th><th>Room / Surface</th><th>Color</th><th>Code</th><th>Sheen</th><th>Painted</th><th>By</th><th></th>
              </tr></thead>
              <tbody>
                {records.map(r => {
                  const hex = paintHex(r.color_code)
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="paint-swatch"
                          style={{ background: hex || 'var(--bg-hover)', border: '1px solid var(--border)' }} />
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.room_surface}</td>
                      <td>{r.color_name || '—'}</td>
                      <td className="mono">{r.color_code || '—'}</td>
                      <td className="text-secondary">{r.sheen || '—'}</td>
                      <td className="mono text-muted">{formatDate(r.date_painted)}</td>
                      <td className="text-secondary">{r.painted_by || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditRecord(r)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(r)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div></div>
      }

      {(showForm || editRecord) && (
        <PaintForm
          initial={editRecord}
          propertyId={selectedProp}
          onSave={() => { setShowForm(false); setEditRecord(null); load(selectedProp) }}
          onClose={() => { setShowForm(false); setEditRecord(null) }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete paint record for "${confirmDelete.room_surface}"?`}
          onConfirm={async () => {
            await api.deletePaint(confirmDelete.id)
            setConfirmDelete(null)
            load(selectedProp)
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
