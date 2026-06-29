import { useState, useEffect, useRef, useCallback } from "react";
import api from "../lib/api";
import { usePlayerStore } from "../store/playerStore";

const GENRES = ["pop", "rock", "hip-hop", "electronic", "jazz", "classical", "r&b", "country", "metal", "indie"];

export default function Radio() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [seed, setSeed] = useState("");
  const [played, setPlayed] = useState<string[]>([]);
  const [artistId, setArtistId] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentTrack, isRadio, setQueue, fetchAndPlay, setRadio } = usePlayerStore();
  const playedRef = useRef<string[]>([]);

  const toPlayerTrack = (t: any) => ({
    id: t.id,
    title: t.title,
    coverUrl: t.coverUrl || null,
    duration: t.duration || 0,
    artist: t.artistName || "Unknown",
  });

  const loadRadio = useCallback(async (seedVal?: string, playedVal?: string[]) => {
    setLoading(true);
    try {
      const params: any = {};
      if (seedVal) params.seed = seedVal;
      if (playedVal && playedVal.length > 0) params.played = playedVal.join(",");
      params.limit = 20;
      const { data } = await api.get("/radio", { params });
      setSeed(data.seed);
      const newTracks = data.tracks || [];
      setTracks((prev) => [...prev, ...newTracks]);
      setQueue([...tracks, ...newTracks].map(toPlayerTrack));
    } catch {}
    setLoading(false);
  }, [tracks, setQueue]);

  const loadArtistRadio = async () => {
    if (!artistId.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/radio/artist/${artistId}`);
      const newTracks = data.tracks || [];
      setTracks(newTracks);
      setQueue(newTracks.map(toPlayerTrack));
      if (newTracks.length > 0) fetchAndPlay(toPlayerTrack(newTracks[0]));
      setRadio(data.seed || "");
    } catch {}
    setLoading(false);
  };

  const loadGenreRadio = async (g: string) => {
    setGenre(g);
    setLoading(true);
    try {
      const { data } = await api.get(`/radio/genre/${g}`);
      const newTracks = data.tracks || [];
      setTracks(newTracks);
      playedRef.current = [];
      setPlayed([]);
      setQueue(newTracks.map(toPlayerTrack));
      if (newTracks.length > 0) fetchAndPlay(toPlayerTrack(newTracks[0]));
      setRadio(data.seed || "");
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadRadio(); }, []);

  useEffect(() => {
    if (currentTrack && !playedRef.current.includes(currentTrack.id)) {
      playedRef.current = [...playedRef.current, currentTrack.id];
      setPlayed(playedRef.current);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isRadio && currentTrack) {
      const remaining = tracks.filter((t) => !played.includes(t.id));
      if (remaining.length <= 3) loadRadio(seed, playedRef.current);
    }
  }, [currentTrack, isRadio, played, tracks]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Radio</h1>
      </div>

      {currentTrack && isRadio && (
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={currentTrack.coverUrl || `https://picsum.photos/seed/${currentTrack.id}/200/200`}
            alt=""
            style={{ width: 200, height: 200, borderRadius: "0.75rem", objectFit: "cover", marginBottom: "1rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
          />
          <span className="radio-badge">LIVE</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.5rem 0 0.25rem" }}>{currentTrack.title}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", margin: 0 }}>{currentTrack.artist || currentTrack.artistId || ""}</p>
        </div>
      )}

      <section>
        <h2 className="section-title">Genre Radio</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {GENRES.map((g) => (
            <button key={g} className="btn-primary" onClick={() => loadGenreRadio(g)}
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", background: genre === g ? "var(--accent)" : "#2c2c2e", textTransform: "capitalize" }}>
              {g}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Artist Radio</h2>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <input className="form-input" type="text" placeholder="Enter artist ID" value={artistId}
            onChange={(e) => setArtistId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadArtistRadio()} />
          <button className="btn-primary" onClick={loadArtistRadio}>Play</button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Up Next</h2>
        {tracks.filter((t) => !played.includes(t.id) || t.id === currentTrack?.id).map((track) => (
          <div className="track-row" key={track.id}
            onClick={() => { setQueue(tracks.map(toPlayerTrack)); fetchAndPlay(toPlayerTrack(track)); }}
            style={{ cursor: "pointer", opacity: track.id === currentTrack?.id ? 1 : 0.7, borderLeft: track.id === currentTrack?.id ? "3px solid var(--accent)" : "3px solid transparent" }}>
            <img className="track-row-cover" src={track.coverUrl || `https://picsum.photos/seed/${track.id}/96/96`} alt="" />
            <div className="track-row-info">
              <div className="track-row-title">{track.title}</div>
              <div className="track-row-artist">{track.artistName || "Unknown"}</div>
            </div>
            {track.id === currentTrack?.id && <span className="radio-badge" style={{ fontSize: "0.625rem" }}>NOW</span>}
          </div>
        ))}
      </section>

      {loading && <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "1rem" }}>Loading more tracks...</p>}
    </div>
  );
}
