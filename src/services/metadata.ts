import { db } from "../db/index.js";
import { artists, albums } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config/index.js";

interface iTunesResult {
  artistId?: number;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

async function searchiTunes(query: string, entity: string = "all"): Promise<any[]> {
  const url = `${config.itunesApiUrl}/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=5`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

async function searchLastFM(method: string, query: string): Promise<any> {
  if (!config.lastfmApiKey) return null;
  const url = `${config.lastfmApiUrl}/?method=${method}&${method.includes("artist") ? "artist" : "track"}=${encodeURIComponent(query)}&api_key=${config.lastfmApiKey}&format=json`;
  const res = await fetch(url);
  return res.json();
}

export async function enrichArtist(artistId: string) {
  const artist = await db.select().from(artists).where(eq(artists.id, artistId)).get();
  if (!artist) throw new Error("Artist not found");

  const itunesResults = await searchiTunes(artist.name, "musicArtist");
  const itunesMatch = itunesResults.find((r: any) => r.artistType === "Music Artist" || r.wrapperType === "artist");

  let imageUrl = artist.imageUrl;
  let bio = artist.bio;
  let genre = artist.genre;
  let itunesId = artist.itunesId;

  if (itunesMatch) {
    itunesId = itunesMatch.artistId;
  }

  const lastfmData = await searchLastFM("artist.getinfo", artist.name);
  if (lastfmData?.artist) {
    bio = lastfmData.artist.bio?.summary || bio;
    imageUrl = imageUrl || lastfmData.artist.image?.find((i: any) => i.size === "large")?.["#text"] || null;
  }

  if (itunesMatch) {
    genre = itunesMatch.primaryGenreName || genre;
  }

  await db.update(artists).set({
    imageUrl,
    bio,
    genre,
    itunesId,
    lastfmUrl: lastfmData?.artist?.url || artist.lastfmUrl,
    cachedAt: new Date(),
  }).where(eq(artists.id, artistId));

  return { ...artist, imageUrl, bio, genre, itunesId };
}

export async function searchAndCreateArtist(name: string) {
  const itunesResults = await searchiTunes(name, "musicArtist");
  const itunesMatch = itunesResults[0];

  const lastfmData = await searchLastFM("artist.getinfo", name);

  const imageUrl = lastfmData?.artist?.image?.find((i: any) => i.size === "large")?.["#text"]
    || (itunesMatch?.artistLinkUrl ? undefined : undefined);

  const id = genId();
  await db.insert(artists).values({
    id,
    name,
    imageUrl: imageUrl || null,
    bio: lastfmData?.artist?.bio?.summary || null,
    genre: itunesMatch?.primaryGenreName || null,
    itunesId: itunesMatch?.artistId || null,
    lastfmUrl: lastfmData?.artist?.url || null,
    cachedAt: new Date(),
  });

  return { id, name };
}

export async function enrichAlbum(albumId: string) {
  const album = await db.select().from(albums).where(eq(albums.id, albumId)).get();
  if (!album) throw new Error("Album not found");

  const artist = album.artistId ? await db.select().from(artists).where(eq(artists.id, album.artistId)).get() : null;
  const query = artist ? `${album.title} ${artist.name}` : album.title;

  const itunesResults = await searchiTunes(query, "album");
  const itunesMatch = itunesResults.find((r: any) => r.collectionType === "Album" || r.wrapperType === "collection");

  if (itunesMatch) {
    const coverUrl = itunesMatch.artworkUrl100?.replace("100x100", "600x600") || album.coverUrl;
    await db.update(albums).set({
      coverUrl,
      itunesId: itunesMatch.collectionId,
      releaseDate: itunesMatch.releaseDate?.split("T")[0] || album.releaseDate,
    }).where(eq(albums.id, albumId));
    return { ...album, coverUrl, itunesId: itunesMatch.collectionId };
  }
  return album;
}

import { genId } from "../utils/id.js";
