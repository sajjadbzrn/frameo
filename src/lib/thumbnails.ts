/**
 * Generates thumbnail preview frames from a video element.
 * Creates a hidden clone, seeks through positions, captures frames to data URLs.
 * Non-blocking — returns a promise that resolves when all thumbnails are ready.
 */
export function generateThumbnails(
  video: HTMLVideoElement,
  duration: number,
  count = 20,
): Promise<string[]> {
  return new Promise((resolve) => {
    if (duration <= 0 || count <= 0) {
      resolve([]);
      return;
    }

    const clone = video.cloneNode(true) as HTMLVideoElement;
    clone.muted = true;
    clone.preload = "auto";
    // Hide it — we just need the video pipeline, not the element.
    clone.style.position = "absolute";
    clone.style.width = "1px";
    clone.style.height = "1px";
    clone.style.opacity = "0";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    const frames: string[] = [];
    const step = duration / count;
    let idx = 0;

    const capture = () => {
      if (idx >= count) {
        document.body.removeChild(clone);
        resolve(frames);
        return;
      }
      const t = step * (idx + 0.5);
      clone.currentTime = t;
    };

    const onSeeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(clone, 0, 0, 160, 90);
        frames.push(canvas.toDataURL("image/jpeg", 0.45));
      } else {
        frames.push("");
      }
      idx++;
      capture();
    };

    const onLoaded = () => {
      clone.removeEventListener("loadedmetadata", onLoaded);
      capture();
    };

    clone.addEventListener("seeked", onSeeked);
    clone.addEventListener("loadedmetadata", onLoaded);

    // If already loaded (same source, e.g. Tauri asset protocol), start immediately.
    if (clone.readyState >= 1) {
      capture();
    }
  });
}

/** Find the index of the thumbnail closest to a given time. */
export function nearestThumbnail(time: number, duration: number, count: number): number {
  if (count <= 0 || duration <= 0) return 0;
  const step = duration / count;
  return Math.min(count - 1, Math.max(0, Math.floor(time / step)));
}
