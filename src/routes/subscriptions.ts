import { Router } from "express";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/error.js";

const router = Router();

router.get("/status", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  if (!sub) return res.json({ type: "free", premium: false });
  const isActive = sub.type === "premium" && (!sub.expiresAt || sub.expiresAt > new Date());
  res.json({ type: sub.type, premium: isActive, expiresAt: sub.expiresAt });
}));

router.post("/activate", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (existing) {
    await db.update(subscriptions).set({ type: "premium", expiresAt }).where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({ userId, type: "premium", expiresAt });
  }
  res.json({ premium: true, expiresAt });
}));

export default router;
