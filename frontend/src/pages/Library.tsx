import { useState, useEffect } from 'react';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';
import TrackMenu from '../components/TrackMenu';

interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  tracks?: any[];
}

export default function Library() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedTracks, setLikedTracks] = useState<any[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [showLiked, setShowLiked] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const { setQueue, fetchAndPlay } = usePlayerStore();

  const fetchPlaylists = () => {
    api.get('/playlists').then((r) => setPlaylists(r.data)).catch(() => {});
  };

  const fetchLiked = () => {
    api.get('/tracks/liked').then((r) => setLikedTracks(r.data)).catch(() => {});
  };

  useEffect(() => { fetchPlaylists(); fetchLiked(); }, []);

  const openPlaylist = async (p: Playlist) => {
    const { data } = await api.get(`/playlists/${p.id}`);
    setSelected({ ...p, tracks: data.tracks || data });
  };

  const toPlayerTrack = (t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artistName || 'Unknown',
    coverUrl: t.coverUrl || null,
    duration: t.duration || 0,
  });

  const playTrack = (track: any, tracksList: any[]) => {
    setQueue(tracksList.map(toPlayerTrack));
    fetchAndPlay(toPlayerTrack(track));
  };

  const toggleLike = async (trackId: string) => {
    try {
      if (likedIds.has(trackId)) {
        await api.delete(`/tracks/${trackId}/like`);
        setLikedIds((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
      } else {
        await api.post(`/tracks/${trackId}/like`);
        setLikedIds((prev) => new Set(prev).add(trackId));
      }
      fetchLiked();
    } catch {}
  };

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    await api.post('/playlists', { name: newName });
    setNewName('');
    setCreating(false);
    fetchPlaylists();
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`);
    if (selected) openPlaylist(selected);
  };

  const searchToAdd = async (q: string) => {
    if (!q.trim() || q.length < 2) { setAddResults([]); return; }
    setAddSearching(true);
    try {
      const { data } = await api.get('/search', { params: { q } });
      setAddResults(data.tracks || []);
    } catch { setAddResults([]); }
    setAddSearching(false);
  };

  const addTrackToPlaylist = async (trackId: string) => {
    if (!selected) return;
    await api.post(`/playlists/${selected.id}/tracks`, { trackId });
    openPlaylist(selected);
    setAddResults([]);
    setAddSearch('');
  };

  const trackCover = (t: any) => t.coverUrl || `https://picsum.photos/seed/${t.id}/96/96`;

  const renderTrackList = (tracksList: any[], context: 'liked' | 'playlist') => (
    <>
      {tracksList.length > 0 && (
        <button className="btn-primary" onClick={() => playTrack(tracksList[0], tracksList)} style={{ marginBottom: '1.5rem' }}>
          Play All
        </button>
      )}
      {tracksList.map((track) => {
        const t = track.track || track;
        return (
          <div className="track-row" key={t.id}>
            <img className="track-row-cover" src={trackCover(t)} alt="" />
            <div className="track-row-info" onClick={() => playTrack(t, tracksList)} style={{ cursor: 'pointer', flex: 1 }}>
              <div className="track-row-title">{t.title}</div>
              <div className="track-row-artist">{t.artistName || 'Unknown'}</div>
            </div>
            <button
              onClick={() => toggleLike(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: likedIds.has(t.id) ? '#ff2d55' : '#8e8e93', padding: '0 0.5rem' }}
            >
              {likedIds.has(t.id) ? '♥' : '♡'}
            </button>
            {context === 'playlist' && (
              <button
                onClick={() => removeTrackFromPlaylist(selected!.id, t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#8e8e93', padding: '0 0.5rem' }}
              >
                ✕
              </button>
            )}
            <TrackMenu trackId={t.id} />
          </div>
        );
      })}
    </>
  );

  if (showLiked) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Понравилось</h1>
          <button className="btn-primary" onClick={() => setShowLiked(false)} style={{ padding: '0.5rem 1.25rem' }}>
            Назад
          </button>
        </div>
        {likedTracks.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Нет лайкнутых треков</p>
        ) : renderTrackList(likedTracks, 'liked')}
      </div>
    );
  }

  if (selected) {
    const tracksList = (selected.tracks || []).map((t: any) => t.track || t);
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{selected.name}</h1>
          <button className="btn-primary" onClick={() => { setSelected(null); setAddResults([]); setAddSearch(''); }} style={{ padding: '0.5rem 1.25rem' }}>
            Назад
          </button>
        </div>

        {renderTrackList(tracksList, 'playlist')}

        <section style={{ marginTop: '2rem' }}>
          <h2 className="section-title">Добавить трек</h2>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              className="form-input"
              type="text"
              placeholder="Поиск треков..."
              value={addSearch}
              onChange={(e) => { setAddSearch(e.target.value); searchToAdd(e.target.value); }}
              style={{ flex: 1 }}
            />
          </div>
          {addSearching && <p style={{ color: 'var(--text-secondary)' }}>Поиск...</p>}
          {addResults.map((track) => (
            <div className="track-row" key={track.id}>
              <img className="track-row-cover" src={trackCover(track)} alt="" />
              <div className="track-row-info">
                <div className="track-row-title">{track.title}</div>
                <div className="track-row-artist">{track.artistName || 'Unknown'}</div>
              </div>
              <button className="btn-primary" onClick={() => addTrackToPlaylist(track.id)} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
                +
              </button>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Библиотека</h1>
        <button className="btn-primary" onClick={() => setCreating(true)} style={{ padding: '0.5rem 1.25rem' }}>
          + Плейлист
        </button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <input
            className="form-input"
            type="text"
            placeholder="Название плейлиста"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
          />
          <button className="btn-primary" onClick={createPlaylist}>Создать</button>
          <button className="btn-primary" onClick={() => { setCreating(false); setNewName(''); }} style={{ background: '#3a3a3c' }}>Отмена</button>
        </div>
      )}

      <div className="card-grid">
        <div className="card" onClick={() => setShowLiked(true)} style={{ cursor: 'pointer' }}>
          <div className="card-cover" style={{ background: 'linear-gradient(135deg, #fc3c44, #ff6b6b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
            ♥
          </div>
          <div className="card-title">Понравилось</div>
          <div className="card-subtitle">{likedTracks.length} треков</div>
        </div>

        {playlists.map((p) => (
          <div className="card" key={p.id} onClick={() => openPlaylist(p)} style={{ cursor: 'pointer' }}>
            {p.coverUrl ? (
              <img className="card-cover" src={p.coverUrl} alt={p.name} />
            ) : (
              <div className="card-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🎵</div>
            )}
            <div className="card-title">{p.name}</div>
            <div className="card-subtitle">Плейлист</div>
          </div>
        ))}
      </div>
    </div>
  );
}
