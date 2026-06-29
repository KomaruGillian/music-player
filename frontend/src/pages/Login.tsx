import { useState } from 'react';
import api from '../lib/api';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { username, email, password } : { email, password };
      const { data } = await api.post(endpoint, payload);
      localStorage.setItem('token', data.token);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="login-subtitle">
          {isRegister ? 'Sign up to start listening' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && <p style={{ color: '#ff453a', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <button className="btn-primary btn-full" type="submit">
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="login-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            style={{ cursor: 'pointer', color: '#ff2d55', fontWeight: 600 }}
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
}
