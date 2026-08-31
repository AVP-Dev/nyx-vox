# NYX-Vox v1.3.0 (Live Streaming, Verbatim AI & Custom Models) 🚀
**Focus: Real-time Live Phrase Streaming, Strict 100% Verbatim Prompts, Custom AI Model Selectors, Smart VAD & Noise Gate Optimization 🎙️**

> **Release status:** Prepared for GitHub Releases. Covers the full v1.3.0 scope:
> universal live phrase streaming, strict verbatim AI calibrations for GigaChat / DeepSeek / Gemini / Qwen / Groq,
> model preset dropdowns & custom model IDs in Settings, configurable silence pause (3–15s VAD auto-stop),
> silence trimming to eliminate Whisper hallucinations, and streamlined UI layout.

This release represents a significant quality and UX leap for NYX Vox: dictation text now streams live onto the screen with zero clutter, AI formatting strictly preserves every original word without unwanted rewriting or synonym replacement, users can configure any LLM model on the fly, and audio processing prevents false drops and noise bleed.

---

### ✨ Highlights

*   **🎙️ Universal Live Phrase Streaming**: Added real-time interim transcription across all STT engines (Groq, Deepgram, Gemini, GigaChat, and Local Whisper). Spoken phrases appear instantly on screen as you speak with an active typing indicator.
*   **🎯 100% Verbatim AI Calibration**: Completely revised system prompts (`REFINEMENT_SYSTEM_PROMPT`, `FORMAT_STYLE_LIGHT`, `FORMAT_STYLE_DEEP`) to enforce strict verbatim retention. AI formatters (especially GigaChat-2 and DeepSeek) now act strictly as punctuators and grammar correctors — synonym substitution, sentence restructuring, or unsolicited advice are 100% forbidden.
*   **⚙️ Custom AI Model Presets & Direct Input**: Added granular model selectors under Settings → Keys for every provider (Groq, Gemini, DeepSeek, Qwen, GigaChat) with separate slots for STT and AI Formatting. Pick from curated flagship presets (e.g. `deepseek-v4-flash`, `gemini-2.5-flash` / `pro`, `qwen3.7-flash` / `plus`, `llama-3.3-70b-versatile`, `GigaChat-2-Pro` / `Max`) or type any custom model ID with instant one-click reset to defaults.
*   **⏱️ Smart VAD Silence Auto-Stop (3–15s)**: Added configurable silence detection in Settings → General. The user can adjust the auto-stop pause duration between 3.0s and 15.0s (default 7.0s). Silence tracking only activates after speech begins, accommodating users who pause to think.
*   **🔇 Anti-Hallucination & Silence Trimming (`trim_silence`)**: Audio buffers now automatically trim leading and trailing silence before STT inference. Combined with updated regex patterns (`RE_MUSIC_COMPLEX`), this completely eliminates Whisper hallucinations on trailing pauses (e.g., "[music]", "music that was playing before").
*   **🛡️ 100% Reliable Dictation Finalization**: Added live-streaming fallback in `useRecording.ts` and robust buffer handling in `take_recording_wav`. Short phrases and hotkey stop triggers are never accidentally dropped or silently discarded.
*   **🎚️ Noise Gate Calibration & Clear Directional Labels**: Corrected inverted sensitivity labels in Settings → General (Soft / Quiet Room on left `0.001`, Strong / Noisy Background on right `0.025`). Users can accurately suppress ambient noise without cutting off voice.
*   **✨ Streamlined Recording UI**: Removed outdated "Listening..." label and audio waveform diagram during recording. The window now extends to 380px, displaying clean live text strictly bounded between action buttons with smooth right-aligned auto-scrolling and gradient fade.

---

### 📦 Installation & Update Note
1. Download the `.dmg` or `.app` from the Assets below.
2. Drag **NYX Vox** to your Applications folder, replacing the older version.
3. ⚠️ **macOS Permissions Reset**: After updating, macOS may require refreshing universal access rights:
   - Go to **Settings inside the app** and click **"Reset Permissions"**, then recheck the accessibility box.
   - Alternatively, remove and re-add NYX Vox in System Settings -> Privacy & Security -> Accessibility.
4. 🛡️ **Unsigned App Gatekeeper Fix**: If macOS blocks execution, run the following command in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

---

# Релиз v1.3.0 (Живой стриминг, 100% дословность ИИ и кастомные модели) 🚀
**Фокус: Живой стриминг фраз в реальном времени, строгая дословность промптов, выбор любых моделей ИИ, умный VAD и улучшенный шумодав 🎙️**

