import { Router } from "express";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/error.js";
import { getRadioTracks, getArtistRadio, getGenreRadio } from "../services/radio.js";

const router = Router();

router.get("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const seed = req.query.seed as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const played = (req.query.played as string || "").split(",").filter(Boolean);
  const tracks = await getRadioTracks(userId, seed, limit, played);
  res.json({ tracks, seed: seed || crypto.randomUUID() });
}));

router.get("/artist/:id", asyncHandler(async (req, res) => {
  const artistId = req.params.id as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const played = (req.query.played as string || "").split(",").filter(Boolean);
  const tracks = await getArtistRadio(artistId, limit, played);
  res.json({ tracks });
}));

router.get("/genre/:genre", asyncHandler(async (req, res) => {
  const genre = req.params.genre as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const played = (req.query.played as string || "").split(",").filter(Boolean);
  const tracks = await getGenreRadio(genre, limit, played);
  res.json({ tracks });
}));

export default router;
