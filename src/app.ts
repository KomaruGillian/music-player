import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config/index.js";
import { errorHandler } from "./utils/error.js";
import authRoutes from "./routes/auth.js";
import trackRoutes from "./routes/tracks.js";
import albumRoutes from "./routes/albums.js";
import artistRoutes from "./routes/artists.js";
import playlistRoutes from "./routes/playlists.js";
import friendRoutes from "./routes/friends.js";
import userRoutes from "./routes/users.js";
import searchRoutes from "./routes/search.js";
import downloadRoutes from "./routes/downloads.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import radioRoutes from "./routes/radio.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/radio", radioRoutes);

app.use("/storage", express.static(path.resolve(config.storagePath)));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;
