# NYX-Vox v1.3.2 (Multi-Level Fallback Pipeline & Long Speech Resilience) 🚀
**Focus: Engine-Agnostic Multi-Level Fallback, Stream Density Verification, 429 Rate Limit Auto-Retry & Question Punctuation 🎙️**

> **Release status:** Prepared for GitHub Releases. Covers the full v1.3.2 scope:
> universal multi-level fallback pipeline across all STT and LLM providers (GigaChat, Groq, Whisper, Gemini, Deepgram, DeepSeek, Qwen),
> stream completeness & word density verification to prevent text cutoffs during long dictations,
> automatic 429/503 retry with backoff, generation token limit expanded to 4096 tokens,
> fail-safe raw STT transcript preservation when LLM formatting is unavailable,
> and reinforced question mark punctuation rules with few-shot examples.

This release addresses long dictation stability and cross-engine resilience: speech is protected from stream freezes and API rate limits, long monologues up to 20 minutes remain 100% complete without truncation, and question intonations receive proper question marks automatically.

---

### ✨ Highlights

*   **🛡️ Stream Completeness & Word Density Verification**: Implemented a speech density analyzer in `stop_recording`. If the user dictates long speech (>5 seconds) but the live stream preview froze mid-speech (due to network hiccups or API rate limits), the engine automatically detects the shortfall and performs an authoritative batch STT transcription over the complete WAV audio buffer. Not a single word is lost.
*   **⚡ Engine-Agnostic Multi-Level Fallback Pipeline**: Designed a universal resilience chain for all configured engines (GigaChat, Groq, Whisper, Gemini, Deepgram, DeepSeek, Qwen):
    - **Fast Path**: 0ms instant Single-Pass when streaming preview is up to date.
    - **STT Fallback**: Automatic full-file batch transcription if stream text is incomplete.
    - **AI Fallback**: If LLM formatting encounters network or quota errors, the raw transcribed text is safely preserved and pasted immediately rather than discarded.
*   **🔄 Automatic Rate Limit Retry (429/503 Backoff)**: Added automated retry logic with a 1.2-second pause when LLM providers (GigaChat, Gemini, Groq, DeepSeek) return transient rate-limiting or server overload responses.
*   **📊 Extended Output Token Limit (4096 tokens)**: Increased `max_tokens` to 4096 across all generation endpoints, guaranteeing sufficient capacity for continuous monologues of up to 20–25 minutes without output truncation.
*   **❓ Enhanced Question Mark Punctuation**: Upgraded `REFINEMENT_SYSTEM_PROMPT` with strict rules and few-shot examples for detecting interrogative intonations, questions, and rhetorical phrasing, ensuring question marks (`?`) are accurately placed.
*   **⏱️ Stream Polling Rate Optimization**: Adjusted interim streaming interval to 650ms with adaptive 429 backoff, eliminating rate-limit spikes on free-tier API endpoints.

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

# Релиз v1.3.2 (Многоуровневый Fallback и устойчивость длинной речи) 🚀
**Фокус: Универсальный Fallback-пайплайн, верификация плотности стриминга, авто-повтор при 429 лимитах и расстановка знаков вопроса 🎙️**

> **Статус релиза:** подготовлен для публикации на GitHub Releases. Включает полный объём v1.3.2:
> движко-независимую (Engine-Agnostic) цепочку подстраховки для всех провайдеров (GigaChat, Groq, Whisper, Gemini, Deepgram, DeepSeek, Qwen),
> верификацию плотности слов для защиты от обрывов при длинной речи,
> автоматический повтор при 429/503 ошибках с паузой, увеличение лимита токенов до 4096,
> гарантированное сохранение сырого STT-текста при сбоях ИИ-форматирования
> и усиленные правила постановки вопросительных знаков («?»).

Этот релиз обеспечивает безупречную стабильность при наговаривании длинных текстов: речь защищена от сетевых задержек и квот API, монологи до 20 минут сохраняются целиком без обрезки фраз, а вопросительные интонации корректно оформляются знаками вопроса.

---

### ✨ Что нового

*   **🛡️ Детектор плотности речи (`Stream Completeness Verification`)**: В функцию `stop_recording` внедрен анализатор плотности слов. Если диктовка длилась долго (>5 сек), а промежуточный стриминг завис на середине из-за сетевого спайка или лимита запросов, система автоматически распознает неполноту текста и выполняет чистовую батч-транскрипцию всего записанного WAV-файла. Ни одно слово не теряется.
*   **⚡ Универсальный многоуровневый Fallback-пайплайн**: Выстроена надежная цепочка подстраховки для всех провайдеров (GigaChat, Groq, Whisper, Gemini, Deepgram, DeepSeek, Qwen):
    - **Скоростной путь**: мгновенный Single-Pass (0.0 сек задержки), когда стриминг полон и актуален.
    - **STT Фоллбэк**: автоматическое чистовое распознавание полного файла при неполном стриминге.
    - **AI Фоллбэк**: если сервис форматирования перегружен или недоступен, сырой распознанный текст **никогда не сбрасывается**, а гарантированно вставляется в приложение.
*   **🔄 Авто-повтор при Rate Limit (Retry с паузой 1.2с)**: Добавлен автоматический повторный запрос при получении ошибок `429 Too Many Requests` или `503 Service Unavailable` от LLM-провайдеров (GigaChat, Gemini, Groq, DeepSeek).
*   **📊 Увеличение лимита генерации до 4096 токенов**: Лимит токенов на ответ поднят до 4096 для всех моделей, что исключает риск обрезки длинных монологов длительностью до 20–25 минут.
*   **❓ Точная расстановка вопросительных знаков**: В системный промпт `REFINEMENT_SYSTEM_PROMPT` добавлены строгие правила и эталонные примеры распознавания вопросительных конструкций и риторических вопросов для обязательной постановки знака `?`.
*   **⏱️ Оптимизация частоты стриминга**: Интервал фонового опроса установлен на 650 мс с защитой от 429 ошибок, что полностью устранило исчерпание лимитов запросов на бесплатных тарифах API.

---

### 📦 Инструкция по установке и обновлению
1. Скачайте файл `.dmg` или `.app` из секции Assets ниже.
2. Перетащите **NYX Vox** в папку «Программы» (Applications), заменив предыдущую версию.
3. ⚠️ **Сброс прав Универсального доступа (Accessibility)**: После установки новой версии macOS может потребовать обновления прав:
   - Откройте **Настройки внутри приложения** и нажмите кнопку **«Сбросить права»**, затем заново включите тумблер.
   - Либо откройте *Системные настройки macOS -> Конфиденциальность и безопасность -> Универсальный доступ*, удалите NYX Vox и добавьте его снова.
4. 🛡️ **Обход блокировки Gatekeeper (для неподписанной версии)**: Если macOS сообщает, что программа повреждена, выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
