import { useMemo, useState } from "react";
import { useApp } from "../store";
import { useAddMedia } from "../lib/useAddMedia";
import { confirmDialog } from "../lib/utils";
import { Icon } from "./Icon";
import { MediaCard } from "./MediaCard";

type SortKey = "newest" | "az" | "recent";

const HEADINGS: Record<string, string> = {
  all: "All Media",
  video: "Videos",
  audio: "Music",
  recent: "Recently Played",
  favorite: "Favorites",
};

export function LibraryView({ hidden }: { hidden: boolean }) {
  const {
    items,
    filter,
    setFilter,
    search,
    groups,
    deleteGroup,
    playItem,
    addToQueue,
    setView,
    toast,
  } = useApp();
  const { pickFiles, onFilesChosen, inputRef } = useAddMedia();
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const group = typeof filter === "object" ? groups.find((g) => g.id === filter.id) : undefined;
  const isGroupFilter = typeof filter === "object";
  const groupLabel = group ? (group.kind === "playlist" ? "playlist" : "collection") : "";

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "video") list = list.filter((i) => i.type === "video");
    else if (filter === "audio") list = list.filter((i) => i.type === "audio");
    else if (filter === "recent") list = list.filter((i) => i.lastPlayedAt);
    else if (filter === "favorite") list = list.filter((i) => i.favorite);
    else if (group) {
      const ids = new Set(group.itemIds);
      list = list.filter((i) => ids.has(i.id));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "recent")
      sorted.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
    else sorted.sort((a, b) => b.addedAt - a.addedAt);
    return sorted;
  }, [items, filter, search, sort, group]);

  const title = group ? group.name : HEADINGS[filter as string] ?? "Library";
  const sortLabel = sort === "newest" ? "Newest" : sort === "az" ? "A–Z" : "Recent";

  function playGroup() {
    if (!group || filtered.length === 0) return;
    playItem(filtered[0]);
    filtered.slice(1).forEach((i) => addToQueue(i));
    setView("player");
    toast(`Playing ${groupLabel} “${group.name}”`, "success");
  }

  async function removeGroup() {
    if (!group) return;
    if (await confirmDialog(`Delete ${groupLabel} “${group.name}”?`)) {
      deleteGroup(group.id);
      setFilter("all");
      toast(`${groupLabel[0].toUpperCase()}${groupLabel.slice(1)} deleted`, "info");
    }
  }

  return (
    <section className={`library ${hidden ? "is-hidden" : ""}`}>
      <div className="library__head">
        <div>
          <h1 className="library__title">{title}</h1>
          <p className="library__subtitle">
            {search.trim()
              ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for “${search.trim()}”`
              : `${filtered.length} item${filtered.length === 1 ? "" : "s"} in ${isGroupFilter ? "this " : "your "}library`}
          </p>
        </div>

        <div className="library__controls">
          <div className="segmented">
            {(["all", "video", "audio"] as const).map((f) => (
              <button
                key={f}
                className={`segmented__btn ${filter === f ? "segmented__btn--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "video" ? "Videos" : "Music"}
              </button>
            ))}
          </div>

          {group && (
            <div className="library__group-actions">
              <button className="btn btn--primary btn--sm" onClick={playGroup} disabled={filtered.length === 0}>
                <Icon name="play" size={14} /> Play all
              </button>
              <button className="btn btn--ghost btn--sm btn--danger" onClick={removeGroup} title={`Delete ${groupLabel}`}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          )}

          <div className="sort">
            <button className="btn btn--ghost btn--sm" onClick={() => setSortOpen((o) => !o)}>
              <Icon name="sliders" size={14} />
              <span>{sortLabel}</span>
              <Icon name="chevron-down" size={14} />
            </button>
            {sortOpen && (
              <>
                <div className="menu__scrim" onClick={() => setSortOpen(false)} />
                <div className="menu__pop">
                  <button onClick={() => { setSort("newest"); setSortOpen(false); }}>Newest first</button>
                  <button onClick={() => { setSort("az"); setSortOpen(false); }}>Name (A–Z)</button>
                  <button onClick={() => { setSort("recent"); setSortOpen(false); }}>Recently played</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__art">
            <Icon name={group ? "list" : filter === "favorite" ? "heart" : "search"} size={34} />
            <span className="empty__glow" />
          </div>
          <h2 className="empty__title">
            {group
              ? `This ${groupLabel} is empty`
              : filter === "favorite"
                ? "No favorites yet"
                : "No results"}
          </h2>
          <p className="empty__text">
            {group
              ? `Add ${group.kind === "playlist" ? "tracks" : "movies"} from your library — hover any card and use the list button.`
              : filter === "favorite"
                ? "Tap the heart on any media card to mark it as a favorite."
                : search.trim()
                  ? `Nothing matches “${search.trim()}”. Try a different search.`
                  : "Add your videos, music or media links to start watching with Frameo. Drag & drop files or links anywhere in this window, or pick them manually."}
          </p>
          {items.length === 0 && !search.trim() && (
            <div className="empty__actions">
              <button className="btn btn--primary btn--lg" onClick={pickFiles}>
                <Icon name="plus" size={18} />
                Add files
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      )}

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
    </section>
  );
}
