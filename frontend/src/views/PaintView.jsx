import { useState, useEffect } from 'react'
import { api } from '../api'
import { Modal, ConfirmModal, LoadingSpinner, formatDate, useForm, paintHex } from '../components/shared'

function PaintForm({ initial, propertyId, onSave, onClose }) {
  const { values, bind, set } = useForm(initial || {
    property_id: propertyId, room_surface: '', brand: '', color_name: '',
    color_code: '', color_hex: '', sheen: '', date_painted: '', painted_by: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contractors, setContractors] = useState([])
  const [lookingUp, setLookingUp] = useState(false)

  useEffect(() => { api.getContractors().then(setContractors) }, [])

  async function lookupColor() {
    if (!values.color_name && !values.color_code) return
    setLookingUp(true)
    try {
      const result = await api.lookupPaintColor({
        color_name: values.color_name || null,
        color_code: values.color_code || null,
      })
      if (result.hex) set('color_hex', result.hex)
    } catch (e) {
      // silently fail — user can still pick manually
    } finally {
      setLookingUp(false)
    }
  }

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

  // Resolve swatch color: prefer explicit hex, fall back to code lookup
  const swatchHex = values.color_hex || paintHex(values.color_code)

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
          <input placeholder="SW 7036" {...bind('color_code')} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '8px' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={lookupColor}
          disabled={lookingUp || (!values.color_name && !values.color_code)}
          style={{ fontSize: '11px' }}
        >
          {lookingUp ? '🔍 Looking up…' : '🔍 AI color lookup'}
        </button>
      </div>

      {/* Color picker */}
      <div className="form-group">
        <label className="form-label">Swatch Color</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="color"
            value={swatchHex || '#888888'}
            onChange={e => set('color_hex', e.target.value)}
            style={{ width: '48px', height: '36px', padding: '2px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
          />
          <div style={{ flex: 1 }}>
            <input
              placeholder="#hex or leave blank"
              value={values.color_hex || ''}
              onChange={e => set('color_hex', e.target.value)}
            />
          </div>
          {swatchHex && (
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius)',
              background: swatchHex, border: '1px solid var(--border)', flexShrink: 0
            }} />
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Pick a color or paste a hex code. This is for the swatch preview only.
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
        <textarea
          {...bind('notes')}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>
    </Modal>
  )
}

function PaintCard({ record, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const hex = record.color_hex || paintHex(record.color_code)

  return (
    <div
      style={{
        background: 'var(--bg-raised)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header row — always visible, tap to expand */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 14px', cursor: 'pointer',
        }}
      >
        {/* Swatch */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0,
          background: hex || 'var(--bg-hover)',
          border: '1px solid var(--border)',
        }} />

        {/* Name + color */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record.room_surface}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {[record.color_name, record.color_code].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>

        {/* Chevron */}
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '10px', fontSize: '12px' }}>
            {record.brand && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Brand</div>
                <div style={{ fontWeight: 500 }}>{record.brand}</div>
              </div>
            )}
            {record.sheen && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sheen</div>
                <div style={{ fontWeight: 500 }}>{record.sheen}</div>
              </div>
            )}
            {record.date_painted && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Painted</div>
                <div style={{ fontWeight: 500 }}>{formatDate(record.date_painted)}</div>
              </div>
            )}
            {record.painted_by && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>By</div>
                <div style={{ fontWeight: 500 }}>{record.painted_by}</div>
              </div>
            )}
          </div>
          {record.notes && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {record.notes}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEdit(record) }}>Edit</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-overdue)' }} onClick={e => { e.stopPropagation(); onDelete(record) }}>Delete</button>
          </div>
        </div>
      )}
    </div>
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
        : <div>
            {records.map(r => (
              <PaintCard
                key={r.id}
                record={r}
                onEdit={setEditRecord}
                onDelete={setConfirmDelete}
              />
            ))}
          </div>
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
