import { useEffect } from "react";
import { useApp } from "../store";
import { useAddMedia } from "../lib/useAddMedia";
import { Icon } from "./Icon";

export function TopBar() {
  const { view, search, setSearch, current, openCopilot, copilotOpen } = useApp();
  const { pickFiles, onFilesChosen, inputRef } = useAddMedia();

  // Global "Ctrl+O" shortcut (dispatched by the app shell) opens the picker.
  useEffect(() => {
    const onAdd = () => {
      void pickFiles();
    };
    window.addEventListener("frameo:add-media", onAdd);
    return () => window.removeEventListener("frameo:add-media", onAdd);
  }, [pickFiles]);

  return (
    <header className="topbar">
      <div className="topbar__left">
        {view === "library" && (
          <div className="topbar__crumb">
            <Icon name="home" size={16} />
            <span>Library</span>
          </div>
        )}
      </div>

      <div className="topbar__center">
        <div className="searchbox">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library…"
            aria-label="Search library"
          />
          {search && (
            <button className="searchbox__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="topbar__right">
        {current && view === "library" && (
          <button
            className={`btn btn--ghost ${copilotOpen ? "btn--active" : ""}`}
            onClick={() => openCopilot(!copilotOpen)}
            title="Frameo AI Copilot (C)"
          >
            <Icon name="sparkles" size={16} />
            <span className="btn--icon-label">Copilot</span>
          </button>
        )}
        <button className="btn btn--primary" onClick={pickFiles}>
          <Icon name="plus" size={16} />
          <span className="btn--icon-label">Add files</span>
        </button>
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
    </header>
  );
}
