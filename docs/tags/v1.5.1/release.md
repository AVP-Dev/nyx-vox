# NYX-Vox v1.5.1 (Comprehensive Audit Remediation & Performance Hardening) 🚀
**Focus: Comprehensive Audit Remediation, Zero-Leak Architecture, Privacy Hardening & IPC Optimization 🎙️**

> **Release status:** Official release v1.5.1. Resolves all frontend and backend audit findings (FE-1..FE-8, BE-1..BE-11), eliminates memory and listener leaks, hardens privacy in Whisper mode, optimizes WindowServer and IPC dispatching, and ensures rock-solid stability across macOS and Windows.

This release delivers comprehensive architectural refinement and hardening across the entire NYX Vox stack. Following an in-depth audit, both the frontend UI/IPC layer and the Rust audio backend received targeted fixes to guarantee zero-leak operation, smooth streaming performance, and complete data privacy.

---

### ✨ Highlights

*   **🛡️ 100% Privacy Hardening in Whisper Mode (BE-4)**:
    *   In local Whisper mode, speech audio is processed strictly offline by default.
    *   Eliminated unintended interim streaming to cloud Groq when an API key was present.
    *   Cloud interim streaming in Whisper mode is now an explicit opt-in (`"cloud_interim": true` in `settings.json`).
*   **⚡ Audio Delta Streaming & Lock Contention Elimination (BE-1)**:
    *   Interim streaming workers (Whisper, Deepgram HTTP fallback, Deepgram WS, and AI provider) now clone only the new audio delta under the CPAL audio lock.
    *   Full audio reassembly occurs outside the lock, preventing RT audio buffer starvation and clicks.
*   **🧼 Zero-Leak Event & Window Architecture (FE-1, FE-3)**:
    *   Added mounted cancellation flags in `useTauriEvents`, `WaveformVisualizer`, and `useWindowManager`, guaranteeing all asynchronous Tauri IPC unlisteners are properly cleaned up upon unmount.
    *   Implemented dimension and state caching in `useWindowManager`, eliminating the WindowServer IPC storm during continuous speech streaming.
    *   Eliminated stale closures in keyboard shortcuts and event listeners via fresh ref bindings.
*   **🚀 IPC Performance & Startup Acceleration (FE-6, FE-8)**:
    *   Replaced the 10-call startup IPC waterfall with a single atomic `get_all_settings` invocation.
    *   Introduced 300ms debounce with lifecycle timer cleanup for settings sliders (`audioGain`, `noiseGate`, `vadSilenceTimeout`).
*   **🍎 macOS Native Optimization & Thread Safety (BE-8, BE-9)**:
    *   Migrated frontmost active application detection from `fork/exec osascript` to native `NSWorkspace` / `NSRunningApplication` via `objc2-app-kit`.
    *   Moved macOS synthetic paste chord dispatching to a cooperative `spawn_blocking` worker with abort cancellation, freeing the main thread.
*   **📝 Improved Dictation UX (FE-2, FE-4)**:
    *   Enabled `Shift + Enter` in `editing` mode to insert newlines without triggering accidental paste injection.
    *   Restored lazy loading for `SettingsPanel` by decoupling localization dictionary imports.
*   **🛡️ Robust Error Handling & Boundaries (BE-3, BE-5, BE-7, BE-11, FE-5)**:
    *   `recording_flag` reliably resets if microphone initialization fails; interim POST requests enforce a 10-second timeout.
    *   Temporary network loss during cloud STT gracefully falls back to local Whisper without corrupting or overwriting persistent user settings.
    *   Added safe UTF-8 slicing on word boundaries for STT prompt context.
    *   Guarded `resample_to_16k` against division by zero and validated `noiseGate` bounds.
    *   Enforced ADR #6 (backend is the single source of truth for text normalization and deduplication) and pruned dead streaming code.

---

### 📦 Installation & Setup

#### For Windows Users:
1. Download `NYX-Vox-Setup-1.5.1.exe` (or `.msi`) from the Assets below.
2. Run the installer and launch NYX Vox.
3. If Windows SmartScreen displays a warning for an unsigned binary, click **"More info"** -> **"Run anyway"**.
4. Press `Ctrl + Space` anywhere to start dictating!

#### For macOS Users:
1. Download `NYX-Vox-1.5.1.dmg`.
2. Drag **NYX Vox** to your `/Applications` folder.
3. ⚠️ **Permissions**: Grant Accessibility and Microphone access in **System Settings -> Privacy & Security**.
4. 🛡️ **Gatekeeper Fix**: If macOS blocks execution:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
5. Press `Option + Space` anywhere to start dictating!

---

# Релиз v1.5.1 (Комплексное устранение находок аудита и повышение стабильности) 🚀
**Фокус: Устранение находок аудита, архитектура без утечек, защита приватности и оптимизация IPC 🎙️**

