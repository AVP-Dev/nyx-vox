# Текущее состояние проекта

> Обновляется КАЖДОЙ рабочей сессией агента. Это самый важный файл —
> именно он экономит токены на "въезжание" в проект в новой сессии.
> Держи компактно: не история навсегда, а срез "что сейчас".

## Последнее обновление
Дата: 2026-09-01
Кто/что обновило: Агент (Single-Pass Real-Time архитектура, 0 лишних запросов)

## Версии (важно)
- Последний ПУБЛИЧНЫЙ релиз на GitHub — **v1.3.0** (Live Streaming, Verbatim AI & Custom Models)
- Предыдущие версии: v1.2.0, v1.1.0, v1.0.0
- Ветка `main` содержит актуальную сборку v1.3.0

## Что сейчас в работе
- Реализованы и протестированы ключевые фичи:
  1. **Single-Pass Real-Time архитектура (0 лишних STT запросов)**:
     - При остановке записи (кнопкой или VAD) берётся готовый распознанный живой текст с экрана.
     - Полностью исключена повторная отправка всего аудиофайла в STT — экономия токенов, трафика и мгновенная вставка (0 мс задержки).
     - Повторный batch STT вызывается только если стриминг не использовался (например, офлайн Whisper).
  2. **Адаптивный VAD (Silence Auto-Stop)**:
     - Алгоритм Minimum Statistics + гистерезис: надёжно сбрасывает таймер тишины во время речи и чётко останавливает запись при паузе.
  3. **Накопительный буфер в WebSocket стриминге (Deepgram)**:
     - В `try_websocket_stream` добавлена аккумуляция подтверждённых предложений (`accumulated`) с дописыванием промежуточных слов (`live`).
     - Исключена перезапись и обрезание фраз при паузах или перечислении/счёте («раз, два, три...»).
  4. **Сверхбыстрый мульти-провайдерный Live-стриминг (Groq, Gemini, Whisper)**:
     - Начальная задержка 350 мс, шаг обновления 400 мс.
  5. **Индикация копирования и оптимизация истории**: мемоизация `HistoryCard`, мгновенный поиск, Escape-навигация.
- Все проверки пройдены: `cargo check`, `cargo clippy -- -D warnings` (0 warnings), `cargo fmt --check`, `cargo test` (94 pass), `bun run lint` (0 errors), `bun run test` (62 pass), `bun tauri build` (успешная сборка dmg и app).

## Что стабильно работает (не трогать без причины)
- STT pipeline (Whisper, Deepgram, Groq, Gemini, GigaChat) с кастомными моделями
- AI formatting (Gemini, DeepSeek, Qwen, Groq, GigaChat) с кастомными моделями
- Интеллектуальный VAD авто-стоп по тишине (3-15 сек)
- Автопаста через CGEvent (с проверкой Accessibility и возвратом статуса)
- Шифрование API-ключей (AES-256-GCM)
- Noise Gate
- Audio Gain (configurable, 1.0-5.0, default 2.0)
- Автопауза медиа
- История записей
- Системный трей
- Playwright E2E (3 smoke-теста)

## Известные проблемы / баги
- `libc::_exit(0)` при выходе сохранён (необходим для избежания ggml crash), но перед ним добавлен flush данных

## Технический долг (осознанный)
- macOS only — архитектурное решение, не баг

## Что сделано
- **Сессия 15 (Оптимизация Real-Time стриминга, Single-Pass STT, исправление VAD и накопительный буфер):**
  - **Single-Pass Real-Time STT**:
    - Устранена двойная транскрипция: при остановке берётся живой распознанный текст без повторного batch-запроса (0 лишних токенов и запросов).
  - **Исправление VAD**:
    - Устранена ошибка ложного срабатывания во время речи. Порог чувствительности к голосу зафиксирован на `(noise_floor * 1.8).max(0.0020)`, а таймер тишины сбрасывается каждым словом/слогом.
    - Автостоп происходит строго после непрерывной тишины в течение заданного в настройках таймаута (3–15 сек).
  - **Deepgram Native WebSocket Streaming с аккумуляцией**:
    - Внедрена модель накопления предложений `accumulated` + `interim` в ридере сокета.
    - Текст фраз, счёта и пауз непрерывно накапливается без затирания.
  - **Тесты и сборка**: 94 Rust unit tests pass, 62 Vitest frontend tests pass, clippy 0 warnings, eslint 0 warnings, `bun tauri build` OK.
  - **Визуальная индикация копирования**:
    - При клике на копирование в карточке списка иконка плавно переключается на зеленую галочку (`Check`) с изумрудной подсветкой.
    - В слайд-панели деталей кнопки «Копировать» и «Raw» показывают статус («Скопировано!», «Исходник скопирован!» / «Copied!», «Copied Raw!») с таймером сброса 1.5 сек.
    - Добавлены ключи локализации `copied` и `copiedRaw` в `translations.ts` (RU / EN).
  - **Оптимизация производительности и устранение подвисаний**:
    - Убран ресурсоемкий Framer Motion `layout` и `AnimatePresence` со всех элементов списка (причина фризов и лагов при кликах на карточки при большом количестве записей).
    - Карточка истории вынесена в мемоизированный компонент `HistoryCard` (`React.memo`) с нативными аппаратными CSS-анимациями.
    - Поиск оптимизирован через `useDeferredValue` (плавный ввод текста без задержек UI).
    - Закрытие окна переведено на `getCurrentWindow().hide()`, что делает повторное открытие окна мгновенным (<5мс) без пересоздания WebView.
    - Добавлена обработка клавиши `Escape` (закрытие боковой панели или скрытие окна).
