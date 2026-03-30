# NYX-Vox v1.0.0 (Official Release) 🚀
**Focus: Professional History, AI Evolution & Military-Grade Security 🌪️**

This landmark 1.0 release officially brings NYX Vox out of beta. We've solidified the core experience with a robust history system, professional text processing, and hardened security.

### ✨ Highlights

*   **Official 1.0 Release**: Stability improvements, refined logic, and production-ready architecture.
*   **Persistent History System**: A dedicated window with smart search and automatic cleanup. Retention periods up to 1 year, with a 1000-entry memory.
*   **AI Refinement (AI Чистка)**: Integrated LLM logic (**Gemini, Groq, DeepSeek, and Qwen**) to automatically format, punctuate, and clean your voice notes.
*   **Military-Grade Security**: API keys are protected by **AES-256-GCM hardware encryption** via a native Rust bridge.
*   **Quick Access Menu (QAM)**: A high-performance overlay to control AI settings, switch engines, or open history instantly.
*   **Engine Hot-Switching**: Cycle through cloud (Deepgram, Groq, Gemini) and local (Whisper) engines directly from the Quick Menu or header.
*   **Text Selection & Auto-Copy**: Select any text fragment with mouse or keyboard — it's automatically copied to clipboard with visual confirmation.
*   **Always-on-Top Logic**: Window automatically stays on top during recording, processing, and result display for seamless workflow.
*   **Code Optimization**: 100% TypeScript type safety achieved. All linting errors fixed. Zero critical bugs.
*   **AI Translation Fix**: Simplified prompts prevent unwanted translation. Russian stays Russian, English stays English.
*   **Shadowless "Aura" UI**: An uncompromisingly minimalist, border-focused aesthetic. Engineered for maximum transparency performance and "glanceable" clarity on macOS.
*   **Dynamic Intelligence**: The app window intelligently resizes itself to accommodate menus and results without clipping.

### 📦 Installation & Update Note
1. Download the `.dmg` or `.app` from the Assets below.
2. Drag **NYX Vox** to your Applications folder.
3. ⚠️ **Critical Update Step**: macOS treats the 1.0 signature as new.
   - Use the **"Reset Permissions"** button inside the app's settings, then **re-enable the checkbox**.
   - If that doesn't work, go to **Accessibility settings**, remove the old NYX Vox entry, and re-add the app.
4. 🛡️ **Unsigned App Fix**: If blocked, run in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

---

# Релиз v1.0.0 (Официальный релиз) 🚀
**Фокус: Профессиональная История, ИИ-эволюция и Безопасность 🌪️**

Версия 1.0 официально выводит NYX Vox из режима бета-тестирования. Мы объединили продвинутую обработку текста, усиленную безопасность и совершенно новую систему истории в стабильный, готовый к эксплуатации продукт.

### ✨ Что нового

*   **Официальный релиз 1.0**: Максимальная стабильность, отточенная логика и архитектура, готовая к эксплуатации.
*   **Полноценная система Истории**: Отдельное окно истории с быстрым поиском и автоматической очисткой. Выбирайте период хранения от 1 дня до года. Память на 1000 записей.
*   **AI Refinement (AI Чистка)**: Мы внедрили логику больших языковых моделей (**Gemini, Groq, DeepSeek и Qwen**) для автоматической чистки, расстановки пунктуации и форматирования текста.
*   **Шифрование военного уровня**: Ваши API-ключи теперь защищены шифрованием **AES-256-GCM**. Данные хранятся в зашифрованном виде на аппаратном уровне.
*   **Quick Access Menu (Быстрое меню)**: Высокопроизводительный оверлей для управления ИИ-чисткой, мгновенной смены движков и перехода в историю.
*   **Мгновенная смена движков**: Переключайтесь между облачными (Deepgram, Groq, Gemini) и локальными (Whisper) моделями прямо из «пилюли» или шапки приложения.
*   **Выделение и авто-копирование текста**: Выделите фрагмент текста мышью или клавиатурой — он автоматически копируется в буфер с визуальным подтверждением.
*   **Логика «Поверх всех окон»**: Окно автоматически остаётся поверх всех окон во время записи, обработки и показа результата для бесперебойного рабочего процесса.
*   **Оптимизация кода**: Достигнута 100% типобезопасность TypeScript. Все ошибки линтера исправлены.
*   **Исправление перевода AI**: Упрощённые промты предотвращают нежелательный перевод. Русский остаётся русским, английский — английским.
*   **Shadowless «Aura» Design**: Бескомпромиссно минималистичная эстетика, сфокусированная на гранях и контурах. Дизайн оптимизирован для идеальной работы прозрачности macOS и мгновенного считывания информации.
*   **Геометрический интеллект**: Окно приложения теперь само определяет нужный размер для меню и результатов, исключая обрезку контента.

### 📦 Примечание по установке и обновлению
1. Скачайте `.dmg` или `.app` из блока Assets ниже.
2. Перетащите **NYX Vox** в папку Applications.
3. ⚠️ **Важно при обновлении**: macOS может сбросить разрешения для новой версии.
   - Нажмите кнопку **"Сброс разрешений"** в настройках приложения, а затем **заново активируйте переключатель**.
   - Если это не помогло, удалите запись NYX Vox из списка Accessibility и добавьте приложение заново.
4. 🛡️ **Если macOS блокирует запуск**: Выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

**Built with ❤️ for macOS by AVP-Dev.**
