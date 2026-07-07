# NYX-Vox v1.2.0 (Security Hardening & Architecture Overhaul) 🚀
**Focus: Critical Security Fixes, Race Condition Elimination, Voice Frontend Reliability & Performance Optimization 🌪️**

This release represents a comprehensive audit-driven overhaul of NYX Vox. We've eliminated critical security vulnerabilities, fixed race conditions in the recording pipeline, removed dead code, significantly improved startup performance and media auto-pause reliability, and hardened the voice processing path for cleaner mixed-language dictation.

### ✨ Highlights

*   **Security: Removed Unsafe Send/Sync**: Eliminated `unsafe impl Send + Sync` on `EnigoWrapper` that could cause data races. Enigo is now only initialized on Windows where it's actually used for paste simulation.
*   **Security: Removed Legacy Decryption**: Dropped support for the insecure hardcoded-nonce (`NYXVOX_NONCE`) legacy key format. Only the v2 AES-256-GCM scheme with random nonces is supported now.
*   **Security: Removed `std::env::set_var`**: Removed undefined behavior in multi-threaded Rust programs (UB in editions 2024+).
*   **Security: CSP Hardening**: Removed `unsafe-eval` from Content Security Policy, reducing XSS attack surface.
*   **UX: Automated Permission Requests**: First-launch onboarding now automatically triggers macOS System Preferences for Accessibility and Microphone access, eliminating the need to hunt through settings.
*   **UX: Noise Gate Slider**: Added a global sensitivity slider in Settings to dynamically cut out background noise (like a loud TV), ensuring STT only triggers when speaking directly into the mic.
*   **UX: Mixed RU+EN Language Mode**: Added a dedicated `Mixed` language button alongside Russian, English and Auto. It is optimized for Russian dictation with inline English technical terms such as API, GitHub, pull request, endpoint, TypeScript and deploy.
*   **Bug Fix: Window Dock Positioning**: Rewrote bounds checking logic to prevent the window from forcefully jumping upward when positioned near the bottom macOS dock.
*   **Bug Fix: Whisper Korean Hallucinations**: Added strict hallucination filters for offline Whisper models to suppress known repetitive artifacts like "그래도 어디에?".
*   **Bug Fix: Recording Flag Race Condition**: Replaced non-atomic `load` + `store` with `compare_exchange` to prevent duplicate stop calls from corrupting state.
*   **Bug Fix: Real Tail Padding Capture**: Stop handling no longer disables the microphone before the post-roll delay. The last syllables are now captured more reliably instead of being cut off at hotkey release.
*   **Bug Fix: Whisper Model Loading Race**: Model initialization is now synchronous — recording cannot start until the model is fully loaded, preventing empty/corrupt transcriptions.
*   **Bug Fix: History Array Mutation**: Fixed `Array.reverse()` mutating the original array in the history page.
*   **Bug Fix: Auto-Paste Await**: Added missing `await` on `handlePaste()` call to properly catch paste errors.
*   **Auto-Pause: Fixed Music App Launch**: Added `is_music_app_running()` guard — play command is only sent if Music app is actually running, preventing accidental launch of the built-in player.
*   **Auto-Pause: Added Safety Delay**: 300ms delay before unpause to allow the system to settle after recording stops.
*   **Architecture: Unified Settings Load**: Replaced 13 sequential `invoke` calls at startup with a single `get_all_settings` command — dramatically faster startup.
*   **Architecture: Removed Dead Code**: Deleted `bin_test.rs`, `check_perm.rs`, `FeedbackModal.tsx`, `useAudioRecorder.ts`, `CreatorSignature.tsx`.
*   **Architecture: Simplified Zustand Store**: Removed unused `isRecording` and `language` fields.
*   **Architecture: Deduplicated Hallucination Cleaning**: Removed frontend's duplicate hallucination list — backend is now the single source of truth.
*   **Architecture: Unified STT Artifact Cleanup**: All engines now pass through backend cleanup for subtitle/training artifacts, repeated phrases and filler preambles before the final text is shown or formatted.
*   **Local AI: Core ML Accelerator Download**: Whisper downloads now also fetch the matching `.mlmodelc` Core ML encoder bundle on macOS, enabling faster local inference when available while keeping CPU fallback intact.
*   **Local AI: Improved Offline Model Handling**: Local Whisper processing now uses synchronous model initialization, stronger mixed-language prompts, non-speech suppression and model-specific decoding settings for cleaner offline recognition.
*   **Performance: Cached Regex Patterns**: All regex patterns in `utils.rs` are now compiled once via `OnceLock` — eliminates per-call compilation overhead.
*   **Performance: Linear Interpolation Resampling**: Replaced nearest-neighbor with linear interpolation for 16kHz resampling — reduces aliasing artifacts in STT.
*   **Performance: Event-Based Permission Checking**: Replaced 2-second `setInterval` polling with `tauri://focus` event listeners across 3 components.
*   **Performance: Reduced Target App Polling**: Increased interval from 500ms to 2000ms, reducing CPU usage from `osascript` calls.

