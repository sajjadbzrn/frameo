import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  GroupKind,
  LibraryFilter,
  MediaGroup,
  MediaItem,
  Settings,
  Toast,
  View,
} from "./types";
import {
  clamp,
  defaultGroupName,
  deriveTitle,
  deriveUrlTitle,
  guessType,
  hashHue,
  isTauri,
  uid,
} from "./lib/utils";

const LS_ITEMS = "frameo.items";
const LS_SETTINGS = "frameo.settings";
const LS_POSITIONS = "frameo.positions";
const LS_GROUPS = "frameo.groups";

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  defaultVolume: 0.8,
  defaultRate: 1,
  autoplayNext: true,
  resumePlayback: true,
  loop: false,
  skipIntros: true,
  sceneMarkers: true,
  aiSubtitles: false,
  copilotEnabled: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function loadItems(): MediaItem[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS);
    if (raw) {
      const items: MediaItem[] = JSON.parse(raw);
      // Blob URLs cannot survive a reload — drop them.
      return items.filter((i) => !i.isBlob);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadPositions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_POSITIONS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function loadGroups(): MediaGroup[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS);
    if (raw) {
      const groups: MediaGroup[] = JSON.parse(raw);
      return groups.filter((g) => g.kind === "playlist" || g.kind === "collection");
    }
  } catch {
    /* ignore */
  }
  return [];
}

