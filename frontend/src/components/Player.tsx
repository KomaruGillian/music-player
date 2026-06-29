import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import API from "../lib/api";
import { useNavigate } from "react-router-dom";
import TrackMenu from "./TrackMenu";
import { Player as LottiePlayer } from "@lottiefiles/react-lottie-player";

export default function Player() {
  const { currentTrack, isPlaying, volume, next, prev, play, pause, setVolume } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [activeLine, setActiveLine] = useState(-1);
  const navigate = useNavigate();
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) return;
    API.post(`/tracks/${currentTrack.id}/play`).catch(() => {});
    checkLiked();
  }, [currentTrack?.id]);

  const checkLiked = async () => {
    if (!currentTrack) return;
    try {
      const { data } = await API.get(`/tracks/${currentTrack.id}/like`);
      setLiked(!!data?.liked);
    } catch {
      setLiked(false);
    }
  };

  const toggleLike = async () => {
    if (!currentTrack) return;
    try {
      if (liked) {
        await API.delete(`/tracks/${currentTrack.id}/like`);
        setLiked(false);
      } else {
        await API.post(`/tracks/${currentTrack.id}/like`);
        setLiked(true);
      }
    } catch {}
  };

  const streamUrl = currentTrack
    ? `/api/tracks/${currentTrack.id}/stream`
    : "";

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleEnded = () => next();

  // progress-only update for mini-player audio element
  const handleTimeUpdateAudio = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const d = audioRef.current.duration || 1;
    setProgress(t / d);
  };

  // Handle seeking when user clicks on progress bar
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  // rAF loop: progress + lyrics sync + auto-scroll
  useEffect(() => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      if (!audio.duration) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = audio.currentTime;
      setProgress(t / audio.duration);

      if (showLyrics && lyrics.length > 0) {
        let idx = -1;
        for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time >= 0 && lyrics[i].time <= t) idx = i;
        }
        if (idx !== activeLine) {
          setActiveLine(idx);
          if (lyricsScrollRef.current && idx >= 0) {
            const lines = lyricsScrollRef.current.querySelectorAll<HTMLDivElement>(".lyrics-line");
            if (lines[idx]) {
              lines[idx].scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentTrack?.id, showLyrics, lyrics, activeLine]);

  const loadLyrics = async () => {
    if (!currentTrack) return;
    try {
      const { data } = await API.get(`/tracks/${currentTrack.id}/lyrics`);
      if (data.lrcContent) {
        const lines = data.lrcContent.split("\n");
        const parsed: { time: number; text: string }[] = [];
        const metaRe = /^\[(ar|ti|al|by|offset|length):/i;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || metaRe.test(trimmed)) continue;
          const timestamps: number[] = [];
          let rest = trimmed;
          const tsRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
          let match: RegExpExecArray | null;
          while ((match = tsRe.exec(rest)) !== null) {
            const mins = parseInt(match[1]);
            const secs = parseInt(match[2]);
            const ms = match[3] ? parseInt(match[3].padEnd(3, "0")) : 0;
            timestamps.push(mins * 60 + secs + ms / 1000);
          }
          const text = rest.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{2,3})?\]/g, "").trim();
          if (timestamps.length > 0 && text) {
            for (const t of timestamps) parsed.push({ time: t, text });
          } else if (text) {
            parsed.push({ time: -1, text });
          }
        }
        parsed.sort((a, b) => a.time - b.time);
        setLyrics(parsed);
      }
    } catch {}
  };

  useEffect(() => {
    if (showLyrics) loadLyrics();
  }, [showLyrics, currentTrack?.id]);

  const seekToLine = (time: number) => {
    if (time < 0 || !audioRef.current) return;
    audioRef.current.currentTime = time;
    if (audioRef.current.paused) audioRef.current.play().catch(() => {});
  };

  // ── Collapsed mini-player ──────────────────────────────────────
  if (!expanded) {
    return (
      <div className="player-bar" onClick={(e) => {
        if ((e.target as HTMLElement).closest(".player-btn, .track-menu-wrap")) return;
        setExpanded(true);
      }}>
        <audio
          ref={audioRef}
          src={streamUrl}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdateAudio}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPlaying={() => setBuffering(false)}
          onLoadStart={() => setBuffering(true)}
        />
        {currentTrack && (
          <img
            className="player-cover"
            src={currentTrack.coverUrl || currentTrack.cover || `https://picsum.photos/seed/${currentTrack.id}/112/112`}
            alt=""
            onClick={() => setExpanded(true)}
            style={{ cursor: "pointer" }}
          />
        )}
        <div className="player-info" onClick={() => setExpanded(true)} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
          <div className="player-title">{currentTrack?.title || ""}</div>
          <div className="player-artist">{currentTrack?.artist || currentTrack?.artistId || ""}</div>
        </div>
        <div className="mini-progress-wrap" onClick={handleProgressClick}>
          <div className="mini-progress-bar">
            <div className="mini-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="player-time">
          {formatTime(audioRef.current?.currentTime || 0)} /{" "}
          {formatTime(audioRef.current?.duration || currentTrack?.duration || 0)}
        </div>
        <button className="player-btn play-btn" onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }}>
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <button className="player-btn" onClick={(e) => { e.stopPropagation(); next(); }} style={{ transform: "scaleX(-1)" }}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button className={`player-btn${liked ? " active" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(); }} style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
        <div className="track-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <TrackMenu trackId={currentTrack?.id || ""} />
        </div>
      </div>
    );
  }

  // ── Expanded fullscreen player ────────────────────────────────
  return (
    <div className="fullscreen-player">
      <audio
        ref={audioRef}
        src={streamUrl}
        onEnded={handleEnded}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onLoadStart={() => setBuffering(true)}
      />

      <div className="fp-lottie-bg">
        <LottiePlayer
          src="https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de0810e5c/IGUj5WbLum.json"
          autoplay
          loop
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="fp-top-bar">
        <button className="player-btn" onClick={() => { setExpanded(false); setShowLyrics(false); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
        <div className="fp-top-info">
          <div className="fp-title">{currentTrack?.title || ""}</div>
          <div className="fp-artist">{currentTrack?.artist || currentTrack?.artistId || ""}</div>
        </div>
        <button className={`player-btn${liked ? " active" : ""}`} onClick={toggleLike}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
      </div>

      <div className="fp-main">
        {!showLyrics ? (
          <div className="fp-cover-section">
            <div className="fp-cover-wrap" onClick={() => currentTrack && navigate(`/track/${currentTrack.id}`)}>
              <img
                className="fp-cover"
                src={currentTrack?.coverUrl || currentTrack?.cover || `https://picsum.photos/seed/${currentTrack?.id}/400/400`}
                alt=""
              />
              {buffering && (
                <div className="fp-cover-overlay">
                  <div className="buffering-spinner" />
                </div>
              )}
            </div>

            <div className="fp-controls">
              <button className="player-btn" onClick={prev}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              <button className="player-btn play-btn" onClick={isPlaying ? pause : play}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <button className="player-btn" onClick={next} style={{ transform: "scaleX(-1)" }}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
            </div>

            <div className="fp-progress-wrap" onClick={handleProgressClick}>
              <div className="fp-progress-bar">
                <div className="fp-progress-fill" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="fp-time-labels">
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(audioRef.current?.duration || currentTrack?.duration || 0)}</span>
              </div>
            </div>

            <div className="fp-volume">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
              <input type="range" className="volume-slider" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} />
            </div>

            <button className="fp-toggle-btn" onClick={() => setShowLyrics(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
                <path d="M4 6h16M4 12h10M4 18h14" />
              </svg>
              Текст
            </button>
          </div>
        ) : (
          <div className="fp-lyrics-section">
            <div className="fp-lyrics-header">
              <div className="fp-lyrics-cover" onClick={() => setShowLyrics(false)} style={{ cursor: "pointer" }}>
                <img
                  src={currentTrack?.coverUrl || currentTrack?.cover || `https://picsum.photos/seed/${currentTrack?.id}/112/112`}
                  alt=""
                />
              </div>
              <div className="fp-lyrics-info">
                <div className="fp-title">{currentTrack?.title || ""}</div>
                <div className="fp-artist">{currentTrack?.artist || currentTrack?.artistId || ""}</div>
              </div>
              <button className="player-btn" onClick={() => setShowLyrics(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </button>
            </div>

            <div className="fp-lyrics-scroll" ref={lyricsScrollRef}>
              {lyrics.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-secondary)" }}>
                  <p>Текст не найден</p>
                </div>
              ) : (
                lyrics.map((line, i) => {
                  const isActive = i === activeLine;
                  return (
                    <div
                      key={i}
                      className={`lyrics-line${isActive ? " active" : ""}`}
                      onClick={() => line.time >= 0 && seekToLine(line.time)}
                      style={{ cursor: line.time >= 0 ? "pointer" : "default" }}
                    >
                      {line.text}
                    </div>
                  );
                })
              )}
            </div>

            <div className="fp-lyrics-progress">
              <div className="fp-progress-wrap" onClick={handleProgressClick}>
                <div className="fp-progress-bar">
                  <div className="fp-progress-fill" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
              <div className="fp-time-labels">
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(audioRef.current?.duration || currentTrack?.duration || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
