<div align="center">
  <img src="./branding/app-icon-safe.png" width="104" height="104" alt="Логотип NYX Vox" />
  <h1>NYX Vox</h1>
  <p><strong>Премиальный голосовой интерфейс с нулевой задержкой для macOS</strong></p>

  <p>
    <a href="https://github.com/AVP-Dev/nyx-vox/releases/latest"><img src="https://img.shields.io/github/v/release/AVP-Dev/nyx-vox?label=%D0%A1%D0%BA%D0%B0%D1%87%D0%B0%D1%82%D1%8C%20DMG&style=for-the-badge&color=orange" alt="Скачать свежий DMG" /></a>
    <img src="https://img.shields.io/badge/%D0%9F%D0%BB%D0%B0%D1%82%D1%84%D0%BE%D1%80%D0%BC%D0%B0-macOS%2014%2B%20(Apple%20Silicon%20%26%20Intel)-black?style=for-the-badge&logo=apple" alt="macOS" />
    <img src="https://img.shields.io/badge/Rust-2021%20%7C%20Tauri%202.10-orange?style=for-the-badge&logo=rust" alt="Rust Tauri" />
  </p>

  <p>
    <a href="https://avp-dev.github.io/nyx-vox/" target="_blank" rel="noopener noreferrer">🌐 Интерактивный Лендинг</a> &nbsp;&bull;&nbsp;
    <a href="./README.md">🇬🇧 Read in English</a> &nbsp;&bull;&nbsp;
    <a href="./docs/TECHNICAL.ru.md" target="_blank" rel="noopener noreferrer">⚙️ Технические детали</a> &nbsp;&bull;&nbsp;
    <a href="./docs/CHANGELOG.ru.md" target="_blank" rel="noopener noreferrer">📝 История изменений</a>
  </p>
</div>

---

## ⚡ Что такое NYX Vox?

**NYX Vox** — это нативное macOS-приложение, созданное для того, чтобы сделать ваш голос главным и самым быстрым способом ввода в любых программах. Нажмите горячую клавишу или кнопку записи, говорите естественно — слова появляются на лету с живой анимацией звуковой волны, расшифровываются с задержкой менее 500 мс, форматируются **100% дословным ИИ** (без галлюцинаций, искажений и замены синонимами) и **автоматически вставляются прямо в активное приложение** (VS Code, Telegram, Slack, Notion, Obsidian или браузер) без необходимости прикасаться к мыши или нажимать Cmd+V.

Приложение написано на **Rust 2021 (Tauri 2)** и **Next.js 16 / React 19**, работает быстро и плавно, использует современную эстетику Glassmorphism и гарантирует безопасность ваших данных.

---

## 🚀 Как это устроено (Пайплайн работы)

```mermaid
graph LR
    subgraph Step1 ["1. Захват звука и VAD"]
        MIC["🎙 Микрофон (cpal)"] --> VAD["Умный VAD & Шумодав"]
        VAD --> BUFF["300 мс Pre-speech FIFO буфер"]
    end

    subgraph Step2 ["2. Сверхбыстрый STT"]
        BUFF --> CLOUD["⚡ Облачный LPU: Groq Whisper Turbo (~500 мс)<br/>Deepgram Nova-2 / Gemini / GigaChat"]
        BUFF -.-> LOCAL["🔒 Офлайн: Локальный Whisper<br/>(ускорение Metal и Core ML)"]
    end

    subgraph Step3 ["3. 100% Дословный ИИ"]
        CLOUD --> LLM["✨ Дословная пунктуация и структура<br/>(Gemini / DeepSeek / Qwen / GigaChat)"]
        LOCAL --> LLM
    end

    subgraph Step4 ["4. Мгновенная автовставка"]
        LLM --> PASTE["🚀 Прямой HID-ввод через<br/>macOS Accessibility в активное окно"]
        LLM --> CLIP["📋 Буфер обмена и Локальная история"]
    end

    style Step1 fill:#121218,stroke:#f97316,stroke-width:2px,color:#fff
    style Step2 fill:#121218,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Step3 fill:#121218,stroke:#10b981,stroke-width:2px,color:#fff
    style Step4 fill:#121218,stroke:#a855f7,stroke-width:2px,color:#fff
```

### 🛡️ Многоуровневая отказоустойчивость (Multi-Tier Fallback)
Архитектура NYX Vox построена по принципу **движко-независимой сохранности данных** — надиктованный текст **никогда не теряется**:
1. **Уровень STT**: Если сетевой стриминг прервался на длинной фразе из-за сетевого спайка, система моментально запускает полный батч-STT прогон сохраненного аудиофайла.
2. **Уровень AI**: Если сервис форматирования перегружен или исчерпал лимиты квот (429/503), приложение пробует авто-повтор, а в случае неудачи **не сбрасывает текст**, а сразу отдает сырой исходный результат транскрибации.
3. **Уровень вставки ОС**: Если в macOS отозваны права Accessibility, окно результата не закрывается впустую, а отображает кнопку копирования текста в один клик.

