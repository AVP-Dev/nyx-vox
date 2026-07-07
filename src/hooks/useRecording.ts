import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '@/store/useStore';
import { cleanHallucinations } from '@/lib/text';
import type { Phase, AppLanguage } from '@/lib/types';

export interface UseRecordingOptions {
    autoPaste: boolean;
    clearOnPaste: boolean;
    alwaysOnTop: boolean;
    appLanguage: AppLanguage;
    updateTarget: (phase: Phase) => Promise<void>;
}

export function useRecording(opts: UseRecordingOptions) {
    const { transcriptText, setProcessing, setTranscript } = useStore();
    const [aiStatus, setAiStatus] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const isRec = phase === 'recording';
    const isProc = phase === 'processing';
    const isIdle = phase === 'idle';
    const phaseRef = useRef<Phase>('idle');
    const lastTriggerTime = useRef<number>(0);

    useEffect(() => { phaseRef.current = phase; }, [phase]);

    // Stable refs so event listeners don't re-subscribe on every value change
    const autoPasteRef = useRef(opts.autoPaste);
    useEffect(() => { autoPasteRef.current = opts.autoPaste; }, [opts.autoPaste]);

    const appLanguageRef = useRef(opts.appLanguage);
    useEffect(() => { appLanguageRef.current = opts.appLanguage; }, [opts.appLanguage]);

    const triggerStart = useCallback(() => {
        setTranscript('');
        setAiStatus('');
        setPhase('recording');
        invoke('start_recording').catch(err => {
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        });
    }, [setTranscript]);

    const triggerStop = useCallback(async () => {
        setPhase('processing');
        setProcessing(true);
        try {
            const rawText = await invoke<string>('stop_recording');

            let processedText = rawText;
            if (rawText && (rawText.startsWith('{') || rawText.startsWith('['))) {
                try {
                    const parsed = JSON.parse(rawText);
                    processedText = parsed.content || parsed.text || rawText;
                } catch {
                    // Response looks like JSON but parsing failed, use as raw string
                }
            }

            if (processedText) {
                const cleanedText = cleanHallucinations(processedText);
                if (cleanedText) {
                    setTranscript(cleanedText);
                    if (autoPasteRef.current) {
                        handlePaste(cleanedText);
                        return;
                    }
                    setPhase('result');
                } else {
                    setPhase('idle');
                }
            } else {
                setPhase('idle');
            }
        } catch (err) {
            if (err === 'ALREADY_IDLE') return;
            console.error('stop_recording failed:', err);
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        } finally {
            setProcessing(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setTranscript, setProcessing]);

    const handlePaste = useCallback(async (explicitText?: string) => {
        const textToPaste = (typeof explicitText === 'string') ? explicitText : transcriptText;
        if (!textToPaste) return;
        try {
            setProcessing(true);
            await invoke('paste_text', { text: textToPaste });
            if (opts.clearOnPaste) setTranscript('');
            setPhase('idle');
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.setAlwaysOnTop(opts.alwaysOnTop);
            await win.hide();
        } catch (err) {
            console.error(err);
            const msg = appLanguageRef.current === 'ru' ? 'Ошибка вставки' : 'Paste error';
            setTranscript(`[${msg}: ${err}]`);
        } finally {
            setProcessing(false);
        }
    }, [transcriptText, opts.clearOnPaste, setTranscript, setProcessing, opts.alwaysOnTop]);

    const handleCopy = useCallback(async (explicitText?: string) => {
        const text = explicitText || transcriptText;
        if (text) {
            const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
            await writeText(text);
        }
    }, [transcriptText]);

    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        if (selectedText.length > 0) {
            handleCopy(selectedText);
            setAiStatus('✓ Скопировано!');
            setTimeout(() => setAiStatus(''), 600);
        }
    }, [handleCopy]);

    // Stable refs for event listeners
    const handlersRefs = useRef({ triggerStart, triggerStop, handlePaste, updateTarget: opts.updateTarget });
    useEffect(() => {
        handlersRefs.current = { triggerStart, triggerStop, handlePaste, updateTarget: opts.updateTarget };
    }, [triggerStart, triggerStop, handlePaste, opts.updateTarget]);

    return {
        phase, setPhase, phaseRef,
        aiStatus, setAiStatus,
        isRec, isProc, isIdle,
        triggerStart, triggerStop, handlePaste,
        handleCopy, handleTextSelection,
        lastTriggerTime,
        autoPasteRef, appLanguageRef, handlersRefs,
    };
}
