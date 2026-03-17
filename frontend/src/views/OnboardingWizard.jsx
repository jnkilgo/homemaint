import { useState } from 'react'
import { api } from '../api'

// Interval in days for backdating completion logs
function intervalToDays(interval, interval_type) {
  if (interval_type === 'days') return interval
  if (interval_type === 'months') return interval * 30
  if (interval_type === 'hours') return 30 // default 30 days for hour-based tasks
  if (interval_type === 'miles') return 90 // default 90 days for mileage-based tasks
  return 90
}

// Returns a backdated ISO string so that due = today + rand(0-30)
function randomInitialLastCompleted(interval, interval_type) {
  const daysUntilDue = Math.floor(Math.random() * 31) // 0-30
  const intervalDays = intervalToDays(interval, interval_type)
  const daysAgo = intervalDays - daysUntilDue
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

// Full spec-compliant task/part templates per persona
const PERSONA_TEMPLATES = {
  renter: {
    propertyName: 'Primary Residence',
    propertyType: 'primary',
    assets: [
      {
        name: 'Smoke Detectors', category: 'Safety', icon: '🔥',
        tasks: [
          { name: 'Test Smoke Detector', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
          { name: 'Replace Smoke Detector Battery', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [{ name: '9V Battery', qty: 0 }] },
        ],
      },
      {
        name: 'HVAC System', category: 'HVAC', icon: '❄️',
        tasks: [
          { name: 'Replace HVAC Air Filter', interval: 90, interval_type: 'days', is_critical: false, task_group: 'Filters', parts: [{ name: 'HVAC Air Filter', qty: 0 }] },
          { name: 'Schedule Annual HVAC Service', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Service', parts: [] },
        ],
      },
      {
        name: 'Automobile', category: 'Vehicle', icon: '🚗',
        tasks: [
          { name: 'Change Engine Oil', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Engine Oil', qty: 0 }, { name: 'Oil Filter', qty: 0 }] },
          { name: 'Replace Cabin Air Filter', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'Cabin Air Filter', qty: 0 }] },
          { name: 'Check Tire Pressure', interval: 1, interval_type: 'months', is_critical: false, task_group: 'Tires', parts: [] },
        ],
      },
      {
        name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿',
        tasks: [
          { name: 'Change Engine Oil', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Small Engine Oil', qty: 0 }] },
          { name: 'Replace Spark Plug', interval: 24, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Spark Plug', qty: 0 }] },
          { name: 'Sharpen Blade', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Blade', parts: [] },
        ],
      },
    ],
  },
  homeowner: {
    propertyName: 'Primary Home',
    propertyType: 'primary',
    assets: [
      {
        name: 'HVAC System', category: 'HVAC', icon: '❄️',
        tasks: [
          { name: 'Replace HVAC Air Filter', interval: 90, interval_type: 'days', is_critical: false, task_group: 'Filters', parts: [{ name: 'HVAC Air Filter', qty: 0 }] },
          { name: 'Schedule Annual HVAC Service', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Service', parts: [] },
          { name: 'Clean Condenser Coils', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Cleaning', parts: [] },
        ],
      },
      {
        name: 'Water Heater', category: 'Plumbing', icon: '🚿',
        tasks: [
          { name: 'Flush Water Heater', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Maintenance', parts: [] },
          { name: 'Inspect Pressure Relief Valve', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
        ],
      },
      {
        name: 'Smoke Detectors', category: 'Safety', icon: '🔥',
        tasks: [
          { name: 'Test Smoke Detector', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
          { name: 'Replace Smoke Detector Battery', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [{ name: '9V Battery', qty: 0 }] },
        ],
      },
      {
        name: 'Whole House Filter', category: 'Plumbing', icon: '💧',
        tasks: [
          { name: 'Replace Whole House Filter', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'Whole House Filter Cartridge', qty: 0 }] },
        ],
      },
      {
        name: 'RO System', category: 'Plumbing', icon: '🫧',
        tasks: [
          { name: 'Replace RO Filter', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'RO Filter Cartridge', qty: 0 }] },
          { name: 'Replace RO Membrane', interval: 24, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'RO Membrane', qty: 0 }] },
        ],
      },
      {
        name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿',
        tasks: [
          { name: 'Change Engine Oil', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Small Engine Oil', qty: 0 }] },
          { name: 'Replace Spark Plug', interval: 24, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Spark Plug', qty: 0 }] },
          { name: 'Sharpen Blade', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Blade', parts: [] },
        ],
      },
      {
        name: 'Automobile', category: 'Vehicle', icon: '🚗',
        tasks: [
          { name: 'Change Engine Oil', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Engine Oil', qty: 0 }, { name: 'Oil Filter', qty: 0 }] },
          { name: 'Replace Cabin Air Filter', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'Cabin Air Filter', qty: 0 }] },
          { name: 'Check Tire Pressure', interval: 1, interval_type: 'months', is_critical: false, task_group: 'Tires', parts: [] },
        ],
      },
      {
        name: 'Boat', category: 'Vehicle', icon: '⛵',
        tasks: [
          { name: 'Change Engine Oil', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Marine Engine Oil', qty: 0 }, { name: 'Oil Filter', qty: 0 }] },
          { name: 'Replace Spark Plugs', interval: 24, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Spark Plug', qty: 0 }] },
          { name: 'Check Bilge Pump', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
        ],
      },
    ],
  },
  multi: {
    propertyName: 'Primary Residence',
    propertyType: 'primary',
    assets: [
      {
        name: 'HVAC System', category: 'HVAC', icon: '❄️',
        tasks: [
          { name: 'Replace HVAC Air Filter', interval: 90, interval_type: 'days', is_critical: false, task_group: 'Filters', parts: [{ name: 'HVAC Air Filter', qty: 0 }] },
          { name: 'Schedule Annual HVAC Service', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Service', parts: [] },
        ],
      },
      {
        name: 'Water Heater', category: 'Plumbing', icon: '🚿',
        tasks: [
          { name: 'Flush Water Heater', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Maintenance', parts: [] },
        ],
      },
      {
        name: 'Smoke Detectors', category: 'Safety', icon: '🔥',
        tasks: [
          { name: 'Test Smoke Detector', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
          { name: 'Replace Smoke Detector Battery', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [{ name: '9V Battery', qty: 0 }] },
        ],
      },
      {
        name: 'Rental Appliances', category: 'Appliances', icon: '🍳',
        tasks: [
          { name: 'Inspect Appliances', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Inspection', parts: [] },
          { name: 'Clean Dryer Vent', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Safety', parts: [] },
        ],
      },
      {
        name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿',
        tasks: [
          { name: 'Change Engine Oil', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Small Engine Oil', qty: 0 }] },
          { name: 'Replace Spark Plug', interval: 24, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Spark Plug', qty: 0 }] },
        ],
      },
      {
        name: 'Automobile', category: 'Vehicle', icon: '🚗',
        tasks: [
          { name: 'Change Engine Oil', interval: 6, interval_type: 'months', is_critical: false, task_group: 'Engine', parts: [{ name: 'Engine Oil', qty: 0 }, { name: 'Oil Filter', qty: 0 }] },
          { name: 'Replace Cabin Air Filter', interval: 12, interval_type: 'months', is_critical: false, task_group: 'Filters', parts: [{ name: 'Cabin Air Filter', qty: 0 }] },
        ],
      },
    ],
  },
}

const PERSONAS = [
  { id: 'renter', icon: '🏢', label: 'Renter', description: "I rent my home and want to track what I'm responsible for" },
  { id: 'homeowner', icon: '🏠', label: 'Homeowner', description: "I own my home and want to stay on top of all maintenance" },
  { id: 'multi', icon: '🏘️', label: 'Multi-Property Owner', description: "I own multiple properties and need to track each one" },
]

const PROPERTY_TYPES = [
  { label: 'Primary Home', value: 'primary' },
  { label: 'Single Family Rental', value: 'rental_sfh' },
  { label: 'Multi-Family Rental', value: 'rental_multi' },
  { label: 'Vacation Home', value: 'vacation' },
]

export default function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0)
  const [personaId, setPersonaId] = useState(null)
  const [property, setProperty] = useState({ name: '', address: '', type: 'primary' })
  const [selectedAssets, setSelectedAssets] = useState([])
  const [customAsset, setCustomAsset] = useState('')
  const [customAssets, setCustomAssets] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [error, setError] = useState('')
  const [savedPropId, setSavedPropId] = useState(null)
  const [summary, setSummary] = useState({ assets: 0, tasks: 0, parts: 0 })

  const template = personaId ? PERSONA_TEMPLATES[personaId] : null

  function selectPersona(id) {
    setPersonaId(id)
    const t = PERSONA_TEMPLATES[id]
    setSelectedAssets(t.assets.map((_, i) => i))
    setProperty(p => ({ ...p, name: p.name || t.propertyName, type: t.propertyType }))
  }

  function toggleAsset(idx) {
    setSelectedAssets(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  function addCustomAsset() {
    if (!customAsset.trim()) return
    setCustomAssets(prev => [...prev, { name: customAsset.trim(), category: 'Other', icon: '🔧', tasks: [] }])
    setCustomAsset('')
  }

  async function finish() {
    setSaving(true)
    setError('')
    let totalTasks = 0
    let totalParts = 0

    try {
      setSaveStatus('Creating property...')
      const prop = await api.createProperty({
        name: property.name || 'My Home',
        address_line1: property.address || '',
        property_type: property.type,
        is_default: true,
      })
      setSavedPropId(prop.id)

      const assetsToCreate = [
        ...(template ? template.assets.filter((_, i) => selectedAssets.includes(i)) : []),
        ...customAssets,
      ]

      for (const asset of assetsToCreate) {
        setSaveStatus(`Setting up ${asset.name}...`)
        const created = await api.createAsset({
          property_id: prop.id,
          name: asset.name,
          category: asset.category,
        })

        for (const task of (asset.tasks || [])) {
          try {
            const createdTask = await api.createTask({
              asset_id: created.id,
              name: task.name,
              interval: task.interval,
              interval_type: task.interval_type,
              season: task.season || null,
              is_critical: task.is_critical,
              task_group: task.task_group || null,
              advance_warning_days: 14,
              parts: task.parts || [],
            })
            totalTasks++
            totalParts += (task.parts || []).length

            // Set randomized initial due date: today + random(0-30 days)
            const backdated = randomInitialLastCompleted(task.interval, task.interval_type)
            try {
              await api.logCompletion({
                task_id: createdTask.id,
                completed_at: backdated,
                notes: 'Initial setup — estimated last completed date',
              })
            } catch (e) {
              console.warn('Could not set initial due date for', task.name)
            }
          } catch (e) {
            console.warn('Task skipped:', task.name, e)
          }
        }
      }

      setSummary({ assets: assetsToCreate.length, tasks: totalTasks, parts: totalParts })
      setStep(3)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
      setSaveStatus('')
    }
  }

  const steps = ['Welcome', 'Property', 'Assets']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px',
      overflowY: 'auto',
    }}>
      {step < 3 && (
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {steps.map((s, i) => (
              <span key={s} style={{
                fontSize: 12,
                color: i <= step ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: i === step ? 600 : 400,
              }}>{s}</span>
            ))}
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--accent)',
              width: `${(step / 2) * 100}%`, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Step 0: Persona */}
        {step === 0 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Welcome to HomeMaint
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 15 }}>
              Let's set up your first property. What best describes you?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {PERSONAS.map(p => (
                <button key={p.id} onClick={() => selectPersona(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 10,
                  border: `2px solid ${personaId === p.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: personaId === p.id ? 'rgba(72,199,142,0.08)' : 'var(--surface)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', color: 'var(--text)',
                }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{p.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={onSkip}>Skip setup</button>
              <button className="btn btn-primary" onClick={() => setStep(1)} disabled={!personaId}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 1: Property */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Tell us about your property
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>
              You can always add more properties later.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Property Name *</label>
              <input className="form-input" placeholder="e.g. Main Home, Lake House"
                value={property.name} onChange={e => setProperty(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="123 Main St, City, State"
                value={property.address} onChange={e => setProperty(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label">Property Type</label>
              <select className="form-input" value={property.type}
                onChange={e => setProperty(p => ({ ...p, type: e.target.value }))}>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!property.name.trim()}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Assets */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              What do you want to track?
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 14 }}>
              Each asset comes with recommended tasks and parts pre-loaded. Uncheck anything that doesn't apply.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, marginTop: 20 }}>
              {template?.assets.map((asset, i) => {
                const taskCount = asset.tasks.length
                const partCount = asset.tasks.reduce((sum, t) => sum + t.parts.length, 0)
                return (
                  <label key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 8,
                    border: `1px solid ${selectedAssets.includes(i) ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedAssets.includes(i) ? 'rgba(72,199,142,0.06)' : 'var(--surface)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" checked={selectedAssets.includes(i)}
                      onChange={() => toggleAsset(i)}
                      style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                    <span style={{ fontSize: 20 }}>{asset.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{asset.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {asset.category}
                        {taskCount > 0 && ` · ${taskCount} task${taskCount !== 1 ? 's' : ''}`}
                        {partCount > 0 && ` · ${partCount} part${partCount !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </label>
                )
              })}
              {customAssets.map((asset, i) => (
                <div key={`custom-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8,
                  border: '1px solid var(--accent)', background: 'rgba(72,199,142,0.06)',
                }}>
                  <span style={{ fontSize: 20 }}>🔧</span>
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{asset.name}</div>
                  <button onClick={() => setCustomAssets(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              <input className="form-input" placeholder="Add a custom asset..."
                value={customAsset} onChange={e => setCustomAsset(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomAsset()} style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={addCustomAsset} disabled={!customAsset.trim()}>+ Add</button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            {saving && (
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                ⏳ {saveStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={saving}>← Back</button>
              <button className="btn btn-primary" onClick={finish} disabled={saving}>
                {saving ? 'Setting up...' : 'Finish setup →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
              You're all set!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
              <strong style={{ color: 'var(--text)' }}>{property.name}</strong> is ready with{' '}
              <strong style={{ color: 'var(--accent)' }}>{summary.assets} asset{summary.assets !== 1 ? 's' : ''}</strong>,{' '}
              <strong style={{ color: 'var(--accent)' }}>{summary.tasks} task{summary.tasks !== 1 ? 's' : ''}</strong>, and{' '}
              <strong style={{ color: 'var(--accent)' }}>{summary.parts} part{summary.parts !== 1 ? 's' : ''}</strong> pre-loaded.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              Tasks are scheduled with staggered due dates over the next 30 days so you're not overwhelmed on day one.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 36 }}>
              💡 Tip: Visit each asset to update the last completed date if you know it — this makes scheduling more accurate.
            </p>
            <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }}
              onClick={() => onComplete(savedPropId)}>
              Go to my property →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
