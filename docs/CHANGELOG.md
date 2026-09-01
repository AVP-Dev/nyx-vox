# NYX Vox: Changelog

[🏠 Home](../README.md) | [🇷🇺 Russian Version](./CHANGELOG.ru.md)

---

## 📅 Version 1.3.1 (Current)

### 🎧 Pre-Speech FIFO Ring Buffer
- Implemented a 300ms (4800 samples @ 16kHz) pre-speech FIFO ring buffer in `utils.rs`, `recording.rs`, and `ai_provider.rs`.
- Flushes lead-in audio on VAD speech trigger, ensuring unvoiced and plosive consonants («п», «т», «к», «с», «ш») are never clipped.
- Configured `trim_silence` with 300ms pre-speech and 200ms post-speech padding.

### ⏱️ Pure Pause-Based VAD Auto-Stop
- Removed artificial continuous speech limits from `VadTracker`.
- Auto-stop now triggers strictly when continuous silence reaches the user-configured timeout in Settings (3.0–15.0s, default 7.0s), preventing premature cut-offs during long dictations.

### 💊 Compact Waveform Pill Mode & Ergonomic Dimensions
- Added a "Live Speech Preview" ("Живой предпросмотр речи") toggle under Settings → Interface.
- When disabled, the recording window shrinks into a sleek 220px pill displaying the animated audio `WaveformVisualizer`, saving screen space, CPU cycles, and network requests.
- Reduced standard live recording width from 380px to a cleaner 320px.

### 🎯 Smart Disfluency Removal vs Emotional Interjections
- Enhanced `REFINEMENT_SYSTEM_PROMPT` and formatting styles across all LLM engines (Gemini, DeepSeek, Qwen, Groq, GigaChat).
- Automatically removes hesitations and stutters («эээ», «нуу», «хмм», «ммм», false starts) while strictly preserving emotional and semantic interjections («М-м, как вкусно!», «Ого!», «Эх!», «Увы!»).

### ⚡ Interim Stream Backpressure & UI Stabilization
- Added atomic `is_inflight` backpressure protection to interim stream workers, dropping lagging requests and eliminating latency buildup.
- Implemented `splitCommittedAndDraft` in UI, separating solid white committed text from a dynamic translucent italic draft tail to eliminate visual jitter.

---

## 📅 Version 1.3.0

### 🎙️ Universal Live Phrase Streaming
- Added real-time interim transcription across all STT engines (Groq, Deepgram, Gemini, GigaChat, and Local Whisper).
- Spoken phrases appear instantly on screen as you speak with an active typing indicator.
- Polished streaming layout: window extended to 380px, auto-scrolling right with gradient left fade, eliminating text overlap over window controls.

### 🎯 100% Verbatim AI Calibration
- Completely revised system prompts (`REFINEMENT_SYSTEM_PROMPT`, `FORMAT_STYLE_LIGHT`, `FORMAT_STYLE_DEEP`) across all providers.
- GigaChat, DeepSeek, Gemini, Qwen, and Groq now operate under strict verbatim constraints: zero synonym replacement, zero text restructuring, zero unsolicited answers or advice.

### ⚙️ Custom AI Models & Presets
- Added customizable model selectors under Settings → Keys for all providers (Groq, Gemini, DeepSeek, Qwen, GigaChat).
- Users can choose from popular curated presets or input arbitrary model IDs with one-click reset to default.

### ⏱️ Smart VAD Silence Auto-Stop
- Added configurable silence pause auto-stop in Settings → General with adjustable duration (3.0s to 15.0s, default 7.0s).
- Silence tracking activates only after speech begins, providing plenty of time for users to pause and think.

### 🔇 Silence Trimming & Noise Gate Hardening
- Added automatic leading/trailing silence trimming (`trim_silence`) before Whisper STT, completely eliminating music/subtitle hallucinations on silence.
- Corrected inverted Noise Gate sensitivity labels and calibrated threshold range (0.001–0.025).
- Added streaming fallback in `useRecording.ts` so recordings stopped by keyboard shortcuts are never dropped.

