# NYX-Vox v1.1.0 (Transcription Reliability & Tech-Vocab Update) 🚀
**Focus: Professional AI Formatting, Multi-Language Protection & Empty-State Guard 🌪️**

This update significantly hardens the transcription and post-processing pipeline. We've introduced a strict "format-only" bilingual AI architecture to completely eliminate language drifting and hallucinations, while embedding specialized technical vocabulary hints to ensure perfect recognition of developer terminology.

### ✨ Highlights

*   **Format-Only AI Refinement**: Restructured the system prompts for all LLM providers (**Gemini, DeepSeek, Qwen**). The models now act strictly as punctuation/capitalization formatters, guaranteeing zero unwanted translation or injected conversational text.
*   **Developer Terminology Preservation**: Explicitly injected technical vocabulary hints (e.g., *GitHub, Cursor, Antigravity, Node, Bun, TypeScript*) directly into the STT engines and refinement passes. Tech terms are perfectly recognized even within Russian speech streams.
*   **Whisper Engine Hardening**: Enhanced local inference with non-speech/noise suppression (`suppress_nst=true`), increased search beams (`beam_size=3`), and pre-seeded technical dictionary context.
*   **Empty-State Window Guard**: Prevented empty window popups. If silence or junk background noise is captured, the application intelligently suppresses the window display and retains a perfectly clean desktop state.
*   **Sanitization Integrity**: Addressed complex regex constraints in `utils.rs` to flawlessly strip out trailing engine artifacts and repeated filler sequences.
*   **Professional Rebranding**: Officially updated the creator profile designation to **Modern Web Architect** across all application interfaces and technical repositories.

### 📦 Installation & Update Note
1. Download the latest `.dmg` or `.app` from the Assets below.
2. Drag **NYX Vox** to your Applications folder, replacing the older version.
3. ⚠️ **macOS Permissions Reset**: After updating, macOS may require refreshing universal access rights.
   - Go to **Settings inside the app** and click **"Reset Permissions"**, then recheck the accessibility box.
   - Alternatively, remove and re-add NYX Vox in System Settings -> Privacy & Security -> Accessibility.
4. 🛡️ **Unsigned App Gatekeeper Fix**: If macOS blocks execution, run the following command in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

---

# Релиз v1.1.0 (Надёжность транскрибации и IT-словарь) 🚀
**Фокус: Строгое ИИ-форматирование, защита от смены языка и блокировка пустых окон 🌪️**

Это масштабное обновление ядра распознавания и постобработки речи. Мы внедрили строгую двуязычную архитектуру «только форматирование», чтобы полностью исключить галлюцинации и самопроизвольный перевод текста, а также интегрировали словарь IT-терминов для идеального распознавания сленга разработчиков.

### ✨ Что нового

*   **ИИ-чистка в режиме «Только Форматирование»**: Полностью переработана система промтов для LLM (**Gemini, DeepSeek, Qwen**). Нейросети теперь работают исключительно как корректоры пунктуации и регистра, гарантируя полное отсутствие отсебятины и случайного перевода.
*   **Сохранение IT-терминологии**: В движки STT и промты постобработки напрямую зашит словарь технических терминов (*GitHub, Cursor, Antigravity, Node, Bun, TypeScript* и др.). Англоязычные термины корректно распознаются даже в потоке русской речи.
*   **Усиление локального Whisper**: Активировано подавление неречевых шумов (`suppress_nst=true`), увеличен размер луча поиска (`beam_size=3`) и задан контекст с техническим словарем.
*   **Защита от пустых окон (Empty-State Guard)**: Приложение больше не показывает всплывающее окно, если была тишина или фоновый шум — интерфейс остаётся скрытым, не отвлекая от работы.
*   **Целостность фильтрации**: Исправлены сложные регулярные выражения в `utils.rs` для идеального удаления мусорных токенов и повторяющихся фраз от моделей-распознавателей.
*   **Обновление подписи**: Официально обновлён статус создателя на **Modern Web Architect** во всех интерфейсах приложения и документации.

### 📦 Примечание по установке и обновлению
1. Скачайте `.dmg` или `.app` из блока Assets ниже.
2. Перетащите **NYX Vox** в папку Программы (Applications) с заменой старой версии.
3. ⚠️ **Сброс прав macOS**: При обновлении система может временно заблокировать доступ к автовставке.
   - Нажмите **"Сброс разрешений"** в настройках самого приложения и заново поставьте галочку.
   - Либо вручную удалите и верните NYX Vox в Системные настройки -> Конфиденциальность и безопасность -> Универсальный доступ.
4. 🛡️ **Если запуск заблокирован Gatekeeper**: Выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

**Built with ❤️ for macOS by AVP-Dev.**
