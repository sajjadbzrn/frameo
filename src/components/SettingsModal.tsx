import type { CSSProperties } from "react";
import { useApp } from "../store";
import { useAddMedia } from "../lib/useAddMedia";
import { isTauri } from "../lib/utils";
import { Icon } from "./Icon";
import { Toggle } from "./QueuePanel";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    settings,
    updateSettings,
    items,
    clearLibrary,
    toast,
  } = useApp();
  const { pickFiles, onFilesChosen, inputRef } = useAddMedia();

  if (!settingsOpen) return null;

  async function onClear() {
    let ok = false;
    if (isTauri()) {
      try {
        const { ask } = await import("@tauri-apps/plugin-dialog");
        ok = await ask("Remove all files from your library? Playback will stop.", {
          title: "Frameo",
          kind: "warning",
        });
      } catch {
        ok = window.confirm("Remove all files from your library? Playback will stop.");
      }
    } else {
      ok = window.confirm("Remove all files from your library? Playback will stop.");
    }
    if (ok) {
      clearLibrary();
      toast("Library cleared", "info");
    }
  }

  return (
    <>
      <div className="modal-scrim" onClick={() => setSettingsOpen(false)} />
      <div className="modal" role="dialog" aria-label="Settings" aria-modal="true">
        <header className="modal__head">
          <h2 className="modal__title">Settings</h2>
          <button className="btn btn--ghost btn--icon" onClick={() => setSettingsOpen(false)} title="Close (Esc)">
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="modal__body">
          <section className="settings-section">
            <h3 className="settings-section__title">Appearance</h3>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Theme</strong>
                <span>Cinematic dark or bright light mode.</span>
              </div>
              <div className="segmented">
                <button
                  className={`segmented__btn ${settings.theme === "dark" ? "segmented__btn--active" : ""}`}
                  onClick={() => updateSettings({ theme: "dark" })}
                >
                  <Icon name="moon" size={14} /> Dark
                </button>
                <button
                  className={`segmented__btn ${settings.theme === "light" ? "segmented__btn--active" : ""}`}
                  onClick={() => updateSettings({ theme: "light" })}
                >
                  <Icon name="sun" size={14} /> Light
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Playback</h3>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Default volume</strong>
                <span>Applied to new playback sessions.</span>
              </div>
              <div className="settings-value">
                <Icon name={settings.defaultVolume === 0 ? "mute" : "volume"} size={16} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.defaultVolume}
                  style={{ "--p": `${settings.defaultVolume * 100}%` } as CSSProperties}
                  onChange={(e) => updateSettings({ defaultVolume: Number(e.target.value) })}
                  aria-label="Default volume"
                />
                <span>{Math.round(settings.defaultVolume * 100)}%</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Default speed</strong>
                <span>Playback rate for new items.</span>
              </div>
              <div className="settings-value">
                {RATES.map((r) => (
                  <button
                    key={r}
                    className={`chip ${settings.defaultRate === r ? "chip--active" : ""}`}
                    onClick={() => updateSettings({ defaultRate: r })}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Autoplay next in queue" checked={settings.autoplayNext} onChange={(v) => updateSettings({ autoplayNext: v })} />
            <Toggle label="Resume where you left off" checked={settings.resumePlayback} onChange={(v) => updateSettings({ resumePlayback: v })} />
            <Toggle label="Loop queue" checked={settings.loop} onChange={(v) => updateSettings({ loop: v })} />
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">
              AI features
              <span className="settings-section__tag">preview</span>
            </h3>
            <p className="settings-section__note">
              Simulated previews of Frameo's on-device AI. Real inference (Whisper subtitles, scene detection, Copilot) ships in a future release.
            </p>
            <Toggle label="Auto-skip intros" checked={settings.skipIntros} onChange={(v) => updateSettings({ skipIntros: v })} />
            <Toggle label="Scene detection markers" checked={settings.sceneMarkers} onChange={(v) => updateSettings({ sceneMarkers: v })} />
            <Toggle label="AI subtitles" checked={settings.aiSubtitles} onChange={(v) => updateSettings({ aiSubtitles: v })} />
            <Toggle label="Frameo Copilot" checked={settings.copilotEnabled} onChange={(v) => updateSettings({ copilotEnabled: v })} />
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Library</h3>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>{items.length} item{items.length === 1 ? "" : "s"}</strong>
                <span>Media you've added to Frameo.</span>
              </div>
              <div className="settings-row__actions">
                <button className="btn btn--ghost btn--sm" onClick={pickFiles}>
                  <Icon name="plus" size={14} /> Add files
                </button>
                <button className="btn btn--ghost btn--sm btn--danger" onClick={onClear} disabled={items.length === 0}>
                  <Icon name="trash" size={14} /> Clear library
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section settings-section--about">
            <h3 className="settings-section__title">About</h3>
            <div className="about">
              <div className="about__mark">
                <img src="/frameo-logo.png" width="44" height="44" alt="Frameo logo" />
              </div>
              <div className="about__text">
                <strong>Frameo <span>v0.1.0</span></strong>
                <p>A player that doesn't just play media — it connects you to the content you love.</p>
                <p className="about__stack">Built with Tauri 2 · React 19 · Vite</p>
              </div>
            </div>
          </section>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,audio/*,.mkv,.flac,.opus"
          style={{ display: "none" }}
          onChange={(e) => {
            onFilesChosen(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}
