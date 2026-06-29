import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';

interface Album {
  id: string;
  title: string;
  coverUrl?: string;
  artistName?: string;
  artistId?: string;
  type?: string;
  releaseDate?: string;
  tracks: any[];
}

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const { setQueue, fetchAndPlay } = usePlayerStore();

  useEffect(() => {
    if (id) api.get(`/albums/${id}`).then((r) => setAlbum(r.data));
  }, [id]);

  const playAll = () => {
    if (!album || album.tracks.length === 0) return;
    setQueue(album.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artistName || album.artistName || '',
      coverUrl: t.coverUrl || album.coverUrl || null,
      duration: t.duration || 0,
    })));
    const first = album.tracks[0];
    fetchAndPlay({
      id: first.id,
      title: first.title,
      artist: first.artistName || album.artistName || '',
      coverUrl: first.coverUrl || album.coverUrl || null,
      duration: first.duration || 0,
    });
  };

  if (!album) return <div style={{ color: '#8e8e93', textAlign: 'center', padding: '3rem' }}>Loading...</div>;

  const totalDuration = album.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', marginBottom: '2rem' }}>
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} style={{ width: 200, height: 200, borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 200, height: 200, borderRadius: '0.75rem', background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', flexShrink: 0 }}>💿</div>
        )}
        <div>
          <p style={{ color: '#8e8e93', fontSize: '0.8125rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', margin: 0 }}>
            {album.type || 'Album'}
          </p>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.25rem 0' }}>{album.title}</h1>
          <p
            style={{ color: '#ff2d55', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}
            onClick={() => album.artistId && navigate(`/artist/${album.artistId}`)}
          >
            {album.artistName || 'Unknown'}
          </p>
          <p style={{ color: '#8e8e93', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {album.releaseDate ? new Date(album.releaseDate).getFullYear() : ''} · {album.tracks.length} tracks · {formatDuration(totalDuration)}
          </p>
          <button className="btn-primary" onClick={playAll} style={{ marginTop: '1rem' }}>Play All</button>
        </div>
      </div>

      <section>
        {album.tracks.map((track, i) => (
          <div className="track-row" key={track.id} onClick={() => {
            setQueue(album.tracks.map((t) => ({
              id: t.id, title: t.title, artist: t.artistName || album.artistName || '', coverUrl: t.coverUrl || album.coverUrl || null, duration: t.duration || 0,
            })));
            fetchAndPlay({
              id: track.id, title: track.title, artist: track.artistName || album.artistName || '', coverUrl: track.coverUrl || album.coverUrl || null, duration: track.duration || 0,
            });
          }} style={{ cursor: 'pointer' }}>
            <span style={{ color: '#8e8e93', fontSize: '0.875rem', minWidth: '1.5rem', textAlign: 'right' }}>{i + 1}</span>
            {track.coverUrl ? (
              <img className="track-row-cover" src={track.coverUrl} alt="" />
            ) : (
              <div className="track-row-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♪</div>
            )}
            <div className="track-row-info">
              <div className="track-row-title">{track.title}</div>
              <div className="track-row-artist">{track.artistName || album.artistName || 'Unknown'}</div>
            </div>
            <span style={{ color: '#8e8e93', fontSize: '0.875rem', marginLeft: 'auto' }}>
              {track.duration ? formatDuration(track.duration) : '--:--'}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
