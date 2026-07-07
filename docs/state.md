# Текущее состояние проекта

> Обновляется КАЖДОЙ рабочей сессией агента. Это самый важный файл —
> именно он экономит токены на "въезжание" в проект в новой сессии.
> Держи компактно: не история навсегда, а срез "что сейчас".

## Последнее обновление
Дата: 2026-07-07
Кто/что обновило: Claude Code (session 5, final verification + docs)

## Что сейчас в работе
- Сессия 5 ЗАВЕРШЕНА — финальная верификация + обновление CHANGELOG
- Все сессии плана завершены (1-5)
- Незакоммиченные изменения: множество файлов (frontend + backend)

## Что стабильно работает (не трогать без причины)
- STT pipeline (Whisper, Deepgram, Groq)
- AI formatting (Gemini, DeepSeek, Qwen)
- Автопаста через enigo
- Шифрование API-ключей (AES-256-GCM)
- Noise Gate
- Автопауза медиа
- История записей
- Системный трей

## Известные проблемы / баги
- Lint: 219 ошибок ESLint (pre-existing, в старых файлах — не от рефакторинга)
- ~40 code smells задокументированы в `docs/_reports/audit-session-2026-07-07.md`
- P2 проблемы SettingsPanel + GeneralTab — ИСПРАВЛЕНЫ (Сессия 3)

## Технический долг (осознанный)
- macOS only — архитектурное решение, не баг
- 219 ESLint ошибок — pre-existing, не от рефакторинга

## Что сделано
- **Сессия 5 (Final):** Финальная верификация: clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success. Обновлён CHANGELOG (Unreleased section с 6 блоками улучшений).
- **Сессия 4 (Tests):** Frontend: установлен vitest, создано 3 тест-файла (60 тестов). Backend: добавлены тесты в ai_provider.rs (4), keys.rs (9), history.rs (11). Итого: 74 Rust тестов (было 51), 60 frontend тестов (было 0). clippy 0 warnings.
- **Сессия 3 (SettingsPanel + GeneralTab):** Исправлены P2 проблемы. Созданы Toast и ConfirmDialog компоненты. Заменены 10× alert()/confirm() на UI-компоненты. Исправлен stale closure в setSavedStatus. Sequential invokes → Promise.all. useEffect deps без лишних ре-рендеров. Удалены debug console.error.
- **Сессия 2A (Frontend):** page.tsx 1065→297 строк (−72%). Создано: 8 хуков, 4 компонента, 4 utility модуля. Lazy loading для SettingsPanel/WelcomeOverlay.
- **Сессия 2B (Backend):** whisper.rs 846→6 модулей (whisper/). Каждый <250 строк. Дедупликация 4 паттернов. 51 тест проходит.
- P1-P4: краши, распознавание, clippy, unwrap/println — всё исправлено
- P0 (Сессия 1): 6 критических багов исправлено
- clippy 0 warnings, cargo test 74 pass, bun test 60 pass, bun build success

## Следующие шаги (план)
1. ~~**Сессия 2A:** Frontend рефакторинг — page.tsx ✅~~
2. ~~**Сессия 2B:** Backend рефакторинг — whisper.rs ✅~~
3. ~~**Сессия 3:** Исправить SettingsPanel.tsx + GeneralTab.tsx (P2 проблемы) ✅~~
4. ~~**Сессия 4:** Написать тесты (frontend + backend) ✅~~
5. ~~**Сессия 5:** Локальное тестирование + обновление документации ✅~~

