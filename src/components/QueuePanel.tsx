import type { CSSProperties } from "react";
import { useApp } from "../store";
import { formatTime, posterInitials } from "../lib/utils";
import { Icon } from "./Icon";

export function QueuePanel() {
  const {
    queueOpen,
    openQueue,
    queue,
    queueIndex,
    playAt,
    removeFromQueue,
    current,
    settings,
    updateSettings,
    clearQueue,
    toast,
  } = useApp();

  if (!queueOpen) return null;

  return (
    <>
      <div className="panel-scrim" onClick={() => openQueue(false)} />
      <aside className="sidepanel sidepanel--right" role="dialog" aria-label="Up Next">
        <header className="sidepanel__head">
          <h2 className="sidepanel__title">Up Next</h2>
          <div className="sidepanel__head-actions">
            {queue.length > 0 && (
              <button
                className="btn btn--ghost btn--icon btn--danger"
                onClick={() => {
                  clearQueue();
                  toast("Queue cleared", "info");
                }}
                title="Clear queue"
              >
                <Icon name="trash" size={15} />
              </button>
            )}
            <button className="btn btn--ghost btn--icon" onClick={() => openQueue(false)} title="Close (Esc)">
              <Icon name="x" size={16} />
            </button>
          </div>
        </header>

        {queue.length === 0 ? (
          <div className="sidepanel__empty">
            <Icon name="list" size={28} />
            <p>Your queue is empty</p>
            <span>Play something or add items with the + button on any card.</span>
          </div>
        ) : (
          <ul className="queue">
            {queue.map((item, i) => {
              const active = i === queueIndex;
              return (
                <li key={item.id} className={`queue__row ${active ? "queue__row--active" : ""}`}>
                  <button className="queue__main" onClick={() => playAt(i)}>
                    <span
                      className="queue__thumb"
                      style={{ "--h": item.hue } as CSSProperties}
                    >
                      {active ? (
                        <span className="eq" aria-hidden="true">
                          <i /><i /><i />
                        </span>
                      ) : (
                        posterInitials(item.title)
                      )}
                    </span>
                    <span className="queue__info">
                      <span className="queue__name">{item.title}</span>
                      <span className="queue__sub">
                        {item.type === "audio" ? "Audio" : "Video"}
                        {item.duration ? ` · ${formatTime(item.duration)}` : ""}
                      </span>
                    </span>
                    {active && <span className="queue__badge">Now playing</span>}
                  </button>
                  <button
                    className="btn btn--ghost btn--icon queue__remove"
                    onClick={() => removeFromQueue(i)}
                    title="Remove from queue"
                    aria-label={`Remove ${item.title} from queue`}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="sidepanel__foot">
          <Toggle
            label="Autoplay next"
            checked={settings.autoplayNext}
            onChange={(v) => updateSettings({ autoplayNext: v })}
          />
          <Toggle
            label="Loop queue"
            checked={settings.loop}
            onChange={(v) => updateSettings({ loop: v })}
          />
          {queue.length > 0 && (
            <p className="sidepanel__note">
              {current ? `Now playing: ${current.title}` : "Nothing loaded yet"}
            </p>
          )}
        </footer>
      </aside>
    </>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "toggle--on" : ""}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__label">{label}</span>
      <span className="toggle__track">
        <span className="toggle__knob" />
      </span>
    </button>
  );
}
