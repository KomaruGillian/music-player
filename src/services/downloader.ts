import { spawn } from "child_process";
import path from "path";
import { db } from "../db/index.js";
import { downloads, tracks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { genId } from "../utils/id.js";
import { config } from "../config/index.js";
import fs from "fs";

const storageDir = path.resolve(config.storagePath, "tracks");
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

export async function startDownload(sourceUrl: string, trackId?: string) {
  const id = genId();
  const outPath = path.join(storageDir, `${trackId || id}.mp3`);
  await db.insert(downloads).values({ id, sourceUrl, filePath: outPath, trackId, status: "downloading" });
  downloadVideo(sourceUrl, outPath, id, trackId).catch(async (err) => {
    console.error("Download failed:", err);
    await db.update(downloads).set({ status: "failed" }).where(eq(downloads.id, id));
  });
  return { id, status: "downloading" };
}

function downloadVideo(url: string, outPath: string, downloadId: string, trackId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlpPath, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--ffmpeg-location", config.ffmpegPath,
      "-o", outPath,
      url,
    ]);
    proc.on("close", async (code) => {
      if (code === 0) {
        await db.update(downloads).set({ status: "completed" }).where(eq(downloads.id, downloadId));
        if (trackId) {
          await db.update(tracks).set({ filePath: outPath }).where(eq(tracks.id, trackId));
        }
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

export async function startLosslessDownload(sourceUrl: string, trackId: string) {
  const outPath = path.join(storageDir, `${trackId}_lossless.flac`);
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(config.ytdlpPath, [
      "-x",
      "--audio-format", "flac",
      "--audio-quality", "0",
      "--ffmpeg-location", config.ffmpegPath,
      "-o", outPath,
      sourceUrl,
    ]);
    proc.on("close", async (code) => {
      if (code === 0) {
        await db.update(tracks).set({ losslessFilePath: outPath }).where(eq(tracks.id, trackId));
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

export function getYouTubeAudioUrl(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(config.ytdlpPath, [
      "ytsearch1:" + query,
      "--get-url",
      "-f", "bestaudio/best",
      "--no-playlist",
      "--ffmpeg-location", config.ffmpegPath,
    ]);
    let output = "";
    proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => {
      if (code === 0 && output.trim()) {
        const urls = output.trim().split("\n").filter(Boolean);
        resolve(urls[0] || null);
      } else {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

export function searchYouTube(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(config.ytdlpPath, [
      "ytsearch1:" + query,
      "--get-id",
      "--no-playlist",
      "--ffmpeg-location", config.ffmpegPath,
    ]);
    let output = "";
    proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => {
      if (code === 0 && output.trim()) {
        resolve(`https://www.youtube.com/watch?v=${output.trim()}`);
      } else {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

export function waitForFile(trackId: string, timeoutMs = 120000): Promise<string | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      const track = await db.select().from(tracks).where(eq(tracks.id, trackId)).get();
      if (track?.filePath) {
        clearInterval(interval);
        resolve(track.filePath);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 1000);
  });
}
