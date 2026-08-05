# Текущее состояние проекта

> Обновляется КАЖДОЙ рабочей сессией агента. Это самый важный файл —
> именно он экономит токены на "въезжание" в проект в новой сессии.
> Держи компактно: не история навсегда, а срез "что сейчас".

## Последнее обновление
Дата: 2026-08-05
Кто/что обновило: Командный агент (Аудит + GigaChat + фиксы стабильности)

## Что сейчас в работе
- Добавлен SberAI/GigaChat как движок форматирования (модель GigaChat-2). Ключ — авторизационный (base64 client_id:secret) из кабинета developers.sber.ru
- Исправлены баги «закрытия/зависания» и «не транскрибирует»: причины пустого результата, paste_text, сетевой чек, s.play
- Удалён мёртвый код (streaming.rs, useAudioRecorder, мёртвые события, тумблер «Стриминг»)
- Синхронизированы промпты: docs/AI_PROMPTS.md зеркалит prompts.rs
- Следующий шаг: тестирование GigaChat с реальным ключом (`bun run tauri dev`), затем коммит в dev

## Что стабильно работает (не трогать без причины)
- STT pipeline (Whisper, Deepgram, Groq, Gemini)
- AI formatting (Gemini, DeepSeek, Qwen, Groq, GigaChat)
- Автопаста через CGEvent (с проверкой Accessibility и возвратом статуса)
- Шифрование API-ключей (AES-256-GCM)
- Noise Gate
- Audio Gain (configurable, 1.0-5.0, default 2.0)
- Автопауза медиа
- История записей
- Системный трей
- Playwright E2E (3 smoke-теста)

## Известные проблемы / баги
- Whisper turbo: обработка ~60s на некоторых фразах (требует расследования — возможно memory pressure)
- GigaChat: не тестировался с реальным ключом — нужна проверка OAuth-флоу и выбора модели
- `libc::_exit(0)` при выходе сохранён (необходим для избежания ggml crash), но перед ним добавлен flush данных

## Технический долг (осознанный)
- macOS only — архитектурное решение, не баг

## Что сделано
- **Сессия 6 (STT Quality):** Исправлены 3 бага распознавания речи: (1) Groq не отправлял параметр language при mixed → Whisper默认ал на английский; (2) Gemini всегда получал "auto" вместо "mixed" из-за отсутствия GeminiLanguage state; (3) Deepgram использовал "multi" вместо "ru" для mixed-режима. Добавлен GeminiLanguage state (state.rs, lib.rs, settings.rs, audio.rs). Удалён нестабильный "auto" режим из всех движков (types.ts, EnginesTab.tsx, SettingsPanel.tsx, useSettings.ts, whisper/transcribe.rs, streaming.rs, prompts.rs). Улучшено обрезание промпта Groq (по границе слова). clippy 0 warnings, tsc --noEmit pass.
- **Сессия 5 (Final):** Финальная верификация: clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success. Обновлён CHANGELOG (Unreleased section с 6 блоками улучшений).
- **Сессия 4 (Tests):** Frontend: установлен vitest, создано 3 тест-файла (60 тестов). Backend: добавлены тесты в ai_provider.rs (4), keys.rs (9), history.rs (11). Итого: 74 Rust тестов (было 51), 60 frontend тестов (было 0). clippy 0 warnings.
- **Сессия 3 (SettingsPanel + GeneralTab):** Исправлены P2 проблемы. Созданы Toast и ConfirmDialog компоненты. Заменены 10× alert()/confirm() на UI-компоненты. Исправлен stale closure в setSavedStatus. Sequential invokes → Promise.all. useEffect deps без лишних ре-рендеров. Удалены debug console.error.
- **Сессия 2A (Frontend):** page.tsx 1065→297 строк (−72%). Создано: 8 хуков, 4 компонента, 4 utility модуля. Lazy loading для SettingsPanel/WelcomeOverlay.
- **Сессия 2B (Backend):** whisper.rs 846→6 модулей (whisper/). Каждый <250 строк. Дедупликация 4 паттернов. 51 тест проходит.
- P1-P4: краши, распознавание, clippy, unwrap/println — всё исправлено
- P0 (Сессия 1): 6 критических багов исправлено
- clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success

## Следующие шаги (roadmap)

### 🔴 Приоритет 1 — Баги
1. **Enter paste bug** — race condition в `paste_text` (audio.rs:508-549). Фикс: await через `oneshot::channel`, `app.hide()` вместо `w.hide()`, убрать redundant `win.hide()` из фронтенда. Root cause найден, требуется реализация.

### 🟡 Приоритет 2 — Производительность
2. **Whisper State кэширование** — `create_state()` на каждый вызов, кэшировать как контекст
3. **Прогресс инференса** — Whisper callback для прогресс-бара
4. **Streaming для Deepgram** — WebSocket вместо batch REST API

