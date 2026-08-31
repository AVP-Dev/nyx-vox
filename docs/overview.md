# Карта репозитория

> Заполняется в "Проходе 1" — без глубокого чтения кода внутри пакетов,
> только структура верхнего уровня и связи между частями.

## Пакеты / приложения

| Путь | Назначение | Стек | Статус |
|---|---|---|---|
| `/` (root) | Tauri-приложение NYX Vox | Next.js 16 + Rust (Tauri 2) | активный, v1.3.0 |

Монорепо: нет. Один пакет.

## Как пакеты связаны
- Frontend (Next.js) вызывает Backend (Rust) через Tauri IPC (`invoke()`)
- Backend обрабатывает аудио, STT, AI и возвращает результат в frontend
- Настройки хранятся на бэкенде (tauri-plugin-store), фронтенд читает/пишет через команды

## Общая инфраструктура
- БД: нет (настройки через tauri-plugin-store, история в JSON-файлах)
- Деплой: GitHub Releases (.dmg для macOS)
- CI/CD: GitHub Actions (`.github/`)
- Пакетный менеджер: bun (frontend), cargo (backend)

## Структура репозитория
```
nyx-vox/
├── src/                        # Frontend (Next.js 16, React 19, TypeScript)
│   ├── app/                    # Routes: page.tsx, history/, update/, welcome/
│   ├── components/             # UI: SettingsPanel, ThemeProvider, WaveformVisualizer
│   ├── store/                  # Zustand store
│   ├── constants/              # appInfo, version
│   ├── hooks/                  # (пустой)
│   └── types/                  # tauri.d.ts
├── src-tauri/                  # Backend (Rust, Tauri 2)
│   ├── src/
│   │   ├── commands/           # Tauri-команды: audio, settings, app, ai
│   │   ├── lib.rs              # Инициализация, регистрация команд
│   │   ├── state.rs            # Глобальные состояния
│   │   ├── whisper.rs          # Локальный STT
│   │   ├── ai_provider.rs      # AI провайдеры
│   │   ├── streaming.rs        # Стриминг AI
│   │   ├── prompts.rs          # Промпты
│   │   ├── deepgram.rs         # Deepgram STT
│   │   ├── keys.rs             # Шифрование ключей
│   │   ├── history.rs          # История
│   │   ├── utils.rs            # Утилиты
│   │   └── ...                 # tray, window, diag, transliteration
│   └── Cargo.toml
├── docs/                       # Документация
├── public/                     # Статические ассеты
├── branding/                   # Логотипы, иконки
├── .github/                    # GitHub Actions
├── package.json                # Frontend зависимости
├── next.config.ts              # Next.js config (static export)
├── tsconfig.json               # TypeScript config
├── AGENTS.md                   # Индекс для AI-агентов
└── CLAUDE.md                   # Симлинк → AGENTS.md
```

## Существующая документация (что уже было до аудита)
| Файл/место | Актуальность | Комментарий |
|---|---|---|
| docs/CHANGELOG.md | ✅ актуально | Подробный changelog v1.2.0 (опубликован) |
| docs/TECHNICAL.md | ✅ актуально | Технические характеристики |
| docs/AI_PROMPTS.md | ✅ актуально | Промпты для STT и AI |
| docs/PROMPT_PIPELINE_IMPLEMENTATION.md | ✅ актуально | План реализации промптов |
| docs/tags/v1.2.0/release.md | ✅ обновлено | Релизные notes (актуализированы 2026-08-05) |
| docs/tags/v1.1.0/release.md | ✅ актуально | Релизные notes |
| docs/tags/v1.0.0/release.md | ✅ актуально | Релизные notes |
| docs/architecture.md | ✅ обновлено | Актуализировано 2026-08-05 |
| docs/state.md | ✅ обновлено | Заполнено 2026-07-07 |
| docs/decisions.md | ✅ обновлено | Заполнено 2026-07-07 |
| docs/glossary.md | ✅ обновлено | Заполнено 2026-07-07 |
| docs/overview.md | ✅ обновлено | Заполнено 2026-07-07 |
| docs/README.md | ✅ обновлено | Версия 1.2.0, пометка о статусе релиза |

## Открытые вопросы к автору проекта
- Есть ли планы на кроссплатформенность (Windows/Linux)?
- Планируется ли CI/CD пайплайн для автоматического тестирования при PR?
- Отсутствующие релизные notes (v0.1.0-beta, v0.1.1-beta, v0.1.2-beta) — были ли они когда-то написаны?