### 🆕 GigaChat STT (Transcription Engine)
- Added GigaChat as a **speech-to-text engine** (button "GigaChat Pro" in EnginesTab)
- Model: `GigaChat-2-Pro` (multimodal: text + audio); formatting stays on `GigaChat-2` (cheaper)
- Audio uploaded via `POST /v1/files` (`purpose=general`), then `chat/completions` with `attachments: [file_id]` + `function_call: "auto"` — inline OpenAI-style `input_audio` is **not** supported (400)
- Same authorization key as formatting (Base64 `client_id:client_secret`); OAuth token cached, auto-refresh on 401/403
- Works in Russia without a VPN

### 🆕 SberAI / GigaChat Formatting Engine
- Added GigaChat (SberAI) as a text formatting engine (model: `GigaChat-2`)
- OAuth access token (30-min TTL) is fetched automatically from the authorization key (`base64(client_id:client_secret)`) and cached; auto-refresh on 401/403
- New "GigaChat" button in EnginesTab (formatting) and API-key field in KeysTab
- Works in Russia without a VPN (unlike Gemini)

### 🔐 GigaChat TLS (Russian Trusted CA)
- Both GigaChat endpoints serve certificates from the Russian Trusted Sub CA (Минцифры), which macOS doesn't trust
- `reqwest` switched from default `native-tls` to `rustls-tls`; the official Russian Trusted Root CA is downloaded once from `gu-st.ru` into app-data and used via `add_root_certificate` — no disabled certificate verification
- OAuth endpoint: `ngw.devices.sberbank.ru:9443/api/v2/oauth`; chat: `api.giga.chat/v1/chat/completions`

### 🛠️ Stability Fixes
- `paste_text` now checks Accessibility before hiding the window, returns a real status, and re-shows the window on failure — no more "hidden window with no paste"
- Network reachability check cached for 5s (was blocking up to 1.5s per recording start)
- Microphone stream start failures (`s.play()`) now emit `recording-error` and reset the recording flag instead of spinning forever
- `quit_app_safely` flushes `settings.json` and `history.json` before `_exit` — no data loss on quit
- **Code review fixes (28 items):** semaphore timeout in `gemini_refine_text`, proper error handling in Gemini STT (`map_err` instead of `unwrap_or_default`), auto-resume of paused media on stop, history entries only for non-empty results, dead code removed (`PositionInitialized`, `REFINEMENT_USER_INSTRUCTION_DEEPSEEK`, `tauri-plugin-window-state`), tray menu rebuilt only on language change, poisoned-mutex logging

### 🎤 Transcription Reliability
- Recording rejection now shows the user a human-readable reason ("Too quiet", "Too short", "No sound captured") via `recording-error` event
- `triggerStart` no longer wipes the previous transcript before the backend confirms recording started
- Removed duplicate frontend text cleanup (backend is the single source of truth)
- Auto-paste no longer leaves the UI stuck in `processing` when the paste fails
- **Deepgram:** switched to `nova-2-general` with automatic fallback to `nova-3-general` on "No such model/language/tier combination" — works across account tiers
- **Groq:** clearer error message for 403 (model permission / region block hint)

### ⚡ Whisper Speed
- `WhisperState` is now cached in `WhisperModel` and reused across transcriptions — no more Metal/Core ML backend re-init on every inference (was the main source of 30-60s delays)
- Enabled `flash_attn` in the Whisper context — faster self-attention on ggml-metal
- Pre-warm now runs on the cached state, so shader compilation is paid exactly once per model load

### 🗣️ Language Selection Removed
- Removed the per-engine language picker from the UI — each engine now auto-detects the spoken language: Whisper (`auto` → whisper.cpp auto-detect), Deepgram (`multi`), Groq (`ru` base), Gemini (`mixed` prompt)
- Removed `DeepgramLanguage`/`WhisperLanguage`/`GroqLanguage`/`GeminiLanguage` states, `set/get_*_language` commands, `useTrayLanguage`, and the language indicator dot in the header

