import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    isProcessing: boolean;
    transcriptText: string;
    committedText: string;
    draftText: string;
    compactResultWindow: boolean;
    liveStreamPreview: boolean;
    setProcessing: (processing: boolean) => void;
    setTranscript: (textOrFn: string | ((prev: string) => string)) => void;
    setStreamChunks: (chunks: { committed?: string; draft?: string; text?: string }) => void;
    setCompactResultWindow: (val: boolean) => void;
    setLiveStreamPreview: (val: boolean) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            isProcessing: false,
            transcriptText: "",
            committedText: "",
            draftText: "",
            compactResultWindow: false,
            liveStreamPreview: true,
            setProcessing: (processing) => set({ isProcessing: processing }),
            setTranscript: (textOrFn) => set((state) => {
                const next = typeof textOrFn === 'function' ? textOrFn(state.transcriptText) : textOrFn;
                return {
                    transcriptText: next,
                    committedText: next,
                    draftText: "",
                };
            }),
            setStreamChunks: ({ committed, draft, text }) => set((state) => {
                const c = committed !== undefined ? committed : state.committedText;
                const d = draft !== undefined ? draft : state.draftText;
                const full = text !== undefined ? text : (c ? (d ? `${c} ${d}` : c) : d);
                return {
                    committedText: c,
                    draftText: d,
                    transcriptText: full,
                };
            }),
            setCompactResultWindow: (compactResultWindow) => set({ compactResultWindow }),
            setLiveStreamPreview: (liveStreamPreview) => set({ liveStreamPreview })
        }),
        {
            name: 'nyx-vox-ui-settings',
            partialize: (state) => ({ 
                compactResultWindow: state.compactResultWindow,
                liveStreamPreview: state.liveStreamPreview,
            }),
        }
    )
);

