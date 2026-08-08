import { usePlayback } from "../store";
import { formatTime, formatBytes } from "../lib/utils";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MediaInfo({ open, onClose }: Props) {
  const { videoRef, current, duration, volume } = usePlayback();
  if (!open || !current) return null;

  const video = videoRef.current;
  const width = video?.videoWidth ?? 0;
  const height = video?.videoHeight ?? 0;

  return (
    <>
      <div className="panel-scrim" onClick={onClose} />
      <aside className="sidepanel" role="dialog" aria-label="Media info">
        <header className="sidepanel__head">
          <h2 className="sidepanel__title">Media info</h2>
          <button className="btn btn--ghost btn--icon sidepanel__close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="media-info__analysis">
          <div className="analysis-grid">
            <div className="analysis-card">
              <span className="analysis-card__label">Type</span>
              <strong>{current.type === "audio" ? "Audio" : "Video"}</strong>
            </div>
            <div className="analysis-card">
              <span className="analysis-card__label">Duration</span>
              <strong>{formatTime(duration)}</strong>
            </div>
            {width > 0 && (
              <div className="analysis-card">
                <span className="analysis-card__label">Resolution</span>
                <strong>{width} × {height}</strong>
              </div>
            )}
            <div className="analysis-card">
              <span className="analysis-card__label">Path</span>
              <strong style={{ wordBreak: "break-all", fontSize: "11px" }}>{current.isRemote ? current.path : current.path.split(/[/\\]/).pop()}</strong>
            </div>
            {current.size && (
              <div className="analysis-card">
                <span className="analysis-card__label">File size</span>
                <strong>{formatBytes(current.size)}</strong>
              </div>
            )}
            <div className="analysis-card">
              <span className="analysis-card__label">Volume</span>
              <strong>{Math.round(volume * 100)}%</strong>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
