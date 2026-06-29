import { Router } from "express";
import { db } from "../db/index.js";
import { users, playlists, subscriptions, userSettings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/error.js";

const router = Router();

router.get("/me/theme", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  let settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (!settings) {
    await db.insert(userSettings).values({ userId, themePreset: "dark" });
    settings = { userId, themePreset: "dark" as const, accentColor: null, bgColor: null, cardColor: null, textColor: null };
  }
  res.json(settings);
}));

router.patch("/me/theme", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  const isPremium = sub?.type === "premium" && (!sub.expiresAt || sub.expiresAt > new Date());
  const { themePreset, accentColor, bgColor, cardColor, textColor } = req.body;
  if (themePreset === "custom" && !isPremium) {
    return res.status(403).json({ error: "Custom theme is premium only" });
  }
  const existing = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  const values: any = {};
  if (themePreset && ["light", "dark", "custom"].includes(themePreset)) values.themePreset = themePreset;
  if (accentColor !== undefined) values.accentColor = accentColor;
  if (bgColor !== undefined) values.bgColor = bgColor;
  if (cardColor !== undefined) values.cardColor = cardColor;
  if (textColor !== undefined) values.textColor = textColor;
  if (existing) {
    await db.update(userSettings).set(values).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({ userId, ...values });
  }
  res.json({ updated: true });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const userId = req.params.id as string;
  const user = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatar: users.avatar,
    bio: users.bio,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  const isPremium = sub?.type === "premium" && (!sub.expiresAt || sub.expiresAt > new Date());
  res.json({ ...user, premium: isPremium });
}));

router.get("/:id/playlists", asyncHandler(async (req, res) => {
  const userId = req.params.id as string;
  const result = await db.select().from(playlists)
    .where(eq(playlists.userId, userId));
  const publicOnly = result.filter(p => p.isPublic);
  res.json(publicOnly);
}));

export default router;