---

## 🎙️ Матрица сравнения STT-движков

Используйте собственные API-ключи (защищены аппаратным шифрованием AES-256-GCM) или запускайте полностью локальные модели без интернета:

| Движок | Тип | Задержка | Приватность | Квоты / Стоимость | Идеально подходит для |
|---|---|---|---|---|---|
| **Groq LPU™** | Cloud LPU | **~500 мс** | Стандартная | Щедрый бесплатный тир | **[Рекомендуется]** Повседневная работа, максимальная скорость |
| **Whisper Local** | On-Device | **~1.2 – 2.0 с** | **100% Приватно** | Бесплатно навсегда | Конфиденциальные данные, работа в поездках/без сети |
| **Sber GigaChat** | Cloud AI | **~700 мс** | Российский контур | Бесплатно разработчикам | Русскоязычная диктовка, работает в РФ без VPN |
| **Google Gemini** | Multimodal | **~800 мс** | Google Cloud | Бесплатные квоты AI Studio | Сложный синтаксис кода, смешанные языки |
| **Deepgram Nova** | Cloud STT | **~600 мс** | Корпоративная | $200 кредитов на старте | Шумные помещения, акустическая изоляция |

<details>
<summary><b>🔑 Как получить бесплатные API-ключи за 2 минуты</b></summary>

