# NYX Vox v1.6.1 (Stability, Audio Polishing & Tips) 🛠️
**Focus: macOS exit stability, Noise Gate accuracy, no-AI local formatter, and in-app audio tips**

> **Release status:** Public patch release on `main`.

This patch release resolves a macOS `SIGABRT` crash on exit, fixes the Noise Gate IPC parameter mismatch, adds silent-chunk gating for streaming cloud STT, improves the no-AI local formatter, and adds audio troubleshooting tips in Settings → Info.

---

### ✨ Highlights

* **🍎 macOS Exit Stability (`SIGABRT`)**: Prevented `ggml_metal_rsets_free` aborts on `Cmd+Q` / Dock quit by saving settings/history cleanly and exiting via `libc::_exit(0)` to bypass C++ static destructor races.
* **🎚️ Audio & Noise Gate Fix**: Fixed the `set_noise_gate` IPC payload (`{ threshold }` instead of `{ value }`), calibrated default `AudioGain` to `1.0`, and added `noise_gate` digital-silence gating with a 320ms hangover for streaming cloud STT (`cloud_stt.rs`).
* **📝 Local Formatter (No-AI mode)**: Added deterministic cleanup in `utils.rs` for elongated characters, hyphenated stutters, and pause dash artifacts.
* **💡 In-App Audio Tips**: Added a concise Audio & Recognition Tips section in Settings → Info covering Noise Gate sensitivity and macOS Voice Isolation.

### 🧪 Testing notes

* `bun run test` (**64 passed**, 11 files) and `bun run lint` passed.
* `cargo fmt --check` and `cargo test` (**162 passed**, 0 failed) passed.

---

### 📦 Install on macOS

Run either command below on a Mac with Apple Silicon. The curl installer verifies the DMG checksum, clears quarantine on the NYX Vox bundle and opens it.

**curl**

```bash
curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash
```

**Homebrew**

```bash
brew install --cask AVP-Dev/apps/nyx-vox
```

For a manual install, download the DMG from the [version picker](https://nyx-vox.avpdev.com/#download). If macOS blocks the app after you copy it to Applications, run:

```bash
xattr -dr com.apple.quarantine "/Applications/NYX Vox.app"
open "/Applications/NYX Vox.app"
```

---

# NYX Vox v1.6.1 (Стабильность, аудиотракт и советы в UI) 🛠️
**Фокус: Стабильный выход на macOS, корректный Noise Gate, локальный форматер и подсказки по звуку**

> **Статус:** публичный патч-релиз в ветке `main`.

Этот патч-релиз устраняет сбой `SIGABRT` при выходе на macOS, исправляет передачу параметра Noise Gate, добавляет гейтирование тишины для потоковых облачных STT, улучшает локальный форматер без ИИ и добавляет советы по звуку в «Настройки → О программе».

---

### ✨ Что нового

* **🍎 Стабильность выхода на macOS (`SIGABRT`)**: устранен сбой в `ggml_metal_rsets_free` при закрытии через `Cmd+Q` / Dock — настройки и история сохраняются безопасно, а выход выполняется через `libc::_exit(0)` в обход гонок C++-деструкторов.
* **🎚️ Аудиотракт и Noise Gate**: исправлен IPC-параметр `set_noise_gate` (`{ threshold }` вместо `{ value }`), дефолтное усиление `AudioGain` снижено до `1.0`, добавлено гейтирование тишины (320 мс hangover) для потоковых облачных STT (`cloud_stt.rs`).
* **📝 Локальный форматер (без ИИ)**: добавлено детерминированное схлопывание растянутых букв, дефисных запинок и лишних паузных тире в `utils.rs`.
* **💡 Подсказки по звуку в интерфейсе**: в «Настройки → О программе» добавлен краткий блок советов по настройке чувствительности шумодава и включению «Изоляции голоса» на macOS.

### 🧪 Проверки

* `bun run test` (**64 passed**, 11 файлов) и `bun run lint` пройдены успешно.
* `cargo fmt --check` и `cargo test` (**162 passed**, 0 failed) пройдены успешно.

---

### 📦 Установка на macOS

На Mac с Apple Silicon выберите один из способов ниже. Установщик curl проверяет контрольную сумму DMG, снимает карантин с пакета NYX Vox и открывает приложение.

**curl**

```bash
curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash
```

**Homebrew**

```bash
brew install --cask AVP-Dev/apps/nyx-vox
```

Для ручной установки скачайте DMG на [странице выбора версии](https://nyx-vox.avpdev.com/#download). Если после копирования в «Программы» macOS блокирует запуск, выполните:

```bash
xattr -dr com.apple.quarantine "/Applications/NYX Vox.app"
open "/Applications/NYX Vox.app"
```
