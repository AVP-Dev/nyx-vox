import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SttMode, AppLanguage, FormattingMode, FormattingStyle, CustomModelsMap } from '@/lib/types';

export interface SettingsState {
    showSettings: boolean;
    sttMode: SttMode;
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
    vadAutoStop: boolean;
    vadSilenceTimeout: number;
    customModels: CustomModelsMap;
}

export interface SettingsActions {
    setShowSettings: (v: boolean) => void;
    setSttMode: (v: SttMode) => void;
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
    setVadAutoStop: (v: boolean) => void;
    setVadSilenceTimeout: (v: number) => void;
    setCustomModels: (v: CustomModelsMap | ((prev: CustomModelsMap) => CustomModelsMap)) => void;
    handleFormattingModeChange: (mode: FormattingMode) => Promise<void>;
    toggleSTTMode: () => Promise<void>;
    handleLanguageToggle: () => Promise<void>;
    handleSetVadAutoStop: (enabled: boolean) => Promise<void>;
    handleSetVadSilenceTimeout: (timeout: number) => Promise<void>;
    handleSetCustomModel: (slot: string, model: string) => Promise<void>;
}

export function useSettings(): SettingsState & SettingsActions {
    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<SttMode>('deepgram');
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
    const [vadAutoStop, setVadAutoStop] = useState(false);
    const [vadSilenceTimeout, setVadSilenceTimeout] = useState(7.0);
    const [customModels, setCustomModels] = useState<CustomModelsMap>({});

    const handleFormattingModeChange = useCallback(async (mode: FormattingMode) => {
        setFormattingMode(mode);
        if (mode !== 'none') setLastActiveFormatting(mode);
        await invoke('set_formatting_mode', { mode });
    }, []);

    const toggleSTTMode = useCallback(async () => {
        const modes: SttMode[] = ['deepgram', 'whisper', 'groq', 'gemini', 'gigachat'];
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

    const handleSetVadAutoStop = useCallback(async (enabled: boolean) => {
        setVadAutoStop(enabled);
        await invoke('set_vad_auto_stop', { enabled }).catch(console.error);
    }, []);

    const handleSetVadSilenceTimeout = useCallback(async (timeout: number) => {
        setVadSilenceTimeout(timeout);
        await invoke('set_vad_silence_timeout', { timeout }).catch(console.error);
    }, []);

    const handleSetCustomModel = useCallback(async (slot: string, model: string) => {
        setCustomModels(prev => {
            const next = { ...prev };
            if (!model.trim()) {
                delete next[slot];
            } else {
                next[slot] = model.trim();
            }
            return next;
        });
        await invoke('set_custom_model', { slot, model }).catch(console.error);
    }, []);

    return {
        // State
        showSettings, sttMode,
        appLanguage, autoPaste, clearOnPaste, startMinimized, alwaysOnTop,
        autoPauseMedia, noiseGate, audioGain, formattingMode, lastActiveFormatting, formattingStyle,
        showQuickMenu, vadAutoStop, vadSilenceTimeout, customModels,
        // Setters
        setShowSettings, setSttMode,
        setAppLanguage, setAutoPaste, setClearOnPaste,
        setStartMinimized, setAlwaysOnTop, setAutoPauseMedia, setNoiseGate, setAudioGain, setFormattingMode,
        setLastActiveFormatting, setFormattingStyle, setShowQuickMenu, setVadAutoStop, setVadSilenceTimeout, setCustomModels,
        // Handlers
        handleFormattingModeChange, toggleSTTMode, handleLanguageToggle,
        handleSetVadAutoStop, handleSetVadSilenceTimeout, handleSetCustomModel,
    };
}
