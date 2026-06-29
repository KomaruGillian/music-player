import { Router } from "express";
import { db } from "../db/index.js";
import { playlists, playlistTracks, tracks, artists } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { genId } from "../utils/id.js";
import { asyncHandler } from "../utils/error.js";

const router = Router();

async function enrichTrackRows(pTracks: any[]) {
  return Promise.all(pTracks.map(async (pt: any) => {
    const t = pt.track || pt;
    const enriched: any = { ...pt, track: { ...t } };
    if (t.artistId) {
      const artist = await db.select({ name: artists.name, imageUrl: artists.imageUrl }).from(artists).where(eq(artists.id, t.artistId)).get();
      enriched.track.artistName = artist?.name || null;
      enriched.track.artistImageUrl = artist?.imageUrl || null;
    }
    return enriched;
  }));
}

router.get("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const result = await db.select().from(playlists)
    .where(eq(playlists.userId, req.userId as string))
    .orderBy(desc(playlists.createdAt));
  res.json(result);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const playlist = await db.select().from(playlists).where(eq(playlists.id, req.params.id as string)).get();
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  const pTracks = await db.select({ track: tracks, position: playlistTracks.position })
    .from(playlistTracks)
    .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
    .where(eq(playlistTracks.playlistId, req.params.id as string))
    .orderBy(playlistTracks.position);
  const enriched = await enrichTrackRows(pTracks);
  res.json({ ...playlist, tracks: enriched });
}));

router.post("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const { name, isPublic } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const id = genId();
  const userId = req.userId as string;
  await db.insert(playlists).values({ id, name, userId, isPublic: isPublic ?? true });
  res.status(201).json({ id, name, userId });
}));

router.post("/:id/tracks", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const playlistId = req.params.id as string;
  const playlist = await db.select().from(playlists).where(eq(playlists.id, playlistId)).get();
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  if (playlist.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ error: "trackId required" });
  const maxPos = await db.select({ max: playlistTracks.position })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));
  const position = (maxPos[0]?.max ?? -1) + 1;
  await db.insert(playlistTracks).values({ playlistId, trackId, position });
  res.status(201).json({ added: true, position });
}));

router.delete("/:id/tracks/:trackId", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const playlistId = req.params.id as string;
  const trackIdParam = req.params.trackId as string;
  const playlist = await db.select().from(playlists).where(eq(playlists.id, playlistId)).get();
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  if (playlist.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  await db.delete(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackIdParam)));
  res.json({ removed: true });
}));

router.delete("/:id", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const playlistId = req.params.id as string;
  const playlist = await db.select().from(playlists).where(eq(playlists.id, playlistId)).get();
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  if (playlist.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
  await db.delete(playlists).where(eq(playlists.id, playlistId));
  res.json({ deleted: true });
}));

export default router;
