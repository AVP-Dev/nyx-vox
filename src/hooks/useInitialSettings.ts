import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { APP_VERSION } from '@/components/SettingsPanel';
import type {
    SttMode, Language, AppLanguage, FormattingMode, FormattingStyle,
} from '@/lib/types';
import type { SettingsActions } from '@/hooks/useSettings';

interface Setters {
    setSttMode: SettingsActions['setSttMode'];
    setDgLanguage: SettingsActions['setDgLanguage'];
    setWhisperLanguage: SettingsActions['setWhisperLanguage'];
    setGroqLanguage: SettingsActions['setGroqLanguage'];
    setAppLanguage: SettingsActions['setAppLanguage'];
    setAutoPaste: SettingsActions['setAutoPaste'];
    setClearOnPaste: SettingsActions['setClearOnPaste'];
    setStartMinimized: SettingsActions['setStartMinimized'];
    setAlwaysOnTop: SettingsActions['setAlwaysOnTop'];
    setAutoPauseMedia: SettingsActions['setAutoPauseMedia'];
    setAudioGain: SettingsActions['setAudioGain'];
    setFormattingMode: SettingsActions['setFormattingMode'];
    setLastActiveFormatting: SettingsActions['setLastActiveFormatting'];
    setFormattingStyle: SettingsActions['setFormattingStyle'];
    setShowWelcome: (v: boolean) => void;
    setIsVisible: (v: boolean) => void;
}

export function useInitialSettings(setters: Setters) {
    const [showWelcome, setShowWelcomeLocal] = useState(false);
    const [isVisible, setIsVisibleLocal] = useState(false);

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
                if (!seen) setShowWelcome(true);

                setIsVisible(true);

                const results = await Promise.all([
                    invoke<string>('get_stt_mode'),
                    invoke<Language>('get_deepgram_language'),
                    invoke<Language>('get_whisper_language'),
                    invoke<Language>('get_groq_language'),
                    invoke<boolean>('get_auto_paste'),
                    invoke<boolean>('get_clear_on_paste'),
                    invoke<boolean>('get_start_minimized'),
                    invoke<boolean>('check_model_available'),
                    invoke<boolean>('get_always_on_top'),
                    invoke<string>('get_formatting_mode').catch(() => 'none'),
                    invoke<string>('get_formatting_style').catch(() => 'casual'),
                    invoke<boolean>('get_auto_pause').catch(() => false),
                ]);

                setters.setSttMode(results[0] as SttMode);
                setters.setDgLanguage(results[1]);
                setters.setWhisperLanguage(results[2]);
                setters.setGroqLanguage(results[3]);
                setters.setAutoPaste(results[4]);
                setters.setClearOnPaste(results[5]);
                setters.setStartMinimized(results[6]);
                setters.setAlwaysOnTop(results[8] ?? true);

                const fMode = results[9] as FormattingMode;
                setters.setFormattingMode(fMode || 'none');
                if (fMode && fMode !== 'none') setters.setLastActiveFormatting(fMode);

                const fStyle = results[10] as FormattingStyle;
                setters.setFormattingStyle(fStyle || 'casual');
                setters.setAutoPauseMedia(results[11] ?? false);

                // Load audio gain from get_all_settings (no individual getter exists)
                try {
                    const allSettings = await invoke<Record<string, unknown>>('get_all_settings');
                    if (allSettings && typeof allSettings.audioGain === 'number') {
                        setters.setAudioGain(allSettings.audioGain);
                    }
                } catch { /* non-critical */ }

                const savedLang = await invoke<AppLanguage>('get_app_language').catch(() => 'ru' as const);
                setters.setAppLanguage(savedLang || 'ru');

                // Check updates after settings loaded
                setTimeout(() => checkUpdates(savedLang || 'ru'), 5000);
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

    return { showWelcome, setShowWelcome, isVisible, setIsVisible };
}

// Extracted update check logic
async function checkUpdates(appLang: string) {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
    try {
        const current = `v${APP_VERSION}`;
        const ignored = await invoke<string>('get_ignored_update').catch(() => '');
        const dismissedAt = await invoke<number>('get_update_dismissed_at').catch(() => 0);

        if (dismissedAt && Date.now() - dismissedAt < 2 * 60 * 60 * 1000) return;

        const response = await fetch('https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest');
        if (!response.ok) return;
        const data = await response.json();
        const latest = data.tag_name;

        if (latest && latest !== current && latest !== ignored) {
            const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const label = `update-${latest.replace(/\./g, '-')}`;
            new WebviewWindow(label, {
                url: `/update?version=${latest}&lang=${appLang}`,
                title: 'NYX Vox Update',
                width: 320, height: 380,
                resizable: false, decorations: false,
                transparent: true, alwaysOnTop: true,
                shadow: false, center: true, skipTaskbar: false,
            });
        }
    } catch (e) {
        console.error('[UpdateCheck] Error:', e);
    }
}
