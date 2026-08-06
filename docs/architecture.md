# Архитектура

> Описывает КАК РЕАЛЬНО устроено (по факту кода), а не как задумывалось.
> Если старая документация противоречит коду — фиксируй расхождение явно,
> не удаляй старое, помечай как устаревшее.

## Обзор

NYX Vox — десктопное приложение для голосового ввода с AI-обработкой.

Поток данных:
```
Микрофон → cpal (запись) → STT-движок (Whisper/Deepgram/Groq/Gemini/GigaChat)
→ Текст → AI-форматирование (Gemini/DeepSeek/Qwen/Groq/GigaChat) → Автопаста (enigo)
```

Frontend (Next.js) отображает UI и вызывает backend через Tauri IPC.
Backend (Rust) обрабатывает аудио, вызывает STT и AI API, управляет настройками.

## Основные модули/сервисы

### Audio Pipeline (commands/audio.rs)
- Назначение: запись с микрофона, остановка, обработка аудио
- Расположение: `src-tauri/src/commands/audio.rs`
- Ключевые функции: `start_recording`, `stop_recording`, `paste_text`, `process_audio`
- Зависит от: cpal, hound, whisper-rs, state.rs
- Особенности: Noise Gate, Audio Gain (1.0-5.0), tail padding, compare_exchange для atomic stop, причины отклонения записи (тихо/коротко/нет звука)

### STT Engine (whisper/, deepgram.rs, ai_provider.rs, gigachat.rs)
- Назначение: распознавание речи в текст
- Расположение: `src-tauri/src/whisper/` (6 модулей: paths, model_cache, recording, transcribe, download, mod), `deepgram.rs`, `gigachat.rs`, STT-часть в `ai_provider.rs`
- Ключевые файлы: whisper/mod.rs (локальный), deepgram.rs (облачный, WebSocket), gigachat.rs (SberAI, HTTP)
- Зависит от: whisper-rs (Metal/CoreML), tungstenite, tokio-tungstenite, reqwest (rustls-tls)
- Особенности: три модели Whisper (Small/Medium/Turbo), кешированный WhisperState (без reinit Metal/Core ML), Core ML acceleration, автоопределение языка (Whisper auto, Deepgram multi, Groq ru, Gemini mixed)

### AI Provider (ai_provider.rs)
- Назначение: форматирование текста через LLM
- Расположение: `src-tauri/src/ai_provider.rs`
- Ключевые файлы: ai_provider.rs (диспетчер), deepseek.rs, qwen.rs, gigachat.rs (GigaChat-2)
- Зависит от: reqwest, serde_json, prompts.rs
- Особенности: пять провайдеров (Gemini, DeepSeek, Qwen, Groq, GigaChat), семафор для параллельных запросов, temperature 0.0

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
| Groq API | STT (Whisper Large-v3-Turbo) + AI-форматирование | ai_provider.rs |
| Deepgram API | STT (Nova-2/Nova-3, WebSocket) | deepgram.rs |
| Gemini API | STT (mixed) + AI-форматирование | ai_provider.rs |
| DeepSeek API | AI-форматирование | deepseek.rs |
| Qwen API | AI-форматирование | qwen.rs |
| GigaChat API (SberAI) | STT (GigaChat-2-Pro) + AI-форматирование (GigaChat-2), OAuth, Russian Trusted CA | gigachat.rs |
| GitHub API | Проверка обновлений | commands/app.rs |

## Известные архитектурные проблемы

- `commands/audio.rs` — самая большая логика записи/вставки, кандидат на дальнейшее разбиение
- GigaChat STT не проверен с реальным ключом (OAuth-флоу, выбор модели)
- macOS only — тяжёлая привязка к objc2, core-graphics, accessibility-client

## Расхождения со старой документацией

| Что было заявлено раньше | Что есть в коде на самом деле |
|---|---|
| docs/README.md: "Current Version: 1.0.0" | Актуальная версия: 1.2.0 |
| docs/tags/README.md: есть v0.1.0-beta, v0.1.1-beta, v0.1.2-beta | Файлы отсутствуют |
| docs/README.md: есть tags/history.md | Файл отсутствует |
