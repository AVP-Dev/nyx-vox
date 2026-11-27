# NYX Vox v1.6.2 (Native Auto-Updater)

**Focus: One-click in-app updates via Tauri Updater, tray update indicator, and signed release artifacts**

> **Release status:** Public patch release on `main`.

This release replaces manual GitHub/browser update redirects with a native in-app auto-updater (`tauri-plugin-updater` + `tauri-plugin-process`).

---

### Highlights

* **In-App Auto-Updater**: Added `tauri-plugin-updater` and `tauri-plugin-process` so NYX Vox downloads, verifies (`minisign`), installs, and relaunches updates automatically in one click.
* **Tray Update Indicator**: The system tray menu now switches to `Update Available: vX.Y.Z` when a new release is detected and opens the `/update` modal directly on click.
* **Redesigned Update Modal**: Added live download progress, up-to-date status view, error retry, and a collapsible manual fallback (`brew` / `curl` / GitHub).
* **Signed CI Artifacts**: Updated `.github/workflows/release.yml` to generate signed updater bundles and `latest.json`.

> **macOS note (unsigned build):** After auto-updating, macOS may reset Accessibility permission; toggle it in *System Settings → Privacy & Security → Accessibility* if auto-paste stops working.
