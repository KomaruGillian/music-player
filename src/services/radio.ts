import { db, sqlite } from "../db/index.js";
import { tracks, artists, albums, listeningHistory } from "../db/schema.js";
import { eq, desc, sql, and, notInArray } from "drizzle-orm";

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function getRadioTracks(userId: string | null, seed?: string, limit: number = 20, playedIds: string[] = []): Promise<any[]> {
  let candidateTracks: any[] = [];

  if (userId) {
    const topGenres = sqlite.prepare(`
      SELECT t.genre, COUNT(*) as cnt
      FROM listening_history lh
      JOIN tracks t ON t.id = lh.track_id
      WHERE lh.user_id = ? AND t.genre IS NOT NULL
      GROUP BY t.genre
      ORDER BY cnt DESC
      LIMIT 5
    `).all(userId) as { genre: string; cnt: number }[];

    const topArtists = sqlite.prepare(`
      SELECT t.artist_id, COUNT(*) as cnt
      FROM listening_history lh
      JOIN tracks t ON t.id = lh.track_id
      WHERE lh.user_id = ? AND t.artist_id IS NOT NULL
      GROUP BY t.artist_id
      ORDER BY cnt DESC
      LIMIT 5
    `).all(userId) as { artist_id: string; cnt: number }[];

    if (topGenres.length > 0) {
      const genres = topGenres.map(g => g.genre);
      const genreTracks = await db.select().from(tracks)
        .where(and(
          sql`${tracks.genre} IN (${sql.join(genres.map(g => sql`${g}`), sql`,`)})`,
          playedIds.length > 0 ? sql`${tracks.id} NOT IN (${sql.join(playedIds.map(id => sql`${id}`), sql`,`)})` : sql`1=1`
        ))
        .limit(50);
      candidateTracks.push(...genreTracks);
    }

    if (topArtists.length > 0) {
      const artistIds = topArtists.map(a => a.artist_id);
      for (const artistId of artistIds) {
        const artistTracks = await db.select().from(tracks)
          .where(eq(tracks.artistId, artistId))
          .limit(10);
        candidateTracks.push(...artistTracks);
      }
    }
  }

  if (candidateTracks.length < limit) {
    const extra = await db.select().from(tracks)
      .orderBy(sql`RANDOM()`)
      .limit(limit * 3);
    candidateTracks.push(...extra);
  }

  const uniqueMap = new Map<string, any>();
  for (const t of candidateTracks) {
    if (!playedIds.includes(t.id)) {
      uniqueMap.set(t.id, t);
    }
  }

  let result = shuffleArray(Array.from(uniqueMap.values()));

  if (seed) {
    const seedNum = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    for (let i = 0; i < result.length; i++) {
      const j = (seedNum + i * 7) % result.length;
      [result[i], result[j]] = [result[j], result[i]];
    }
  }

  return result.slice(0, limit);
}

export async function getArtistRadio(artistId: string, limit: number = 20, playedIds: string[] = []): Promise<any[]> {
  const artistTracks = await db.select().from(tracks)
    .where(eq(tracks.artistId, artistId))
    .limit(30);

  const artist = await db.select().from(artists as any).where(eq((artists as any).id, artistId)).get();
  let similarTracks: any[] = [];

  if (artist?.genre) {
    similarTracks = await db.select().from(tracks)
      .where(sql`${tracks.genre} = ${artist.genre}`)
      .limit(30);
  }

  const all = [...artistTracks, ...similarTracks];
  const uniqueMap = new Map<string, any>();
  for (const t of all) {
    if (!playedIds.includes(t.id)) {
      uniqueMap.set(t.id, t);
    }
  }

  return shuffleArray(Array.from(uniqueMap.values())).slice(0, limit);
}

export async function getGenreRadio(genre: string, limit: number = 20, playedIds: string[] = []): Promise<any[]> {
  const genreTracks = await db.select().from(tracks)
    .where(sql`${tracks.genre} = ${genre}`)
    .limit(50);

  const uniqueMap = new Map<string, any>();
  for (const t of genreTracks) {
    if (!playedIds.includes(t.id)) {
      uniqueMap.set(t.id, t);
    }
  }

  return shuffleArray(Array.from(uniqueMap.values())).slice(0, limit);
}
