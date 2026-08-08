import { type SubtitleCue, activeCue } from "../lib/subtitles";

interface Props {
  cues: SubtitleCue[];
  time: number;
}

export function SubtitleTrack({ cues, time }: Props) {
  if (cues.length === 0) return null;
  const cue = activeCue(cues, time);
  if (!cue) return null;

  return (
    <div className="theater__caption">
      {cue.text.split("\n").map((line, i) => (
        <span key={i} className="theater__caption-text">
          {line}
        </span>
      ))}
      <span className="theater__caption-tag">Subtitles</span>
    </div>
  );
}
