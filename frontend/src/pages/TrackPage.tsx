import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { usePlayerStore } from '../store/playerStore';
import { Player as LottiePlayer } from '@lottiefiles/react-lottie-player';

interface TrackData {
  id: string;
  title: string;
  artistName?: string;
  artistId?: string;
  coverUrl?: string;
  duration?: number;
  genre?: string;
  plays?: number;
}

interface LyricsData {
  lrcContent: string;
  synced: boolean;
}

function parseLRC(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split('\n');
  const result: { time: number; text: string }[] = [];
  const metaRe = /^\[(ar|ti|al|by|offset|length|re|ve):/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || metaRe.test(trimmed)) continue;

    const timestamps: number[] = [];
    let rest = trimmed;
    let match: RegExpExecArray | null;

    const tsRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
    while ((match = tsRe.exec(rest)) !== null) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
      timestamps.push(mins * 60 + secs + ms / 1000);
    }

    const text = rest.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{2,3})?\]/g, '').trim();

    if (timestamps.length > 0 && text) {
      for (const t of timestamps) {
        result.push({ time: t, text });
      }
    } else if (text && timestamps.length === 0) {
      result.push({ time: -1, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function parseSearchQuery(q: string): { artist: string; title: string } {
  const dash = q.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim() };
  const parts = q.trim().split(/\s+/);
  if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join(' ') };
  return { artist: '', title: q.trim() };
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [track, setTrack] = useState<TrackData | null>(null);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lrcLines, setLrcLines] = useState<{ time: number; text: string }[]>([]);
  const [activeLine, setActiveLine] = useState(-1);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [refreshQuery, setRefreshQuery] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const { currentTrack, isPlaying, fetchAndPlay, downloadTrack } = usePlayerStore();
  const lyricsRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const userSeekedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/tracks/${id}`).then((r) => {
      setTrack(r.data);
      setRefreshQuery(r.data.artistName ? `${r.data.artistName} - ${r.data.title}` : r.data.title);
    }).catch(() => {});
    loadLyrics();
  }, [id]);

  const loadLyrics = () => {
    if (!id) return;
    setLyrics(null);
    setLrcLines([]);
    api.get(`/tracks/${id}/lyrics`).then((r) => {
      setLyrics(r.data);
      if (r.data.lrcContent) {
        setLrcLines(parseLRC(r.data.lrcContent));
      }
    }).catch(() => {});
  };

  const getAudio = useCallback(() => document.querySelector('audio') as HTMLAudioElement | null, []);

  useEffect(() => {
    if (!currentTrack || lrcLines.length === 0 || !lyrics?.synced) return;
    const audio = getAudio();
    if (!audio) return;

    let rafId: number;
    const tick = () => {
      if (userSeekedRef.current) {
        userSeekedRef.current = false;
        rafId = requestAnimationFrame(tick);
        return;
      }
      const t = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < lrcLines.length; i++) {
        if (lrcLines[i].time >= 0 && lrcLines[i].time <= t) idx = i;
      }
      setActiveLine(idx);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [currentTrack?.id, lrcLines, lyrics?.synced, getAudio]);

  useEffect(() => {
    if (activeLine < 0 || !lyricsRef.current) return;
    const el = lineRefs.current[activeLine];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLine]);

  const seekToLine = (time: number) => {
    if (time < 0) return;
    const audio = getAudio();
    if (!audio) return;
    userSeekedRef.current = true;
    audio.currentTime = time;
    if (audio.paused) audio.play().catch(() => {});
  };

  const handlePlay = () => {
    if (!track) return;
    fetchAndPlay({
      id: track.id,
      title: track.title,
      coverUrl: track.coverUrl || null,
      duration: track.duration || 0,
      artist: track.artistName || 'Unknown',
    });
  };

  const handleRefresh = async () => {
    if (!track || !refreshQuery.trim()) return;
    setRefreshing(true);
    const { artist, title } = parseSearchQuery(refreshQuery);
    try {
      const { data } = await api.post(`/tracks/${track.id}/refresh`, {
        artistName: artist || undefined,
        title: title || undefined,
      });
      setTrack(data);
      loadLyrics();
    } catch {}
    setRefreshing(false);
    setShowRefresh(false);
  };

  const handleDownload = async () => {
    if (!track) return;
    setDownloading(true);
    try {
      await downloadTrack(track.id);
      setDownloaded(true);
    } catch {}
    setDownloading(false);
  };

  if (!track) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Загрузка...</div>;

  const coverSrc = track.coverUrl || `https://picsum.photos/seed/${track.id}/400/400`;
  const isCurrentTrack = currentTrack?.id === track.id;

  return (
    <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, position: 'sticky', top: 0 }}>
        <img
          src={coverSrc}
          alt={track.title}
          style={{ width: 280, height: 280, borderRadius: '0.75rem', objectFit: 'cover', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
        />
        <div style={{ marginTop: '1.25rem', maxWidth: 280 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{track.title}</h1>
          {track.artistName && (
            <p
              style={{ color: 'var(--accent)', fontSize: '1rem', fontWeight: 600, margin: '0.375rem 0 0', cursor: 'pointer' }}
              onClick={() => track.artistId && navigate(`/artist/${track.artistId}`)}
            >
              {track.artistName}
            </p>
          )}
          {track.genre && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{track.genre}</p>}
          <button className="btn-primary" onClick={handlePlay} style={{ marginTop: '1rem', width: '100%' }}>
            {isCurrentTrack && isPlaying ? 'Играет...' : 'Играть'}
          </button>

          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={downloading || downloaded}
            style={{ marginTop: '0.5rem', width: '100%', background: downloaded ? '#2d6a4f' : '#3a3a3c', fontSize: '0.8125rem', padding: '0.5rem' }}
          >
            {downloading ? 'Скачивание...' : downloaded ? 'Скачано ✓' : 'Скачать'}
          </button>

          {!showRefresh ? (
            <button
              className="btn-primary"
              onClick={() => setShowRefresh(true)}
              style={{ marginTop: '0.5rem', width: '100%', background: '#3a3a3c', fontSize: '0.8125rem', padding: '0.5rem' }}
            >
              Обновить данные
            </button>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <input
                className="form-input"
                type="text"
                value={refreshQuery}
                onChange={(e) => setRefreshQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
                placeholder="Артист - Название"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" onClick={handleRefresh} disabled={refreshing} style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem' }}>
                  {refreshing ? '...' : 'Найти'}
                </button>
                <button className="btn-primary" onClick={() => setShowRefresh(false)} style={{ background: '#3a3a3c', fontSize: '0.8125rem', padding: '0.5rem' }}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {lyrics?.lrcContent ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <LottiePlayer
                src="https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de0810e5c/IGUj5WbLum.json"
                autoplay
                loop
                style={{ width: 48, height: 48 }}
              />
              <h2 className="section-title" style={{ margin: 0 }}>Текст</h2>
              {lyrics.synced && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Синхронизировано</span>}
            </div>
            <div
              className="lyrics-container"
              ref={lyricsRef}
              style={{ textAlign: 'left', padding: 0, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
            >
              {lrcLines.map((line, i) => {
                const isActive = isCurrentTrack && lyrics.synced && i === activeLine;
                return (
                  <div
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    className={`lyrics-line${isActive ? ' active' : ''}`}
                    onClick={() => seekToLine(line.time)}
                    style={{
                      cursor: line.time >= 0 ? 'pointer' : 'default',
                      color: isActive ? 'var(--accent)' : undefined,
                    }}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            <LottiePlayer
              src="https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de0810e5c/IGUj5WbLum.json"
              autoplay
              loop
              style={{ width: 120, height: 120, margin: '0 auto 1rem' }}
            />
            <p>Текст не найден</p>
          </div>
        )}
      </div>
    </div>
  );
}
