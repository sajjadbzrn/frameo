import { useEffect, useRef, type ReactNode } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
}

interface Props {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [position, onClose]);

  if (!position) return null;

  // Adjust position so the menu doesn't overflow the viewport.
  const adjustedX = Math.min(position.x, window.innerWidth - 220);
  const adjustedY = Math.min(position.y, window.innerHeight - items.length * 38 - 16);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => (
        <div key={i}>
          <button
            className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""}`}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.icon && <span className="context-menu__icon">{item.icon}</span>}
            <span className="context-menu__label">{item.label}</span>
          </button>
          {item.dividerAfter && <div className="context-menu__divider" />}
        </div>
      ))}
    </div>
  );
}
