import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockResolvedValue(undefined),
}));

const { useSettings } = await import('./useSettings');

describe('useSettings', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('updates audioGain state immediately and debounces IPC call (FE-8)', async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        const { result } = renderHook(() => useSettings());

        // Initial audioGain is 2.0
        expect(result.current.audioGain).toBe(2.0);

        // User rapidly drags slider
        act(() => {
            result.current.handleSetAudioGain(1.5);
        });
        expect(result.current.audioGain).toBe(1.5);
        expect(invoke).not.toHaveBeenCalled();

        act(() => {
            result.current.handleSetAudioGain(2.0);
        });
        expect(result.current.audioGain).toBe(2.0);
        expect(invoke).not.toHaveBeenCalled();

        act(() => {
            result.current.handleSetAudioGain(2.5);
        });
        expect(result.current.audioGain).toBe(2.5);
        expect(invoke).not.toHaveBeenCalled();

        // Advance timers by 299ms - should still not be called
        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(invoke).not.toHaveBeenCalled();

        // Advance 1ms more to reach 300ms debounce
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith('set_audio_gain', { gain: 2.5 });
    });

    it('updates noiseGate state immediately and debounces IPC call (FE-8)', async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        const { result } = renderHook(() => useSettings());

        act(() => {
            result.current.handleSetNoiseGate(0.005);
        });
        expect(result.current.noiseGate).toBe(0.005);
        expect(invoke).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith('set_noise_gate', { value: 0.005 });
    });

    it('updates vadSilenceTimeout state immediately and debounces IPC call (FE-8)', async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        const { result } = renderHook(() => useSettings());

        act(() => {
            result.current.handleSetVadSilenceTimeout(10.0);
        });
        expect(result.current.vadSilenceTimeout).toBe(10.0);
        expect(invoke).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith('set_vad_silence_timeout', { timeout: 10.0 });
    });
});
