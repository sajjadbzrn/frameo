export type MediaType = "video" | "audio";
export type Theme = "dark" | "light";

export interface MediaItem {
  id: string;
  title: string;
  /** Absolute local path (Tauri) or object URL (browser fallback) */
  path: string;
  /** True when this item came from a browser File object and cannot persist */
  isBlob?: boolean;
  /** True when this item is a remote URL (dragged link) rather than a local file */
  isRemote?: boolean;
  type: MediaType;
  size?: number;
  addedAt: number;
  lastPlayedAt?: number;
  /** Hue used to generate the poster gradient */
  hue: number;
  /** Known after first metadata load */
  duration?: number;
  /** Marked as favorite by the user */
  favorite?: boolean;
}

export type GroupKind = "playlist" | "collection";

/** A named group of media items — playlists for music, collections for movies. */
export interface MediaGroup {
  id: string;
  kind: GroupKind;
  name: string;
  itemIds: string[];
  createdAt: number;
}

export interface Settings {
  theme: Theme;
  defaultVolume: number;
  defaultRate: number;
  autoplayNext: boolean;
  resumePlayback: boolean;
  loop: boolean;
  /* ---- AI features (simulated) ---- */
  skipIntros: boolean;
  sceneMarkers: boolean;
  aiSubtitles: boolean;
  copilotEnabled: boolean;
}

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

export type View = "library" | "player";
export type LibraryFilter =
  | "all"
  | "video"
  | "audio"
  | "recent"
  | "favorite"
  | { kind: GroupKind; id: string };

export interface Scene {
  start: number;
  label: string;
}
