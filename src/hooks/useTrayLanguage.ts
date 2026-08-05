import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SttMode, Language, AppLanguage } from '@/lib/types';

export interface UseTrayLanguageOptions {
    sttMode: SttMode;
    dgLanguage: Language;
    whisperLanguage: Language;
    groqLanguage: Language;
    appLanguage: AppLanguage;
}

/**
 * Syncs the tray icon language label with the current STT language setting.
 */
export function useTrayLanguage(opts: UseTrayLanguageOptions) {
    useEffect(() => {
        const langCode = opts.sttMode === 'deepgram'
            ? opts.dgLanguage
            : (opts.sttMode === 'whisper' ? opts.whisperLanguage : opts.groqLanguage);
        invoke('update_tray_lang', { lang: langCode }).catch(console.error);
    }, [opts.sttMode, opts.dgLanguage, opts.whisperLanguage, opts.groqLanguage, opts.appLanguage]);
}
