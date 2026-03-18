import { useState, useEffect } from 'react'
import { api } from '../api'
import { StatusBadge, DueLabel, Modal, ConfirmModal, LoadingSpinner, formatDate, intervalLabel, useForm } from '../components/shared'
import { AssetModal, TaskModal, DeleteAssetModal, DeleteTaskModal, PropertyModal } from '../components/ManageModals'

function LogModal({ task, asset, onClose, onDone }) {
  const [spares, setSpares] = useState([])
  const [contractors, setContractors] = useState([])
  const [latestUsage, setLatestUsage] = useState(null)
  const today = new Date().toISOString().split('T')[0]
  const { values, bind } = useForm({ note: '', cost: '', contractor_id: '', spare_used_id: '', usage_value: '', completed_at: today })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const needsUsage = task.interval_type === 'hours' || task.interval_type === 'miles'
  const unit = task.interval_type === 'hours' ? 'hours' : 'miles'

  useEffect(() => {
    api.getSpares(asset.id).then(setSpares)
    api.getContractors().then(setContractors)
    if (needsUsage) {
      api.getUsageLogs(asset.id).then(logs => {
        if (logs && logs.length > 0) setLatestUsage(logs[0])
      }).catch(() => {})
    }
  }, [asset.id])

  async function submit() {
    setLoading(true); setError('')
    try {
      await api.logCompletion({
        task_id: task.id,
        note: values.note || null,
        cost: values.cost ? parseFloat(values.cost) : null,
        contractor_id: values.contractor_id ? parseInt(values.contractor_id) : null,
        spare_used_id: values.spare_used_id ? parseInt(values.spare_used_id) : null,
        usage_value: values.usage_value ? parseFloat(values.usage_value) : null,
        completed_at: values.completed_at ? new Date(values.completed_at + 'T12:00:00').toISOString() : null,
      })
      onDone()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Log: ${task.name}`} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : 'Mark Complete'}
        </button>
      </>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <strong>{asset.name}</strong> · {intervalLabel(task)}
        {task.last_completed_at && <span> · Last: {formatDate(task.last_completed_at)}</span>}
      </div>
      {task.task_parts && task.task_parts.length > 0 && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Parts needed</div>
          {task.task_parts.map(tp => (
            <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{tp.part_name}</span>
              {tp.part_qty > 1 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>×{tp.part_qty}</span>}
              {tp.part_spec_notes && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>{tp.part_spec_notes}</span>}
              {tp.part_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{tp.part_number}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Date completed</label>
        <input type="date" {...bind('completed_at')} />
      </div>
      {needsUsage && (
        <div className="form-group">
          <label className="form-label">Current {unit} on meter <span style={{ color: 'var(--status-overdue)' }}>*</span></label>
          <input type="number" placeholder={latestUsage ? `Last: ${latestUsage.value.toLocaleString()} ${unit}` : `Enter current ${unit} reading`} {...bind('usage_value')} />
          <div className="form-hint">
            {latestUsage
              ? <>Last logged: <strong>{latestUsage.value.toLocaleString()} {unit}</strong> on {formatDate(latestUsage.recorded_at)}</>
              : <>No prior reading — enter current {unit} to start tracking</>}
          </div>
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cost ($)</label>
          <input type="number" step="0.01" placeholder="0.00" {...bind('cost')} />
        </div>
        <div className="form-group">
          <label className="form-label">Contractor</label>
          <select {...bind('contractor_id')}>
            <option value="">Self / DIY</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {spares.length > 0 && (
        <div className="form-group">
          <label className="form-label">Spare part used</label>
          <select {...bind('spare_used_id')}>
            <option value="">None</option>
            {spares.filter(s => s.quantity > 0).map(s => (
              <option key={s.id} value={s.id}>{s.name} (qty: {s.quantity})</option>
            ))}
          </select>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea rows={3} placeholder="What was done, parts used, observations…" {...bind('note')} />
      </div>
    </Modal>
  )
}

function PartModal({ assetId, part, onClose, onDone }) {
  const { values, bind } = useForm({
    name:        part?.name || '',
    part_number: part?.part_number || '',
    qty:         part?.qty || 1,
    supplier:    part?.supplier || '',
    reorder_url: part?.reorder_url || '',
    last_price:  part?.last_price || '',
    spec_notes:  part?.spec_notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!values.name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const payload = {
        asset_id:    assetId,
        name:        values.name,
        part_number: values.part_number || null,
        qty:         parseInt(values.qty) || 1,
        supplier:    values.supplier || null,
        reorder_url: values.reorder_url || null,
        last_price:  values.last_price ? parseFloat(values.last_price) : null,
        spec_notes:  values.spec_notes || null,
      }
      if (part) {
        await api.updatePart(part.id, { ...payload })
      } else {
        await api.createPart(payload)
      }
      onDone()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={part ? 'Edit Part' : 'Add Part'} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Saving…' : part ? 'Save Changes' : 'Add Part'}
        </button>
      </>
    }>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Part name *</label>
          <input placeholder="Oil Filter, Impeller…" {...bind('name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Part number</label>
          <input placeholder="e.g. 8M0078630" {...bind('part_number')} style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Qty</label>
          <input type="number" min="1" {...bind('qty')} />
        </div>
        <div className="form-group">
          <label className="form-label">Spec / grade</label>
          <input placeholder="5W-30, MERV-8…" {...bind('spec_notes')} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Supplier</label>
          <input placeholder="West Marine, Amazon…" {...bind('supplier')} />
        </div>
        <div className="form-group">
          <label className="form-label">Last price ($)</label>
          <input type="number" step="0.01" placeholder="0.00" {...bind('last_price')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Reorder URL</label>
        <input placeholder="https://…" {...bind('reorder_url')} />
      </div>
    </Modal>
  )
}

function PartsTab({ asset, tasks }) {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(false)
  const [editPart, setEditPart] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expanded, setExpanded] = useState(new Set())

  useEffect(() => {
    if (!asset?.id) return
    setLoading(true)
    api.getAssetParts(asset.id).then(setParts).finally(() => setLoading(false))
  }, [asset?.id])

  async function deletePart(partId) {
    await api.deletePart(partId)
    setParts(prev => prev.filter(p => p.id !== partId))
    setConfirmDelete(null)
  }

  function reload() {
    api.getAssetParts(asset.id).then(setParts)
    setEditPart(null)
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ padding: '16px 18px' }}>
      {parts.length === 0 ? (
        <div className="empty"><div className="empty-text">No parts yet — add parts used for this asset's tasks</div></div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ fontSize: '13px' }}>
            <thead><tr>
              <th>Part</th><th>Order</th><th></th>
            </tr></thead>
            <tbody>
              {parts.map(p => (<>
                <tr key={p.id} onClick={() => toggleExpand(p.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 500 }}>
                    {p.name}
                    {p.spec_notes && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '6px' }}>{p.spec_notes}</span>}
                  </td>
                  <td>
                    {p.reorder_url
                      ? <a href={p.reorder_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: '8px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Order →
                        </a>
                      : <span className="text-muted" style={{ fontSize: '11px' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{expanded.has(p.id) ? '▲' : '▼'}</td>
                </tr>
                {expanded.has(p.id) && (
                  <tr key={`${p.id}-detail`} style={{ background: 'var(--bg-raised)' }}>
                    <td colSpan={3} style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        {p.part_number && <span><strong>Part #:</strong> {p.part_number}</span>}
                        {p.qty > 1 && <span><strong>Qty:</strong> {p.qty}</span>}
                        {p.supplier && <span><strong>Supplier:</strong> {p.supplier}</span>}
                        {p.last_price && <span><strong>Price:</strong> ${p.last_price.toFixed(2)}</span>}
                        {p.task_name && <span><strong>Task:</strong> {p.task_name}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditPart(p) }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-overdue)' }}
                          onClick={e => { e.stopPropagation(); setConfirmDelete({ id: p.id, name: p.name }) }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: parts.length > 0 ? '12px 0 0' : '0' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditPart({})}>+ Add Part</button>
      </div>

      {editPart !== null && (
        <PartModal
          assetId={asset.id}
          part={editPart?.id ? editPart : null}
          onClose={() => setEditPart(null)}
          onDone={reload}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`Remove "${confirmDelete.name}"? This will also unlink it from any tasks.`}
          onConfirm={() => deletePart(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function SnoozeModal({ task, onClose, onSaved }) {
  const presets = [
    { label: '1 week',   days: 7 },
    { label: '2 weeks',  days: 14 },
    { label: '1 month',  days: 30 },
    { label: '3 months', days: 90 },
  ]
  const [until, setUntil] = useState(task.snoozed_until || '')
  const [saving, setSaving] = useState(false)

  function applyPreset(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setUntil(d.toISOString().slice(0, 10))
  }

  async function save() {
    setSaving(true)
    try {
      await api.snoozeTask(task.id, until || null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function clearSnooze() {
    setSaving(true)
    try {
      await api.snoozeTask(task.id, null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Snooze: ${task.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Quick presets</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presets.map(p => (
              <button key={p.days} className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.days)}>{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Or pick a date</label>
          <input type="date" value={until} onChange={e => setUntil(e.target.value)}
            style={{ width: '100%' }} min={new Date().toISOString().slice(0, 10)} />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          {task.snoozed_until && (
            <button className="btn btn-ghost btn-sm" onClick={clearSnooze} disabled={saving}
              style={{ color: 'var(--status-overdue)' }}>Clear snooze</button>
          )}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!until || saving}>
              {saving ? 'Saving…' : 'Snooze'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function UsageTab({ asset }) {
  const unit = asset.current_hours != null ? 'hours' : 'miles'
  const baseline = asset.current_hours != null ? asset.current_hours : asset.current_miles
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reload() {
    setLoading(true)
    api.getUsageLogs(asset.id)
      .then(data => setLogs(data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [asset.id])

  const latestReading = logs.length > 0 ? logs[0].value : null

  async function logReading() {
    if (!value || isNaN(parseFloat(value))) { setError('Enter a valid reading'); return }
    setSaving(true); setError('')
    try {
      await api.updateUsage(asset.id, { asset_id: asset.id, value: parseFloat(value), note: note || null })
      setValue(''); setNote('')
      reload()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteLog(logId) {
    try {
      await api.deleteUsageLog(asset.id, logId)
      reload()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>BASELINE {unit.toUpperCase()}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{baseline ?? '—'}</div>
        </div>
        {latestReading != null && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>LATEST READING</div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{latestReading}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '240px' }}>
          <input
            type="number"
            placeholder={`New ${unit} reading`}
            value={value}
            onChange={e => setValue(e.target.value)}
            style={{ width: '140px' }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={logReading} disabled={saving || !value}>
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--status-overdue)', fontSize: '12px', width: '100%' }}>{error}</div>}
      </div>

      {logs.length === 0 ? (
        <div className="empty"><div className="empty-text">No {unit} readings logged yet</div></div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead><tr>
              <th>Date</th><th>{unit.charAt(0).toUpperCase() + unit.slice(1)}</th><th>Note</th><th></th>
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="mono text-muted">{formatDate(l.recorded_at)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{l.value}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{l.note || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-overdue)' }}
                      onClick={() => deleteLog(l.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SparesTab({ asset }) {
  const [parts, setParts]   = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState({})   // partId → true while saving

  useEffect(() => {
    if (!asset?.id) return
    setLoading(true)
    api.getAssetParts(asset.id).then(setParts).catch(() => setParts([])).finally(() => setLoading(false))
  }, [asset?.id])

  async function setQty(partId, newQty) {
    const qty = Math.max(0, parseInt(newQty) || 0)
    setParts(prev => prev.map(p => p.id === partId ? { ...p, qty } : p))
    setSaving(prev => ({ ...prev, [partId]: true }))
    try {
      await api.updatePartQty(partId, qty)
    } finally {
      setSaving(prev => ({ ...prev, [partId]: false }))
    }
  }

  if (loading) return <LoadingSpinner />

  if (parts.length === 0) return (
    <div style={{ padding: '16px 18px' }}>
      <div className="empty">
        <div className="empty-text">No parts defined for this asset yet.</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Add parts in the Parts tab, then track how many you have on hand here. Logging a task completion with a spare used will decrement the count automatically.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '16px 18px' }}>
      <div className="table-scroll">
        <table className="data-table" style={{ fontSize: '12px' }}>
          <thead><tr>
            <th>Part</th><th>Part #</th><th style={{ textAlign: 'center' }}>Qty on hand</th>
          </tr></thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id} >
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td className="mono">{p.part_number || '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontWeight: 700 }}
                      onClick={() => setQty(p.id, (p.qty || 0) - 1)}
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      value={p.qty ?? 0}
                      onChange={e => setQty(p.id, e.target.value)}
                      style={{ width: '52px', textAlign: 'center', fontFamily: 'var(--font-mono)', opacity: saving[p.id] ? 0.5 : 1, color: (p.qty ?? 0) === 0 ? 'var(--status-overdue)' : undefined, fontWeight: (p.qty ?? 0) === 0 ? 700 : undefined }}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontWeight: 700 }}
                      onClick={() => setQty(p.id, (p.qty || 0) + 1)}
                    >+</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const UNGROUPED = '__ungrouped__'

function TasksTab({ tasks: initialTasks, onLog, onEdit, onDelete, onSnooze, onAdd, onReordered, statusFilter }) {
  const [tasks, setTasks] = useState(() => [...initialTasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [extraGroups, setExtraGroups] = useState([])
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupInput, setNewGroupInput] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Only sync from server if the set of task IDs has changed (add/delete)
    // Not on every re-fetch, which would overwrite local group/order edits
    const incomingIds = [...initialTasks].map(t => t.id).sort().join(',')
    const currentIds = tasks.map(t => t.id).sort().join(',')
    if (incomingIds !== currentIds) {
      setTasks([...initialTasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    }
  }, [initialTasks])

  // Build ordered list of groups from tasks + any pending extra groups
  const taskGroups = []
  const seen = new Set()
  tasks.forEach(t => {
    const g = t.task_group || UNGROUPED
    if (!seen.has(g)) { seen.add(g); taskGroups.push(g) }
  })
  const allGroups = [...taskGroups, ...extraGroups.filter(g => !seen.has(g))]
  const existingGroups = allGroups.filter(g => g !== UNGROUPED)

  function toggleGroup(g) {
    setCollapsedGroups(prev => ({ ...prev, [g]: !prev[g] }))
  }

  function startRenameGroup(g) {
    setEditingGroup(g)
    setGroupNameInput(g === UNGROUPED ? '' : g)
  }

  async function commitRenameGroup(oldGroup, newName) {
    const trimmed = newName.trim()
    setEditingGroup(null)
    if (trimmed === (oldGroup === UNGROUPED ? '' : oldGroup)) return
    const updated = tasks.map(t =>
      (t.task_group || UNGROUPED) === oldGroup
        ? { ...t, task_group: trimmed || null }
        : t
    )
    setTasks(updated)
    setExtraGroups(prev => prev.filter(g => g !== oldGroup))
    await saveOrder(updated)
    // Don't call onReordered() here — it would re-fetch and overwrite local state
  }

  // Drag handlers
  function onDragStart(e, id) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, id) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragId) setDragOverId(id)
  }

  function onDrop(e, targetId, targetGroup) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }

    const from = tasks.findIndex(t => t.id === dragId)
    const to = tasks.findIndex(t => t.id === targetId)
    if (from === -1 || to === -1) return

    const updated = [...tasks]
    const [moved] = updated.splice(from, 1)
    // Move to target group
    moved.task_group = targetGroup === UNGROUPED ? null : targetGroup
    updated.splice(to, 0, moved)

    // Assign sort_order
    updated.forEach((t, i) => { t.sort_order = i })
    setTasks(updated)
    setDragId(null)
    setDragOverId(null)
    saveOrder(updated)
  }

  function moveTask(taskId, direction) {
    const group = tasks.find(t => t.id === taskId)?.task_group ?? null
    const groupTasks = tasks.filter(t => (t.task_group ?? null) === group)
    const idx = groupTasks.findIndex(t => t.id === taskId)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= groupTasks.length) return

    // Swap the two tasks in the full list
    const updated = [...tasks]
    const aIdx = updated.findIndex(t => t.id === groupTasks[idx].id)
    const bIdx = updated.findIndex(t => t.id === groupTasks[swapIdx].id)
    ;[updated[aIdx], updated[bIdx]] = [updated[bIdx], updated[aIdx]]
    updated.forEach((t, i) => { t.sort_order = i })
    setTasks(updated)
    saveOrder(updated)
  }

  async function saveOrder(ordered) {
    setSaving(true)
    const payload = ordered.map(t => ({
      id: t.id,
      sort_order: t.sort_order,
      task_group: t.task_group ?? null
    }))
    console.log('saveOrder payload:', JSON.stringify(payload))
    try {
      await api.reorderTasks(payload)
    } catch (e) { console.error('Reorder failed', e) }
    finally { setSaving(false) }
  }

  async function assignToGroup(task, groupName) {
    const updated = tasks.map(t =>
      t.id === task.id ? { ...t, task_group: groupName || null } : t
    )
    setTasks(updated)
    await saveOrder(updated)
  }

  return (
    <div>
      <style>{`
        @media (hover: none) and (pointer: coarse) {
          .drag-handle { display: none !important; }
          .reorder-arrows { display: flex !important; }
        }
      `}</style>
      {saving && <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 18px' }}>Saving order…</div>}
      {tasks.length === 0 && extraGroups.length === 0 && (
        <div className="empty">
          <div className="empty-text">No tasks yet — add a task to start tracking maintenance for this asset</div>
        </div>
      )}
      {allGroups.map(group => {
        const groupTasks = tasks.filter(t => (t.task_group || UNGROUPED) === group).filter(t => { if (!statusFilter) return true; if (statusFilter === 'overdue') return t.status === 'overdue'; return ['due_soon','snoozed'].includes(t.status); })
        const isExtra = extraGroups.includes(group) && groupTasks.length === 0
        const collapsed = collapsedGroups[group]
        const isUngrouped = group === UNGROUPED
        return (
          <div key={group}>
            {/* Group header — only show if there are named groups */}
            {(!isUngrouped || existingGroups.length > 0) && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 18px', background: 'var(--bg-panel)',
                  borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)',
                  userSelect: 'none'
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (!dragId) return
                  const updated = [...tasks]
                  const from = updated.findIndex(t => t.id === dragId)
                  if (from === -1) return
                  updated[from] = { ...updated[from], task_group: isUngrouped ? null : group }
                  updated.forEach((t, i) => { t.sort_order = i })
                  setTasks(updated)
                  setDragId(null); setDragOverId(null)
                  saveOrder(updated)
                }}
              >
                <button onClick={() => toggleGroup(group)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '11px', padding: '0 2px', flexShrink: 0
                }}>
                  {collapsed ? '▶\uFE0E' : '▼\uFE0E'}
                </button>
                {editingGroup === group ? (
                  <input
                    autoFocus
                    value={groupNameInput}
                    onChange={e => setGroupNameInput(e.target.value)}
                    onBlur={() => commitRenameGroup(group, groupNameInput)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRenameGroup(group, groupNameInput)
                      if (e.key === 'Escape') setEditingGroup(null)
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, padding: '2px 6px', width: '160px' }}
                  />
                ) : (
                  <>
                    <span
                      onClick={() => !isUngrouped && startRenameGroup(group)}
                      style={{ fontSize: '12px', fontWeight: 600, color: isUngrouped ? 'var(--text-muted)' : 'var(--text-primary)', cursor: isUngrouped ? 'default' : 'pointer' }}
                      title={isUngrouped ? '' : 'Click to rename'}
                    >
                      {isUngrouped ? 'Ungrouped' : group}
                    </span>
                    {!isUngrouped && (
                      <button
                        onClick={() => startRenameGroup(group)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                        title="Rename group"
                      >✎</button>
                    )}
                  </>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{groupTasks.length}</span>
                {isExtra && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>— drag tasks here</span>}
              </div>
            )}
            {!collapsed && (
              <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '0 0 var(--radius) var(--radius)', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ width: '100%', minWidth: '520px', background: 'var(--bg-card)' }}>
                <thead><tr>
                  <th style={{ width: '24px' }}></th>
                  <th>Task</th><th>Schedule</th><th>Status</th><th>Due</th><th>Last Done</th><th></th>
                </tr></thead>
                <tbody>
                  {groupTasks.map(task => (
                    <tr
                      key={task.id}
                      draggable
                      onDragStart={e => onDragStart(e, task.id)}
                      onDragOver={e => onDragOver(e, task.id)}
                      onDrop={e => onDrop(e, task.id, group)}
                      onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                      style={{
                        opacity: dragId === task.id ? 0.4 : 1,
                        background: dragOverId === task.id ? 'var(--accent-soft)' : undefined,
                        cursor: 'grab'
                      }}
                    >
                      <td style={{ paddingRight: 0, width: '24px' }}>
                        <span className="drag-handle" style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'grab' }}>⠿</span>
                        <span className="reorder-arrows" style={{ display: 'none', flexDirection: 'column', gap: '1px' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '1px 4px', fontSize: '10px', lineHeight: 1 }}
                            onClick={() => moveTask(task.id, -1)}
                            title="Move up"
                          >▲</button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '1px 4px', fontSize: '10px', lineHeight: 1 }}
                            onClick={() => moveTask(task.id, 1)}
                            title="Move down"
                          >▼</button>
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {task.is_critical && <span title="Critical alert" style={{ fontSize: '10px' }}>🔴</span>}
                          {task.name}
                          {task.task_parts && task.task_parts.length > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 6px' }}
                              title={task.task_parts.map(tp => tp.part_name).join(', ')}>
                              {task.task_parts.length} part{task.task_parts.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {task.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{task.description}</div>}
                      </td>
                      <td className="mono">{intervalLabel(task)}</td>
                      <td><StatusBadge status={task.status} /></td>
                      <td><DueLabel task={task} /></td>
                      <td className="mono text-muted">{formatDate(task.last_completed_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => onLog(task)} title="Log completion">✓</button>
                          {task.interval_type !== 'manual' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => onSnooze && onSnooze(task)} title="Snooze">💤</button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(task)} title="Edit">✎</button>
                          {existingGroups.length > 0 && (
                            <select
                              value={task.task_group || ''}
                              onChange={e => assignToGroup(task, e.target.value)}
                              style={{ fontSize: '11px', padding: '2px 2px', maxWidth: '28px', opacity: 0.7, cursor: 'pointer' }}
                              title="Move to group"
                            >
                              <option value="">—</option>
                              {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(task)}
                            style={{ color: 'var(--status-overdue)' }} title="Delete">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )
      })}
      <div style={{ padding: '10px 18px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add Task</button>
        {addingGroup ? (
          <>
            <input
              autoFocus
              value={newGroupInput}
              onChange={e => setNewGroupInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const name = newGroupInput.trim()
                  if (name) { setExtraGroups(prev => [...prev, name]); setNewGroupInput('') }
                  setAddingGroup(false)
                }
                if (e.key === 'Escape') setAddingGroup(false)
              }}
              placeholder="Group name…"
              style={{ fontSize: '12px', padding: '3px 8px', width: '140px' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const name = newGroupInput.trim()
              if (name) setExtraGroups(prev => [...prev, name])
              setNewGroupInput(''); setAddingGroup(false)
            }}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingGroup(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingGroup(true)}>+ New Group</button>
        )}
      </div>
    </div>
  )
}

function FreeformLogModal({ asset, onSave, onClose }) {
  const [values, setValues] = useState({
    description: '',
    date: new Date().toISOString().slice(0, 10),
    cost: '',
    note: '',
    contractor_id: '',
    usage_value: '',
  })
  const [contractors, setContractors] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getContractors().then(setContractors).catch(() => {})
  }, [])

  const hasUsage = asset.current_hours != null || asset.current_miles != null
  const usageLabel = asset.current_hours != null ? 'Hours' : 'Miles'

  async function handleSave() {
    if (!values.description.trim()) { setError('Description is required'); return }
    setSaving(true); setError('')
    try {
      await api.createLog({
        asset_id: asset.id,
        description: values.description.trim(),
        completed_at: values.date ? new Date(values.date).toISOString() : undefined,
        cost: values.cost !== '' ? parseFloat(values.cost) : null,
        note: values.note || null,
        contractor_id: values.contractor_id ? parseInt(values.contractor_id) : null,
        usage_value: values.usage_value !== '' ? parseFloat(values.usage_value) : null,
      })
      onSave()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Add History Entry</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">What was done *</label>
            <input className="form-input" value={values.description}
              onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
              placeholder="e.g. Replaced water pump, fixed leak under sink…" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={values.date}
              onChange={e => setValues(v => ({ ...v, date: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cost</label>
              <input type="number" className="form-input" value={values.cost}
                onChange={e => setValues(v => ({ ...v, cost: e.target.value }))}
                placeholder="0.00" min="0" step="0.01" />
            </div>
            {hasUsage && (
              <div className="form-group">
                <label className="form-label">{usageLabel} at service</label>
                <input type="number" className="form-input" value={values.usage_value}
                  onChange={e => setValues(v => ({ ...v, usage_value: e.target.value }))}
                  placeholder={asset.current_hours ?? asset.current_miles ?? ''} />
              </div>
            )}
          </div>
          {contractors.length > 0 && (
            <div className="form-group">
              <label className="form-label">Contractor</label>
              <select className="form-input" value={values.contractor_id}
                onChange={e => setValues(v => ({ ...v, contractor_id: e.target.value }))}>
                <option value="">— None —</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}{c.trade ? ` (${c.trade})` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={values.note}
              onChange={e => setValues(v => ({ ...v, note: e.target.value }))}
              placeholder="Optional notes…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryTab({ asset, logs, onReload }) {
  const [editLog, setEditLog] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showFreeform, setShowFreeform] = useState(false)
  const [contractors, setContractors] = useState([])
  const [usageLogs, setUsageLogs] = useState([])

  useEffect(() => {
    api.getContractors().then(setContractors).catch(() => {})
    if (asset.interval_type) {
      api.getUsageLogs(asset.id).then(setUsageLogs).catch(() => {})
    }
  }, [asset.id])

  function startEdit(l) {
    setEditLog(l.id)
    setEditValues({
      completed_at: l.completed_at ? l.completed_at.slice(0, 10) : '',
      cost: l.cost ?? '',
      note: l.note ?? '',
      description: l.description ?? '',
      contractor_id: l.contractor_id ?? '',
    })
  }

  async function saveEdit(id) {
    setSaving(true); setError('')
    try {
      await api.updateLog(id, {
        completed_at: editValues.completed_at ? new Date(editValues.completed_at).toISOString() : undefined,
        cost: editValues.cost !== '' ? parseFloat(editValues.cost) : null,
        note: editValues.note || null,
        description: editValues.description || null,
        contractor_id: editValues.contractor_id ? parseInt(editValues.contractor_id) : null,
      })
      setEditLog(null)
      onReload()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteEntry(id) {
    if (!window.confirm('Delete this history entry?')) return
    try {
      await api.deleteLog(id)
      onReload()
    } catch (e) { setError(e.message) }
  }

  // Merge completion logs + usage logs into one timeline
  const allEntries = [
    ...logs.map(l => ({ ...l, _type: 'completion', _date: l.completed_at })),
    ...usageLogs.map(u => ({ ...u, _type: 'usage', _date: u.logged_at || u.created_at })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date))

  // Group by year
  const byYear = {}
  allEntries.forEach(e => {
    const yr = new Date(e._date).getFullYear()
    if (!byYear[yr]) byYear[yr] = []
    byYear[yr].push(e)
  })
  const years = Object.keys(byYear).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const [collapsedYears, setCollapsedYears] = useState(() =>
    Object.fromEntries(years.filter(y => parseInt(y) < currentYear).map(y => [y, true]))
  )
  function toggleYear(yr) {
    setCollapsedYears(prev => ({ ...prev, [yr]: !prev[yr] }))
  }

  const unitLabel = asset.current_hours != null ? 'h' : 'mi'

  function entryIcon(e) {
    if (e._type === 'usage') return { icon: '⏱', color: 'var(--accent)' }
    if (!e.task_name) return { icon: '✎', color: 'var(--text-muted)' }
    if (e.cost) return { icon: '💰', color: '#a0855b' }
    return { icon: '✓', color: 'var(--status-ok)' }
  }

  return (
    <div>
      {showFreeform && (
        <FreeformLogModal
          asset={asset}
          onSave={() => { setShowFreeform(false); onReload() }}
          onClose={() => setShowFreeform(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px 4px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowFreeform(true)}>+ Add Entry</button>
      </div>

      {error && <div className="alert alert-error" style={{ margin: '8px 18px' }}>{error}</div>}

      {allEntries.length === 0 ? (
        <div className="empty" style={{ padding: '32px' }}>
          <div className="empty-text">No history yet</div>
        </div>
      ) : (
        <div style={{ padding: '8px 16px 16px' }}>
          {years.map(yr => (
            <div key={yr}>
              {/* Year header — clickable to collapse */}
              <div
                onClick={() => toggleYear(yr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  margin: '16px 0 10px', cursor: 'pointer', userSelect: 'none',
                }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                  color: 'var(--text-muted)', letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  {collapsedYears[yr] ? '▶' : '▼'} {yr}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  {byYear[yr].filter(e => e._type === 'completion').length} entries
                  {byYear[yr].filter(e => e._type === 'completion' && e.cost).reduce((s, e) => s + (e.cost || 0), 0) > 0 &&
                    ` · $${byYear[yr].filter(e => e._type === 'completion').reduce((s, e) => s + (e.cost || 0), 0).toFixed(0)}`
                  }
                </span>
              </div>

              {/* Timeline entries — hidden when collapsed */}
              {!collapsedYears[yr] && <div style={{ position: 'relative', paddingLeft: '28px' }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute', left: '10px', top: 0, bottom: 0,
                  width: '1px', background: 'var(--border)',
                }} />

                {byYear[yr].map((e, i) => {
                  const { icon, color } = entryIcon(e)
                  const isEditing = e._type === 'completion' && editLog === e.id
                  const date = new Date(e._date)
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                  return (
                    <div key={`${e._type}-${e.id}`} style={{
                      position: 'relative',
                      marginBottom: i === byYear[yr].length - 1 ? 0 : '10px',
                    }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: '-22px', top: '10px',
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: 'var(--bg-card)', border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '6px',
                      }} />

                      {/* Card */}
                      <div style={{
                        background: 'var(--bg-raised)', borderRadius: '6px',
                        border: '1px solid var(--border)',
                        padding: isEditing ? '10px 12px' : '8px 12px',
                      }}>
                        {isEditing ? (
                          /* Edit form */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <input type="date" value={editValues.completed_at}
                                onChange={e => setEditValues(v => ({ ...v, completed_at: e.target.value }))}
                                style={{ fontSize: '12px', padding: '3px 6px' }} />
                              {!e.task_name && (
                                <input value={editValues.description}
                                  onChange={ev => setEditValues(v => ({ ...v, description: ev.target.value }))}
                                  placeholder="Description…"
                                  style={{ fontSize: '12px', padding: '3px 6px', flex: 1, minWidth: '120px' }} />
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <select value={editValues.contractor_id}
                                onChange={ev => setEditValues(v => ({ ...v, contractor_id: ev.target.value }))}
                                style={{ fontSize: '12px', padding: '3px 6px' }}>
                                <option value="">— Self —</option>
                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <input type="number" value={editValues.cost}
                                onChange={ev => setEditValues(v => ({ ...v, cost: ev.target.value }))}
                                placeholder="Cost"
                                style={{ fontSize: '12px', padding: '3px 6px', width: '80px' }} />
                              <input value={editValues.note}
                                onChange={ev => setEditValues(v => ({ ...v, note: ev.target.value }))}
                                placeholder="Note…"
                                style={{ fontSize: '12px', padding: '3px 6px', flex: 1, minWidth: '120px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => saveEdit(e.id)} disabled={saving}>✓ Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditLog(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          /* Display row */
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ fontSize: '13px', minWidth: '16px', marginTop: '1px' }}>{icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {e._type === 'usage'
                                    ? `${e.value != null ? e.value.toLocaleString() : '—'} ${unitLabel}`
                                    : e.task_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{e.description || 'Manual entry'}</span>
                                  }
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
                              </div>
                              {e._type === 'completion' && (
                                <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                                  {(e.user_display_name || e.contractor_name) && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {e.contractor_name ? `🔧 ${e.contractor_name}` : e.user_display_name}
                                    </span>
                                  )}
                                  {e.cost > 0 && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#a0855b' }}>
                                      ${e.cost.toFixed(2)}
                                    </span>
                                  )}
                                  {e.usage_value != null && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                                      @ {e.usage_value.toLocaleString()} {unitLabel}
                                    </span>
                                  )}
                                  {e.note && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{e.note}</span>
                                  )}
                                </div>
                              )}
                              {e._type === 'usage' && e.note && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{e.note}</div>
                              )}
                            </div>
                            {e._type === 'completion' && (
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(e)} title="Edit" style={{ padding: '2px 6px' }}>✎</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => deleteEntry(e.id)} style={{ color: 'var(--status-overdue)', padding: '2px 6px' }} title="Delete">✕</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetContractorsTab({ asset }) {
  const [allContractors, setAllContractors] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [linkedNotes, setLinkedNotes] = useState({})  // contractorId -> notes
  const [lastUsed, setLastUsed] = useState({})         // contractorId -> date string
  const [displayContractors, setDisplayContractors] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    Promise.all([
      api.getAssetContractors(asset.id),
      api.getContractors(),
      api.getLogs({ asset_id: asset.id, limit: 200 })
    ]).then(([assocs, contractors, logs]) => {
      setAllContractors(contractors)

      // Build linked set + notes map
      const ids = new Set(assocs.map(a => a.contractor_id))
      const notes = {}
      assocs.forEach(a => { notes[a.contractor_id] = a.notes })
      setLinkedIds(ids)
      setLinkedNotes(notes)

      // Build lastUsed map from logs
      const lu = {}
      logs.forEach(l => {
        if (l.contractor_id && !lu[l.contractor_id]) {
          lu[l.contractor_id] = l.completed_at
        }
      })
      setLastUsed(lu)

      // Build unified display list: linked + history, deduped
      const seen = new Set()
      const display = []

      // First: explicitly linked
      assocs.forEach(a => {
        if (!seen.has(a.contractor_id)) {
          seen.add(a.contractor_id)
          const c = contractors.find(c => c.id === a.contractor_id)
          if (c) display.push({ ...c, _linked: true })
        }
      })

      // Then: from history (not already linked)
      logs.forEach(l => {
        if (l.contractor_id && !seen.has(l.contractor_id)) {
          seen.add(l.contractor_id)
          const c = contractors.find(c => c.id === l.contractor_id)
          if (c) display.push({ ...c, _linked: false })
        }
      })

      setDisplayContractors(display)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [asset.id])

  const available = allContractors.filter(c => !linkedIds.has(c.id) && !displayContractors.find(d => d.id === c.id))

  async function addContractor() {
    if (!selectedId) return
    setSaving(true); setError('')
    try {
      await api.addAssetContractor(asset.id, { contractor_id: parseInt(selectedId), notes: note || null })
      setAdding(false); setSelectedId(''); setNote('')
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function remove(contractorId) {
    try {
      await api.removeAssetContractor(asset.id, contractorId)
      load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ padding: '16px 18px' }}>
      {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}
      {displayContractors.length === 0 && !adding ? (
        <div className="empty"><div className="empty-text">No contractors linked to this asset yet</div></div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          {displayContractors.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                  {c.trade && <span>{c.trade}</span>}
                  {c.phone && <a href={`tel:${c.phone}`} style={{ color: 'var(--accent)' }}>{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--accent)' }}>{c.email}</a>}
                  {lastUsed[c.id] && (
                    <span>Last worked {new Date(lastUsed[c.id]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
                {linkedNotes[c.id] && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', fontStyle: 'italic' }}>{linkedNotes[c.id]}</div>}
              </div>
              {c._linked ? (
                <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}
                  style={{ color: 'var(--status-overdue)', flexShrink: 0 }}>✕</button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  await api.addAssetContractor(asset.id, { contractor_id: c.id, notes: null })
                  load()
                }} style={{ fontSize: '11px', flexShrink: 0, color: 'var(--accent)' }}>+ Link</button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ padding: '12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Contractor</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Select contractor…</option>
              {available.map(c => <option key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ''}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Installed 2019, Preferred tech" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={addContractor} disabled={saving || !selectedId}>
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setSelectedId(''); setNote('') }}>Cancel</button>
          </div>
          {available.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              All contractors are already linked. Add more in the Contractors section.
            </div>
          )}
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ Link Contractor</button>
      )}
    </div>
  )
}

function AssetRow({ asset, onLogDone, onEdit, onDelete, onSnooze, isOpen, onToggle, onSnoozeDone, taskRefreshKey, statusFilter }) {
  const open = isOpen ?? false
  const [tasks, setTasks] = useState([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [taskRefresh, setTaskRefresh] = useState(0)
  const [logTask, setLogTask] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [addTask, setAddTask] = useState(false)
  const [deleteTask, setDeleteTask] = useState(null)
  const [activeTab, setActiveTab] = useState('tasks')
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [logs, setLogs] = useState([])
  const [components, setComponents] = useState([])
  const [editComponent, setEditComponent] = useState(null)
  const [addComponent, setAddComponent] = useState(false)

  async function loadTasks() {
    const t = await api.getTasks({ asset_id: asset.id })
    setTasks(t)
    setTasksLoaded(true)
  }

  useEffect(() => {
    if (open) loadTasks()
  }, [open, taskRefresh, taskRefreshKey])

  async function loadTab(tab) {
    setActiveTab(tab)
    if (tab === 'notes' && notes.length === 0) api.getNotes(asset.id).then(setNotes)
    if (tab === 'history') api.getLogs({ asset_id: asset.id, limit: 20 }).then(setLogs)
    if (tab === 'parts' && !tasksLoaded) loadTasks()
    if (tab === 'components' && components.length === 0) api.getComponents(asset.id).then(setComponents)
  }

  function toggle() {
    if (!open) loadTasks()
    onToggle && onToggle()
  }

  async function addNote() {
    if (!newNote.trim()) return
    const n = await api.addNote({ asset_id: asset.id, body: newNote })
    setNotes(prev => [n, ...prev])
    setNewNote('')
  }

  const overdueCount = asset.overdue_count || 0
  const ageStr = asset.age_years
    ? `${asset.age_years}yr`
    : asset.model_year
      ? `~${new Date().getFullYear() - asset.model_year}yr (${asset.model_year} model)`
      : null

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Asset header row */}
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 18px', cursor: 'pointer',
          background: open ? 'var(--bg-raised)' : 'transparent',
          transition: 'background 0.12s'
        }}
      >
        <span style={{ fontSize: '20px', flex: 'none' }}>{asset.icon || '🔧'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{asset.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {[asset.make, asset.model_year && !asset.make ? asset.model_year : null, asset.model, asset.location_on_property].filter(Boolean).join(' · ')}
            {ageStr && <span> · {ageStr} old</span>}
            {asset.replacement_due_soon && <span style={{ color: 'var(--status-soon)' }}> · ⚠ Replace soon</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {overdueCount > 0 && <span className="badge badge-overdue">{overdueCount} overdue</span>}
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{asset.task_count} tasks</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '16px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
          <span
            onClick={e => { e.stopPropagation(); onEdit(asset) }}
            style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
            title="Edit asset"
          >✎</span>
          <span
            onClick={e => { e.stopPropagation(); onDelete(asset) }}
            style={{ color: 'var(--status-overdue)', fontSize: '13px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
            title="Delete asset"
          >✕</span>
        </div>
      </div>

      {/* Expanded section */}
      {open && (
        <div style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
          <div className="tabs" style={{ paddingLeft: '18px' }}>
            {['tasks', 'parts', 'history', 'spares', 'notes'].map(t => (
              <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`}
                onClick={() => loadTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            {(asset.current_hours != null || asset.current_miles != null) && (
              <button className={`tab ${activeTab === 'usage' ? 'active' : ''}`}
                onClick={() => loadTab('usage')}>
                Usage
              </button>
            )}
            <button className={`tab ${activeTab === 'contractors' ? 'active' : ''}`}
              onClick={() => loadTab('contractors')}>
              Contractors
            </button>
          </div>

          {/* Tasks tab */}
          {activeTab === 'tasks' && (
            <TasksTab
              tasks={tasks}
              onLog={setLogTask}
              onEdit={setEditTask}
              onDelete={setDeleteTask}
              onSnooze={onSnooze}
              onAdd={() => setAddTask(true)}
              onReordered={loadTasks}
              statusFilter={statusFilter}
            />
          )}

          {/* Parts tab */}
          {activeTab === 'parts' && <PartsTab asset={asset} tasks={tasks} />}

          {/* History tab */}
          {activeTab === 'history' && (
            <HistoryTab asset={asset} logs={logs} onReload={() => api.getLogs({ asset_id: asset.id, limit: 20 }).then(setLogs)} />
          )}

          {/* Spares tab */}
          {activeTab === 'spares' && <SparesTab asset={asset} />}
          {activeTab === 'usage' && <UsageTab asset={asset} />}

          {/* Notes tab */}
          {activeTab === 'notes' && (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  placeholder="Add a note…"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={addNote}>Add</button>
              </div>
              {notes.length === 0
                ? <div className="empty"><div className="empty-text">No notes yet</div></div>
                : notes.map(n => (
                    <div key={n.id} style={{
                      padding: '10px 12px', background: 'var(--bg-panel)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '13px' }}>{n.body}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {formatDate(n.created_at)} · {n.user_display_name || 'Unknown'}
                      </div>
                    </div>
                  ))
              }
            </div>
          )}


          {activeTab === 'components' && (
            <div style={{ padding: '16px 18px' }}>
              {components.length === 0
                ? <div className="empty"><div className="empty-text">No components tracked yet</div></div>
                : (
                  <div style={{ marginBottom: '12px' }}>
                    {components.map(comp => {
                      const statusColor = comp.expired
                        ? 'var(--status-overdue)'
                        : comp.expires_soon
                          ? 'var(--status-soon)'
                          : 'var(--status-ok)'
                      const statusLabel = comp.expired
                        ? 'Expired'
                        : comp.expires_soon
                          ? 'Expiring soon'
                          : comp.expected_lifespan_years ? 'OK' : null
                      return (
                        <div key={comp.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px',
                          padding: '12px', marginBottom: '8px',
                          background: 'var(--bg-panel)', borderRadius: 'var(--radius)',
                          border: `1px solid ${comp.expired || comp.expires_soon ? statusColor : 'var(--border)'}`
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {comp.name}
                              {statusLabel && (
                                <span style={{ fontSize: '10px', color: statusColor, background: `${statusColor}22`, borderRadius: '10px', padding: '1px 7px' }}>
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                              {comp.installed_date && <span>Installed {comp.installed_date}</span>}
                              {comp.age_years != null && <span> · {comp.age_years}yr old</span>}
                              {comp.expected_lifespan_years && <span> · {comp.expected_lifespan_years}yr lifespan</span>}
                            </div>
                            {comp.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{comp.notes}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditComponent(comp)}>✎</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-overdue)' }}
                              onClick={async () => { await api.deleteComponent(comp.id); setComponents(prev => prev.filter(c => c.id !== comp.id)) }}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
              <button className="btn btn-ghost btn-sm" onClick={() => setAddComponent(true)}>+ Add Component</button>
            </div>
          )}

          {activeTab === 'info' && (
            <div style={{ padding: '16px 18px' }}>
              {/* Warranty */}
              {asset.warranty_expires && (
                <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Warranty</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    Expires {asset.warranty_expires}
                    {new Date(asset.warranty_expires) < new Date()
                      ? <span style={{ color: 'var(--status-overdue)', marginLeft: '8px', fontSize: '11px' }}>Expired</span>
                      : <span style={{ color: 'var(--status-ok)', marginLeft: '8px', fontSize: '11px' }}>Active</span>}
                  </div>
                </div>
              )}
              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {[
                  ['Make', asset.make],
                  ['Model', asset.model],
                  ['Model year', asset.model_year],
                  ['Serial #', asset.serial_number],
                  ['Location', asset.location_on_property],
                  ['Purchase date', asset.purchase_date],
                  ['Install date', asset.install_date],
                  ['Lifespan', asset.expected_lifespan_years ? `${asset.expected_lifespan_years} yr` : null],
                  ['Hours baseline', asset.current_hours],
                  ['Miles baseline', asset.current_miles],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} style={{ padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* Custom fields */}
              {asset.custom_fields && Object.keys(asset.custom_fields).length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Custom Fields</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {Object.entries(asset.custom_fields).map(([k, v]) => (
                      <div key={k} style={{ padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{k}</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!asset.warranty_expires && !asset.custom_fields && !asset.serial_number && (
                <div className="empty"><div className="empty-text">No additional info — edit this asset to add warranty, specs, and custom fields</div></div>
              )}
            </div>
          )}

          {activeTab === 'contractors' && (
            <AssetContractorsTab asset={asset} />
          )}
        </div>
      )}

      {(addTask || editTask) && (
        <TaskModal
          task={editTask || null}
          assetId={asset.id}
          onClose={() => { setAddTask(false); setEditTask(null) }}
          onSaved={() => {
            setAddTask(false); setEditTask(null)
            setTaskRefresh(r => r + 1)
            onLogDone()
          }}
        />
      )}
      {deleteTask && (
        <DeleteTaskModal
          task={deleteTask}
          onClose={() => setDeleteTask(null)}
          onDeleted={() => {
            setDeleteTask(null)
            setTaskRefresh(r => r + 1)
            onLogDone()
          }}
        />
      )}
      {(addComponent || editComponent) && (
        <ComponentModal
          component={editComponent || null}
          assetId={asset.id}
          onClose={() => { setAddComponent(false); setEditComponent(null) }}
          onSaved={(result) => {
            if (editComponent) {
              setComponents(prev => prev.map(c => c.id === result.id ? result : c))
            } else {
              setComponents(prev => [...prev, result])
            }
            setAddComponent(false); setEditComponent(null)
          }}
        />
      )}
      {logTask && (
        <LogModal
          task={logTask} asset={asset}
          onClose={() => setLogTask(null)}
          onDone={() => {
            setLogTask(null)
            setTaskRefresh(r => r + 1)
            setLogs([])
            onLogDone()
          }}
        />
      )}
    </div>
  )
}

export default function PropertyView({ propertyId, properties = [], onSwitchProperty, onAddProperty, jumpToAssetId, onJumpHandled }) {
  const [property, setProperty] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState(null) // null | 'overdue' | 'due_soon'
  const [addAsset, setAddAsset] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [deleteAsset, setDeleteAsset] = useState(null)
  const [openAssets, setOpenAssets] = useState(new Set())
  const [assetTaskRefresh, setAssetTaskRefresh] = useState({})

  function toggleAsset(id) {
    setOpenAssets(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const [editProperty, setEditProperty] = useState(false)
  const [deleteProperty, setDeleteProperty] = useState(false)
  const [snoozeTask, setSnoozeTask] = useState(null)

  // Auto-open asset when navigating from dashboard
  useEffect(() => {
    if (jumpToAssetId && assets.length > 0) {
      setOpenAssets(prev => new Set([...prev, jumpToAssetId]))
      // Scroll to the asset after a brief delay
      setTimeout(() => {
        document.getElementById(`asset-${jumpToAssetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
      onJumpHandled && onJumpHandled()
    }
  }, [jumpToAssetId, assets])

  useEffect(() => {
    setLoading(true)
    setFilter(null)
    Promise.all([
      api.getProperties().then(ps => ps.find(p => p.id === propertyId)),
      api.getAssets(propertyId)
    ]).then(([prop, assetList]) => {
      setProperty(prop)
      setAssets(assetList)
    }).finally(() => setLoading(false))
  }, [propertyId, refresh])

  if (loading) return <LoadingSpinner />

  // Filter assets: only show assets that have at least one task matching filter
  const filteredAssets = filter
    ? assets.filter(a => {
        if (filter === 'overdue')  return (a.overdue_count || 0) > 0
        if (filter === 'due_soon') return (a.due_soon_count || 0) > 0
        return true
      })
    : assets

  function toggleFilter(f) {
    setFilter(prev => prev === f ? null : f)
  }

  const badgeStyle = (active) => ({
    cursor: 'pointer',
    outline: active ? '2px solid currentColor' : 'none',
    outlineOffset: '2px',
    transition: 'outline 0.1s',
    userSelect: 'none',
  })

  return (
    <div>
      {/* Property switcher */}
      {properties.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Property:</span>
          <select
            value={propertyId}
            onChange={e => onSwitchProperty && onSwitchProperty(parseInt(e.target.value))}
            style={{ flex: 1, maxWidth: 280 }}
          >
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => onAddProperty && onAddProperty()}>+ Add</button>
        </div>
      )}

      {property && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {[property.address_line1, property.city, property.state].filter(Boolean).join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditProperty(true)} title="Edit property">✎ Edit</button>
            {property.overdue_count > 0 && (
              <span
                className="badge badge-overdue"
                style={badgeStyle(filter === 'overdue')}
                onClick={() => toggleFilter('overdue')}
                title="Filter to overdue assets"
              >
                {property.overdue_count} overdue
              </span>
            )}
            {property.due_soon_count > 0 && (
              <span
                className="badge badge-due_soon"
                style={badgeStyle(filter === 'due_soon')}
                onClick={() => toggleFilter('due_soon')}
                title="Filter to due-soon assets"
              >
                {property.due_soon_count} due soon
              </span>
            )}
            <span
              className="badge badge-unknown"
              style={badgeStyle(filter === null)}
              onClick={() => setFilter(null)}
              title="Show all assets"
            >
              {filter
                ? `${filteredAssets.length} of ${property.asset_count} assets`
                : `${property.asset_count} assets`}
            </span>
          </div>
        </div>
      )}

      {filter && (
        <div style={{
          fontSize: '12px', color: 'var(--text-muted)',
          marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>Showing {filter === 'overdue' ? 'overdue' : 'due soon'} only</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setFilter(null)}
            style={{ fontSize: '11px', padding: '2px 8px' }}
          >
            Clear ✕
          </button>
        </div>
      )}

      <div className="card">
        {filteredAssets.length === 0
          ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">No assets match this filter</div></div>
          : filteredAssets.map(asset => (
            <div key={asset.id} id={`asset-${asset.id}`}>
            <AssetRow
              asset={asset}
              isOpen={openAssets.has(asset.id)}
              onToggle={() => toggleAsset(asset.id)}
              onLogDone={() => setRefresh(r => r + 1)}
              onEdit={a => setEditAsset(a)}
              onDelete={a => setDeleteAsset(a)}
              onSnooze={t => setSnoozeTask({ task: t, assetId: asset.id })}
              taskRefreshKey={assetTaskRefresh[asset.id] || 0}
              statusFilter={filter}
            />
            </div>
          ))
        }
        <div style={{ padding: '12px 18px', borderTop: filteredAssets.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddAsset(true)}>+ Add Asset</button>
        </div>
      </div>

      {/* Property modal */}
      {editProperty && property && (
        <PropertyModal
          property={property}
          onClose={() => setEditProperty(false)}
          onSaved={() => { setEditProperty(false); setRefresh(r => r + 1) }}
          onDelete={async () => {
            await api.deleteProperty(property.id)
            setEditProperty(false)
            if (onSwitchProperty && properties.length > 1) {
              const next = properties.find(p => p.id !== property.id)
              if (next) onSwitchProperty(next.id)
            }
          }}
        />
      )}

      {/* Asset modals */}
      {(addAsset || editAsset) && (
        <AssetModal
          asset={editAsset || null}
          propertyId={propertyId}
          onClose={() => { setAddAsset(false); setEditAsset(null) }}
          onSaved={(result) => {
            setAddAsset(false); setEditAsset(null)
            if (result && result.property_id && result.property_id !== propertyId) {
              // Asset moved to a different property — switch to it
              if (onSwitchProperty) onSwitchProperty(result.property_id)
            } else {
              setRefresh(r => r + 1)
            }
          }}
        />
      )}
      {deleteAsset && (
        <DeleteAssetModal
          asset={deleteAsset}
          onClose={() => setDeleteAsset(null)}
          onDeleted={() => { setDeleteAsset(null); setRefresh(r => r + 1) }}
        />
      )}
      {snoozeTask && (
        <SnoozeModal
          task={snoozeTask.task}
          onClose={() => setSnoozeTask(null)}
          onSaved={() => {
            setSnoozeTask(null)
            setAssetTaskRefresh(prev => ({ ...prev, [snoozeTask.assetId]: (prev[snoozeTask.assetId] || 0) + 1 }))
          }}
        />
      )}
    </div>
  )
}
