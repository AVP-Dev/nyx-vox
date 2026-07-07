# Project: NYX Vox

> Этот файл — ИНДЕКС, а не документация. Подробности — по ссылкам в docs/.
> Не дублируй сюда содержимое architecture.md. Этот файл читают
> автоматически: Claude Code, Codex, Jules и другие агенты, совместимые
> со стандартом AGENTS.md. Симлинк CLAUDE.md -> AGENTS.md обеспечивает
> совместимость с Claude Code.

## Что это за проект

NYX Vox — десктопное приложение для голосового ввода текста с AI-обработкой.
Позволяет диктовать текст через микрофон, распознавать речь (локально через Whisper
или облако через Deepgram/Groq), и автоматически форматировать результат через AI
(Gemini, DeepSeek, Qwen). Платформа — macOS. Статус — активная разработка, v1.2.0.

## Стек
- Язык/фреймворк: Rust 2021 (backend) + TypeScript / Next.js 16 / React 19 (frontend)
- UI: Tailwind CSS 4, Framer Motion 12, Lucide React
- State: Zustand 5 (client), TanStack Query 5 (server)
- Десктоп: Tauri 2.10 (IPC между Rust и WebView)
- STT: whisper-rs 0.16 (Metal/CoreML), Deepgram API (WebSocket), Groq API
- AI: Gemini, DeepSeek, Qwen (через reqwest)
- Аудио: cpal 0.15, hound 3.5
- Безопасность: aes-gcm 0.10, sha2 0.10, machineid-rs
- Пакетный менеджер: bun (frontend), cargo (backend)
- БД: нет — настройки через tauri-plugin-store, история в JSON-файлах
- ORM/миграции: нет
- Очереди/воркеры: нет

## Структура репозитория
```
nyx-vox/
├── src/                        # Frontend (Next.js)
│   ├── app/                    # Routes: page.tsx, history/, update/, welcome/
│   ├── components/             # SettingsPanel, ThemeProvider, WaveformVisualizer, WelcomeOverlay
│   │   └── settings/           # Tabs: General, Engines, History, Info, Keys + translations
│   ├── constants/              # appInfo, version
│   ├── store/                  # Zustand store (useStore.ts)
│   ├── hooks/                  # (пустой)
│   └── types/                  # tauri.d.ts
├── src-tauri/                  # Backend (Rust / Tauri)
│   ├── src/
│   │   ├── commands/           # Tauri-команды: audio.rs, settings.rs, app.rs, ai.rs
│   │   ├── lib.rs              # Регистрация команд, инициализация
│   │   ├── state.rs            # Глобальные состояния (Mutex/AtomicBool)
│   │   ├── whisper.rs          # Локальный STT (whisper-rs + CoreML)
│   │   ├── ai_provider.rs      # AI провайдеры (Gemini, DeepSeek, Qwen)
│   │   ├── streaming.rs        # Стриминг AI-ответов
│   │   ├── prompts.rs          # Системные промпты
│   │   ├── deepgram.rs         # Deepgram STT (WebSocket)
│   │   ├── keys.rs             # Шифрование API-ключей (AES-GCM)
│   │   ├── history.rs          # История записей
│   │   ├── transliteration.rs  # Транслитерация
│   │   ├── utils.rs            # Утилиты, regex, ресемплинг
│   │   ├── tray.rs             # Системный трей
│   │   ├── window.rs           # Управление окном
│   │   └── diag.rs             # Диагностика
│   └── Cargo.toml
├── docs/                       # Документация проекта
├── public/                     # Статические ассеты
└── package.json
```

## Жёсткие правила (нарушать нельзя)

### 1. Не мутировать существующие объекты
Всегда создавать новые объекты, никогда не изменять существующие на месте.
Immutable data предотвращает побочные эффекты и упрощает отладку.

### 2. Маленькие файлы и функции
- Функции: <50 строк
- Файлы: <800 строк (максимум)
- Организация по feature/domain, не по типу

### 3. Обработка ошибок на каждом уровне
- Никогда не проглатывать ошибки молча
- Пользовательские сообщения об ошибках в UI
- Детальный контекст в логах на бэкенде
- `?` в Rust, try/catch в TypeScript

### 4. Валидация на границах системы
- Все пользовательские входы валидируются перед обработкой
- Schema-based валидация (Zod на фронте)
- Не доверять внешним данным (API, ввод пользователя)

### 5. macOS only
Проект привязан к macOS через objc2, core-graphics, accessibility-client.
Кроссплатформенность не предусмотрена.

### 6. API-ключи — никогда в коде
Ключи хранятся зашифрованными (AES-256-GCM), привязаны к machine-id.
Управление через `keys.rs`.

## Где искать подробности
| Нужно узнать | Файл |
|---|---|
| Архитектура и потоки данных | docs/architecture.md |
| Текущий статус, что в работе, что сломано | docs/state.md |
| Архитектурные решения (ADR) | docs/decisions.md |
| Термины и доменные понятия | docs/glossary.md |
| Технические характеристики | docs/TECHNICAL.md |
| AI-промпты | docs/AI_PROMPTS.md |
| Changelog | docs/CHANGELOG.md |
| Релизы по тегам | docs/tags/ |

## Как запускать
```bash
# Установка зависимостей
bun install

# Dev-режим (frontend + Tauri backend)
bun run tauri dev

# Production сборка
bun run tauri build

# Только frontend (dev-сервер на порту 3002)
bun run dev

# Только backend проверки
cd src-tauri
cargo check
cargo clippy -- -D warnings
cargo fmt --check
```

## Common Tasks

