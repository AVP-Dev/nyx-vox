# Project: NYX Vox

> This file is an INDEX, not documentation. Details live in the linked `docs/`.
> Do not duplicate the contents of `docs/architecture.md` here. This file is
> read automatically by Claude Code, Codex, Jules and other AGENTS.md-compatible
> agents. The symlink `CLAUDE.md -> AGENTS.md` keeps Claude Code compatible.

## What this is

NYX Vox — a macOS desktop app for AI-assisted voice dictation. Speak into the
microphone, get speech transcribed (locally via Whisper, or in the cloud via
Deepgram / Groq / Gemini / GigaChat), and have the result formatted by AI
(Gemini, DeepSeek, Qwen, Groq, GigaChat). Status: active development, v1.3.0.

## Stack
- Languages: Rust 2021 (backend) + TypeScript / Next.js 16 / React 19 (frontend)
- UI: Tailwind CSS 4, Framer Motion 12, Lucide React
- State: Zustand 5 (client), TanStack Query 5 (server)
- Desktop: Tauri 2.10 (Rust ↔ WebView IPC)
- STT: whisper-rs 0.16 (Metal/CoreML), Deepgram, Groq, Gemini, GigaChat (via reqwest)
- AI: Gemini, DeepSeek, Qwen, Groq, GigaChat (via reqwest)
- Audio: cpal 0.15, hound 3.5
- Security: aes-gcm 0.10, sha2 0.10, machineid-rs
- Package manager: bun (frontend), cargo (backend)
- DB: none — settings via tauri-plugin-store, history in JSON files
- ORM/migrations: none
- Queues/workers: none

## Repository structure
```
nyx-vox/
├── src/                        # Frontend (Next.js)
│   ├── app/                    # Routes: page.tsx, history/, update/, welcome/
│   ├── components/             # HeaderBar, ActionBar, ResultPane, QuickMenu, SettingsPanel, ThemeProvider, WaveformVisualizer, WelcomeOverlay
│   │   ├── settings/           # Tabs: General, Engines, History, Info, Keys + translations
│   │   └── ui/                 # Toast, ConfirmDialog
│   ├── constants/              # appInfo, version
│   ├── store/                  # Zustand store (useStore.ts)
│   ├── hooks/                  # useSettings, useRecording, useWindowManager, useInitialSettings, useTargetApp, useTauriEvents, useKeyboardShortcuts
│   ├── lib/                    # types, text, windowSizes, animations, services
│   └── types/                  # tauri.d.ts
├── src-tauri/                  # Backend (Rust / Tauri)
│   ├── src/
│   │   ├── commands/           # Tauri-команды: audio.rs, settings.rs, app.rs, ai.rs
│   │   ├── lib.rs              # Command registration, init
│   │   ├── main.rs             # Entry point
│   │   ├── state.rs            # Global state (Mutex/AtomicBool)
│   │   ├── whisper/            # Local STT: mod.rs, paths.rs, model_cache.rs, recording.rs, transcribe.rs, download.rs
│   │   ├── ai_provider.rs      # AI providers (Gemini, DeepSeek, Qwen, Groq)
│   │   ├── deepgram.rs         # Deepgram STT
│   │   ├── deepseek.rs         # DeepSeek API client
│   │   ├── qwen.rs             # Qwen API client
│   │   ├── gigachat.rs         # GigaChat (SberAI) STT + formatting, Russian Trusted CA
│   │   ├── prompts.rs          # System prompts
│   │   ├── keys.rs             # API key encryption (AES-GCM)
│   │   ├── history.rs          # Recording history
│   │   ├── transliteration.rs  # Transliteration
│   │   ├── utils.rs            # Utilities, regex, resampling
│   │   ├── tray.rs             # System tray
│   │   ├── window.rs           # Window management
│   │   └── diag.rs             # Diagnostics
│   └── Cargo.toml
├── docs/                       # Project documentation
├── public/                     # Static assets
├── e2e/                        # Playwright E2E tests
└── package.json
```

## Hard rules (never break)

### 1. Never mutate existing objects
Always create new objects, never modify existing ones in place.
Immutable data prevents side effects and simplifies debugging.

### 2. Small files and functions
- Functions: <50 lines
- Files: <800 lines (maximum)
- Organize by feature/domain, not by type

### 3. Error handling at every level
- Never swallow errors silently
- User-facing error messages in the UI
- Detailed context in backend logs
- `?` in Rust, try/catch in TypeScript

### 4. Validation at system boundaries
- All user input is validated before processing
- Schema-based validation (Zod on the frontend)
- Don't trust external data (API, user input)

### 5. macOS only
The project is tied to macOS via objc2, core-graphics, accessibility-client.
Cross-platform is not planned.

### 6. API keys — never in code
Keys are stored encrypted (AES-256-GCM), bound to machine-id.
Managed via `keys.rs`.

## Where to look
| Need to know | File |
|---|---|
| Architecture and data flows | docs/architecture.md |
| Current status, what's in progress, what's broken | docs/state.md |
| Architectural decisions (ADR) | docs/decisions.md |
| Terms and domain concepts | docs/glossary.md |
| Technical specs | docs/TECHNICAL.md |
| AI prompts | docs/AI_PROMPTS.md |
| Changelog | docs/CHANGELOG.md |
| Releases by tag | docs/tags/ |

## How to run
```bash
# Install dependencies
bun install

# Dev mode (frontend + Tauri backend)
bun run tauri dev

# Production build
bun run tauri build

# Frontend only (dev server on port 3002)
bun run dev

# Frontend checks
bun run lint
bun run test

# Backend checks
cd src-tauri
cargo check
cargo clippy -- -D warnings
cargo fmt --check
cargo test
```

