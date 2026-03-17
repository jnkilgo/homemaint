import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ResetPassword({ onSwitchToLogin }) {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Extract token from URL: /reset-password?token=xxx
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (t) setToken(t)
    else setError('Invalid or missing reset token. Please request a new reset link.')
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.')
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
            Set a new password
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {success ? (
              <div>
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  Password reset successfully. You can now sign in with your new password.
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={onSwitchToLogin}>
                  Sign in
                </button>
              </div>
            ) : (
              <>
                {error && <div className="alert alert-error">{error}</div>}
                {token && (
                  <form onSubmit={submit}>
                    <div className="form-group">
                      <label className="form-label">New password</label>
                      <input type="password" value={password} autoFocus autoComplete="new-password"
                        onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm password</label>
                      <input type="password" value={confirm} autoComplete="new-password"
                        onChange={e => setConfirm(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}
                      style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
                      {loading ? 'Saving…' : 'Set new password'}
                    </button>
                  </form>
                )}
                {!token && (
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={onSwitchToLogin}>
                    Back to sign in
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