- **Сессия 13 (Custom AI Models, VAD Silence Auto-Stop & Live Phrases):**
  - **Кастомизация моделей**: бэкенд (`CustomModels` в `state.rs`, команды `set_custom_model`/`get_custom_models`, интеграция в `ai_provider.rs`, `deepseek.rs`, `qwen.rs`, `gigachat.rs`); фронтенд (`KeysTab.tsx` со списком пресетов, инпутом кастомных названий и кнопкой сброса).
  - **VAD автостоп**: бэкенд (`VadAutoStop`, `VadSilenceTimeout` в `state.rs`, отслеживание тишины после начала речи в `ai_provider.rs` и `whisper/recording.rs`, событие `vad-auto-stop`); фронтенд (`GeneralTab.tsx` с карточкой VAD и слайдером 3–15 сек, `useTauriEvents.ts` авто-стоп).
  - **Live стриминг фраз**: поддержка `interim-transcription` событий в `useTauriEvents.ts` для живого превью текста во время записи.
  - **Тесты и качество**: 90 Rust unit tests pass, 62 Vitest frontend tests pass, clippy 0 warnings, eslint clean.
- **Сессия 12 (100% Verbatim Prompts & Audit):** Внесены точные калибровки в `REFINEMENT_SYSTEM_PROMPT`, `FORMAT_STYLE_LIGHT`, `FORMAT_STYLE_DEEP` и `REFINEMENT_USER_INSTRUCTION_GENERIC`. Исключен пересказ/рерайтинг и подмена разговорных слов книжными синонимами моделью GigaChat-2 и другими LLM. Документация синхронизирована (`docs/AI_PROMPTS.md`). 89 Rust тестов и 62 Vitest теста проходят.
- **Сессия 11 (Formatting anti-hallucination):** Ужесточены промпты форматирования (REFINEMENT_SYSTEM_PROMPT, FORMAT_STYLE_LIGHT/DEEP): форматтер теперь ТОЛЬКО расставляет пунктуацию/заглавные буквы, исправляет грамматику (окончания, согласование, предлоги — минимально) и удаляет слова-паразиты; явно запрещено переписывать слова, отвечать на вопросы из диктовки, давать советы/рекомендации и создавать списки. Убрано разрешение «исправлять грамматику», провоцировавшее додумывание — возвращено позже с уточнением «менять только то, что нужно для правильности, без замены слов на синонимы». Добавлены 5 юнит-тестов в prompts.rs (89 cargo test pass). Обновлён docs/AI_PROMPTS.md (разделы 2.1-2.2).
- **Сессия 10 (финальные фиксы UI):** (1) Enter paste — корень был в stale closure: `useKeyboardShortcuts` регистрировал обработчик один раз и держал первую версию `handlePaste` с пустым `transcriptText`, а `handlePaste` при пустом тексте молча выходил → Enter «не работал». Исправлено: свежий `handlePaste` через ref, слушатель в capture-фазе, свой Enter-обработчик на textarea. (2) Компактный режим — окно 48×48, но внутри рендерился полный HeaderBar (обрезался). Теперь при компактном idle рендерится круглый бабл с кнопкой-микрофоном; анимации синхронизированы (`buildContainerVariants(compactIdle)`), `WINDOW_SIZES.compactIdle`. Проверки: bun test 62 pass, eslint 0, bun build success.
- **Сессия 10 (документация):** Актуализированы AGENTS.md (англ.), .claude/agents/*, SESSION-*, релизные заметки v1.2.0 (убраны Mixed/Enter-неточности, добавлены GigaChat/Whisper/стабильность, помечен статус «не опубликован»), CHANGELOG/tags/README/architecture/overview синхронизированы.
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

> Публичный roadmap (README) синхронизирован с этим списком. Без версий и сроков.

### 🔴 Приоритет 1 — Баги
1. ~~**Enter paste bug**~~ — **ВЫПОЛНЕНО (Сессия 10)**: race condition в `paste_text` исправлен ранее (Сессия 7, oneshot::channel + re-show окна); регрессия Enter в editing (Cmd+Enter вместо Enter) исправлена в useKeyboardShortcuts.

### 🟢 Фичи (ближайшие)
2. ~~**Whisper State кэширование**~~ — **ВЫПОЛНЕНО**: `WhisperState` кэшируется в `WhisperModel` (model_cache.rs), инференс не платит за reinit Metal/Core ML
3. **Настраиваемые горячие клавиши** — переназначение хоткеев (сейчас Option+Space захардкожен)
4. **Экспорт истории** — TXT / MD / JSON
5. **Выбор микрофона** — выбор устройства ввода в настройках (сейчас только системный default)
6. **Автообновление** — проверка обновлений уже есть; дальше автоматическая загрузка и установка

### 🟢 Фичи (среднесрочные)
7. **Транскрипция аудиофайлов** — drag-and-drop файла в приложение (или диалог выбора) → автоматическая транскрипция и вывод текста
8. **Запись системного аудио (звонки/созвоны)** — запись внутреннего аудио и ролевая транскрипция (speaker diarization: отдельно «Вы» и «Собеседник»)
9. **Пользовательский словарь** — свои термины, имена, техническая лексика
10. **Детекция активности речи (VAD)** — автопауза записи при тишине

### 🔵 Архитектура / платформы
11. **Кроссплатформенность (Linux)** — Tauri кроссплатформенный, но бэкенд привязан к macOS (objc2, core-graphics, accessibility-client) — нужен рефакторинг под абстракцию платформы
12. **Error boundary** (frontend) — fallback UI при React crash (технический долг)
13. **Structured logging** (frontend) — tauri-plugin-log (технический долг)
14. **CI/CD pipeline** — GitHub Actions: clippy + test + build при PR (технический долг)

## Журнал сессий (кратко, последние 5-10 записей, старое можно удалять)
- [2026-08-05] **Сессия 10b (финальные фиксы UI)**: Повторная проверка выявила: (1) Enter по-прежнему не вставлял текст — корень в stale closure `useKeyboardShortcuts` (обработчик держал первую версию `handlePaste` с пустым `transcriptText`, который молча выходил). Исправлено: актуальный `handlePaste` через ref, capture-фаза, свой Enter-обработчик на textarea в editing. (2) Компактный режим обрезал полный HeaderBar вместо кружка — теперь при compact idle рендерится круглый бабл с микрофоном (клик = старт записи), анимации `buildContainerVariants(compactIdle)` и пресет `WINDOW_SIZES.compactIdle`. Коммиты `4112181`, `1a336a4` (dev). Проверки: bun test 62 pass, eslint 0, bun build success.
- [2026-08-05] **Сессия 10 (Багфиксы + подготовка релиза v1.2.0)**: Исправлены 2 регрессии. **Enter paste:** в `useKeyboardShortcuts` простой Enter теперь paste-ит в фазах result И editing (раньше в editing только Cmd/Ctrl+Enter). **Компактный режим:** `compactResultWindow` снова работает — добавлен в `resolveWindowSize()` (idle → 48×48), проброшен через `useWindowManager` (интерфейс + deps) и `page.tsx`, покрыт тестами (windowSizes.test.ts: +2 теста). **Документация:** AGENTS.md (CLAUDE.md симлинк), .claude/agents/*, SESSION-START/END, PROMPT-TEMPLATE — переведены на английский и актуализированы (whisper.rs→whisper/, gigachat.rs, тесты 80/60/3, hooks/, lib/). Установлен факт: последний публичный релиз — v1.1.0, v1.2.0 не публиковался → следующий релиз называется v1.2.0. Проверки: bun test 62 pass, eslint 0.
- [2026-08-05] **Сессия 9 (Удаление выбора языка)**: Убран выбор языка распознавания из UI — движки сами определяют язык (Whisper: `auto` → `set_language(None)`, Deepgram: `multi`, Groq: `ru`, Gemini: `mixed`). Удалены `DeepgramLanguage`/`WhisperLanguage`/`GroqLanguage`/`GeminiLanguage` (state.rs), 8 команд set/get_*_language (settings.rs), manage/load в lib.rs, языковые пропсы в useSettings/useInitialSettings/SettingsPanel/EnginesTab/HeaderBar/page.tsx, `useTrayLanguage`, `Language`/`SttLanguage` типы, языковой селектор и индикатор языка. Захардкожено в audio.rs (start/stop). Проверки: clippy 0 warnings, cargo test 80 pass, tsc clean, eslint 0, bun build success. Vitest: 49 pass / 2 fail (pre-existing, `vi.stubGlobal` не работает — не связано).
- [2026-08-05] **Сессия 8 (Whisper ускорение)**: Найдена и исправлена причина медленной транскрипции (~30-60s на фразу). Регрессия после рефакторинга 17f46cd: `WhisperState` перестал кэшироваться (в `b292ed1` был, при разбиении whisper.rs → whisper/ потерялся) — `create_state()` вызывался на каждый инференс, а в whisper.cpp это reinit бэкендов + загрузка Core ML encoder (~секунды). Исправлено: (1) `WhisperState` возвращён в `WhisperModel` и переиспользуется (whisper.cpp очищает `result_all` в начале `whisper_full_with_state`, состояние безопасно переиспользовать); (2) pre-warm теперь на закэшированном state, а не на выбрасываемом временном; (3) включён `flash_attn` в контексте (ускорение attention на ggml-metal). clippy 0 warnings, cargo test 80 pass. Обновлён docs/state.md (убрана проблема 60s).
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
