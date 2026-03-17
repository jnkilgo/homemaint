import { useState } from 'react'
import { api } from '../api'

export default function ForgotPassword({ onSwitchToLogin }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong')
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
            Reset your password
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {submitted ? (
              <div>
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  If that email is registered, a reset link has been sent. Check your inbox.
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={onSwitchToLogin}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                {error && <div className="alert alert-error">{error}</div>}
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: 0 }}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" value={email} autoFocus autoComplete="email"
                      onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <button className="btn-link" onClick={onSwitchToLogin}>Back to sign in</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
