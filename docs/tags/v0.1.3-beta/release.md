# NYX-Vox v0.1.3-beta
**Focus: Maintenance & UI Polish 🛠️**

This version focuses on "under-the-hood" improvements and perfecting the macOS desktop experience. We've unified versioning, improved window stability, and added automated update alerts.

### ✨ Highlights
* **Auto-Update Notifications**: A new background system that checks GitHub for updates and alerts you within the app when a newer version is ready.
* **Pixel-Perfect Anchoring**: Fixed the "dropping window" bug. The status pill is now strictly pinned to the top-center and expands only downwards, maintaining a consistent position.
* **True Transparency**: Eliminated invisible shadow layers that were blocking mouse clicks on background windows. The app now only interacts with clicks inside the visible pill.
* **Restored NV Branding**: The iconic NV (NYX Vox) abbreviation is back in the status bar with a cleaner, more modern look and sharp orange status indicators.
* **Centralized Versioning**: Version management is now unified across package.json, Cargo.toml, and the React frontend.
* **Experimental REST Bridge**: Migrated cloud STT engines to a batch processing model for increased reliability and simplified future feature integration.

### 📦 Installation & Update Note
1. Download the .dmg or .app from the Assets below.
2. Drag NYX Vox to your Applications folder.
3. ⚠️ **Accessibility Tip**: macOS treats each beta as a new app signature.
   - First, try using the **"Reset Permissions"** button inside the app's settings, then **re-enable the checkbox** in the window that appears.
   - If that doesn't work, go to **System Settings > Privacy & Security > Accessibility**, remove the old NYX Vox entry with the minus (-) button, **click the plus (+) button to re-add the app**, and restart the app to restore functionality.
4. 🛡️ **Unsigned App Fix**: If macOS blocks the app, run this in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

---

# Релиз v0.1.3-beta: Исправления и Полировка интерфейса 🛠️

Этот релиз посвящен «внутренней кухне» приложения и доведению до идеала работы оверлея в среде macOS. Мы синхронизировали версии, улучшили стабильность окон и добавили уведомления.

### ✨ Что нового
* **Уведомления об обновлениях**: Новая система автоматической проверки версий через GitHub. Приложение само подскажет, когда выйдет свежее обновление.
* **Геометрическая точность**: Исправлен баг «прыгающего окна». Теперь статус-бар жестко прибит к верхнему краю экрана и расширяется только вниз при появлении текста.
* **Честная прозрачность**: Мы полностью убрали невидимые слои теней, которые раньше мешали нажимать на кнопки в других окнах за приложением. Теперь кликабелен только сам «овал».
* **Возвращение NV**: Легендарная аббревиатура NV (NYX Vox) снова в строю. Дизайн стал чище, а оранжевый индикатор статуса — аккуратнее.
* **Единая версия**: Теперь версия приложения (0.1.3) прописана в одном месте и синхронизирована везде — от системных файлов до меню настроек.
* **REST-архитектура**: Облачные движки переведены на пакетную обработку данных для повышения стабильности соединения (в режиме отладки).

### 📦 Примечание по установке и обновлению
1. Скачайте `.dmg` или `.app` из блока Assets ниже.
2. Перетащите **NYX Vox** в папку Applications.
3. ⚠️ **Совет по Accessibility**: macOS считает каждую новую бета-версию другим приложением (из-за подписи).
   - Сначала попробуйте нажать кнопку **"Сброс разрешений"** в настройках приложения, а затем **заново активируйте переключатель** в открывшемся окне.
   - Если это не помогло, перейдите в **Системные настройки > Конфиденциальность > Универсальный доступ**, удалите старую запись NYX Vox кнопкой «минус» (-), **нажмите «плюс» (+), выберите приложение заново** и перезапустите его.
4. 🛡️ **Если macOS блокирует запуск**: выполните в Терминале:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/NYX\ Vox.app
   ```

**Built with ❤️ for macOS by AVP-Dev.**
