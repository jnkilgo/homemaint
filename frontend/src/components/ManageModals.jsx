import { useState, useEffect } from 'react'
import { api } from '../api'
import { Modal, ConfirmModal, useForm } from './shared'

const ASSET_ICONS = [
  '🏠','🏡','🏘️','🏗️','🔑','📦',
  '❄️','🔥','💧','⚡','🌊','💨',
  '🧺','🍳','🧊','🫧','📺',
  '🚗','🛻','🚙','🏍️','🚜','🛥️','⛵','🚤',
  '🌿','🌳','🌾','🏊','🏕️','🪚','🔧','🛠️','⚙️',
  '🐾','🔒','📡','🪴',
]

const PROPERTY_TYPES = [
  { value: 'primary',     label: 'Primary Residence' },
  { value: 'rental_sfh',  label: 'Rental — Single Family' },
  { value: 'rental_mf',   label: 'Rental — Multi Family' },
  { value: 'vacation',    label: 'Vacation Home' },
  { value: 'commercial',  label: 'Commercial' },
]
const INTERVAL_TYPES = [
  { value: 'days',     label: 'Days' },
  { value: 'months',   label: 'Months' },
  { value: 'hours',    label: 'Hours (usage)' },
  { value: 'miles',    label: 'Miles (usage)' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'manual',   label: 'Manual / On-demand' },
]
const SEASONS = ['spring','summer','fall','winter']

function FieldRow({ label, children, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '14px 0 6px' }}>
      {children}
    </div>
  )
}

