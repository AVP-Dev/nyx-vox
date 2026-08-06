import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Globe, Cpu, Key, History as HistoryIcon, Info,
    Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import Markdown from 'react-markdown';

// Internal Components
import { DICTIONARY } from './settings/translations';
export { DICTIONARY as CONTENT };
import { SidebarItem } from './settings/Common';
import { GeneralTab } from './settings/GeneralTab';
import { EnginesTab, type EngineHelp } from './settings/EnginesTab';
import { KeysTab } from './settings/KeysTab';
import { HistoryTab } from './settings/HistoryTab';
import { InfoTab } from './settings/InfoTab';
import { ToastContainer, useToast } from './ui/Toast';
import { ConfirmDialog, useConfirm } from './ui/ConfirmDialog';
import type { FormattingMode } from '@/lib/types';

export const APP_VERSION = '1.2.0';

interface EngineHelpItem {
    title: string;
    badge: string;
    type: string;
    desc: string;
}

const ENGINE_HELP: Record<string, Record<string, EngineHelpItem>> = {
    ru: {
        deepgram: { title: 'Deepgram', badge: 'Pro', type: 'Cloud', desc: 'Молниеносно, пунктуация, диктофонное качество.' },
        groq: { title: 'Groq', badge: 'Free', type: 'Cloud', desc: 'Whisper на стероидах. Бесплатно и очень быстро.' },
        gemini: { title: 'Gemini', badge: 'SOTA', type: 'Multimodal', desc: 'Google AI. Высочайшая точность + стиль.' },
        whisper: { title: 'Local', badge: 'Privasi', type: 'Offline', desc: '100% приватно. Работает без интернета.' },
        gigachat: { title: 'GigaChat', badge: 'Сбер', type: 'LLM', desc: 'SberAI. Быстрая, доступна без VPN.' },
        formatting: { title: 'Formatting', badge: 'AI', type: 'LLM', desc: '✨ AI режим: автоматически исправляет ошибки, убирает "эээ" и расставляет абзацы.' }
    },
    en: {
        deepgram: { title: 'Deepgram', badge: 'PRO', type: 'Cloud', desc: 'Lightning fast, great punctuation, commercial grade.' },
        groq: { title: 'Groq', badge: 'FREE', type: 'Cloud', desc: 'Blazing fast Whisper LPU. Best value.' },
        gemini: { title: 'Gemini', badge: 'SOTA', type: 'Multimodal', desc: 'Google AI. Premium accuracy and formatting.' },
        whisper: { title: 'Local', badge: 'PRIVACY', type: 'Offline', desc: '100% private. Works without internet.' },
        gigachat: { title: 'GigaChat', badge: 'Sber', type: 'LLM', desc: 'SberAI. Russian neural network, works without VPN.' },
        formatting: { title: 'Formatting', badge: 'AI', type: 'LLM', desc: '✨ AI mode: fixes typos, removes filler words, and structures text into paragraphs.' }
    }
};

