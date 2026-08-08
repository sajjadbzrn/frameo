import type { GroupKind, MediaGroup, MediaType, Scene } from "../types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Friendly title derived from a remote URL (file name, else hostname). */
export function deriveUrlTitle(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) {
      return deriveTitle(last);
    }
    const host = u.hostname.replace(/^www\./, "");
    return host ? `${host} video` : "Remote media";
  } catch {
    return "Remote media";
  }
}

/** Deterministic hue (0-360) from a string, for poster gradients. */
export function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

const AUDIO_EXT = ["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma", "aiff", "alac", "ac3"];

export function extFromPath(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : "";
}

export function guessType(path: string): MediaType {
  const ext = extFromPath(path);
  if (AUDIO_EXT.includes(ext)) return "audio";
  return "video";
}

/** Human-friendly title derived from a file path. */
export function deriveTitle(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  return (
    base
      .replace(/[._]+/g, " ")
      .replace(/[-]+/g, " - ")
      .replace(/\b(s\d{1,2}e\d{1,2}|ep?\s?\d{1,4})\b/i, "")
      .replace(/\b(2160p|1080p|720p|480p|bluray|web-?dl|webrip|x265|x264|hdr|dv|10bit|remux|multi|dual)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || fileName
  );
}

/** True when running inside the Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Native-style confirm dialog (Tauri dialog plugin in-app, window.confirm elsewhere). */
export async function confirmDialog(message: string, title = "Frameo"): Promise<boolean> {
  if (isTauri()) {
    try {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return await ask(message, { title, kind: "warning" });
    } catch {
      /* fall through to window.confirm */
    }
  }
  return window.confirm(message);
}

/** Auto name for a new group, e.g. "Playlist 2" / "Collection 3". */
export function defaultGroupName(kind: GroupKind, groups: MediaGroup[]): string {
  const prefix = kind === "playlist" ? "Playlist" : "Collection";
  const n = groups.filter((g) => g.kind === kind).length + 1;
  return `${prefix} ${n}`;
}

const SCENE_LABELS = ["Scene 1", "Chapter 2", "Scene 3", "Midpoint", "Scene 5", "Plot twist", "Scene 7", "Climax", "Scene 9", "Resolution"];

/**
 * Deterministic, simulated scene boundaries for a media item.
 * (Placeholder for real on-device scene detection.)
 */
export function computeScenes(id: string, duration: number, count = 10): Scene[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 33 + id.charCodeAt(i)) % 997;
  const scenes: Scene[] = [];
  const step = duration / count;
  let t = step;
  for (let i = 0; i < count - 1; i++) {
    seed = (seed * 31 + 7) % 61;
    const factor = 0.7 + (seed / 61) * 0.9;
    t += step * factor;
    if (t > duration - 20) break;
    scenes.push({ start: Math.round(t), label: SCENE_LABELS[i % SCENE_LABELS.length] });
  }
  return scenes;
}

/** Best-effort poster initials (up to 3 chars) from a title. */
export function posterInitials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
