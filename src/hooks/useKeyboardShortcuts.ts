import { useEffect } from 'react';
import type { Phase } from '@/lib/types';
import type { MutableRefObject } from 'react';

export interface UseKeyboardShortcutsOptions {
    handlePaste: () => Promise<void>;
    setTranscript: (text: string) => void;
    setPhase: (phase: Phase) => void;
    phaseRef: MutableRefObject<Phase>;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const currentPhase = opts.phaseRef.current;
            if (currentPhase === 'result' || currentPhase === 'editing') {
                if (e.key === 'Enter') {
                    // In 'result' mode, plain Enter pastes.
                    // In 'editing' mode, plain Enter pastes too (the user
                    // expects Enter to send the edited text), while
                    // Cmd/Ctrl+Enter remains a modifier shortcut.
                    e.preventDefault();
                    opts.handlePaste();
                }
                if (e.key === 'Escape') {
                    opts.setTranscript('');
                    opts.setPhase('idle');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