interface SettingsPanelProps {
    onClose: () => void;
    lang: string;
    setLang: (l: 'ru' | 'en') => void;
    autoPaste: boolean;
    clearOnPaste: boolean;
    startMinimized: boolean;
    onToggleAutoPaste: (v: boolean) => void;
    onToggleClearOnPaste: (v: boolean) => void;
    onToggleStartMinimized: (v: boolean) => void;
    alwaysOnTop: boolean;
    onToggleAlwaysOnTop: (v: boolean) => void;
    autoPauseMedia: boolean;
    handleToggleAutoPauseMedia: (v: boolean) => void;
    formattingStyle: 'casual' | 'professional';
    onSetFormattingStyle: (s: 'casual' | 'professional') => void;
    // Shared settings
    sttMode: 'deepgram' | 'whisper' | 'groq' | 'gemini' | 'gigachat';
    onSetSttMode: (m: 'deepgram' | 'whisper' | 'groq' | 'gemini' | 'gigachat') => void;
    formattingMode: FormattingMode;
    onSetFormattingMode: (m: FormattingMode) => void;
    noiseGate: number;
    onSetNoiseGate: (v: number) => void;
    audioGain: number;
    onSetAudioGain: (v: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    onClose, lang, setLang, 
    autoPaste, clearOnPaste, startMinimized, 
    onToggleAutoPaste, onToggleClearOnPaste, onToggleStartMinimized, 
    alwaysOnTop, onToggleAlwaysOnTop,
    autoPauseMedia, handleToggleAutoPauseMedia,
    formattingStyle, onSetFormattingStyle,
    sttMode, onSetSttMode,
    formattingMode, onSetFormattingMode,
    noiseGate, onSetNoiseGate,
    audioGain, onSetAudioGain,
}) => {
    const [tab, setTab] = useState('general');
    const [showHelp, setShowHelp] = useState<string | null>(null);
    const { toasts, addToast, dismissToast } = useToast();
    const confirmDialog = useConfirm();

    // Settings State
    const [whisperModel, setWhisperModel] = useState<'small' | 'medium' | 'turbo'>('small');

    // Model Download State
    const [modelAvailable, setModelAvailable] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');
    const [isPaused, setIsPaused] = useState(false);

    // API Keys
    const [dgApiKey, setDgApiKey] = useState('');
    const [groqApiKey, setGroqApiKey] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [qwenApiKey, setQwenApiKey] = useState('');
    const [deepseekApiKey, setDeepseekApiKey] = useState('');
    const [gigachatApiKey, setGigachatApiKey] = useState('');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
    const [accGranted, setAccGranted] = useState<boolean | null>(null);
    const [micGranted, setMicGranted] = useState<boolean | null>(null);

    // History
    const [historySmartCleanup, setHistorySmartCleanup] = useState(false);
    const [historyRetentionPeriod, setHistoryRetentionPeriod] = useState('never');
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);

    // Updates
    const [updateStatus, setUpdateStatus] = useState('idle');
    const [showUpdatePopup, setShowUpdatePopup] = useState(false);
    const [releaseData, setReleaseData] = useState<{ version: string; url: string; notes: string } | null>(null);
    const [notesLang, setNotesLang] = useState<'ru' | 'en'>('ru');

    const parsedNotes = useMemo(() => {
        if (!releaseData?.notes) return { en: '', ru: '' };
        const parts = releaseData.notes.split(/\n---\n/);
        if (parts.length < 2) return { en: releaseData.notes, ru: releaseData.notes };
        return { en: parts[0].trim(), ru: parts.slice(1).join('\n---\n').trim() };
    }, [releaseData?.notes]);

    const c = DICTIONARY[lang as keyof typeof DICTIONARY] || DICTIONARY.en;

    useEffect(() => {
        const checkPerms = async () => {
            try {
                const acc = await invoke<boolean>('check_accessibility');
                const mic = await invoke<boolean>('check_microphone_permission');

                setAccGranted(prevAcc => {
                    setMicGranted(prevMic => {
                        const accJustGranted = acc && (prevAcc === false || prevAcc === null);
                        const micJustGranted = mic && (prevMic === false || prevMic === null);

                        if (accJustGranted || micJustGranted) {
                            import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
                                const win = getCurrentWindow();
                                await win.show();
                                await win.setFocus();
                                if (alwaysOnTop) {
                                    try { await win.setAlwaysOnTop(true); } catch { /* ignore */ }
                                }
                            });
                        }

                        return mic;
                    });
                    return acc;
                });
            } catch {
                // Permission check failed — non-critical
            }
        };

        checkPerms();
        let unlistenFn: (() => void) | null = null;
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            import('@tauri-apps/api/event').then(({ listen }) => {
                listen('tauri://focus', () => checkPerms()).then(fn => { unlistenFn = fn; });
            });
        }
        return () => { if (unlistenFn) unlistenFn(); };
    }, [alwaysOnTop]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedLang = await invoke<string>('get_app_language');
                if (savedLang) setLang(savedLang as 'ru' | 'en');

                const wm = await invoke<'small' | 'medium' | 'turbo'>('get_whisper_model_type'); setWhisperModel(wm);

                const services = ['deepgram', 'groq', 'gemini', 'qwen', 'deepseek', 'gigachat'] as const;
                const apiKeys = await Promise.all(
                    services.map(s => invoke<string>('get_api_key', { service: s }))
                );
                setDgApiKey(apiKeys[0]);
                setGroqApiKey(apiKeys[1]);
                setGeminiApiKey(apiKeys[2]);
                setQwenApiKey(apiKeys[3]);
                setDeepseekApiKey(apiKeys[4]);
                setGigachatApiKey(apiKeys[5]);

                const hist = await invoke<[boolean, string]>('get_history_settings');
                setHistorySmartCleanup(hist[0]);
                setHistoryRetentionPeriod(hist[1]);

                checkModelAvailability();
            } catch (err) { console.error('Load Error:', err); }
        };
        loadSettings();

        const unlisten = listen<number | string>('download-progress', (event) => {
            setDownloading(true);
            const payload = event.payload;
            if (typeof payload === 'number') {
                setDownloadProgress(`${payload}%`);
                if (payload === 100) {
                    setDownloading(false);
                    setModelAvailable(true);
                }
            } else {
                setDownloadProgress(payload);
                if (payload === 'Готово!' || payload === 'Done!') {
                    setDownloading(false);
                    setModelAvailable(true);
                }
            }
        });

        return () => { unlisten.then(f => f()); };
    }, [setLang]);

    const checkModelAvailability = async () => {
        const avail = await invoke<boolean>('check_model_available');
        setModelAvailable(avail);
    };

    const handleModeChange = async (m: 'deepgram' | 'whisper' | 'groq' | 'gemini' | 'gigachat') => {
        onSetSttMode(m);
        await invoke('set_stt_mode', { mode: m });
    };

    const handleFormattingModeChange = async (m: FormattingMode) => {
        onSetFormattingMode(m);
        await invoke('set_formatting_mode', { mode: m });
    };

    const handleWhisperModelChange = async (m: 'small' | 'medium' | 'turbo') => {
        setWhisperModel(m);
        await invoke('set_whisper_model_type', { model: m });
        checkModelAvailability();
    };

    const handleDownload = async () => {
        setDownloading(true);
        setIsPaused(false);
        setDownloadProgress('0%');
        try { await invoke('download_whisper_model'); }
        catch (err) {
            if (err !== 'Загрузка отменена') {
                addToast(String(err), 'error');
            }
            setDownloading(false);
        }
    };

    const handlePauseDownload = async () => {
        setIsPaused(true);
        await invoke('pause_whisper_download');
    };

    const handleResumeDownload = async () => {
        setIsPaused(false);
        await invoke('resume_whisper_download');
    };

    const handleCancelDownload = async () => {
        await invoke('cancel_whisper_download');
        setDownloading(false);
        setIsPaused(false);
        setDownloadProgress('');
    };

    const handleDeleteModel = async () => {
        try {
            await invoke('delete_whisper_model');
            setModelAvailable(false);
        } catch (err) {
            addToast(`${lang === 'ru' ? 'Ошибка удаления модели' : 'Error deleting model'}: ${err}`, 'error');
        }
    };

    const handleSaveKey = async (service: string, key: string) => {
        try {
            await invoke('cmd_set_api_key', { service, key });
            setSavedStatus(prev => ({ ...prev, [service]: true }));
            setTimeout(() => setSavedStatus(prev => ({ ...prev, [service]: false })), 2000);
        } catch (err) { addToast(String(err), 'error'); }
    };

    const handleDeleteKey = async (service: string) => {
        const confirmed = await confirmDialog.confirm({
            title: lang === 'ru' ? 'Удалить ключ?' : 'Delete key?',
            message: lang === 'ru' ? 'Это действие нельзя отменить.' : 'This action cannot be undone.',
            confirmLabel: lang === 'ru' ? 'Удалить' : 'Delete',
            cancelLabel: lang === 'ru' ? 'Отмена' : 'Cancel',
            destructive: true,
        });
        if (confirmed) {
            await invoke('cmd_set_api_key', { service, key: '' });
            if (service === 'deepgram') setDgApiKey('');
            else if (service === 'groq') setGroqApiKey('');
            else if (service === 'gemini') setGeminiApiKey('');
            else if (service === 'qwen') setQwenApiKey('');
            else if (service === 'deepseek') setDeepseekApiKey('');
            else if (service === 'gigachat') setGigachatApiKey('');
        }
    };

    const handleHistorySettingsChange = async (cleanup: boolean, period: string) => {
        setHistorySmartCleanup(cleanup);
        setHistoryRetentionPeriod(period);
        await invoke('set_history_settings', { cleanup, period });
    };

    const handleClearHistory = async () => {
        if (!isConfirmingClear) { setIsConfirmingClear(true); setTimeout(() => setIsConfirmingClear(false), 3000); return; }
        try {
            await invoke('clear_history');
            setIsConfirmingClear(false);
            addToast(lang === 'ru' ? 'Очищено' : 'Cleared', 'success');
        } catch (err) { addToast(String(err), 'error'); }
    };

    const handleOpenHistory = () => invoke('open_history_window');
    
    const handleCheckUpdates = async () => {
        if (updateStatus === 'available' && releaseData) {
            setShowUpdatePopup(true);
            return;
        }
        setUpdateStatus('checking');
        try {
            const res = await fetch('https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest', {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (res.ok) {
                const data = await res.json();
                const latestTag = (data.tag_name || '').replace(/^v/, '');
                if (latestTag && latestTag !== APP_VERSION) {
                    setUpdateStatus('available');
                    setReleaseData({
                        version: latestTag,
                        url: data.html_url || 'https://github.com/AVP-Dev/nyx-vox/releases/latest',
                        notes: data.body || ''
                    });
                    setShowUpdatePopup(true);
                } else {
                    setUpdateStatus('idle');
                    addToast(lang === 'ru' ? 'У вас установлена самая актуальная версия!' : 'You have the latest version installed!', 'success');
                }
            } else {
                setUpdateStatus('idle');
                addToast(lang === 'ru' ? 'Не удалось проверить обновления.' : 'Failed to check for updates.', 'error');
            }
        } catch {
            setUpdateStatus('idle');
            addToast(lang === 'ru' ? 'Ошибка при проверке обновлений.' : 'Error checking for updates.', 'error');
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1, transition: { duration: 0.3 } }} 
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="w-full h-full bg-panel border border-subtle rounded-[32px] overflow-hidden flex flex-col relative z-10"
        >
                {/* Header Section */}
                <div className="shrink-0 pt-5 pb-3 px-5 flex flex-col gap-4 bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.03]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-surface flex items-center justify-center border border-subtle shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                <SettingsIcon className="w-5 h-5 text-white/70" />
                            </div>
                            <div>
                                <h2 className="text-[17px] font-black text-white tracking-tight leading-none">{c.ui.settings}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] bg-surface px-2 py-0.5 rounded-md border border-subtle">{sttMode}</span>
                                    <span className="w-1 h-1 rounded-full bg-surface-hover" />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] bg-surface px-2 py-0.5 rounded-md border border-subtle">{formattingMode}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                             <button 
                                onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')} 
                                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface border border-subtle text-muted hover:text-primary hover:bg-surface-hover transition-all text-xs font-bold"
                            >
                                <Globe className="w-4 h-4" />
                                {lang.toUpperCase()}
                            </button>
                            <button 
                                onClick={onClose} 
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-subtle hover:bg-red-500/20 hover:border-red-500/30 text-white/30 hover:text-red-400 transition-all group"
                            >
                                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="p-1 bg-white/2 border border-subtle rounded-[22px] grid grid-cols-5 gap-1">
                        <SidebarItem id="general" active={tab === 'general'} icon={SettingsIcon} label={c.settings.behavior} onClick={setTab} />
                        <SidebarItem id="engines" active={tab === 'engines'} icon={Cpu} label={c.ui.engine} onClick={setTab} color="text-amber-400" />
                        <SidebarItem id="keys" active={tab === 'keys'} icon={Key} label={c.settings.apiKeysTitle} onClick={setTab} color="text-sky-400" />
                        <SidebarItem id="history" active={tab === 'history'} icon={HistoryIcon} label={c.ui.history} onClick={setTab} color="text-emerald-400" />
                        <SidebarItem id="info" active={tab === 'info'} icon={Info} label={c.ui.about} onClick={setTab} color="text-purple-400" />
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    <div className="flex-1 overflow-y-auto px-4 py-5 custom-scrollbar scroll-smooth">
                        <div className="max-w-2xl mx-auto">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={tab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {tab === 'general' && (
                                        <GeneralTab
                                            c={c} lang={lang}
                                            autoPaste={autoPaste} onToggleAutoPaste={onToggleAutoPaste}
                                            clearOnPaste={clearOnPaste} onToggleClearOnPaste={onToggleClearOnPaste}
                                            startMinimized={startMinimized} onToggleStartMinimized={onToggleStartMinimized}
                                            autoPauseMedia={autoPauseMedia} handleToggleAutoPauseMedia={handleToggleAutoPauseMedia}
                                            alwaysOnTop={alwaysOnTop} onToggleAlwaysOnTop={onToggleAlwaysOnTop}
                                            formattingStyle={formattingStyle} onSetFormattingStyle={onSetFormattingStyle}
                                            noiseGate={noiseGate} onSetNoiseGate={onSetNoiseGate}
                                            audioGain={audioGain} onSetAudioGain={onSetAudioGain}
                                            micGranted={micGranted}
                                            accGranted={accGranted}
                                            addToast={addToast}
                                        />
                                    )}
                                    {tab === 'engines' && (
                                        <EnginesTab 
                                            c={c} lang={lang} sttMode={sttMode} handleModeChange={handleModeChange} 
                                            showHelp={showHelp} setShowHelp={setShowHelp} ENGINE_HELP={ENGINE_HELP as unknown as EngineHelp}
                                            formattingMode={formattingMode} handleFormattingModeChange={handleFormattingModeChange}
                                            whisperModel={whisperModel} handleWhisperModelChange={handleWhisperModelChange}
                                            modelAvailable={modelAvailable} downloading={downloading} downloadProgress={downloadProgress}
                                            handleDownload={handleDownload} handleDeleteModel={handleDeleteModel}
                                            isPaused={isPaused} handlePause={handlePauseDownload} handleResume={handleResumeDownload} handleCancel={handleCancelDownload}
                                        />
                                    )}
                                    {tab === 'keys' && (
                                        <KeysTab 
                                            c={c} dgApiKey={dgApiKey} setDgApiKey={setDgApiKey} groqApiKey={groqApiKey} setGroqApiKey={setGroqApiKey}
                                            geminiApiKey={geminiApiKey} setGeminiApiKey={setGeminiApiKey} qwenApiKey={qwenApiKey} setQwenApiKey={setQwenApiKey}
                                            deepseekApiKey={deepseekApiKey} setDeepseekApiKey={setDeepseekApiKey}
                                            gigachatApiKey={gigachatApiKey} setGigachatApiKey={setGigachatApiKey}
                                            showKeys={showKeys} setShowKeys={setShowKeys} handleSaveKey={handleSaveKey} handleDeleteKey={handleDeleteKey}
                                            savedStatus={savedStatus} setTab={setTab}
                                        />
                                    )}
                                    {tab === 'history' && (
                                        <HistoryTab 
                                            c={c} lang={lang} handleClearHistory={handleClearHistory} isConfirmingClear={isConfirmingClear}
                                            handleOpenHistory={handleOpenHistory} historySmartCleanup={historySmartCleanup} historyRetentionPeriod={historyRetentionPeriod}
                                            handleHistorySettingsChange={handleHistorySettingsChange}
                                        />
                                    )}
                                    {tab === 'info' && (
                                        <InfoTab c={c} APP_VERSION={APP_VERSION} updateStatus={updateStatus} handleCheckUpdates={handleCheckUpdates} lang={lang} />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                    
                    {/* Subtle Top/Bottom Shadows for Content Area */}
                    <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-[#18181B] to-transparent pointer-events-none z-10" />
                    <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#18181B] to-transparent pointer-events-none z-10" />
                </div>

                {/* Update Modal Popup Notification */}
                <AnimatePresence>
                    {showUpdatePopup && releaseData && (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }} 
                                animate={{ scale: 1, y: 0 }} 
                                exit={{ scale: 0.9, y: 20 }}
                                className="w-full max-w-md bg-panel border border-emerald-500/30 rounded-3xl p-6 shadow-2xl flex flex-col relative max-h-[90%]"
                            >
                                <button 
                                    onClick={() => setShowUpdatePopup(false)}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted hover:text-white hover:bg-surface-hover transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                        <Globe className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white leading-tight">{c.update?.title || 'New Update!'}</h3>
                                        <p className="text-xs text-emerald-400 font-mono mt-0.5">v{releaseData.version}</p>
                                    </div>
                                </div>

                                <p className="text-xs text-white/70 mb-4 font-medium leading-relaxed">
                                    {c.update?.desc || 'A newer version of NYX Vox is available for download.'}
                                </p>

                                {releaseData.notes && (
                                    <div className="mb-5 flex-1 overflow-y-auto custom-scrollbar bg-black/30 rounded-xl p-3 border border-subtle">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                                                {c.update?.notes || 'Release Notes:'}
                                            </div>
                                            <button
                                                onClick={() => setNotesLang(l => l === 'ru' ? 'en' : 'ru')}
                                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-subtle hover:bg-surface-hover transition-all"
                                            >
                                                <Globe size={10} className="text-white/30" />
                                                <span className="text-[9px] font-black text-muted uppercase tracking-wider">{notesLang.toUpperCase()}</span>
                                            </button>
                                        </div>
                                        <div className="prose-update">
                                            <Markdown>{notesLang === 'ru' ? parsedNotes.ru : parsedNotes.en}</Markdown>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2 border-t border-subtle shrink-0">
                                    <button 
                                        onClick={() => setShowUpdatePopup(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-muted hover:text-white font-bold text-xs transition-all"
                                    >
                                        {c.update?.later || 'Later'}
                                    </button>
                                    <a 
                                        href={releaseData.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setShowUpdatePopup(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs text-center shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wider"
                                    >
                                        {c.update?.download || 'Download'}
                                    </a>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toast Notifications */}
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />

                {/* Confirm Dialog */}
                <ConfirmDialog
                    open={confirmDialog.open}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmLabel={confirmDialog.confirmLabel}
                    cancelLabel={confirmDialog.cancelLabel}
                    destructive={confirmDialog.destructive}
                    onConfirm={() => confirmDialog.onConfirm?.()}
                    onCancel={confirmDialog.cancel}
                />
        </motion.div>
    );
};
