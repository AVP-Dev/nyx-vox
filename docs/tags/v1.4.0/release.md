# NYX-Vox v1.4.0 (Zero-Latency Rolling Commit & Acoustic Guard) 🚀
**Focus: Zero-Latency Rolling Commit, Acoustic Guard, Subtitle Hallucination Blacklist & Hybrid Continuous Streaming 🎙️**

> **Release status:** Prepared for GitHub Releases. Covers the full v1.4.0 scope:
> revolutionary Zero-Latency Rolling Commit architecture eliminating stop-button latency,
> Acoustic Guard (<350ms / RMS < 0.003) completely preventing idle GPU inference,
> expanded subtitle and translator hallucination blacklist (Dima Torzok, Amara.org, isolated closing phrases),
> continuous hybrid live streaming with Groq priority (<200ms preview) and non-blocking local Metal Whisper fallback,
> safe display concatenation preventing text erasure on screen,
> and the strict Frozen Pipeline Rule protecting core transcription and audio subsystems.

This release represents a foundational leap in speech transcription reliability and speed: speech is committed progressively during dictation, pressing Stop incurs zero processing delay, and silence in quiet environments produces zero ghost words or subtitle credits.

---

### ✨ Highlights

*   **⚡ Zero-Latency Rolling Commit Architecture**: Replaced full-file batch re-transcription with an incremental commit pipeline. Stable speech blocks are progressively committed into `committed_text` during speech pauses (800ms) or hard cutoffs (12s). When the user clicks Stop, Whisper infers **only the uncommitted audio tail** with a 300–400ms acoustic overlap and context prompt, cutting finalization latency to near zero.
*   **🛡️ Acoustic Guard (Silence & Noise Rejection)**: Added a dual-threshold acoustic gate before Whisper inference in both recording worker and finalization. If useful audio duration after silence trimming is < 350ms or RMS energy is < 0.003, inference is aborted immediately (returning 0 tokens). Zero GPU cycles wasted on background silence.
*   **🚫 Expanded Subtitle & Translator Hallucination Blacklist**: Implemented regex-anchored filtering in `is_hallucination` for YouTube metadata and subtitle credits («субтитры создавал», «дима торзок», «dimatorzok», «редактор субтитров», «amara.org», «продолжение следует»). Isolated closing words («Спасибо», «Благодарю», «Конец») are filtered only when the segment consists solely of that phrase, preserving 100% of real sentences like *«Спасибо за ревью, я поправил этот PR»*.
*   **🌊 Continuous Hybrid Live Streaming (Groq Priority + Local Fallback)**:
    - **Groq priority**: When an API key is configured, the interim worker sends growing audio every 500–600ms (first chunk at 450ms), streaming smooth word-by-word hypotheses (<200ms).
    - **Local fallback**: In pure offline mode, local Whisper transcribes a sliding 3-second window every 800ms without blocking for speech pauses.
    - **Safe Display Concatenation**: `safe_space_concatenate` combines the committed base with the active draft, ensuring previous sentences are never erased from the screen.
