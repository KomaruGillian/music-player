import { Router } from "express";
import { db } from "../db/index.js";
import { tracks, artists, albums, downloads } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { genId } from "../utils/id.js";
import { asyncHandler } from "../utils/error.js";
import { startDownload } from "../services/downloader.js";
import { searchAndCreateArtist, enrichAlbum } from "../services/metadata.js";

const router = Router();

router.post("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const { url, title, artistName, albumTitle } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  let artistId: string | undefined;
  if (artistName) {
    const existing = await db.select().from(artists).where(eq(artists.name, artistName)).get();
    if (existing) {
      artistId = existing.id;
    } else {
      const created = await searchAndCreateArtist(artistName);
      artistId = created.id;
    }
  }

  let albumId: string | undefined;
  if (albumTitle && artistId) {
    const existingAlbum = await db.select().from(albums)
      .where(eq(albums.title, albumTitle)).get();
    if (existingAlbum) {
      albumId = existingAlbum.id;
    } else {
      albumId = genId();
      await db.insert(albums).values({ id: albumId, title: albumTitle, artistId });
    }
  }

  const trackId = genId();
  await db.insert(tracks).values({
    id: trackId,
    title: title || "Unknown",
    artistId,
    albumId,
  });

  const download = await startDownload(url, trackId);

  if (artistId) {
    try { await enrichAlbum(albumId!); } catch {}
  }

  res.status(201).json({ trackId, downloadId: download.id, status: download.status });
}));

router.get("/:id/status", authGuard, asyncHandler(async (req, res) => {
  const downloadId = req.params.id as string;
  const download = await db.select().from(downloads).where(eq(downloads.id, downloadId)).get();
  if (!download) return res.status(404).json({ error: "Download not found" });
  res.json({ id: download.id, status: download.status, trackId: download.trackId });
}));

export default router;
