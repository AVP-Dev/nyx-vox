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
* **⚙️ Provider settings**: added engine selection and API key fields, Azure endpoint/deployment settings, and NVIDIA function UUID. Compatible NVIDIA models detect the spoken language automatically.
* **🌐 Offline fallback**: cloud selections can use the installed local Whisper model when connectivity is unavailable.

### 🧪 Testing notes

* The pair reviewer approved the provider integration and reported 149 Rust tests and 52 frontend tests passing on the reviewed revision.
* `cargo check`, `cargo fmt --check`, `bun run lint`, and `git diff --check` passed after the integration.
* Live provider requests were not made because they require user API keys. The production build and local installation are being prepared for direct user testing.

---

### 📦 Local macOS test installation

The test build is installed directly into `/Applications/NYX Vox.app` from the `dev` branch. Grant Microphone and Accessibility permissions if macOS requests them. Use `Option + Space` to start dictation.

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
* **⚙️ Настройки провайдеров**: добавлены выбор движка и поля API-ключей, настройки endpoint/deployment Azure и UUID функции NVIDIA. Совместимая мультиязычная модель сама определяет язык.
* **🌐 Офлайн-фолбек**: при отсутствии сети облачный режим может использовать установленную локальную модель Whisper.

### 🧪 Проверки

* Pair reviewer одобрил интеграцию и сообщил о 149 успешных Rust-тестах и 52 frontend-тестах на проверенной ревизии.
* После интеграции прошли `cargo check`, `cargo fmt --check`, `bun run lint` и `git diff --check`.
* Живые запросы к облачным провайдерам не выполнялись: для них нужны пользовательские API-ключи. Сборка и установка готовятся для прямого тестирования пользователем.

---

### 📦 Локальная установка тестовой сборки macOS

Тестовая сборка устанавливается непосредственно в `/Applications/NYX Vox.app` из ветки `dev`. Если macOS запросит разрешения, предоставьте доступ к микрофону и Универсальному доступу. Для начала диктовки используйте `Option + Space`.
