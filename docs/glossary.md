# Глоссарий проекта

> Доменные термины, которые не очевиды из названия. Помогает агенту
> не путать бизнес-логику при первом чтении кода.

| Термин | Значение |
|---|---|
| STT | Speech-to-Text — распознавание речи в текст |
| Whisper | Локальный STT-движок (whisper-rs), работает на CPU/GPU/Metal |
| Deepgram | Облачный STT-провайдер (WebSocket API) |
| Groq | Облачный STT-провайдер (HTTP API, Whisper Large-v3-Turbo на LPU) |
| AI Formatting | Постобработка текста через LLM (Gemini, DeepSeek, Qwen) — пунктуация, капитализация, абзацы |
| Noise Gate | Порог шума — отсекает фоновые звуки, реагирует только на голос |
| Auto-Paste | Автоматическая вставка результата в активное приложение через enigo |
| Auto-Pause | Автоматическая пауза медиа (Music.app) при начале записи |
| CoreML | Ускоритель Apple для ML-инференса, используется whisper-rs на macOS |
| Metal | Графический API Apple, используется для GPU-ускорения whisper-rs |
| enigo | Rust-библиотека для эмуляции ввода (клавиатура, мышь) |
| machine-id | Уникальный идентификатор hardware, используется для привязки зашифрованных ключей |
| AiSemaphore | Семафор (tokio::sync::Semaphore) для ограничения параллельных AI-запросов |
| WhisperModelType | Enum: Small, Medium, Turbo — типы локальных Whisper-моделей |
| FormattingStyle | Enum: Casual, Professional — стили AI-форматирования |
| SttMode | Режим STT: "whisper", "deepgram", "groq" |
| active_stt_mode | Фактический STT-режим (может отличаться от SttMode при fallback) |
| NoiseGateThreshold | Порог шума (f32), настраивается пользователем |
| DidPauseMedia | Флаг: была ли приостановлена медиа при записи |
| TargetApp | Информация о целевом приложении для автопасты (Name, Bundle ID) |
| CSP | Content Security Policy — политика безопасности для Tauri WebView |
| IPC | Inter-Process Communication — связь между Rust-бэкендом и WebView-фронтендом через invoke() |
| tauri-plugin-store | Плагин Tauri для persistent хранения настроек |
