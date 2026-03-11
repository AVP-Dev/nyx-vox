<div align="center">
  <img src="./branding/app-icon-safe.png" width="96" height="96" alt="NYX Vox Logo" />
  <h1>NYX Vox</h1>

  [![Скачать](https://img.shields.io/github/v/release/AVP-Dev/nyx-vox?label=%D0%A1%D0%BA%D0%B0%D1%87%D0%B0%D1%82%D1%8C&style=for-the-badge&color=orange)](https://github.com/AVP-Dev/nyx-vox/releases/latest)

  <p>
    <a href="https://avp-dev.github.io/nyx-vox/" target="_blank" rel="noopener noreferrer">🌐 Лендинг</a> &nbsp;|&nbsp; 
    <a href="./README.md">🇺🇸 English Version</a> &nbsp;|&nbsp; 
    <a href="./docs/TECHNICAL.ru.md" target="_blank" rel="noopener noreferrer">⚙️ Техническая часть</a>
  </p>
</div>

Добро пожаловать в **NYX Vox**! Это тестовая версия приложения для голосового ввода, созданная для личного использования. Это первый проект такого масштаба, написанный нами на **Rust**, поэтому мы будем рады фидбэку и архитектурным советам!

## 🌟 Наше Видение
NYX Vox — это быстрый, локально-ориентированный и облачно-ускоренный голосовой интерфейс на вашем рабочем столе. Проект стремится быть максимально функциональным, красивым и удобным в повседневной работе. Исходный код открыт для всех желающих.

### 🎙 Движки Распознавания Речи (STT)
1. **CLOUD (Deepgram):** Мгновенная коммерческая модель. Идеально расставляет знаки препинания и отлично фильтрует шум.
2. **CLOUD (Groq):** Запускает нейросеть Whisper Large-v3-Turbo на инфраструктуре Groq. Безумная скорость STT бесплатно.
3. **OFFLINE (Whisper):** Локальная обработка `ggml-small.bin` прямо на вашем Mac совершенно без интернета. Максимальная приватность.

## � Установка и запуск

1. **Скачивание**: Возьмите последний `.dmg` файл на странице [Релизов](https://github.com/AVP-Dev/nyx-vox/releases).
2. **Установка**: Откройте скачанный `.dmg` и перетяните **NYX Vox** в папку `Applications` (Программы).
3. **Запуск**: Запустите приложение из папки Программы.

### 🛠 Решение проблем: Ошибка "Приложение повреждено"
Если macOS пишет, что приложение повреждено или его нельзя открыть, это связано с отсутствием платной цифровой подписи Apple. Чтобы это исправить:
1. Откройте **Терминал**.
2. Введите команду:
   ```bash
   xattr -cr /Applications/NYX\ Vox.app
   ```
3. Попросите систему открыть приложение снова.

> [!WARNING]
> ### ⚠️ Важно: Обновление приложения (Сброс прав)
> Поскольку приложение распространяется вне Mac App Store (без платной подписи разработчика), macOS воспринимает каждое ручное обновление как новую программу. **При установке новой версии у вас перестанет работать автовставка текста**, так как macOS сбросит права "Универсального доступа".
> 
> **Решение при каждом обновлении:**
> 1. Откройте **Системные настройки** -> **Конфиденциальность и безопасность** -> **Универсальный доступ**.
> 2. Найдите в списке `NYX Vox`, выделите его и нажмите кнопку минус **`-`** (Удалить).
> 3. Запустите приложение заново: оно снова запросит права. Либо вручную добавьте новое приложение кнопкой плюс **`+`**.

## 🚀 План развития (Roadmap)
- [x] Базовый пайплайн (Whisper/Groq/Deepgram)
- [x] Современный интерфейс (Glassmorphism)
- [x] Нативная вставка текста (MacOS HID)
- [ ] Кастомные горячие клавиши
- [ ] Локальная история и поиск по текстам
- [ ] Продвинутое форматирование и пунктуация
- [ ] Мультимодальная обработка (в планах)

> [!TIP]
> Поскольку это наши первые уверенные шаги в экосистеме Rust (Tauri), будем рады любым отзывам и подсказкам для оптимизации архитектуры!

<br />
<p align="center">
  <a href="https://avpdev.com/en/"><b>Alexios Odos</b></a>
  &nbsp;|&nbsp;
  <a href="https://avpdev.com/ru/"><b>Aliaksei Patskevich</b></a>
  <br />
  <sub>
    <b>Software Engineer</b> • Code, Design & AI
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
  <br />
  <img src="https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white" />
  <img src="https://img.shields.io/badge/Autodesk_Fusion_360-0696D7?style=flat-square&logo=autodesk&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" />
</p>

