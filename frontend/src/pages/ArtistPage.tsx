import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';

interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  bio?: string;
  genre?: string;
  albums: any[];
  tracks: any[];
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const { setQueue, fetchAndPlay, setRadio } = usePlayerStore();

  useEffect(() => {
    if (id) api.get(`/artists/${id}`).then((r) => setArtist(r.data));
  }, [id]);

  const playAll = () => {
    if (!artist || artist.tracks.length === 0) return;
    setQueue(artist.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: artist.name,
      coverUrl: t.coverUrl || artist.imageUrl || null,
      duration: t.duration || 0,
    })));
    const first = artist.tracks[0];
    fetchAndPlay({
      id: first.id,
      title: first.title,
      artist: artist.name,
      coverUrl: first.coverUrl || artist.imageUrl || null,
      duration: first.duration || 0,
    });
  };

  const playArtistRadio = async () => {
    if (!id) return;
    const { data } = await api.get(`/radio/artist/${id}`);
    setQueue(data.tracks.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artistName || artist?.name || '',
      coverUrl: t.coverUrl || null,
      duration: t.duration || 0,
    })));
    if (data.tracks.length > 0) {
      const first = data.tracks[0];
      fetchAndPlay({
        id: first.id,
        title: first.title,
        artist: first.artistName || artist?.name || '',
        coverUrl: first.coverUrl || null,
        duration: first.duration || 0,
      });
    }
    setRadio(data.seed || "");
  };

  if (!artist) return <div style={{ color: '#8e8e93', textAlign: 'center', padding: '3rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', marginBottom: '2rem' }}>
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt={artist.name} style={{ width: 160, height: 160, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 160, height: 160, borderRadius: '50%', background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', flexShrink: 0 }}>👤</div>
        )}
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>{artist.name}</h1>
          {artist.genre && <p style={{ color: '#8e8e93', fontSize: '1rem', marginTop: '0.25rem' }}>{artist.genre}</p>}
          {artist.bio && <p style={{ color: '#aeaeb2', fontSize: '0.9375rem', marginTop: '0.5rem', maxWidth: 480 }}>{artist.bio}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={playAll}>Play All</button>
            <button className="btn-primary" onClick={playArtistRadio} style={{ background: '#bf5af2' }}>Artist Radio</button>
          </div>
        </div>
      </div>

      {artist.albums.length > 0 && (
        <section>
          <h2 className="section-title">Albums</h2>
          <div className="card-grid">
            {artist.albums.map((album) => (
              <div
                className="card"
                key={album.id}
                onClick={() => window.location.href = `/album/${album.id}`}
                style={{ cursor: 'pointer' }}
              >
                {album.coverUrl ? (
                  <img className="card-cover" src={album.coverUrl} alt={album.title} />
                ) : (
                  <div className="card-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💿</div>
                )}
                <div className="card-title">{album.title}</div>
                <div className="card-subtitle">{album.type || 'Album'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {artist.tracks.length > 0 && (
        <section>
          <h2 className="section-title">Tracks</h2>
          {artist.tracks.map((track) => (
            <div className="track-row" key={track.id} onClick={() => {
              setQueue(artist.tracks.map((t) => ({
                id: t.id, title: t.title, artist: artist.name, coverUrl: t.coverUrl || null, duration: t.duration || 0,
              })));
              fetchAndPlay({
                id: track.id, title: track.title, artist: artist.name, coverUrl: track.coverUrl || null, duration: track.duration || 0,
              });
            }} style={{ cursor: 'pointer' }}>
              {track.coverUrl ? (
                <img className="track-row-cover" src={track.coverUrl} alt="" />
              ) : (
                <div className="track-row-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♪</div>
              )}
              <div className="track-row-info">
                <div className="track-row-title">{track.title}</div>
                <div className="track-row-artist">{artist.name}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
