import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';
import TrackMenu from '../components/TrackMenu';

interface SearchResult {
  tracks: any[];
  artists: any[];
  albums: any[];
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setQueue, fetchAndPlay } = usePlayerStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q } });
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const playTrack = (track: any, tracksList: any[]) => {
    setQueue(tracksList.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artistName || 'Unknown',
      coverUrl: t.coverUrl || null,
      duration: t.duration || 0,
    })));
    fetchAndPlay({
      id: track.id,
      title: track.title,
      artist: track.artistName || 'Unknown',
      coverUrl: track.coverUrl || null,
      duration: track.duration || 0,
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Search</h1>
      </div>

      <div className="form-group">
        <input
          className="form-input"
          type="text"
          placeholder="Search songs, artists, albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ fontSize: '1.125rem', padding: '0.875rem 1rem' }}
        />
      </div>

      {loading && <p style={{ color: '#8e8e93', marginTop: '1rem' }}>Searching...</p>}

      {results && (
        <>
          {results.tracks.length > 0 && (
            <section>
              <h2 className="section-title">Songs</h2>
              {results.tracks.map((track) => (
                <div className="track-row" key={track.id} onClick={() => playTrack(track, results.tracks)} style={{ cursor: 'pointer' }}>
                  {track.coverUrl ? (
                    <img className="track-row-cover" src={track.coverUrl} alt="" />
                  ) : (
                    <div className="track-row-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♪</div>
                  )}
                  <div className="track-row-info">
                    <div className="track-row-title">{track.title}</div>
                    <div className="track-row-artist">{track.artistName || 'Unknown'}</div>
                  </div>
                  <TrackMenu trackId={track.id} />
                </div>
              ))}
            </section>
          )}

          {results.artists.length > 0 && (
            <section>
              <h2 className="section-title">Artists</h2>
              <div className="card-grid">
                {results.artists.map((artist) => (
                  <div className="card" key={artist.id} onClick={() => navigate(`/artist/${artist.id}`)} style={{ cursor: 'pointer' }}>
                    {artist.imageUrl ? (
                      <img className="card-cover" src={artist.imageUrl} alt={artist.name} style={{ borderRadius: '50%' }} />
                    ) : (
                      <div className="card-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>👤</div>
                    )}
                    <div className="card-title">{artist.name}</div>
                    <div className="card-subtitle">{artist.genre || 'Artist'}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section>
              <h2 className="section-title">Albums</h2>
              <div className="card-grid">
                {results.albums.map((album) => (
                  <div className="card" key={album.id} onClick={() => navigate(`/album/${album.id}`)} style={{ cursor: 'pointer' }}>
                    {album.coverUrl ? (
                      <img className="card-cover" src={album.coverUrl} alt={album.title} />
                    ) : (
                      <div className="card-cover" style={{ background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💿</div>
                    )}
                    <div className="card-title">{album.title}</div>
                    <div className="card-subtitle">{album.artistName || 'Unknown'}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.tracks.length === 0 && results.artists.length === 0 && results.albums.length === 0 && (
            <p style={{ color: '#8e8e93', textAlign: 'center', marginTop: '3rem' }}>No results found</p>
          )}
        </>
      )}
    </div>
  );
}