interface AppContextValue {
  /* ui */
  view: View;
  setView: (v: View) => void;
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  queueOpen: boolean;
  openQueue: (b: boolean) => void;
  copilotOpen: boolean;
  openCopilot: (b: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  /** True when the current media element raised an error */
  error: boolean;
  /** Resume position in seconds for a file path */
  resumeAt: (path: string) => number;
  /* library */
  items: MediaItem[];
  addFiles: (paths: string[], blobs?: File[]) => Promise<MediaItem[]>;
  addRemoteUrls: (urls: string[]) => Promise<MediaItem[]>;
  removeItem: (id: string) => void;
  clearLibrary: () => void;
  clearQueue: () => void;
  toggleFavorite: (itemId: string) => void;
  /* playlists & collections */
  groups: MediaGroup[];
  createGroup: (kind: GroupKind, name: string) => MediaGroup;
  deleteGroup: (id: string) => void;
  addToGroup: (groupId: string, itemId: string) => void;
  removeFromGroup: (groupId: string, itemId: string) => void;
  /* queue & playback */
  queue: MediaItem[];
  queueIndex: number;
  current: MediaItem | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
  /* settings */
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /* toasts */
  toasts: Toast[];
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /* ---------------- persistent state ---------------- */
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [items, setItems] = useState<MediaItem[]>(loadItems);
  const [groups, setGroups] = useState<MediaGroup[]>(loadGroups);
  const positionsRef = useRef<Record<string, number>>(loadPositions());
  /** Last position saved for the current item (seconds), to throttle persistence. */
  const lastSavedRef = useRef(0);
  /** Resume target for the currently loading item; consumed once on loadedmetadata. */
  const resumeTargetRef = useRef<{ id: string; pos: number } | null>(null);

  /* ---------------- ui state ---------------- */
  const [view, setView] = useState<View>("library");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  /** Open the queue panel (closing the copilot panel). */
  const openQueue = useCallback((b: boolean) => {
    setQueueOpen(b);
    if (b) setCopilotOpen(false);
  }, []);

  /** Open the copilot panel (closing the queue panel). */
  const openCopilot = useCallback((b: boolean) => {
    setCopilotOpen(b);
    if (b) setQueueOpen(false);
  }, []);

  /* ---------------- playback state ---------------- */
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

  /** Resume position (seconds) for a given file path. */
  const resumeAt = useCallback((path: string) => positionsRef.current[path] ?? 0, []);

  /* ---------------- persistence effects ---------------- */
  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LS_ITEMS, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(LS_GROUPS, JSON.stringify(groups));
  }, [groups]);

  /* ---------------- toasts ---------------- */
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: Toast["kind"] = "info") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismissToast(id), 3800);
    },
    [dismissToast],
  );

  /* ---------------- library actions ---------------- */
  const addRemoteUrls = useCallback(async (urls: string[]) => {
    const entries: MediaItem[] = urls.map((url) => {
      const title = deriveUrlTitle(url);
      return {
        id: uid(),
        title,
        path: url,
        isRemote: true,
        type: guessType(url),
        addedAt: Date.now(),
        hue: hashHue(title),
      };
    });
    setItems((prev) => [...entries, ...prev]);
    return entries;
  }, []);

  const addFiles = useCallback(
    async (paths: string[], blobs?: File[]) => {
      const entries: MediaItem[] = [];
      paths.forEach((p, i) => {
        const blob = blobs?.[i];
        const title = blob ? blob.name : deriveTitle(p);
        entries.push({
          id: uid(),
          title,
          path: p,
          isBlob: !!blob,
          type: blob ? guessType(blob.name) : guessType(p),
          size: blob?.size,
          addedAt: Date.now(),
          hue: hashHue(title),
        });
      });
      setItems((prev) => [...entries, ...prev]);
      return entries;
    },
    [],
  );

  const stopAndClear = useCallback(() => {
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

  const removeItem = useCallback(
    (id: string) => {
      const idx = queue.findIndex((i) => i.id === id);
      const removed = queue[idx];
      if (removed?.isBlob) URL.revokeObjectURL(removed.path);
      if (idx === queueIndex) stopAndClear();
      setItems((prev) => prev.filter((i) => i.id !== id));
      setQueue((prev) => prev.filter((i) => i.id !== id));
      setGroups((prev) =>
        prev.map((g) => (g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter((i) => i !== id) } : g)),
      );
      setQueueIndex((qi) => {
        if (qi === -1) return -1;
        if (idx === -1) return qi;
        if (idx === qi) return -1;
        return qi > idx ? qi - 1 : qi;
      });
    },
    [queue, queueIndex, stopAndClear],
  );

  const clearLibrary = useCallback(() => {
    stopAndClear();
    items.forEach((i) => {
      if (i.isBlob) URL.revokeObjectURL(i.path);
    });
    setItems([]);
    setQueue([]);
    setQueueIndex(-1);
    setGroups([]);
  }, [items, stopAndClear]);

  const clearQueue = useCallback(() => {
    stopAndClear();
    setQueue([]);
    setQueueIndex(-1);
  }, [stopAndClear]);

  /* ---------------- favorites & groups ---------------- */
  const toggleFavorite = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, favorite: !i.favorite } : i)),
    );
  }, []);

  const createGroup = useCallback((kind: GroupKind, name: string) => {
    const group: MediaGroup = {
      id: uid(),
      kind,
      name: name.trim() || defaultGroupName(kind, []),
      itemIds: [],
      createdAt: Date.now(),
    };
    setGroups((prev) => [...prev, group]);
    return group;
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addToGroup = useCallback((groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId && !g.itemIds.includes(itemId)
          ? { ...g, itemIds: [...g.itemIds, itemId] }
          : g,
      ),
    );
  }, []);

  const removeFromGroup = useCallback((groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, itemIds: g.itemIds.filter((i) => i !== itemId) } : g,
      ),
    );
  }, []);

  /* ---------------- playback engine ---------------- */
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

  const playItem = useCallback(
    (item: MediaItem) => {
      const existing = queue.findIndex((i) => i.id === item.id);
      if (existing >= 0) {
        setQueueIndex(existing);
      } else {
        setQueue([...queue, item]);
        setQueueIndex(queue.length);
      }
      setCopilotOpen(false);
    },
    [queue],
  );

  // Load & play the item at queueIndex whenever it changes.
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
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, lastPlayedAt: Date.now() } : i)),
    );
    const p = video.play();
    if (p) p.catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex]);

  /* ---------------- playback navigation ---------------- */
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
        return qi; // stay at end, ended overlay shows
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

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      const len = queue.length;
      const canAdvance =
        len > 0 && (shuffle || settings.loop || queueIndex < len - 1);
      if (settings.autoplayNext && canAdvance) {
        next(true);
      } else {
        setEnded(true);
      }
    };
    const onTime = () => {
      setPosition(video.currentTime);
      if (video.duration > 0) setDuration(video.duration);
      // buffered estimate
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
      if (item) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, duration: video.duration } : i)),
        );
      }
      const target = resumeTargetRef.current;
      if (
        target &&
        item?.id === target.id &&
        video.duration > 0 &&
        target.pos < video.duration - 5
      ) {
        video.currentTime = target.pos;
      }
      resumeTargetRef.current = null;
    };
    const onError = () => {
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
    video.addEventListener("error", onError);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ratechange", onRate);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
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
    setSettings((s) => ({ ...s, defaultVolume: val }));
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
      if (index === queueIndex) stopAndClear();
      setQueue((prev) => prev.filter((_, i) => i !== index));
      setQueueIndex((qi) => {
        if (qi === -1) return -1;
        if (qi === index) return -1;
        return qi > index ? qi - 1 : qi;
      });
    },
    [queueIndex, stopAndClear],
  );

  /* ---------------- settings ---------------- */
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    // Keep the live loop state and the loop setting in sync.
    if ("loop" in patch) {
      const v = patch.loop ?? false;
      setLoop(v);
      const video = videoRef.current;
      if (video) video.loop = v;
    }
  }, []);

  /* ---------------- persist positions ---------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      localStorage.setItem(LS_POSITIONS, JSON.stringify(positionsRef.current));
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      view,
      setView,
      filter,
      setFilter,
      search,
      setSearch,
      queueOpen,
      openQueue,
      copilotOpen,
      openCopilot,
      settingsOpen,
      setSettingsOpen,
      items,
      addFiles,
      addRemoteUrls,
      removeItem,
      clearLibrary,
      clearQueue,
      toggleFavorite,
      groups,
      createGroup,
      deleteGroup,
      addToGroup,
      removeFromGroup,
      queue,
      queueIndex,
      current,
      videoRef,
      playing,
      position,
      duration,
      buffered,
      volume,
      muted,
      rate,
      loop,
      shuffle,
      ended,
      error,
      resumeAt,
      playItem,
      playAt,
      addToQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      setRate,
      toggleLoop,
      toggleShuffle,
      removeFromQueue,
      settings,
      updateSettings,
      toasts,
      toast,
      dismissToast,
    }),
    [
      view,
      filter,
      search,
      queueOpen,
      copilotOpen,
      settingsOpen,
      items,
      queue,
      queueIndex,
      current,
      playing,
      position,
      duration,
      buffered,
      volume,
      muted,
      rate,
      loop,
      shuffle,
      ended,
      error,
      resumeAt,
      settings,
      toasts,
      addFiles,
      addRemoteUrls,
      removeItem,
      clearLibrary,
      clearQueue,
      toggleFavorite,
      groups,
      createGroup,
      deleteGroup,
      addToGroup,
      removeFromGroup,
      playItem,
      playAt,
      addToQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      setRate,
      toggleLoop,
      toggleShuffle,
      removeFromQueue,
      updateSettings,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
