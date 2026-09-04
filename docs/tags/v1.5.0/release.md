# NYX-Vox v1.5.0 (Windows Native Support & Groq LPU™) 🚀
**Focus: Native Windows Support (Win32 / Tauri 2), Groq LPU™ Formatting & Community Feedback 🎙️**

> **Release status:** Official release v1.5.0. Covers cross-platform desktop expansion to Windows 10/11, native Win32 foreground target tracking, automated window hiding with clipboard injection, ultra-fast Groq LPU™ formatting engine selector, and streamlined multi-platform CI/CD.

This release represents a monumental milestone for NYX Vox: the application is now natively available on both **macOS** (Apple Silicon Metal & Intel) and **Windows** (x86_64, Windows 10/11).

---

### ✨ Highlights

*   **🪟 Native Windows 10/11 Support**:
    *   Direct Win32 integration via `windows-sys` for active window tracking (`GetForegroundWindow`, `QueryFullProcessImageNameW`).
    *   Seamless auto-paste simulation: auto-hiding the overlay window before dispatching `Ctrl + V` keyboard events for rock-solid clipboard delivery into any active app.
    *   System media playback pause/resume via virtual keycodes (`VK_MEDIA_PLAY_PAUSE`).
    *   Windows-native installer (`.exe` NSIS installer) and portable MSI bundle.
    *   System tray integration with Windows native styling and instant shortcut tooltips (`Ctrl + Space`).
*   **⚡ Groq LPU™ Ultra-Fast AI Formatter**:
    *   Added dedicated UI selection for **Groq LPU™ (`llama-3.3-70b-versatile`)** in Settings -> Formatting Engines.
    *   Delivers sub-second cloud text formatting and punctuation polishing on Groq's custom Language Processing Unit hardware.
*   **🍎 macOS Experience Fully Preserved**:
    *   All macOS features remain at maximum performance: Apple Silicon GPU Metal acceleration, CoreML Whisper inference, and macOS Accessibility API integration.
*   **🛠️ Multi-Platform CI/CD Pipeline**:
    *   GitHub Actions workflow matrix compiles and bundles both macOS (`.dmg`) and Windows (`.exe` NSIS, `.msi`) artifacts automatically.

---

### 💬 Open Call for Community Feedback & Beta Testing

