# NYX-Vox v1.2.0 (Security Hardening & Architecture Overhaul) 🚀
**Focus: Critical Security Fixes, Race Condition Elimination & Performance Optimization 🌪️**

This release represents a comprehensive audit-driven overhaul of NYX Vox. We've eliminated critical security vulnerabilities, fixed race conditions in the recording pipeline, removed dead code, and significantly improved startup performance and media auto-pause reliability.

### ✨ Highlights

*   **Security: Removed Unsafe Send/Sync**: Eliminated `unsafe impl Send + Sync` on `EnigoWrapper` that could cause data races. Enigo is now only initialized on Windows where it's actually used for paste simulation.
*   **Security: Removed Legacy Decryption**: Dropped support for the insecure hardcoded-nonce (`NYXVOX_NONCE`) legacy key format. Only the v2 AES-256-GCM scheme with random nonces is supported now.
*   **Security: Removed `std::env::set_var`**: Removed undefined behavior in multi-threaded Rust programs (UB in editions 2024+).
*   **Security: CSP Hardening**: Removed `unsafe-eval` from Content Security Policy, reducing XSS attack surface.
*   **Bug Fix: Recording Flag Race Condition**: Replaced non-atomic `load` + `store` with `compare_exchange` to prevent duplicate stop calls from corrupting state.
*   **Bug Fix: Whisper Model Loading Race**: Model initialization is now synchronous — recording cannot start until the model is fully loaded, preventing empty/corrupt transcriptions.
*   **Bug Fix: History Array Mutation**: Fixed `Array.reverse()` mutating the original array in the history page.
*   **Bug Fix: Auto-Paste Await**: Added missing `await` on `handlePaste()` call to properly catch paste errors.
*   **Auto-Pause: Fixed Music App Launch**: Added `is_music_app_running()` guard — play command is only sent if Music app is actually running, preventing accidental launch of the built-in player.
*   **Auto-Pause: Added Safety Delay**: 300ms delay before unpause to allow the system to settle after recording stops.
*   **Architecture: Unified Settings Load**: Replaced 13 sequential `invoke` calls at startup with a single `get_all_settings` command — dramatically faster startup.
*   **Architecture: Removed Dead Code**: Deleted `bin_test.rs`, `check_perm.rs`, `FeedbackModal.tsx`, `useAudioRecorder.ts`, `CreatorSignature.tsx`.
*   **Architecture: Simplified Zustand Store**: Removed unused `isRecording` and `language` fields.
*   **Architecture: Deduplicated Hallucination Cleaning**: Removed frontend's duplicate hallucination list — backend is now the single source of truth.
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
**Фокус: Критические исправления безопасности, устранение гонок и оптимизация производительности 🌪️**

Это масштабное обновление, проведенное по результатам полного аудита кодовой базы. Мы устранили критические уязвимости безопасности, исправили гонки состояний в конвейере записи, удалили мёртвый код и значительно ускорили загрузку приложения и работу авто-паузы.

### ✨ Что нового

*   **Безопасность: Убран unsafe Send/Sync**: Ликвидирован `unsafe impl Send + Sync` для `EnigoWrapper`, который мог вызывать гонки данных. Enigo теперь инициализируется только на Windows, где действительно используется для вставки.
*   **Безопасность: Убрано legacy-дешифрование**: Удалена поддержка небезопасного формата ключей с захардкоженным nonce (`NYXVOX_NONCE`). Поддерживается только v2-схема AES-256-GCM со случайными nonce.
*   **Безопасность: Убран `std::env::set_var`**: Устранено неопределённое поведение в многопоточных Rust-программах (UB в editions 2024+).
*   **Безопасность: Усиление CSP**: Удалён `unsafe-eval` из Content Security Policy, снижая поверхность атак XSS.
*   **Исправление бага: Гонка recording flag**: Заменена неатомарная пара `load` + `store` на `compare_exchange` для предотвращения повреждения состояния при дублирующих вызовах stop.
*   **Исправление бага: Гонка загрузки модели Whisper**: Инициализация модели теперь синхронная — запись не начнётся до полной загрузки модели, предотвращая пустые/повреждённые транскрипции.
*   **Исправление бага: Мутация массива истории**: Исправлен `Array.reverse()`, мутирующий оригинальный массив на странице истории.
*   **Исправление бага: Auto-paste без await**: Добавлен пропущенный `await` на вызов `handlePaste()` для корректной обработки ошибок вставки.
*   **Авто-пауза: Исправлен запуск Music**: Добавлена проверка `is_music_app_running()` — play-команда отправляется только если Music действительно запущен, предотвращая случайный запуск встроенного плеера.
*   **Авто-пауза: Добавлена задержка безопасности**: Задержка 300мс перед unpause для стабилизации системы после остановки записи.
*   **Архитектура: Единая загрузка настроек**: 13 последовательных `invoke` при старте заменены на один вызов `get_all_settings` —значительное ускорение загрузки.
*   **Архитектура: Удалён мёртвый код**: Удалены `bin_test.rs`, `check_perm.rs`, `FeedbackModal.tsx`, `useAudioRecorder.ts`, `CreatorSignature.tsx`.
*   **Архитектура: Упрощён Zustand store**: Удалены неиспользуемые поля `isRecording` и `language`.
*   **Архитектура: Устранено дублирование очистки галлюцинаций**: Фронтенд-список галлюцинаций удалён — бэкенд является единственным источником правды.
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
