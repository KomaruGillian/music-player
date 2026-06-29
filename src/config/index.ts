import dotenv from "dotenv";
import path from "path";

dotenv.config();

const appRoot = path.resolve(process.env.APP_ROOT || ".");

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: "7d",
  storagePath: path.resolve(process.env.STORAGE_PATH || "./storage"),
  dbPath: process.env.DB_PATH || "./music.db",
  lastfmApiKey: process.env.LASTFM_API_KEY || "",
  itunesApiUrl: process.env.ITUNES_API_URL || "https://itunes.apple.com",
  lastfmApiUrl: process.env.LASTFM_API_URL || "https://ws.audioscrobbler.com/2.0",
  ytdlpPath: path.resolve(process.env.YTDLP_PATH || path.join(appRoot, "bin", "yt-dlp.exe")),
  ffmpegPath: path.resolve(process.env.FFMPEG_PATH || path.join(appRoot, "bin", "ffmpeg.exe")),
} as const;
