import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config/index.js";
import { authGuard, AuthRequest } from "../middleware/auth.js";
import { genId } from "../utils/id.js";
import { asyncHandler } from "../utils/error.js";

const router = Router();

router.post("/register", asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email, password required" });
  }
  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const existingName = await db.select().from(users).where(eq(users.username, username)).get();
  if (existingName) {
    return res.status(409).json({ error: "Username already taken" });
  }
  const id = genId();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ id, username, email, passwordHash });
  const token = jwt.sign({ userId: id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.status(201).json({ user: { id, username, email }, token });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
}));

router.get("/me", authGuard, asyncHandler(async (req: AuthRequest, res) => {
  const user = await db.select().from(users).where(eq(users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    displayName: user.displayName,
    createdAt: user.createdAt,
  });
}));

export default router;
