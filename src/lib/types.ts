export type Phase = 'idle' | 'recording' | 'processing' | 'result' | 'editing';

export type FormattingMode = 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq';

export type SttMode = 'deepgram' | 'whisper' | 'groq' | 'gemini';

export type Language = 'auto' | 'mixed' | 'ru' | 'en';

export type AppLanguage = 'ru' | 'en';

export type FormattingStyle = 'casual' | 'professional';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TranslationDict {
    ui: Record<string, string>;
    settings: Record<string, any>;
    history: Record<string, string>;
    about: Record<string, string>;
    guide: Record<string, any>;
    welcome: Record<string, any>;
    perms: Record<string, any>;
    quarantine: Record<string, any>;
    update: Record<string, string>;
}