## Журнал сессий (кратко, последние 5-10 записей, старое можно удалять)
- [2026-07-07] Сессия 3 (SettingsPanel + GeneralTab): Созданы `src/components/ui/Toast.tsx` (toast уведомления с success/error/info, auto-dismiss 3с, framer-motion) и `src/components/ui/ConfirmDialog.tsx` (модалка подтверждения с destructive-стилем). SettingsPanel.tsx: заменены 8× alert() → Toast, 1× confirm() → ConfirmDialog, исправлен stale closure в setSavedStatus (functional update), sequential invoke в цикле → Promise.all, useEffect deps: убраны accGranted/micGranted (обновляются внутри эффекта), удалены 2× console.error. GeneralTab.tsx: заменены 2× alert() → Toast (addToast передаётся через props). bun build success, cargo check OK.
- [2026-07-07] Сессия 2A+2B (рефакторинг): Параллельный запуск 2 агентов в worktree. **2A:** page.tsx 1065→297 строк (−72%), создано 8 хуков (useSettings, useRecording, useWindowManager, useInitialSettings, useTargetApp, useTauriEvents, useKeyboardShortcuts, useTrayLanguage), 4 компонента (QuickMenu, HeaderBar, ResultPane, ActionBar), 4 utility модуля (types, text, windowSizes, animations). Lazy loading для SettingsPanel/WelcomeOverlay. **2B:** whisper.rs 846→6 модулей (paths, model_cache, recording, transcribe, download, mod). Дедупликация filename/URL mapping, model_mutex, spawn_capture_thread, hallucination filtering. Исправлены типовые конфликты после мержа (Language→SttLanguage, noiseGate/streamingEnabled пропсы). cargo test 51 pass, clippy 0 warnings, bun build success.
- [2026-07-07] Сессия 1 (P0 баги): Исправлены 6 критических багов — B6 (multi-char uppercase), B7 (hallucination substring), B1 (animation target), B3 (JSON parsing), P2 (stale closure). B4 оказался уже консистентным. Добавлены 6 тестов (42→48). Параллельная работа через 2 sub-agents. cargo test 48 pass, clippy 0 warnings, build OK.
- [2026-07-07] Аудит: Полный аудит кодовой базы (page.tsx, whisper.rs, SettingsPanel.tsx, GeneralTab.tsx). Создан docs/_reports/audit-session-2026-07-07.md (6 P0 багов, 3 P1 архитектурных, ~40 code smells). Создан docs/_reports/refactor-plan.md (5 сессий, параллельный вариант Б). Найдено: page.tsx 1097 строк монолит, whisper.rs 846 строк с 5 функциями >50 строк, 4 дублирования, 12 magic numbers, stale closure в SettingsPanel.
- [2026-07-07] Сделано: Заполнен AGENTS.md реальными данными, создан CLAUDE.md симлинк, обновлены .claude/agents/backend-docs.md и frontend-docs.md с точными данными, создан docs/_reports/doc-reconcile-legacy.md и docs/_reports/audit-consolidation.md, обновлён docs/state.md. Найдено: шаблоны документации не заполнены, отсутствуют релизные notes для v0.1.x-beta.
- [2026-07-07] Сделано: Заполнены docs/architecture.md, docs/decisions.md, docs/glossary.md, docs/overview.md, docs/state.md реальными данными. Создан docs/tags/history.md. Обновлён docs/README.md (версия 1.0.0 → 1.2.0). Проведён полный аудит кода: найдены 3 краша (mutex poisoning, window positioning), 4 проблемы распознавания (tail padding, min duration, noise gate, dedup cleanup), 8 clippy ошибок. Создан docs/_reports/fix-plan.md.
- [2026-07-07] P1-P2 исправлены: (1) window positioning guard — timeDiff не скакает, (2) mutex poisoning recovery в whisper.rs и audio.rs, (3) tail padding 300→500ms, (4) min duration 0.8→0.3s, (5) noise gate 0.004→0.002, (6) удалён дублирующий frontend hallucination cleanup. cargo check + bun build — OK. Написаны тесты: 42 Rust теста (utils + whisper + transliteration + diag), все проходят.
- [2026-07-07] P3-P4 исправлены: P3 — устранены все 8 clippy ошибок (dead_code в streaming.rs/state.rs, unused mut, too_many_arguments). P4 — заменены ~50 println!/eprintln! → log::debug!/info!/warn!/error! в 9 файлах (whisper.rs, audio.rs, ai_provider.rs, keys.rs, deepgram.rs, window.rs, history.rs, streaming.rs, app.rs), unwrap → safe alternatives (streaming.rs mutex, settings.rs is_some_and, app.rs debug_log), добавлен tauri_plugin_log в lib.rs. cargo clippy — 0 warnings, 42 теста проходят.
