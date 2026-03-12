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

Добро пожаловать в **NYX Vox**! Это наш **самый первый проект на Rust** и наши первые шаги в этой экосистеме. Приложение создано для личного ежедневного использования, и так как мы только учимся работать с Rust, нам критически важны ваши замечания, код-ревью и советы по архитектуре!

## 🌟 Наше Видение
NYX Vox — это быстрый, локально-ориентированный и облачно-ускоренный голосовой интерфейс на вашем рабочем столе. Проект стремится быть максимально функциональным, красивым и удобным в повседневной работе. Исходный код открыт для всех желающих.

### 🎙 Движки Распознавания Речи (STT)
1. **CLOUD (Groq) — [Рекомендуется]:** Наш основной выбор. Запускает Whisper Large-v3-Turbo на сверхбыстрых чипах LPU™. Лучший баланс скорости, точности и качества пунктуации.
2. **CLOUD (Deepgram):** Коммерческая модель. Высокая стабильность и отличная фильтрация шумов.
3. **OFFLINE (Whisper):** Локальная обработка `ggml-small.bin` прямо на вашем Mac. Полная приватность без интернета.

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
3. Попробуйте запустить приложение снова.

### 🔐 Права доступа и Безопасность
Для работы NYX Vox требуются права на **Микрофон** и **Универсальный доступ** (для автовставки текста). Мы внедрили нативный Rust-мост для **мониторинга статуса в реальном времени** прямо в панели настроек.

- **Автоматический режим**: Приложение мгновенно видит изменения в настройках системы. Если индикатор стал красным — доступ отозван.
- **Зачем нужен "Сброс разрешений"?**: Иногда macOS «зависает» и перестает передавать события ввода после обновления приложения или смены оборудования. Кнопка **Сбросить** в настройках очищает системный кэш разрешений для NYX Vox и инициирует повторный запрос.

> [!IMPORTANT]
> Из-за отсутствия платной подписи разработчика, macOS может сбрасывать права при каждом ручном обновлении. Если автовставка перестала работать — просто воспользуйтесь кнопкой **Сбросить** в приложении или вручную удалите `NYX Vox` из Системные настройки -> Конфиденциальность -> Универсальный доступ и перезапустите программу.

## 🚀 План развития (Roadmap)
- [x] Базовый пайплайн (Whisper/Groq/Deepgram)
- [x] Современный интерфейс (Glassmorphism)
- [x] Нативная вставка текста (MacOS HID)
- [ ] Кастомные горячие клавиши
- [ ] Локальная история и поиск по текстам
- [ ] **Интеллектуальное AI-форматирование**: Внедрение моделей для исправления грамматики, расстановки пунктуации и удаления слов-паразитов.
- [ ] Мультимодальная обработка (в планах)

> [!TIP]
> **Прозрачность и Доступность API**: В приложении используются современные, бесплатные или условно-бесплатные (Freemium) API модели. Мы выбираем решения вроде **Groq** и **Deepgram** не только из-за их мощности, но и потому, что они позволяют каждому разработчику или пользователю получить доступ к технологиям мирового уровня без огромных затрат.

> [!NOTE]
> Поскольку это наши первые уверенные шаги в экосистеме Rust (Tauri), будем рады любым отзывам и подсказкам для оптимизации архитектуры!

---

## 🤝 Поддержка и Участие
NYX Vox — это проект, создаваемый с душой. Если вы хотите **поддержать проект**, предложить новую функцию, дать совет по коду или сообщить о баге — пожалуйста, свяжитесь со мной! Ваше мнение помогает этому первому эксперименту на Rust вырасти в серьезный инструмент.

Вы можете [Открыть Issue](https://github.com/AVP-Dev/nyx-vox/issues) на GitHub или написать мне напрямую по ссылкам ниже.

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

