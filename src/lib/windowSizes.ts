import type { Phase } from './types';

/** Static window size presets [width, height] by UI state */
export const WINDOW_SIZES = {
    idle: [150, 48] as const,
    compactIdle: [48, 48] as const,
    recording: [320, 48] as const,
    recordingCompact: [220, 48] as const,
    quickMenu: [200, 230] as const,
    editing: [400, 360] as const,
    overlay: [440, 540] as const,
    settings: [620, 680] as const,
    welcome: [580, 560] as const,
    resultBase: [400, 160] as const,
} as const;

/** Character width estimate for result height calculation */
const RESULT_CHARS_PER_ROW = 36;
const RESULT_ROW_HEIGHT = 20;
const RESULT_MIN_HEIGHT = 160;
const RESULT_MAX_HEIGHT = 500;

/**
 * Compute the dynamic result pane height based on transcript text length.
 * Returns a clamped pixel height.
 */
export function computeResultHeight(textLength: number): number {
    const rows = Math.max(1, Math.ceil(textLength / RESULT_CHARS_PER_ROW));
    const calcH = RESULT_MIN_HEIGHT + (rows * RESULT_ROW_HEIGHT);
    return Math.min(RESULT_MAX_HEIGHT, Math.max(RESULT_MIN_HEIGHT, calcH));
}

interface WindowSizeParams {
    phase: Phase;
    isIdle: boolean;
    isOverlay: boolean;
    isCompact: boolean;
    compactResultWindow: boolean;
    liveStreamPreview?: boolean;
    showSettings: boolean;
    showWelcome: boolean;
    showQuickMenu: boolean;
    transcriptTextLength: number;
}

/**
 * Resolve the window [width, height] for the current UI state.
 */
export function resolveWindowSize(params: WindowSizeParams): [number, number] {
    const {
        phase, isIdle, isOverlay, isCompact,
        compactResultWindow, liveStreamPreview = true,
        showSettings, showWelcome, showQuickMenu,
        transcriptTextLength,
    } = params;

    if (showSettings) return [...WINDOW_SIZES.settings];
    if (showWelcome) return [...WINDOW_SIZES.welcome];
    if (isOverlay) return [...WINDOW_SIZES.overlay];
    if (showQuickMenu && isIdle) return [...WINDOW_SIZES.quickMenu];
    if (phase === 'editing') return [...WINDOW_SIZES.editing];
    if (phase === 'result' && !isCompact) {
        return [WINDOW_SIZES.resultBase[0], computeResultHeight(transcriptTextLength)];
    }
    if (isIdle) return compactResultWindow ? [...WINDOW_SIZES.compactIdle] : [...WINDOW_SIZES.idle];
    if ((phase === 'recording' || phase === 'processing') && !liveStreamPreview) {
        return [...WINDOW_SIZES.recordingCompact];
    }
    return [...WINDOW_SIZES.recording];
}

