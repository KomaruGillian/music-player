import { useState, useEffect } from 'react';
import api from '../lib/api';
import { themeStore, getThemeCSS } from '../store/themeStore';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  avatar?: string;
}

interface Friend extends User {
  online?: boolean;
  avatar?: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Friend[]>([]);
  const [sub, setSub] = useState<{ premium: boolean; type?: string; expiresAt?: string } | null>(null);
  const [addId, setAddId] = useState('');
  const [addError, setAddError] = useState('');
  const [themePreset, setThemePreset] = useState<'light' | 'dark' | 'custom'>(themeStore.preset);
  const [accentColor, setAccentColor] = useState(themeStore.accentColor || '#fc3c44');
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data));
    api.get('/friends').then((r) => setFriends(r.data));
    api.get('/friends/online').then((r) => setOnlineFriends(r.data));
    api.get('/friends/pending').then((r) => setPending(r.data));
    api.get('/subscriptions/status').then((r) => setSub(r.data));
  }, []);

  const addFriend = async () => {
    if (!addId.trim()) return;
    setAddError('');
    try {
      await api.post(`/friends/add/${addId.trim()}`);
      setAddId('');
      api.get('/friends/pending').then((r) => setPending(r.data));
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Не удалось добавить');
    }
  };

  const acceptFriend = async (userId: string) => {
    await api.post(`/friends/accept/${userId}`);
    api.get('/friends').then((r) => setFriends(r.data));
    api.get('/friends/pending').then((r) => setPending(r.data));
    api.get('/friends/online').then((r) => setOnlineFriends(r.data));
  };

  const removeFriend = async (userId: string) => {
    await api.delete(`/friends/${userId}`);
    setFriends((prev) => prev.filter((f) => f.id !== userId));
  };

  const activateSub = async () => {
    await api.post('/subscriptions/activate');
    api.get('/subscriptions/status').then((r) => setSub(r.data));
  };

  const getAvatar = (f: any) => f.avatarUrl || f.avatar || '';

  const saveTheme = async () => {
    setThemeSaving(true);
    try {
      const payload: any = { themePreset };
      if (themePreset === 'custom') {
        payload.accentColor = accentColor;
      }
      await api.patch('/users/me/theme', payload);

      const newTheme: any = { preset: themePreset };
      if (themePreset === 'custom') {
        newTheme.accentColor = accentColor;
      } else {
        newTheme.accentColor = null;
        newTheme.bgColor = null;
        newTheme.cardColor = null;
        newTheme.textColor = null;
      }
      themeStore.setTheme(newTheme);

      const css = getThemeCSS();
      for (const [k, v] of Object.entries(css)) {
        document.documentElement.style.setProperty(k, v);
      }
      document.body.className = themeStore.preset === 'light' ? 'light' : '';
    } catch {}
    setThemeSaving(false);
  };

  const handlePresetChange = (preset: 'light' | 'dark' | 'custom') => {
    if (preset === 'custom' && !sub?.premium) return;
    setThemePreset(preset);
  };

  if (!user) return <div style={{ color: '#8e8e93', textAlign: 'center', padding: '3rem' }}>Загрузка...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Профиль</h1>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {user.avatar ? (
          <img src={user.avatar} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', marginBottom: '0.75rem' }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#2c2c2e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '0.75rem' }}>👤</div>
        )}
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {user.username}{sub?.premium && <span className="premium-badge" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>✦</span>}
        </h2>
        <p className="user-id-display">ID: {user.id}</p>
        <p style={{ color: '#8e8e93', fontSize: '0.875rem' }}>{user.email}</p>
      </div>

      <section>
        <h2 className="section-title">Подписка</h2>
        {sub?.premium ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span className="premium-badge">Premium</span>
            <span style={{ color: '#8e8e93', fontSize: '0.875rem' }}>{sub?.type || 'Premium'}</span>
          </div>
        ) : (
          <button className="btn-primary" onClick={activateSub} style={{ marginBottom: '1rem' }}>
            Активировать Premium
          </button>
        )}
      </section>

      <section>
        <h2 className="section-title">Тема</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn-primary"
              onClick={() => handlePresetChange('dark')}
              style={{
                flex: 1, fontSize: '0.8125rem', padding: '0.625rem',
                background: themePreset === 'dark' ? 'var(--accent)' : '#3a3a3c',
              }}
            >
              Тёмная
            </button>
            <button
              className="btn-primary"
              onClick={() => handlePresetChange('light')}
              style={{
                flex: 1, fontSize: '0.8125rem', padding: '0.625rem',
                background: themePreset === 'light' ? 'var(--accent)' : '#3a3a3c',
              }}
            >
              Светлая
            </button>
            {sub?.premium && (
              <button
                className="btn-primary"
                onClick={() => handlePresetChange('custom')}
                style={{
                  flex: 1, fontSize: '0.8125rem', padding: '0.625rem',
                  background: themePreset === 'custom' ? 'var(--accent)' : '#3a3a3c',
                }}
              >
                Своя ✦
              </button>
            )}
          </div>
          {themePreset === 'custom' && sub?.premium && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="form-label" style={{ marginBottom: 0, minWidth: 100 }}>Акцент</span>
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </label>
          )}
          <button className="btn-primary" onClick={saveTheme} disabled={themeSaving} style={{ alignSelf: 'flex-start' }}>
            {themeSaving ? '...' : 'Сохранить тему'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Друзья</h2>
      <div className="add-friend-form" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            className="form-input"
            type="text"
            placeholder="ID пользователя"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFriend()}
          />
          <button className="btn-primary" onClick={addFriend}>Добавить</button>
        </div>
        {addError && <p style={{ color: '#ff453a', fontSize: '0.8125rem' }}>{addError}</p>}
      </div>

        <div className="friends-list">
          {onlineFriends.map((f) => (
            <div className="friend-item" key={f.id}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {getAvatar(f) ? (
                  <img className="friend-avatar" src={getAvatar(f)} alt="" />
                ) : (
                  <div className="friend-avatar" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                )}
                <span className="online-dot" />
              </div>
              <span style={{ fontWeight: 600, flex: 1 }}>{f.username}</span>
              <button onClick={() => removeFriend(f.id)} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '0.875rem' }}>Удалить</button>
            </div>
          ))}
          {friends.filter((f) => !onlineFriends.find((o) => o.id === f.id)).map((f) => (
            <div className="friend-item" key={f.id}>
              {getAvatar(f) ? (
                <img className="friend-avatar" src={getAvatar(f)} alt="" />
              ) : (
                <div className="friend-avatar" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
              )}
              <span style={{ fontWeight: 600, flex: 1, color: '#8e8e93' }}>{f.username}</span>
              <button onClick={() => removeFriend(f.id)} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '0.875rem' }}>Удалить</button>
            </div>
          ))}
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="section-title">Ожидающие запросы</h2>
          <div className="friends-list">
            {pending.map((f) => (
              <div className="friend-item" key={f.id}>
      {getAvatar(f) ? (
                <img className="friend-avatar" src={getAvatar(f)} alt="" />
              ) : (
                <div className="friend-avatar" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
              )}
              <span style={{ fontWeight: 600, flex: 1 }}>{f.username}</span>
                <button className="btn-primary" onClick={() => acceptFriend(f.id)} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}>Принять</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
