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
import Dashboard from './views/Dashboard'
import PropertyView from './views/PropertyView'
import PaintView from './views/PaintView'
import ContractorsView from './views/ContractorsView'
import SettingsView from './views/SettingsView'
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

  // Close mobile drawer on outside click
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

  const show = isMobile ? mobileOpen : true

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 40, backdropFilter: 'blur(2px)'
        }} />
      )}

      <nav ref={sidebarRef} className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo + collapse toggle */}
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

        {/* Nav items */}
        <div className="sidebar-section">
          {NAV.map(item => {
            const isActive = view === item.id
            // For Properties, also show overdue badge
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

        {/* Property switcher — only when Properties is active */}


        {/* User footer */}
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
  property: null, // dynamic
  paint: 'Paint Colors',
  contractors: 'Contractors',
  settings: 'Settings',
}

export default function App() {
  const [authed, setAuthed]             = useState(!!getToken())
  const [user, setUser]                 = useState(getUser())
  const [properties, setProperties]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [view, setView]                 = useState('property')
  const [currentPropId, setCurrentPropId] = useState(null)
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [addProperty, setAddProperty]   = useState(false)
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768)

  // Track viewport width
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
      if (def) setCurrentPropId(def.id)
    }).catch(() => {
      clearToken(); setAuthed(false)
    }).finally(() => setLoading(false))
  }, [authed])

  function handleLogin(u) { setUser(u); setAuthed(true) }
  function handleLogout() { clearToken(); setAuthed(false); setUser(null) }

  const [jumpToAssetId, setJumpToAssetId] = useState(null)

  function navigate(v, propId, assetId) {
    setView(v)
    if (propId) setCurrentPropId(propId)
    if (assetId) setJumpToAssetId(assetId)
  }

  if (!authed) return <Login onLogin={handleLogin} />
  if (loading) return <LoadingSpinner />

  const currentProp = properties.find(p => p.id === currentPropId)
  const title = view === 'property' && currentProp ? currentProp.name : VIEW_TITLES[view] || ''

  return (
    <ErrorBoundary>
    <div className="app-shell">
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
          {/* Mobile hamburger */}
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
          {view === 'dashboard'   && <Dashboard onNavigate={navigate} />}
          {view === 'property'    && currentPropId && <PropertyView key={currentPropId} propertyId={currentPropId} properties={properties} onSwitchProperty={setCurrentPropId} onAddProperty={() => setAddProperty(true)} jumpToAssetId={jumpToAssetId} onJumpHandled={() => setJumpToAssetId(null)} />}
          {view === 'paint'       && <PaintView propertyId={currentPropId} properties={properties} />}
          {view === 'contractors' && <ContractorsView />}
          {view === 'settings'    && <SettingsView onLogout={handleLogout} properties={properties} />}
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
