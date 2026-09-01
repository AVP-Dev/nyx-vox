# NYX-Vox v1.3.1 (Real-Time Architecture, Pre-Speech Buffer & Compact Waveform Pill) 🚀
**Focus: Pre-Speech Audio Buffering, Clean VAD Pause Detection, Compact Waveform Pill Mode & Live Stream Stabilization 🎙️**

> **Release status:** Prepared for GitHub Releases. Covers the full v1.3.1 scope:
> pre-speech FIFO ring buffer to prevent consonant clipping, pure pause-based VAD auto-stop without artificial speech cutoffs,
> customizable Live Speech Preview toggle in Settings, compact 220px audio waveform pill mode,
> LLM prompt disfluency filtering (removing hesitations while preserving emotional interjections),
> interim streaming backpressure protection, and UI text stabilization (`splitCommittedAndDraft`).

This release elevates real-time voice dictation quality and desktop ergonomics: the speech engine captures unvoiced consonants with surgical precision, VAD auto-stop never interrupts long dictation monologues, users can toggle between live text preview and a sleek minimal waveform pill, and AI formatting removes speech stutters while preserving genuine human emotion.

---

### ✨ Highlights

*   **🎧 Pre-Speech FIFO Ring Buffer (300ms @ 16kHz)**: Integrated a pre-speech ring buffer in the audio capture thread. When VAD flags speech start, the 300ms lead-in audio is seamlessly flushed into the buffer, ensuring plosive and unvoiced consonants («п», «т», «к», «с», «ш») are never truncated.
*   **⏱️ Pure Pause-Based VAD Auto-Stop**: Removed artificial speech duration limits from `VadTracker`. Auto-stop now triggers strictly when continuous silence (pause) reaches the user-configured timeout in Settings (3.0s to 15.0s, default 7.0s). You can dictate long sentences and multi-minute monologues without accidental cut-offs.
*   **💊 Compact Waveform Pill Mode (220px)**: Added a "Live Speech Preview" ("Живой предпросмотр речи") toggle under Settings → Interface. When disabled, the recording window contracts into a sleek 220px pill displaying the animated audio `WaveformVisualizer`, saving screen space, CPU cycles, and API tokens.
*   **📏 Refined Recording Pill Dimensions**: Reduced standard live recording width from 380px to a more compact 320px for improved screen ergonomics.
*   **🎯 Smart Disfluency Removal vs Emotional Interjections**: Enhanced `REFINEMENT_SYSTEM_PROMPT` and formatting styles across all LLM engines (Gemini, DeepSeek, Qwen, Groq, GigaChat) with strict rules and few-shot examples:
    - **Remove filler hesitations**: «эээ», «нуу», «ммм», «хмм», stuttering, and false starts.
    - **Preserve emotional & semantic interjections**: «М-м, как вкусно!», «Ого, ничего себе!», «Эх, жаль», «Увы!».
*   **⚡ Interim Stream Backpressure Protection**: Added an atomic `is_inflight` backpressure guard to background stream workers. Lagging interim network requests are safely dropped rather than queued, eliminating stream lag and latency buildup.
*   **✨ UI Stream Stabilization (`splitCommittedAndDraft`)**: Separated streaming text into a solid white committed prefix and a subtly translucent italic hypothesis tail, eliminating visual text flicker during live speech.

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

# Релиз v1.3.1 (Архитектура Real-Time, Pre-Speech буфер и режим компактной пилюли) 🚀
**Фокус: Pre-Speech аудио-буферизация, чистый VAD-автостоп по паузе, режим компактной пилюли с волной звука и стабилизация стриминга 🎙️**

> **Статус релиза:** подготовлен для публикации на GitHub Releases. Включает полный объём v1.3.1:
> кольцевой pre-speech буфер для защиты от срезания начальных согласных, чистый VAD-автостоп по тишине без искусственных лимитов речи,
> тумблер «Живой предпросмотр речи» в Настройках, компактный режим пилюли 220px с эквалайзером волн,
> фильтрацию речевого мусора в LLM с сохранением эмоциональных междометий,
> неблокирующий backpressure в стриминге и стабилизацию бегущей строки (`splitCommittedAndDraft`).

Этот релиз выводит качество распознавания и эргономику интерфейса NYX Vox на новый уровень: захват звука с хирургической точностью сохраняет начальные глухие согласные, VAD больше никогда не обрывает длинные реплики на полуслове, появилась возможность сворачивать окно в аккуратную пилюлю с живым эквалайзером, а ИИ-форматтер удаляет запинки, бережно сохраняя живую человеческую интонацию.

---

### ✨ Что нового

*   **🎧 Кольцевой Pre-Speech буфер (300 мс @ 16kHz)**: В поток захвата звука внедрен кольцевой FIFO-буфер пред-речи. В момент обнаружения голоса 300 мс звука мгновенно подмешиваются в начало аудиозаписи — глухие и взрывные согласные («п», «т», «к», «с», «ш») в начале фраз больше никогда не обрезаются.
*   **⏱️ Чистый VAD-автостоп строго по паузе в речи**: Из `VadTracker` полностью удалены искусственные лимиты длительности непрерывной речи. Автостоп срабатывает исключительно тогда, когда вы завершили мысль и замолчали на время, выставленное в Настройках (3–15 сек). Теперь можно спокойно наговаривать сколь угодно длинные монологи.
*   **💊 Режим компактной пилюли с эквалайзером (220px)**: В «Настройки → Интерфейс» добавлен тумблер «Живой предпросмотр речи». При его отключении окно записи сворачивается в компактную пилюлю (220px) с анимированным эквалайзером волн `WaveformVisualizer`, экономя экранное пространство, ресурсы системы и токены API.
*   **📏 Оптимизированные габариты окна записи**: Стандартная длина окна записи с бегущим текстом сужена с 380px до эргономичных 320px.
*   **🎯 Четкое разделение звуков заминки и смысловых междометий в LLM**: Системные промпты форматирования (`REFINEMENT_SYSTEM_PROMPT` и стили) для всех ИИ-моделей дополнены строгими правилами и примерами:
    - **Удаляются звуки заминки (hesitations)**: «эээ», «нуу», «ммм», «хмм», заикания и ложные старты.
    - **Сохраняются эмоционально-смысловые междометия**: «М-м, как вкусно!», «Ого, ничего себе!», «Эх, жаль», «Увы!».
*   **⚡ Защита от очередей в стриминге (Backpressure)**: Внедрен атомарный флаг `is_inflight` в фоновые стриминг-воркеры. Отставшие сетевые запросы безопасно отбрасываются, исключая накопление очередей и задержки бегущей строки.
*   **✨ Стабилизация бегущей строки (`splitCommittedAndDraft`)**: Текст стриминга разделен на зафиксированный префикс (яркий белый) и динамический хвост-гипотезу (курсив/полупрозрачный), что полностью устранило визуальное мерцание и дергание слов при распознавании.

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