### 🧹 Cleanup
- Removed dead code: `useAudioRecorder.ts`, `streaming.rs`, dead events (`transcript-partial`, `deepgram-final`, `deepgram-error`), and the non-functional "Streaming" toggle
- `setupEvents` now catches subscription failures instead of silently breaking the hotkey
- `handleCancel` surfaces unexpected stop errors
- Fixed Vitest picking up Playwright E2E specs (`e2e/` now excluded)

### 🎤 Audio Sensitivity & Processing Fixes

#### 1. **Software Gain Amplification** ✅
- Added 2x audio gain before noise gate in all 3 STT engines (Whisper, Deepgram, Groq/Gemini)
- Quiet microphone signals at arm's length now pass the RMS threshold
- Clamped to ±1.0 to prevent clipping

#### 2. **Minimum Duration Normalization** ✅
- Deepgram: 0.8s → 0.3s (was silently dropping short phrases)
- Groq/Gemini: 0.8s → 0.3s (same issue)
- Whisper was already 0.3s

#### 3. **Debug Logging** ✅
- Added RMS, sample count, and rejection reason logging to all 3 engines
- Enables diagnosing audio issues from console output

---

### 🧹 Architecture & Code Quality Overhaul

#### 1. **Frontend Refactoring** ✅
- `page.tsx` 1065 → 297 lines (−72%)
- Extracted 8 hooks: `useSettings`, `useRecording`, `useWindowManager`, `useInitialSettings`, `useTargetApp`, `useTauriEvents`, `useKeyboardShortcuts`, `useTrayLanguage`
- Extracted 4 components: `QuickMenu`, `HeaderBar`, `ResultPane`, `ActionBar`
- Extracted 4 utility modules: `types`, `text`, `windowSizes`, `animations`
- Lazy loading for `SettingsPanel` and `WelcomeOverlay`

#### 2. **Backend Refactoring** ✅
- `whisper.rs` 846 lines → 6 focused modules (`whisper/`): `paths`, `model_cache`, `recording`, `transcribe`, `download`, `mod`
- Deduplicated 4 patterns: filename/URL mapping, model_mutex, spawn_capture_thread, hallucination filtering

#### 3. **Critical Bug Fixes (6 P0)** ✅
- B6: Multi-char uppercase handling in transcription
- B7: Hallucination substring matching (was false-positive on normal text)
- B1: Animation target wrong phase in auto-paste mode
- B3: JSON parsing fallback for raw text starting with `{`
- P2: Stale closure in SettingsPanel `setSavedStatus`
- All other P0 bugs from audit resolved

#### 4. **SettingsPanel & GeneralTab Fixes** ✅
- Replaced 10× `alert()`/`confirm()` with `Toast` and `ConfirmDialog` UI components
- Fixed stale closure in `setSavedStatus` (functional update)
- Sequential `invoke` calls → `Promise.all` for parallel execution
- Removed unnecessary `useEffect` deps causing re-renders

#### 5. **Logging & Safety** ✅
- Replaced ~50 `println!`/`eprintln!` → `log::debug!/info!/warn!/error!` across 9 files
- All `unwrap()` → safe alternatives (mutex, settings, debug_log)
- Added `tauri_plugin_log` for structured logging
- Clippy: 0 warnings (was 8)

#### 6. **Test Suite** ✅
- **Frontend:** Vitest setup + 60 tests (was 0%)
  - `text.test.ts` — 32 tests for `cleanHallucinations`
  - `windowSizes.test.ts` — 17 tests for window size logic
  - `useStore.test.ts` — 11 tests for Zustand store
- **Backend:** 74 Rust tests (was 51)
  - `ai_provider.rs` — 4 tests for refinement content builder
  - `keys.rs` — 9 tests for encrypt/decrypt roundtrip
  - `history.rs` — 11 tests for retention periods and serialization
  - Extracted `retention_period_to_seconds()` as testable pure function