### 📦 Installation & Update Note
1. Download the `.dmg` or `.app` from the Assets below.
2. Drag **NYX Vox** to your Applications folder, replacing the older version.
3. ⚠️ **macOS Permissions Reset**: After updating, macOS may require refreshing universal access rights.
   - Go to **Settings inside the app** and click **"Reset Permissions"**, then recheck the accessibility box.
   - Alternatively, remove and re-add NYX Vox in System Settings -> Privacy & Security -> Accessibility.
4. 🛡️ **Unsigned App Gatekeeper Fix**: If macOS blocks execution, run the following command in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

---

# Релиз v1.2.0 (Усиление безопасности и перестройка архитектуры) 🚀
**Фокус: Критические исправления безопасности, устранение гонок, надёжность голосового фронтенда и оптимизация производительности 🌪️**

Это масштабное обновление, проведенное по результатам полного аудита кодовой базы. Мы устранили критические уязвимости безопасности, исправили гонки состояний в конвейере записи, удалили мёртвый код, значительно ускорили загрузку приложения и работу авто-паузы, а также усилили обработку голоса для более чистой mixed-language диктовки.

### ✨ Что нового

*   **Безопасность: Убран unsafe Send/Sync**: Ликвидирован `unsafe impl Send + Sync` для `EnigoWrapper`, который мог вызывать гонки данных. Enigo теперь инициализируется только на Windows, где действительно используется для вставки.
*   **Безопасность: Убрано legacy-дешифрование**: Удалена поддержка небезопасного формата ключей с захардкоженным nonce (`NYXVOX_NONCE`). Поддерживается только v2-схема AES-256-GCM со случайными nonce.
*   **Безопасность: Убран `std::env::set_var`**: Устранено неопределённое поведение в многопоточных Rust-программах (UB в editions 2024+).
*   **Безопасность: Усиление CSP**: Удалён `unsafe-eval` из Content Security Policy, снижая поверхность атак XSS.
*   **UX: Автоматический запрос прав**: При первом запуске (онбординг) теперь автоматически вызываются системные диалоги macOS для выдачи прав к Микрофону и Универсальному доступу.
*   **UX: Ползунок чувствительности (Шумодав)**: В Настройки добавлен ползунок Noise Gate. Теперь можно отсечь фоновый шум (например, громкий телевизор), чтобы программа реагировала только на голос в микрофон.
*   **UX: Режим языка Mixed RU+EN**: В настройки добавлена отдельная кнопка `Mixed` рядом с Русским, Английским и Авто. Режим оптимизирован под русскую диктовку с английскими техническими вставками: API, GitHub, pull request, endpoint, TypeScript, deploy и т.д.
*   **Исправление бага: Прыжки окна у Dock**: Переписана логика проверки границ монитора, чтобы окно больше не отпрыгивало вверх при привязке к нижнему краю экрана.
*   **Исправление бага: Корейские галлюцинации Whisper**: Добавлен строгий фильтр для локальной модели Whisper, удаляющий известные шумовые артефакты (например, "그래도 어디에?").
*   **Исправление бага: Гонка recording flag**: Заменена неатомарная пара `load` + `store` на `compare_exchange` для предотвращения повреждения состояния при дублирующих вызовах stop.
*   **Исправление бага: Реальный захват tail padding**: Stop-логика больше не выключает микрофон до post-roll задержки. Последние слоги теперь захватываются надёжнее и не обрезаются при отпускании хоткея.
*   **Исправление бага: Гонка загрузки модели Whisper**: Инициализация модели теперь синхронная — запись не начнётся до полной загрузки модели, предотвращая пустые/повреждённые транскрипции.
*   **Исправление бага: Мутация массива истории**: Исправлен `Array.reverse()`, мутирующий оригинальный массив на странице истории.
*   **Исправление бага: Auto-paste без await**: Добавлен пропущенный `await` на вызов `handlePaste()` для корректной обработки ошибок вставки.
*   **Авто-пауза: Исправлен запуск Music**: Добавлена проверка `is_music_app_running()` — play-команда отправляется только если Music действительно запущен, предотвращая случайный запуск встроенного плеера.
*   **Авто-пауза: Добавлена задержка безопасности**: Задержка 300мс перед unpause для стабилизации системы после остановки записи.
*   **Архитектура: Единая загрузка настроек**: 13 последовательных `invoke` при старте заменены на один вызов `get_all_settings` —значительное ускорение загрузки.
*   **Архитектура: Удалён мёртвый код**: Удалены `bin_test.rs`, `check_perm.rs`, `FeedbackModal.tsx`, `useAudioRecorder.ts`, `CreatorSignature.tsx`.
*   **Архитектура: Упрощён Zustand store**: Удалены неиспользуемые поля `isRecording` и `language`.
*   **Архитектура: Устранено дублирование очистки галлюцинаций**: Фронтенд-список галлюцинаций удалён — бэкенд является единственным источником правды.
*   **Архитектура: Единая очистка STT-артефактов**: Все движки теперь проходят через backend-cleanup от субтитровых/обучающих артефактов, повторов и служебных преамбул перед показом или форматированием текста.
*   **Локальный AI: Загрузка Core ML ускорителя**: При скачивании Whisper на macOS теперь дополнительно загружается соответствующий `.mlmodelc` Core ML encoder bundle для более быстрого локального инференса, при этом CPU fallback сохраняется.
*   **Локальный AI: Улучшена обработка локальными моделями**: Локальный Whisper теперь использует синхронную инициализацию, усиленные mixed-language промпты, подавление неречевых токенов и настройки декодирования под тип модели для более чистого офлайн-распознавания.
*   **Производительность: Кэширование regex**: Все регулярные выражения в `utils.rs` теперь компилируются один раз через `OnceLock` — устраняется overhead компиляции при каждом вызове.
*   **Производительность: Линейная интерполяция при ресемплинге**: Замена nearest-neighbor на линейную интерполяцию для ресемплинга в 16kHz — снижение артефактов aliases в STT.
*   **Производительность: Event-based проверка разрешений**: Замена `setInterval` polling каждые 2 секунды на обработчики событий `tauri://focus` в 3 компонентах.
*   **Производительность: Снижение частоты опроса target app**: Увеличен интервал с 500мс до 2000мс, снижая нагрузку CPU от вызовов `osascript`.

