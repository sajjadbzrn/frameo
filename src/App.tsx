import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { AppProvider, usePlayback, useUI, useLibrary } from "./store";
import { isTauri } from "./lib/utils";
import { Icon } from "./components/Icon";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LibraryView } from "./components/LibraryView";
import { PlayerView } from "./components/PlayerView";
import { NowPlayingBar } from "./components/NowPlayingBar";
const QueuePanel = lazy(() => import("./components/QueuePanel").then(m => ({ default: m.QueuePanel })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(m => ({ default: m.SettingsModal })));
import { Toasts } from "./components/Toasts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShortcutOverlay } from "./components/ShortcutOverlay";
import "./App.css";

function Shell() {
  const {
    view,
    setView,
    queueOpen,
    openQueue,
    settingsOpen,
    setSettingsOpen,
    toast,
  } = useUI();
  const {
    current,
    position,
    volume,
    togglePlay,
    toggleMute,
    next,
    prev,
    seek,
    setVolume,
    playItem,
    addToQueue,
  } = usePlayback();
  const { addFiles, addRemoteUrls } = useLibrary();

  const [dragActive, setDragActive] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /* ---------------- Tauri: tray & global media key events ---------------- */
  useEffect(() => {
    // Tauri-only — the event API throws outside the desktop runtime.
    if (!isTauri()) return;

    let unlistenTray: (() => void) | undefined;
    let unlistenShortcut: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen("tray:play-pause", () => togglePlay()).then((fn) => { unlistenTray = fn; }).catch(() => {});
        listen("tray:next", () => next(true)).catch(() => {});
        listen("tray:prev", () => prev()).catch(() => {});
        listen("shortcut", (e) => {
          const key = e.payload as string;
          if (key === "MediaPlayPause") togglePlay();
          else if (key === "MediaNextTrack") next(true);
          else if (key === "MediaPrevTrack") prev();
        }).then((fn) => { unlistenShortcut = fn; }).catch(() => {});
      })
      .catch(() => {});

    return () => {
      unlistenTray?.();
      unlistenShortcut?.();
    };
  }, [togglePlay, next, prev]);

  // Latest values for the global keydown handler, so the listener doesn't
  // re-attach on every playback tick.
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  /* ---------------- global keyboard shortcuts ---------------- */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
      );
    };

    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);
      if (typing && e.key !== "Escape" && !(e.ctrlKey && e.key.toLowerCase() === "o")) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          if (current && !typing) {
            e.preventDefault();
            togglePlay();
          }
          break;
        case "m":
        case "M":
          if (current && !typing) toggleMute();
          break;
        case "ArrowLeft":
          if (current && !queueOpen && !settingsOpen) {
            e.preventDefault();
            seek(e.shiftKey ? positionRef.current - 60 : positionRef.current - 10);
          }
          break;
        case "ArrowRight":
          if (current && !queueOpen && !settingsOpen) {
            e.preventDefault();
            seek(e.shiftKey ? positionRef.current + 60 : positionRef.current + 10);
          }
          break;
        case "ArrowUp":
          if (current && !queueOpen && !settingsOpen) {
            e.preventDefault();
            setVolume(volumeRef.current + 0.05);
          }
          break;
        case "ArrowDown":
          if (current && !queueOpen && !settingsOpen) {
            e.preventDefault();
            setVolume(volumeRef.current - 0.05);
          }
          break;
        case "n":
        case "N":
          if (current && !typing) next(true);
          break;
        case "p":
        case "P":
          if (current && !typing) prev();
          break;
        case "q":
        case "Q":
          if (!typing) openQueue(!queueOpen);
          break;
        case "Escape":
          if (shortcutsOpen) setShortcutsOpen(false);
          else if (settingsOpen) setSettingsOpen(false);
          else if (queueOpen) openQueue(false);
          else if (view === "player") setView("library");
          break;
        default:
          if (e.ctrlKey && e.key.toLowerCase() === "o") {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("frameo:add-media"));
          } else if (e.key === "?" && !typing) {
            e.preventDefault();
            setShortcutsOpen((s) => !s);
          }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    current, togglePlay, toggleMute, next, prev, seek, setVolume,
    queueOpen, openQueue,
    settingsOpen, setSettingsOpen, view, setView, shortcutsOpen,
  ]);

  /* ---------------- drag & drop media & links ---------------- */
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const files = Array.from(dt.files ?? []);

      // 1) Real local files (dragged from the OS file manager) take precedence.
      if (isTauri()) {
        const paths = files
          .map((f) => (f as File & { path?: string }).path)
          .filter((p): p is string => !!p);
        if (paths.length > 0) {
          void addFiles(paths).then((added) =>
            toast(
              added.length === 1 ? `Added “${added[0].title}” to your library` : `Added ${added.length} files to your library`,
              "success",
            ),
          );
          return;
        }
      }

      // 2) Dragged links (from a browser, chat, editor…). The first link plays
      //    right away; any additional links go to Up Next.
      const droppedUrls = extractUrls(dt);
      if (droppedUrls.length > 0) {
        void addRemoteUrls(droppedUrls).then((added) => {
          toast(
            added.length === 1
              ? `Added “${added[0].title}” to your library`
              : `Added ${added.length} links to your library`,
            "success",
          );
          playItem(added[0]);
          added.slice(1).forEach((item) => addToQueue(item));
        });
        return;
      }

      // 3) Browser-dropped blob files (dev/web preview).
      if (files.length === 0) return;
      const blobUrls = files.map((f) => URL.createObjectURL(f));
      void addFiles(blobUrls, files).then((added) =>
        toast(
          added.length === 1 ? `Added “${added[0].title}” to your library` : `Added ${added.length} files to your library`,
          "success",
        ),
      );
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, addRemoteUrls, playItem, addToQueue, toast]);

  /* Ctrl+O dispatches "frameo:add-media", handled by the TopBar (which owns
     the add-media input). */

  const playerActive = view === "player" && !!current;

  return (
    <div className={`app app--${view}`}>
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      <main className="app-main">
        <TopBar />
        <div className="app-body">
          <ErrorBoundary>
            <LibraryView hidden={playerActive} />
          </ErrorBoundary>
          <ErrorBoundary>
            <PlayerView hidden={!playerActive} />
          </ErrorBoundary>
        </div>
      </main>

      <Suspense>
        <QueuePanel />
      </Suspense>
      <Suspense>
        <SettingsModal />
      </Suspense>
      <Toasts />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {view === "library" && current && <NowPlayingBar />}

      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay__card">
            <Icon name="plus" size={28} />
            <p>Drop files or links to add them to your library</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Extract http(s)/ftp URLs from a drop payload (uri-list, then plain text). */
function extractUrls(dt: DataTransfer): string[] {
  const out: string[] = [];
  for (const kind of ["text/uri-list", "text/plain"]) {
    const text = dt.getData(kind);
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (/^https?:\/\//i.test(t) || /^ftp:\/\//i.test(t)) out.push(t);
    }
  }
  return [...new Set(out)];
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
