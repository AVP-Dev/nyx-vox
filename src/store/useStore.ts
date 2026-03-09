import { create } from 'zustand';

interface AppState {
    isRecording: boolean;
    isProcessing: boolean;
    transcriptText: string;
    language: 'ru' | 'en';
    setRecording: (recording: boolean) => void;
    setProcessing: (processing: boolean) => void;
    setTranscript: (textOrFn: string | ((prev: string) => string)) => void;
    setLanguage: (lang: 'ru' | 'en') => void;
}

export const useStore = create<AppState>((set) => ({
    isRecording: false,
    isProcessing: false,
    transcriptText: "",
    language: "ru",
    setRecording: (recording) => set({ isRecording: recording }),
    setProcessing: (processing) => set({ isProcessing: processing }),
    setTranscript: (textOrFn) => set((state) => ({
        transcriptText: typeof textOrFn === 'function' ? textOrFn(state.transcriptText) : textOrFn
    })),
    setLanguage: (lang) => set({ language: lang }),
}));