*   **🎨 Dynamic UI Split (Committed White + Draft Italic)**: `HeaderBar` automatically splits the live text stream via `splitCommittedAndDraft`: stable prefix words render in solid white, while trailing 1–2 words render in gray italic with a pulsating red cursor.
*   **🔒 Frozen Pipeline Agent Protection Rule (Rule #7)**: Formalized strict immutability for the audio capture, VAD, Whisper parameters (`no_speech=0.68`, `temperature=0.0`), deduplication, and refinement prompt in `AGENTS.md` and `docs/TRANSCRIPTION_PIPELINE.md`.

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

# Релиз v1.4.0 (Zero-Latency Rolling Commit и Акустический гейт) 🚀
**Фокус: Архитектура Rolling Commit с нулевой задержкой, Acoustic Guard, фильтр титров YouTube и гибридный стриминг 🎙️**

> **Статус релиза:** подготовлен для публикации на GitHub Releases. Включает полный объём v1.4.0:
> революционную архитектуру Rolling Commit без повторного прогона аудио при остановке,
> жесткий акустический гейт Acoustic Guard (<350 мс / RMS < 0.003), исключающий инференс на тишине,
> расширенный черный список метаданных субтитров и переводчиков («Дима Торзок», «субтитры создавал», «amara.org»),
> непрерывный гибридный стриминг (приоритет Groq + локальный Whisper без блокировки по паузам),
> безопасную склейку отображения для защиты от стирания текста с экрана
> и регламент Frozen Pipeline Rule, защищающий подсистему распознавания от несанкционированных правок.

Этот релиз совершает качественный скачок в скорости и надежности распознавания: речь фиксируется порциями прямо во время говорения, нажатие кнопки «Стоп» отдает результат мгновенно, а в тишине исключены любые фантомные слова и субтитры.

---

### ✨ Что нового

*   **⚡ Архитектура Zero-Latency Rolling Commit**: Устранен тяжелый повторный прогон всего многосекундного аудио при остановке записи. Текст фиксируется порциями (`committed_text`) во время естественных пауз речи (800 мс) или по таймеру (12 с). При нажатии «Стоп» Whisper расшифровывает **только незафиксированный хвост** с нахлестом 300–400 мс и контекстным промптом, сокращая задержку до минимума.
*   **🛡️ Жесткий акустический гейт (Acoustic Guard)**: Внедрен двухфакторный контроль тишины перед запуском Whisper. Если полезный отрезок звука после `trim_silence` короче 350 мс или общий RMS ниже 0.003, инференс прерывается без обращения к GPU (0 токенов, 0 галлюцинаций на фоне).
*   **🚫 Черный список метаданных субтитров и закрывающих слов**: Добавлена фильтрация титров YouTube и переводчиков («субтитры создавал», «дима торзок», «dimatorzok», «редактор субтитров», «amara.org», «продолжение следует»). Одиночные закрывающие фразы («Спасибо», «Благодарю», «Конец») отсекаются ТОЛЬКО если весь отрезок состоит из них, на 100% сохраняя реальные предложения пользователя (*«Спасибо за ревью, я поправил этот PR»*).
*   **🌊 Непрерывный гибридный стриминг (Groq priority + Local fallback)**:
    - **Приоритет Groq**: при наличии ключа Groq воркер каждые 500–600 мс (первый чанк через 450 мс) выдает плавный растущий черновик с задержкой отклика < 200 мс.
    - **Локальный фолбек**: в офлайн-режиме локальный Whisper декодирует скользящее окно (3 сек) каждые 800 мс без ожидания пауз.
    - **Безопасная склейка**: `safe_space_concatenate` соединяет зафиксированную базу и активный драфт, предотвращая стирание ранее надиктованного текста с экрана.
*   **🎨 Динамический UI-сплит (белая база + серый курсив)**: Компонент `HeaderBar` автоматически делит входящий поток: стабильные слова отображаются белым плотным шрифтом, а 1–2 последних слова текущей фразы — серым курсивом с пульсирующей красной точкой.
*   **🔒 Регламент Frozen Pipeline Rule (Правило №7)**: В `AGENTS.md` и `docs/TRANSCRIPTION_PIPELINE.md` закреплен строгий запрет на изменение параметров Whisper (`no_speech=0.68`, `temp=0.0`), VAD, алгоритма стриминга и LLM-промптов без явной команды `редактируем [компонент]`.

---

### 📦 Инструкция по установке и обновлению
1. Скачайте файл `.dmg` или `.app` из секции Assets внизу.
2. Перетащите **NYX Vox** в папку «Программы» (Applications), заменив предыдущую версию.
3. ⚠️ **Сброс прав доступа macOS**: После обновления macOS может потребоваться обновить права Универсального доступа (Accessibility):
   - Откройте **Настройки внутри приложения** и нажмите кнопку **«Сбросить права»**, затем подтвердите запрос системы.
   - Либо вручную удалите и снова добавьте NYX Vox в Системных настройках -> Конфиденциальность и безопасность -> Универсальный доступ.
4. 🛡️ **Снятие карантина Gatekeeper**: Если macOS блокирует запуск неподписанного приложения, выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
