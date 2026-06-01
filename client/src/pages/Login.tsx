import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, setUser } = useAuth();
  const [mode, setMode]       = useState<'login' | 'register'>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const navigate = useNavigate();

  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = mode === 'login'
        ? await api.auth.login(email, password)
        : await api.auth.register(email, password);
      setUser(u);
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-wordmark">overboard</Link>
        <p className="auth-sub">
          {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
            {mode === 'register' && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral)', marginTop: 'var(--space-1)' }}>
                Minimum 8 characters
              </span>
            )}
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button
            className="btn-link"
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
