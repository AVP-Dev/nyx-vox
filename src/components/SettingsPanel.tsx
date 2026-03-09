"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
    X, Info, BookOpen, Settings2, Mic, Copy, Send,
    Keyboard, Globe, Zap, ChevronRight, ExternalLink,
    Github, MessageCircle, Instagram, Linkedin, Expand,
    Wifi, HardDrive, Download, Eye, EyeOff, Loader2, Check
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
}

const CONTENT = {
    ru: {
        guide: {
            title: 'Инструкция',
            steps: [
                {
                    icon: <Keyboard className="w-4 h-4" />,
                    head: 'Option + Space',
                    body: 'Глобальный ярлык. Работает поверх всех окон. Быстро вызывает NYX VOX для новой записи.'
                },
                {
                    icon: <Mic className="w-4 h-4" />,
                    head: 'Кнопка микрофона',
                    body: 'Нажмите для старта. Компактное окно покажет анимацию вашего голоса в реальном времени.'
                },
                {
                    icon: <Send className="w-4 h-4" />,
                    head: 'Вставить (Самолётик)',
                    body: 'Окно закроется, а текст автоматически вставится туда, где стоял курсор. Требуется разрешение &quot;Универсальный доступ&quot; в настройках Mac.'
                },
                {
                    icon: <Copy className="w-4 h-4" />,
                    head: 'Скопировать',
                    body: 'Просто копирует весь распознанный текст в буфер обмена.'
                },
                {
                    icon: <Expand className="w-4 h-4" />,
                    head: 'Развернуть текст',
                    body: 'Кликните по тексту или кнопке со стрелкой вниз, чтобы развернуть всё окно и увидеть полный текст.'
                },
                {
                    icon: <X className="w-4 h-4" />,
                    head: 'Умная очистка',
                    body: 'Текст очищается автоматически при старте новой записи. Также можно сбросить его вручную крестиком.'
                },
            ],
            tips: [
                'Говорите чётко, небольшими предложениями — Whisper лучше понимает контекст для знаков препинания.',
                'Для работы автовставки в любое приложение нужен доступ в «Универсальный доступ» для NYX Vox.',
                'В свернутом виде программа выглядит как тонкая статусная строка для экономии места на экране.',
            ]
        },
        about: {
            title: 'О приложении',
            app: 'NYX VOX',
            version: 'v0.1.0-beta',
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
            autoPause: 'Авто-пауза медиа',
            autoPauseDesc: 'Ставить медиа на паузу во время диктовки',
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
            modelStatus: 'Офлайн модель',
            modelInstalled: 'Модель установлена',
            modelNotFound: 'Модель не найдена',
            modelDownload: 'Скачать',
            modelDownloading: 'Загрузка...',
            modelSize: '~1.5 GB',
            groqLabel: 'Groq',
            groqDesc: 'Облачный Whisper · бесплатно · сверхбыстро',
            groqApiKeyLabel: 'API ключ Groq',
            groqHowTo: 'Бесплатный ключ на console.groq.com',
            faqTitle: 'Отличия движков (FAQ)',
            faqDeepgram: 'Deepgram (Рекомендуется) — мгновенная коммерческая модель. Идеально расставляет знаки препинания и отлично фильтрует шум.',
            faqGroq: 'Groq — запускает нейросеть Whisper Large на своих серверах. Безумная скорость и бесплатность, типичная пунктуация нейросетей.',
            faqWhisper: 'Офлайн Whisper — выполняется прямо на вашем Mac без интернета. Максимальная приватность, но самая медленная скорость.',
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
            version: 'v0.1.0-beta',
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
            autoPause: 'Auto-Pause Media',
            autoPauseDesc: 'Pause media playback while dictating',
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
            modelStatus: 'Offline Model',
            modelInstalled: 'Model installed',
            modelNotFound: 'Model not found',
            modelDownload: 'Download',
            modelDownloading: 'Downloading...',
            modelSize: '~1.5 GB',
            groqLabel: 'Groq',
            groqDesc: 'Cloud Whisper · free · ultra-fast',
            groqApiKeyLabel: 'Groq API Key',
            groqHowTo: 'Get a free key at console.groq.com',
            faqTitle: 'Model Differences (FAQ)',
            faqDeepgram: 'Deepgram (Recommended) — Instant commercial model. Perfect punctuation and ultimate noise filtering.',
            faqGroq: 'Groq — Runs Whisper Large on their blazing fast servers. Free, ultra-fast, with typical AI punctuation.',
            faqWhisper: 'Offline Whisper — Runs locally on your Mac without internet. Ultimate privacy, but slower than cloud APIs.',
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

export function SettingsPanel({ onClose, autoPaste, clearOnPaste, onToggleAutoPaste, onToggleClearOnPaste }: SettingsPanelProps) {
    const [tab, setTab] = useState<Tab>('guide');
    const [lang, setLang] = useState<Lang>('ru');
    const [showFeedback, setShowFeedback] = useState(false);
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
    const c = CONTENT[lang];

    // Load settings on mount
    useEffect(() => {
        const load = async () => {
            try {
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
            } catch (err) { console.error('Settings load error:', err); }
        };
        load();
    }, []);

    // Download progress listener
    useEffect(() => {
        const unlisten = listen<string>('model-download-progress', (e) => {
            setDownloadProgress(e.payload);
            if (e.payload === 'Готово!') { setDownloading(false); setModelAvailable(true); }
        });
        return () => { unlisten.then(f => f()); };
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

    const handleDownload = useCallback(async () => {
        setDownloading(true); setDownloadProgress('...');
        try { await invoke('download_whisper_model'); }
        catch (err) { setDownloading(false); setDownloadProgress(`Error: ${err}`); }
    }, []);

    const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
        { id: 'guide', icon: <BookOpen className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'Инструкция' : 'Guide' },
        { id: 'settings', icon: <Settings2 className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'Настройки' : 'Settings' },
        { id: 'about', icon: <Info className="w-[14px] h-[14px]" />, label: lang === 'ru' ? 'О нас' : 'About' },
    ];

    return (
        <>
            {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
            <div
                className="w-full h-full bg-[#0D0D0D]/95 border border-white/10 rounded-[28px] flex flex-col overflow-hidden relative pointer-events-auto"
            >
                {/* HEADER */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                    <div className="flex gap-0.5 p-1 bg-white/5 rounded-xl">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap ${tab === t.id
                                    ? 'bg-white/10 text-white shadow-[0_2px_8px_rgba(255,255,255,0.05)]'
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
                            onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
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
                                            <div className="text-[13px] font-semibold text-white/90">{c.settings.autoPause}</div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{c.settings.autoPauseDesc}</div>
                                        </div>
                                        <Toggle checked={autoPauseMedia} onChange={handleToggleAutoPauseMedia} />
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
                                            ? 'bg-white/8 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
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
                                            ? 'bg-white/8 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
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
                                            ? 'bg-white/8 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
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
                                                        ? 'bg-white/8 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]'
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
                                                    <div>
                                                        <div className="text-[12px] text-white/50">{c.settings.modelNotFound}</div>
                                                        <div className="text-[10px] text-white/30">{c.settings.modelSize}</div>
                                                    </div>
                                                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[11px] font-medium text-white/80 transition-colors">
                                                        <Download className="w-3.5 h-3.5" />
                                                        {c.settings.modelDownload}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
                                    <div className="text-[11px] text-white/40 font-mono">Software Engineer</div>
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
            </div>
        </>
    );
}
