import type { Variants } from 'framer-motion';
import { WINDOW_SIZES, computeResultHeight } from './windowSizes';

/** Fade-scale entrance for the main window wrapper */
export const windowEntrance: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 },
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

/**
 * Build the container shape-variants keyed by logical state.
 * Requires the computed result height for the "result" key.
 * `compactIdle` shrinks the idle pill into a round mic bubble.
 * `liveStreamPreview` controls whether recording uses the full text pill or compact waveform pill.
 */
export function buildContainerVariants(
    transcriptTextLength: number,
    compactIdle = false,
    liveStreamPreview = true,
): Variants {
    const resultH = computeResultHeight(transcriptTextLength);
    const recW = liveStreamPreview ? WINDOW_SIZES.recording[0] : WINDOW_SIZES.recordingCompact[0];
    return {
        idle:       { width: compactIdle ? 48 : WINDOW_SIZES.idle[0], height: 48, borderRadius: compactIdle ? 24 : 24 },
        quickMenu:  { width: WINDOW_SIZES.quickMenu[0],  height: WINDOW_SIZES.quickMenu[1],  borderRadius: 24 },
        recording:  { width: recW,  height: WINDOW_SIZES.recording[1],  borderRadius: 24 },
        result:     { width: WINDOW_SIZES.resultBase[0], height: resultH,                    borderRadius: 24 },
        editing:    { width: WINDOW_SIZES.editing[0],     height: WINDOW_SIZES.editing[1],    borderRadius: 24 },
        overlay:    { width: WINDOW_SIZES.overlay[0],     height: WINDOW_SIZES.overlay[1],    borderRadius: 24 },
        settings:   { width: WINDOW_SIZES.settings[0],    height: WINDOW_SIZES.settings[1],   borderRadius: 32 },
        welcome:    { width: WINDOW_SIZES.welcome[0],     height: WINDOW_SIZES.welcome[1],    borderRadius: 24 },
    };
}