---

## 📅 Version 1.2.0 (Published)

### 🎯 Security Hardening & Architecture Overhaul

#### 1. **Critical Security Fixes** ✅

**Problem:** Multiple security vulnerabilities identified during full audit.

**Solution:**
- ✅ Removed `unsafe impl Send + Sync` on `EnigoWrapper` — prevents potential data races
- ✅ Removed legacy decryption with hardcoded nonce (`NYXVOX_NONCE`) — only v2 AES-256-GCM with random nonces supported
- ✅ Removed `std::env::set_var` from main.rs — eliminates UB in multi-threaded Rust (editions 2024+)
- ✅ Removed `unsafe-eval` from CSP — reduces XSS attack surface

**Result:**
- **Data Race Risk:** Eliminated ✅
- **Legacy Crypto:** Removed ✅
- **CSP Hardened:** ✅

---

#### 2. **Recording Pipeline Race Conditions** ✅

**Problem:** Non-atomic flag operations could cause duplicate stop calls and state corruption.

**Solution:**
```rust
// Was (race condition):
if !recording_flag.0.load(Ordering::SeqCst) {
    return Err("ALREADY_IDLE".to_string());
}
recording_flag.0.store(false, Ordering::SeqCst);

// Became (atomic stop guard):
processing_flag.0.compare_exchange(false, true, SeqCst, SeqCst)
    .map_err(|_| "ALREADY_PROCESSING".to_string())?;
```

**Additional Fixes:** Whisper model loading is now synchronous — recording cannot start until model is fully loaded, preventing empty/corrupt transcriptions. Stop handling also keeps the microphone alive during tail padding, so trailing syllables are captured before the recording flag is cleared.

---

#### 3. **Auto-Pause Media Reliability** ✅

**Problem:** Play command could accidentally start Music app; no guard against already-paused state.

**Solution:**
- ✅ Added `is_music_app_running()` — play command only sent if Music is actually running
- ✅ Added 300ms safety delay before unpause to let system settle
- ✅ Double-guard: `!is_media_playing() && !is_music_app_running()` before play

**Result:** Music app no longer accidentally starts when recording stops.

---

#### 4. **Startup Performance** ✅

**Problem:** 13 sequential `invoke` calls at startup caused slow load times.

**Solution:**
- ✅ Created `get_all_settings` Rust command — returns all settings in single IPC call
- ✅ Frontend now uses one `invoke` instead of 13
- ✅ Replaced `setInterval(checkPerms, 2000)` with `tauri://focus` event listeners across 3 components

**Result:** Dramatically faster startup, reduced CPU usage.

---

#### 5. **Dead Code Removal** ✅

**Problem:** Multiple unused files and functions cluttering the codebase.

**Solution:**
- ✅ Deleted `bin_test.rs`, `check_perm.rs` (Rust)
- ✅ Deleted `FeedbackModal.tsx`, `useAudioRecorder.ts`, `CreatorSignature.tsx` (React)
- ✅ Simplified Zustand store — removed unused `isRecording` and `language` fields
- ✅ Removed duplicate hallucination list from frontend (backend is single source of truth)

---

#### 6. **Mixed Language & Voice Frontend Hardening** ✅

**Problem:** Russian-only recognition was stable, but frequent English technical words could be misrecognized; short or silent recordings could also produce subtitle/training artifacts.

**Solution:**
- ✅ Added dedicated `Mixed` language mode alongside Russian, English and Auto
- ✅ Mixed mode uses RU+EN prompts for Whisper, Groq, Gemini and Deepgram
- ✅ Unified backend cleanup now removes subtitle/training artifacts, repeated phrases and formatter preambles across all STT engines
- ✅ Tail padding is now captured before the microphone is stopped, reducing cut-off final words

---

#### 7. **Local Whisper & Core ML Acceleration** ✅

