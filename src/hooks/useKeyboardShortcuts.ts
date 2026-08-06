import { useEffect, useRef } from 'react';
import type { Phase } from '@/lib/types';
import type { MutableRefObject } from 'react';

export interface UseKeyboardShortcutsOptions {
    handlePaste: () => Promise<void>;
    setTranscript: (text: string) => void;
    setPhase: (phase: Phase) => void;
    phaseRef: MutableRefObject<Phase>;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions) {
    // Keep the latest handler in a ref so the single event listener below
    // always calls the current handlePaste (which closes over the latest
    // transcriptText), even though the effect itself is registered once.
    const handlePasteRef = useRef(opts.handlePaste);
    useEffect(() => { handlePasteRef.current = opts.handlePaste; });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const currentPhase = opts.phaseRef.current;
            if (currentPhase === 'result' || currentPhase === 'editing') {
                if (e.key === 'Enter') {
                    // Plain Enter pastes in both 'result' and 'editing'
                    // (the user expects Enter to send the text), while
                    // Cmd/Ctrl+Enter remains a modifier shortcut.
                    e.preventDefault();
                    e.stopPropagation();
                    void handlePasteRef.current();
                }
                if (e.key === 'Escape') {
                    opts.setTranscript('');
                    opts.setPhase('idle');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