### 📦 Примечание по установке и обновлению
1. Скачайте `.dmg` или `.app` из блока Assets ниже.
2. Перетащите **NYX Vox** в папку Программы (Applications) с заменой старой версии.
3. ⚠️ **Сброс прав macOS**: При обновлении система может временно заблокировать доступ к автовставке.
   - Нажмите **"Сброс разрешений"** в настройках самого приложения и заново поставьте галочку.
   - Либо вручную удалите и верните NYX Vox в Системные настройки -> Конфиденциальность и безопасность -> Универсальный доступ.
4. 🛡️ **Если запуск заблокирован Gatekeeper**: Выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

**Built with ❤️ for macOS by AVP-Dev.**

---

## 📋 Дополнения к v1.2.0 (2026-07-07)

> Изменения, внесённые в рамках подготовки к релизу v1.2.0.

### 🧹 Рефакторинг архитектуры
- **Frontend:** `page.tsx` 1065 → 297 строк (−72%). Извлечено 8 хуков, 4 компонента, 4 utility-модуля. Lazy loading для SettingsPanel/WelcomeOverlay.
- **Backend:** `whisper.rs` 846 → 6 модулей (`whisper/`). Дедупликация 4 паттернов.
- **UI-компоненты:** Созданы `Toast` и `ConfirmDialog` вместо 10× `alert()`/`confirm()`.
- **Логирование:** ~50 `println!`/`eprintln!` заменены на `log::debug!/info!/warn!/error!` в 9 файлах. Все `unwrap()` заменены на безопасные альтернативы.

### 🐛 Исправлено 6 критических багов (P0)
- **B6:** Обработка многосимвольных заглавных букв (ß → SS)
- **B7:** Ложные срабатывания при substring-совпадении галлюцинаций
- **B1:** Неверная анимация при auto-paste
- **B3:** Падение JSON-парсинга при тексте начинающемся с `{`
- **P2:** Stale closure в `setSavedStatus` SettingsPanel
- Все clippy warnings устранены (было 8)

