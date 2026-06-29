import { Router } from "express";
import { db } from "../db/index.js";
import { albums, tracks, artists } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { genId } from "../utils/id.js";
import { asyncHandler } from "../utils/error.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await db.select().from(albums).limit(limit).offset(offset).orderBy(desc(albums.createdAt));
  res.json(result);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const albumId = req.params.id as string;
  const album = await db.select().from(albums).where(eq(albums.id, albumId)).get();
  if (!album) return res.status(404).json({ error: "Album not found" });
  const albumTracks = await db.select().from(tracks).where(eq(tracks.albumId, albumId));
  res.json({ ...album, tracks: albumTracks });
}));

router.post("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const { title, coverUrl, artistId, releaseDate, type } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });
  const id = genId();
  await db.insert(albums).values({ id, title, coverUrl, artistId, releaseDate, type: type || "album" });
  res.status(201).json({ id, title, coverUrl, artistId, releaseDate, type });
}));

export default router;
