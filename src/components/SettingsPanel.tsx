import React, { useState, useEffect } from 'react';
import {
    X, Globe, Cpu, Key, History as HistoryIcon, Info,
    Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Internal Components
import { DICTIONARY } from './settings/translations';
export { DICTIONARY as CONTENT };
import { SidebarItem } from './settings/Common';
import { GeneralTab } from './settings/GeneralTab';
import { EnginesTab, type EngineHelp } from './settings/EnginesTab';
import { KeysTab } from './settings/KeysTab';
import { HistoryTab } from './settings/HistoryTab';
import { InfoTab } from './settings/InfoTab';

export const APP_VERSION = '1.0.0';

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
        gemini: { title: 'Gemini', badge: 'Soto', type: 'Multimodal', desc: 'Google AI. Высочайшая точность + стиль.' },
        whisper: { title: 'Local', badge: 'Privasi', type: 'Offline', desc: '100% приватно. Работает без интернета.' },
        formatting: { title: 'Formatting', badge: 'AI', type: 'LLM', desc: '✨ AI режим: автоматически исправляет ошибки, убирает "эээ" и расставляет абзацы.' }
    },
    en: {
        deepgram: { title: 'Deepgram', badge: 'PRO', type: 'Cloud', desc: 'Lightning fast, great punctuation, commercial grade.' },
        groq: { title: 'Groq', badge: 'FREE', type: 'Cloud', desc: 'Blazing fast Whisper LPU. Best value.' },
        gemini: { title: 'Gemini', badge: 'SOTA', type: 'Multimodal', desc: 'Google AI. Premium accuracy and formatting.' },
        whisper: { title: 'Local', badge: 'PRIVACY', type: 'Offline', desc: '100% private. Works without internet.' },
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
    sttMode: 'deepgram' | 'whisper' | 'groq' | 'gemini';
    onSetSttMode: (m: 'deepgram' | 'whisper' | 'groq' | 'gemini') => void;
    dgLanguage: 'auto' | 'ru' | 'en';
    onSetDgLanguage: (l: 'auto' | 'ru' | 'en') => void;
    whisperLanguage: 'auto' | 'ru' | 'en';
    onSetWhisperLanguage: (l: 'auto' | 'ru' | 'en') => void;
    groqLanguage: 'auto' | 'ru' | 'en';
    onSetGroqLanguage: (l: 'auto' | 'ru' | 'en') => void;
    formattingMode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq';
    onSetFormattingMode: (m: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    onClose, lang, setLang, 
    autoPaste, clearOnPaste, startMinimized, 
    onToggleAutoPaste, onToggleClearOnPaste, onToggleStartMinimized, 
    alwaysOnTop, onToggleAlwaysOnTop,
    autoPauseMedia, handleToggleAutoPauseMedia,
    formattingStyle, onSetFormattingStyle,
    sttMode, onSetSttMode,
    dgLanguage, onSetDgLanguage,
    whisperLanguage, onSetWhisperLanguage,
    groqLanguage, onSetGroqLanguage,
    formattingMode, onSetFormattingMode
}) => {
    const [tab, setTab] = useState('general');
    const [showHelp, setShowHelp] = useState<string | null>(null);

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

    const c = DICTIONARY[lang as keyof typeof DICTIONARY] || DICTIONARY.en;

    useEffect(() => {
        const checkPerms = async () => {
            try {
                const acc = await invoke<boolean>('check_accessibility');
                const mic = await invoke<boolean>('check_microphone_permission');
                
                // If permission was just granted (transition to true)
                // we automatically bring the window back to front
                const accJustGranted = acc && (accGranted === false || accGranted === null);
                const micJustGranted = mic && (micGranted === false || micGranted === null);

                if (accJustGranted || micJustGranted) {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    const win = getCurrentWindow();
                    await win.show();
                    await win.setFocus();
                    if (alwaysOnTop) {
                        try {
                            await win.setAlwaysOnTop(true);
                        } catch (e) { console.error(e); }
                    }
                }

                setAccGranted(acc);
                setMicGranted(mic);
            } catch (e) {
                console.error('Failed to check permissions:', e);
            }
        };

        checkPerms();
        const interval = setInterval(checkPerms, 2000);
        return () => clearInterval(interval);
    }, [accGranted, micGranted, alwaysOnTop]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedLang = await invoke<string>('get_app_language');
                if (savedLang) setLang(savedLang as 'ru' | 'en');

                const wm = await invoke<'small' | 'medium' | 'turbo'>('get_whisper_model_type'); setWhisperModel(wm);
                
                const keys = ['deepgram', 'groq', 'gemini', 'qwen', 'deepseek'];
                for (const s of keys) {
                    const k = await invoke<string>('get_api_key', { service: s });
                    if (s === 'deepgram') setDgApiKey(k);
                    else if (s === 'groq') setGroqApiKey(k);
                    else if (s === 'gemini') setGeminiApiKey(k);
                    else if (s === 'qwen') setQwenApiKey(k);
                    else if (s === 'deepseek') setDeepseekApiKey(k);
                }

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

    const handleModeChange = async (m: 'deepgram' | 'whisper' | 'groq' | 'gemini') => {
        onSetSttMode(m);
        await invoke('set_stt_mode', { mode: m });
    };

    const handleLanguageChange = async (l: 'auto' | 'ru' | 'en') => {
        if (sttMode === 'deepgram') { onSetDgLanguage(l); await invoke('set_deepgram_language', { lang: l }); }
        else if (sttMode === 'whisper') { onSetWhisperLanguage(l); await invoke('set_whisper_language', { lang: l }); }
        else if (sttMode === 'groq') { onSetGroqLanguage(l); await invoke('set_groq_language', { lang: l }); }
    };

    const handleFormattingModeChange = async (m: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq') => {
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
                alert(err); 
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
            alert(`Error deleting model: ${err}`);
            console.error("Delete model error:", err);
        }
    };

    const handleSaveKey = async (service: string, key: string) => {
        try {
            await invoke('cmd_set_api_key', { service, key });
            setSavedStatus({ ...savedStatus, [service]: true });
            setTimeout(() => setSavedStatus({ ...savedStatus, [service]: false }), 2000);
        } catch (err) { alert(err); }
    };

    const handleDeleteKey = async (service: string) => {
        if (confirm(lang === 'ru' ? 'Удалить ключ?' : 'Delete key?')) {
            await invoke('cmd_set_api_key', { service, key: '' });
            if (service === 'deepgram') setDgApiKey('');
            else if (service === 'groq') setGroqApiKey('');
            else if (service === 'gemini') setGeminiApiKey('');
            else if (service === 'qwen') setQwenApiKey('');
            else if (service === 'deepseek') setDeepseekApiKey('');
        }
    };

    const handleHistorySettingsChange = async (cleanup: boolean, period: string) => {
        setHistorySmartCleanup(cleanup);
        setHistoryRetentionPeriod(period);
        await invoke('set_history_settings', { cleanup, period });
    };

    const handleClearHistory = async () => {
        if (!isConfirmingClear) { setIsConfirmingClear(true); setTimeout(() => setIsConfirmingClear(false), 3000); return; }
        try { await invoke('clear_history'); setIsConfirmingClear(false); alert(lang === 'ru' ? 'Очищено' : 'Cleared'); }
        catch (err) { alert(err); }
    };

    const handleOpenHistory = () => invoke('open_history_window');
    
    const handleCheckUpdates = async () => {
        setUpdateStatus('checking');
        setTimeout(() => setUpdateStatus('idle'), 2000);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            
            <motion.div 
                initial={{ scale: 0.95, y: 30, opacity: 0 }} 
                animate={{ scale: 1, y: 0, opacity: 1 }} 
                className="w-full h-full bg-[#18181B] border border-white/10 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col relative z-10"
            >
                {/* Header Section */}
                <div className="shrink-0 pt-5 pb-3 px-5 flex flex-col gap-4 bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.03]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                                <SettingsIcon className="w-5 h-5 text-white/70" />
                            </div>
                            <div>
                                <h2 className="text-[17px] font-black text-white tracking-tight leading-none">{c.ui.settings}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{sttMode}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/10" />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{formattingMode}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                             <button 
                                onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')} 
                                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                <Globe className="w-4 h-4" />
                                {lang.toUpperCase()}
                            </button>
                            <button 
                                onClick={onClose} 
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 text-white/30 hover:text-red-400 transition-all group"
                            >
                                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="p-1 bg-white/2 border border-white/5 rounded-[22px] grid grid-cols-5 gap-1">
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
                                            micGranted={micGranted}
                                            accGranted={accGranted}
                                        />
                                    )}
                                    {tab === 'engines' && (
                                        <EnginesTab 
                                            c={c} lang={lang} sttMode={sttMode} handleModeChange={handleModeChange} 
                                            showHelp={showHelp} setShowHelp={setShowHelp} ENGINE_HELP={ENGINE_HELP as unknown as EngineHelp}
                                            dgLanguage={dgLanguage} whisperLanguage={whisperLanguage} groqLanguage={groqLanguage} handleLanguageChange={handleLanguageChange}
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
            </motion.div>
        </motion.div>
    );
};
