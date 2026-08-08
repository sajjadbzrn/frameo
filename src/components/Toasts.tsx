import { useApp } from "../store";
import { Icon, type IconName } from "./Icon";

const KIND_ICON: Record<string, IconName> = {
  success: "check",
  error: "alert",
  info: "info",
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span className="toast__icon">
            <Icon name={KIND_ICON[t.kind] ?? "info"} size={16} />
          </span>
          <span className="toast__msg">{t.message}</span>
          <button className="toast__close" onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