- **Groq**: Зайдите на [console.groq.com/keys](https://console.groq.com/keys) → Нажмите "Create API Key", назовите `NYX-Vox` и скопируйте.
- **Google Gemini**: Перейдите в [aistudio.google.com](https://aistudio.google.com/) → Нажмите "Get API Key" → Create Key.
- **Deepgram**: Зарегистрируйтесь на [console.deepgram.com](https://console.deepgram.com/) → Получите $200 на баланс → Создайте ключ.
- **GigaChat (SberAI)**: Перейдите на [developers.sber.ru](https://developers.sber.ru/) → Создайте проект GigaChat API → Скопируйте Client ID и Client Secret.
</details>

---

## 🖼️ Витрина и скриншоты приложения

> *Интерфейс спроектирован в стиле Glassmorphism: полупрозрачные стеклянные панели, динамические размеры и круглый компактный бабл в режиме покоя.*

<div align="center">
  <table>
    <tr>
      <td width="50%" align="center">
        <strong>01. Плавающий виджет и звуковая волна</strong><br/>
        <sub>Пульсирующая запись, 9-полосный эквалайзер и живой бегущий стриминг</sub><br/><br/>
        <img src="./docs/screenshots/01-hero-recording.png" alt="Режим записи" width="100%" onerror="this.onerror=null; this.src='./branding/app-icon-safe.png';" />
      </td>
      <td width="50%" align="center">
        <strong>02. Карточка результата и автовставка</strong><br/>
        <sub>100% дословный текст, пунктуация и вставка в активное приложение в один клик</sub><br/><br/>
        <img src="./docs/screenshots/02-result-autopaste.png" alt="Окно результата" width="100%" onerror="this.onerror=null; this.src='./branding/app-icon-safe.png';" />
      </td>
    </tr>
    <tr>
      <td width="50%" align="center">
        <strong>03. Центр управления движками и LLM</strong><br/>
        <sub>Мгновенное переключение Groq, Deepgram, Gemini, GigaChat и офлайн Whisper</sub><br/><br/>
        <img src="./docs/screenshots/05-engines-hub.png" alt="Вкладка движков" width="100%" onerror="this.onerror=null; this.src='./branding/app-icon-safe.png';" />
      </td>
      <td width="50%" align="center">
        <strong>04. Аппаратно-защищенное хранилище ключей</strong><br/>
        <sub>Шифрование AES-256-GCM с привязкой к machine-id (ключи не передаются в облако)</sub><br/><br/>
        <img src="./docs/screenshots/06-encrypted-keys.png" alt="Вкладка ключей" width="100%" onerror="this.onerror=null; this.src='./branding/app-icon-safe.png';" />
      </td>
    </tr>
  </table>
</div>

---

## ✨ Ключевые возможности

- ⚡ **Универсальный Live-стриминг**: отображение промежуточных фраз на лету с активным курсором во всех STT-движках.
- 🎯 **100% Дословное AI-форматирование**: строгий системный промпт запрещает искажать слова, додумывать факты или заменять термины синонимами, аккуратно расставляя пунктуацию, абзацы и верный регистр букв.
- 🧠 **Поддержка множества LLM**: форматирование через Gemini, DeepSeek V3, Qwen 2.5, Groq Llama или GigaChat.
- 🎙️ **Умный VAD (автостоп по тишине)**: настраиваемый таймер паузы (3.0–15.0 сек) с калибруемым шумодавом (Noise Gate) и множителем усиления микрофона.
- 🚀 **Нативная автовставка macOS (HID)**: текст мгновенно вводится в окно, в котором вы только что работали, через Accessibility API.
- 🔒 **Защищенный сейф API-ключей**: локальное шифрование AES-256-GCM с уникальным аппаратным отпечатком устройства.
- 🫧 **Компактный режим (Bubble Mode)**: в режиме ожидания окно сворачивается в круглый минималистичный пузырь у меню-бара.
- 📂 **Локальная история с поиском**: сохранение всех диктовок с указанием времени, длительности и использованного движка.
- 🔇 **Защита от галлюцинаций**: аппаратная обрезка пауз тишины (`trim_silence`) и авто-пауза мультимедиа во время диктовки.

---

## 📦 Установка и запуск

1. **Скачивание**: Возьмите свежий `.dmg` на странице [Релизов](https://github.com/AVP-Dev/nyx-vox/releases/latest).
2. **Установка**: Откройте скачанный `.dmg` и перетащите **NYX Vox** в папку `Applications` (Программы).
3. **Запуск**: Запустите приложение из папки Программы.

### 🛠️ Решение проблем: Ошибка macOS «Приложение повреждено»
Поскольку NYX Vox распространяется как бесплатный Open Source проект без платной подписки Apple Developer, Gatekeeper macOS может заблокировать первый запуск. Откройте **Терминал** и выполните команду:

```bash
xattr -cr /Applications/NYX\ Vox.app
```

Затем откройте приложение повторно.

### 🔐 Мониторинг системных разрешений
Для работы приложению требуются разрешения на **Микрофон** и **Универсальный доступ** (для эмуляции клавиатурного ввода):
- **Индикаторы статуса**: Панель настроек в реальном времени отображает зелёные/красные бейджи прав системы.
- **Кнопка сброса прав**: Если после обновления macOS события ввода перестали передаваться, используйте кнопку **Сбросить** в Настройках для очистки системного кэша разрешений.

---

## ⌨️ Горячие клавиши

| Сочетание | Действие | Где работает |
|---|---|---|
| `⌥ + Space` (Option + Пробел) | Включение / остановка записи | Глобально в любом приложении |
| `Enter` | Отправить / вставить текст в активное окно | В окне NYX Vox |
| `Esc` | Отмена записи / сброс текста | В окне NYX Vox |
| `Cmd + C` | Копировать распознанный текст | В окне NYX Vox |

---

## 🚀 План развития (Roadmap)

**Готово в релизе v1.4.0:**
- [x] Мульти-движковый пайплайн STT (Whisper офлайн / Groq / Deepgram / Gemini / GigaChat)
- [x] Универсальный live-стриминг фраз на лету
- [x] 100% Дословное AI-форматирование (Gemini, DeepSeek, Qwen, Groq, GigaChat)
- [x] Слот для ввода кастомных ID моделей LLM
- [x] Умный VAD-автостоп по тишине (3.0–15.0 сек) и калибровка Noise Gate
- [x] Стеклянный интерфейс Glassmorphism и режим круглого пузыря (Bubble)
- [x] Нативная вставка текста в macOS с мониторингом прав
- [x] Локальный зашифрованный сейф ключей (AES-256-GCM)
- [x] Локальная история с мгновенным поиском

**В планах:**
- [ ] **Транскрипция аудиофайлов** — drag & drop аудиофайлов для пакетного распознавания
- [ ] **Запись системного звука (созвоны)** — запись входящего аудио с разделением собеседников (диаризация)
- [ ] **Кастомный конструктор горячих клавиш** — переназначение шорткатов
- [ ] **Экспорт истории** — выгрузка в Markdown, TXT и JSON
- [ ] **Выбор микрофона** — выбор конкретного устройства аудиоввода в Настройках
- [ ] **Пользовательский словарь терминов** — специализированная лексика, сленг и имена

---

## 🤝 Поддержка и Участие

NYX Vox — открытый проект, создаваемый с душой **Алексеем Пацкевичем (AVPDev)** как личный инструмент ежедневного использования и исследовательский путь в экосистему Rust и системное аудио.

Если у вас есть идеи, рекомендации по архитектуре, замечания по код-ревью или сообщения об ошибках — будем рады [Созданному Issue](https://github.com/AVP-Dev/nyx-vox/issues) или прямому сообщению:

<p align="center">
  <a href="https://avpdev.com/ru/"><b>Алексей Пацкевич (AVPDev)</b></a>
  <br />
  <sub>
    <b>AI Solutions Architect</b> • Код, Дизайн и ИИ
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-DEA584?style=flat-square&logo=rust&logoColor=black" alt="Rust" />
  <img src="https://img.shields.io/badge/Tauri_2-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>
