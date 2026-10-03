import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tauri-apps/api/core')>();
    return {
        ...actual,
        invoke: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn().mockResolvedValue(vi.fn()),
}));

// Enable __TAURI_INTERNALS__ so hook treats window as running in Tauri
Object.assign(window, {
    __TAURI_INTERNALS__: {
        metadata: {
            currentWindow: {
                label: 'main',
            },
        },
        invoke: vi.fn().mockResolvedValue(undefined),
    },
});

const { useWindowManager } = await import('./useWindowManager');

describe('useWindowManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('does not re-invoke IPC if target size and onTop remain identical (FE-3 storm prevention)', async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        const opts = {
            phase: 'recording' as const,
            isIdle: false,
            isOverlay: false,
            isCompact: false,
            compactResultWindow: false,
            liveStreamPreview: true,
            isVisible: true,
            showSettings: false,
            showWelcome: false,
            showQuickMenu: false,
            alwaysOnTop: true,
            transcriptTextLength: 0,
        };

        const { result, rerender } = renderHook(
            (props) => useWindowManager(props),
            { initialProps: opts }
        );

        // Initial mount triggers resizeWindow(320, 48) via auto-resize effect
        await vi.waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('resize_window', { width: 320, height: 48, center: true });
        });

        vi.mocked(invoke).mockClear();

        // Calling resizeWindow with identical size should be skipped immediately (FE-3)
        await result.current.resizeWindow(320, 48);
        expect(invoke).not.toHaveBeenCalled();

        // Streaming text changes transcriptTextLength repeatedly during recording
        rerender({ ...opts, transcriptTextLength: 15 });
        rerender({ ...opts, transcriptTextLength: 40 });
        rerender({ ...opts, transcriptTextLength: 85 });

        // Zero WindowServer IPC calls triggered during streaming speech!
        expect(invoke).not.toHaveBeenCalled();
    });

    it('performs resize when dimensions change', async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        const opts = {
            phase: 'recording' as const,
            isIdle: false,
            isOverlay: false,
            isCompact: false,
            compactResultWindow: false,
            liveStreamPreview: true,
            isVisible: true,
            showSettings: false,
            showWelcome: false,
            showQuickMenu: false,
            alwaysOnTop: true,
            transcriptTextLength: 0,
        };

        const { result } = renderHook(() => useWindowManager(opts));

        await vi.waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('resize_window', { width: 320, height: 48, center: true });
        });

        vi.mocked(invoke).mockClear();

        // Change to settings dimensions (620, 680)
        await result.current.resizeWindow(620, 680);
        expect(invoke).toHaveBeenCalledWith('resize_window', { width: 620, height: 680, center: true });
    });
});
