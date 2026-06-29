import { createServer } from "http";
import app from "./app.js";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./db/index.js";
import { config } from "./config/index.js";
import { initWebSocket } from "./services/presence.js";

try {
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrated");
} catch {
  console.log("No migrations to apply or first run");
}

const server = createServer(app);
initWebSocket(server);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
