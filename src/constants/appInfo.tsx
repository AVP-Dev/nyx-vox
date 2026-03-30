import React from 'react';
import { Globe, Github, Send, Instagram, Linkedin } from 'lucide-react';

export const CREATOR_INFO = {
    name: 'Aliaksei Patskevich',
    role: 'Software Engineer • Code, Design & AI',
    initials: 'AVP',
    links: [
        { title: 'avpdev.com', href: 'https://avpdev.com', icon: <Globe className="w-4 h-4" />, color: 'hover:text-sky-400' },
        { title: 'GitHub', href: 'https://github.com/AVP-Dev', icon: <Github className="w-4 h-4" />, color: 'hover:text-white' },
        { title: 'Telegram', href: 'https://t.me/AVP_Dev', icon: <Send className="w-4 h-4" />, color: 'hover:text-sky-400' },
        { title: 'Instagram', href: 'https://instagram.com/avpdev', icon: <Instagram className="w-4 h-4" />, color: 'hover:text-pink-400' },
        { title: 'LinkedIn', href: 'https://www.linkedin.com/in/aliaksei-alexey-patskevich-545586b8', icon: <Linkedin className="w-4 h-4" />, color: 'hover:text-blue-400' },
    ]
};

export const APP_DESCRIPTION = {
    ru: 'Профессиональный инструмент диктовки для macOS. Мгновенно преобразуйте голос в текст с помощью ИИ-движков, сохраняя полную приватность и простоту рабочего процесса.',
    en: 'Professional macOS dictation tool. Instantly convert voice to text using advanced AI engines while maintaining total privacy and a frictionless workflow.'
};

export const MISSION = {
    ru: 'Создать безупречный рабочий процесс, где голос становится основным инструментом ввода. Минимум кликов — максимум продуктивности.',
    en: 'Create a flawless workflow where your voice is the primary input method. Minimal friction — maximum productivity.'
};

export const FUTURE_ITEMS = {
    ru: [
        'Голосовые команды и управление',
        'Мультиплатформенность',
        'Поддержка новых движков',
        '💛 Донаты — поддержите проект!'
    ],
    en: [
        'Voice commands & Mac control',
        'Multi-platform support',
        'New engine support',
        '💛 Donations — support the project!'
    ]
};

export const ENGINE_HELP = {
    ru: {
        deepgram: {
            title: 'Deepgram',
            badge: 'Рекомендуем',
            type: 'Условно-бесплатно',
            desc: 'Мгновенная коммерческая модель. Идеально расставляет знаки препинания и отлично фильтрует шум. При регистрации дают $200 кредитов (хватает на ~200 часов).',
        },
        groq: {
            title: 'Groq',
            badge: 'Сверхбыстро',
            type: 'Бесплатно (Бета)',
            desc: 'Использует LPU™ ускорение для запуска Whisper Large-v3-Turbo. Безумная скорость обработки. На данный момент бесплатно (действуют лимиты запросов в минуту).',
        },
        gemini: {
            title: 'Gemini',
            badge: 'Мультимодальность',
            type: 'Бесплатно / Лимиты',
            desc: 'Модель от Google с глубоким пониманием контекста. ПРЕДУПРЕЖДЕНИЕ: В ряде стран (РФ, РБ и др.) для работы API требуется VPN.',
        },
        whisper: {
            title: 'Offline Whisper',
            badge: 'Приватность',
            type: 'Бесплатно',
            desc: 'Работает полностью локально на вашем Mac. Не требует интернета. Скорость зависит от процессора (оптимизировано для Apple Silicon).',
        },
        qwen: {
            title: 'Qwen (Alibaba)',
            badge: 'SOTA',
            type: 'Бесплатно / Лимиты',
            desc: 'Мощная модель от Alibaba Cloud (DashScope). Отлично справляется с русским языком. Ключ можно получить в консоли DashScope.',
        },
        formatting: {
             title: 'Форматирование (LLM)',
             desc: 'Второй проход через нейросеть (Gemini/Qwen/DeepSeek). Исправляет ошибки, убирает «эээ/ммм» и делает текст логичным. ПОДСКАЗКА: В системе используется модель deepseek-chat как самая быстрая и стабильная.'
        }
    },
    en: {
        deepgram: {
            title: 'Deepgram',
            badge: 'Recommended',
            type: 'Freemium',
            desc: 'Instant commercial model. Perfect punctuation and ultimate noise filtering. Grants $200 credits upon signup (~200 hours).',
        },
        groq: {
            title: 'Groq',
            badge: 'Ultra Fast',
            type: 'Free (Beta)',
            desc: 'Uses LPU™ acceleration for Whisper Large-v3-Turbo. Blazing processing speeds. Currently free (rate limits apply).',
        },
        gemini: {
            title: 'Gemini',
            badge: 'Advanced',
            type: 'Free Tier',
            desc: 'Google AI with deep context understanding. NOTE: VPN may be required for API access in certain regions.',
        },
        qwen: {
            title: 'Qwen (Alibaba)',
            badge: 'SOTA',
            type: 'Free Tier',
            desc: 'State-of-the-art model from Alibaba Cloud (DashScope). Excellent multilingual support. Get keys at DashScope console.',
        },
        whisper: {
             title: 'Offline Whisper',
             badge: 'Privacy',
             type: 'Free',
             desc: 'Runs locally on your Mac. No internet required. Speed depends on CPU/GPU (optimized for Apple Silicon).',
        },
        formatting: {
             title: 'AI Formatting (LLM)',
             desc: 'A second pass via LLM (Gemini/Qwen/DeepSeek) to refine grammar, remove fillers like "um/so", and fix punctuation. TIP: We use deepseek-chat for the best speed/accuracy balance.'
        }
    }
};