## Common tasks

### Add a new Tauri command
1. Create a function in `src-tauri/src/commands/` with `#[tauri::command]`
2. Register it in `src-tauri/src/lib.rs` inside `generate_handler![]`
3. Call it from the frontend via `invoke('command_name', { args })`

### Add a new AI provider
1. Create a module in `src-tauri/src/` (modeled on `deepseek.rs`, `qwen.rs`, `gigachat.rs`)
2. Add handling in `ai_provider.rs`
3. Add a prompt in `prompts.rs`
4. Update the UI in `components/settings/EnginesTab.tsx`
5. Add the key field in `components/settings/KeysTab.tsx` and the key service in `keys.rs`

### Add a setting
1. Add state in `src-tauri/src/state.rs` (Mutex/AtomicBool)
2. Add get/set commands in `src-tauri/src/commands/settings.rs`
3. Register in `lib.rs`
4. Add a UI control in `components/settings/GeneralTab.tsx`
5. Add a translation in `components/settings/translations.ts`

### Update prompts
1. Change in `src-tauri/src/prompts.rs`
2. Cross-check with `docs/AI_PROMPTS.md`
3. Run `cargo check`

## Code style

### Rust
- Edition 2021, min rustc 1.77.2
- `cargo fmt` for formatting
- `cargo clippy -- -D warnings` for linting
- `#[tauri::command]` for IPC commands
- `Mutex<T>` or `AtomicBool` for shared state
- `serde` for serialization

### TypeScript
- Strict mode (tsconfig.json)
- ESLint with next/core-web-vitals + next/typescript
- Tailwind CSS 4 for styling
- PascalCase for components, camelCase for functions/variables
- `invoke()` for all backend calls

## Testing
Coverage is established but modest:
- Backend: ~80 Rust unit tests (`cargo test`), incl. utils, transliteration, keys, history, ai_provider, whisper
- Frontend: ~60 Vitest unit tests (`bun run test`)
- E2E: 3 Playwright smoke tests (`bun run test:e2e`)

Rules: write tests together with code, never defer them to "later";
before finishing a task, check coverage of the touched code; if something
can't be covered, say so explicitly in the session summary.

## Environment variables
No `.env` file. API keys are managed through the UI (Settings → Keys) and
stored encrypted in tauri-plugin-store.

External APIs (user-configured):
- Groq API Key (STT + AI formatting)
- Deepgram API Key (STT)
- Gemini API Key (STT + AI formatting)
- DeepSeek API Key (AI formatting)
- Qwen API Key (AI formatting)
- GigaChat API Key (STT + AI formatting)

## Deployment
- Target platform: macOS (dmg/app)
- Build: `bun run tauri build`
- Distribution: GitHub Releases
- CI/CD: GitHub Actions (`.github/`)
- Signing: none (unsigned — requires `xattr -cr` on install)

## Key architectural decisions
1. **Tauri 2 instead of Electron** — native performance, small bundle size
2. **Local Whisper + cloud STT** — fallback between engines when unavailable
3. **AES-256-GCM for API keys** — encryption bound to machine-id
4. **Static Next.js export** — `output: 'export'`, rendered in Tauri WebView
5. **Zustand + TanStack Query** — client vs. server state separation
6. **Single source of truth for hallucination cleanup** — backend, not frontend
7. **Semaphore for AI requests** — limits parallel API calls
8. **WhisperState cached in WhisperModel** — no Metal/CoreML backend re-init per inference
9. **`reqwest` with rustls-tls** — Russian Trusted CA support for GigaChat

---

## Workflow rules (permanent, do not remove)

### Delegation
When work spans multiple packages/stacks at once — don't analyze or write code
for all of them in a single reasoning thread. Split into per-package subtasks
and delegate to sub-agents (see `.claude/agents/`). If the task lives entirely
in one package, work directly without artificial splitting.

### Mandatory session notes
Before finishing ANY work session (not just documentation):
1. Update `docs/state.md` (or `[package]/docs/state.md`) — what was done,
   what's broken, what remains
2. If you made an architectural decision — add an entry to `docs/decisions.md`
3. If you found a discrepancy between docs and actual code — record it
   explicitly, don't fix the docs silently without a note

### Tests — mandatory when adding functionality
1. Write tests together with the code, don't postpone them
2. Before finishing a task — check coverage of the touched code
3. If functionality is NOT covered by tests (no time/framework/hard to test) —
   say so explicitly in the session summary, don't stay silent
4. Existing code without tests that's unrelated to the current task —
   don't fix it yourself, but record it in `docs/state.md` as tech debt

### Periodic coverage check
A separate "check coverage" task writes no code — it only scans and reports
in `docs/_reports/test-coverage-[date].md`. Writing missing tests is a
separate step after the list is approved (see `.claude/agents/backend-docs.md`
and `.claude/agents/frontend-docs.md`).

### Working with found old/legacy documentation
If the project already contains documentation written before this system was
introduced — don't overwrite or delete it silently. Cross-check it against
the code, record discrepancies explicitly (a "was claimed / actually is"
table), move outdated content to `docs/_archive/` with a date rather than
deleting it entirely. Resolve file-name conflicts between old docs and the
doc-kit structure explicitly, confirming via git history when available —
don't rely on the visual impression that "it was probably just a template".

### General rule for agents
Don't invent facts about the code — if unsure, write "needs author
clarification". Before merging/overwriting existing files, show the result to
a human for review if the file contained more than a few lines of meaningful
content.
