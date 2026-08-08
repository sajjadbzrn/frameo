import type { CSSProperties } from "react";
import { useApp } from "../store";
import { formatTime, posterInitials } from "../lib/utils";
import { Icon } from "./Icon";

export function NowPlayingBar() {
  const {
    current,
    playing,
    position,
    duration,
    volume,
    muted,
    togglePlay,
    prev,
    next,
    seek,
    setVolume,
    toggleMute,
    setView,
    openQueue,
    queueOpen,
  } = useApp();

  if (!current) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const hue = { "--h": current.hue } as CSSProperties;

  return (
    <div className="nowplaying">
      <button className="nowplaying__item" onClick={() => setView("player")} title="Open player">
        <span className="nowplaying__thumb" style={hue}>
          {posterInitials(current.title)}
        </span>
        <span className="nowplaying__meta">
          <span className="nowplaying__title">{current.title}</span>
          <span className="nowplaying__sub">
            {playing ? "Now playing" : "Paused"} · {current.type === "audio" ? "Audio" : "Video"}
          </span>
        </span>
      </button>

      <div className="nowplaying__center">
        <div className="nowplaying__buttons">
          <button className="btn btn--ghost btn--icon" onClick={prev} title="Previous (P)" aria-label="Previous">
            <Icon name="prev" size={16} />
          </button>
          <button className="nowplaying__play" onClick={togglePlay} title="Play / Pause (Space)" aria-label="Play or pause">
            <Icon name={playing ? "pause" : "play"} size={18} />
          </button>
          <button className="btn btn--ghost btn--icon" onClick={() => next()} title="Next (N)" aria-label="Next">
            <Icon name="next" size={16} />
          </button>
        </div>
        <div className="nowplaying__seek">
          <span className="nowplaying__time">{formatTime(position)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={position}
            style={{ "--p": `${pct}%` } as CSSProperties}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
          <span className="nowplaying__time">{duration > 0 ? formatTime(duration) : "–:––"}</span>
        </div>
      </div>

      <div className="nowplaying__right">
        <button className="btn btn--ghost btn--icon" onClick={toggleMute} title="Mute (M)" aria-label="Mute">
          <Icon name={muted || volume === 0 ? "mute" : "volume"} size={17} />
        </button>
        <input
          className="nowplaying__volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          style={{ "--p": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
        <button
          className={`btn btn--ghost btn--icon ${queueOpen ? "btn--active" : ""}`}
          onClick={() => openQueue(!queueOpen)}
          title="Up Next (Q)"
          aria-label="Up Next queue"
        >
          <Icon name="list" size={17} />
        </button>
        <button className="btn btn--primary btn--icon" onClick={() => setView("player")} title="Open player (Enter)" aria-label="Open player">
          <Icon name="expand" size={17} />
        </button>
      </div>
    </div>
  );
}
