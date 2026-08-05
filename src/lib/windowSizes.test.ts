import { describe, it, expect } from 'vitest';
import { computeResultHeight, resolveWindowSize, WINDOW_SIZES } from './windowSizes';

describe('computeResultHeight', () => {
    it('returns base + 1 row for empty text (max(1, rows) always >= 1)', () => {
        // Math.max(1, ceil(0/36)) = 1 row → 160 + 1*20 = 180
        expect(computeResultHeight(0)).toBe(180);
    });

    it('returns base + 1 row for short text', () => {
        expect(computeResultHeight(10)).toBe(180);
    });

    it('scales proportionally for medium text', () => {
        // 72 chars = 2 rows → 160 + 2*20 = 200
        expect(computeResultHeight(72)).toBe(200);
    });

    it('returns max height for very long text', () => {
        expect(computeResultHeight(10000)).toBe(500);
    });

    it('clamps to base + 1 row for negative input', () => {
        expect(computeResultHeight(-100)).toBe(180);
    });

    it('calculates correct height for 1 row (36 chars)', () => {
        // 36 chars = 1 row → 160 + 1*20 = 180
        expect(computeResultHeight(36)).toBe(180);
    });

    it('calculates correct height for 10 rows (360 chars)', () => {
        // 360 chars = 10 rows → 160 + 10*20 = 360
        expect(computeResultHeight(360)).toBe(360);
    });
});

describe('resolveWindowSize', () => {
    const baseParams = {
        phase: 'idle' as const,
        isIdle: true,
        isOverlay: false,
        isCompact: false,
        compactResultWindow: false,
        showSettings: false,
        showWelcome: false,
        showQuickMenu: false,
        transcriptTextLength: 0,
    };

    it('returns settings size when showSettings is true', () => {
        const result = resolveWindowSize({ ...baseParams, showSettings: true });
        expect(result).toEqual([...WINDOW_SIZES.settings]);
    });

    it('returns welcome size when showWelcome is true', () => {
        const result = resolveWindowSize({ ...baseParams, showWelcome: true });
        expect(result).toEqual([...WINDOW_SIZES.welcome]);
    });

    it('returns overlay size when isOverlay is true', () => {
        const result = resolveWindowSize({ ...baseParams, isOverlay: true });
        expect(result).toEqual([...WINDOW_SIZES.overlay]);
    });

    it('returns quickMenu size when showQuickMenu and isIdle', () => {
        const result = resolveWindowSize({ ...baseParams, showQuickMenu: true });
        expect(result).toEqual([...WINDOW_SIZES.quickMenu]);
    });

    it('returns editing size when phase is editing', () => {
        const result = resolveWindowSize({ ...baseParams, phase: 'editing', isIdle: false });
        expect(result).toEqual([...WINDOW_SIZES.editing]);
    });

    it('returns dynamic result size when phase is result and not compact', () => {
        const result = resolveWindowSize({
            ...baseParams,
            phase: 'result',
            isIdle: false,
            transcriptTextLength: 100,
        });
        expect(result[0]).toBe(WINDOW_SIZES.resultBase[0]);
        expect(result[1]).toBe(computeResultHeight(100));
    });

    it('returns idle size when idle', () => {
        const result = resolveWindowSize(baseParams);
        expect(result).toEqual([...WINDOW_SIZES.idle]);
    });

    it('returns compact 48x48 when compactResultWindow is true and idle', () => {
        const result = resolveWindowSize({ ...baseParams, compactResultWindow: true });
        expect(result).toEqual([48, 48]);
    });

    it('ignores compactResultWindow when quickMenu is open', () => {
        const result = resolveWindowSize({ ...baseParams, compactResultWindow: true, showQuickMenu: true });
        expect(result).toEqual([...WINDOW_SIZES.quickMenu]);
    });

    it('returns recording size when recording', () => {
        const result = resolveWindowSize({ ...baseParams, phase: 'recording', isIdle: false });
        expect(result).toEqual([...WINDOW_SIZES.recording]);
    });

    it('prioritizes settings over welcome', () => {
        const result = resolveWindowSize({ ...baseParams, showSettings: true, showWelcome: true });
        expect(result).toEqual([...WINDOW_SIZES.settings]);
    });

    it('prioritizes welcome over overlay', () => {
        const result = resolveWindowSize({ ...baseParams, showWelcome: true, isOverlay: true });
        expect(result).toEqual([...WINDOW_SIZES.welcome]);
    });
});
