import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '@/store/useStore';

/**
 * useAudioRecorder — Offline Whisper Edition
 *
 * Recording lifecycle:
 *   startRecording → invoke('start_whisper_recording') → Rust cpal captures mic
 *   stopRecording  → invoke('stop_whisper_recording')  → Rust runs Whisper → returns text
 *
 * No WebSocket, no API keys, no network. 100% offline.
 */
export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const { setTranscript, setProcessing } = useStore();

    const startRecording = useCallback(async () => {
        try {
            setIsRecording(true);
            await invoke('start_whisper_recording');
        } catch (err) {
            console.error('Failed to start recording:', err);
            const msg = err instanceof Error ? err.message : String(err);

            // Model not downloaded yet — give a clear actionable message
            if (msg.includes('model not found') || msg.includes('download-model')) {
                setTranscript(
                    '⚠️ Model not found. Run: cd src-tauri && bash download-model.sh'
                );
            } else {
                setTranscript(`Error: ${msg}`);
            }
            setIsRecording(false);
        }
    }, [setTranscript]);

    const stopRecording = useCallback(async () => {
        if (!isRecording) return;

        setIsRecording(false);
        setProcessing(true);

        try {
            const text = await invoke<string>('stop_whisper_recording');
            if (text && text.trim()) {
                setTranscript((prev: string) => {
                    if (!prev.trim()) return text.trim();
                    return prev.trimEnd() + ' ' + text.trim();
                });
            }
        } catch (err) {
            console.error('Transcription error:', err);
            const msg = err instanceof Error ? err.message : String(err);
            setTranscript(`Transcription error: ${msg}`);
        } finally {
            setProcessing(false);
        }
    }, [isRecording, setTranscript, setProcessing]);

    return { isRecording, startRecording, stopRecording };
};
