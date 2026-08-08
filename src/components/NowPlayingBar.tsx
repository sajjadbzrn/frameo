import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { usePlayback, useUI } from "../store";
import { formatTime, posterInitials } from "../lib/utils";
import { Icon } from "./Icon";

const TIMER_PRESETS = [15, 30, 60] as const;

export function NowPlayingBar() {
  const {
    current, playing, position, duration, volume, muted, videoRef,
    togglePlay, prev, next, seek, setVolume, toggleMute,
  } = usePlayback();
  const { setView, openQueue, queueOpen, toast } = useUI();

  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [stopAfterTrack, setStopAfterTrack] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const lastTrackIdRef = useRef<string | null>(current?.id ?? null);

  // Check if sleep timer has expired.
  useEffect(() => {
    if (!sleepUntil || !playing) return;
    const id = window.setInterval(() => {
      if (Date.now() >= sleepUntil) {
        setSleepUntil(null);
        togglePlay();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepUntil, playing, togglePlay]);

  const setSleep = useCallback((minutes: number) => {
    setSleepUntil(Date.now() + minutes * 60 * 1000);
    setStopAfterTrack(false);
    setTimerOpen(false);
  }, []);

  // Stop when the current track changes (ended naturally, or was skipped).
  // A short delay lets the new source finish loading before we pause, so the
  // pause always wins over the autoplay that kicked in on the next track.
  const sleepEndOfTrack = useCallback(() => {
    setStopAfterTrack(true);
    setSleepUntil(null);
    setTimerOpen(false);
    toast("Sleep timer: stop after this track", "info");
  }, [toast]);

  const lastPosRef = useRef(position);
  useEffect(() => {
    lastPosRef.current = position;
  }, [position]);

  useEffect(() => {
    lastTrackIdRef.current = current?.id ?? null;
  }, [current?.id]);

  // Clear the timer when the track ends naturally (autoplay off / end of queue).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stopAfterTrack) return;
    const onEnded = () => {
      setStopAfterTrack(false);
      setSleepUntil(null);
    };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [videoRef, stopAfterTrack]);

  // Stop when the current track moves on (ended → next, or skipped manually)
  // or loops back to the start (single-track loop). A short delay lets the new
  // source finish loading so the pause always wins over autoplay.
  useEffect(() => {
    if (!stopAfterTrack || !current) return;
    const trackChanged = lastTrackIdRef.current !== current.id;
    const loopedBack = position < 2 && lastPosRef.current > duration - 2;
    if (trackChanged || loopedBack) {
      setStopAfterTrack(false);
      setSleepUntil(null);
      const v = videoRef.current;
      window.setTimeout(() => v?.pause(), 120);
      toast("Sleep timer: stopped playback", "info");
    }
  }, [current, stopAfterTrack, videoRef, toast, position, duration]);

  // Cancel the stop-after-track timer when the timer is disabled from the menu.
  const cancelSleep = useCallback(() => {
    setSleepUntil(null);
    setStopAfterTrack(false);
    setTimerOpen(false);
  }, []);

  if (!current) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const hue = { "--h": current.hue } as CSSProperties;
  const sleepRemaining = sleepUntil ? Math.max(0, Math.ceil((sleepUntil - Date.now()) / 1000)) : 0;

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
        {/* Sleep timer */}
        <div style={{ position: "relative" }}>
          <button
            className={`btn btn--ghost btn--icon ${sleepUntil || stopAfterTrack ? "btn--active" : ""}`}
            onClick={() => setTimerOpen((o) => !o)}
            title={
              sleepUntil
                ? `Sleep timer: ${formatTime(sleepRemaining)}`
                : stopAfterTrack
                  ? "Sleep timer: after current track"
                  : "Sleep timer"
            }
            aria-label="Sleep timer"
          >
            <Icon name="clock" size={17} />
          </button>
          {timerOpen && (
            <>
              <div className="menu__scrim" onClick={() => setTimerOpen(false)} />
              <div className="menu__pop menu__pop--up">
                {(sleepUntil || stopAfterTrack) && (
                  <button onClick={cancelSleep}>
                    Disable timer
                    {sleepUntil ? ` (${formatTime(sleepRemaining)})` : ""}
                  </button>
                )}
                <button onClick={() => { sleepEndOfTrack(); }}>After current track</button>
                <div className="card__menu-divider" />
                {TIMER_PRESETS.map((m) => (
                  <button key={m} onClick={() => setSleep(m)}>{m} minutes</button>
                ))}
              </div>
            </>
          )}
        </div>

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
