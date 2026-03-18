import React, { useState, useEffect, useRef } from 'react'
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', color: '#f87171', background: '#0e0e0e', minHeight: '100vh' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>⚠ App Error</div>
          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#ccc' }}>
            {this.state.error.toString()}
            {this.state.error.stack}
          </pre>
          <button onClick={() => { localStorage.clear(); window.location.reload() }}
            style={{ marginTop: '20px', padding: '8px 16px', background: '#1a6b3c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Clear storage &amp; reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import { api, getToken, getUser, clearToken } from './api'
import Login from './views/Login'
import Register from './views/Register'
import ForgotPassword from './views/ForgotPassword'
import ResetPassword from './views/ResetPassword'
import Dashboard from './views/Dashboard'
import PropertyView from './views/PropertyView'
import PaintView from './views/PaintView'
import ContractorsView from './views/ContractorsView'
import SettingsView from './views/SettingsView'
import OnboardingWizard from './views/OnboardingWizard'
import { LoadingSpinner } from './components/shared'
import { PropertyModal } from './components/ManageModals'

const NAV = [
  { id: 'dashboard',   icon: '⬛', label: 'Dashboard' },
  { id: 'property',    icon: '🏠', label: 'Properties' },
  { id: 'paint',       icon: '🎨', label: 'Paint' },
  { id: 'contractors', icon: '👷', label: 'Contractors' },
  { id: 'settings',    icon: '⚙',  label: 'Settings' },
]

function Sidebar({ collapsed, setCollapsed, view, setView, properties, currentPropId, setCurrentPropId, user, isMobile, mobileOpen, setMobileOpen }) {
  const sidebarRef = useRef(null)

  useEffect(() => {
    if (!isMobile || !mobileOpen) return
    function handle(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isMobile, mobileOpen, setMobileOpen])

  function navTo(id) {
    setView(id)
    if (isMobile) setMobileOpen(false)
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 40, backdropFilter: 'blur(2px)'
        }} />
      )}

      <nav ref={sidebarRef} className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          {(!collapsed || isMobile) && (
            <div>
              <div className="sidebar-logo-title">HomeMaint</div>
              <div className="sidebar-logo-sub">Property tracker</div>
            </div>
          )}
          {!isMobile && (
            <button className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? '›' : '‹'}
            </button>
          )}
          {isMobile && (
            <button className="sidebar-collapse-btn" onClick={() => setMobileOpen(false)}>✕</button>
          )}
        </div>

        <div className="sidebar-section">
          {NAV.map(item => {
            const isActive = view === item.id
            const overdueTotal = item.id === 'property'
              ? properties.reduce((sum, p) => sum + (p.overdue_count || 0), 0)
              : 0

            return (
              <button
                key={item.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => navTo(item.id)}
                title={collapsed && !isMobile ? item.label : undefined}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                {(!collapsed || isMobile) && (
                  <>
                    <span className="sidebar-item-label">{item.label}</span>
                    {overdueTotal > 0 && (
                      <span className="sidebar-badge">{overdueTotal}</span>
                    )}
                  </>
                )}
                {collapsed && !isMobile && overdueTotal > 0 && (
                  <span className="sidebar-badge-dot" />
                )}
              </button>
            )
          })}
        </div>

        {(!collapsed || isMobile) && (
          <div className="sidebar-footer">
            <span>{user?.display_name}</span>
          </div>
        )}
      </nav>
    </>
  )
}

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  property: null,
  paint: 'Paint Colors',
  contractors: 'Contractors',
  settings: 'Settings',
}

function getInitialAuthView() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('token') && window.location.pathname.includes('reset')) return 'reset'
  return 'login'
}

