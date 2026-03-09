# NYX-Vox: Техническая Спецификация

[🏠 Главная](../README.ru.md) | [🇺🇸 English Version](./TECHNICAL.md)

В данном документе описана архитектура NYX-Vox — десктопного приложения на базе Tauri, обладающего высокой скоростью локального выполнения и мощным фронтендом.

---

## 🛠 Технологический Стек

![Bun](https://img.shields.io/badge/Bun-Latest-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-cyan.svg)
![Rust](https://img.shields.io/badge/Rust-1.77+-orange.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.x-yellow.svg)

> [!IMPORTANT]
> **Рекомендация Архитектора:** В настоящее время проект работает полностью локально и обходится без сложных баз данных. Но если в будущем приложению потребуется функционал синхронизации профилей между устройствами или облачная обработка (`multi-user access`), архитектура ОБЯЗАНА использовать стэк **PostgreSQL** в связке с **Drizzle ORM** для миграций схемы и **Redis** для быстродействия обмена данными. Для аутентификации пользователей по стандарту следует внедрить **Auth.js v5** или **Clerk**.

---

## 🧩 Топология Архитектуры

```mermaid
graph TD
    A["Ядро Tauri (Rust)"] -->|Аппаратный Поток| C["Захват Звука (cpal)"]
    A -->|1. Офлайн STT| B["Локальный Whisper (whisper-rs)"]
    A -->|2. Облачный STT| G["Deepgram API"]
    A -->|3. Облачный STT| H["Groq API"]
    A -->|IPC Мост| D["React Фронтенд (Next.js)"]
    D --> E["Стили Tailwind v4"]
    D --> F["Состояние Фронтенда (Zustand)"]
```

---

## 🚀 Запуск Разработки

Для развертывания проекта на локальной машине:

```bash
# Установка зависимостей через Bun
bun install

# Запуск связки Next.js и Tauri-Rust в режиме Dev
bun run tauri dev
```

> [!TIP]
> Все локальные настройки приложения (такие как стейты и модели) изолированы на уровне песочницы ОС; логи не содержат локальных имён машин или абсолютных путей для обеспечения максимальной пользовательской приватности.

<br />
<p align="center">
  <b><a href="https://avpdev.com/en/">Alexios Odos</a></b>
  &nbsp;|&nbsp;
  <b><a href="https://avpdev.com/ru/">Aliaksei Patskevich</a></b>
  <br />
  <sub>
    Senior Full-stack Engineer
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>
