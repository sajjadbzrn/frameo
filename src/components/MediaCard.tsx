import { useState, type CSSProperties, type MouseEvent } from "react";
import { usePlayback, useUI, useLibrary } from "../store";
import type { MediaItem } from "../types";
import { defaultGroupName, formatBytes, formatTime, posterInitials } from "../lib/utils";
import { Icon } from "./Icon";
import { ContextMenu } from "./ContextMenu";

interface Props {
  item: MediaItem;
}

export function MediaCard({ item }: Props) {
  const { playItem, addToQueue, resumeAt } = usePlayback();
  const { toast, openQueue } = useUI();
  const {
    removeItem,
    groups,
    createGroup,
    addToGroup,
    removeFromGroup,
    toggleFavorite,
  } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const resume = resumeAt(item.path);

  const kind = item.type === "audio" ? "playlist" : "collection";
  const kindLabel = item.type === "audio" ? "playlist" : "collection";
  const matchingGroups = groups.filter((g) => g.kind === kind);

  function toggleGroup(g: { id: string; name: string; itemIds: string[] }) {
    if (g.itemIds.includes(item.id)) {
      removeFromGroup(g.id, item.id);
      toast(`Removed from “${g.name}”`, "info");
    } else {
      addToGroup(g.id, item.id);
      toast(`Added to “${g.name}”`, "success");
    }
  }

  function createAndAdd() {
    const g = createGroup(kind, defaultGroupName(kind, groups));
    addToGroup(g.id, item.id);
    setMenuOpen(false);
    toast(`Created and added to “${g.name}”`, "success");
  }

  function openMenu(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)),
      top: rect.bottom + 6,
    });
    setMenuOpen(true);
  }

  return (
    <div
      className="card"
      style={{ "--h": item.hue } as CSSProperties}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenuPos({ x: e.clientX, y: e.clientY }); }}
    >
      <div
        className="card__poster"
        onClick={() => playItem(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") playItem(item);
        }}
      >
        <div className="card__art">
          <span className="card__initials">{posterInitials(item.title)}</span>
        </div>

        <button
          className={`card__fav ${item.favorite ? "is-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
          title={item.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Icon name="heart" size={14} />
        </button>

        <div className="card__hover">
          <button
            className="card__play"
            onClick={(e) => {
              e.stopPropagation();
              playItem(item);
            }}
            aria-label={`Play ${item.title}`}
          >
            <Icon name="play" size={22} />
          </button>
          <div className="card__actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                addToQueue(item);
                openQueue(true);
                toast(`Added to Up Next`);
              }}
              title="Add to Up Next"
            >
              <Icon name="plus" size={14} />
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={openMenu}
              title={`Add to ${kindLabel}`}
              aria-label={`Add to ${kindLabel}`}
            >
              <Icon name="list" size={14} />
            </button>
            <button
              className="btn btn--ghost btn--sm btn--danger"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
                toast(`Removed “${item.title}” from library`, "info");
              }}
              title="Remove from library"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>

        {item.duration ? (
          <span className="card__duration">
            <Icon name="clock" size={11} /> {formatTime(item.duration)}
          </span>
        ) : null}
        {resume > 5 && item.duration ? (
          <span className="card__resume">Resume {formatTime(resume)}</span>
        ) : null}
      </div>

      {menuOpen && menuPos && (
        <>
          <div
            className="menu__scrim"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            className="menu__pop card__menu"
            style={{ left: menuPos.left, top: menuPos.top }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="card__menu-label">Add to {kindLabel}</p>
            {matchingGroups.length === 0 && <p className="card__menu-empty">No {kindLabel}s yet</p>}
            {matchingGroups.map((g) => (
              <button
                key={g.id}
                className={g.itemIds.includes(item.id) ? "is-selected" : ""}
                onClick={() => toggleGroup(g)}
              >
                <Icon name="check" size={13} /> {g.name}
              </button>
            ))}
            <div className="card__menu-divider" />
            <button onClick={createAndAdd}>
              <Icon name="plus" size={13} /> New {kindLabel}
            </button>
          </div>
        </>
      )}

      <div className="card__meta">
        <p className="card__title" title={item.title}>{item.title}</p>
        <p className="card__sub">
          {item.type === "audio" ? "Audio" : "Video"}
          {item.size ? ` · ${formatBytes(item.size)}` : ""}
        </p>
      </div>
      <ContextMenu
        items={[
          { label: "Play", icon: <Icon name="play" size={14} />, onClick: () => playItem(item) },
          { label: "Add to Up Next", icon: <Icon name="plus" size={14} />, onClick: () => { addToQueue(item); openQueue(true); toast("Added to Up Next"); }, dividerAfter: true },
          { label: item.favorite ? "Remove from favorites" : "Add to favorites", icon: <Icon name="heart" size={14} />, onClick: () => toggleFavorite(item.id), dividerAfter: true },
          { label: "Remove from library", icon: <Icon name="trash" size={14} />, onClick: () => { removeItem(item.id); toast(`Removed "${item.title}" from library`, "info"); }, danger: true },
        ]}
        position={ctxMenuPos}
        onClose={() => setCtxMenuPos(null)}
      />
    </div>
  );
}