export default function App() {
  const [authed, setAuthed]             = useState(!!getToken())
  const [user, setUser]                 = useState(getUser())
  const [authView, setAuthView]         = useState(getInitialAuthView)
  const [properties, setProperties]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [view, setView]                 = useState('property')
  const [currentPropId, setCurrentPropId] = useState(null)
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [addProperty, setAddProperty]   = useState(false)
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!authed) { setLoading(false); return }
    api.getProperties().then(props => {
      setProperties(props)
      const def = props.find(p => p.is_default) || props[0]
      if (def) {
        setCurrentPropId(def.id)
      } else {
        // No properties — show onboarding
        setShowOnboarding(true)
      }
    }).catch(() => {
      clearToken(); setAuthed(false)
    }).finally(() => setLoading(false))
  }, [authed])

  function handleLogin(u) { setUser(u); setAuthed(true) }
  function handleLogout() { clearToken(); setAuthed(false); setUser(null) }

  const [jumpToAssetId, setJumpToAssetId] = useState(null)
  const [usageReminders, setUsageReminders] = useState([])
  const [showReminderPopup, setShowReminderPopup] = useState(false)

  useEffect(() => {
    if (!authed) return
    const checked = sessionStorage.getItem('usage_reminders_checked')
    if (checked) return
    sessionStorage.setItem('usage_reminders_checked', '1')
    api.getUsageRemindersDue().then(due => {
      if (due.length > 0) {
        setUsageReminders(due)
        setShowReminderPopup(true)
      }
    }).catch(() => {})
  }, [authed])

  function navigate(v, propId, assetId) {
    setView(v)
    if (propId) setCurrentPropId(propId)
    if (assetId) setJumpToAssetId(assetId)
  }

  function handleOnboardingComplete(newPropId) {
    setShowOnboarding(false)
    api.getProperties().then(props => {
      setProperties(props)
      setCurrentPropId(newPropId)
      setView('property')
    })
  }

  function handleOnboardingSkip() {
    setShowOnboarding(false)
    setView('dashboard')
  }

  // ── Unauthenticated screens ──────────────────────────────────────────────────
  if (!authed) {
    if (authView === 'register') return <Register onSwitchToLogin={() => setAuthView('login')} />
    if (authView === 'forgot')   return <ForgotPassword onSwitchToLogin={() => setAuthView('login')} />
    if (authView === 'reset')    return <ResetPassword onSwitchToLogin={() => setAuthView('login')} />
    return <Login onLogin={handleLogin} onRegister={() => setAuthView('register')} onForgot={() => setAuthView('forgot')} />
  }

  if (loading) return <LoadingSpinner />

  // ── Onboarding wizard ────────────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    )
  }

  const currentProp = properties.find(p => p.id === currentPropId)
  const title = view === 'property' && currentProp ? currentProp.name : VIEW_TITLES[view] || ''

  return (
    <ErrorBoundary>
    <div className="app-shell">
      {showReminderPopup && (
        <div className="modal-overlay" onClick={() => setShowReminderPopup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">⏱ Usage Log Reminders</h3>
              <button className="modal-close" onClick={() => setShowReminderPopup(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                The following assets haven't had usage logged recently:
              </p>
              {usageReminders.map(r => (
                <div key={r.asset_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{r.asset_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {r.property_name} · {r.days_since} days since last log · {r.current_value?.toLocaleString()} {r.tracks}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setShowReminderPopup(false)
                      navigate('property', properties.find(p => p.name === r.property_name)?.id, r.asset_id)
                    }}
                  >
                    Log now →
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReminderPopup(false)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        view={view} setView={setView}
        properties={properties}
        currentPropId={currentPropId} setCurrentPropId={setCurrentPropId}
        user={user}
        isMobile={isMobile}
        mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
      />

      <div className="main">
        <div className="topbar">
          {isMobile && (
            <button className="topbar-hamburger" onClick={() => setMobileOpen(true)}>
              <span /><span /><span />
            </button>
          )}
          <span className="topbar-title">{title}</span>
          {!isMobile && (
            <div className="topbar-actions">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {user?.display_name}
              </span>
            </div>
          )}
        </div>

        <div className="content">
          {view === 'dashboard'   && (
            <Dashboard
              onNavigate={navigate}
              hasNoProperties={properties.length === 0}
              onStartOnboarding={() => setShowOnboarding(true)}
              onAddProperty={() => setAddProperty(true)}
            />
          )}
          {view === 'property'    && currentPropId && <PropertyView key={currentPropId} propertyId={currentPropId} properties={properties} onSwitchProperty={setCurrentPropId} onAddProperty={() => setAddProperty(true)} jumpToAssetId={jumpToAssetId} onJumpHandled={() => setJumpToAssetId(null)} onReloadProperties={() => api.getProperties().then(p => { setProperties(p); return p })} />}
          {view === 'property'    && !currentPropId && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
              <div style={{ fontSize: 48 }}>🏠</div>
              <h2 style={{ color: 'var(--text)', margin: 0 }}>No property selected</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add your first property to get started</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setShowOnboarding(true)}>Setup Wizard</button>
                <button className="btn btn-primary" onClick={() => setAddProperty(true)}>+ Add Property</button>
              </div>
            </div>
          )}
          {view === 'paint'       && <PaintView propertyId={currentPropId} properties={properties} />}
          {view === 'contractors' && <ContractorsView />}
          {view === 'settings'    && <SettingsView onLogout={handleLogout} properties={properties} onStartOnboarding={() => setShowOnboarding(true)} />}
        </div>
      </div>

      {addProperty && (
        <PropertyModal
          onClose={() => setAddProperty(false)}
          onSaved={(newProp) => {
            setAddProperty(false)
            api.getProperties().then(props => {
              setProperties(props)
              setCurrentPropId(newProp.id)
              setView('property')
            })
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
