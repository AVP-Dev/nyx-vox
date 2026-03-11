"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
    X, Info, BookOpen, Settings2, Mic, Copy, Send,
    Keyboard, Globe, Zap, ChevronRight, ExternalLink,
    Github, MessageCircle, Instagram, Linkedin, Expand,
    Wifi, HardDrive, Download, Eye, EyeOff, Loader2, Check,
    CloudDownload, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { FeedbackModal } from '@/components/FeedbackModal';

type Tab = 'guide' | 'settings' | 'about';
type Lang = 'ru' | 'en';

interface SettingsPanelProps {
    onClose: () => void;
    autoPaste: boolean;
    clearOnPaste: boolean;
    onToggleAutoPaste: () => void;
    onToggleClearOnPaste: () => void;
    startMinimized: boolean;
    onToggleStartMinimized: () => void;
    alwaysOnTop: boolean;
    onToggleAlwaysOnTop: () => void;
}

export const CONTENT = {
    ru: {
        guide: {
            title: 'Инструкция',
            steps: [
                {
                    icon: <Keyboard className="w-4 h-4" />,
                    head: 'Option + Space',
                    body: 'Глобальный хоткей. Суммонит окно из любого места. Повторное нажатие останавливает запись и выдает результат.'
                },
                {
                    icon: <Mic className="w-4 h-4" />,
                    head: 'Голосовой ввод',
                    body: 'Нажмите для старта. Компактный "pill-интерфейс" визуализирует ваш голос и процесс транскрипции в реальном времени.'
                },
                {
                    icon: <Send className="w-4 h-4" />,
                    head: 'Вставить в приложение',
                    body: 'Мгновенно отправляет текст в активное окно. Работает через нативные события HID (требуется Универсальный доступ).'
                },
                {
                    icon: <Copy className="w-4 h-4" />,
                    head: 'Буфер обмена',
                    body: 'Копирует весь распознанный текст. Позволяет быстро перенести результат в мессенджер или редактор кода.'
                },
                {
                    icon: <Expand className="w-4 h-4" />,
                    head: 'Расширенный вид',
                    body: 'Кликните по тексту, чтобы развернуть окно. Здесь можно отредактировать результат перед отправкой.'
                },
                {
                    icon: <X className="w-4 h-4" />,
                    head: 'Умный сброс',
                    body: 'Текст очищается автоматически при каждом новом старте. Либо удалите его вручную через крестик.'
                },
            ],
            tips: [
                'Держите паузы минимальными — современные движки отлично справляются с быстрой речью.',
                'В режиме "Офлайн" первый запуск может занять пару секунд для инициализации модели.',
                'Используйте Groq для максимальной скорости или Deepgram для лучшей пунктуации.',
            ]
        },
        about: {
            title: 'О приложении',
            app: 'NYX VOX',
            version: 'v0.1.2-beta',
            desc: 'Профессиональный инструмент диктовки для macOS, стирающий границы между мыслью и текстом. Преобразуйте голос в текст мгновенно с помощью AI-движков Deepgram, Groq или локального Whisper.',
            author: 'Разработчик',
            mission: 'Миссия',
            missionText: 'Создать бесшовный рабочий процесс, где ваш голос становится основным инструментом ввода. Никаких лишних действий — только вы и ваши идеи.',
            stack: 'Стек технологий',
            future: 'Скоро',
            futureItems: ['История диктовок', 'Настраиваемые горячие клавиши', 'Поддержка Windows', '💛 Донаты — help us!']
        },
        settings: {
            title: 'Настройки',
            behavior: 'Поведение',
            autoPaste: 'Авто-вставка',
            autoPasteDesc: 'Вставлять текст автоматически после остановки записи',
            clearOnPaste: 'Очищать после вставки',
            clearOnPasteDesc: 'Удалять текст из поля после успешной вставки',
            startMinimized: 'Запуск в свернутом виде',
            startMinimizedDesc: 'При запуске приложение будет только в трее',
            alwaysOnTop: 'Поверх всех окон',
            alwaysOnTopDesc: 'Окно всегда будет видно поверх остальных',
            autoPause: 'Авто-пауза медиа',
            autoPauseDesc: 'Ставить медиа на паузу во время диктовки',
            autoPauseBrowserTitle: 'Для браузеров',
            autoPauseBrowserDesc: 'Чтобы пауза работала в Chrome и Safari, нужно разрешить JS из Apple Events:',
            autoPauseBrowserChrome: 'Chrome → View → Developer → Allow JavaScript from Apple Events',
            autoPauseBrowserSafari: 'Safari → Develop → Allow JavaScript from Apple Events',
            autoPauseBrowserNote: 'Music и Spotify работают без дополнительных настроек.',
            autoPauseBrowserFixBtn: 'Разрешить автоматически (Beta)',
            autoPauseBrowserFixSuccess: 'Готово! Перезапустите браузеры.',
            accessibility: 'macOS: Универсальный доступ',
            accessibilityDesc: 'Для автовставки необходимо разрешение «Универсальный доступ» для NYX Vox.',
            accessibilityBtn: 'Открыть настройки',
            sttMode: 'Движок распознавания',
            sttLanguage: 'Язык распознавания',
            langAuto: 'Авто',
            langRu: 'Русский',
            langEn: 'Английский',
            deepgramLabel: 'Deepgram',
            deepgramDesc: 'Облако · мгновенно · пунктуация',
            whisperLabel: 'Офлайн',
            whisperDesc: 'Whisper · без интернета · медленнее',
            apiKeyLabel: 'API ключ Deepgram',
            apiKeyPlaceholder: 'Вставьте ваш ключ...',
            apiKeySave: 'Сохранить',
            apiKeyHowTo: 'Как получить ключ:',
            apiKeyStep1: 'Зарегистрируйтесь на',
            apiKeyStep2: 'Перейдите в Settings → API Keys',
            apiKeyStep3: 'Нажмите Create a New API Key',
            apiKeyStep4: 'Скопируйте ключ и вставьте выше',
            apiKeyFree: '💡 Бесплатно: $200 кредитов (~200 часов)',
            checkUpdates: 'Проверить обновления',
            updateAvailable: 'Доступна новая версия!',
            noUpdate: 'У вас последняя версия',
            checking: 'Проверка...',
            modelStatus: 'Офлайн модель',
            modelInstalled: 'Модель установлена',
            modelNotFound: 'Модель не найдена',
            modelDownload: 'Скачать',
            modelDownloading: 'Загрузка...',
            modelSize: '~500 MB',
            groqLabel: 'Groq',
            groqDesc: 'LPU ускорение · Whisper Large v3 · сверхбыстро',
            groqApiKeyLabel: 'API ключ Groq',
            groqHowTo: 'Бесплатный ключ на console.groq.com',
            faqTitle: 'Отличия движков (FAQ)',
            faqDeepgram: 'Deepgram (Рекомендуется) — мгновенная коммерческая модель. Идеально расставляет знаки препинания и отлично фильтрует шум.',
            faqGroq: 'Groq — использует архитектуру LPU для запуска Whisper-Large-v3-Turbo. Безумная скорость обработки больших блоков текста.',
            faqWhisper: 'Офлайн Whisper — компактная модель 500MB (small). Работает без интернета, оптимальна для Apple Silicon. В этом режиме не рекомендуется использовать функцию "Авто" (могут быть задержки).',
        },
        welcome: {
            title: 'Добро пожаловать в NYX Vox!',
            subtitle: 'Голосовое управление будущим уже на твоем Mac.',
            permTitle: 'Конфиденциальность и права',
            permAccess: 'Универсальный доступ',
            permAccessDesc: 'Необходим для имитации нажатия ⌘V и мгновенной вставки текста.',
            permMic: 'Доступ к микрофону',
            permMicDesc: 'Разрешение требуется для захвата и нейросетевой обработки речи.',
            openSettings: 'Настройки',
            faqTitle: 'Часто задаваемые вопросы',
            faqQ1: 'Как начать использовать?',
            faqA1: '⌥ Option + Space — твой главный инструмент. Нажми один раз для старта, и второй раз для завершения и вставки готового текста.',
            faqQ2: 'Мои данные под защитой?',
            faqA2: 'Да. В режиме "Офлайн" обработка идет локально. В облачных режимах данные защищены TLS и не используются для обучения нейросетей.',
            faqQ3: 'Какой режим распознавания выбрать?',
            faqA3: 'Deepgram — идеален для диалогов и шума. Офлайн Whisper — для полной приватности (установите один язык (RU или EN) во избежание артефактов).',
            faqQ4: 'Зачем нужны разрешения?',
            faqA4: 'Без "Доступа" приложение не сможет напечатать текст за тебя, а без "Микрофона" — услышать. При обновлении вручную macOS сбрасывает права — удали (-) и добавь (+) приложение в настройках заново.',
            updateWarningTitle: 'Обновляетесь с GitHub?',
            updateWarning: 'macOS сбросит ваши права "Универсального доступа". Зайдите в системные настройки, удалите NYX Vox кнопкой минус (-) и добавьте его заново.',
            troubleshootTitle: 'Техническая помощь',
            fixQuarantine: 'Ошибка: "Файл поврежден"',
            fixQuarantineDesc: 'macOS защищает тебя от стороннего софта. Твой билд v0.1.2-beta проверен — просто убери флаг блокировки кнопкой ниже.',
            fixBtn: 'СНЯТЬ БЛОКИРОВКУ',
            dontShow: 'Больше не показывать',
            startBtn: 'ПОЕХАЛИ!',
        },
        update: {
            title: 'Интересно! Новая версия!',
            desc: 'Мы нашли обновление для NYX Vox. Рекомендуем скачать её для стабильной работы и новых функций.',
            notes: 'Что нового:',
            later: 'Позже',
            download: 'Скачать сейчас',
        }
    },
    en: {
        guide: {
            title: 'User Guide',
            steps: [
                {
                    icon: <Keyboard className="w-4 h-4" />,
                    head: 'Option + Space',
                    body: 'Global shortcut. Works from anywhere. Quickly summons the NYX VOX overlay.'
                },
                {
                    icon: <Mic className="w-4 h-4" />,
                    head: 'Mic Button',
                    body: 'Tap to start recording. The compact bar will show real-time voice animations.'
                },
                {
                    icon: <Send className="w-4 h-4" />,
                    head: 'Paste (Arrow)',
                    body: 'Hides the overlay and auto-pastes text into your active window. Requires macOS Accessibility permission.'
                },
                {
                    icon: <Copy className="w-4 h-4" />,
                    head: 'Copy',
                    body: 'Copies the transcribed text to your clipboard instantly.'
                },
                {
                    icon: <Expand className="w-4 h-4" />,
                    head: 'Expand Text',
                    body: 'Click the text snippet or the down arrow to expand the bar and see your full transcribed text.'
                },
                {
                    icon: <X className="w-4 h-4" />,
                    head: 'Smart Clear',
                    body: 'Text clears automatically when you start a new recording. Or clear it manually using the X button.'
                },
            ],
            tips: [
                'Speak clearly in short sentences — helps Whisper place punctuation correctly.',
                'For paste to work on macOS, grant Accessibility access to NYX Vox in System Settings.',
                'The collapsed view acts as a minimal status bar to save screen real-estate.',
            ]
        },
        about: {
            title: 'About',
            app: 'NYX VOX',
            version: 'v0.1.2-beta',
            desc: 'A premium macOS dictation tool bridging the gap between thought and text. Convert voice to text instantly using Deepgram, Groq, or offline Whisper AI engines.',
            author: 'Developer',
            mission: 'Mission',
            missionText: 'To create a seamless workflow where your voice is the primary input method. Zero friction — just you and your ideas.',
            stack: 'Tech Stack',
            future: 'Coming Soon',
            futureItems: ['Dictation history', 'Custom hotkeys', 'Windows support', '💛 Donations — help us!']
        },
        settings: {
            title: 'Settings',
            behavior: 'Behavior',
            autoPaste: 'Auto-Paste',
            autoPasteDesc: 'Automatically paste text when recording stops',
            clearOnPaste: 'Clear After Paste',
            clearOnPasteDesc: 'Clear the text field after a successful paste',
            startMinimized: 'Start Minimized',
            startMinimizedDesc: 'App will stay in the tray on launch',
            alwaysOnTop: 'Always On Top',
            alwaysOnTopDesc: 'Keep the window above all other windows',
            autoPause: 'Auto-Pause Media',
            autoPauseDesc: 'Pause media playback while dictating',
            autoPauseBrowserTitle: 'For Browsers',
            autoPauseBrowserDesc: 'To pause media in Chrome and Safari, enable JS from Apple Events:',
            autoPauseBrowserChrome: 'Chrome → View → Developer → Allow JavaScript from Apple Events',
            autoPauseBrowserSafari: 'Safari → Develop → Allow JavaScript from Apple Events',
            autoPauseBrowserNote: 'Music and Spotify work without extra setup.',
            autoPauseBrowserFixBtn: 'Allow Automatically (Beta)',
            autoPauseBrowserFixSuccess: 'Done! Restart your browsers.',
            accessibility: 'macOS: Accessibility',
            accessibilityDesc: 'Auto-paste requires Accessibility permission for NYX Vox in System Settings.',
            accessibilityBtn: 'Open Settings',
            sttMode: 'Recognition Engine',
            sttLanguage: 'Recognition Language',
            langAuto: 'Auto',
            langRu: 'Russian',
            langEn: 'English',
            deepgramLabel: 'Deepgram',
            deepgramDesc: 'Cloud · instant · punctuation',
            whisperLabel: 'Offline',
            whisperDesc: 'Whisper · no internet · slower',
            apiKeyLabel: 'Deepgram API Key',
            apiKeyPlaceholder: 'Paste your key...',
            apiKeySave: 'Save',
            apiKeyHowTo: 'How to get a key:',
            apiKeyStep1: 'Sign up at',
            apiKeyStep2: 'Go to Settings → API Keys',
            apiKeyStep3: 'Click Create a New API Key',
            apiKeyStep4: 'Copy the key and paste above',
            apiKeyFree: '💡 Free: $200 credits (~200 hours)',
            checkUpdates: 'Check for Updates',
            updateAvailable: 'New version available!',
            noUpdate: 'You have the latest version',
            checking: 'Checking...',
            modelStatus: 'Offline Model',
            modelInstalled: 'Model installed',
            modelNotFound: 'Model not found',
            modelDownload: 'Download',
            modelDownloading: 'Downloading...',
            modelSize: '~500 MB',
            groqLabel: 'Groq',
            groqDesc: 'Cloud Whisper · free · ultra-fast',
            groqApiKeyLabel: 'Groq API Key',
            groqHowTo: 'Get a free key at console.groq.com',
            faqTitle: 'Model Differences (FAQ)',
            faqDeepgram: 'Deepgram (Recommended) — Instant commercial model. Perfect punctuation and ultimate noise filtering.',
            faqGroq: 'Groq — Runs Whisper Large on their blazing fast servers. Free, ultra-fast, with typical AI punctuation.',
            faqWhisper: 'Offline Whisper — Compact 500MB model (small). Works locally, optimized for Apple Silicon. Caution: Using "Auto" language mode is not recommended in this engine.',
        },
        welcome: {
            title: 'Welcome to NYX Vox!',
            subtitle: 'Voice-powered future, now on your Mac.',
            permTitle: 'Privacy & Security',
            permAccess: 'Accessibility Access',
            permAccessDesc: 'Required to simulate ⌘V keystrokes and auto-paste text everywhere.',
            permMic: 'Microphone Input',
            permMicDesc: 'Permission to capture your voice for neural AI processing.',
            openSettings: 'Settings',
            faqTitle: 'Frequently Asked Questions',
            faqQ1: 'How do I start using it?',
            faqA1: '⌥ Option + Space — your main tool. Press once to start, second time to finish and paste the text.',
            faqQ2: 'Is my data secure?',
            faqA2: 'Yes. In Offline mode, data stays local. Cloud models are TLS-encrypted and never used for training.',
            faqQ3: 'Which engine should I pick?',
            faqA3: 'Deepgram — perfect for dialogues. Offline Whisper — best for privacy; select ONE language (RU/EN) to prevent artifacts.',
            faqQ4: 'Why the permissions?',
            faqA4: 'Accessibility allows auto-pasting; Microphone allows listening. When updating manually, macOS resets these—remove (-) and re-add (+) the app in your system settings.',
            updateWarningTitle: 'Updating manually?',
            updateWarning: 'macOS will reset your Accessibility permissions. Go to System Settings, remove NYX Vox with the minus (-) button, and add it back.',
            troubleshootTitle: 'Troubleshooting',
            fixQuarantine: 'Error: "File Damaged"',
            fixQuarantineDesc: 'macOS protects you from non-App Store apps. Your v0.1.2-beta build is safe — reset the quarantine lock below.',
            fixBtn: 'RESET THE LOCK / FIX',
            dontShow: 'Don\'t show again',
            startBtn: 'GET STARTED!',
        },
        update: {
            title: 'New Update Available!',
            desc: 'A newer version of NYX Vox is out! Download it for better performance and new features.',
            notes: 'Release Notes:',
            later: 'Maybe later',
            download: 'Download Now',
        }
    }
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        onClick={onChange}
        className={`w-10 h-6 rounded-full transition-all duration-200 relative pointer-events-auto ${checked ? 'bg-white/90' : 'bg-white/20'}`}
    >
        <span
            className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all duration-200 shadow ${checked ? 'left-[calc(100%-21px)] bg-black' : 'left-[3px] bg-white/50'}`}
        />
    </button>
);

export function SettingsPanel({ onClose, autoPaste, clearOnPaste, onToggleAutoPaste, onToggleClearOnPaste, startMinimized, onToggleStartMinimized, alwaysOnTop, onToggleAlwaysOnTop }: SettingsPanelProps) {
    const [tab, setTab] = useState<Tab>('guide');
    const [lang, setLang] = useState<Lang>('ru');
    const [showFeedback, setShowFeedback] = useState(false);
    const [browserFixed, setBrowserFixed] = useState(false);
    const [sttMode, setSttMode] = useState<'deepgram' | 'whisper' | 'groq'>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [whisperLanguage, setWhisperLanguage] = useState<'auto' | 'ru' | 'en'>('ru');
    const [groqLanguage, setGroqLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [autoPauseMedia, setAutoPauseMedia] = useState(true);

    // Deepgram State
    const [dgApiKey, setDgApiKey] = useState('');
    const [showDgKey, setShowDgKey] = useState(false);
    const [dgKeySaved, setDgKeySaved] = useState(false);

    // Groq State
    const [groqApiKey, setGroqApiKey] = useState('');
    const [showGroqKey, setShowGroqKey] = useState(false);
    const [groqKeySaved, setGroqKeySaved] = useState(false);
    const [modelAvailable, setModelAvailable] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
    const [latestVersion, setLatestVersion] = useState('');
    const c = CONTENT[lang];

    const handleCheckUpdates = useCallback(async () => {
        setUpdateStatus('checking');
        try {
            const response = await fetch('https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest');
            const data = await response.json();
            const latest = data.tag_name; // e.g., "v0.1.2-beta"
            setLatestVersion(latest);

            const current = 'v0.1.2-beta';
            if (latest !== current) {
                setUpdateStatus('available');
            } else {
                setUpdateStatus('latest');
            }
        } catch (err) {
            console.error('Update check error:', err);
            setUpdateStatus('error');
        }
    }, []);

    const handleDownload = useCallback(async () => {
        setDownloading(true); setDownloadProgress('...');
        try { await invoke('download_whisper_model'); }
        catch (err) { setDownloading(false); setDownloadProgress(`Error: ${err}`); }
    }, []);

    // Load settings on mount
    useEffect(() => {
        const load = async () => {
            try {
                const savedAppLang = await invoke<'ru' | 'en'>('get_app_language');
                if (savedAppLang) setLang(savedAppLang);

                const savedMode = await invoke<string>('get_stt_mode');
                if (savedMode) setSttMode(savedMode as 'deepgram' | 'whisper' | 'groq');

                const savedDgLang = await invoke<string>('get_deepgram_language');
                if (savedDgLang) setDgLanguage(savedDgLang as 'auto' | 'ru' | 'en');

                const savedWhisperLang = await invoke<string>('get_whisper_language');
                if (savedWhisperLang) setWhisperLanguage(savedWhisperLang as 'auto' | 'ru' | 'en');

                const savedGroqLang = await invoke<string>('get_groq_language');
                if (savedGroqLang) setGroqLanguage(savedGroqLang as 'auto' | 'ru' | 'en');

                const savedAutoPause = await invoke<boolean>('get_auto_pause');
                if (savedAutoPause !== undefined) setAutoPauseMedia(savedAutoPause);

                const savedDgKey = await invoke<string>('get_api_key');
                if (savedDgKey) { setDgApiKey(savedDgKey); setDgKeySaved(true); }

                const savedGroqKey = await invoke<string>('get_groq_api_key');
                if (savedGroqKey) { setGroqApiKey(savedGroqKey); setGroqKeySaved(true); }

                const available = await invoke<boolean>('check_model_available');
                setModelAvailable(available);

                // Check for updates automatically
                handleCheckUpdates();
            } catch (err) { console.error('Settings load error:', err); }
        };
        load();
        
        let unlisten: (() => void) | null = null;
        listen<string>('language-changed', (event) => {
            setLang(event.payload as 'ru' | 'en');
        }).then(u => { unlisten = u; });

        return () => { if (unlisten) unlisten(); };
    }, [handleCheckUpdates]);

    // Download progress listener
    useEffect(() => {
        let unlisten: (() => void) | null = null;
        listen<string>('model-download-progress', (e) => {
            setDownloadProgress(e.payload);
            if (e.payload === 'Готово!') { setDownloading(false); setModelAvailable(true); }
        }).then(u => { unlisten = u; });

        return () => { if (unlisten) unlisten(); };
    }, []);

    const handleModeChange = useCallback(async (newMode: 'deepgram' | 'whisper' | 'groq') => {
        setSttMode(newMode);
        await invoke('set_stt_mode', { mode: newMode });
    }, []);

    const handleLanguageChange = useCallback(async (newLang: 'auto' | 'ru' | 'en') => {
        if (sttMode === 'deepgram') {
            setDgLanguage(newLang);
            await invoke('set_deepgram_language', { lang: newLang });
        } else if (sttMode === 'whisper') {
            setWhisperLanguage(newLang);
            await invoke('set_whisper_language', { lang: newLang });
        } else if (sttMode === 'groq') {
            setGroqLanguage(newLang);
            await invoke('set_groq_language', { lang: newLang });
        }
    }, [sttMode]);

    const handleToggleAutoPauseMedia = useCallback(async () => {
        const newVal = !autoPauseMedia;
        setAutoPauseMedia(newVal);
        await invoke('set_auto_pause', { pause: newVal });
    }, [autoPauseMedia]);

    const handleSaveDgKey = useCallback(async () => {
        if (!dgApiKey.trim()) return;
        await invoke('save_api_key', { key: dgApiKey.trim() });
        setDgKeySaved(true);
        setTimeout(() => setDgKeySaved(false), 2000);
    }, [dgApiKey]);

    const handleDeleteDgKey = useCallback(async () => {
        await invoke('delete_api_key');
        setDgApiKey(''); setDgKeySaved(false);
    }, []);

    const handleSaveGroqKey = useCallback(async () => {
        if (!groqApiKey.trim()) return;
        await invoke('save_groq_api_key', { key: groqApiKey.trim() });
        setGroqKeySaved(true);
        setTimeout(() => setGroqKeySaved(false), 2000);
    }, [groqApiKey]);

    const handleDeleteGroqKey = useCallback(async () => {
        await invoke('delete_groq_api_key');
        setGroqApiKey(''); setGroqKeySaved(false);
    }, []);

    const handleDeleteModel = useCallback(async () => {
        try {
            await invoke('delete_whisper_model');
            setModelAvailable(false);
        } catch (err) { console.error('Delete model error:', err); }
    }, []);

    // ── Auto-Download Effect ───────────────────────────────────────────────
    useEffect(() => {
        if (sttMode === 'whisper' && !modelAvailable && !downloading) {
            handleDownload();
        }
    }, [sttMode, modelAvailable, downloading, handleDownload]);

    const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
        { id: 'guide', icon: <BookOpen className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'Инструкция' : 'Guide' },
        { id: 'settings', icon: <Settings2 className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'Настройки' : 'Settings' },
        { id: 'about', icon: <Info className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'О нас' : 'About' },
    ];

    return (
        <>
            {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
            <div
                data-tauri-drag-region
                className="w-full h-full bg-[#18181B] border border-white/10 rounded-[28px] flex flex-col overflow-hidden relative pointer-events-auto"
            >
                {/* HEADER */}
                <div data-tauri-drag-region className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                    <div className="flex gap-0.5 p-1 bg-white/5 rounded-xl">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap ${tab === t.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                                    }`}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Language Toggle */}
                        <button
                            onClick={() => {
                                const newLang = lang === 'ru' ? 'en' : 'ru';
                                setLang(newLang);
                                invoke('set_app_language', { lang: newLang });
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                        >
                            <Globe className="w-3 h-3 text-white/50" />
                            <span className="text-[11px] font-bold text-white/60 uppercase">{lang}</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* DIVIDER */}
                <div className="w-full h-[1px] bg-white/5 shrink-0" />

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {/* ── GUIDE TAB ── */}
                    {tab === 'guide' && (
                        <div className="space-y-4">
                            {c.guide.steps.map((step, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="shrink-0 w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white/60">
                                        {step.icon}
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-semibold text-white/90 mb-0.5">{step.head}</div>
                                        <div className="text-[12px] text-white/50 leading-relaxed">{step.body}</div>
                                    </div>
                                </div>
                            ))}

                            <div className="mt-5 p-4 rounded-2xl bg-white/4 border border-white/8 space-y-2">
                                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" />
                                    {lang === 'ru' ? 'Советы' : 'Tips'}
                                </div>
                                {c.guide.tips.map((tip, i) => (
                                    <div key={i} className="flex gap-2 text-[12px] text-white/50 leading-relaxed">
                                        <span className="text-white/20 mt-0.5 shrink-0">·</span>
                                        <span>{tip}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SETTINGS TAB ── */}
                    {tab === 'settings' && (
                        <div className="space-y-5">
                            <div>
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.settings.behavior}</div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                                        <div>
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.autoPaste}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.autoPasteDesc}</div>
                                        </div>
                                        <Toggle checked={autoPaste} onChange={onToggleAutoPaste} />
                                    </div>
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                                        <div>
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.clearOnPaste}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.clearOnPasteDesc}</div>
                                        </div>
                                        <Toggle checked={clearOnPaste} onChange={onToggleClearOnPaste} />
                                    </div>
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                                        <div>
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.startMinimized}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.startMinimizedDesc}</div>
                                        </div>
                                        <Toggle checked={startMinimized} onChange={onToggleStartMinimized} />
                                    </div>
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                                        <div>
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.autoPause}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.autoPauseDesc}</div>
                                        </div>
                                        <Toggle checked={autoPauseMedia} onChange={handleToggleAutoPauseMedia} />
                                    </div>
                                    {autoPauseMedia && (
                                        <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/15 space-y-2.5 ml-1">
                                            <div className="text-[11px] font-bold text-sky-300/70 uppercase tracking-widest">{c.settings.autoPauseBrowserTitle}</div>
                                            <p className="text-[11px] text-white/40 leading-relaxed">{c.settings.autoPauseBrowserDesc}</p>
                                            <div className="space-y-1.5">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[10px] text-sky-400/60 mt-0.5">●</span>
                                                    <code className="text-[10px] text-white/50 font-mono leading-relaxed">{c.settings.autoPauseBrowserChrome}</code>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[10px] text-sky-400/60 mt-0.5">●</span>
                                                    <code className="text-[10px] text-white/50 font-mono leading-relaxed">{c.settings.autoPauseBrowserSafari}</code>
                                                </div>
                                            </div>
                                            <div className="pt-1">
                                                <button
                                                    onClick={async () => {
                                                        if (window.__TAURI_INTERNALS__) {
                                                            await invoke('fix_browser_permissions');
                                                            setBrowserFixed(true);
                                                            setTimeout(() => setBrowserFixed(false), 5000);
                                                        }
                                                    }}
                                                    className={`w-full py-2 px-3 rounded-lg text-[10px] font-bold transition-all border ${
                                                        browserFixed 
                                                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                                            : 'bg-sky-500/10 border-sky-500/20 text-sky-300 hover:bg-sky-500/20'
                                                    }`}
                                                >
                                                    {browserFixed ? c.settings.autoPauseBrowserFixSuccess : c.settings.autoPauseBrowserFixBtn}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/25 italic">{c.settings.autoPauseBrowserNote}</p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                                        <div>
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.alwaysOnTop}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.alwaysOnTopDesc}</div>
                                        </div>
                                        <Toggle checked={alwaysOnTop} onChange={onToggleAlwaysOnTop} />
                                    </div>
                                </div>
                            </div>

                            {/* Accessibility */}
                            <div>
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.settings.accessibility}</div>
                                <div className="p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-3">
                                    <p className="text-[12px] text-amber-200/70 leading-relaxed">{c.settings.accessibilityDesc}</p>
                                    <button
                                        onClick={() => {
                                            if (window.__TAURI_INTERNALS__) {
                                                invoke('open_mac_settings');
                                            }
                                        }}
                                        className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-300 hover:text-amber-100 transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        {c.settings.accessibilityBtn}
                                    </button>
                                </div>
                            </div>

                            {/* ── STT MODE (Deepgram / Whisper) ── */}
                            <div>
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.settings.sttMode}</div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <button
                                        onClick={() => handleModeChange('deepgram')}
                                        className={`p-3 rounded-xl border transition-all text-left flex flex-col items-start ${sttMode === 'deepgram'
                                            ? 'bg-white/8 border-white/20'
                                            : 'bg-white/3 border-white/8 hover:border-white/15'
                                            }`}
                                    >
                                        <Wifi className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'deepgram' ? 'text-white/80' : 'text-white/30'}`} />
                                        <div className={`text-[12px] font-semibold ${sttMode === 'deepgram' ? 'text-white/90' : 'text-white/50'}`}>{c.settings.deepgramLabel}</div>
                                        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{c.settings.deepgramDesc}</div>
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('groq')}
                                        className={`p-3 rounded-xl border transition-all text-left flex flex-col items-start ${sttMode === 'groq'
                                            ? 'bg-white/8 border-amber-500/30'
                                            : 'bg-white/3 border-white/8 hover:border-white/15'
                                            }`}
                                    >
                                        <Zap className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'groq' ? 'text-amber-400' : 'text-white/30'}`} />
                                        <div className={`text-[12px] font-semibold ${sttMode === 'groq' ? 'text-amber-400/90' : 'text-white/50'}`}>{c.settings.groqLabel}</div>
                                        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{c.settings.groqDesc}</div>
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('whisper')}
                                        className={`p-3 rounded-xl border transition-all text-left flex flex-col items-start ${sttMode === 'whisper'
                                            ? 'bg-white/8 border-white/20'
                                            : 'bg-white/3 border-white/8 hover:border-white/15'
                                            }`}
                                    >
                                        <HardDrive className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'whisper' ? 'text-white/80' : 'text-white/30'}`} />
                                        <div className={`text-[12px] font-semibold ${sttMode === 'whisper' ? 'text-white/90' : 'text-white/50'}`}>{c.settings.whisperLabel}</div>
                                        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{c.settings.whisperDesc}</div>
                                    </button>
                                </div>

                                {/* ── STT LANGUAGE ── */}
                                <div>
                                    <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.settings.sttLanguage}</div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {[
                                            { id: 'auto', label: c.settings.langAuto },
                                            { id: 'ru', label: c.settings.langRu },
                                            { id: 'en', label: c.settings.langEn },
                                        ].map((l) => {
                                            const currentLang = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
                                            const isActive = currentLang === l.id;
                                            return (
                                                <button
                                                    key={l.id}
                                                    onClick={() => handleLanguageChange(l.id as 'auto' | 'ru' | 'en')}
                                                    className={`p-2 rounded-xl border transition-all text-center text-[12px] font-semibold ${isActive
                                                        ? 'bg-white/8 border-white/20 text-white'
                                                        : 'bg-white/3 border-white/8 text-white/50 hover:border-white/15'
                                                        }`}
                                                >
                                                    {l.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Deepgram API Key */}
                                {sttMode === 'deepgram' && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{c.settings.apiKeyLabel}</div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <input
                                                    type={showDgKey ? 'text' : 'password'}
                                                    value={dgApiKey}
                                                    onChange={(e) => setDgApiKey(e.target.value)}
                                                    placeholder={c.settings.apiKeyPlaceholder}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
                                                />
                                                <button onClick={() => setShowDgKey(!showDgKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                                                    {showDgKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            <button onClick={handleSaveDgKey} className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-[11px] font-semibold text-white/80 transition-colors">
                                                {dgKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : c.settings.apiKeySave}
                                            </button>
                                            {dgApiKey && (
                                                <button onClick={handleDeleteDgKey} className="px-2 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-[11px] text-white/35 leading-relaxed">
                                            <p className="font-medium text-white/50 mb-1.5">{c.settings.apiKeyHowTo}</p>
                                            <ol className="list-decimal list-inside space-y-0.5">
                                                <li>{c.settings.apiKeyStep1} <a href="https://console.deepgram.com" target="_blank" rel="noopener" className="text-sky-400 hover:underline">console.deepgram.com</a></li>
                                                <li>{c.settings.apiKeyStep2}</li>
                                                <li>{c.settings.apiKeyStep3}</li>
                                                <li>{c.settings.apiKeyStep4}</li>
                                            </ol>
                                            <p className="mt-2 text-white/25">{c.settings.apiKeyFree}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Groq API Key */}
                                {sttMode === 'groq' && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{c.settings.groqApiKeyLabel}</div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <input
                                                    type={showGroqKey ? 'text' : 'password'}
                                                    value={groqApiKey}
                                                    onChange={(e) => setGroqApiKey(e.target.value)}
                                                    placeholder={c.settings.apiKeyPlaceholder}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
                                                />
                                                <button onClick={() => setShowGroqKey(!showGroqKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                                                    {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            <button onClick={handleSaveGroqKey} className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-[11px] font-semibold text-white/80 transition-colors">
                                                {groqKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : c.settings.apiKeySave}
                                            </button>
                                            {groqApiKey && (
                                                <button onClick={handleDeleteGroqKey} className="px-2 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-[11px] text-white/35 leading-relaxed">
                                            <p className="font-medium text-white/50 mb-1.5">{c.settings.apiKeyHowTo}</p>
                                            <ol className="list-decimal list-inside space-y-0.5">
                                                <li>{c.settings.apiKeyStep1} <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-amber-400 hover:underline">console.groq.com</a></li>
                                                <li>{c.settings.apiKeyStep3} — Create API Key</li>
                                                <li>{c.settings.apiKeyStep4}</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}

                                {/* Offline Model Status */}
                                {sttMode === 'whisper' && (
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">{c.settings.modelStatus}</div>
                                            <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                                                {modelAvailable ? (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                        <div>
                                                            <div className="text-[12px] font-medium text-emerald-400">{c.settings.modelInstalled}</div>
                                                            <div className="text-[10px] text-white/30">ggml-medium.bin · {c.settings.modelSize}</div>
                                                        </div>
                                                    </div>
                                                ) : downloading ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                                                        <div>
                                                            <div className="text-[12px] text-white/60">{c.settings.modelDownloading}</div>
                                                            <div className="text-[10px] text-white/30">{downloadProgress}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <div className="text-[12px] text-white/50">{c.settings.modelNotFound}</div>
                                                            <div className="text-[10px] text-white/30">{c.settings.modelSize}</div>
                                                        </div>
                                                        <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[11px] font-medium text-white/80 transition-all">
                                                            <Download className="w-3.5 h-3.5" />
                                                            {c.settings.modelDownload}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {modelAvailable && (
                                            <button
                                                onClick={handleDeleteModel}
                                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400/60 hover:text-red-400 text-[11px] font-medium transition-all"
                                            >
                                                <X className="w-3 h-3" />
                                                {lang === 'ru' ? 'Удалить модель' : 'Delete model'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* FAQ / STT Differences */}
                                <div>
                                    <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.settings.faqTitle}</div>
                                    <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3 text-[12px] leading-relaxed text-white/60">
                                        <div className="flex gap-2">
                                            <Wifi className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                                            <p>{c.settings.faqDeepgram}</p>
                                        </div>
                                        <div className="w-full h-[1px] bg-white/5" />
                                        <div className="flex gap-2">
                                            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <p>{c.settings.faqGroq}</p>
                                        </div>
                                        <div className="w-full h-[1px] bg-white/5" />
                                        <div className="flex gap-2">
                                            <HardDrive className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                                            <p>{c.settings.faqWhisper}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── UPDATE CHECK ── */}
                                <div>
                                    <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{lang === 'ru' ? 'Обновления' : 'Updates'}</div>
                                    <div className="p-3.5 rounded-xl bg-white/4 border border-white/8 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <div className="text-[13px] font-semibold text-white/90">
                                                {updateStatus === 'available' ? (lang === 'ru' ? 'Доступна новая версия!' : 'New version available!') : (updateStatus === 'latest' ? (lang === 'ru' ? 'У вас последняя версия' : 'You have the latest version') : (lang === 'ru' ? 'Проверить обновления' : 'Check for Updates'))}
                                            </div>
                                            {latestVersion && (
                                                <div className="text-[11px] text-white/40 mt-0.5">
                                                    {lang === 'ru' ? `Последняя: ${latestVersion}` : `Latest: ${latestVersion}`}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={updateStatus === 'available' ? () => {
                                                if (window.__TAURI_INTERNALS__) {
                                                    import('@tauri-apps/plugin-shell').then(({ open }) => open('https://github.com/AVP-Dev/nyx-vox/releases/latest'));
                                                } else {
                                                    window.open('https://github.com/AVP-Dev/nyx-vox/releases/latest', '_blank');
                                                }
                                            } : handleCheckUpdates}
                                            disabled={updateStatus === 'checking'}
                                            className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-all flex items-center gap-2 ${updateStatus === 'available'
                                                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                                                : 'bg-white/10 hover:bg-white/15 text-white/80'
                                                }`}
                                        >
                                            {updateStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            {updateStatus === 'available' ? (lang === 'ru' ? 'СКАЧАТЬ' : 'DOWNLOAD') : (lang === 'ru' ? 'ПРОВЕРИТЬ' : 'CHECK')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Feedback button */}
                            <div>
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
                                    {lang === 'ru' ? 'Поддержка' : 'Support'}
                                </div>
                                <button
                                    onClick={() => setShowFeedback(true)}
                                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/15 transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center group-hover:bg-white/15 transition-all">
                                        <MessageCircle className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[13px] font-semibold text-white/80">
                                            {lang === 'ru' ? 'Сообщить об ошибке / идее' : 'Report a Bug / Feature Request'}
                                        </div>
                                        <div className="text-[11px] text-white/35">
                                            {lang === 'ru' ? 'Отправит письмо на contact@avpdev.com' : 'Sends email to contact@avpdev.com'}
                                        </div>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 ml-auto transition-colors" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── ABOUT TAB ── */}
                    {tab === 'about' && (
                        <div className="space-y-5">
                            {/* App info */}
                            <div className="flex items-center gap-4">
                                <div className="w-[60px] h-[60px] rounded-[16px] border border-white/10 flex items-center justify-center shadow-xl overflow-hidden shrink-0 relative">
                                    <img src="/logo.png" alt="NYX Vox" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[20px] font-bold text-white">{c.about.app}</span>
                                        <span className="text-[12px] text-white/30 font-mono">{c.about.version}</span>
                                    </div>
                                    <div className="text-[12px] text-white/50 mt-0.5 leading-relaxed max-w-[260px]">{c.about.desc}</div>
                                </div>
                            </div>

                            {/* Creator card with social links */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{c.about.author}</div>
                                <div>
                                    <div className="text-[15px] font-bold text-white">Aliaksei Patskevich</div>
                                    <div className="text-[11px] text-white/40 font-mono">Software Engineer • Code, Design & AI</div>
                                    <div className="text-[12px] text-white/50 mt-1 leading-relaxed">
                                        {lang === 'ru'
                                            ? 'Проектирую и разрабатываю современные IT-решения на стыке интерфейсов и ИИ.'
                                            : 'Designing and building modern IT solutions at the intersection of UI and AI.'}
                                    </div>
                                </div>
                                {/* Social links — icon only with glow */}
                                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                    {([
                                        { title: 'avpdev.com', href: 'https://avpdev.com', icon: <Globe className="w-4 h-4" />, color: 'hover:text-sky-400   hover:shadow-[0_0_12px_rgba(56,189,248,0.5)]' },
                                        { title: 'GitHub', href: 'https://github.com/AVP-Dev', icon: <Github className="w-4 h-4" />, color: 'hover:text-white      hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]' },
                                        { title: 'Telegram', href: 'https://t.me/AVP_Dev', icon: <MessageCircle className="w-4 h-4" />, color: 'hover:text-sky-400   hover:shadow-[0_0_12px_rgba(56,189,248,0.5)]' },
                                        { title: 'Email', href: 'mailto:contact@avpdev.com', icon: <Send className="w-4 h-4" />, color: 'hover:text-emerald-400 hover:shadow-[0_0_12px_rgba(52,211,153,0.5)]' },
                                        { title: 'WhatsApp', href: 'https://wa.me/375291217371', icon: <MessageCircle className="w-4 h-4" />, color: 'hover:text-green-400  hover:shadow-[0_0_12px_rgba(74,222,128,0.5)]' },
                                        { title: 'Instagram', href: 'https://instagram.com/avpdev', icon: <Instagram className="w-4 h-4" />, color: 'hover:text-pink-400  hover:shadow-[0_0_12px_rgba(244,114,182,0.5)]' },
                                        { title: 'LinkedIn', href: 'https://www.linkedin.com/in/aliaksei-alexey-patskevich-545586b8', icon: <Linkedin className="w-4 h-4" />, color: 'hover:text-blue-400  hover:shadow-[0_0_12px_rgba(96,165,250,0.5)]' },
                                    ] as const).map(({ title, href, icon, color }) => (
                                        <a
                                            key={title}
                                            href={href}
                                            title={title}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => {
                                                e.preventDefault();
                                                const url = href.startsWith('mailto:')
                                                    ? href
                                                    : href;
                                                if (window.__TAURI_INTERNALS__) {
                                                    import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
                                                } else {
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/30 transition-all duration-200 ${color}`}
                                        >
                                            {icon}
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* mission */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">{c.about.mission}</div>
                                <div className="text-[13px] text-white/80 italic leading-relaxed">&ldquo;{c.about.missionText}&rdquo;</div>
                            </div>

                            {/* stack */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.about.stack}</div>
                                <div className="flex flex-wrap gap-2">
                                    {['Next.js 16', 'Tauri 2', 'Whisper.cpp', 'Rust', 'TypeScript', 'cpal'].map(s => (
                                        <span key={s} className="px-2.5 py-1 rounded-lg bg-white/8 text-[11px] text-white/60 font-mono">{s}</span>
                                    ))}
                                </div>
                            </div>

                            {/* coming soon */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{c.about.future}</div>
                                <div className="space-y-1.5">
                                    {c.about.futureItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[12px] text-white/50">
                                            <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </>
    );
}
