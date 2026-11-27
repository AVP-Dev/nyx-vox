# NYX Vox v1.6.3 (macOS Stability & Auto-Reset Accessibility)

**Focus: Fix macOS 27 CoreML crash, smoother Accessibility recovery after updates, and system language detection**

> **Release status:** Public patch release on `main`.

This patch release fixes a `CoreML` (`MTLReportFailure`) crash on macOS 27.0, automatically clears stale macOS Accessibility entries before relaunching an in-app update, and detects your OS language on first launch.

---

### Highlights

* **macOS Whisper Stability**: Switched `whisper-rs` on macOS to `metal` only (disabled `coreml`), eliminating `MTLReportFailure` crashes during model preload on macOS 27.0.
* **macOS Accessibility Cache Reset on Update**: Automatically runs `tccutil reset Accessibility` before `relaunch()` so you only need to toggle the permission back on after an update.
* **System Language on First Launch**: Detects OS language (`ru` / `en`) on first launch while preserving your saved language choice across updates.
* **Clearer Fallback Guidance**: Clarified that Homebrew / `curl` / manual installers are fallback options when the native in-app auto-updater cannot be used.