> [!IMPORTANT]
> **NYX Vox is developed primarily on macOS**, where our core maintainers conduct daily real-world dogfooding and automated regression testing.
> 
> The **Windows version is compiled natively** using Tauri 2 and the Windows API. Because hardware combinations and Windows environment setups vary wildly across devices, **we need your eyes and hands!**
> 
> Whether you are using **Windows** or **macOS**:
> - How smooth is the auto-paste into your favorite editors (VS Code, Word, Telegram, Obsidian, browsers)?
> - Does local Whisper or cloud STT transcription feel responsive?
> - How does the new Groq LPU™ formatting perform for your speech?
>
> Please share bug reports, suggestions, logs, or general feedback via [GitHub Issues](https://github.com/AVP-Dev/nyx-vox/issues) or [Discussions](https://github.com/AVP-Dev/nyx-vox/discussions). Every piece of feedback directly shapes the future of NYX Vox!

---

### 📦 Installation & Setup

#### For Windows Users:
1. Download `NYX-Vox-Setup-1.5.0.exe` (or `.msi`) from the Assets below.
2. Run the installer and launch NYX Vox.
3. If Windows SmartScreen displays a warning for an unsigned binary, click **"More info"** -> **"Run anyway"**.
4. Press `Ctrl + Space` anywhere to start dictating!

#### For macOS Users:
1. Download `NYX-Vox-1.5.0.dmg`.
2. Drag **NYX Vox** to your `/Applications` folder.
3. ⚠️ **Permissions**: Grant Accessibility and Microphone access in **System Settings -> Privacy & Security**.
4. 🛡️ **Gatekeeper Fix**: If macOS blocks execution:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
5. Press `Option + Space` anywhere to start dictating!

---

# Релиз v1.5.0 (Нативная поддержка Windows и Groq LPU™) 🚀
**Фокус: Нативная поддержка Windows (Win32 / Tauri 2), форматирование Groq LPU™ и сбор обратной связи 🎙️**

> **Статус релиза:** Официальный релиз v1.5.0. Включает кроссплатформенное расширение на Windows 10/11, определение активных окон через Win32, надежную автоматическую вставку с сокрытием окна, выбор сверхбыстрого ИИ-форматирования Groq LPU™ и единый мультиплатформенный CI/CD.

Этот релиз — важнейший шаг в развитии NYX Vox: теперь приложение работает нативно как на **macOS** (Apple Silicon Metal и Intel), так и на **Windows** (x86_64, Windows 10/11).

---

### ✨ Что нового

*   **🪟 Нативная поддержка Windows 10/11**:
    *   Прямая интеграция с Win32 через `windows-sys` для отслеживания целевого приложения (`GetForegroundWindow`, `QueryFullProcessImageNameW`).
    *   Бесшовная автоматическая вставка: скрытие оверлея перед отправкой комбинации `Ctrl + V` в активное текстовое поле с таймингами задержек.
    *   Пауза и возобновление мультимедиа через виртуальные коды (`VK_MEDIA_PLAY_PAUSE`).
    *   Удобный инсталлятор (`.exe` NSIS) и пакет `.msi`.
    *   Иконка в системном трее Windows с подсказкой горячих клавиш (`Ctrl + Space`).
*   **⚡ Сверхбыстрый ИИ-форматер Groq LPU™**:
    *   В Настройки -> Движки форматирования добавлен переключатель на **Groq LPU™ (`llama-3.3-70b-versatile`)**.
    *   Субсекундное облачное форматирование, расстановка пунктуации и очистка текста на специализированных процессорах LPU от Groq.
*   **🍎 Полная сохранность всех возможностей macOS**:
    *   Все оптимизации для Mac остались нетронутыми: аппаратное ускорение Metal для Apple Silicon, инференс через CoreML и глубокая интеграция с macOS Accessibility.
*   **🛠️ Мультиплатформенный CI/CD в GitHub Actions**:
    *   Автоматическая матричная сборка для macOS (`.dmg`) и Windows (`.exe`, `.msi`) при пуше и выпуске релизов.

---

### 💬 Обращение к сообществу: помогите сделать NYX Vox лучше!

> [!IMPORTANT]
> **Основная разработка NYX Vox ведется на платформе macOS**, где авторы проекта ежедневно тестируют приложение в реальной работе.
> 
> **Версия для Windows собрана нативно** на базе Tauri 2 и Win32 API. Однако в мире Windows существует огромное количество конфигураций оборудования, антивирусов и версий систем, поэтому **нам критически важна ваша обратная связь!**
> 
> Независимо от того, используете ли вы **Windows** или **macOS**:
> - Насколько стабильно работает авто-вставка в ваши программы (VS Code, Word, Telegram, браузеры, Obsidian)?
> - Довольны ли вы скоростью локального Whisper или облачного STT?
> - Как вам скорость и качество форматирования текста через Groq LPU™?
>
> Пожалуйста, делитесь впечатлениями, сообщайте об ошибках и оставляйте предложения в [GitHub Issues](https://github.com/AVP-Dev/nyx-vox/issues) или [Discussions](https://github.com/AVP-Dev/nyx-vox/discussions). Каждый ваш отзыв делает приложение быстрее, надежнее и удобнее!

---

### 📦 Установка и запуск

#### Для пользователей Windows:
1. Скачайте инсталлятор `NYX-Vox-Setup-1.5.0.exe` (или `.msi`) из блока Assets внизу.
2. Запустите установку и откройте NYX Vox.
3. Если Windows SmartScreen предупредит о неподписанном файле, нажмите **«Подробнее»** -> **«Выполнить в любом случае»**.
4. Нажмите `Ctrl + Space` в любой программе для начала диктовки!

#### Для пользователей macOS:
1. Скачайте образ `NYX-Vox-1.5.0.dmg`.
2. Перетащите **NYX Vox** в папку «Программы» (`/Applications`).
3. ⚠️ **Разрешения**: Предоставьте права в «Системных настройках» -> «Конфиденциальность и безопасность» -> «Универсальный доступ» и «Микрофон».
4. 🛡️ **Снятие карантина Gatekeeper** (при необходимости):
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```
5. Нажмите `Option + Space` для начала диктовки!
