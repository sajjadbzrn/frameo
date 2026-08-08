import { useCallback, useEffect, useRef, useState, lazy, Suspense, type CSSProperties } from "react";
import { usePlayback, useSettings, useUI, useLibrary } from "../store";
import { formatTime, posterInitials } from "../lib/utils";
import { generateThumbnails, nearestThumbnail } from "../lib/thumbnails";
const AudioVisualizer = lazy(() => import("./AudioVisualizer").then(m => ({ default: m.AudioVisualizer })));
import { Icon } from "./Icon";
import { ContextMenu } from "./ContextMenu";
import { SubtitleTrack } from "./SubtitleTrack";
import { MediaInfo } from "./MediaInfo";
import { parseSubtitles, type SubtitleCue } from "../lib/subtitles";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerView({ hidden }: { hidden: boolean }) {
  const {
    current,
    videoRef,
    playing,
    position,
    duration,
    buffered,
    volume,
    muted,
    rate,
    loop,
    shuffle,
    ended,
    error,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setRate,
    toggleLoop,
    toggleShuffle,
    queue,
    queueIndex,
  } = usePlayback();
  const { settings } = useSettings();
  const { setView } = useUI();
  const { removeItem } = useLibrary();

  const theaterRef = useRef<HTMLDivElement | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [bump, setBump] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [hover, setHover] = useState<{ pct: number; time: number } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [mediaInfoOpen, setMediaInfoOpen] = useState(false);

  /* ---------- thumbnail generation ---------- */
  useEffect(() => {
    if (!current || duration <= 0) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    generateThumbnails(video, duration, 20).then((frames) => {
      if (!cancelled) setThumbnails(frames);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, Math.round(duration)]);

  /* ---------- auto-hide controls ---------- */
  useEffect(() => {
    if (!playing || ended || error) {
      setControlsVisible(true);
      return;
    }
    const t = window.setTimeout(() => setControlsVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [playing, ended, error, bump]);

  // Throttled mousemove: reveal the controls and re-arm the auto-hide timer.
  const rafRef = useRef(0);
  const onMove = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      setControlsVisible(true);
      setBump((b) => b + 1);
    });
  }, []);
  useEffect(() => () => window.cancelAnimationFrame(rafRef.current), []);

  /* ---------- fullscreen state ---------- */
  useEffect(() => {
    const el = theaterRef.current;
    if (!el) return;
    const onFs = () => setFullscreen(document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = theaterRef.current;
    if (!el) return;
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const anyEl = el as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) void doc.exitFullscreen();
      else (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
    } else if (anyEl.requestFullscreen) {
      void anyEl.requestFullscreen().catch(() => undefined);
    } else {
      anyEl.webkitRequestFullscreen?.();
    }
  }, []);

  /* ---------- picture in picture ---------- */
  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else if (document.pictureInPictureEnabled) {
      void v.requestPictureInPicture().catch(() => undefined);
    }
  }, [videoRef]);

  /* ---------- buffering state ---------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onWait = () => setWaiting(true);
    const onReady = () => setWaiting(false);
    v.addEventListener("waiting", onWait);
    v.addEventListener("playing", onReady);
    v.addEventListener("canplay", onReady);
    return () => {
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("playing", onReady);
      v.removeEventListener("canplay", onReady);
    };
  }, [videoRef]);

  /* ---------- keyboard: fullscreen (video only) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (current?.type !== "video") return;
      if (e.key === "f" || e.key === "F") {
        if (!(e.target instanceof HTMLInputElement)) toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, current?.type]);

  if (!current) {
    return (
      <section className={`player ${hidden ? "is-hidden" : ""}`}>
        <div className="theater theater--empty">
          <Icon name="film" size={40} />
          <p>Nothing playing yet</p>
          <button className="btn btn--primary" onClick={() => setView("library")}>
            Browse library
          </button>
        </div>
      </section>
    );
  }

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const nextIndex = queueIndex + 1 < queue.length ? queueIndex + 1 : settings.loop ? 0 : -1;
  const nextItem = nextIndex >= 0 ? queue[nextIndex] : null;

  const theaterStyle = { "--h": current.hue } as CSSProperties;

  return (
    <section className={`player ${hidden ? "is-hidden" : ""}`}>
      <div
        ref={theaterRef}
        className={`theater ${fullscreen ? "theater--fullscreen" : ""}`}
        style={theaterStyle}
        onMouseMove={onMove}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      >
        <video
          ref={videoRef}
          className="theater__video"
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* Audio visualization (real Web Audio analyser reacting to the music) */}
        {current.type === "audio" && (
          <div className={`theater__audio ${playing ? "is-playing" : "is-paused"}`}>
            <Suspense fallback={null}>
              <AudioVisualizer />
            </Suspense>
            <div className="theater__disc" style={theaterStyle} aria-hidden="true">
              <span className="theater__disc-initials">{posterInitials(current.title)}</span>
              <span className="theater__disc-sheen" />
            </div>
          </div>
        )}

        {waiting && (
          <div className="theater__spinner">
            <span className="spinner" />
            <span className="theater__spinner-label">Buffering…</span>
          </div>
        )}

        {/* top chrome */}
        <div className={`theater__chrome theater__chrome--top ${controlsVisible ? "is-visible" : ""}`}>
          <div className="theater__top-left">
            <button
              className="btn btn--glass"
              onClick={() => setView("library")}
              title="Back to library (Esc)"
            >
              <Icon name="back" size={18} />
              <span className="btn--icon-label">Library</span>
            </button>
            <div className="theater__title">
              <p className="theater__title-name">{current.title}</p>
              <p className="theater__title-meta">
                {current.type === "audio" ? "Audio track" : "Video"} · now playing
              </p>
            </div>
          </div>
        </div>

        {/* center play/pause */}
        <button
          className={`theater__center ${playing && !controlsVisible ? "theater__center--ghost" : ""}`}
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          <Icon name={playing ? "pause" : "play"} size={30} />
        </button>

        {/* Captions — manual .srt/.vtt subtitles */}
        {subtitles.length > 0 && (
          <SubtitleTrack cues={subtitles} time={position} />
        )}

        {/* bottom chrome */}
        <div className={`theater__chrome theater__chrome--bottom ${controlsVisible ? "is-visible" : ""}`}>
          <div
            className="seek"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setHover({ pct: p * 100, time: p * (duration || 0) });
            }}
            onMouseLeave={() => setHover(null)}
          >
            <input
              className="seek__input"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={position}
              style={{ "--p": `${pct}%`, "--b": `${bufPct}%` } as CSSProperties}
              onChange={(e) => seek(Number(e.target.value))}
              onPointerDown={() => setControlsVisible(true)}
              aria-label="Seek"
            />
            {hover && (
              <>
                {thumbnails.length > 0 && hover.time > 0 && (
                  <span
                    className="seek__thumb"
                    style={{
                      left: `${hover.pct}%`,
                      backgroundImage: `url(${thumbnails[nearestThumbnail(hover.time, duration, thumbnails.length)]})`,
                    }}
                  />
                )}
                <span className="seek__tooltip" style={{ left: `${hover.pct}%` }}>
                  {formatTime(hover.time)}
                </span>
              </>
            )}
          </div>

          <div className="theater__controls">
            <div className="theater__controls-left">
              <button className="btn btn--glass btn--icon" onClick={togglePlay} title="Play / Pause (Space)" aria-label="Play or pause">
                <Icon name={playing ? "pause" : "play"} size={20} />
              </button>
              <button className="btn btn--glass btn--icon" onClick={() => prev()} title="Previous (P)" aria-label="Previous">
                <Icon name="prev" size={18} />
              </button>
              <button className="btn btn--glass btn--icon" onClick={() => next()} title="Next (N)" aria-label="Next">
                <Icon name="next" size={18} />
              </button>
              <div className="volume">
                <button className="btn btn--glass btn--icon" onClick={toggleMute} title="Mute (M)" aria-label="Mute">
                  <Icon name={muted || volume === 0 ? "mute" : "volume"} size={18} />
                </button>
                <input
                  className="volume__input"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  style={{ "--p": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
              </div>
              <span className="theater__time">
                {formatTime(position)} <em>/</em> {duration > 0 ? formatTime(duration) : "–:––"}
              </span>
            </div>

            <div className="theater__controls-right">
              <div className="menu">
                <button
                  className={`btn btn--glass btn--sm ${rate !== 1 ? "btn--accent" : ""}`}
                  onClick={() => setRateOpen((o) => !o)}
                  title="Playback speed"
                  aria-label="Playback speed"
                >
                  {rate}x
                </button>
                {rateOpen && (
                  <>
                    <div className="menu__scrim" onClick={() => setRateOpen(false)} />
                    <div className="menu__pop menu__pop--up">
                      {RATES.map((r) => (
                        <button key={r} className={r === rate ? "is-selected" : ""} onClick={() => { setRate(r); setRateOpen(false); }}>
                          {r}x {r === 1 ? "(normal)" : ""}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {current.type === "video" && (
                <button
                  className={`btn btn--glass btn--icon ${subtitles.length > 0 ? "btn--accent" : ""}`}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".srt,.vtt";
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const cues = parseSubtitles(reader.result as string);
                          if (cues.length > 0) {
                            setSubtitles(cues);
                          }
                        } catch { /* ignore */ }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  title={subtitles.length > 0 ? "Subtitles loaded" : "Load subtitles (.srt/.vtt)"}
                  aria-label="Load subtitles"
                >
                  <Icon name="info" size={17} />
                </button>
              )}
              <button className={`btn btn--glass btn--icon ${loop ? "btn--accent" : ""}`} onClick={toggleLoop} title="Loop" aria-label="Loop">
                <Icon name="repeat" size={17} />
              </button>
              {current.type === "audio" && (
                <button className={`btn btn--glass btn--icon ${shuffle ? "btn--accent" : ""}`} onClick={toggleShuffle} title="Shuffle" aria-label="Shuffle">
                  <Icon name="shuffle" size={17} />
                </button>
              )}
              {current.type === "video" && "pictureInPictureEnabled" in document && (
                <button className="btn btn--glass btn--icon" onClick={togglePip} title="Picture in picture" aria-label="Picture in picture">
                  <Icon name="pip" size={17} />
                </button>
              )}
              <button className="btn btn--glass btn--icon" onClick={() => setMediaInfoOpen(true)} title="Media info" aria-label="Media info">
                <Icon name="sliders" size={17} />
              </button>
              {current.type === "video" && (
                <button className="btn btn--glass btn--icon" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">
                  <Icon name={fullscreen ? "fullscreen-exit" : "fullscreen"} size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* end overlay */}
        {ended && !error && (
          <div className="theater__overlay">
            <div className="theater__end-card">
              <div className="theater__end-art">
                <span>{posterInitials(current.title)}</span>
              </div>
              <h2 className="theater__end-title">Playback complete</h2>
              <p className="theater__end-sub">Nice — “{current.title}” finished.</p>
              <div className="theater__end-actions">
                <button className="btn btn--primary" onClick={() => { seek(0); togglePlay(); }}>
                  <Icon name="repeat" size={16} /> Play again
                </button>
                <button className="btn btn--ghost" onClick={() => setView("library")}>
                  Back to library
                </button>
              </div>
              {nextItem && (
                <button className="theater__next" onClick={() => next(true)}>
                  <span className="theater__next-thumb">
                    <span style={{ "--h": nextItem.hue } as CSSProperties}>{posterInitials(nextItem.title)}</span>
                  </span>
                  <span className="theater__next-info">
                    <em>Up next</em>
                    <strong>{nextItem.title}</strong>
                  </span>
                  <span className="theater__next-go">
                    <Icon name="play" size={16} />
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* error overlay */}
        {error && (
          <div className="theater__overlay">
            <div className="theater__error-card">
              <div className="theater__error-icon"><Icon name="alert" size={26} /></div>
              <h2 className="theater__end-title">Couldn't play this file</h2>
              <p className="theater__end-sub">
                {current.isRemote
                  ? `Couldn't play “${current.title}”. This link may not be a direct media file — try a direct video or audio URL (.mp4, .webm, .mp3…).`
                  : `Frameo couldn't decode “${current.title}”. The format may be unsupported or the file may be damaged.`}
              </p>
              <div className="theater__end-actions">
                <button className="btn btn--ghost" onClick={() => setView("library")}>Back to library</button>
                <button
                  className="btn btn--ghost btn--danger"
                  onClick={() => { removeItem(current.id); setView("library"); }}
                >
                  <Icon name="trash" size={15} /> Remove from library
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ContextMenu
        items={[
          ...(current.type === "video"
            ? [
                { label: "Toggle fullscreen", icon: <Icon name="fullscreen" size={15} />, onClick: toggleFullscreen },
                { label: "Picture in picture", icon: <Icon name="pip" size={15} />, onClick: togglePip, dividerAfter: true },
              ]
            : []),
          { label: "Remove from library", icon: <Icon name="trash" size={15} />, onClick: () => { removeItem(current.id); setView("library"); }, danger: true },
        ]}
        position={ctxMenu}
        onClose={() => setCtxMenu(null)}
      />
      <MediaInfo open={mediaInfoOpen} onClose={() => setMediaInfoOpen(false)} />
    </section>
  );
}
