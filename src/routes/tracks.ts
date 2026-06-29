import { Router } from "express";
import { db } from "../db/index.js";
import { tracks, likes, listeningHistory, lyrics, artists, albums, downloads } from "../db/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/error.js";
import { streamAudio, proxyStream, getCachedAudioUrl, setCachedAudioUrl } from "../services/stream.js";
import { fetchLyrics } from "../services/lyrics.js";
import { searchYouTube, startDownload, getYouTubeAudioUrl } from "../services/downloader.js";
import { config } from "../config/index.js";
import { genId } from "../utils/id.js";
import fs from "fs";

const router = Router();

async function enrichTrack(track: any) {
  if (!track) return track;
  const result: any = { ...track };
  if (track.artistId) {
    const artist = await db.select({ id: artists.id, name: artists.name, imageUrl: artists.imageUrl, genre: artists.genre }).from(artists).where(eq(artists.id, track.artistId)).get();
    result.artistName = artist?.name || null;
    result.artistImageUrl = artist?.imageUrl || null;
    result.artistGenre = artist?.genre || null;
  } else {
    result.artistName = null;
  }
  if (track.albumId) {
    const album = await db.select({ id: albums.id, title: albums.title, coverUrl: albums.coverUrl }).from(albums).where(eq(albums.id, track.albumId)).get();
    result.albumTitle = album?.title || null;
    result.albumCoverUrl = album?.coverUrl || null;
  }
  return result;
}

async function enrichTracks(list: any[]) {
  return Promise.all(list.map(enrichTrack));
}

