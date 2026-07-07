import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { cleanHallucinations } from '@/lib/text';
import type { Phase, SttMode, AppLanguage } from '@/lib/types';
import type { MutableRefObject } from 'react';

interface Handlers {
    triggerStart: () => void;
    triggerStop: () => Promise<void>;
    handlePaste: (text?: string) => Promise<void>;
    updateTarget: (phase: Phase) => Promise<void>;
}

export interface UseTauriEventsOptions {
    setTranscript: (text: string) => void;
    setPhase: (phase: Phase) => void;
    setFormattingStatus: (status: string | null) => void;
    setSttMode: (mode: SttMode) => void;
    setAiStatus: (status: string) => void;
    setShowSettings: (v: boolean) => void;
    setShowWelcome: (v: boolean) => void;
    phaseRef: MutableRefObject<Phase>;
    appLanguageRef: MutableRefObject<AppLanguage>;
    autoPasteRef: MutableRefObject<boolean>;
    handlersRefs: MutableRefObject<Handlers>;
    lastTriggerTime: MutableRefObject<number>;
}

export function useTauriEvents(opts: UseTauriEventsOptions) {
    useEffect(() => {
        const unlisteners: (() => void)[] = [];

        const setupEvents = async () => {
            const handlers = [
                listen<void>('shortcut-trigger', () => {
                    const now = Date.now();
                    if (now - opts.lastTriggerTime.current < 500) return;
                    opts.lastTriggerTime.current = now;

                    const p = opts.phaseRef.current;
                    if (p === 'idle' || p === 'result') {
                        opts.setShowSettings(false);
                        opts.handlersRefs.current.triggerStart();
                    } else if (p === 'recording') {
                        opts.handlersRefs.current.triggerStop();
                    }
                }),
                listen<void>('open-settings', () => {
                    opts.setShowWelcome(false);
                    opts.setShowSettings(true);
                }),
                listen<void>('open-welcome', () => {
                    opts.setShowSettings(false);
                    opts.setShowWelcome(true);
                }),
                listen<void>('app-summon', () => {
                    opts.handlersRefs.current.updateTarget(opts.phaseRef.current);
                }),
                listen<string>('transcript-partial', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) opts.setTranscript(t);
                }),
                listen<string>('deepgram-final', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) {
                        opts.setTranscript(t);
                        if (opts.autoPasteRef.current) {
                            opts.handlersRefs.current.handlePaste(t);
                        } else {
                            opts.setPhase('result');
                        }
                    } else {
                        opts.setPhase('idle');
                    }
                }),
                listen<string>('ai-status', (e) => opts.setAiStatus(e.payload)),
                listen<string>('ai-result', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) opts.setTranscript(t);
                }),
                listen<string>('deepgram-error', (e) => {
                    const err = String(e.payload);
                    const msg = err.includes('401')
                        ? (opts.appLanguageRef.current === 'ru' ? 'Ошибка ключа Deepgram' : 'Deepgram Key Error')
                        : `Ошибка: ${err}`;
                    opts.setTranscript(msg);
                    opts.setPhase('result');
                }),
                listen<string>('recording-error', (e) => {
                    const err = String(e.payload || 'Recording error');
                    const msg = opts.appLanguageRef.current === 'ru'
                        ? `Ошибка записи: ${err}`
                        : `Recording error: ${err}`;
                    opts.setTranscript(msg);
                    opts.setPhase('result');
                }),
                listen<string>('stt-fallback', (e) => {
                    opts.setTranscript(`[Fallback: ${e.payload}]`);
                    opts.setPhase('result');
                }),
                listen<string>('mode-changed', (e) => {
                    if (e.payload) opts.setSttMode(e.payload as SttMode);
                }),
                listen<string>('formatting-status', (e) => {
                    opts.setFormattingStatus(e.payload === 'done' ? null : e.payload);
                }),
            ];

            const settled = await Promise.all(handlers);
            unlisteners.push(...settled);
        };

        setupEvents();
        return () => { unlisteners.forEach(fn => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
