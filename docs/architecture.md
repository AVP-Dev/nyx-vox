# Архитектура

> Описывает КАК РЕАЛЬНО устроено (по факту кода), а не как задумывалось.
> Если старая документация противоречит коду — фиксируй расхождение явно,
> не удаляй старое, помечай как устаревшее.

## Обзор

NYX Vox — десктопное приложение для голосового ввода с AI-обработкой.

Поток данных:
```
Микрофон → cpal (запись) → STT-движок (Whisper/Deepgram/Groq)
→ Текст → AI-форматирование (Gemini/DeepSeek/Qwen) → Автопаста (enigo)
```

Frontend (Next.js) отображает UI и вызывает backend через Tauri IPC.
Backend (Rust) обрабатывает аудио, вызывает STT и AI API, управляет настройками.

## Основные модули/сервисы

### Audio Pipeline (commands/audio.rs)
- Назначение: запись с микрофона, остановка, обработка аудио
- Расположение: `src-tauri/src/commands/audio.rs` (697 строк)
- Ключевые функции: `start_recording`, `stop_recording`, `process_audio`
- Зависит от: cpal, hound, whisper-rs, state.rs
- Особенности: Noise Gate, tail padding, compare_exchange для atomic stop

### STT Engine (whisper.rs, deepgram.rs)
- Назначение: распознавание речи в текст
- Расположение: `src-tauri/src/whisper.rs` (747 строк), `deepgram.rs` (205 строк)
- Ключевые файлы: whisper.rs (локальный), deepgram.rs (облачный, WebSocket)
- Зависит от: whisper-rs (Metal/CoreML), tungstenite, tokio-tungstenite
- Особенности: три модели Whisper (Small/Medium/Turbo), загрузка моделей при первом использовании, Core ML acceleration

### AI Provider (ai_provider.rs)
- Назначение: форматирование текста через LLM
- Расположение: `src-tauri/src/ai_provider.rs` (588 строк)
- Ключевые файлы: ai_provider.rs (диспетчер), deepseek.rs, qwen.rs
- Зависит от: reqwest, serde_json, prompts.rs
- Особенности: три провайдера (Gemini, DeepSeek, Qwen), семафор для параллельных запросов, temperature 0.0

### Settings (commands/settings.rs, state.rs)
- Назначение: управление настройками приложения
- Расположение: `src-tauri/src/commands/settings.rs` (395 строк), `state.rs` (96 строк)
- Ключевые функции: `get_all_settings`, `set_setting`
- Зависит от: tauri-plugin-store, serde
- Особенности: глобальное состояние через Mutex/AtomicBool, persist через plugin-store

### Keys Management (keys.rs)
- Назначение: шифрование и управление API-ключами
- Расположение: `src-tauri/src/keys.rs` (195 строк)
- Зависит от: aes-gcm, sha2, machineid-rs
- Особенности: AES-256-GCM с random nonce, привязка к machine-id

### History (history.rs)
- Назначение: история записей
- Расположение: `src-tauri/src/history.rs` (143 строки)
- Зависит от: serde, tauri-plugin-store
- Особенности: хранение в JSON, поиск, автоочистка

### Window Management (window.rs, tray.rs)
- Назначение: управление окном, always-on-top, позиционирование
- Расположение: `src-tauri/src/window.rs` (108 строк), `tray.rs` (88 строк)
- Зависит от: tauri, objc2-app-kit, core-graphics
- Особенности: dynamic resize, bounds checking, dock avoidance

## Схема данных

Нет традиционной БД. Данные хранятся:
- Настройки: tauri-plugin-store (JSON)
- API-ключи: зашифрованные файлы (AES-256-GCM)
- История: JSON-файлы

## Внешние интеграции

| Сервис | Зачем используется | Где в коде |
|---|---|---|
| Groq API | STT (Whisper Large-v3-Turbo) | ai_provider.rs |
| Deepgram API | STT (Nova-2) | deepgram.rs |
| Gemini API | AI-форматирование | ai_provider.rs |
| DeepSeek API | AI-форматирование | deepseek.rs |
| Qwen API | AI-форматирование | qwen.rs |
| GitHub API | Проверка обновлений | commands/app.rs |

## Известные архитектурные проблемы

- `whisper.rs` (747 строк) — смешивает загрузку моделей и транскрипцию
- `page.tsx` (1115 строк) — монолитная главная страница фронтенда
- Нет тестов ни на одной стороне
- macOS only — тяжёлая привязка к objc2, core-graphics
- hooks/ — пустой каталог

## Расхождения со старой документацией

| Что было заявлено раньше | Что есть в коде на самом деле |
|---|---|
| docs/README.md: "Current Version: 1.0.0" | Актуальная версия: 1.2.0 |
| docs/tags/README.md: есть v0.1.0-beta, v0.1.1-beta, v0.1.2-beta | Файлы отсутствуют |
| docs/README.md: есть tags/history.md | Файл отсутствует |
