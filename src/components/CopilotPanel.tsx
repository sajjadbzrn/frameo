import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "../store";
import { computeScenes, formatTime, posterInitials } from "../lib/utils";
import { Icon } from "./Icon";
import { Toggle } from "./QueuePanel";

const STEPS = [
  "Reading metadata…",
  "Detecting scene changes…",
  "Classifying content…",
  "Generating insights…",
];

const GENRES = [
  "Sci-Fi Thriller", "Drama", "Documentary", "Action", "Romance",
  "Horror", "Comedy", "Adventure", "Mystery", "Musical",
];


function moodForHue(h: number): string {
  if (h < 30 || h >= 330) return "Intense · Dramatic";
  if (h < 60) return "Warm · Uplifting";
  if (h < 150) return "Calm · Reflective";
  if (h < 220) return "Cool · Mysterious";
  if (h < 290) return "Dramatic · Moody";
  return "Dark · Suspenseful";
}

function genreForTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % GENRES.length;
  return GENRES[h];
}

export function CopilotPanel() {
  const {
    copilotOpen,
    openCopilot,
    current,
    items,
    duration,
    settings,
    updateSettings,
    seek,
    playItem,
  } = useApp();

  const analyzedRef = useRef<string | null>(null);
  const [step, setStep] = useState(0);

  const scenes = current ? computeScenes(current.id, duration) : [];
  const done = step >= STEPS.length;

  useEffect(() => {
    if (!copilotOpen || !current) return;
    if (analyzedRef.current === current.id) {
      setStep(STEPS.length);
      return;
    }
    analyzedRef.current = current.id;
    setStep(0);
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), 480 * (i + 1)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [copilotOpen, current]);

  if (!copilotOpen) return null;

  /* ---------- recommendations (deterministic, excluding current) ---------- */
  let recs: typeof items = [];
  if (current) {
    const others = items.filter((i) => i.id !== current.id);
    recs = [...others]
      .sort((a, b) => {
        let ha = 0;
        let hb = 0;
        for (const c of a.id) ha = (ha * 33 + c.charCodeAt(0)) % 997;
        for (const c of b.id) hb = (hb * 33 + c.charCodeAt(0)) % 997;
        return ha - hb;
      })
      .slice(0, 3);
  }

  const keyMoments = scenes.length >= 3 ? [scenes[0], scenes[Math.floor(scenes.length / 2)], scenes[scenes.length - 1]] : scenes.slice(0, 3);

  return (
    <>
      <div className="panel-scrim" onClick={() => openCopilot(false)} />
      <aside className="sidepanel sidepanel--right sidepanel--wide" role="dialog" aria-label="Frameo Copilot">
        <header className="sidepanel__head sidepanel__head--ai">
          <div className="ai-badge">
            <Icon name="sparkles" size={18} />
          </div>
          <div>
            <h2 className="sidepanel__title">Frameo Copilot</h2>
            <p className="sidepanel__subtitle">AI content intelligence · preview</p>
          </div>
          <button className="btn btn--ghost btn--icon sidepanel__close" onClick={() => openCopilot(false)} title="Close (Esc)">
            <Icon name="x" size={16} />
          </button>
        </header>

        {!settings.copilotEnabled ? (
          <div className="sidepanel__empty sidepanel__empty--ai">
            <Icon name="robot" size={34} />
            <p>Copilot is disabled</p>
            <span>Enable the AI features below to unlock analysis, key moments and recommendations.</span>
            <button className="btn btn--primary" onClick={() => updateSettings({ copilotEnabled: true })}>
              Enable Copilot
            </button>
          </div>
        ) : !current ? (
          <div className="sidepanel__empty sidepanel__empty--ai">
            <Icon name="sparkles" size={34} />
            <p>Nothing to analyze yet</p>
            <span>Play a video or track and Copilot will break down its scenes, mood and more.</span>
          </div>
        ) : (
          <div className="copilot">
            {!done ? (
              <div className="copilot__analyzing">
                <div className="copilot__radar">
                  <span className="spinner" />
                </div>
                <p className="copilot__analyzing-title">Analyzing “{current.title}”</p>
                <ul className="copilot__steps">
                  {STEPS.map((s, i) => (
                    <li key={s} className={i < step ? "is-done" : i === step ? "is-active" : ""}>
                      <span className="copilot__step-dot" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="copilot__analysis">
                  <div className="analysis-grid">
                    <div className="analysis-card">
                      <span className="analysis-card__label">Estimated genre</span>
                      <strong>{genreForTitle(current.title)}</strong>
                    </div>
                    <div className="analysis-card">
                      <span className="analysis-card__label">Mood</span>
                      <strong>{moodForHue(current.hue)}</strong>
                    </div>
                    <div className="analysis-card">
                      <span className="analysis-card__label">
                        {current.type === "audio" ? "Track segments" : "Scenes detected"}
                      </span>
                      <strong>{scenes.length} changes</strong>
                    </div>
                    <div className="analysis-card">
                      <span className="analysis-card__label">AI confidence</span>
                      <strong>{75 + (current.hue % 20)}%</strong>
                    </div>
                  </div>

                  <div className="copilot__section">
                    <p className="copilot__section-title">
                      {current.type === "audio" ? "Track sections" : "Key moments"}
                    </p>
                    <div className="moments">
                      {keyMoments.map((s) => (
                        <button key={s.start} className="moment" onClick={() => seek(s.start)}>
                          <Icon name="play" size={12} />
                          <span>{s.label}</span>
                          <em>{formatTime(s.start)}</em>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="copilot__section">
                    <p className="copilot__section-title">Enhance playback</p>
                    <div className="copilot__toggles">
                      <Toggle
                        label="AI subtitles"
                        checked={settings.aiSubtitles}
                        onChange={(v) => updateSettings({ aiSubtitles: v })}
                      />
                      <Toggle
                        label="Scene markers"
                        checked={settings.sceneMarkers}
                        onChange={(v) => updateSettings({ sceneMarkers: v })}
                      />
                      <Toggle
                        label="Auto-skip intros"
                        checked={settings.skipIntros}
                        onChange={(v) => updateSettings({ skipIntros: v })}
                      />
                    </div>
                  </div>

                  {recs.length > 0 && (
                    <div className="copilot__section">
                      <p className="copilot__section-title">
                        {current.type === "audio"
                          ? "Because you're listening to this"
                          : "Because you're watching this"}
                      </p>
                      <div className="copilot__recs">
                        {recs.map((r) => (
                          <button key={r.id} className="copilot__rec" onClick={() => playItem(r)}>
                            <span className="copilot__rec-thumb" style={{ "--h": r.hue } as CSSProperties}>
                              {posterInitials(r.title)}
                            </span>
                            <span className="copilot__rec-info">
                              <strong>{r.title}</strong>
                              <em>{r.type === "audio" ? "Audio" : "Video"}{r.duration ? ` · ${formatTime(r.duration)}` : ""}</em>
                            </span>
                            <Icon name="play" size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
