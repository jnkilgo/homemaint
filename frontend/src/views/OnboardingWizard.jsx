import { useState } from 'react'
import { api } from '../api'

const PERSONAS = [
  {
    id: 'renter',
    icon: '🏢',
    label: 'Renter',
    description: "I rent my home and want to track what I'm responsible for",
    assets: [
      { name: 'Smoke Detectors', category: 'Safety', icon: '🔥' },
      { name: 'HVAC System', category: 'HVAC', icon: '❄️' },
      { name: 'Automobile', category: 'Vehicle', icon: '🚗' },
      { name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿' },
    ],
  },
  {
    id: 'homeowner',
    icon: '🏠',
    label: 'Homeowner',
    description: "I own my home and want to stay on top of all maintenance",
    assets: [
      { name: 'HVAC System', category: 'HVAC', icon: '❄️' },
      { name: 'Water Heater', category: 'Plumbing', icon: '🚿' },
      { name: 'Smoke Detectors', category: 'Safety', icon: '🔥' },
      { name: 'Whole House Filter', category: 'Plumbing', icon: '💧' },
      { name: 'RO System', category: 'Plumbing', icon: '🫧' },
      { name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿' },
      { name: 'Automobile', category: 'Vehicle', icon: '🚗' },
      { name: 'Boat', category: 'Vehicle', icon: '⛵' },
    ],
  },
  {
    id: 'multi',
    icon: '🏘️',
    label: 'Multi-Property Owner',
    description: "I own multiple properties and need to track each one",
    assets: [
      { name: 'HVAC System', category: 'HVAC', icon: '❄️' },
      { name: 'Water Heater', category: 'Plumbing', icon: '🚿' },
      { name: 'Smoke Detectors', category: 'Safety', icon: '🔥' },
      { name: 'Rental Appliances', category: 'Appliances', icon: '🍳' },
      { name: 'Lawn Mower', category: 'Lawn & Garden', icon: '🌿' },
      { name: 'Automobile', category: 'Vehicle', icon: '🚗' },
      { name: 'Boat', category: 'Vehicle', icon: '⛵' },
    ],
  },
]

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Rental', 'Vacation', 'Other']

export default function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0) // 0=welcome, 1=property, 2=assets, 3=done
  const [persona, setPersona] = useState(null)
  const [property, setProperty] = useState({ name: '', address: '', type: 'Single Family' })
  const [selectedAssets, setSelectedAssets] = useState([])
  const [customAsset, setCustomAsset] = useState('')
  const [customAssets, setCustomAssets] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedPropId, setSavedPropId] = useState(null)

  function selectPersona(p) {
    setPersona(p)
    setSelectedAssets(p.assets.map((_, i) => i)) // select all by default
  }

  function toggleAsset(idx) {
    setSelectedAssets(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  function addCustomAsset() {
    if (!customAsset.trim()) return
    setCustomAssets(prev => [...prev, { name: customAsset.trim(), category: 'Other', icon: '🔧' }])
    setCustomAsset('')
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      // Create property
      const prop = await api.createProperty({
        name: property.name || 'My Home',
        address: property.address || '',
        type: property.type,
        is_default: true,
      })
      setSavedPropId(prop.id)

      // Create selected assets
      const assetsToCreate = [
        ...(persona ? persona.assets.filter((_, i) => selectedAssets.includes(i)) : []),
        ...customAssets,
      ]

      for (const asset of assetsToCreate) {
        await api.createAsset(prop.id, {
          name: asset.name,
          category: asset.category,
          notes: '',
        })
      }

      setStep(3)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Welcome', 'Property', 'Assets', 'Done']
  const allAssets = persona ? [...persona.assets, ...customAssets] : customAssets

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px',
      overflowY: 'auto',
    }}>
      {/* Progress bar */}
      {step < 3 && (
        <div style={{ width: '100%', maxWidth: 560, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {steps.slice(0, 3).map((s, i) => (
              <span key={s} style={{
                fontSize: 12,
                color: i <= step ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: i === step ? 600 : 400,
              }}>{s}</span>
            ))}
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--accent)',
              width: `${(step / 2) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Step 0: Welcome / Persona */}
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
                <button
                  key={p.id}
                  onClick={() => selectPersona(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px', borderRadius: 10,
                    border: `2px solid ${persona?.id === p.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: persona?.id === p.id ? 'rgba(72,199,142,0.08)' : 'var(--surface)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
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
              <button
                className="btn btn-primary"
                onClick={() => setStep(1)}
                disabled={!persona}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Property details */}
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
              <input
                className="form-input"
                placeholder="e.g. Main Home, Lake House"
                value={property.name}
                onChange={e => setProperty(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Address</label>
              <input
                className="form-input"
                placeholder="123 Main St, City, State"
                value={property.address}
                onChange={e => setProperty(p => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label">Property Type</label>
              <select
                className="form-input"
                value={property.type}
                onChange={e => setProperty(p => ({ ...p, type: e.target.value }))}
              >
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!property.name.trim()}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Assets */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              What do you want to track?
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
              We've suggested assets based on your profile. Uncheck anything that doesn't apply.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {persona?.assets.map((asset, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8,
                  border: `1px solid ${selectedAssets.includes(i) ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedAssets.includes(i) ? 'rgba(72,199,142,0.06)' : 'var(--surface)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(i)}
                    onChange={() => toggleAsset(i)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 20 }}>{asset.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{asset.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{asset.category}</div>
                  </div>
                </label>
              ))}
              {customAssets.map((asset, i) => (
                <div key={`custom-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8,
                  border: '1px solid var(--accent)',
                  background: 'rgba(72,199,142,0.06)',
                }}>
                  <span style={{ fontSize: 20 }}>🔧</span>
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{asset.name}</div>
                  <button
                    onClick={() => setCustomAssets(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Add custom asset */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              <input
                className="form-input"
                placeholder="Add a custom asset..."
                value={customAsset}
                onChange={e => setCustomAsset(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomAsset()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-ghost" onClick={addCustomAsset} disabled={!customAsset.trim()}>
                + Add
              </button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={finish}
                disabled={saving}
              >
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
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 12 }}>
              <strong style={{ color: 'var(--text)' }}>{property.name}</strong> has been created with{' '}
              <strong style={{ color: 'var(--accent)' }}>
                {selectedAssets.length + customAssets.length} asset{selectedAssets.length + customAssets.length !== 1 ? 's' : ''}
              </strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 36 }}>
              Start adding maintenance tasks and tracking your home's history.
            </p>
            <button
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: 15 }}
              onClick={() => onComplete(savedPropId)}
            >
              Go to my property →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
