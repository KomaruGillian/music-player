import WebSocket, { WebSocketServer } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

interface Client {
  ws: WebSocket;
  userId: string;
  lastHeartbeat: number;
}

const clients = new Map<string, Client[]>();
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

let wss: WebSocketServer;

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
      const userId = payload.userId;

      const client: Client = { ws, userId, lastHeartbeat: Date.now() };
      const userClients = clients.get(userId) || [];
      userClients.push(client);
      clients.set(userId, userClients);

      broadcastOnlineStatus(userId, true);

      ws.on("pong", () => {
        client.lastHeartbeat = Date.now();
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "heartbeat") {
            client.lastHeartbeat = Date.now();
            ws.send(JSON.stringify({ type: "heartbeat_ack" }));
          }
          if (msg.type === "get_online") {
            const onlineUserIds = getOnlineUserIds();
            ws.send(JSON.stringify({ type: "online_list", users: onlineUserIds }));
          }
        } catch {}
      });

      ws.on("close", () => {
        const userClients = clients.get(userId) || [];
        const idx = userClients.indexOf(client);
        if (idx > -1) userClients.splice(idx, 1);
        if (userClients.length === 0) {
          clients.delete(userId);
          broadcastOnlineStatus(userId, false);
        } else {
          clients.set(userId, userClients);
        }
      });
    } catch {
      ws.close(4001, "Invalid token");
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [userId, userClients] of clients) {
      const alive = userClients.filter(c => {
        if (now - c.lastHeartbeat > HEARTBEAT_TIMEOUT) {
          c.ws.terminate();
          return false;
        }
        return true;
      });
      if (alive.length === 0) {
        clients.delete(userId);
        broadcastOnlineStatus(userId, false);
      } else {
        clients.set(userId, alive);
        for (const c of alive) {
          c.ws.ping();
        }
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function broadcastOnlineStatus(userId: string, online: boolean) {
  const msg = JSON.stringify({ type: "presence", userId, online });
  for (const [, userClients] of clients) {
    for (const c of userClients) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(msg);
      }
    }
  }
}

export function getOnlineUserIds(): string[] {
  return Array.from(clients.keys());
}

export function isUserOnline(userId: string): boolean {
  return clients.has(userId);
}
