import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage for zustand persist middleware
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Dynamic import after mocking so zustand persist picks up the mock
const { useStore } = await import('./useStore');

describe('useStore', () => {
    beforeEach(() => {
        localStorageMock.clear();
        useStore.setState({
            isProcessing: false,
            transcriptText: '',
            compactResultWindow: false,
        });
    });

    // ── Initial state ─────────────────────────────────────────────────────

    it('has correct initial state', () => {
        const state = useStore.getState();
        expect(state.isProcessing).toBe(false);
        expect(state.transcriptText).toBe('');
        expect(state.compactResultWindow).toBe(false);
    });

    // ── setProcessing ─────────────────────────────────────────────────────

    it('setProcessing(true) sets isProcessing to true', () => {
        useStore.getState().setProcessing(true);
        expect(useStore.getState().isProcessing).toBe(true);
    });

    it('setProcessing(false) sets isProcessing to false', () => {
        useStore.getState().setProcessing(true);
        useStore.getState().setProcessing(false);
        expect(useStore.getState().isProcessing).toBe(false);
    });

    // ── setTranscript ─────────────────────────────────────────────────────

    it('setTranscript with string sets transcriptText', () => {
        useStore.getState().setTranscript('hello world');
        expect(useStore.getState().transcriptText).toBe('hello world');
    });

    it('setTranscript with empty string clears transcriptText', () => {
        useStore.getState().setTranscript('hello');
        useStore.getState().setTranscript('');
        expect(useStore.getState().transcriptText).toBe('');
    });

    it('setTranscript with function uses previous value', () => {
        useStore.getState().setTranscript('hello');
        useStore.getState().setTranscript(prev => prev + ' world');
        expect(useStore.getState().transcriptText).toBe('hello world');
    });

    it('setTranscript with function receives empty string initially', () => {
        useStore.getState().setTranscript(prev => `was: "${prev}"`);
        expect(useStore.getState().transcriptText).toBe('was: ""');
    });

    // ── setCompactResultWindow ────────────────────────────────────────────

    it('setCompactResultWindow(true) sets compactResultWindow', () => {
        useStore.getState().setCompactResultWindow(true);
        expect(useStore.getState().compactResultWindow).toBe(true);
    });

    it('setCompactResultWindow(false) resets compactResultWindow', () => {
        useStore.getState().setCompactResultWindow(true);
        useStore.getState().setCompactResultWindow(false);
        expect(useStore.getState().compactResultWindow).toBe(false);
    });

    // ── Independence ──────────────────────────────────────────────────────

    it('setProcessing does not affect transcriptText', () => {
        useStore.getState().setTranscript('hello');
        useStore.getState().setProcessing(true);
        expect(useStore.getState().transcriptText).toBe('hello');
    });

    it('setTranscript does not affect isProcessing', () => {
        useStore.getState().setProcessing(true);
        useStore.getState().setTranscript('hello');
        expect(useStore.getState().isProcessing).toBe(true);
    });
});
