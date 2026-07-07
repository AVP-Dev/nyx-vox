import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '@/store/useStore';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const { setTranscript, setProcessing } = useStore();

    const startRecording = useCallback(async () => {
        try {
            setIsRecording(true);
            await invoke('start_recording');
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
            setProcessing(false);
        }
    }, [setTranscript, setProcessing]);

    const stopRecording = useCallback(async () => {
        if (!isRecording) return;

        setIsRecording(false);
        setProcessing(true);

        try {
            const text = await invoke<string>('stop_recording');
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
