import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";
import { clamp, isTauri } from "../lib/utils";
import { useSettings } from "./settings";
import { useLibrary } from "./library";
import { db } from "../lib/db";

const LS_POSITIONS = "frameo.positions";

function loadPositions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_POSITIONS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

interface PlaybackContextValue {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  queue: MediaItem[];
  queueIndex: number;
  current: MediaItem | null;
  playing: boolean;
  position: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  loop: boolean;
  shuffle: boolean;
  ended: boolean;
  error: boolean;
  resumeAt: (path: string) => number;
  playItem: (item: MediaItem) => void;
  playAt: (index: number) => void;
  addToQueue: (item: MediaItem) => void;
  togglePlay: () => void;
  next: (manual?: boolean) => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  removeFromQueue: (index: number) => void;
  /** Removes an item by id (used when an item is deleted from the library). */
  removeQueueItemById: (id: string) => void;
  clearQueue: () => void;
  stopPlayback: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({
  children,
  onStop,
  onRemoveFromQueue,
}: {
  children: ReactNode;
  onStop: React.MutableRefObject<(() => void) | null>;
  onRemoveFromQueue: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const { settings } = useSettings();
  const { updateItemDuration, updateItemLastPlayed } = useLibrary();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const positionsRef = useRef<Record<string, number>>(loadPositions());
  const lastSavedRef = useRef(0);
  const resumeTargetRef = useRef<{ id: string; pos: number } | null>(null);

  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(settings.defaultVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(settings.defaultRate);
  const [loop, setLoop] = useState(settings.loop);
  const [shuffle, setShuffle] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState(false);

  const current = queueIndex >= 0 ? queue[queueIndex] ?? null : null;

  const resumeAt = useCallback((path: string) => positionsRef.current[path] ?? 0, []);

  /* ---------------- persistence ---------------- */
  useEffect(() => {
    const persist = () => {
      const data = JSON.stringify(positionsRef.current);
      localStorage.setItem(LS_POSITIONS, data);
      void db.set(LS_POSITIONS, positionsRef.current).catch(() => {});
    };
    const id = window.setInterval(persist, 5000);
    // Flush the current position when the window closes (or navigates), so
    // quitting inside the 5s save window never loses the latest position.
    // The IndexedDB write here may be dropped during teardown — that's fine:
    // the synchronous localStorage write is the source of truth for resume.
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", persist);
    };
  }, []);

  /* ---------------- stop playback ---------------- */
  const stopPlayback = useCallback(() => {
    resumeTargetRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    setPlaying(false);
    setEnded(false);
    setError(false);
    setPosition(0);
    setDuration(0);
  }, []);

  // Expose stopPlayback to library store via ref
  useEffect(() => {
    onStop.current = stopPlayback;
  }, [onStop, stopPlayback]);

  /* ---------------- load source ---------------- */
  const loadSource = useCallback((item: MediaItem) => {
    const video = videoRef.current;
    if (!video) return;
    const src =
      item.isBlob || item.isRemote
        ? item.path
        : isTauri()
          ? convertFileSrc(item.path)
          : item.path;
    video.src = src;
    video.load();
    setDuration(0);
    setPosition(0);
    setEnded(false);
    setError(false);
  }, []);

  /* ---------------- play item ---------------- */
  const playItem = useCallback(
    (item: MediaItem) => {
      const existing = queue.findIndex((i) => i.id === item.id);
      if (existing >= 0) {
        setQueueIndex(existing);
      } else {
        setQueue([...queue, item]);
        setQueueIndex(queue.length);
      }
    },
    [queue],
  );

  /* ---------------- load & play on queueIndex change ---------------- */
  useEffect(() => {
    if (queueIndex < 0) return;
    const item = queue[queueIndex];
    if (!item) return;
    const video = videoRef.current;
    if (!video) return;
    loadSource(item);
    video.volume = clamp(settings.defaultVolume, 0, 1);
    setVolumeState(video.volume);
    video.muted = false;
    setMuted(false);
    video.playbackRate = settings.defaultRate;
    setRateState(settings.defaultRate);
    const saved = positionsRef.current[item.path] ?? 0;
    if (settings.resumePlayback && saved > 5) {
      resumeTargetRef.current = { id: item.id, pos: saved };
      lastSavedRef.current = saved;
    } else {
      resumeTargetRef.current = null;
      lastSavedRef.current = 0;
    }
    updateItemLastPlayed(item.id);
    const p = video.play();
    if (p) p.catch(() => setPlaying(false));
    // Re-run when the item at the current index changes identity too (e.g. the
    // current item is removed from the queue and the next one slides into place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, queue[queueIndex]?.id]);

  /* ---------------- navigation ---------------- */
  const next = useCallback(
    (manual = false) => {
      setEnded(false);
      setQueueIndex((qi) => {
        if (qi < 0) return qi;
        const len = queue.length;
        if (len === 0) return qi;
        if (shuffle) {
          if (len === 1) return qi;
          let r = qi;
          while (r === qi) r = Math.floor(Math.random() * len);
          return r;
        }
        if (qi + 1 < len) return qi + 1;
        if (settings.loop || manual) return 0;
        return qi;
      });
    },
    [queue.length, shuffle, settings.loop],
  );

  const prev = useCallback(() => {
    const video = videoRef.current;
    if (video && video.currentTime > 5) {
      video.currentTime = 0;
      return;
    }
    setEnded(false);
    setQueueIndex((qi) => {
      if (qi <= 0) return Math.max(0, queue.length - 1);
      return qi - 1;
    });
  }, [queue.length]);

  /* ---------------- video element events ---------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /**
     * Restores the saved playback position once the media is actually
     * seekable. Instead of a single attempt inside `loadedmetadata` (where a
     * browser can silently ignore the jump while the source is still
     * buffering), the seek is retried on every readiness event until it
     * takes effect or the item changes.
     */
    const applyResume = () => {
      const target = resumeTargetRef.current;
      if (!target) return;
      const item = queue[queueIndex];
      if (!item || item.id !== target.id) {
        resumeTargetRef.current = null;
        lastSavedRef.current = video.currentTime;
        return;
      }
      if (video.duration <= 0) return; // metadata not ready yet — wait for it
      if (target.pos >= video.duration - 5) {
        // Too close to the end to be worth resuming.
        resumeTargetRef.current = null;
        lastSavedRef.current = video.currentTime;
        return;
      }
      const ranges = video.seekable;
      for (let i = 0; i < ranges.length; i++) {
        if (target.pos >= ranges.start(i) - 0.5 && target.pos <= ranges.end(i) + 0.5) {
          video.currentTime = target.pos;
          // Confirm the jump took; otherwise stay pending and retry later.
          if (Math.abs(video.currentTime - target.pos) < 2) {
            resumeTargetRef.current = null;
            lastSavedRef.current = video.currentTime;
          }
          return;
        }
      }
      // Not seekable to the target yet — a later readiness event retries.
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      resumeTargetRef.current = null;
      lastSavedRef.current = video.currentTime;
      setPlaying(false);
      const len = queue.length;
      const canAdvance = len > 0 && (shuffle || settings.loop || queueIndex < len - 1);
      if (settings.autoplayNext && canAdvance) {
        next(true);
      } else {
        setEnded(true);
      }
    };
    const onTime = () => {
      setPosition(video.currentTime);
      if (video.duration > 0) setDuration(video.duration);
      let b = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (
          video.buffered.start(i) <= video.currentTime &&
          video.buffered.end(i) > video.currentTime
        ) {
          b = video.buffered.end(i);
          break;
        }
      }
      setBuffered(b);
      if (video.duration > 0) {
        const item = queue[queueIndex];
        if (item && video.currentTime - lastSavedRef.current > 5) {
          positionsRef.current[item.path] = video.currentTime;
          lastSavedRef.current = video.currentTime;
        }
      }
    };
    const onMeta = () => {
      if (video.duration > 0) setDuration(video.duration);
      const item = queue[queueIndex];
      if (item) updateItemDuration(item.id, video.duration);
      applyResume();
    };
    const onError = () => {
      resumeTargetRef.current = null;
      lastSavedRef.current = video.currentTime;
      setPlaying(false);
      setEnded(true);
      setError(true);
    };
    const onVolume = () => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };
    const onRate = () => setRateState(video.playbackRate);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", applyResume);
    video.addEventListener("canplay", applyResume);
    video.addEventListener("seeked", applyResume);
    video.addEventListener("durationchange", applyResume);
    video.addEventListener("error", onError);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ratechange", onRate);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", applyResume);
      video.removeEventListener("canplay", applyResume);
      video.removeEventListener("seeked", applyResume);
      video.removeEventListener("durationchange", applyResume);
      video.removeEventListener("error", onError);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ratechange", onRate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, queue, next, settings.autoplayNext]);

  /* ---------------- playback actions ---------------- */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setEnded(false);
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video || video.duration === 0) return;
    video.currentTime = clamp(t, 0, video.duration);
    setPosition(video.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const video = videoRef.current;
    const val = clamp(v, 0, 1);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
    }
    setVolumeState(val);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setRate = useCallback((r: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = r;
    setRateState(r);
  }, []);

