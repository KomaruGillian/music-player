import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const artists = sqliteTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  bio: text("bio"),
  genre: text("genre"),
  itunesId: integer("itunes_id"),
  lastfmUrl: text("lastfm_url"),
  mbzId: text("mbz_id"),
  cachedAt: integer("cached_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const albums = sqliteTable("albums", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  artistId: text("artist_id").references(() => artists.id),
  releaseDate: text("release_date"),
  type: text("type", { enum: ["album", "single", "ep"] }).default("album"),
  itunesId: integer("itunes_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  duration: integer("duration"),
  filePath: text("file_path"),
  losslessFilePath: text("lossless_file_path"),
  coverUrl: text("cover_url"),
  artistId: text("artist_id").references(() => artists.id),
  albumId: text("album_id").references(() => albums.id),
  genre: text("genre"),
  itunesId: integer("itunes_id"),
  plays: integer("plays").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  coverUrl: text("cover_url"),
  userId: text("user_id").references(() => users.id).notNull(),
  isPublic: integer("is_public", { mode: "boolean" }).default(sql`1`),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const playlistTracks = sqliteTable("playlist_tracks", {
  playlistId: text("playlist_id").references(() => playlists.id).notNull(),
  trackId: text("track_id").references(() => tracks.id).notNull(),
  position: integer("position").notNull(),
});

export const likes = sqliteTable("likes", {
  userId: text("user_id").references(() => users.id).notNull(),
  trackId: text("track_id").references(() => tracks.id).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const friends = sqliteTable("friends", {
  userId: text("user_id").references(() => users.id).notNull(),
  friendId: text("friend_id").references(() => users.id).notNull(),
  status: text("status", { enum: ["pending", "accepted"] }).default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["free", "premium"] }).default("free"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").references(() => users.id).notNull(),
  themePreset: text("theme_preset", { enum: ["light", "dark", "custom"] }).default("dark"),
  accentColor: text("accent_color"),
  bgColor: text("bg_color"),
  cardColor: text("card_color"),
  textColor: text("text_color"),
});

export const listeningHistory = sqliteTable("listening_history", {
  userId: text("user_id").references(() => users.id).notNull(),
  trackId: text("track_id").references(() => tracks.id).notNull(),
  playedAt: integer("played_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const downloads = sqliteTable("downloads", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  filePath: text("file_path"),
  status: text("status", { enum: ["pending", "downloading", "completed", "failed"] }).default("pending"),
  trackId: text("track_id").references(() => tracks.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const lyrics = sqliteTable("lyrics", {
  trackId: text("track_id").references(() => tracks.id).notNull(),
  lrcContent: text("lrc_content").notNull(),
  synced: integer("synced", { mode: "boolean" }).default(sql`0`),
});
