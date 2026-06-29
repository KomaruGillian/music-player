import { Router } from "express";
import { db } from "../db/index.js";
import { tracks, artists, albums } from "../db/schema.js";
import { or, like, desc, eq } from "drizzle-orm";
import { asyncHandler } from "../utils/error.js";
import { config } from "../config/index.js";
import { genId } from "../utils/id.js";

const router = Router();

function parseDashQuery(q: string): string {
  const dash = q.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dash) return `${dash[2].trim()} ${dash[1].trim()}`;
  return q;
}

async function searchiTunes(query: string, entity: string): Promise<any[]> {
  try {
    const url = `${config.itunesApiUrl}/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function ensureArtist(artistName: string, genre?: string, imageUrl?: string): Promise<string | null> {
  const existing = await db.select().from(artists).where(eq(artists.name, artistName)).get();
  if (existing) {
    if (imageUrl && !existing.imageUrl) {
      await db.update(artists).set({ imageUrl }).where(eq(artists.id, existing.id));
    }
    return existing.id;
  }

  const id = genId();
  await db.insert(artists).values({
    id,
    name: artistName,
    genre: genre || null,
    imageUrl: imageUrl || null,
  });
  return id;
}

async function ensureAlbum(albumTitle: string, artistId: string, coverUrl?: string): Promise<string | null> {
  if (!albumTitle) return null;
  const existing = await db.select().from(albums).where(eq(albums.title, albumTitle)).get();
  if (existing) return existing.id;

  const id = genId();
  await db.insert(albums).values({
    id,
    title: albumTitle,
    artistId,
    coverUrl: coverUrl || null,
  });
  return id;
}

async function enrichTracksWithArtist(trackList: any[]) {
  return Promise.all(trackList.map(async (t: any) => {
    const result: any = { ...t };
    if (t.artistId) {
      const artist = await db.select({ name: artists.name, imageUrl: artists.imageUrl, genre: artists.genre }).from(artists).where(eq(artists.id, t.artistId)).get();
      result.artistName = artist?.name || null;
    }
    return result;
  }));
}

router.get("/", asyncHandler(async (req, res) => {
  const q = (req.query.q as string) || "";
  if (q.trim().length < 2) return res.status(400).json({ error: "Query too short" });

  const term = `%${q.trim()}%`;
  const [trackResults, artistResults, albumResults] = await Promise.all([
    db.select().from(tracks).where(or(like(tracks.title, term), like(tracks.genre, term))).limit(20).orderBy(desc(tracks.plays)),
    db.select().from(artists).where(or(like(artists.name, term), like(artists.genre, term))).limit(10),
    db.select().from(albums).where(like(albums.title, term)).limit(10),
  ]);

  const hasLocalResults = trackResults.length > 0 || artistResults.length > 0 || albumResults.length > 0;
  if (hasLocalResults) {
    const enriched = await enrichTracksWithArtist(trackResults);
    res.json({ tracks: enriched, artists: artistResults, albums: albumResults });
    return;
  }

  const itunesQuery = parseDashQuery(q.trim());

  const [itunesSongs, itunesArtists, itunesAlbums] = await Promise.all([
    searchiTunes(itunesQuery, "song"),
    searchiTunes(itunesQuery, "musicArtist"),
    searchiTunes(itunesQuery, "album"),
  ]);

  const savedTracks = [];
  for (const r of itunesSongs.slice(0, 10)) {
    if (r.kind !== "song") continue;
    const artistId = await ensureArtist(r.artistName || "Unknown", r.primaryGenreName);
    const albumId = r.collectionName ? await ensureAlbum(r.collectionName, artistId!, r.artworkUrl100?.replace("100x100", "600x600")) : null;

    const existing = await db.select().from(tracks)
      .where(eq(tracks.itunesId, r.trackId)).get();
    if (existing) {
      const artist = artistId ? await db.select({ name: artists.name }).from(artists).where(eq(artists.id, artistId)).get() : null;
      savedTracks.push({ ...existing, artistName: artist?.name || r.artistName || null });
      continue;
    }

    const id = genId();
    await db.insert(tracks).values({
      id,
      title: r.trackName || "Unknown",
      artistId,
      albumId,
      coverUrl: r.artworkUrl100?.replace("100x100", "600x600") || null,
      duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
      genre: r.primaryGenreName || null,
      itunesId: r.trackId || null,
    });
    savedTracks.push({ id, title: r.trackName, artistName: r.artistName, coverUrl: r.artworkUrl100?.replace("100x100", "600x600"), duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null, genre: r.primaryGenreName });
  }

  const savedArtists = [];
  for (const r of itunesArtists.slice(0, 5)) {
    const artistId = await ensureArtist(r.artistName || "Unknown", r.primaryGenreName, r.artistLinkUrl ? undefined : undefined);
    const artist = await db.select().from(artists).where(eq(artists.id, artistId!)).get();
    if (artist) savedArtists.push(artist);
  }

  const savedAlbums = [];
  for (const r of itunesAlbums.slice(0, 5)) {
    const artistId = await ensureArtist(r.artistName || "Unknown", r.primaryGenreName);
    const albumId = await ensureAlbum(r.collectionName || "Unknown", artistId!, r.artworkUrl100?.replace("100x100", "600x600"));
    const album = await db.select().from(albums).where(eq(albums.id, albumId!)).get();
    if (album) {
      const artist = artistId ? await db.select({ name: artists.name }).from(artists).where(eq(artists.id, artistId)).get() : null;
      savedAlbums.push({ ...album, artistName: artist?.name || r.artistName || null });
    }
  }

  res.json({ tracks: savedTracks, artists: savedArtists, albums: savedAlbums });
}));

export default router;
