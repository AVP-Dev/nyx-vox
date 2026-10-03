import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Phase, SttMode, AppLanguage } from '@/lib/types';
import type { MutableRefObject } from 'react';

interface Handlers {
    triggerStart: () => Promise<void>;
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
    const optsRef = useRef(opts);
    useEffect(() => {
        optsRef.current = opts;
    });

    useEffect(() => {
        let isMounted = true;
        const unlisteners: (() => void)[] = [];

        const setupEvents = async () => {
            try {
                const handlers = [
                    listen<void>('shortcut-trigger', () => {
                        const now = Date.now();
                        const currentOpts = optsRef.current;
                        if (now - currentOpts.lastTriggerTime.current < 500) return;
                        currentOpts.lastTriggerTime.current = now;

                        const p = currentOpts.phaseRef.current;
                        if (p === 'idle' || p === 'result') {
                            currentOpts.setShowSettings(false);
                            void currentOpts.handlersRefs.current.triggerStart();
                        } else if (p === 'recording') {
                            currentOpts.handlersRefs.current.triggerStop();
                        }
                    }),
                    listen<void>('open-settings', () => {
                        optsRef.current.setShowWelcome(false);
                        optsRef.current.setShowSettings(true);
                    }),
                    listen<void>('open-welcome', () => {
                        optsRef.current.setShowSettings(false);
                        optsRef.current.setShowWelcome(true);
                    }),
                    listen<void>('app-summon', () => {
                        const currentOpts = optsRef.current;
                        currentOpts.handlersRefs.current.updateTarget(currentOpts.phaseRef.current);
                    }),
                    listen<string>('ai-status', (e) => optsRef.current.setAiStatus(e.payload)),
                    listen<string>('ai-result', (e) => {
                        // ADR #6: backend utils.rs is the single source of truth for cleanup
                        if (e.payload) optsRef.current.setTranscript(e.payload);
                    }),
                    listen<string>('recording-error', (e) => {
                        const err = String(e.payload || 'Recording error');
                        const currentOpts = optsRef.current;
                        currentOpts.setAiStatus(err);
                        currentOpts.setTranscript('');
                        currentOpts.setPhase('idle');
                        setTimeout(() => optsRef.current.setAiStatus(''), 2500);
                    }),
                    listen<string>('stt-fallback', (e) => {
                        optsRef.current.setTranscript(`[Fallback: ${e.payload}]`);
                        optsRef.current.setPhase('result');
                    }),
                    listen<string>('mode-changed', (e) => {
                        if (e.payload) optsRef.current.setSttMode(e.payload as SttMode);
                    }),
                    listen<string>('formatting-status', (e) => {
                        optsRef.current.setFormattingStatus(e.payload === 'done' ? null : e.payload);
                    }),
                    listen<void>('vad-auto-stop', () => {
                        const currentOpts = optsRef.current;
                        if (currentOpts.phaseRef.current === 'recording') {
                            currentOpts.handlersRefs.current.triggerStop();
                        }
                    }),
                    listen<string>('interim-transcription', (e) => {
                        const currentOpts = optsRef.current;
                        if (currentOpts.phaseRef.current === 'recording' && e.payload) {
                            currentOpts.setTranscript(e.payload);
                        }
                    }),
                ];

                const settled = await Promise.all(handlers);
                if (!isMounted) {
                    settled.forEach(fn => fn());
                    return;
                }
                unlisteners.push(...settled);
            } catch (err) {
                console.error('[useTauriEvents] failed to subscribe:', err);
            }
        };

        setupEvents();
        return () => {
            isMounted = false;
            unlisteners.forEach(fn => fn());
        };
    }, []);
}