### Добавить новую Tauri-команду
1. Создать функцию в `src-tauri/src/commands/` с `#[tauri::command]`
2. Зарегистрировать в `src-tauri/src/lib.rs` в `generate_handler![]`
3. Вызвать из фронта через `invoke('command_name', { args })`

### Добавить новый AI-провайдер
1. Создать модуль в `src-tauri/src/` (по аналогии с `deepseek.rs`, `qwen.rs`)
2. Добавить обработку в `ai_provider.rs`
3. Добавить промпт в `prompts.rs`
4. Обновить UI в `components/settings/EnginesTab.tsx`

### Добавить настройку
1. Добавить state в `src-tauri/src/state.rs` (Mutex/AtomicBool)
2. Добавить get/set команды в `src-tauri/src/commands/settings.rs`
3. Зарегистрировать в `lib.rs`
4. Добавить UI-контрол в `components/settings/GeneralTab.tsx`
5. Добавить перевод в `components/settings/translations.ts`

### Обновить промпты
1. Изменить в `src-tauri/src/prompts.rs`
2. Сверить с `docs/AI_PROMPTS.md`
3. Проверить `cargo check`

## Code Style

### Rust
- Edition 2021, min rustc 1.77.2
- `cargo fmt` для форматирования
- `cargo clippy -- -D warnings` для линта
- `#[tauri::command]` для IPC-команд
- `Mutex<T>` или `AtomicBool` для разделяемого состояния
- `serde` для сериализации

### TypeScript
- Strict mode (tsconfig.json)
- ESLint с next/core-web-vitals + next/typescript
- Tailwind CSS 4 для стилей
- PascalCase для компонентов, camelCase для функций/переменных
- `invoke()` для всех вызовов бэкенда

## Testing
Покрытие: 0%. Тесты отсутствуют на обеих сторонах.
Технический долг — требуется добавить:
- Unit-тесты для Rust-утилит (utils.rs, transliteration.rs)
- Unit-тесты для Zustand store
- E2E-тесты для критических путей (запись → транскрипция → вставка)

## Environment Variables
Файл `.env` отсутствует. API-ключи управляются через UI (Settings → Keys)
и хранятся зашифрованными в tauri-plugin-store.

Внешние API (настраиваются пользователем):
- Groq API Key (STT)
- Deepgram API Key (STT)
- Gemini API Key (AI formatting)
- DeepSeek API Key (AI formatting)
- Qwen API Key (AI formatting)

## Deployment
- Целевая платформа: macOS (dmg/app)
- Сборка: `bun run tauri build`
- Дистрибуция: GitHub Releases
- CI/CD: GitHub Actions (`.github/`)
- Подписи: нет (unsigned — требуется `xattr -cr` при установке)

## Ключевые архитектурные решения
1. **Tauri 2 вместо Electron** — нативная производительность, малый размер бандла
2. **Локальный Whisper + облачные STT** — fallback между движками при недоступности
3. **AES-256-GCM для API-ключей** — шифрование привязано к machine-id
4. **Статический экспорт Next.js** — `output: 'export'`, рендер в Tauri WebView
5. **Zustand + TanStack Query** — разделение клиентского и серверного состояния
6. **Единый source of truth для галлюцинаций** — backend cleanup, не frontend
7. **Семафор для AI-запросов** — ограничение параллельных вызовов API

---

## Правила рабочего процесса (постоянные, не удалять)

### Делегирование
При работе, затрагивающей несколько пакетов/стеков одновременно — не
анализируй и не пиши код по всем сразу в одном потоке рассуждений.
Разбивай на подзадачи по пакетам и делегируй саб-агентам (см. `.claude/
agents/`). Если задача целиком в одном пакете — работай напрямую, без
искусственного дробления.

### Обязательные заметки о сессии
Перед завершением ЛЮБОЙ рабочей сессии (не только документирования):
1. Обнови `docs/state.md` (или `[пакет]/docs/state.md`) — что сделано,
   что сломано, что осталось
2. Если принял архитектурное решение — добавь запись в `docs/decisions.md`
3. Если нашёл расхождение между документацией и реальным кодом —
   зафиксируй явно, не исправляй документацию "по-тихому" без пометки

### Тесты — обязательное правило при добавлении функционала
1. Пиши тесты вместе с кодом, не откладывай на "потом"
2. Перед завершением задачи — проверь покрытие затронутого кода
3. Если функционал НЕ покрыт тестами (нет времени/фреймворка/сложно
   тестировать) — явно сообщи об этом в резюме сессии, не молчи
4. Существующий код без тестов, не относящийся к текущей задаче —
   не чини сам, но зафиксируй в `docs/state.md` как технический долг

### Периодическая проверка покрытия
Отдельная задача "проверь покрытие" не пишет код — только сканирует
и отчитывается в `docs/_reports/test-coverage-[дата].md`. Написание
недостающих тестов — отдельный шаг после утверждения списка (см.
`.claude/agents/test-writer.md`).

### Работа с найденной старой/легаси-документацией
Если в проекте уже существует документация, написанная до внедрения
этой системы — НЕ перезаписывай и не удаляй молча. Сверяй с кодом,
расхождения фиксируй явно (таблица "было заявлено / есть на самом
деле"), устаревшее — переноси в `docs/_archive/` с указанием даты,
не удаляй полностью. Конфликты имён файлов между старой документацией
и структурой doc-kit разрешай ЯВНО и с подтверждением через git-историю,
если она доступна — не полагайся на визуальное впечатление "похоже,
это был просто шаблон".

### Правило для агента (общее)
Не выдумывай факты о коде — если не уверен, пиши "требует уточнения от
автора". Перед объединением/перезаписью существующих файлов — покажи
результат человеку для проверки, если файл содержал более нескольких
строк содержательного текста.