export function PropertyModal({ property, onClose, onSaved, onDelete }) {
  const isEdit = !!property
  const { values, set, bind } = useForm({
    name:          property?.name || '',
    address_line1: property?.address_line1 || '',
    city:          property?.city || '',
    state:         property?.state || '',
    zip_code:      property?.zip_code || '',
    property_type: property?.property_type || 'primary',
    is_default:    property?.is_default || false,
    purchase_date: property?.purchase_date || '',
    purchase_price:property?.purchase_price || '',
    notes:         property?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function submit() {
    if (!values.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const data = { ...values, purchase_price: values.purchase_price ? parseFloat(values.purchase_price) : null, purchase_date: values.purchase_date || null }
      const result = isEdit ? await api.updateProperty(property.id, data) : await api.createProperty(data)
      onSaved(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? `Edit: ${property.name}` : 'Add Property'} onClose={onClose} footer={<>
      {isEdit && !confirmDelete && (
        <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--status-overdue)', marginRight: 'auto' }}>✕ Delete Property</button>
      )}
      {confirmDelete && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--status-overdue)' }}>Delete all assets & tasks?</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ color: 'var(--status-overdue)' }}>Confirm Delete</button>
        </div>
      )}
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Property'}</button>
    </>}>
      {error && <div className="alert alert-error">{error}</div>}
      <FieldRow label="Property name *"><input {...bind('name')} placeholder="Main Home" /></FieldRow>
      <FieldRow label="Type">
        <select {...bind('property_type')}>{PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
      </FieldRow>
      <FieldRow label="Street address"><input {...bind('address_line1')} placeholder="123 Main St" /></FieldRow>
      <div className="form-row">
        <FieldRow label="City"><input {...bind('city')} placeholder="Rogers" /></FieldRow>
        <FieldRow label="State"><input {...bind('state')} placeholder="AR" /></FieldRow>
      </div>
      <div className="form-row">
        <FieldRow label="ZIP"><input {...bind('zip_code')} /></FieldRow>
        <FieldRow label="Purchase date"><input type="date" {...bind('purchase_date')} /></FieldRow>
      </div>
      <FieldRow label="Purchase price"><input type="number" {...bind('purchase_price')} placeholder="0.00" /></FieldRow>
      <FieldRow label="Notes"><textarea {...bind('notes')} rows={2} placeholder="Optional notes…" /></FieldRow>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" id="is_default" checked={values.is_default} onChange={e => set('is_default', e.target.checked)} style={{ width: 'auto' }} />
        <label htmlFor="is_default" className="form-label" style={{ margin: 0 }}>Set as default property</label>
      </div>
    </Modal>
  )
}

function IconPicker({ value, onChange }) {
  const [show, setShow] = useState(false)
  const [custom, setCustom] = useState('')
  function pick(ic) { onChange(ic); setShow(false) }
  function applyCustom() { if (custom.trim()) { pick(custom.trim()); setCustom('') } }
  return (
    <div className="form-group">
      <label className="form-label">Icon</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => setShow(p => !p)} style={{ fontSize: '24px', width: '48px', height: '48px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>{value}</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap to change</span>
      </div>
      {show && (
        <div style={{ marginTop: '8px', padding: '10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {ASSET_ICONS.map(ic => (
              <button key={ic} onClick={() => pick(ic)} style={{ fontSize: '20px', width: '36px', height: '36px', background: value === ic ? 'var(--accent-soft)' : 'transparent', border: value === ic ? '1px solid var(--accent)' : '1px solid transparent', borderRadius: '6px', cursor: 'pointer' }}>{ic}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Or type any emoji…" style={{ flex: 1, fontSize: '16px' }} onKeyDown={e => e.key === 'Enter' && applyCustom()} />
            <button className="btn btn-ghost btn-sm" onClick={applyCustom}>Use</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomFieldsEditor({ value = {}, onChange }) {
  const [fields, setFields] = useState(Object.entries(value || {}).map(([k, v]) => ({ key: k, val: v })))
  function update(idx, key, val) {
    const updated = fields.map((f, i) => i === idx ? { ...f, [key]: val } : f)
    setFields(updated)
    onChange(Object.fromEntries(updated.filter(f => f.key.trim()).map(f => [f.key, f.val])))
  }
  function add() { setFields(f => [...f, { key: '', val: '' }]) }
  function remove(idx) {
    const updated = fields.filter((_, i) => i !== idx)
    setFields(updated)
    onChange(Object.fromEntries(updated.filter(f => f.key.trim()).map(f => [f.key, f.val])))
  }
  return (
    <div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
          <input placeholder="Field (e.g. Oil spec)" value={f.key} onChange={e => update(i, 'key', e.target.value)} style={{ flex: 1 }} />
          <input placeholder="Value (e.g. 5W-30)" value={f.val} onChange={e => update(i, 'val', e.target.value)} style={{ flex: 1 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>x</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={add}>+ Add field</button>
    </div>
  )
}


export function AISuggestModal({ asset, assetId, onClose, onImported }) {
  const [suggestions, setSuggestions] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('Asking AI for maintenance recommendations…')

  useEffect(() => {
    const context = {
      name:        asset.name        || '',
      make:        asset.make        || '',
      model:       asset.model       || '',
      model_year:  asset.model_year  || '',
      category:    asset.category    || '',
      location:    asset.location_on_property || '',
      description: asset.description || '',
    }
    api.getAISuggestions(context)
      .then(data => {
        setSuggestions(data.suggestions)
        setSelected(new Set(data.suggestions.map((_, i) => i)))
      })
      .catch(e => setError(e.message || String(e)))
      .finally(() => setLoading(false))
  }, [])

  function toggleAll() {
    if (selected.size === suggestions.length) setSelected(new Set())
    else setSelected(new Set(suggestions.map((_, i) => i)))
  }

  async function importSelected() {
    setImporting(true)
    setError('')
    try {
      const toImport = suggestions.filter((_, i) => selected.has(i))
      for (const s of toImport) {
        // Create task
        const task = await api.createTask({
          asset_id:             assetId,
          name:                 s.name,
          description:          s.description || null,
          interval_type:        s.interval_type || 'months',
          interval:             s.interval || null,
          advance_warning_days: 14,
          is_critical:          false,
        })
        // Create parts linked to asset
        if (s.parts && s.parts.length > 0) {
          for (const p of s.parts) {
            const part = await api.createPart({
              asset_id:    assetId,
              task_id:     task.id,
              name:        p.name,
              part_number: p.part_number || null,
              spec_notes:  p.spec_notes  || null,
              qty:         p.qty         || 1,
            })
            await api.linkTaskPart(task.id, { part_id: part.id })
          }
        }
      }
      onImported()
    } catch (e) { setError(e.message || JSON.stringify(e)) }
    finally { setImporting(false) }
  }

  return (
    <Modal title="🤖 AI Maintenance Suggestions" onClose={onClose} footer={
      suggestions && !loading ? (
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
            {selected.size === suggestions.length ? 'Deselect all' : 'Select all'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={importSelected} disabled={importing || selected.size === 0}>
              {importing ? 'Importing…' : `Import ${selected.size} task${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      )
    }>
      {error && <div className="alert alert-error">{error}</div>}
      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{statusMsg}</div>
        </div>
      )}
      {!loading && suggestions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {suggestions.length} tasks suggested — check the ones you want to import.
          </div>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })}
              style={{ padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.1s',
                background: selected.has(i) ? 'var(--accent-soft)' : 'var(--bg-raised)',
                border: `1px solid ${selected.has(i) ? 'var(--accent)' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0, marginTop: '2px',
                  background: selected.has(i) ? 'var(--accent)' : 'transparent',
                  border: `2px solid ${selected.has(i) ? 'var(--accent)' : 'var(--border-muted)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                  {selected.has(i) ? '✓' : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</span>
                    {s.interval && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        Every {s.interval} {s.interval_type}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>{s.description}</div>
                  )}
                  {s.parts && s.parts.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {s.parts.map((p, pi) => (
                        <span key={pi} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 7px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          {p.qty > 1 ? `${p.qty}× ` : ''}{p.name}{p.spec_notes ? ` (${p.spec_notes})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function AssetModal({ asset, propertyId, onClose, onSaved }) {
  const isEdit = !!asset
  const { values, set, bind } = useForm({
    name:                   asset?.name || '',
    category:               asset?.category || '',
    make:                   asset?.make || '',
    model:                  asset?.model || '',
    model_year:             asset?.model_year || '',
    serial_number:          asset?.serial_number || '',
    location_on_property:   asset?.location_on_property || '',
    install_date:           asset?.install_date || '',
    expected_lifespan_years:asset?.expected_lifespan_years || '',
    purchase_date:          asset?.purchase_date || '',
    purchase_price:         asset?.purchase_price || '',
    warranty_expires:       asset?.warranty_expires || '',
    current_hours:          asset?.current_hours || '',
    current_miles:          asset?.current_miles || '',
    icon:                   asset?.icon || '🔧',
    property_id:            asset?.property_id || propertyId,
  })
  const [customFields, setCustomFields] = useState(asset?.custom_fields || {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [properties, setProperties] = useState([])

  useEffect(() => {
    api.getAISettings().then(s => setAiEnabled(s.ai_enabled)).catch(() => {})
    if (isEdit) api.getProperties().then(setProperties).catch(() => {})
  }, [])

  async function submit() {
    if (!values.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const data = {
        ...values,
        property_id:            parseInt(values.property_id),
        model_year:             values.model_year ? parseInt(values.model_year) : null,
        expected_lifespan_years:values.expected_lifespan_years ? parseInt(values.expected_lifespan_years) : null,
        purchase_date:          values.purchase_date || null,
        purchase_price:         values.purchase_price ? parseFloat(values.purchase_price) : null,
        current_hours:          values.current_hours ? parseFloat(values.current_hours) : null,
        current_miles:          values.current_miles ? parseFloat(values.current_miles) : null,
        install_date:           values.install_date || null,
        warranty_expires:       values.warranty_expires || null,
        custom_fields:          Object.keys(customFields).length > 0 ? customFields : null,
      }
      console.log('Asset submit data:', JSON.stringify({ property_id: data.property_id, name: data.name }))
      const result = isEdit ? await api.updateAsset(asset.id, data) : await api.createAsset(data)
      console.log('Asset save result:', JSON.stringify({ property_id: result?.property_id, name: result?.name }))
      onSaved(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
    <Modal title={isEdit ? `Edit: ${asset.name}` : 'Add Asset'} onClose={onClose} footer={
      <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAI(true)} disabled={!aiEnabled} title={aiEnabled ? 'Suggest tasks with AI' : 'Enable AI in Settings first'}
          style={{ opacity: aiEnabled ? 1 : 0.4 }}>🤖 Suggest tasks</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}</button>
        </div>
      </div>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      <IconPicker value={values.icon} onChange={v => set('icon', v)} />
      <FieldRow label="Asset name *"><input {...bind('name')} placeholder="HVAC System" /></FieldRow>
      {isEdit && properties.length > 1 && (
        <FieldRow label="Property">
          <select value={parseInt(values.property_id)} onChange={e => set('property_id', parseInt(e.target.value))}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FieldRow>
      )}
      <div className="form-row">
        <FieldRow label="Make"><input {...bind('make')} placeholder="Carrier" /></FieldRow>
        <FieldRow label="Model"><input {...bind('model')} placeholder="Infinity 24" /></FieldRow>
      </div>
      <div className="form-row">
        <FieldRow label="Model year" hint="Manufacturing year — used for age if no install date">
          <input type="number" {...bind('model_year')} placeholder="2018" min="1900" max="2100" />
        </FieldRow>
        <FieldRow label="Category"><input {...bind('category')} placeholder="HVAC, Appliance, Vehicle…" /></FieldRow>
      </div>
      <div className="form-row">
        <FieldRow label="Location"><input {...bind('location_on_property')} placeholder="Utility closet" /></FieldRow>
        <FieldRow label="Serial number"><input {...bind('serial_number')} /></FieldRow>
      </div>
      <SectionLabel>Age and Warranty</SectionLabel>
      <div className="form-row">
        <FieldRow label="Install / in-service date" hint="Leave blank to use model year for age">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="date" {...bind('install_date')} style={{ flex: 1 }} />
            {values.install_date && (
              <button onClick={() => set('install_date', '')} title="Clear date"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>x</button>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Expected lifespan (years)"><input type="number" {...bind('expected_lifespan_years')} placeholder="15" /></FieldRow>
      </div>
      <div className="form-row">
        <FieldRow label="Warranty expires"><input type="date" {...bind('warranty_expires')} /></FieldRow>
        <FieldRow label="Purchase date"><input type="date" {...bind('purchase_date')} /></FieldRow>
      </div>
      <div className="form-row">
        <FieldRow label="Purchase price"><input type="number" {...bind('purchase_price')} placeholder="0.00" /></FieldRow>
        <div className="form-group" />
      </div>
      <SectionLabel>Usage Tracking</SectionLabel>
      <div className="form-row">
        <FieldRow label="Hours at baseline" hint="Odometer when you started tracking"><input type="number" {...bind('current_hours')} placeholder="348" /></FieldRow>
        <FieldRow label="Miles at baseline" hint="Odometer when you started tracking"><input type="number" {...bind('current_miles')} /></FieldRow>
      </div>
      <SectionLabel>Custom Fields</SectionLabel>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Store any specs: oil type, belt size, filter part #, tire size, etc.</div>
      <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
    </Modal>
    {showAI && (
      <AISuggestModal
        asset={{ ...values, custom_fields: customFields }}
        assetId={asset?.id || null}
        onClose={() => setShowAI(false)}
        onImported={() => { setShowAI(false) }}
      />
    )}
  </>
  )
}

export function TaskModal({ task, assetId, onClose, onSaved }) {
  const isEdit = !!task
  const { values, set, bind } = useForm({
    name:                task?.name || '',
    description:         task?.description || '',
    interval_type:       task?.interval_type || 'months',
    interval:            task?.interval || '',
    season:              task?.season || 'spring',
    advance_warning_days:task?.advance_warning_days ?? 14,
    is_critical:         task?.is_critical || false,
  })
  const [assetParts, setAssetParts] = useState([])   // all parts on this asset
  const [linkedIds, setLinkedIds] = useState(new Set()) // task_part ids currently linked
  const [tpMap, setTpMap] = useState({})             // part_id -> task_part id (for unlinking)
  const [quickAdd, setQuickAdd] = useState(false)
  const [newPart, setNewPart] = useState({ name: '', part_number: '', qty: 1, spec_notes: '', supplier: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (assetId) api.getAssetParts(assetId).then(setAssetParts).catch(() => {})
    if (isEdit && task.id) {
      api.getTaskParts(task.id).then(tps => {
        setLinkedIds(new Set(tps.map(tp => tp.part_id)))
        const m = {}; tps.forEach(tp => { m[tp.part_id] = tp.id }); setTpMap(m)
      }).catch(() => {})
    }
  }, [task?.id, assetId])

  function togglePart(partId) {
    setLinkedIds(prev => {
      const next = new Set(prev)
      next.has(partId) ? next.delete(partId) : next.add(partId)
      return next
    })
  }

  async function submit() {
    if (!values.name.trim()) { setError('Name is required'); return }
    if (values.interval_type !== 'seasonal' && values.interval_type !== 'manual' && !values.interval) { setError('Interval amount is required'); return }
    setLoading(true); setError('')
    try {
      const data = {
        asset_id: assetId, name: values.name, description: values.description || null,
        interval_type: values.interval_type,
        interval: (values.interval_type !== 'seasonal' && values.interval_type !== 'manual') ? parseInt(values.interval) : null,
        season: values.interval_type === 'seasonal' ? values.season : null,
        advance_warning_days: parseInt(values.advance_warning_days),
        is_critical: values.is_critical,
      }
      const result = isEdit ? await api.updateTask(task.id, data) : await api.createTask(data)
      const taskId = result.id

      // Quick-add new part first, then link it
      if (quickAdd && newPart.name.trim()) {
        const created = await api.createPart({ asset_id: assetId, name: newPart.name, part_number: newPart.part_number || null, qty: parseInt(newPart.qty) || 1, spec_notes: newPart.spec_notes || null, supplier: newPart.supplier || null })
        linkedIds.add(created.id)
      }

      // Sync task_parts: unlink removed, link added
      const originalIds = new Set(Object.keys(tpMap).map(Number))
      const toUnlink = [...originalIds].filter(id => !linkedIds.has(id))
      const toLink   = [...linkedIds].filter(id => !originalIds.has(id))
      await Promise.all(toUnlink.map(partId => api.unlinkTaskPart(tpMap[partId])))
      await Promise.all(toLink.map(partId => api.linkTaskPart(taskId, { part_id: partId })))

      onSaved(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? `Edit: ${task.name}` : 'Add Task'} onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}</button>
    </>}>
      {error && <div className="alert alert-error">{error}</div>}
      <FieldRow label="Task name *"><input {...bind('name')} placeholder="Air Filter Replacement" /></FieldRow>
      <FieldRow label="Description"><textarea {...bind('description')} placeholder="Optional task description…" rows={2} style={{ resize: 'vertical' }} /></FieldRow>
      <div className="form-row">
        <FieldRow label="Schedule type">
          <select {...bind('interval_type')}>{INTERVAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </FieldRow>
        {values.interval_type === 'manual' ? null : values.interval_type === 'seasonal' ? (
          <FieldRow label="Season">
            <select {...bind('season')}>{SEASONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select>
          </FieldRow>
        ) : (
          <FieldRow label={`Every (${values.interval_type})`}><input type="number" {...bind('interval')} placeholder="3" min="1" /></FieldRow>
        )}
      </div>
      {values.interval_type !== 'manual' && (
        <FieldRow label="Advance warning" hint="Days before due to show as Due Soon">
          <input type="number" {...bind('advance_warning_days')} min="1" max="365" />
        </FieldRow>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', borderRadius: 'var(--radius)', background: values.is_critical ? 'var(--status-overdue-bg)' : 'var(--bg-raised)', border: `1px solid ${values.is_critical ? 'var(--status-overdue)' : 'var(--border)'}`, transition: 'all 0.15s', marginTop: '4px', marginBottom: '16px' }}>
        <input type="checkbox" id="is_critical" checked={values.is_critical} onChange={e => set('is_critical', e.target.checked)} style={{ width: 'auto', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <label htmlFor="is_critical" style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'block' }}>🔴 Critical alert</label>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Send urgent push notification when overdue. Use for safety-critical items only.</div>
        </div>
      </div>

      <SectionLabel>Required Parts</SectionLabel>
      {assetParts.length === 0 && !quickAdd ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          No parts defined for this asset yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
          {assetParts.map(p => (
            <div key={p.id} onClick={() => togglePart(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', borderRadius: 'var(--radius)', cursor: 'pointer',
                background: linkedIds.has(p.id) ? 'var(--accent-soft)' : 'var(--bg-raised)',
                border: `1px solid ${linkedIds.has(p.id) ? 'var(--accent)' : 'var(--border)'}`, transition: 'all 0.1s' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                background: linkedIds.has(p.id) ? 'var(--accent)' : 'transparent',
                border: `2px solid ${linkedIds.has(p.id) ? 'var(--accent)' : 'var(--border-muted)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                {linkedIds.has(p.id) ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</span>
                {p.spec_notes && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '6px' }}>{p.spec_notes}</span>}
                {p.part_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>#{p.part_number}</span>}
              </div>
              {p.qty > 1 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>×{p.qty}</span>}
            </div>
          ))}
        </div>
      )}

      {quickAdd ? (
        <div style={{ padding: '10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>New part (will be added to Parts tab)</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input style={{ flex: '1 1 130px' }} placeholder="Part name *" value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} />
            <input style={{ flex: '0 0 52px' }} type="number" min="1" placeholder="Qty" value={newPart.qty} onChange={e => setNewPart(p => ({ ...p, qty: e.target.value }))} />
            <input style={{ flex: '1 1 90px' }} placeholder="Spec/grade" value={newPart.spec_notes} onChange={e => setNewPart(p => ({ ...p, spec_notes: e.target.value }))} />
            <input style={{ flex: '1 1 80px' }} placeholder="Part #" value={newPart.part_number} onChange={e => setNewPart(p => ({ ...p, part_number: e.target.value }))} />
            <input style={{ flex: '1 1 80px' }} placeholder="Supplier" value={newPart.supplier} onChange={e => setNewPart(p => ({ ...p, supplier: e.target.value }))} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '6px' }} onClick={() => { setQuickAdd(false); setNewPart({ name: '', part_number: '', qty: 1, spec_notes: '', supplier: '' }) }}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setQuickAdd(true)}>+ New part</button>
      )}
    </Modal>
  )
}

export function DeleteAssetModal({ asset, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  async function confirm() {
    setLoading(true)
    try { await api.deleteAsset(asset.id); onDeleted() }
    catch (e) { setLoading(false) }
  }
  return <ConfirmModal message={`Delete "${asset.name}"? This will permanently remove all tasks, history, and parts.`} onClose={onClose} onConfirm={confirm} />
}

export function DeleteTaskModal({ task, onClose, onDeleted }) {
  async function confirm() { await api.deleteTask(task.id); onDeleted() }
  return <ConfirmModal message={`Delete task "${task.name}"? All completion history will be lost.`} onClose={onClose} onConfirm={confirm} />
}

// ── Component Modal ───────────────────────────────────────────────────────

export function ComponentModal({ component, assetId, onClose, onSaved }) {
  const isEdit = !!component
  const { values, set, bind } = useForm({
    name:                    component?.name || '',
    installed_date:          component?.installed_date || '',
    expected_lifespan_years: component?.expected_lifespan_years || '',
    notes:                   component?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!values.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const data = {
        name: values.name,
        installed_date: values.installed_date || null,
        expected_lifespan_years: values.expected_lifespan_years ? parseFloat(values.expected_lifespan_years) : null,
        notes: values.notes || null,
      }
      const result = isEdit
        ? await api.updateComponent(component.id, data)
        : await api.createComponent(assetId, data)
      onSaved(result)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal
      title={isEdit ? `Edit: ${component.name}` : 'Add Component'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Component'}
        </button>
      </>}
    >
      {error && <div className="alert alert-error">{error}</div>}
      <FieldRow label="Component name *">
        <input {...bind('name')} placeholder="Serpentine Belt, Water Pump, Air Filter…" />
      </FieldRow>
      <div className="form-row">
        <FieldRow label="Install date">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="date" {...bind('installed_date')} style={{ flex: 1 }} />
            {values.installed_date && (
              <button onClick={() => set('installed_date', '')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>x</button>
            )}
          </div>
        </FieldRow>
        <FieldRow label="Expected lifespan (years)" hint="Leave blank for no alert">
          <input type="number" {...bind('expected_lifespan_years')} placeholder="2" step="0.5" min="0" />
        </FieldRow>
      </div>
      <FieldRow label="Notes">
        <textarea {...bind('notes')} rows={2} placeholder="Brand, part number, any details…" />
      </FieldRow>
    </Modal>
  )
}
