import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { migrateFromLocalStorage } from "./lib/db";

// Sync localStorage <-> IndexedDB before the first render, so the library,
// settings and positions are restored even if localStorage was cleared.
// Renders regardless of migration success.
migrateFromLocalStorage()
  .catch(() => {})
  .finally(() => {
    // Check for Tauri updates on launch (non-blocking).
    import("./lib/utils").then(({ isTauri }) => {
      if (!isTauri()) return;
      import("@tauri-apps/plugin-updater")
        .then(({ check }) => check())
        .then((update) => {
          if (update?.available) {
            console.log("Update available:", update.version);
          }
        })
        .catch(() => {});
    });

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
