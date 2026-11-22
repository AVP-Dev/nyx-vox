# Текущее состояние проекта

> Обновляется КАЖДОЙ рабочей сессией агента. Это самый важный файл —
> именно он экономит токены на "въезжание" в проект в новой сессии.
> Держи компактно: не история навсегда, а срез "что сейчас".

## Последнее обновление
Дата: 2026-11-22
Кто/что обновило: Antigravity, актуализация публичного сайта, документации по обновлению, навигации и внутриприложенных ссылок v1.6.0.

## Версии (важно)
- Релиз **v1.6.0** официально опубликован на GitHub Releases с бинарниками для macOS (`.dmg`) и Windows (`.exe`, `.msi`). Локальная кодовая база синхронизирована с GitHub.
- **ПОДСИСТЕМА РАСПОЗНАВАНИЯ РЕЧИ И АУДИОПАЙПЛАЙН СТРОГО ЗАФИКСИРОВАНЫ (FROZEN)**

## Что сейчас сделано
- **Публичный сайт (`docs/index.html`):**
  - Добавлен выделенный раздел «Как обновить NYX Vox» (`#updates`) с инструкциями для Homebrew, curl-скрипта, ручной установки DMG (macOS) и установщика Windows (x64).
  - Выравнивание карточек обновления: карточки приведены к сбалансированной симметричной сетке 2x2 (`repeat(2, 1fr)`). Блок с кодом и кнопкой копирования (`.code-box`) вынесен непосредственно под заголовок каждой карточки (по паттерну agterm.com), за счёт чего кнопки копирования и действий выровнены строго на одной горизонтальной линии пиксель-в-пиксель, независимо от длины описания.
  - В навигацию добавлены ссылка на раздел «Обновление» (`#updates`), прямая иконка-ссылка на GitHub-репозиторий и кнопка «Скачать» (`Get App`).
  - В футер добавлены прямые ссылки на репозиторий проекта, историю релизов/Changelog и страницу сообщений об ошибках (Issues).
  - В блок установки/траблшутинга добавлена подсказка для Windows (SmartScreen и права микрофона).
  - Актуализирован интерактивный симулятор диктовки: фразы обновлены под актуальный релиз v1.6.0 и современные движки.
  - Позиционирование витрины и автовставки скорректировано под macOS и Windows.
- **Внутри приложения:**
  - **Окно уведомления о новой версии (`src/app/update/page.tsx`):** добавлена кнопка перехода на сайт выбора версий, раскрывающийся блок с готовыми командами обновления для Homebrew и curl (с копированием в один клик), оптимизирован размер окна (360x460).
  - **Всплывающее окно обновления в настройках (`src/components/SettingsPanel.tsx`):** добавлена кнопка прямого перехода на сайт выбора сборок.
  - **Вкладка «О программе» (`src/components/settings/InfoTab.tsx`):** добавлен блок ресурсов проекта (сайт, репозиторий, баг-трекер, релизы) и ссылки на руководство по обновлению и Changelog.
  - **Константы (`src/constants/appInfo.tsx`):** описание расширено на macOS и Windows; `ENGINE_HELP` дополнен описаниями ElevenLabs, Speechmatics, Azure Speech, NVIDIA Build и GigaChat; вынесены `PROJECT_LINKS`.
  - **Приветственное окно (`src/components/WelcomeOverlay.tsx`):** добавлены ссылки на ресурсы проекта.
  - **Системный трей (`src-tauri/src/tray.rs` и `src-tauri/src/lib.rs`):** добавлены пункты меню «Сайт проекта» (открытие в браузере) и «Проверить обновления...».

