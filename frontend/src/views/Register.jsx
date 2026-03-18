import { useState } from 'react'
import { api } from '../api'


export default function Register({ onSwitchToLogin }) {
  const [form, setForm] = useState({ username: '', email: '', display_name: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.register({
        username: form.username,
        email: form.email,
        display_name: form.display_name,
        password: form.password,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Registration failed')
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
            Create your account
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {success ? (
              <div>
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  Account created! You can now sign in.
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={onSwitchToLogin}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                {error && <div className="alert alert-error">{error}</div>}
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input type="text" value={form.username} autoFocus autoComplete="username"
                      onChange={set('username')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                    <input type="email" value={form.email} autoComplete="email"
                      onChange={set('email')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display name</label>
                    <input type="text" value={form.display_name} autoComplete="name"
                      onChange={set('display_name')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input type="password" value={form.password} autoComplete="new-password"
                      onChange={set('password')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm password</label>
                    <input type="password" value={form.confirm} autoComplete="new-password"
                      onChange={set('confirm')} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Already have an account?{' '}
                  <button className="btn-link" onClick={onSwitchToLogin}>Sign in</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