  const toggleLoop = useCallback(() => {
    const video = videoRef.current;
    setLoop((l) => {
      const next = !l;
      if (video) video.loop = next;
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const playAt = useCallback(
    (index: number) => {
      if (index >= 0 && index < queue.length) setQueueIndex(index);
    },
    [queue.length],
  );

  const addToQueue = useCallback((item: MediaItem) => {
    setQueue((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
  }, []);

  const removeFromQueue = useCallback(
    (index: number) => {
      if (index === queueIndex) stopPlayback();
      setQueue((prev) => prev.filter((_, i) => i !== index));
      setQueueIndex((qi) => {
        if (qi === -1) return -1;
        if (qi === index) return -1;
        return qi > index ? qi - 1 : qi;
      });
    },
    [queueIndex, stopPlayback],
  );

  /** Remove an item by id. If it's the current item, playback advances to the
   *  next one (or stops when the queue becomes empty). Used by the library
   *  store when an item is deleted, so the player never keeps a dead item. */
  const removeQueueItemById = useCallback(
    (id: string) => {
      const idx = queue.findIndex((i) => i.id === id);
      if (idx === -1) return;
      if (idx === queueIndex) {
        const nextList = queue.filter((_, i) => i !== idx);
        if (nextList.length === 0) {
          stopPlayback();
          setQueue([]);
          setQueueIndex(-1);
        } else {
          setQueue(nextList);
          // The item that followed slides into this index; the load effect
          // (which now depends on the current item's id) picks it up and plays.
          setQueueIndex(Math.min(idx, nextList.length - 1));
        }
      } else {
        setQueue((prev) => prev.filter((_, i) => i !== idx));
        setQueueIndex((qi) => (qi > idx ? qi - 1 : qi));
      }
    },
    [queue, queueIndex, stopPlayback],
  );

  // Expose removeQueueItemById to the library store via ref.
  useEffect(() => {
    onRemoveFromQueue.current = removeQueueItemById;
  }, [onRemoveFromQueue, removeQueueItemById]);

  const clearQueue = useCallback(() => {
    stopPlayback();
    setQueue([]);
    setQueueIndex(-1);
  }, [stopPlayback]);

  // Sync loop from queueIndex effect to avoid stale closure
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.loop = loop;
  }, [loop]);

  const value = useMemo<PlaybackContextValue>(
    () => ({
      videoRef, queue, queueIndex, current, playing, position, duration, buffered,
      volume, muted, rate, loop, shuffle, ended, error, resumeAt,
      playItem, playAt, addToQueue, togglePlay, next, prev, seek, setVolume,
      toggleMute, setRate, toggleLoop, toggleShuffle, removeFromQueue, removeQueueItemById, clearQueue, stopPlayback,
    }),
    [
      queue, queueIndex, current, playing, position, duration, buffered,
      volume, muted, rate, loop, shuffle, ended, error, resumeAt,
      playItem, playAt, addToQueue, togglePlay, next, prev, seek, setVolume,
      toggleMute, setRate, toggleLoop, toggleShuffle, removeFromQueue, removeQueueItemById, clearQueue, stopPlayback,
    ],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