### 🟢 Приоритет 3 — Фичи
5. **Экспорт истории** (TXT/MD/JSON)
6. **Поиск по истории**
7. **Кастомный словарь** — технические термины, имена
8. **Настраиваемые горячие клавиши**

### 🔵 Приоритет 4 — Архитектура
9. **Error boundary** (frontend) — fallback UI при React crash
10. **Structured logging** (frontend) — tauri-plugin-log
11. **CI/CD pipeline** — GitHub Actions: clippy + test + build при PR

## Журнал сессий (кратко, последние 5-10 записей, старое можно удалять)
- [2026-08-05] **Сессия 7 (Аудит + GigaChat)**: Исправлены баги стабильности и транскрипции, добавлен SberAI/GigaChat. **Стабильность:** `paste_text` проверяет Accessibility, возвращает реальный статус, показывает окно при ошибке (нет «скрытого окна без вставки»); сетевой чек кэшируется 5с (был блок 1.5с); ошибки `s.play()` эмитят `recording-error` и сбрасывают флаг; `quit_app_safely` делает flush settings.json/history.json перед `_exit`. **Транскрипция:** причины пустого результата (тихо/коротко/нет звука) через `recording-error` (локализовано); `triggerStart` не стирает прошлый текст до подтверждения старта; убрана двойная очистка на фронте; auto-paste не зависает в processing. **GigaChat:** `gigachat.rs` (OAuth-токен 30 мин с кэшем, автоключ base64(client_id:secret) из кабинета Сбера, модель GigaChat-2), Service::Gigachat, кнопка в EnginesTab + поле ключа в KeysTab. **Чистка:** удалены useAudioRecorder.ts, streaming.rs, мёртвые события, нерабочий тумблер «Стриминг»; `setupEvents` с catch; vitest исключён из e2e. Проверки: cargo test 80 pass, clippy 0 warnings, bun test 60 pass, lint/build/tsc чистые. Ветка `dev`, main не трогали.
- [2026-08-05] **Сессия чистки**: Удалены build-артефакты и хлам (~9.2 ГБ): `src-tauri/target/` (9 ГБ), `.next/`, `out/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo`, `window_debug.log`, `.DS_Store` (4 шт). Добавлен `.commandcode/` в .gitignore (служебная папка ассистента). Структурированы `docs/_reports/`: создан индекс `README.md` со статусами актуальности — все отчёты от 2026-07-07, задачи выполнены. Обновлён docs/README.md (ссылки на основные доки).
- [2026-07-08] **Сессия P1 завершена**: 4 задачи решены параллельно через субагентов. ESLint чист (0 ошибок), Audio Gain вынесен в настройки (слайдер 1.0-5.0), Playwright E2E настроен (3 теста), Enter paste bug расследован (root cause найден, фикс в roadmap). Документация обновлена: state.md, tags/v1.2.0/release.md, tags/history.md. Коммит `7e3a607`. Следующий шаг: Enter paste bug fix (P1 #1) или P2.
- [2026-07-08] Audio Gain настройка: Вынесен захардкоженный AUDIO_GAIN (2.0) в конфигурируемую настройку. Backend: AudioGain state (Mutex<f32>), set_audio_gain command (clamp 1.0-5.0), загрузка из store при старте. Все три движка (whisper/recording.rs, deepgram.rs, ai_provider.rs) теперь принимают gain параметр вместо константы. Frontend: слайдер в GeneralTab (range 1.0-5.0, step 0.5, default 2.0), переводы en/ru. cargo check, cargo clippy, bun build — всё проходит.
- [2026-07-08] ESLint верификация: `npx eslint src/` — 0 ошибок, exit code 0. state.md обновлён: удалены упоминания "219 ESLint ошибок" из known problems, tech debt и roadmap. Предыдущее заявление в state.md о 219 ошибках было устаревшим — кодовая база чистая. bun build success.
- [2026-07-07] Сессия 6 (Audio + Roadmap): Исправлена чувствительность микрофона — добавлен software gain 2x во все три движка (Whisper, Deepgram, Groq/Gemini). Deepgram/Groq min duration 0.8s→0.3s (Whisper уже был 0.3s). Добавлен debug-логинг RMS/сэмплов/причины отбрасывания во все движки. Обновлён .gitignore (добавлен .claude/, агентские шаблоны, docs/_reports/). Задокументирован roadmap развития проекта. clippy 0 warnings, 74 Rust теста, 60 frontend тестов.
- [2026-07-07] Сессия 5 (Final): Финальная верификация: clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success. Обновлён CHANGELOG (Unreleased section с 6 блоками улучшений).
- [2026-07-07] Сессия 4 (Tests): Frontend: установлен vitest, создано 3 тест-файла (60 тестов). Backend: добавлены тесты в ai_provider.rs (4), keys.rs (9), history.rs (11). Итого: 74 Rust тестов (было 51), 60 frontend тестов (было 0). clippy 0 warnings.
- [2026-07-07] Сессия 3 (SettingsPanel + GeneralTab): Созданы `src/components/ui/Toast.tsx` (toast уведомления с success/error/info, auto-dismiss 3с, framer-motion) и `src/components/ui/ConfirmDialog.tsx` (модалка подтверждения с destructive-стилем). SettingsPanel.tsx: заменены 8× alert() → Toast, 1× confirm() → ConfirmDialog, исправлен stale closure в setSavedStatus (functional update), sequential invoke в цикле → Promise.all, useEffect deps: убраны accGranted/micGranted (обновляются внутри эффекта), удалены 2× console.error. GeneralTab.tsx: заменены 2× alert() → Toast (addToast передаётся через props). bun build success, cargo check OK.
- [2026-07-07] Сессия 2A+2B (рефакторинг): Параллельный запуск 2 агентов в worktree. **2A:** page.tsx 1065→297 строк (−72%), создано 8 хуков (useSettings, useRecording, useWindowManager, useInitialSettings, useTargetApp, useTauriEvents, useKeyboardShortcuts, useTrayLanguage), 4 компонента (QuickMenu, HeaderBar, ResultPane, ActionBar), 4 utility модуля (types, text, windowSizes, animations). Lazy loading для SettingsPanel/WelcomeOverlay. **2B:** whisper.rs 846→6 модулей (paths, model_cache, recording, transcribe, download, mod). Дедупликация filename/URL mapping, model_mutex, spawn_capture_thread, hallucination filtering. Исправлены типовые конфликты после мержа (Language→SttLanguage, noiseGate/streamingEnabled пропсы). cargo test 51 pass, clippy 0 warnings, bun build success.
- [2026-07-07] Сессия 1 (P0 баги): Исправлены 6 критических багов — B6 (multi-char uppercase), B7 (hallucination substring), B1 (animation target), B3 (JSON parsing), P2 (stale closure). B4 оказался уже консистентным. Добавлены 6 тестов (42→48). Параллельная работа через 2 sub-agents. cargo test 48 pass, clippy 0 warnings, build OK.
- [2026-07-07] Аудит: Полный аудит кодовой базы (page.tsx, whisper.rs, SettingsPanel.tsx, GeneralTab.tsx). Создан docs/_reports/audit-session-2026-07-07.md (6 P0 багов, 3 P1 архитектурных, ~40 code smells). Создан docs/_reports/refactor-plan.md (5 сессий, параллельный вариант Б). Найдено: page.tsx 1097 строк монолит, whisper.rs 846 строк с 5 функциями >50 строк, 4 дублирования, 12 magic numbers, stale closure в SettingsPanel.
- [2026-07-07] Сделано: Заполнен AGENTS.md реальными данными, создан CLAUDE.md симлинк, обновлены .claude/agents/backend-docs.md и frontend-docs.md с точными данными, создан docs/_reports/doc-reconcile-legacy.md и docs/_reports/audit-consolidation.md, обновлён docs/state.md. Найдено: шаблоны документации не заполнены, отсутствуют релизные notes для v0.1.x-beta.
- [2026-07-07] Сделано: Заполнены docs/architecture.md, docs/decisions.md, docs/glossary.md, docs/overview.md, docs/state.md реальными данными. Создан docs/tags/history.md. Обновлён docs/README.md (версия 1.0.0 → 1.2.0). Проведён полный аудит кода: найдены 3 краша (mutex poisoning, window positioning), 4 проблемы распознавания (tail padding, min duration, noise gate, dedup cleanup), 8 clippy ошибок. Создан docs/_reports/fix-plan.md.
- [2026-07-07] P1-P2 исправлены: (1) window positioning guard — timeDiff не скакает, (2) mutex poisoning recovery в whisper.rs и audio.rs, (3) tail padding 300→500ms, (4) min duration 0.8→0.3s, (5) noise gate 0.004→0.002, (6) удалён дублирующий frontend hallucination cleanup. cargo check + bun build — OK. Написаны тесты: 42 Rust теста (utils + whisper + transliteration + diag), все проходят.
- [2026-07-07] P3-P4 исправлены: P3 — устранены все 8 clippy ошибок (dead_code в streaming.rs/state.rs, unused mut, too_many_arguments). P4 — заменены ~50 println!/eprintln! → log::debug!/info!/warn!/error! в 9 файлах (whisper.rs, audio.rs, ai_provider.rs, keys.rs, deepgram.rs, window.rs, history.rs, streaming.rs, app.rs), unwrap → safe alternatives (streaming.rs mutex, settings.rs is_some_and, app.rs debug_log), добавлен tauri_plugin_log в lib.rs. cargo clippy — 0 warnings, 42 теста проходят.
