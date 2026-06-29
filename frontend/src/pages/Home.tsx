import { useState, useEffect } from 'react';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';
import TrackMenu from '../components/TrackMenu';

interface Track {
  id: string;
  title: string;
  artistName?: string;
  artistId?: string;
  coverUrl?: string;
  duration?: number;
}

interface Friend {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

export default function Home() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Track[]>([]);
  const [recommended, setRecommended] = useState<Track[]>([]);
  const { setQueue, fetchAndPlay } = usePlayerStore();

  useEffect(() => {
    api.get('/friends').then((r) => setFriends(r.data)).catch(() => {});
    api.get('/friends/online').then((r) => setOnlineIds(new Set(r.data.map((f: Friend) => f.id)))).catch(() => {});
    api.get('/tracks/history?limit=10').then((r) => setHistory(r.data)).catch(() => {});
    api.get('/tracks/recommended').then((r) => setRecommended(r.data)).catch(() => {});
  }, []);

  const playTrack = (track: Track, list: Track[]) => {
    setQueue(list.map((t) => ({
      id: t.id,
      title: t.title,
      coverUrl: t.coverUrl || null,
      duration: t.duration || 0,
      artist: t.artistName || 'Unknown',
    })));
    fetchAndPlay({
      id: track.id,
      title: track.title,
      coverUrl: track.coverUrl || null,
      duration: track.duration || 0,
      artist: track.artistName || 'Unknown',
    });
  };

  const trackCover = (t: Track) => t.coverUrl || `https://picsum.photos/seed/${t.id}/200/200`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Главная</h1>
      </div>

      {friends.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-title">Друзья</h2>
          <div className="friends-list">
            {friends.map((f) => (
              <div className="friend-item" key={f.id}>
                <div className="friend-avatar">{(f.displayName || f.username)[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.displayName || f.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{f.username}</div>
                </div>
                {onlineIds.has(f.id) && <div className="online-dot" />}
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-title">Последнее проигранное</h2>
          {history.map((track) => (
            <div className="track-row" key={track.id} onClick={() => playTrack(track, history)} style={{ cursor: 'pointer' }}>
              <img className="track-row-cover" src={trackCover(track)} alt="" />
              <div className="track-row-info">
                <div className="track-row-title">{track.title}</div>
                <div className="track-row-artist">{track.artistName || 'Unknown'}</div>
              </div>
              <TrackMenu trackId={track.id} />
            </div>
          ))}
        </section>
      )}

      {recommended.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-title">Рекомендуем</h2>
          <div className="card-grid">
            {recommended.map((track) => (
              <div className="card" key={track.id} onClick={() => playTrack(track, recommended)} style={{ cursor: 'pointer' }}>
                <img className="card-cover" src={trackCover(track)} alt={track.title} />
                <div className="card-title">{track.title}</div>
                <div className="card-subtitle">{track.artistName || 'Unknown'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {friends.length === 0 && history.length === 0 && recommended.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.125rem' }}>Привет!</p>
          <p style={{ marginTop: '0.5rem' }}>Послушайте музыку — и она появится здесь.</p>
        </div>
      )}
    </div>
  );
}
