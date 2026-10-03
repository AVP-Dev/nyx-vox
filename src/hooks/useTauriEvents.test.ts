import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UseTauriEventsOptions } from './useTauriEvents';

const { listeners, unlistenMocks } = vi.hoisted(() => ({
    listeners: new Map<string, (event: { payload: unknown }) => void>(),
    unlistenMocks: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => void) => {
        listeners.set(eventName, handler);
        const unlisten = vi.fn(() => {
            listeners.delete(eventName);
        });
        unlistenMocks.push(unlisten);
        return Promise.resolve(unlisten);
    }),
}));

const { useTauriEvents } = await import('./useTauriEvents');

describe('useTauriEvents', () => {
    let opts: UseTauriEventsOptions;

    beforeEach(() => {
        listeners.clear();
        unlistenMocks.length = 0;
        opts = {
            setTranscript: vi.fn(),
            setPhase: vi.fn(),
            setFormattingStatus: vi.fn(),
            setSttMode: vi.fn(),
            setAiStatus: vi.fn(),
            setShowSettings: vi.fn(),
            setShowWelcome: vi.fn(),
            phaseRef: { current: 'idle' },
            appLanguageRef: { current: 'ru' },
            autoPasteRef: { current: true },
            handlersRefs: {
                current: {
                    triggerStart: vi.fn().mockResolvedValue(undefined),
                    triggerStop: vi.fn().mockResolvedValue(undefined),
                    handlePaste: vi.fn().mockResolvedValue(undefined),
                    updateTarget: vi.fn().mockResolvedValue(undefined),
                },
            },
            lastTriggerTime: { current: 0 },
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('subscribes to Tauri events on mount', async () => {
        renderHook(() => useTauriEvents(opts));
        await vi.waitFor(() => expect(listeners.has('shortcut-trigger')).toBe(true));
        expect(listeners.has('ai-result')).toBe(true);
        expect(listeners.has('interim-transcription')).toBe(true);
    });

    it('passes ai-result directly without client-side hallucination filtering (FE-5 & ADR #6)', async () => {
        renderHook(() => useTauriEvents(opts));
        await vi.waitFor(() => expect(listeners.has('ai-result')).toBe(true));

        const aiResultHandler = listeners.get('ai-result');
        aiResultHandler!({ payload: 'Спасибо за внимание, доклад окончен.' });
        expect(opts.setTranscript).toHaveBeenCalledWith('Спасибо за внимание, доклад окончен.');
    });

    it('handles interim-transcription with plain string directly (FE-7)', async () => {
        opts.phaseRef.current = 'recording';
        renderHook(() => useTauriEvents(opts));
        await vi.waitFor(() => expect(listeners.has('interim-transcription')).toBe(true));

        const interimHandler = listeners.get('interim-transcription');
        interimHandler!({ payload: 'Привет мир' });
        expect(opts.setTranscript).toHaveBeenCalledWith('Привет мир');
    });

    it('cleans up all listeners on unmount (FE-1)', async () => {
        const { unmount } = renderHook(() => useTauriEvents(opts));
        await vi.waitFor(() => expect(listeners.size).toBeGreaterThan(0));

        unmount();

        await vi.waitFor(() => {
            unlistenMocks.forEach(fn => {
                expect(fn).toHaveBeenCalled();
            });
        });
    });

    it('cancels unlisteners if unmounted before listen promises resolve (FE-1 cancellation)', async () => {
        const unlistenFn = vi.fn();
        let resolvePromise!: (fn: () => void) => void;

        const { listen } = await import('@tauri-apps/api/event');
        vi.mocked(listen).mockImplementationOnce(() => new Promise((resolve) => {
            resolvePromise = resolve;
        }));

        const { unmount } = renderHook(() => useTauriEvents(opts));
        // Unmount immediately before the mock promise resolves
        unmount();

        // Now resolve the pending promise
        resolvePromise(unlistenFn);
        await vi.waitFor(() => expect(unlistenFn).toHaveBeenCalled());
    });
});