> **Статус релиза:** Официальный релиз v1.5.1. Полностью закрывает все замечания фронтенд- и бэкенд-аудита (FE-1..FE-8, BE-1..BE-11), устраняет утечки памяти и слушателей, гарантирует 100% приватность в режиме Whisper, оптимизирует нагрузку на WindowServer и IPC, а также обеспечивает максимальную стабильность на macOS и Windows.

Этот релиз посвящен всесторонней оптимизации архитектуры и устранению скрытых дефектов по результатам аудита кодовой базы. Исправления затронули как фронтенд и слой межпроцессного взаимодействия (IPC), так и Rust-бэкенд захвата и обработки аудио.

---

### ✨ Что нового

*   **🛡️ 100% защита приватности в режиме Whisper (BE-4)**:
    *   В режиме локального Whisper аудио обрабатывается исключительно на устройстве.
    *   Устранена утечка отправки промежуточных чанков в облачный Groq при наличии сохраненного API-ключа.
    *   Облачный interim в режиме Whisper теперь активируется только при явном указании `"cloud_interim": true` в `settings.json`.
*   **⚡ Дельта-стриминг аудио и устранение блокировок RT-потока (BE-1)**:
    *   Промежуточные воркеры (Whisper, фолбек Deepgram HTTP, Deepgram WS и AI-провайдеры) теперь клонируют под мьютексом только новую дельту с момента прошлого тика.
    *   Полный буфер собирается вне мьютекса cpal, что исключает задержки аудиопотока и артефакты звука.
*   **🧼 Архитектура без утечек памяти и событий (FE-1, FE-3)**:
    *   В хуки `useTauriEvents`, `WaveformVisualizer` и `useWindowManager` добавлены флаги отмены `isMounted` — слушатели событий гарантированно отписываются при размонтировании компонентов.
    *   Добавлено кэширование размеров и состояния окна в `useWindowManager`, устранившее паразитный шторм вызовов WindowServer при живом стриминге.
    *   Устранены устаревшие замыкания (stale closures) в обработчиках горячих клавиш и событиях IPC.
*   **🚀 Ускорение запуска и оптимизация IPC (FE-6, FE-8)**:
    *   Каскадный водопад из 10 запросов при старте приложения заменен на один атомарный вызов `get_all_settings`.
    *   Добавлен дебаунс 300 мс с корректной очисткой таймеров для слайдеров настроек (`audioGain`, `noiseGate`, `vadSilenceTimeout`).
*   **🍎 Нативная оптимизация для macOS (BE-8, BE-9)**:
    *   Определение активного приложения переведено с вызова `osascript` через fork/exec на нативный `NSWorkspace` / `NSRunningApplication` через `objc2-app-kit`.
    *   Синтетическая эмуляция вставки на macOS вынесена из главного потока в `spawn_blocking` с возможностью отмены.
*   **📝 Удобство редактирования и оптимизация сборки (FE-2, FE-4)**:
    *   В режиме редактирования комбинация `Shift + Enter` теперь корректно переносит строку, не вызывая авто-вставку.
    *   Восстановлен полноценный lazy-loading панели настроек (`SettingsPanel`) благодаря выносу словаря локализации в `translations.ts`.
*   **🛡️ Защита от сбоев и граничные проверки (BE-3, BE-5, BE-7, BE-11, FE-5)**:
    *   Флаг записи надежно сбрасывается при ошибке инициализации микрофона; добавлен таймаут 10 секунд на запросы interim POST.
    *   Временные сетевые сбои в облачном режиме мягко переключаются на Whisper без затирания пользовательских настроек в `settings.json`.
    *   Безопасное усечение текста по границам UTF-8 символов для STT-промптов.
    *   Защита от деления на 0 при ресэмплинге и валидация границ `noiseGate`.
    *   Приведение фронтенда в полное соответствие с ADR #6 и удаление мертвого кода фантомного JSON-стриминга.

---

### 📦 Установка и запуск

#### Для пользователей Windows:
1. Скачайте инсталлятор `NYX-Vox-Setup-1.5.1.exe` (или `.msi`) из блока Assets внизу.
2. Запустите установку и откройте NYX Vox.
3. Если Windows SmartScreen предупредит о неподписанном файле, нажмите **«Подробнее»** -> **«Выполнить в любом случае»**.
4. Нажмите `Ctrl + Space` в любой программе для начала диктовки!

#### Для пользователей macOS:
1. Скачайте образ `NYX-Vox-1.5.1.dmg`.
2. Перетащите **NYX Vox** в папку «Программы» (`/Applications`).
3. ⚠️ **Разрешения**: Предоставьте права в «Системных настройках» -> «Конфиденциальность и безопасность» -> «Универсальный доступ» и «Микрофон».
4. 🛡️ **Снятие карантина Gatekeeper** (при необходимости):
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
5. Нажмите `Option + Space` для начала диктовки!
