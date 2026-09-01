import { useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { resolveWindowSize } from '@/lib/windowSizes';
import type { Phase } from '@/lib/types';

export interface UseWindowManagerOptions {
    phase: Phase;
    isIdle: boolean;
    isOverlay: boolean;
    isCompact: boolean;
    compactResultWindow: boolean;
    liveStreamPreview?: boolean;
    isVisible: boolean;
    showSettings: boolean;
    showWelcome: boolean;
    showQuickMenu: boolean;
    alwaysOnTop: boolean;
    transcriptTextLength: number;
}

export function useWindowManager(opts: UseWindowManagerOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    const resizeWindow = useCallback(async (w: number, h: number) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            if (!lastPos.current) {
                await invoke('resize_window', { width: w, height: h, center: true });
            } else {
                const scale = await win.scaleFactor();
                const logCenterX = lastPos.current.x / scale;
                const logTopY = lastPos.current.y / scale;
                const newX = logCenterX - (w / 2);
                await win.setSize(new LogicalSize(w, h));
                await win.setPosition(new LogicalPosition(newX, logTopY));
            }

            const shouldBeOnTop = (opts.phase === 'recording' || opts.phase === 'processing' || opts.phase === 'result') ? true : opts.alwaysOnTop;
            await win.setAlwaysOnTop(shouldBeOnTop);
        } catch (err) {
            console.error('Window management error:', err);
        }
    }, [opts.alwaysOnTop, opts.phase]);

    // Listen for window movement
    useEffect(() => {
        let unlistenMove: (() => void) | null = null;
        let unlistenReset: (() => void) | null = null;

        const setup = async () => {
            if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            unlistenMove = await listen('tauri://move', async () => {
                const pos = await win.outerPosition();
                const size = await win.outerSize();
                if (size.width > 0) {
                    lastPos.current = { x: pos.x + size.width / 2, y: pos.y };
                }
            });

            unlistenReset = await listen('reset-position', () => {
                lastPos.current = null;
            });
        };

        setup();
        return () => {
            if (unlistenMove) unlistenMove();
            if (unlistenReset) unlistenReset();
        };
    }, []);

    // Auto-resize when UI state changes
    useEffect(() => {
        if (!opts.isVisible) return;
        const [w, h] = resolveWindowSize({
            phase: opts.phase,
            isIdle: opts.isIdle,
            isOverlay: opts.isOverlay,
            isCompact: opts.isCompact,
            compactResultWindow: opts.compactResultWindow,
            liveStreamPreview: opts.liveStreamPreview,
            showSettings: opts.showSettings,
            showWelcome: opts.showWelcome,
            showQuickMenu: opts.showQuickMenu,
            transcriptTextLength: opts.transcriptTextLength,
        });
        resizeWindow(w, h);
    }, [
        opts.phase, opts.isIdle, opts.isOverlay, opts.isCompact,
        opts.compactResultWindow, opts.liveStreamPreview,
        opts.isVisible, opts.showSettings, opts.showWelcome,
        opts.showQuickMenu, opts.transcriptTextLength, resizeWindow,
    ]);

    return { containerRef, scrollRef, resizeWindow };
}
