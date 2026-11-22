import React from 'react';
import { Globe, Github, Send, Instagram, Linkedin, Bug, Download } from 'lucide-react';

export const PROJECT_LINKS = [
    { title: 'Официальный сайт', titleEn: 'Official Website', href: 'https://nyx-vox.avpdev.com', icon: <Globe className="w-4 h-4" />, color: 'hover:text-orange-400' },
    { title: 'Репозиторий GitHub', titleEn: 'GitHub Repository', href: 'https://github.com/AVP-Dev/nyx-vox', icon: <Github className="w-4 h-4" />, color: 'hover:text-white' },
    { title: 'История версий (Releases)', titleEn: 'Releases & Changelog', href: 'https://github.com/AVP-Dev/nyx-vox/releases', icon: <Download className="w-4 h-4" />, color: 'hover:text-emerald-400' },
    { title: 'Сообщить об ошибке', titleEn: 'Report an Issue', href: 'https://github.com/AVP-Dev/nyx-vox/issues', icon: <Bug className="w-4 h-4" />, color: 'hover:text-red-400' },
];

export const CREATOR_INFO = {
    name: 'Aliaksei Patskevich',
    role: 'Modern Web Architect • Code, Design & AI',
    initials: 'AVP',
    links: [
        { title: 'avpdev.com', href: 'https://avpdev.com', icon: <Globe className="w-4 h-4" />, color: 'hover:text-sky-400' },
        { title: 'GitHub (AVP-Dev)', href: 'https://github.com/AVP-Dev', icon: <Github className="w-4 h-4" />, color: 'hover:text-white' },
        { title: 'Telegram (@AVP_Dev)', href: 'https://t.me/AVP_Dev', icon: <Send className="w-4 h-4" />, color: 'hover:text-sky-400' },
        { title: 'Instagram', href: 'https://instagram.com/avpdev', icon: <Instagram className="w-4 h-4" />, color: 'hover:text-pink-400' },
        { title: 'LinkedIn', href: 'https://www.linkedin.com/in/aliaksei-alexey-patskevich-545586b8', icon: <Linkedin className="w-4 h-4" />, color: 'hover:text-blue-400' },
    ]
};

export const APP_DESCRIPTION = {
    ru: 'Профессиональный инструмент диктовки для macOS и Windows. Мгновенно преобразуйте голос в текст с помощью 9 передовых STT-движков, сохраняя полную приватность и простоту рабочего процесса.',
    en: 'Professional dictation tool for macOS and Windows. Instantly convert voice to text using 9 cutting-edge STT engines while maintaining total privacy and a frictionless workflow.'
};

export const MISSION = {
    ru: 'Создать безупречный рабочий процесс, где голос становится основным инструментом ввода. Минимум кликов — максимум продуктивности.',
    en: 'Create a flawless workflow where your voice is the primary input method. Minimal friction — maximum productivity.'
};

export const FUTURE_ITEMS = {
    ru: [
        'Транскрипция аудиофайлов (drag & drop)',
        'Запись системного аудио (звонки/созвоны) с ролевой транскрипцией',
        'Кастомные глобальные горячие клавиши',
        'Экспорт истории (TXT/MD/JSON)',
        'Выбор конкретного микрофона из настроек',
        'Фоновое автообновление (silent background updates)',
        'Пользовательский словарь терминов',
        'Кроссплатформенность (Linux)',
        '💛 Донаты — поддержите проект!'
    ],
    en: [
        'Audio file transcription (drag & drop)',
        'System audio capture (calls) with speaker-diarized transcription',
        'Custom global shortcuts',
        'History export (TXT/MD/JSON)',
        'Microphone selection in settings',
        'Silent background updates',
        'Custom vocabulary dictionary',
        'Cross-platform (Linux)',
        '💛 Donations — support the project!'
    ]
};

