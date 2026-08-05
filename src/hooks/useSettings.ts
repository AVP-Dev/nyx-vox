import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SttMode, Language, AppLanguage, FormattingMode, FormattingStyle } from '@/lib/types';

export interface SettingsState {
    showSettings: boolean;
    sttMode: SttMode;
    dgLanguage: Language;
    whisperLanguage: Language;
    groqLanguage: Language;
    appLanguage: AppLanguage;
    autoPaste: boolean;
    clearOnPaste: boolean;
    startMinimized: boolean;
    alwaysOnTop: boolean;
    autoPauseMedia: boolean;
    noiseGate: number;
    audioGain: number;
    formattingMode: FormattingMode;
    lastActiveFormatting: Exclude<FormattingMode, 'none'>;
    formattingStyle: FormattingStyle;
    showQuickMenu: boolean;
}

export interface SettingsActions {
    setShowSettings: (v: boolean) => void;
    setSttMode: (v: SttMode) => void;
    setDgLanguage: (v: Language) => void;
    setWhisperLanguage: (v: Language) => void;
    setGroqLanguage: (v: Language) => void;
    setAppLanguage: (v: AppLanguage) => void;
    setAutoPaste: (v: boolean) => void;
    setClearOnPaste: (v: boolean) => void;
    setStartMinimized: (v: boolean) => void;
    setAlwaysOnTop: (v: boolean) => void;
    setAutoPauseMedia: (v: boolean) => void;
    setNoiseGate: (v: number) => void;
    setAudioGain: (v: number) => void;
    setFormattingMode: (v: FormattingMode) => void;
    setLastActiveFormatting: (v: Exclude<FormattingMode, 'none'>) => void;
    setFormattingStyle: (v: FormattingStyle) => void;
    setShowQuickMenu: (v: boolean) => void;
    handleFormattingModeChange: (mode: FormattingMode) => Promise<void>;
    toggleSTTMode: () => Promise<void>;
    handleLanguageToggle: () => Promise<void>;
}

export function useSettings(): SettingsState & SettingsActions {
    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<SttMode>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<Language>('mixed');
    const [whisperLanguage, setWhisperLanguage] = useState<Language>('ru');
    const [groqLanguage, setGroqLanguage] = useState<Language>('mixed');
    const [appLanguage, setAppLanguage] = useState<AppLanguage>('ru');
    const [autoPaste, setAutoPaste] = useState(true);
    const [clearOnPaste, setClearOnPaste] = useState(false);
    const [startMinimized, setStartMinimized] = useState(false);
    const [alwaysOnTop, setAlwaysOnTop] = useState(true);
    const [autoPauseMedia, setAutoPauseMedia] = useState(false);
    const [noiseGate, setNoiseGate] = useState(0.002);
    const [audioGain, setAudioGain] = useState(2.0);
    const [formattingMode, setFormattingMode] = useState<FormattingMode>('none');
    const [lastActiveFormatting, setLastActiveFormatting] = useState<Exclude<FormattingMode, 'none'>>('gemini');
    const [formattingStyle, setFormattingStyle] = useState<FormattingStyle>('casual');
    const [showQuickMenu, setShowQuickMenu] = useState(false);

    const handleFormattingModeChange = useCallback(async (mode: FormattingMode) => {
        setFormattingMode(mode);
        if (mode !== 'none') setLastActiveFormatting(mode);
        await invoke('set_formatting_mode', { mode });
    }, []);

    const toggleSTTMode = useCallback(async () => {
        const modes: SttMode[] = ['deepgram', 'whisper', 'groq', 'gemini'];
        setSttMode(prev => {
            const next = modes[(modes.indexOf(prev) + 1) % modes.length];
            invoke('set_stt_mode', { mode: next }).catch(console.error);
            return next;
        });
    }, []);

    const handleLanguageToggle = useCallback(async () => {
        setAppLanguage(prev => {
            const next: AppLanguage = prev === 'ru' ? 'en' : 'ru';
            invoke('set_app_language', { lang: next }).catch(console.error);
            return next;
        });
    }, []);

    return {
        // State
        showSettings, sttMode, dgLanguage, whisperLanguage, groqLanguage,
        appLanguage, autoPaste, clearOnPaste, startMinimized, alwaysOnTop,
        autoPauseMedia, noiseGate, audioGain, formattingMode, lastActiveFormatting, formattingStyle,
        showQuickMenu,
        // Setters
        setShowSettings, setSttMode, setDgLanguage, setWhisperLanguage,
        setGroqLanguage, setAppLanguage, setAutoPaste, setClearOnPaste,
        setStartMinimized, setAlwaysOnTop, setAutoPauseMedia, setNoiseGate, setAudioGain, setFormattingMode,
        setLastActiveFormatting, setFormattingStyle, setShowQuickMenu,
        // Handlers
        handleFormattingModeChange, toggleSTTMode, handleLanguageToggle,
    };
}
