import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GroupKind, MediaGroup, MediaItem } from "../types";
import { defaultGroupName, deriveTitle, deriveUrlTitle, guessType, hashHue, uid } from "../lib/utils";
import { db } from "../lib/db";

const LS_ITEMS = "frameo.items";
const LS_GROUPS = "frameo.groups";

function loadItems(): MediaItem[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS);
    if (raw) {
      const items: MediaItem[] = JSON.parse(raw);
      return items.filter((i) => !i.isBlob);
    }
  } catch { /* ignore */ }
  return [];
}

function loadGroups(): MediaGroup[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS);
    if (raw) {
      const groups: MediaGroup[] = JSON.parse(raw);
      return groups.filter((g) => g.kind === "playlist" || g.kind === "collection");
    }
  } catch { /* ignore */ }
  return [];
}

interface LibraryContextValue {
  items: MediaItem[];
  addFiles: (paths: string[], blobs?: File[]) => Promise<MediaItem[]>;
  addRemoteUrls: (urls: string[]) => Promise<MediaItem[]>;
  removeItem: (id: string) => void;
  /** Replaces the library contents (used by Settings → Import). */
  importItems: (items: MediaItem[], groups: MediaGroup[]) => void;
  clearLibrary: () => void;
  toggleFavorite: (itemId: string) => void;
  groups: MediaGroup[];
  createGroup: (kind: GroupKind, name: string) => MediaGroup;
  deleteGroup: (id: string) => void;
  addToGroup: (groupId: string, itemId: string) => void;
  removeFromGroup: (groupId: string, itemId: string) => void;
  updateItemDuration: (id: string, duration: number) => void;
  updateItemLastPlayed: (id: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({
  children,
  stopPlaybackRef,
  removeFromQueueRef,
}: {
  children: ReactNode;
  stopPlaybackRef: React.MutableRefObject<(() => void) | null>;
  removeFromQueueRef: React.MutableRefObject<((id: string) => void) | null>;
}) {
  const [items, setItems] = useState<MediaItem[]>(loadItems);
  const [groups, setGroups] = useState<MediaGroup[]>(loadGroups);

  useEffect(() => {
    localStorage.setItem(LS_ITEMS, JSON.stringify(items));
    void db.set(LS_ITEMS, items).catch(() => {});
  }, [items]);

  useEffect(() => {
    localStorage.setItem(LS_GROUPS, JSON.stringify(groups));
    void db.set(LS_GROUPS, groups).catch(() => {});
  }, [groups]);

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

  const removeItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item?.isBlob) URL.revokeObjectURL(item.path);
      // Drop the item from the queue too — if it was the current one, playback
      // advances to the next item instead of leaving a dead "now playing".
      removeFromQueueRef.current?.(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setGroups((prev) =>
        prev.map((g) => (g.itemIds.includes(id) ? { ...g, itemIds: g.itemIds.filter((i) => i !== id) } : g)),
      );
    },
    [items, removeFromQueueRef],
  );

  const importItems = useCallback((newItems: MediaItem[], newGroups: MediaGroup[]) => {
    setItems(newItems);
    setGroups(newGroups);
  }, []);

  const clearLibrary = useCallback(() => {
    stopPlaybackRef.current?.();
    items.forEach((i) => {
      if (i.isBlob) URL.revokeObjectURL(i.path);
    });
    setItems([]);
    setGroups([]);
  }, [items, stopPlaybackRef]);

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

  const updateItemDuration = useCallback((id: string, duration: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, duration } : i)),
    );
  }, []);

  const updateItemLastPlayed = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, lastPlayedAt: Date.now() } : i)),
    );
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      items, addFiles, addRemoteUrls, removeItem, importItems, clearLibrary,
      toggleFavorite, groups, createGroup, deleteGroup, addToGroup, removeFromGroup,
      updateItemDuration, updateItemLastPlayed,
    }),
    [items, groups, addFiles, addRemoteUrls, removeItem, importItems, clearLibrary,
      toggleFavorite, createGroup, deleteGroup, addToGroup, removeFromGroup,
      updateItemDuration, updateItemLastPlayed],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
