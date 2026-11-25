# Contributing to NYX Vox

Thank you for your interest in contributing to NYX Vox! We welcome bug reports, architectural feedback, Windows/macOS compatibility fixes, and pull requests.

## Guiding Principles

1. **Frozen Audio & STT Pipeline:** The audio capture, VAD, live streaming, Rolling Commit, Whisper inference, deduplication, and LLM refinement prompt subsystems are **frozen by default**. Please open an issue and align on the design before modifying those files.
2. **macOS & Windows Native Support:** Keep OS-specific integrations cleanly separated (`objc2` / CoreGraphics / Accessibility on macOS; `windows-sys` / `enigo` on Windows).
3. **Security & Privacy:** Never hardcode API keys or bypass the local AES-256-GCM key vault (`src-tauri/src/keys.rs`).
4. **Verification First:** Every pull request should pass frontend and backend checks before merge.

## Development Workflow

### Prerequisites

- **Rust** `1.77.2+` (2021 edition)
- **Bun** (for frontend dependencies and scripts)
- **Tauri 2** system prerequisites for [macOS or Windows](https://v2.tauri.app/start/prerequisites/)

### Local Run

```bash
# Install frontend dependencies
bun install

# Start Tauri desktop app in dev mode (Next.js + Rust)
bun run tauri dev
```

### Local Checks

Run the check suite before opening a PR:

```bash
# Frontend lint & unit tests
bun run lint
bun run test

# Backend formatting, linter & unit tests
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

## Pull Request Guidelines

- Create a focused branch from `dev` (`git checkout -b feature/your-feature-name` or `fix/your-fix-name`).
- Keep changes scoped to a single logical slice.
- Add or update unit tests together with your code changes.
- Mention the target OS (`macOS` / `Windows`) and test results in your PR description.

## Reporting Issues

- Open an issue in the [Issue Tracker](https://github.com/AVP-Dev/nyx-vox/issues).
- Include your OS version, selected STT/LLM engine, steps to reproduce, and any relevant error messages.
- Feedback on real-world **Windows 10/11** microphones, hotkeys, and auto-paste behavior is especially valuable.