**Problem:** Local models needed faster startup/inference and more reliable offline handling.

**Solution:**
- ✅ Whisper download now also fetches matching macOS Core ML `.mlmodelc` encoder bundles when available
- ✅ CPU fallback remains intact if Core ML download/extraction fails
- ✅ Local model cleanup also removes the associated Core ML bundle
- ✅ Offline Whisper uses synchronous model initialization, non-speech token suppression and model-specific decoding settings

---

#### 8. **Performance Optimizations** ✅

**Problem:** Regex compiled on every call; nearest-neighbor resampling introduced aliasing.

**Solution:**
- ✅ All regex patterns in `utils.rs` cached via `OnceLock` — compile once, use forever
- ✅ Linear interpolation resampling replaces nearest-neighbor — reduces STT aliasing artifacts
- ✅ Target app polling interval increased from 500ms to 2000ms — less `osascript` overhead

---

#### 9. **Bug Fixes** ✅

- ✅ `Array.reverse()` mutating original array in history page → `[...history].reverse()`
- ✅ `handlePaste()` called without `await` → added proper `await`
- ✅ Version strings updated across all files (package.json, tauri.conf.json, Cargo.toml, SettingsPanel.tsx, version.ts, translations.ts)

---

#### 10. **API Provider Model Updates** ✅

**Problem:** Several AI provider model names were invalid or outdated, causing transcription/formatting failures.

**Solution:**
- ✅ **Gemini STT/Refinement**: `gemini-3.1-flash-lite` (non-existent) → `gemini-2.5-flash` — root cause of Gemini transcription failures
- ✅ **Deepgram STT**: `nova-3` → `nova-3-general` — canonical model ID per Deepgram API
- ✅ **Qwen Refinement**: `qwen-plus` (deprecated) → `qwen3.7-plus` — current Alibaba DashScope model
- ✅ **Groq STT prompt**: Added truncation to 896 characters (Groq API limit) — combined `MIXED_RU_EN_STT_PROMPT` + `GROQ_STT_PROMPT` exceeded limit

**Verified against live API documentation (June 2026):**

| Provider | Endpoint | Model | Status |
|----------|----------|-------|--------|
| Deepgram | `api.deepgram.com/v1/listen` | `nova-3-general` | ✅ |
| Groq STT | `api.groq.com/openai/v1/audio/transcriptions` | `whisper-large-v3-turbo` | ✅ |
| Groq LLM | `api.groq.com/openai/v1/chat/completions` | `llama-3.3-70b-versatile` | ✅ |
| Gemini | `generativelanguage.googleapis.com/v1beta/models/...` | `gemini-2.5-flash` | ✅ |
| DeepSeek | `api.deepseek.com/chat/completions` | `deepseek-v4-flash` | ✅ |
| Qwen | `dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen3.7-plus` | ✅ |

---

#### 11. **Whisper Local Transcription Performance** ✅

**Problem:** Local Whisper transcription took ~57 seconds per phrase on M1 MacBook Air (47s Metal GPU overhead + 10s inference).

**Root Cause:** `WhisperContext` was cached, but `WhisperState` was recreated for each transcription. Each new state triggered full Metal backend reinitialization — ~20 GPU shader pipeline compilations (~47 seconds).

**Solution:**
- ✅ **WhisperState caching**: Both `WhisperContext` AND `WhisperState` now cached in `WhisperModel` struct — Metal compiles once, reused across all transcriptions
- ✅ **Model preloading**: Whisper model loaded in background thread at app startup — first transcription doesn't pay cold-start penalty
- ✅ **Thread count uncapped**: Removed `.min(4)` limit — now uses all available CPU cores (8 on M1)
- ✅ **Metal pre-warm**: Tiny inference on silence during model load compiles all GPU shaders upfront

**Result:** Local Whisper transcription dropped from ~57s to ~10s per phrase (**~6x faster**).

---

