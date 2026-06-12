import { create } from 'zustand';

interface AppState {
    isProcessing: boolean;
    transcriptText: string;
    setProcessing: (processing: boolean) => void;
    setTranscript: (textOrFn: string | ((prev: string) => string)) => void;
}

export const useStore = create<AppState>((set) => ({
    isProcessing: false,
    transcriptText: "",
    setProcessing: (processing) => set({ isProcessing: processing }),
    setTranscript: (textOrFn) => set((state) => ({
        transcriptText: typeof textOrFn === 'function' ? textOrFn(state.transcriptText) : textOrFn
    })),
}));
