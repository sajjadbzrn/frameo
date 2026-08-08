# 🎬 Frameo — AI Media Player

A next-generation media player desktop app built with **Tauri 2**, **React 19** and **Vite**. This is the MVP: a polished media library + player with simulated on-device AI features, designed so real inference (Whisper subtitles, scene detection, Copilot) can drop in later.

## ✨ What's in the MVP

- **Media library** — add files via native file dialog, drag & drop, or the `Ctrl+O` shortcut; filter (All / Videos / Music / Recently Played), search, sort; auto-generated poster art, durations and resume badges.
- **Player** — custom controls (seek with buffering + scene markers, volume, speed, loop, shuffle, PiP, fullscreen), auto-hiding chrome, keyboard shortcuts, end-of-playback "Up Next" overlay, and a mini now-playing bar that keeps playing while you browse.
- **Up Next queue** — playlist management with autoplay, loop, shuffle and clear.
- **AI Copilot (simulated preview)** — analyzes the current item (genre, mood, scene count, key moments), one-tap enhancement toggles (AI subtitles, scene markers, auto-skip intros) and a chat assistant.
- **Settings** — dark/light themes, default volume & speed, playback preferences, AI feature toggles, library management.
- **Persistence** — library, settings and resume positions are stored locally; playback resumes where you left off.

> The AI features are simulated previews. Real on-device inference ships in a future release.

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
| `C` | Toggle AI Copilot |
| `Q` | Toggle Up Next |
| `Esc` | Close panel / back to library |
| `Ctrl+O` | Add files |

## 📁 Structure

```
src/
  store.tsx              # app state: library, queue, playback engine, settings, toasts
  lib/                   # utils, media-type detection, scene simulation, add-media hook
  components/            # Sidebar, LibraryView, PlayerView, NowPlayingBar, QueuePanel,
                         # CopilotPanel, SettingsModal, Toasts, MediaCard, Icon
src-tauri/               # Tauri 2 shell (dialog plugin, asset protocol for local playback)
```