export const ENGINE_HELP = {
    ru: {
        deepgram: {
            title: 'Deepgram Nova',
            badge: 'Рекомендуем',
            type: 'Условно-бесплатно',
            desc: 'Мгновенная коммерческая модель. Идеально расставляет знаки препинания и отлично фильтрует шум. При регистрации дают $200 кредитов (хватает на ~200 часов).',
        },
        groq: {
            title: 'Groq LPU™',
            badge: 'Сверхбыстро',
            type: 'Бесплатно (Бета)',
            desc: 'Использует LPU™ ускорение для запуска Whisper Large-v3-Turbo. Задержка менее 500 мс. Действуют лимиты запросов в минуту.',
        },
        elevenlabs: {
            title: 'ElevenLabs Scribe',
            badge: 'Рекомендуем · 1.6.0',
            type: 'Freemium',
            desc: 'Потоковое мультиязычное распознавание речи высочайшей точности с автоматическим пакетным резервом.',
        },
        speechmatics: {
            title: 'Speechmatics Melia',
            badge: 'Рекомендуем · 1.6.0',
            type: 'Freemium',
            desc: 'Модель Melia 1 с поддержкой подсказок для русского и английского языков в реальном времени.',
        },
        azure_speech: {
            title: 'Azure Speech (Foundry)',
            badge: 'Облако · 1.6.0',
            type: 'Лимиты Azure',
            desc: 'Потоковое MAI Transcribe через настроенный endpoint и deployment в Microsoft Foundry.',
        },
        nvidia: {
            title: 'NVIDIA Build',
            badge: 'Пакетный · 1.6.0',
            type: 'API Ключ',
            desc: 'Пакетное распознавание по UUID функции NVCF. Публичная модель Parakeet поддерживает только английский.',
        },
        gigachat: {
            title: 'Sber GigaChat',
            badge: 'РФ / Без VPN',
            type: 'Бесплатно / Лимиты',
            desc: 'Распознавание речи и ИИ-форматирование от Сбера с поддержкой сертификатов Минцифры без VPN.',
        },
        gemini: {
            title: 'Google Gemini',
            badge: 'Мультимодальность',
            type: 'Бесплатно / Лимиты',
            desc: 'Модель от Google с глубоким пониманием контекста. В РФ и РБ для работы API может требоваться VPN.',
        },
        whisper: {
            title: 'Whisper Local',
            badge: 'Приватность',
            type: 'Бесплатно',
            desc: 'Работает полностью локально на устройстве без интернета. Поддерживает ускорение Metal/CoreML на Mac и DirectML/CPU на Windows.',
        },
        qwen: {
            title: 'Qwen (Alibaba)',
            badge: 'SOTA',
            type: 'Бесплатно / Лимиты',
            desc: 'Мощная модель от Alibaba Cloud (DashScope). Отлично справляется с русским языком. Ключ в консоли DashScope.',
        },
        formatting: {
             title: 'ИИ-Форматирование (LLM)',
             desc: 'Второй проход через нейросеть (DeepSeek, Qwen, Gemini, GigaChat или Groq). Исправляет опечатки, пунктуацию и структурирует абзацы.'
        }
    },
    en: {
        deepgram: {
            title: 'Deepgram Nova',
            badge: 'Recommended',
            type: 'Freemium',
            desc: 'Instant commercial model. Perfect punctuation and ultimate noise filtering. Grants $200 credits upon signup (~200 hours).',
        },
        groq: {
            title: 'Groq LPU™',
            badge: 'Ultra Fast',
            type: 'Free (Beta)',
            desc: 'Uses LPU™ acceleration for Whisper Large-v3-Turbo. Sub-500ms processing speed. Rate limits apply.',
        },
        elevenlabs: {
            title: 'ElevenLabs Scribe',
            badge: 'Recommended · 1.6.0',
            type: 'Freemium',
            desc: 'Realtime high-accuracy multilingual recognition with automatic batch fallback.',
        },
        speechmatics: {
            title: 'Speechmatics Melia',
            badge: 'Recommended · 1.6.0',
            type: 'Freemium',
            desc: 'Melia 1 realtime speech recognition with Russian and English language hints.',
        },
        azure_speech: {
            title: 'Azure Speech (Foundry)',
            badge: 'Cloud · 1.6.0',
            type: 'Azure Tier',
            desc: 'Realtime MAI Transcribe through configured Microsoft Foundry endpoint and deployment.',
        },
        nvidia: {
            title: 'NVIDIA Build',
            badge: 'Batch · 1.6.0',
            type: 'API Key',
            desc: 'Batch recognition using an NVCF function UUID. The public Parakeet model supports English only.',
        },
        gigachat: {
            title: 'Sber GigaChat',
            badge: 'No VPN (RU)',
            type: 'Free Tier',
            desc: 'SberAI speech recognition and text formatting with Russian Trusted CA certificates.',
        },
        gemini: {
            title: 'Google Gemini',
            badge: 'Multimodal',
            type: 'Free Tier',
            desc: 'Google AI with deep context understanding. NOTE: VPN may be required for API access in certain regions.',
        },
        whisper: {
             title: 'Whisper Local',
             badge: 'Privacy',
             type: 'Free',
             desc: 'Runs locally on your computer. No internet required. Optimized for Apple Silicon (Metal/CoreML) and Windows.',
        },
        qwen: {
            title: 'Qwen (Alibaba)',
            badge: 'SOTA',
            type: 'Free Tier',
            desc: 'State-of-the-art model from Alibaba Cloud (DashScope). Excellent multilingual support. Get keys at DashScope console.',
        },
        formatting: {
             title: 'AI Formatting (LLM)',
             desc: 'A second pass via LLM (DeepSeek, Qwen, Gemini, GigaChat, or Groq) to refine grammar, punctuation, and structure.'
        }
    }
};
