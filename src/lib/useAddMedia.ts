import { useCallback, useRef } from "react";
import { useApp } from "../store";
import { isTauri } from "./utils";

export const MEDIA_EXTENSIONS = [
  "mp4", "mkv", "mov", "webm", "avi", "m4v", "wmv", "flv", "mpg", "mpeg", "ts",
  "mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma", "aiff",
];

/**
 * Shared "add media" flow. Uses the native Tauri file dialog when running in
 * the desktop app, and falls back to a hidden `<input type="file">` in the
 * browser (used for development and the web preview).
 */
export function useAddMedia() {
  const { addFiles, toast } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFiles = useCallback(async () => {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: true,
          title: "Add media to Frameo",
          filters: [{ name: "Audio & Video", extensions: MEDIA_EXTENSIONS }],
        });
        if (!selected) return;
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length === 0) return;
        const added = await addFiles(paths);
        toast(
          added.length === 1
            ? `Added “${added[0].title}” to your library`
            : `Added ${added.length} files to your library`,
          "success",
        );
      } catch {
        toast("Couldn't open the file dialog", "error");
      }
    } else {
      inputRef.current?.click();
    }
  }, [addFiles, toast]);

  const onFilesChosen = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      const urls = list.map((f) => URL.createObjectURL(f));
      void addFiles(urls, list).then((added) => {
        toast(
          added.length === 1
            ? `Added “${added[0].title}” to your library`
            : `Added ${added.length} files to your library`,
          "success",
        );
      });
    },
    [addFiles, toast],
  );

  return { pickFiles, onFilesChosen, inputRef };
}