### 🎤 Улучшена чувствительность микрофона
- **Software gain 2x** — добавлено усиление сигнала перед noise gate во всех 3 движках (Whisper, Deepgram, Groq/Gemini). Речь на расстоянии вытянутой руки теперь распознается.
- **Min duration 0.8s → 0.3s** для Deepgram и Groq/Gemini — короткие фразы ("да", "привет") больше не теряются.
- **Debug-логирование** — RMS, количество сэмплов и причина отбрасывания теперь видны в консоли.

### 🧪 Тесты
- **Frontend:** 60 тестов через vitest (было 0) — `cleanHallucinations`, `windowSizes`, `useStore`
- **Backend:** 74 Rust теста (было 51) — `ai_provider`, `keys`, `history`
- **Верификация:** clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success

### 📄 Документация
- Созданы: `docs/architecture.md`, `docs/decisions.md`, `docs/glossary.md`, `docs/overview.md`, `docs/state.md`
- Обновлён CHANGELOG (Unreleased section)
- Добавлены ADR: Toast/ConfirmDialog, software gain, min duration

---

## 📋 P1 Phase Complete (2026-07-08)

> Phase 1 quality improvements — ESLint, Configurable Gain, E2E Tests, Enter Paste Bug Investigation.

### ✅ ESLint Verification
- **Status:** CLEAN — 0 errors, 0 warnings
- **Finding:** Previous claim of "219 ESLint errors" in state.md was outdated/stale
- **Action:** Removed outdated references from known problems, tech debt, and roadmap

### ✅ Configurable Audio Gain
- **Backend:** `AudioGain` state type (`Mutex<f32>`) in `state.rs`
- **Command:** `set_audio_gain` with clamping (1.0-5.0), persistence to store
- **Integration:** All 3 STT engines (Whisper, Deepgram, Groq/Gemini) accept `gain` parameter
- **Frontend:** Slider in GeneralTab (range 1.0-5.0, step 0.5, default 2.0)
- **Translations:** `audioGainTitle`, `audioGainDesc`, `audioGainLow`, `audioGainHigh` for en/ru
- **Files modified:** 17 files, +131/-26 lines

### ✅ Playwright E2E Tests
- **Setup:** `@playwright/test` installed, Chromium browser configured
- **Config:** `playwright.config.ts` — auto-starts Next.js dev server on port 3002
- **Tests:** 3 smoke tests in `e2e/app.spec.ts`:
  1. Homepage loads successfully
  2. Page has expected content structure
  3. No console errors on load
- **Scripts:** `bun run test:e2e`, `bun run test:e2e:ui`
- **Result:** 3/3 passed (6.5s)

### ✅ Enter Paste Bug Investigation
- **Root Cause:** Race condition in `paste_text` (audio.rs:508-549)
  - Cmd+V spawned as fire-and-forget, returns `Ok(())` immediately
  - Frontend calls `win.hide()` before Cmd+V executes
  - Focus transfer disrupted
- **Secondary Issue:** `w.hide()` vs `app.hide()` — window hide doesn't reliably transfer focus on macOS
- **Tertiary Issue:** Silent error suppression (`let _ =` on critical operations)
- **Proposed Fixes:**
  1. Await Cmd+V completion via `oneshot::channel`
  2. Use `app.hide()` unconditionally on macOS
  3. Remove redundant frontend `win.hide()`
  4. Add error logging for critical operations
- **Status:** Root cause identified, fixes proposed (not yet implemented)

### 📊 Verification Results
| Check | Result |
|-------|--------|
| `cargo check` | ✅ passed |
| `cargo clippy -- -D warnings` | ✅ 0 warnings |
| `bun run build` | ✅ passed |
| `cargo test` | ✅ 74/74 passed |
| `bun run test` | ✅ 60/60 passed |
| `bun run test:e2e` | ✅ 3/3 passed |

### 💰 Token Usage (P1 Phase)
| Component | Tokens |
|-----------|--------|
| Playwright E2E agent | 33,215 |
| Enter paste bug agent | 58,000 |
| ESLint agent | 31,941 |
| Configurable Gain agent | 107,104 |
| **Subagents total** | **230,260** |
| Main conversation (est.) | ~80,000 |
| **Phase total (est.)** | **~310,000** |
