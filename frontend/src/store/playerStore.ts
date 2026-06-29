import { create } from "zustand";
import API from "../lib/api";

interface Track {
  id: string;
  title: string;
  duration?: number;
  coverUrl?: string | null;
  artistId?: string | null;
  albumId?: string | null;
  genre?: string | null;
  plays?: number;
  artist?: string;
  cover?: string;
  filePath?: string | null;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  fetching: boolean;
  queue: Track[];
  queueIndex: number;
  volume: number;
  isRadio: boolean;
  radioSeed: string | null;
  setTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setRadio: (seed: string | null) => void;
  fetchAndPlay: (track: Track) => Promise<void>;
  downloadTrack: (trackId: string) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  fetching: false,
  queue: [],
  queueIndex: 0,
  volume: 0.8,
  isRadio: false,
  radioSeed: null,

  setTrack: (track) => set({ currentTrack: track, isPlaying: true }),

  setQueue: (tracks, startIndex = 0) =>
    set({ queue: tracks, queueIndex: startIndex, currentTrack: tracks[startIndex] || null, isPlaying: true }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  next: () => {
    const { queue, queueIndex } = get();
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      set({ queueIndex: nextIdx, currentTrack: queue[nextIdx], isPlaying: true });
    }
  },

  prev: () => {
    const { queue, queueIndex } = get();
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      set({ queueIndex: prevIdx, currentTrack: queue[prevIdx], isPlaying: true });
    }
  },

  setVolume: (v) => {
    set({ volume: v });
    localStorage.setItem("volume", String(v));
  },
  setRadio: (seed) => set({ isRadio: !!seed, radioSeed: seed }),

  fetchAndPlay: async (track) => {
    const currentVolume = get().volume;
    set({ currentTrack: track, isPlaying: true, fetching: false, volume: currentVolume });
  },

  downloadTrack: async (trackId) => {
    try {
      await API.post(`/tracks/${trackId}/fetch`);
    } catch {}
  },
}));
