# NYX Vox v1.6.1

Minimal patch release with stability, audio pipeline, and UI tip improvements.

## What's Fixed
- **macOS Exit Crash (`SIGABRT`)**: Prevented `ggml_metal_rsets_free` abort during `Cmd+Q` / Dock quit by persisting state cleanly and exiting via `libc::_exit(0)`.
- **Noise Gate & Cloud STT Gating**: Fixed `set_noise_gate` IPC parameter (`{ threshold }`), set default `AudioGain` to `1.0`, and gated silent chunks in streaming cloud STT with a 320ms hangover.
- **Local Formatter (No-AI mode)**: Added deterministic cleanup for elongated characters, hyphenated stutters, and punctuation artifacts.
- **Audio & Recognition FAQ**: Added quick troubleshooting tips in Settings → Info for Noise Gate sensitivity and macOS Voice Isolation.

---

# NYX Vox v1.6.1 (RU)

Минимальный патч-релиз с исправлениями стабильности, аудиотракта и подсказками в интерфейсе.

## Что исправлено
- **Выход на macOS (`SIGABRT`)**: устранен сбой в `ggml_metal_rsets_free` при закрытии через `Cmd+Q` / Dock.
- **Noise Gate и облачный стриминг**: исправлена передача `set_noise_gate` (`{ threshold }`), дефолтное усиление `AudioGain` снижено до `1.0`, добавлено гейтирование тишины (320 мс hangover) в потоковом Cloud STT.
- **Локальный форматер без ИИ**: добавлено схлопывание растянутых букв, запинок с дефисом и лишних паузных тире.
- **Советы по звуку**: в «Настройки → О программе» добавлена краткая памятка по настройке чувствительности шумодава и режиму «Изоляция голоса» на macOS.
