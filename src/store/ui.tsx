import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LibraryFilter, Toast, View } from "../types";

interface UIContextValue {
  view: View;
  setView: (v: View) => void;
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  queueOpen: boolean;
  openQueue: (b: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  toasts: Toast[];
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("library");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const openQueue = useCallback((b: boolean) => {
    setQueueOpen(b);
  }, []);

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

  const value = useMemo<UIContextValue>(
    () => ({
      view, setView,
      filter, setFilter,
      search, setSearch,
      queueOpen, openQueue,
      settingsOpen, setSettingsOpen,
      toasts, toast, dismissToast,
    }),
    [view, filter, search, queueOpen, settingsOpen, toasts, toast, dismissToast, openQueue],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
