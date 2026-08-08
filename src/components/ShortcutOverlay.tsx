import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

interface Shortcut {
  keys: string[];
  action: string;
}

const SECTIONS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Playback",
    shortcuts: [
      { keys: ["Space", "K"], action: "Play / Pause" },
      { keys: ["←", "→"], action: "Seek −10s / +10s" },
      { keys: ["Shift", "←", "→"], action: "Seek −60s / +60s" },
      { keys: ["↑", "↓"], action: "Volume up / down" },
      { keys: ["M"], action: "Mute / Unmute" },
      { keys: ["N"], action: "Next track" },
      { keys: ["P"], action: "Previous track" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "O"], action: "Add media files" },
      { keys: ["Esc"], action: "Close panel / Back to library" },
      { keys: ["F"], action: "Toggle fullscreen" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: ["Q"], action: "Toggle Up Next queue" },
      { keys: ["?"], action: "Show this shortcut guide" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutOverlay({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="shortcut-overlay"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
    >
      <div className="shortcut-overlay__card">
        <header className="shortcut-overlay__head">
          <h2>Keyboard shortcuts</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </header>

        {SECTIONS.map((s) => (
          <section key={s.title} className="shortcut-section">
            <h3 className="shortcut-section__title">{s.title}</h3>
            <div className="shortcut-grid">
              {s.shortcuts.map((sc) => (
                <div key={sc.action} className="shortcut-row">
                  <span className="shortcut-keys">
                    {sc.keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 && <span className="shortcut-plus">+</span>}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </span>
                  <span className="shortcut-action">{sc.action}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <footer className="shortcut-overlay__foot">
          <span className="shortcut-overlay__note">Press any key to close</span>
        </footer>
      </div>
    </dialog>
  );
}
