import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    isProcessing: boolean;
    transcriptText: string;
    compactResultWindow: boolean;
    liveStreamPreview: boolean;
    setProcessing: (processing: boolean) => void;
    setTranscript: (textOrFn: string | ((prev: string) => string)) => void;
    setCompactResultWindow: (val: boolean) => void;
    setLiveStreamPreview: (val: boolean) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            isProcessing: false,
            transcriptText: "",
            compactResultWindow: false,
            liveStreamPreview: true,
            setProcessing: (processing) => set({ isProcessing: processing }),
            setTranscript: (textOrFn) => set((state) => ({
                transcriptText: typeof textOrFn === 'function' ? textOrFn(state.transcriptText) : textOrFn
            })),
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

