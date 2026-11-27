import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { APP_VERSION } from '@/constants/version';
import type {
    SttMode, AppLanguage, FormattingMode, FormattingStyle,
} from '@/lib/types';
import type { SettingsActions } from '@/hooks/useSettings';

interface Setters {
    setSttMode: SettingsActions['setSttMode'];
    setAppLanguage: SettingsActions['setAppLanguage'];
    setAutoPaste: SettingsActions['setAutoPaste'];
    setClearOnPaste: SettingsActions['setClearOnPaste'];
    setStartMinimized: SettingsActions['setStartMinimized'];
    setAlwaysOnTop: SettingsActions['setAlwaysOnTop'];
    setAutoPauseMedia: SettingsActions['setAutoPauseMedia'];
    setNoiseGate: SettingsActions['setNoiseGate'];
    setAudioGain: SettingsActions['setAudioGain'];
    setFormattingMode: SettingsActions['setFormattingMode'];
    setLastActiveFormatting: SettingsActions['setLastActiveFormatting'];
    setFormattingStyle: SettingsActions['setFormattingStyle'];
    setVadAutoStop: SettingsActions['setVadAutoStop'];
    setVadSilenceTimeout: SettingsActions['setVadSilenceTimeout'];
    setCustomModels: SettingsActions['setCustomModels'];
    setShowWelcome: (v: boolean) => void;
    setIsVisible: (v: boolean) => void;
}

export function useInitialSettings(setters: Setters) {
    const [showWelcome, setShowWelcomeLocal] = useState(false);
    const [isVisible, setIsVisibleLocal] = useState(false);
    const [permsMissing, setPermsMissing] = useState(false);

    // Destructure to get stable references for useCallback deps
    const { setShowWelcome: parentSetShowWelcome, setIsVisible: parentSetIsVisible } = setters;

    const setShowWelcome = useCallback((v: boolean) => {
        setShowWelcomeLocal(v);
        parentSetShowWelcome(v);
    }, [parentSetShowWelcome]);

    const setIsVisible = useCallback((v: boolean) => {
        setIsVisibleLocal(v);
        parentSetIsVisible(v);
    }, [parentSetIsVisible]);

    // Load all settings on mount
    useEffect(() => {
        const load = async () => {
            try {
                const seen = await invoke<boolean>('get_welcome_seen', { version: APP_VERSION }).catch(() => true);

                // Check permissions on every startup
                const [accOk, micOk] = await Promise.all([
                    invoke<boolean>('check_accessibility').catch(() => true),
                    invoke<boolean>('check_microphone_permission').catch(() => true),
                ]);
                const permsOk = accOk && micOk;

                if (!seen || !permsOk) {
                    setShowWelcome(true);
                    if (!permsOk) setPermsMissing(true);
                }

                setIsVisible(true);

                // Single batch request for all settings (FE-6: eliminates IPC waterfall)
                const allSettings = await invoke<Record<string, unknown>>('get_all_settings').catch((err) => {
                    console.error('Failed to load settings via get_all_settings:', err);
                    return null;
                });

                let savedLang: AppLanguage = 'ru';
                if (allSettings) {
                    if (typeof allSettings.sttMode === 'string') {
                        setters.setSttMode(allSettings.sttMode as SttMode);
                    }
                    if (typeof allSettings.autoPaste === 'boolean') {
                        setters.setAutoPaste(allSettings.autoPaste);
                    }
                    if (typeof allSettings.clearOnPaste === 'boolean') {
                        setters.setClearOnPaste(allSettings.clearOnPaste);
                    }
                    if (typeof allSettings.startMinimized === 'boolean') {
                        setters.setStartMinimized(allSettings.startMinimized);
                    }
                    if (typeof allSettings.alwaysOnTop === 'boolean') {
                        setters.setAlwaysOnTop(allSettings.alwaysOnTop);
                    }
                    if (typeof allSettings.formattingMode === 'string') {
                        const fMode = allSettings.formattingMode as FormattingMode;
                        setters.setFormattingMode(fMode || 'none');
                        if (fMode && fMode !== 'none') setters.setLastActiveFormatting(fMode);
                    }
                    if (typeof allSettings.formattingStyle === 'string') {
                        setters.setFormattingStyle(allSettings.formattingStyle as FormattingStyle);
                    }
                    if (typeof allSettings.autoPause === 'boolean') {
                        setters.setAutoPauseMedia(allSettings.autoPause);
                    }
                    if (typeof allSettings.audioGain === 'number') {
                        setters.setAudioGain(allSettings.audioGain);
                    }
                    if (typeof allSettings.noiseGate === 'number') {
                        setters.setNoiseGate(allSettings.noiseGate);
                    }
                    if (typeof allSettings.vadAutoStop === 'boolean') {
                        setters.setVadAutoStop(allSettings.vadAutoStop);
                    }
                    if (typeof allSettings.vadSilenceTimeout === 'number') {
                        setters.setVadSilenceTimeout(allSettings.vadSilenceTimeout);
                    }
                    if (allSettings.customModels && typeof allSettings.customModels === 'object') {
                        setters.setCustomModels(allSettings.customModels as Record<string, string>);
                    }
                    if (typeof allSettings.appLanguage === 'string') {
                        savedLang = allSettings.appLanguage as AppLanguage;
                        setters.setAppLanguage(savedLang);
                    } else {
                        const sysLang: AppLanguage =
                            typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
                                ? 'ru'
                                : 'en';
                        savedLang = sysLang;
                        setters.setAppLanguage(sysLang);
                        void invoke('set_app_language', { lang: sysLang }).catch(() => {});
                    }
                }

                // Check updates after settings loaded
                setTimeout(() => checkUpdates(savedLang), 5000);
            } catch (err) {
                console.error('Initial settings load error:', err);
                setIsVisible(true);
            }
        };

        load();

        // Self-diagnosis on start
        invoke('run_self_diagnosis').then(res => {
            console.log('🛡️ NYX Vox Self-Diagnosis:', res);
        }).catch(err => console.error('🚫 Diagnosis failed:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for language changes from tray
    useEffect(() => {
        let isMounted = true;
        let unlistenFn: (() => void) | null = null;

        listen<string>('language-changed', (e) => {
            if (isMounted) setters.setAppLanguage(e.payload as AppLanguage);
        }).then(u => {
            if (isMounted) unlistenFn = u; else u();
        });

        return () => { isMounted = false; if (unlistenFn) unlistenFn(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { showWelcome, setShowWelcome, isVisible, setIsVisible, permsMissing };
}

// Extracted update check logic
async function checkUpdates(appLang: string) {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
    try {
        const { checkAppUpdate, normalizeVersion } = await import('@/lib/updater');
        const update = await checkAppUpdate();
        if (!update) return;

        const latest = normalizeVersion(update.version);
        const ignored = normalizeVersion(await invoke<string>('get_ignored_update').catch(() => ''));
        const dismissedAt = await invoke<number>('get_update_dismissed_at').catch(() => 0);

        if (ignored && latest === ignored) return;
        if (dismissedAt && Date.now() - dismissedAt < 2 * 60 * 60 * 1000) return;

        await invoke('show_update_window', { version: latest, lang: appLang });
    } catch (e) {
        console.error('[UpdateCheck] Error:', e);
    }
}
