import { db } from "../db/index.js";
import { tracks } from "../db/schema.js";
import { eq } from "drizzle-orm";

const LRCLIB_API = "https://lrclib.net/api";

export interface LyricsResult {
  lrcContent: string;
  synced: boolean;
}

async function searchLrclib(title: string, artistName: string): Promise<LyricsResult | null> {
  try {
    const url = `${LRCLIB_API}/search?q=${encodeURIComponent(title + " " + artistName)}`;
    const res = await fetch(url, { headers: { "User-Agent": "MusicStream/1.0" } });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length === 0) return null;

    const match = data.find((item: any) =>
      item.syncedLyrics &&
      item.trackName?.toLowerCase().includes(title.toLowerCase())
    ) || data.find((item: any) => item.syncedLyrics);

    if (match?.syncedLyrics) {
      return { lrcContent: match.syncedLyrics, synced: true };
    }

    const plainMatch = data.find((item: any) => item.plainLyrics);
    if (plainMatch?.plainLyrics) {
      return { lrcContent: plainMatch.plainLyrics, synced: false };
    }

    return null;
  } catch (err) {
    console.error("LRCLIB search failed:", err);
    return null;
  }
}

async function searchLrclibGet(title: string, artistName: string, albumName?: string, duration?: number): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artistName,
    });
    if (albumName) params.set("album_name", albumName);
    if (duration) params.set("duration", duration.toString());

    const url = `${LRCLIB_API}/get?${params.toString()}`;
    const res = await fetch(url, { headers: { "User-Agent": "MusicStream/1.0" } });
    if (!res.ok) return null;
    const data = await res.json() as any;

    if (data.syncedLyrics) {
      return { lrcContent: data.syncedLyrics, synced: true };
    }
    if (data.plainLyrics) {
      return { lrcContent: data.plainLyrics, synced: false };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchLyrics(trackId: string, title: string, artistName: string | null): Promise<LyricsResult | null> {
  const name = artistName || "";
  const track = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();

  const result = await searchLrclibGet(title, name, undefined, track?.duration || undefined);
  if (result) return result;

  return searchLrclib(title, name);
}
