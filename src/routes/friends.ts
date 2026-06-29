import { Router } from "express";
import { db } from "../db/index.js";
import { friends, users, playlists } from "../db/schema.js";
import { eq, and, or } from "drizzle-orm";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/error.js";
import { getOnlineUserIds } from "../services/presence.js";

const safeFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatar: users.avatar,
  bio: users.bio,
  createdAt: users.createdAt,
};

const router = Router();

router.post("/add/:userId", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const targetId = req.params.userId as string;
  const userId = req.userId as string;
  if (targetId === userId) return res.status(400).json({ error: "Cannot add yourself" });
  const target = await db.select().from(users).where(eq(users.id, targetId)).get();
  if (!target) return res.status(404).json({ error: "User not found" });
  const existing = await db.select().from(friends)
    .where(or(
      and(eq(friends.userId, userId), eq(friends.friendId, targetId)),
      and(eq(friends.userId, targetId), eq(friends.friendId, userId))
    )).get();
  if (existing) return res.status(409).json({ error: "Request already exists" });
  await db.insert(friends).values({ userId, friendId: targetId, status: "pending" });
  res.status(201).json({ requested: true });
}));

router.post("/accept/:userId", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const fromUserId = req.params.userId as string;
  const userId = req.userId as string;
  const request = await db.select().from(friends)
    .where(and(eq(friends.userId, fromUserId), eq(friends.friendId, userId), eq(friends.status, "pending")))
    .get();
  if (!request) return res.status(404).json({ error: "No pending request" });
  await db.update(friends).set({ status: "accepted" })
    .where(and(eq(friends.userId, fromUserId), eq(friends.friendId, userId)));
  res.json({ accepted: true });
}));

router.delete("/:userId", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const targetId = req.params.userId as string;
  const userId = req.userId as string;
  await db.delete(friends).where(or(
    and(eq(friends.userId, userId), eq(friends.friendId, targetId)),
    and(eq(friends.userId, targetId), eq(friends.friendId, userId))
  ));
  res.json({ removed: true });
}));

router.get("/", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const result = await db.select({ friend: safeFields })
    .from(friends)
    .innerJoin(users, or(
      and(eq(friends.userId, userId), eq(friends.friendId, users.id)),
      and(eq(friends.friendId, userId), eq(friends.userId, users.id))
    ))
    .where(eq(friends.status, "accepted"));
  res.json(result.map(r => r.friend));
}));

router.get("/pending", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const result = await db.select({ user: safeFields })
    .from(friends)
    .innerJoin(users, eq(friends.userId, users.id))
    .where(and(eq(friends.friendId, userId), eq(friends.status, "pending")));
  res.json(result.map(r => r.user));
}));

router.get("/online", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const result = await db.select({ friend: safeFields })
    .from(friends)
    .innerJoin(users, or(
      and(eq(friends.userId, userId), eq(friends.friendId, users.id)),
      and(eq(friends.friendId, userId), eq(friends.userId, users.id))
    ))
    .where(eq(friends.status, "accepted"));
  const onlineIds = getOnlineUserIds();
  const onlineFriends = result
    .map(r => r.friend)
    .filter(f => onlineIds.includes(f.id));
  res.json(onlineFriends);
}));

export default router;