### 📊 Final Statistics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Security Vulnerabilities** | 4 critical | 0 | **-100%** ✅ |
| **Race Conditions** | 2 | 0 | **-100%** ✅ |
| **Dead Files** | 5 | 0 | **-100%** ✅ |
| **Startup IPC Calls** | 13 | 1 | **-92%** ✅ |
| **Permission Polling** | 3 × setInterval | Event-based | **-100% CPU** ✅ |
| **Regex Compilation** | Per-call | Cached | **-99%** ✅ |
| **Language Modes** | RU / EN / Auto | Mixed / RU / EN / Auto | **Mixed RU+EN** ✅ |
| **Local Acceleration** | Whisper model only | Whisper + Core ML bundle | **Faster local path** ✅ |

---

## 📅 Version 1.1.0

### 🎯 Critical Changes

#### 1. **Code Cleanup** ✅

**Problem:** 94 linter errors (42 critical, 52 warnings)

**Solution:**
- ✅ Replaced all `any` types with proper TypeScript interfaces
- ✅ Added missing React `key` props
- ✅ Fixed `useCallback`/`useEffect` dependencies
- ✅ Removed unused imports and variables
- ✅ Removed dead code files (`UpdatePopup.tsx`, `SettingsPanel_original.tsx`)

**Result:**
- **Errors:** 94 → 0 (**-100%**)
- **Warnings:** 52 → 0 (**-100%**)
- **Build:** ✅ Successful

---

#### 2. **Text Selection & Auto-Copy** ✅

**Feature:** Automatic copying of selected text fragments from the result window.

**Implementation:**
```typescript
const handleTextSelection = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    
    if (selectedText.length > 0) {
        handleCopy(selectedText);
        
        // Show "✓ Copied!" for 600ms
        setAiStatus('✓ Copied!');
        setTimeout(() => setAiStatus(''), 600);
    }
}, [handleCopy]);
```

**Features:**
- ✅ Mouse or keyboard selection (Shift + arrows)
- ✅ Instant copy to clipboard
- ✅ Status **"✓ Copied!"** appears **instead of** "Text not recognized"
- ✅ Display time: **600ms** (quick but noticeable)
- ✅ Semi-transparent orange badge with glassmorphism effect

---

#### 3. **Always-on-Top Logic** ✅

**Problem:** Window didn't stay on top during recording/processing.

**Solution:**
```typescript
const resizeWindow = useCallback(async (w: number, h: number) => {
    // ...
    const shouldBeOnTop = (
        phase === 'recording' || 
        phase === 'processing' || 
        phase === 'result'
    ) ? true : alwaysOnTop;
    
    await win.setAlwaysOnTop(shouldBeOnTop);
}, [alwaysOnTop, phase]);
```

**Logic:**

| Phase | Always on Top | Description |
|-------|---------------|----------|
| `recording` | ✅ **TRUE** | Window on top during recording |
| `processing` | ✅ **TRUE** | Window on top during processing |
| `result` | ✅ **TRUE** | Window on top with result |
| `idle` | ⚙️ **User Setting** | User preference |
| `settings` | ⚙️ **User Setting** | User preference |

**After paste:**
1. Returns `alwaysOnTop` to user setting
2. Window hides (`win.hide()`)
3. Phase → `idle`

---

#### 4. **Critical AI Bugs Fixed** ✅

**Problem 1:** AI translated text to English when speaking Russian.

**Solution:** Simplified prompts to maximum:
```
ОЧИСТИ ТЕКСТ.
1. Язык КАК В ОРИГИНАЛЕ (русский=русский, английский=английский)
2. БЕЗ ПЕРЕВОДА
3. БЕЗ ДОБАВОК
4. ТОЛЬКО ТЕКСТ

RUSSIAN = RUSSIAN
ENGLISH = ENGLISH
NO TRANSLATION
```

**Problem 2:** AI added words on its own (e.g., "CRITICAL" in text).

**Solution:**
- ✅ Added prohibition on adding new information
- ✅ Preserve original text length (±10%)
- ✅ Removed complex formulations from prompts

