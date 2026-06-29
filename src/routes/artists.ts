import { Router } from "express";
import { db } from "../db/index.js";
import { artists, albums, tracks } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../utils/error.js";
import { enrichArtist } from "../services/metadata.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await db.select().from(artists).limit(limit).offset(offset).orderBy(desc(artists.createdAt));
  res.json(result);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const artistId = req.params.id as string;
  let artist = await db.select().from(artists).where(eq(artists.id, artistId)).get();
  if (!artist) return res.status(404).json({ error: "Artist not found" });
  const now = Date.now();
  const cacheMs = 24 * 60 * 60 * 1000;
  if (!artist.cachedAt || (now - artist.cachedAt.getTime()) > cacheMs) {
    artist = await enrichArtist(artistId);
  }
  const artistAlbums = await db.select().from(albums).where(eq(albums.artistId, artistId));
  const artistTracks = await db.select().from(tracks).where(eq(tracks.artistId, artistId));
  res.json({ ...artist, albums: artistAlbums, tracks: artistTracks });
}));

export default router;
