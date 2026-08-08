import { useState } from "react";
import { useApp } from "../store";
import type { GroupKind, LibraryFilter } from "../types";
import { confirmDialog, defaultGroupName } from "../lib/utils";
import { Icon, type IconName } from "./Icon";

interface NavEntry {
  key: LibraryFilter;
  label: string;
  icon: IconName;
}

const LIBRARY_NAV: NavEntry[] = [
  { key: "all", label: "All Media", icon: "home" },
  { key: "video", label: "Videos", icon: "film" },
  { key: "audio", label: "Music", icon: "music" },
  { key: "recent", label: "Recently Played", icon: "clock" },
  { key: "favorite", label: "Favorites", icon: "heart" },
];

export function Sidebar() {
  const {
    filter,
    setFilter,
    setView,
    queueOpen,
    openQueue,
    copilotOpen,
    openCopilot,
    settingsOpen,
    setSettingsOpen,
    settings,
    updateSettings,
    queue,
    items,
    groups,
    createGroup,
    deleteGroup,
    toast,
  } = useApp();

  const [creating, setCreating] = useState<GroupKind | null>(null);
  const [draftName, setDraftName] = useState("");

  const counts = {
    all: items.length,
    video: items.filter((i) => i.type === "video").length,
    audio: items.filter((i) => i.type === "audio").length,
    recent: items.filter((i) => i.lastPlayedAt).length,
    favorite: items.filter((i) => i.favorite).length,
  };

  const playlists = groups.filter((g) => g.kind === "playlist");
  const collections = groups.filter((g) => g.kind === "collection");

  function goTo(f: LibraryFilter) {
    setFilter(f);
    setView("library");
  }

  const isGroupActive = (g: { kind: GroupKind; id: string }) =>
    typeof filter === "object" && filter.kind === g.kind && filter.id === g.id;

  function startCreate(kind: GroupKind) {
    setCreating(kind);
    setDraftName("");
  }

  function submitCreate() {
    if (!creating) return;
    const name = draftName.trim() || defaultGroupName(creating, groups);
    const group = createGroup(creating, name);
    toast(
      creating === "playlist" ? `Created playlist “${group.name}”` : `Created collection “${group.name}”`,
      "success",
    );
    goTo({ kind: creating, id: group.id });
    setCreating(null);
  }

  async function removeGroup(kind: GroupKind, id: string, name: string) {
    const label = kind === "playlist" ? "playlist" : "collection";
    if (await confirmDialog(`Delete ${label} “${name}”?`)) {
      deleteGroup(id);
      if (typeof filter === "object" && filter.id === id) goTo("all");
      toast(`${label[0].toUpperCase()}${label.slice(1)} deleted`, "info");
    }
  }

  function renderGroupSection(kind: GroupKind, label: string) {
    const list = kind === "playlist" ? playlists : collections;
    return (
      <div className="sidebar__groups">
        <p className="sidebar__section-label">{label}</p>
        {creating === kind && (
          <div className="sidebar__create">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
              placeholder={kind === "playlist" ? "Playlist name" : "Collection name"}
              aria-label={`${label} name`}
            />
            <button className="btn btn--ghost btn--icon" onClick={submitCreate} title="Create" aria-label="Create">
              <Icon name="check" size={14} />
            </button>
            <button className="btn btn--ghost btn--icon" onClick={() => setCreating(null)} title="Cancel" aria-label="Cancel">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        {list.map((g) => (
          <div
            key={g.id}
            className={`nav-item nav-item--row ${isGroupActive(g) ? "nav-item--active" : ""}`}
          >
            <button
              className="nav-item__row-main"
              onClick={() => goTo({ kind, id: g.id })}
              title={g.name}
            >
              <Icon name={kind === "playlist" ? "music" : "film"} size={18} />
              <span className="nav-item__label" title={g.name}>{g.name}</span>
              {g.itemIds.length > 0 && <span className="nav-item__count">{g.itemIds.length}</span>}
            </button>
            <button
              className="nav-item__del"
              onClick={() => void removeGroup(kind, g.id, g.name)}
              title={`Delete ${kind}`}
              aria-label={`Delete ${g.name}`}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        <button className="nav-item nav-item--create" onClick={() => startCreate(kind)}>
          <Icon name="plus" size={16} />
          <span className="nav-item__label">New {kind === "playlist" ? "playlist" : "collection"}</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar__nav">
        <p className="sidebar__section-label">Library</p>
        {LIBRARY_NAV.map((entry) => (
          <button
            key={String(entry.key)}
            className={`nav-item ${filter === entry.key ? "nav-item--active" : ""}`}
            onClick={() => goTo(entry.key)}
          >
            <Icon name={entry.icon} size={18} />
            <span className="nav-item__label">{entry.label}</span>
            {counts[entry.key as keyof typeof counts] > 0 && (
              <span className="nav-item__count">{counts[entry.key as keyof typeof counts]}</span>
            )}
          </button>
        ))}

        {renderGroupSection("playlist", "Playlists")}
        {renderGroupSection("collection", "Collections")}

        <p className="sidebar__section-label">Playback</p>
        <button
          className={`nav-item ${queueOpen ? "nav-item--active" : ""}`}
          onClick={() => openQueue(!queueOpen)}
        >
          <Icon name="list" size={18} />
          <span className="nav-item__label">Up Next</span>
          {queue.length > 0 && <span className="nav-item__count">{queue.length}</span>}
        </button>
        <button
          className={`nav-item ${copilotOpen ? "nav-item--active" : ""}`}
          onClick={() => openCopilot(!copilotOpen)}
        >
          <Icon name="sparkles" size={18} />
          <span className="nav-item__label">AI Copilot</span>
          <span className="nav-item__tag">AI</span>
        </button>
      </nav>

      <div className="sidebar__footer">
        <button
          className="nav-item"
          onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
          title="Toggle theme"
        >
          <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={18} />
          <span className="nav-item__label">
            {settings.theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>
        <button
          className={`nav-item ${settingsOpen ? "nav-item--active" : ""}`}
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="sliders" size={18} />
          <span className="nav-item__label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