async function searchiTunesTrack(query: string): Promise<any | null> {
  try {
    const url = `${config.itunesApiUrl}/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data.results || [];
    const song = results.find((r: any) => r.kind === "song");
    return song || null;
  } catch {
    return null;
  }
}

router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await db.select().from(tracks).limit(limit).offset(offset).orderBy(desc(tracks.createdAt));
  res.json(await enrichTracks(result));
}));

router.get("/liked", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const liked = await db.select({
    id: tracks.id, title: tracks.title, duration: tracks.duration, coverUrl: tracks.coverUrl,
    artistId: tracks.artistId, albumId: tracks.albumId, genre: tracks.genre, plays: tracks.plays,
    filePath: tracks.filePath,
  }).from(likes).innerJoin(tracks, eq(likes.trackId, tracks.id)).where(eq(likes.userId, userId)).orderBy(desc(likes.createdAt));
  res.json(await enrichTracks(liked));
}));

router.get("/history", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const history = await db.select({
    id: tracks.id, title: tracks.title, duration: tracks.duration, coverUrl: tracks.coverUrl,
    artistId: tracks.artistId, albumId: tracks.albumId, genre: tracks.genre, plays: tracks.plays,
    filePath: tracks.filePath, playedAt: listeningHistory.playedAt,
  }).from(listeningHistory).innerJoin(tracks, eq(listeningHistory.trackId, tracks.id))
    .where(eq(listeningHistory.userId, userId))
    .orderBy(desc(listeningHistory.playedAt))
    .limit(limit);
  res.json(await enrichTracks(history));
}));

router.get("/recommended", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const recent = await db.select({ trackId: listeningHistory.trackId }).from(listeningHistory)
    .where(eq(listeningHistory.userId, userId)).orderBy(desc(listeningHistory.playedAt)).limit(20);
  if (recent.length === 0) {
    const top = await db.select().from(tracks).orderBy(desc(tracks.plays)).limit(10);
    return res.json(await enrichTracks(top));
  }
  const trackIds = recent.map((r) => r.trackId);
  const shuffled = trackIds.sort(() => Math.random() - 0.5).slice(0, 5);
  const result = [];
  for (const tid of shuffled) {
    const t = await db.select().from(tracks).where(eq(tracks.id, tid)).get();
    if (t) result.push(t);
  }
  res.json(await enrichTracks(result));
}));

router.get("/:id/like", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const trackId = req.params.id as string;
  const existing = await db.select().from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.trackId, trackId))).get();
  res.json({ liked: !!existing });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const track = await db.select().from(tracks).where(eq(tracks.id, req.params.id as string)).get();
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(await enrichTrack(track));
}));

router.post("/:id/refresh", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const trackId = req.params.id as string;
  const track = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return res.status(404).json({ error: "Track not found" });

  const artist = track.artistId ? await db.select().from(artists).where(eq(artists.id, track.artistId)).get() : null;
  const artistName = req.body.artistName || artist?.name || "";
  const trackTitle = req.body.title || track.title;

  const itunesQuery = `${artistName} ${trackTitle}`;
  const itunes = await searchiTunesTrack(itunesQuery);
  if (!itunes) return res.status(404).json({ error: "No match found on iTunes" });

  let newArtistId = track.artistId;
  if (itunes.artistName && (!artist || artist.name.toLowerCase() !== itunes.artistName.toLowerCase())) {
    const existing = await db.select().from(artists).where(eq(artists.name, itunes.artistName)).get();
    if (existing) {
      newArtistId = existing.id;
    } else {
      const id = genId();
      await db.insert(artists).values({
        id,
        name: itunes.artistName,
        genre: itunes.primaryGenreName || null,
      });
      newArtistId = id;
    }
    if (artist && artist.name === "Unknown" && artist.genre === null) {
      await db.update(artists).set({ name: itunes.artistName, genre: itunes.primaryGenreName || null }).where(eq(artists.id, artist.id));
      newArtistId = artist.id;
    }
  }

  if (artist && newArtistId === artist.id && itunes.primaryGenreName) {
    await db.update(artists).set({ genre: itunes.primaryGenreName }).where(eq(artists.id, newArtistId));
  }

  const updates: any = {
    title: itunes.trackName || track.title,
    artistId: newArtistId,
    coverUrl: itunes.artworkUrl100?.replace("100x100", "600x600") || track.coverUrl,
    duration: itunes.trackTimeMillis ? Math.round(itunes.trackTimeMillis / 1000) : track.duration,
    genre: itunes.primaryGenreName || track.genre,
    itunesId: itunes.trackId || track.itunesId,
  };

  await db.update(tracks).set(updates).where(eq(tracks.id, trackId));

  const cached = await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).get();
  if (cached) {
    await db.delete(lyrics).where(eq(lyrics.trackId, trackId));
  }

  const refreshed = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  res.json(await enrichTrack(refreshed));
}));

router.post("/:id/fetch", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const trackId = req.params.id as string;
  const track = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return res.status(404).json({ error: "Track not found" });

  if (track.filePath && fs.existsSync(track.filePath)) {
    return res.json({ status: "already_available", trackId });
  }

  const existing = await db.select().from(downloads).where(eq(downloads.trackId, trackId)).get();
  if (existing && existing.status === "downloading") {
    return res.json({ status: "downloading", downloadId: existing.id, trackId });
  }

  const artist = track.artistId ? await db.select().from(artists).where(eq(artists.id, track.artistId)).get() : null;
  const overrideSearch = req.body.search as string | undefined;
  const searchQuery = overrideSearch || `${artist?.name || ""} ${track.title}`;
  const youtubeUrl = await searchYouTube(searchQuery);
  if (!youtubeUrl) return res.status(404).json({ error: "Could not find track on YouTube" });

  const download = await startDownload(youtubeUrl, trackId);
  res.json({ status: "downloading", downloadId: download.id, trackId });
}));

router.get("/:id/stream", asyncHandler(async (req: AuthRequest, res) => {
  const track = await db.select().from(tracks).where(eq(tracks.id, req.params.id as string)).get();
  if (!track) return res.status(404).json({ error: "Track not found" });

  if (track.filePath && fs.existsSync(track.filePath)) {
    const lossless = req.query.quality === "lossless" && track.losslessFilePath;
    const filePath = lossless ? track.losslessFilePath! : track.filePath;
    return streamAudio(req, res, filePath);
  }

  const cachedUrl = getCachedAudioUrl(track.id);
  if (cachedUrl) {
    return proxyStream(req, res, cachedUrl);
  }

  const artist = track.artistId ? await db.select().from(artists).where(eq(artists.id, track.artistId)).get() : null;
  const searchQuery = `${artist?.name || ""} ${track.title}`;
  const audioUrl = await getYouTubeAudioUrl(searchQuery);
  if (!audioUrl) return res.status(404).json({ error: "Could not get audio stream" });

  setCachedAudioUrl(track.id, audioUrl);
  return proxyStream(req, res, audioUrl);
}));

router.post("/:id/like", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const trackId = req.params.id as string;
  const userId = req.userId as string;
  const existing = await db.select().from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.trackId, trackId))).get();
  if (existing) return res.status(409).json({ error: "Already liked" });
  await db.insert(likes).values({ userId, trackId });
  res.status(201).json({ liked: true });
}));

router.delete("/:id/like", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const trackId = req.params.id as string;
  await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.trackId, trackId)));
  res.json({ liked: false });
}));

router.post("/:id/play", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const trackId = req.params.id as string;
  await db.insert(listeningHistory).values({ userId: req.userId as string, trackId });
  await db.update(tracks).set({ plays: sql`${tracks.plays} + 1` }).where(eq(tracks.id, trackId));
  res.json({ recorded: true });
}));

router.get("/:id/lyrics", asyncHandler(async (req, res) => {
  const trackId = req.params.id as string;
  const track = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return res.status(404).json({ error: "Track not found" });

  let cached = await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).get();
  if (cached) return res.json({ lrcContent: cached.lrcContent, synced: cached.synced });

  const artist = track.artistId ? await db.select().from(artists).where(eq(artists.id, track.artistId)).get() : null;
  const result = await fetchLyrics(trackId, track.title, artist?.name || null);
  if (!result) return res.status(404).json({ error: "Lyrics not found" });

  await db.insert(lyrics).values({ trackId, lrcContent: result.lrcContent, synced: result.synced });
  res.json(result);
}));

export default router;
