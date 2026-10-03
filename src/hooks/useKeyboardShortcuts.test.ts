import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { Phase } from '@/lib/types';

describe('useKeyboardShortcuts', () => {
    let handlePaste: ReturnType<typeof vi.fn>;
    let setTranscript: ReturnType<typeof vi.fn>;
    let setPhase: ReturnType<typeof vi.fn>;
    let phaseRef: { current: Phase };

    beforeEach(() => {
        handlePaste = vi.fn().mockResolvedValue(undefined);
        setTranscript = vi.fn();
        setPhase = vi.fn();
        phaseRef = { current: 'idle' };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('ignores Enter when in idle or recording phase', () => {
        phaseRef.current = 'idle';
        renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));

        const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        window.dispatchEvent(event);

        expect(handlePaste).not.toHaveBeenCalled();
    });

    it('calls handlePaste on plain Enter in result phase', () => {
        phaseRef.current = 'result';
        renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));

        const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        const stopSpy = vi.spyOn(event, 'stopPropagation');

        window.dispatchEvent(event);

        expect(handlePaste).toHaveBeenCalledTimes(1);
        expect(preventSpy).toHaveBeenCalled();
        expect(stopSpy).toHaveBeenCalled();
    });

    it('calls handlePaste on plain Enter in editing phase (FE-2)', () => {
        phaseRef.current = 'editing';
        renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));

        const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false, cancelable: true });
        const preventSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(handlePaste).toHaveBeenCalledTimes(1);
        expect(preventSpy).toHaveBeenCalled();
    });

    it('does NOT call handlePaste and does NOT preventDefault on Shift+Enter in editing phase (FE-2)', () => {
        phaseRef.current = 'editing';
        renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));

        const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
        const preventSpy = vi.spyOn(event, 'preventDefault');
        const stopSpy = vi.spyOn(event, 'stopPropagation');

        window.dispatchEvent(event);

        expect(handlePaste).not.toHaveBeenCalled();
        expect(preventSpy).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled();
    });

    it('resets transcript and phase on Escape', () => {
        phaseRef.current = 'result';
        renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);

        expect(setTranscript).toHaveBeenCalledWith('');
        expect(setPhase).toHaveBeenCalledWith('idle');
    });

    it('removes window event listener on unmount', () => {
        phaseRef.current = 'result';
        const { unmount } = renderHook(() => useKeyboardShortcuts({ handlePaste, setTranscript, setPhase, phaseRef }));
        unmount();

        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        window.dispatchEvent(event);

        expect(handlePaste).not.toHaveBeenCalled();
    });
});
