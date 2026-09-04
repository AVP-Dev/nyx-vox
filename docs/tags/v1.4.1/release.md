# NYX-Vox v1.4.1 (Deepgram Nova-3 & Multilingual Code-Switching) 🚀
**Focus: Deepgram Nova-3 Upgrade, Native Multilingual Code-Switching (Russian, English & more) & Multi-Tier Fallback Cascade 🎙️**

> **Release status:** Prepared for GitHub Releases. Covers the full v1.4.1 scope:
> upgrade of the cloud Deepgram STT engine to the latest flagship Nova-3 model,
> native support for multilingual code-switching (`language=multi`) including Russian, English, Spanish, German, French, etc.,
> multi-tier fallback cascade in WebSocket streaming and REST API (`["nova-3", "nova-3-general", "nova-2-general"]`),
> and full resilience across all Deepgram account tiers and regions.

This release brings first-class Russian and bilingual speech recognition to Deepgram: speech is transcribed with unprecedented speed and accuracy in both real-time WebSocket streaming and batch finalization, eliminating legacy parameter rejections and empty transcripts.

---

### ✨ Highlights

*   **🎙️ Deepgram Nova-3 STT Engine Upgrade**: Transitioned the Deepgram pipeline from legacy `nova-2-general` to the current state-of-the-art `nova-3` model. Nova-3 offers enhanced acoustic robustness, lower latency, and superior capitalization and punctuation.
*   **🌍 Native Multilingual Code-Switching (`language=multi`)**: Enabled multilingual code-switching with native support for Russian alongside 9 other key languages (English, Spanish, French, German, Hindi, Portuguese, Japanese, Italian, Dutch). Speakers can effortlessly switch between Russian and English technical terms without losing a word.
*   **🛡️ Multi-Tier Resilient Fallback Cascade**: Implemented a 3-tier cascade (`["nova-3", "nova-3-general", "nova-2-general"]`) across WebSocket streaming (`try_websocket_stream`), interim HTTP polling, and final REST processing (`stop_recording`). Automatically adapts to any Deepgram account tier or regional endpoint without dropping connections.
*   **⚡ Zero-Latency End-to-End Dictation**: Seamlessly integrates with the v1.4.0 Zero-Latency Rolling Commit and In-Flight Guard, providing instant live word-by-word interim feedback.

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

# Релиз v1.4.1 (Deepgram Nova-3 и Мультиязычный режим) 🚀
**Фокус: Обновление Deepgram до Nova-3, нативное мультиязычное переключение (русский, английский и др.) и каскадный фолбек 🎙️**

> **Статус релиза:** подготовлен для публикации на GitHub Releases. Включает полный объём v1.4.1:
> переход облачного движка Deepgram STT на актуальную флагманскую модель Nova-3,
> нативную поддержку мультиязычного кодового переключения (`language=multi`), включая русский, английский, испанский, немецкий, французский и др.,
> многоуровневый каскад фолбека в WebSocket-стриминге и REST API (`["nova-3", "nova-3-general", "nova-2-general"]`),
> и гарантированную совместимость со всеми тарифными планами и регионами Deepgram.

Этот релиз обеспечивает первоклассное распознавание русской и двуязычной речи через Deepgram: звук расшифровывается с максимальной скоростью и точностью как в реальном времени через WebSocket, так и при финальной обработке, устраняя ошибки несовместимости параметров и пустые результаты.

---

### ✨ Что нового

*   **🎙️ Обновление движка Deepgram до Nova-3**: Подсистема Deepgram переведена с устаревшей `nova-2-general` на современную флагманскую модель `nova-3`. Новая модель демонстрирует повышенную помехоустойчивость, сниженную задержку и улучшенную расстановку пунктуации.
*   **🌍 Нативное мультиязычное переключение (`language=multi`)**: Включен режим смешанной речи с официальной поддержкой русского языка в составе 10 ключевых языков (русский, английский, испанский, немецкий, французский, хинди, португальский, японский, итальянский, нидерландский). Пользователи могут свободно переключаться между русской речью и английскими терминами без потерь слов.
*   **🛡️ Отказоустойчивый каскадный фолбек**: Внедрен 3-уровневый каскад моделей (`["nova-3", "nova-3-general", "nova-2-general"]`) в WebSocket-стриминге (`try_websocket_stream`), фоновом interim HTTP-воркере и финальном REST API (`stop_recording`). Система автоматически адаптируется под любой тип аккаунта Deepgram без сброса соединения.
*   **⚡ Мгновенный отклик диктовки**: Полная интеграция с архитектурой Zero-Latency Rolling Commit и защитой In-Flight Guard, гарантирующая пословный живой вывод текста без задержек.

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
