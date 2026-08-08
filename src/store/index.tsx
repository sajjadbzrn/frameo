import { useRef, type ReactNode } from "react";
import { SettingsProvider } from "./settings";
import { UIProvider } from "./ui";
import { LibraryProvider } from "./library";
import { PlaybackProvider } from "./playback";

export function AppProvider({ children }: { children: ReactNode }) {
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const removeFromQueueRef = useRef<((id: string) => void) | null>(null);

  return (
    <SettingsProvider>
      <UIProvider>
        <LibraryProvider
          stopPlaybackRef={stopPlaybackRef}
          removeFromQueueRef={removeFromQueueRef}
        >
          <PlaybackProvider onStop={stopPlaybackRef} onRemoveFromQueue={removeFromQueueRef}>
            {children}
          </PlaybackProvider>
        </LibraryProvider>
      </UIProvider>
    </SettingsProvider>
  );
}

export { useSettings } from "./settings";
export { useUI } from "./ui";
export { useLibrary } from "./library";
export { usePlayback } from "./playback";