**Problem 3:** Critical crash during Whisper initialization.

**Solution:**
```rust
// Was (can panic):
let ctx = lock.as_ref().unwrap();

// Became (safe):
let ctx = lock.as_ref().ok_or("Failed to initialize Whisper context")?;
```

---

#### 5. **First Letter Capitalization** ✅

**Problem:** Text started with lowercase letter.

**Solution:**
```typescript
const cleanHallucinations = useCallback((t: string | undefined | null): string => {
    if (!t) return '';
    const text = t.trim();
    
    // Capitalize first letter
    if (text.length > 0) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    
    return text;
}, []);
```

**Result:**
- "проверка текста" → **"Проверка текста"**
- "test message" → **"Test message"**

---

#### 6. **AI Formatting Disabled by Default** ✅

**Problem:** Formatting was enabled by default, degraded recognition.

**Solution:**
```typescript
const [formattingMode, setFormattingMode] = useState<FormattingMode>('none'); // Disabled by DEFAULT!
```

**Now:**
- ✅ Formatting enabled **ONLY from settings**
- ✅ For clean recognition — use without formatting
- ✅ Zap button in menu for quick toggle

---

### 📊 Final Statistics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **TypeScript Errors** | 42 | 0 | **-100%** ✅ |
| **Warnings** | 52 | 0 | **-100%** ✅ |
| **Critical Crashes** | 1+ | 0 | **-100%** ✅ |
| **Text Translation** | Frequent | None | **Fixed** ✅ |
| **Text Selection** | ❌ Broken | ✅ Working | **Added** |
| **Always-on-Top** | ❌ Broken | ✅ Working | **Fixed** |

---

### 🔧 Technical Details

#### Modified Files:

**Frontend:**
- `src/app/page.tsx` — text selection, statuses, alwaysOnTop
- `src/app/globals.css` — text selection enabled (`.select-text`)
- `src/components/SettingsPanel.tsx` — types, dependencies
- `src/components/settings/*.tsx` — prop types

**Backend:**
- `src-tauri/src/prompts.rs` — simplified prompts
- `src-tauri/src/whisper.rs` — safe initialization
- `src-tauri/src/utils.rs` — improved filters
- `src-tauri/src/commands/audio.rs` — formatting by flag

**Configuration:**
- `next.config.ts` — image support (`images: { unoptimized: true }`)

---

### 🎯 Usage Scenarios

#### Scenario 1: Quick Fragment Copy
1. Press hotkey → say text
2. Select fragment with mouse or keyboard
3. Text **automatically copies**
4. **"✓ Copied!"** appears for 0.6 seconds
5. Continue working

#### Scenario 2: Recording with Auto-Paste
1. Enable "Auto-paste" in settings
2. Press hotkey → say text
3. Window **automatically on top of all windows**
4. After processing → **automatic paste**
5. Window **hides**

#### Scenario 3: Clean Recognition (without AI)
1. **Disable formatting** (Zap button)
2. Say text
3. Get **clean text without changes**
4. No translations or additions

---

### 📝 Known Limitations

1. **Text selection** works only in `result` mode
2. **Auto-copy** triggers on selection > 0 characters
3. **AlwaysOnTop** resets after paste
4. **Formatting** requires API key (Gemini/Qwen/DeepSeek)

---

### 🚀 Planned Improvements

- [ ] Transcription history with search
- [ ] Voice commands for control
- [ ] Export to various formats (TXT, MD, DOCX)
- [ ] Support for multiple languages simultaneously
- [ ] Sync between devices

---

<br />
<p align="center">
  <a href="https://avpdev.com/en/"><b>Alexios Odos</b></a>
  &nbsp;|&nbsp;
  <a href="https://avpdev.com/ru/"><b>Aliaksei Patskevich</b></a>
  <br />
  <sub>
    <b>Modern Web Architect</b> • Code, Design & AI
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>
