export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * Parse SRT subtitle text into timed cues.
 * Format: numbered blocks separated by blank lines, each with timestamp line + text.
 */
export function parseSRT(text: string): SubtitleCue[] {
  const blocks = text.replace(/\r/g, "").split(/\n\n+/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // First non-empty line is the index (we don't need it).
    // Find the timestamp line: HH:MM:SS,mmm --> HH:MM:SS,mmm
    const tsLineIdx = lines.findIndex((l) => /-->/.test(l));
    if (tsLineIdx < 0) continue;

    const tsLine = lines[tsLineIdx];
    const tsMatch = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/.exec(tsLine);
    if (!tsMatch) continue;

    const start =
      +tsMatch[1] * 3600 + +tsMatch[2] * 60 + +tsMatch[3] + +tsMatch[4] / 1000;
    const end =
      +tsMatch[5] * 3600 + +tsMatch[6] * 60 + +tsMatch[7] + +tsMatch[8] / 1000;

    // Remaining lines (after timestamp) are the subtitle text.
    const textLines = lines.slice(tsLineIdx + 1).filter(Boolean);
    const cueText = textLines
      .map((l) => l.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .join("\n");

    if (cueText) cues.push({ start, end, text: cueText });
  }

  return cues;
}

/**
 * Parse WebVTT subtitle text into timed cues.
 */
export function parseVTT(text: string): SubtitleCue[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const cues: SubtitleCue[] = [];
  let i = 0;

  // Skip WEBVTT header.
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (!line.includes("-->")) continue;

    const tsMatch = /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/.exec(line);
    if (!tsMatch) continue;

    const start =
      (+tsMatch[1]?.replace(":", "") || 0) * 3600 +
      +tsMatch[2] * 60 +
      +tsMatch[3] +
      +tsMatch[4] / 1000;
    const end =
      (+tsMatch[5]?.replace(":", "") || 0) * 3600 +
      +tsMatch[6] * 60 +
      +tsMatch[7] +
      +tsMatch[8] / 1000;

    // Collect text lines until a blank line or next timestamp.
    const textLines: string[] = [];
    while (i < lines.length) {
      const nl = lines[i].trim();
      if (nl === "" || nl.includes("-->")) break;
      textLines.push(nl.replace(/<[^>]*>/g, "").trim());
      i++;
    }

    const cueText = textLines.filter(Boolean).join("\n");
    if (cueText) cues.push({ start, end, text: cueText });
  }

  return cues;
}

/**
 * Detect subtitle format from file extension or content.
 */
export function detectFormat(pathOrText: string): "srt" | "vtt" | null {
  if (/\.srt$/i.test(pathOrText)) return "srt";
  if (/\.vtt$/i.test(pathOrText)) return "vtt";
  if (/^WEBVTT/i.test(pathOrText.trim())) return "vtt";
  // SRT starts with a number on the first line.
  if (/^\d+\s*$/.test(pathOrText.trim().split("\n")[0]?.trim() ?? "")) return "srt";
  return null;
}

/**
 * Parse subtitle file content, auto-detecting format.
 */
export function parseSubtitles(text: string): SubtitleCue[] {
  const format = detectFormat(text);
  if (format === "vtt") return parseVTT(text);
  if (format === "srt") return parseSRT(text);
  // Fall back to trying SRT first.
  const srt = parseSRT(text);
  if (srt.length > 0) return srt;
  return parseVTT(text);
}

/**
 * Find the active subtitle cue for the current playback time.
 */
export function activeCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  for (const c of cues) {
    if (time >= c.start && time <= c.end) return c;
  }
  return null;
}
