# 🎬 Frameo — Media Player

A fast, lightweight desktop media player built with **Tauri 2**, **React 19** and **Vite**. No AI, no ML models, no bloat — just a polished media library and player that stays small and responsive.

## ✨ Features

- **Media library** — add files via native file dialog, drag & drop, or the `Ctrl+O` shortcut; filter (All / Videos / Music / Recently Played), search, sort; auto-generated poster art, durations and resume badges.
- **Player** — custom controls (seek with buffering + hover thumbnails, volume, speed, loop, shuffle, PiP, fullscreen), auto-hiding chrome, keyboard shortcuts, end-of-playback "Up Next" overlay, and a mini now-playing bar that keeps playing while you browse.
- **Manual subtitles** — load `.srt` / `.vtt` files for any video.
- **Up Next queue** — playlist management with autoplay, loop, shuffle and clear.
- **Settings** — dark/light themes, default volume & speed, playback preferences, library management (export / import / clear).
- **Persistence** — library, settings and resume positions are stored locally; playback resumes where you left off.
- **Privacy & size** — 100% offline, zero telemetry, zero bundled model files.

## 🚀 Run it

```bash
bun install          # install JS deps
bun run tauri dev    # run the desktop app (requires Rust toolchain)
```

For UI work only, the frontend also runs in a plain browser (file picking falls back to a standard file input):

```bash
bun run dev          # http://localhost:1420
```

## 🛠️ Build

```bash
bun run build        # typecheck + vite build
cd src-tauri && cargo check   # verify the Rust side
```

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | ------ |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek −10s / +10s (`Shift` = 60s) |
| `↑` / `↓` | Volume |
| `M` | Mute |
| `N` / `P` | Next / previous |
| `F` | Fullscreen (in player) |
| `Q` | Toggle Up Next |
| `Esc` | Close panel / back to library |
| `Ctrl+O` | Add files |

## 📁 Structure

```
src/
  store/                 # app state: library, queue, playback engine, settings, ui
  lib/                   # utils, media-type detection, subtitles, thumbnails, add-media hook
  components/            # Sidebar, LibraryView, PlayerView, NowPlayingBar, QueuePanel,
                         # SettingsModal, MediaInfo, Toasts, MediaCard, Icon
src-tauri/               # Tauri 2 shell (dialog plugin, asset protocol for local playback)
```