> **Статус релиза:** подготовлен для публикации на GitHub Releases. Включает полный объём v1.3.0:
> универсальный live-стриминг фраз, строгую калибровку промптов GigaChat / DeepSeek / Gemini / Qwen / Groq без пересказа,
> выбор пресетов и ввод кастомных названий моделей в Настройках, настраиваемый VAD-автостоп по тишине (3–15 сек),
> обрезку тишины для исключения галлюцинаций Whisper и чистый современный интерфейс.

Этот релиз — важный скачок в удобстве и качестве NYX Vox: диктуемый текст теперь появляется на экране прямо во время речи, ИИ-форматтер строго сохраняет авторские слова без подмены синонимами или пересказа, любые модели ИИ настраиваются прямо из UI, а звук защищен от сбросов и фонового шума.

---

### ✨ Что нового

*   **🎙️ Универсальный Live-стриминг фраз**: Внедрена промежуточная транскрибация во все движки STT (Groq, Deepgram, Gemini, GigaChat и локальный Whisper). Произносимые фразы моментально отображаются на панели с активным курсором.
*   **🎯 100% Дословность AI-форматирования**: Промпты (`REFINEMENT_SYSTEM_PROMPT`, `FORMAT_STYLE_LIGHT`, `FORMAT_STYLE_DEEP`) полностью перекалиброваны. Форматтеры (в особенности GigaChat-2 от Сбера и DeepSeek) теперь работают строго как пунктуаторы и корректоры грамматики — замена слов синонимами, перефразирование и непрошеные советы запрещены на 100%.
*   **⚙️ Выбор и ввод кастомных моделей ИИ**: В «Настройки → Ключи» для каждого провайдера (Groq, Gemini, DeepSeek, Qwen, GigaChat) добавлены раздельные слоты настройки моделей (для распознавания STT и для AI-форматирования). Доступны актуальные флагманские пресеты (`deepseek-v4-flash`, `gemini-2.5-flash` / `pro`, `qwen3.7-flash` / `plus`, `llama-3.3-70b-versatile`, `GigaChat-2-Pro` / `Max`), а также поле свободного ввода любого ID модели с мгновенной кнопкой сброса к значениям по умолчанию.
*   **⏱️ Умный VAD-автостоп по тишине (3–15 сек)**: В «Настройки → Общие» добавлен настраиваемый таймер тишины (от 3.0 до 15.0 секунд, по умолчанию 7.0с). Таймер активируется только после начала речи, позволяя спокойно сделать паузу и подумать 5–10 секунд.
*   **🔇 Защита от галлюцинаций Whisper (`trim_silence`)**: Добавлена автоматическая обрезка начальной и хвостовой тишины перед отправкой аудио в Whisper. Вкупе с новыми regex-паттернами это на 100% устраняет выдуманные фразы вроде «[музыка]» или «музыка, которая тут была...».
*   **🛡️ 100% Надёжность финализации записи**: Добавлен fallback на стриминговый текст в `useRecording.ts` и безопасная обработка коротких фраз в `take_recording_wav`. Запись больше никогда не сбрасывается впустую при остановке клавишами.
*   **🎚️ Калибровка шкалы шумодава (Noise Gate)**: Исправлены перепутанные надписи слайдера в настройках (слева `0.001` — Тихая комната/мягкий, справа `0.025` — Сильный фон/агрессивный). Теперь можно точно заглушить фон, не рискуя потерять голос.
*   **✨ Современный минималистичный интерфейс**: Убран визуальный шум (надпись «Слушаю...» и диаграмма волн). Окно записи расширено до 380px, а живой текст печатается строго между кнопками с плавным авто-скроллом вправо и градиентным затуханием слева.

---

### 📦 Установка и примечание к обновлению
1. Скачайте `.dmg` или `.app` из блока Assets ниже.
2. Перетащите **NYX Vox** в папку «Программы» (Applications), заменив предыдущую версию.
3. ⚠️ **Сброс прав доступа macOS**: После обновления macOS может потребоваться обновить права Универсального доступа:
   - Перейдите в **«Настройки» внутри приложения** и нажмите кнопку **«Сброс прав»**, затем повторно включите галочку Универсального доступа в настройках macOS.
   - Либо вручную удалите и добавьте NYX Vox в «Системные настройки → Конфиденциальность и безопасность → Универсальный доступ».
4. 🛡️ **Снятие карантина Gatekeeper (для неподписанного приложения)**: Если macOS блокирует запуск с сообщением о повреждении файла, выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

