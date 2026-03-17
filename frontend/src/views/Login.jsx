import { useState } from 'react'
import { api, setToken, setUser } from '../api'

export default function Login({ onLogin, onRegister, onForgot }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(username, password)
      setToken(data.access_token)
      setUser(data.user)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '4px' }}>
            HomeMaint
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Property maintenance tracker
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text" value={username} autoFocus autoComplete="username"
                  onChange={e => setUsername(e.target.value)} required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password" value={password} autoComplete="current-password"
                  onChange={e => setPassword(e.target.value)} required
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '12px' }}>
                <button type="button" className="btn-link" style={{ fontSize: '12px' }} onClick={onForgot}>
                  Forgot password?
                </button>
              </div>
              <button
                type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button className="btn-link" onClick={onRegister}>Create one</button>
        </div>
      </div>
    </div>
  )
}