## Что сейчас в работе
- **Подписи команд установки:** Homebrew и curl отображаются как текст. В нижнем блоке можно скопировать команду, а адрес `install.sh` используется внутри команды curl.
- **Контент лендинга:** добавлены четыре облачных движка 1.6.0 в карточки и витрину интерфейса. ElevenLabs и Speechmatics отмечены как рекомендуемые. Уточнены различия между локальным и облачным распознаванием и отправка текста при ИИ-форматировании. Лендинг, метаданные и инструкция первого запуска описывают macOS и Windows. Nemotron GGUF доступен как менеджер модели, поэтому в список движков распознавания не включён. Существующие demo GIF сгенерированы из симулятора и не использованы как запись реальной диктовки.
- **Первый экран лендинга:** команда Homebrew и раскрываемая команда curl доступны с копированием перед выбором версии. Нижняя инструкция по установке остаётся доступна по существующим ссылкам.
- **Homebrew:** cask снимает карантин с пакета NYX Vox и запрашивает запуск через postflight, поэтому инструкция установки использует одну команду. Apple Silicon DMG закреплён по SHA-256 для последней публичной версии 1.5.1.
- **Заметки v1.6.0:** команды curl, Homebrew и ручного запуска после снятия карантина приведены напрямую в обеих языковых версиях файла релиза.
- **Лендинг:** выбор опубликованной версии и установщика macOS или Windows работает через GitHub Releases. При недоступности API кнопка ведёт на список релизов GitHub. Кнопки скачивания в README ведут к выбору на сайте.
- **Публикация дистрибуции:** официальный адрес `https://nyx-vox.avpdev.com/` отдаёт лендинг и `/install.sh` по HTTPS с HTTP 200. Скачанный скрипт совпал с файлом репозитория. README, лендинг и заметки к релизу используют этот домен.
- **Следующая поставка:** довести `dev`, проверить, влить в `main` и выпустить публичную `v1.6.0`. Текущий тег `v1.6.0` указывает на тестовый коммит, GitHub API не возвращает по нему публичный релиз. Перед публикацией нужно согласовать перенос существующего тега.
- **Лендинг и установка:** сайт внутри `docs/` репозитория NYX Vox, конфигурация Coolify — Static, Base Directory `/docs`. В лендинг, оба README и заметки к тегу добавлены команды Homebrew и curl. `docs/install.sh` выбирает последний публичный GitHub Release, проверяет SHA-256 DMG для Apple Silicon, снимает карантин с пакета и открывает приложение. [PR Homebrew tap](https://github.com/AVP-Dev/homebrew-apps/pull/1) пока содержит cask для 1.5.1. Для 1.6.0 нужно обновить cask после появления релизного DMG и его SHA-256.
- **Проверки установщика:** в изолированном каталоге проверены выбор DMG среди файлов релиза, установка и повторная установка, снятие карантина с пакета и отказ при неверной SHA-256. GitHub, монтирование DMG и запуск приложения были подменены. Также проверены синтаксис HTML-скрипта, Bash, Ruby и `git diff --check`. Нативный запуск и установка через tap ожидают публичные файлы 1.6.0.
- **Обновления:** в интерфейсе есть проверка GitHub Releases и переход к загрузке. Для автоматической установки нужны интеграция Tauri Updater, отдельный ключ подписи и подписанные артефакты. Предложение для домена записано в ADR.
- **ElevenLabs:** для локальной чистки финального текста требуется явная команда на изменение замороженного компонента.
- **Pair task #9 (DROPPED по согласованию с пользователем):** задача на backend fallback для NVIDIA Build Function UUID снята. Официальная модель Parakeet CTC 1.1B на NVIDIA Build является English-only (русский язык не поддерживается). Хардкод дефолтного UUID в пайплайн молча портил бы русскоязычную диктовку. Поле Function UUID оставлено обязательным в расширенных настройках для пользователей с кастомными моделями NVCF. В интерфейсе и README явно указано ограничение `English only`.
- **Pair task #3 (реализация завершена, agy APPROVED):** бэкенд сохраняет команды загрузки, SHA-256-проверки и удаления Nemotron 3.5 ASR Q8_0 GGUF (~708 МБ). Ветка `dev` зафиксировала реализацию в `cbd4dc7` и установку тестового `.app` версии 1.6.0 в `/Applications/NYX Vox.app` (документальный follow-up — `c9c8e9c`).
- **Pair tasks #4–#6 (реализованы в PR #3):** Task #4 восстанавливает/сворачивает окно кликом по трею, показывает Settings из скрытого или свернутого состояния, возвращает окно из minimized и ограничивает позицию рабочей областью монитора; событие `open-settings` закрывает WelcomeOverlay перед Settings. Task #5 временно убрал ручной NVIDIA function UUID из KeysTab и статичный Nemotron-блок. Task #6 называет локальный движок Whisper и показывает под сеткой только модель выбранного STT-движка: Whisper small/medium/turbo или Nemotron 3.5 ASR Q8_0 GGUF (~708 МБ) для NVIDIA. Проверки Task #6: `bun run test` (58 passed, 10 файлов), `bun run lint`, `bun run tauri build --bundles app`; `.app` установлен, версия `/Applications/NYX Vox.app` подтверждена как 1.6.0. Frozen audio/STT/transcription files не менялись.
- **Pair task #7 (safe slice реализован):** поле NVIDIA Build Function UUID восстановлено в KeysTab с сохранением через `customModels.nvidia_stt`; показан предложенный UUID `1598d209-5e27-4d3c-8079-4751568b1081`. `custom_model_nvidia_stt` гидратируется из Tauri store на старте и попадает в `get_all_settings`.
- **Pair task #8 (закрыт):** `speechmatics::start_session` пропускает информационные `Info`-сообщения и ждёт `RecognitionStarted` в пределах общего 10-секундного deadline; ошибки, неожиданное событие и закрытие соединения завершаются явными ошибками. Добавлен unit test для `Info`/`RecognitionStarted`. Проверки: `cargo test` (155 passed), `bun run test` (59 passed, 10 файлов), `bun run lint`, `cargo fmt -- --check`, `git diff --check`, `bun run tauri build --bundles app` и `bun run install:app` успешны; `/Applications/NYX Vox.app` версии 1.6.0 запущено и проверено через PID 98414.
- **Сверка документации и релизных заметок v1.6.0:**
  - Удалены нелогичные упоминания исследования Xiaomi MiMo из публичных `docs/tags/v1.6.0/release.md` и `docs/CHANGELOG*.md`.
  - Полностью синхронизированы `README.md` и `README.ru.md` с описанием 9 движков STT, новыми инструкциями для API-ключей, пометкой English-only для NVIDIA Build Parakeet и актуальным Roadmap.
  - Ветка `dev` запушена в `origin/dev`. Все временные воркдеревья и кэши (`cargo clean`, `.next`) очищены.
- **Pair task #1 закрыт:** сверены API ElevenLabs, Azure, Speechmatics, NVIDIA Build и Xiaomi MiMo; отчет добавлен в `docs/STT_PROVIDERS_AUDIT.md`. Xiaomi `mimo-v2.5-asr` оставлен только в research, поскольку API не принимает live-аудио чанками. По прямой команде пользователя добавлен capture-only путь без Groq interim worker; ElevenLabs, Azure и Speechmatics подключены к realtime-маршруту, NVIDIA Build — к batch-маршруту с UUID функции NVCF; языковое поле убрано, чтобы совместимые модели автоматически определяли язык. Speechmatics использует `melia-1`, `language=multi`, `language_hints=[ru,en]`. agy подтвердил 149 успешных Rust-тестов и 52 frontend-теста после упрощения; `cargo check`, `cargo fmt --check`, `bun run lint` и `git diff --check` прошли. Live API-запросы без пользовательских ключей не выполнялись.
- **Тестовая версия v1.6.0:** `bun run tauri build --bundles app` завершилась с кодом 0; bundle собран и установлен в `/Applications/NYX Vox.app`, версия подтверждена как 1.6.0. Ветка `dev` обновлена fast-forward до `9d8e836`. Отдельный `.dmg` не создавался.
- **STT-фикс языка (`d20c7a5`) влит в `main`, тег `v1.5.1` перевыпущен.** Убрано форсирование
  `language=ru` в Groq-запросах (финал + 3 interim-пути): `groq→auto`, пропуск `language`
  для `auto/mixed/multi` (авто-детект `whisper-large-v3-turbo`), локальный Whisper
  `mixed|auto→None` с билингва-промптом. Баг «английская речь → русский транскрипт»
  закрыт проверкой пользователя (RU/EN чисто и вперемешку — работает).
  Cargo-верификация бэкенда на macOS/Windows всё ещё ожидается (тулчейна в среде агента нет).
- Подготовка релиза v1.5.1:
  - Применены и проверены правки фронтенда (FE-1 ... FE-8)
  - Применены и проверены 4 патча бэкенда (BE-1 ... BE-11, BE-2 отозвана)
  - Обновлены версии во всех манифестах (`package.json`, `version.ts`, `Cargo.toml`, `tauri.conf.json`, `Cargo.lock`)
  - Подготовлена документация релиза (`docs/tags/v1.5.1/release.md`, `README.md`, `history.md`, `CHANGELOG.md`, `CHANGELOG.ru.md`, `decisions.md`)
  - Запуск CI в GitHub Actions для сборки релизного бандла macOS (`.dmg`) и Windows (`.exe`, `.msi`) для проверки на целевых устройствах.

## Что стабильно работает (не трогать без причины)
- STT pipeline (Whisper, Deepgram, Groq, Gemini, GigaChat, ElevenLabs, Azure Speech, Speechmatics, NVIDIA Build)
- AI formatting (Gemini, DeepSeek, Qwen, Groq, GigaChat) с кастомными моделями
- Интеллектуальный VAD авто-стоп по тишине (3-15 сек)
- Автопаста (macOS: CGEvent + Accessibility; Windows: Enigo Ctrl+V)
- Шифрование API-ключей (AES-256-GCM)
- Noise Gate
- Audio Gain (configurable, 1.0-5.0, default 2.0)
- Автопауза медиа
- История записей
- Системный трей (macOS template, Windows colored)
- Playwright E2E (3 smoke-теста)

## Известные проблемы / баги
- `libc::_exit(0)` при выходе сохранён для macOS (необходим для избежания ggml crash), на Windows используется стандартный graceful exit.

## Технический долг (осознанный)
- Linux support — отложена на следующий этап из-за ограничений протокола Wayland (перехват/эмуляция ввода и позиционирование окон).
- **Ветка `#[cfg(target_os = "windows")]` в `post_paste_chord` не проверена компиляцией.**
  Логика отмены (BE-8) проверена функционально на macOS-ветке, но windows-вариант не
  удалось достоверно скомпилировать в изоляции: приватность поля tauri's `State` в стаб-харнессе
  не воспроизводится точно, а подгонка стаба дала бы ложную уверенность. Требуется сборка на Windows.
- **Полный `cargo check` / `cargo test` на крейте `app` не выполнялся.** В среде агента
  отсутствуют `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`, `glib-2.0`, `gtk+-3.0`,
  `cmake`, `cbindgen`, каталог `dist/`; sudo требует интерактивной аутентификации. Проверено
  косвенно: `rustfmt --check` по всему `src-tauri` (чисто), 26 новых тестов чистой логики под
  реальным rustc (26/26), `clippy -D warnings` на ней (чисто), краш-крейты на `Send` и на
  macOS-аккорде вставки (компилируются, 3/3 теста проходят). Импорты, типы и `borrowck`
  остальных изменённых мест не проверены — обязательный прогон на macOS и Windows.
- **BE-2 отозвана автором** (см. `.pair/notes/finding-BE-2.md`): безусловный `sleep(650 мс)`
  в конце тела `while` покрывает все ветви, спин-лупы в interim-воркерах нет.

## Что сделано
- **STT auto-detect (2026-10-08, `d20c7a5`):**
  - Баг: чистая английская речь транскрибировалась по-русски (форсированный `language=ru`
    заставлял Whisper декодировать en-аудио русским словарём; Single-Pass цементировал
    испорченный interim как финал).
  - Фикс (5 файлов, VAD/guards/commit/форматтер не тронуты): `groq→auto` в `audio.rs`,
    пропуск `language` для `auto/mixed/multi` в финале Groq, убран хардкод `ru` в 3 interim-путях,
    локальный Whisper `mixed|auto→None` + билингва-промпт для `auto`.
  - Проверено пользователем: RU/EN чисто и вперемешку — работает. Фронт: bun test 51/51, lint, build зелёные.
  - Исправлены расхождения `docs/TRANSCRIPTION_PIPELINE.md` с кодом: Tail Guard 250→350 мс, no_speech 0.6→0.68.
- **Сессия 18 (Кроссплатформенная поддержка Windows):**
  - Поддержка Windows интегрирована без регрессий в macOS-версии.
  - `Cargo.toml`: разнесены зависимости для macOS (`core-graphics`, `objc2-*`, `core-foundation`, `whisper-rs` Metal/CoreML) и Windows (`windows-sys`, чистый CPU `whisper-rs`).
  - Реализован `get_frontmost_app_info` для Windows через `GetForegroundWindow` / `QueryFullProcessImageNameW`.
  - Реализован `system_media_control` через `VK_MEDIA_PLAY_PAUSE`.
  - Реализовано открытие настроек микрофона Windows (`ms-settings:privacy-microphone`).
  - Фронтенд: адаптация `GeneralTab.tsx`, `WelcomeOverlay.tsx`, `welcome/page.tsx` с динамическим получением платформы через команду `get_platform`.
  - CI: настроен `.github/workflows/build-dev.yml` для автоматической сборки `.exe`/`.msi` инсталлеров на Windows runners.
  - Устранена 3–5 секундная задержка («Обработка...») после завершения речи в режиме локального Whisper.
  - В `commands/audio.rs` (`stop_recording`) проверка `has_streamed_preview` вынесена на первое место перед батч-обработкой Whisper.
  - Если стриминговый воркер уже расшифровал текст на лету, он возвращается мгновенно (0 мс задержки) без повторного запуска инференса 830-МБ модели Whisper Turbo на GPU Metal.
  - Сохранен гарантированный fallback на `whisper::stop_recording` при отсутствии или неполноте стримингового превью.
  - 117 Rust unit tests pass, clippy 0 warnings, fmt check OK.
- **Сессия 16 (Архитектурный апгрейд Real-Time транскрибации по стандарту Google Live Transcribe):**
  - Внедрен `PreSpeechRingBuffer` (300 мс) в `recording.rs` и `ai_provider.rs`.
  - Улучшен `VadTracker` (hard cutoff 15с) и `trim_silence` (300мс pre / 200мс post).
  - Внедрена защита от очередей `is_inflight` (backpressure) и ускорение опроса до 350мс.
  - Обновлены системные промпты форматирования (`REFINEMENT_SYSTEM_PROMPT`): сохранение смысловых междометий («М-м!», «Ого!») при фильтрации заминок («эээ», «нуу»).
  - Внедрен UI-сплит `splitCommittedAndDraft` в `HeaderBar.tsx` и `text.ts`.
  - 98 Rust unit tests pass, 65 Vitest frontend tests pass, clippy 0 warnings, eslint 0 errors.
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

- [2026-09-09] **Фикс CI/CD сборки macOS DMG (релиз v1.5.0)**:
  - Выявлена причина падения `bundle_dmg.sh` на headless macOS runners: `tauri-action` по умолчанию передавал `TAURI_BUNDLER_DMG_IGNORE_CI: true`, что отключало флаг `--skip-jenkins` и приводило к сбою неинтерактивного AppleScript при попытке обращения к Finder.
  - В `.github/workflows/release.yml` и `build-dev.yml` явно задана переменная окружения `TAURI_BUNDLER_DMG_IGNORE_CI: false` (активирует пропуск Finder AppleScript в CI) и добавлено отключение индексации Spotlight (`sudo mdutil -a -i off`) для предотвращения блокировки диска при размонтировании.
  - Изменения запушены в `dev`, смержены в `main`, пересоздан тег `v1.5.0`.
- [2026-09-08] **Сессия релиза v1.5.0 (Windows Native Support & Groq LPU™)**:
  - Проверена кроссплатформенная поддержка Windows и macOS, верифицированы все зависимости и CI/CD пайплайны.
  - Пройдено 117 Rust unit-тестов, clippy (0 warnings), fmt check, ESLint, 68 vitest тестов, Next.js build.
  - Документация (README, README.ru, CHANGELOG, CHANGELOG.ru, docs/state.md, docs/README.md, tags/v1.5.0/release.md) синхронизирована и обновлена.
  - Подготовка слияния `dev` в `main` и выпуск тега `v1.5.0`.
- [2026-09-05] **Сессия очистки устаревшей мета-документации**:
  - Удалены неиспользуемые сторонние файлы-шаблоны `doc-kit v2`: `METHODOLOGY.md`, `NEW-PROJECT-INIT.md`, `PROMPT-TEMPLATE-dev-session.md`, `QUICKSTART.md`, `README-SETUP.md`, `SESSION-START.md`, `SESSION-END.md`, `document-monorepo.sh`.
  - Удалена архивная папка разовых отчётов `docs/_reports/` (устаревшие аудиты двухмесячной давности).
  - Очищены правила игнорирования удалённых шаблонов в `.gitignore`.
- [2026-09-04] **Сессия модернизации README, Лендинга и визуализации пайплайна (v1.4.0)**:
  - **Интерактивные GIF-демонстрации в README**: Сгенерированы легковесные и плавные Retina GIF-демонстрации виджета (`docs/demo.gif` и `docs/demo.ru.gif`), полностью повторяющие поведение интерактивного симулятора с лендинга (запись, анимация волны, живой стриминг, дословное форматирование, автовставка). Статичные таблицы со скриншотами заменены на живые анимации в `README.md` и `README.ru.md`.
  - **Подпись автора**: Везде удалено «Alexios Odos», подпись приведена к каноническому виду из `avpdev.com`: `Aliaksei Patskevich (AVPDev)` / `Алексей Пацкевич (AVPDev)`, ссылка на сайт нормализована до `https://avpdev.com/`, роль `AI Solutions Architect`.
  - **Лендинг (`docs/index.html`)**: Полностью модернизирован. Внедрен интерактивный симулятор виджета прямо в первый экран (Hero) с анимацией микрофона, 9-полосного эквалайзера, живого interim-набора текста, дословного форматирования и автовставки в VS Code/Telegram/Slack. Добавлена визуализация пайплайна «Как это работает» (4 шага: Захват & VAD → STT → 100% Verbatim AI → Auto-Paste), матрица сравнения движков (Groq, Whisper Local, GigaChat, Gemini, Deepgram), интерактивная витрина интерфейса, активирован блок Troubleshooting (`xattr -cr`) с копированием в 1 клик, полная поддержка переключения языков EN/RU с адаптацией симулятора.
  - **README (`README.md` и `README.ru.md`)**: Синхронизированы и обновлены в дуальной модели (EN по умолчанию + RU полный перевод). Добавлены современные бейджи, Mermaid-диаграмма архитектурного пайплайна, схема отказоустойчивости (Multi-Tier Fallback), таблица сравнения движков, витрина скриншотов с плейсхолдерами, сводка горячих клавиш и инструкция по решению проблем.
  - **Скриншоты (`docs/screenshots/README.md`)**: Создана подробная спецификация и руководство по созданию 8 ключевых скриншотов приложения в высоком разрешении.
  - Аудиопайплайн и параметры транскрипции не затрагивались (Frozen Pipeline Rule строго соблюдено).
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
