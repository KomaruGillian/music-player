import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

export function streamAudio(req: Request, res: Response, filePath: string) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".flac" ? "audio/flac" :
                        ext === ".ogg" ? "audio/ogg" :
                        ext === ".wav" ? "audio/wav" : "audio/mpeg";
    const fileStream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });
    fileStream.pipe(res);
  } else {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".flac" ? "audio/flac" :
                        ext === ".ogg" ? "audio/ogg" :
                        ext === ".wav" ? "audio/wav" : "audio/mpeg";
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

export function proxyStream(req: Request, res: Response, url: string) {
  const client = url.startsWith("https") ? https : http;

  const proxyHeaders: Record<string, string> = {};
  if (req.headers.range) {
    proxyHeaders.Range = req.headers.range;
  }
  if (req.headers["user-agent"]) {
    proxyHeaders["User-Agent"] = req.headers["user-agent"];
  }

  const proxyReq = client.request(url, { headers: proxyHeaders }, (proxyRes) => {
    const status = proxyRes.statusCode || 200;
    const headers: Record<string, string | number> = {};

    const passHeaders = [
      "content-type", "content-length", "content-range",
      "accept-ranges", "content-duration", "x-content-duration",
    ];
    for (const h of passHeaders) {
      const val = proxyRes.headers[h];
      if (val) {
        headers[h] = Array.isArray(val) ? val.join(", ") : val;
      }
    }

    if (!headers["content-type"]) {
      headers["content-type"] = "audio/mpeg";
    }
    if (!headers["accept-ranges"]) {
      headers["accept-ranges"] = "bytes";
    }

    res.writeHead(status, headers);
    proxyRes.pipe(res);

    proxyRes.on("error", () => {
      if (!res.headersSent) res.status(502).json({ error: "Stream proxy error" });
      else res.end();
    });
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).json({ error: "Failed to connect to stream source" });
  });

  req.on("close", () => proxyReq.destroy());
  proxyReq.end();
}

let audioUrlCache = new Map<string, { url: string; expires: number }>();

export function getCachedAudioUrl(trackId: string): string | null {
  const cached = audioUrlCache.get(trackId);
  if (cached && cached.expires > Date.now()) return cached.url;
  audioUrlCache.delete(trackId);
  return null;
}

export function setCachedAudioUrl(trackId: string, url: string, ttlMs = 3600000) {
  audioUrlCache.set(trackId, { url, expires: Date.now() + ttlMs });
}

export function clearCachedAudioUrl(trackId: string) {
  audioUrlCache.delete(trackId);
}
