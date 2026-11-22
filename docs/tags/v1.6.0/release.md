# NYX Vox v1.6.0 (Expanded Cloud STT Providers) 🎙️
**Focus: Realtime cloud transcription, provider selection, and model-specific configuration**

> **Release status:** Development test build prepared for testing from the `dev` branch. This is not a public release yet.

This version expands the available cloud speech recognition engines and connects provider selection to the recording start/stop flow. Local Whisper and existing engines remain available.

---

### ✨ Highlights

* **☁️ Four additional STT providers**:
  * ElevenLabs Scribe supports realtime transcription with a batch request fallback.
  * Azure MAI Transcribe connects through a configured Microsoft Foundry endpoint and deployment.
  * Speechmatics Realtime uses Melia 1 with multilingual Russian and English hints.
  * NVIDIA Build uses the selected NVCF function UUID for batch transcription; compatible multilingual models detect the language automatically.
* **🎙️ Isolated provider capture**: the new provider capture path does not launch the unrelated Groq interim worker. Realtime audio is streamed as 16 kHz PCM through a bounded channel.
* **⚙️ Provider settings**: added engine selection and API key fields, Azure endpoint/deployment settings, and NVIDIA function UUID. The public NVIDIA Build Parakeet model supports English only.
* **🌐 Offline fallback**: cloud selections can use the installed local Whisper model when connectivity is unavailable.

### 🧪 Testing notes

* The pair reviewer approved the provider integration and reported 149 Rust tests and 52 frontend tests passing on the reviewed revision.
* `cargo check`, `cargo fmt --check`, `bun run lint`, and `git diff --check` passed after the integration.
* Live provider requests were not made because they require user API keys. A local 1.6.0 app bundle was installed for user testing.

---

### 📦 Install on macOS

For Apple Silicon, use Homebrew or curl from the [installation instructions](https://github.com/AVP-Dev/nyx-vox/blob/main/README.md#install) once the release assets and updated tap are published. The curl installer verifies the release's SHA-256, removes quarantine from the installed NYX Vox bundle, and opens the app. The DMG and Windows installer are available in [GitHub Releases](https://github.com/AVP-Dev/nyx-vox/releases/latest).

---

# NYX Vox v1.6.0 (Новые облачные STT-провайдеры) 🎙️
**Фокус: Потоковое облачное распознавание, выбор провайдера и настройка моделей**

> **Статус:** тестовая сборка для проверки пользователем из ветки `dev`. Публичный релиз пока не выпущен.

В этой версии расширен список облачных движков распознавания речи и подключен выбор провайдера к полному циклу начала и завершения записи. Локальный Whisper и существующие движки сохранены.

---

### ✨ Что нового

* **☁️ Четыре новых STT-провайдера**:
  * ElevenLabs Scribe поддерживает потоковое распознавание и пакетный резервный запрос.
  * Azure MAI Transcribe подключается через endpoint Microsoft Foundry и имя deployment.
  * Speechmatics Realtime использует Melia 1 с подсказками для русского и английского языков.
  * NVIDIA Build выполняет пакетное распознавание через UUID функции NVCF; совместимые мультиязычные модели определяют язык автоматически.
* **🎙️ Изолированный захват**: новый путь записи провайдеров не запускает посторонний interim-воркер Groq. Аудио для realtime передается как PCM 16 кГц через ограниченный канал.
* **⚙️ Настройки провайдеров**: добавлены выбор движка и поля API-ключей, настройки endpoint/deployment Azure и UUID функции NVIDIA. Публичная модель NVIDIA Build Parakeet поддерживает только английский.
* **🌐 Офлайн-фолбек**: при отсутствии сети облачный режим может использовать установленную локальную модель Whisper.

### 🧪 Проверки

* Pair reviewer одобрил интеграцию и сообщил о 149 успешных Rust-тестах и 52 frontend-тестах на проверенной ревизии.
* После интеграции прошли `cargo check`, `cargo fmt --check`, `bun run lint` и `git diff --check`.
* Живые запросы к облачным провайдерам не выполнялись: для них нужны пользовательские API-ключи. Локальная сборка 1.6.0 установлена для проверки пользователем.

---

### 📦 Установка на macOS

После публикации файлов релиза и обновления tap владельцы Mac с Apple Silicon смогут установить приложение через Homebrew или curl по [инструкции по установке](https://github.com/AVP-Dev/nyx-vox/blob/main/README.ru.md#install). Установщик curl проверяет SHA-256, снимает карантин с установленного пакета NYX Vox и открывает приложение. DMG и установщик Windows доступны в [GitHub Releases](https://github.com/AVP-Dev/nyx-vox/releases/latest).
