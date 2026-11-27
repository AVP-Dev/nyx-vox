import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeVersion, parseBilingualNotes, checkAppUpdate } from './updater';

const mockInvoke = vi.fn();
const mockCheck = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
    check: () => mockCheck(),
}));

describe('updater helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (window as unknown as { __TAURI_INTERNALS__?: Record<string, unknown> }).__TAURI_INTERNALS__ = {};
        mockInvoke.mockResolvedValue(undefined);
    });

    it('normalizes version strings by trimming and stripping leading v', () => {
        expect(normalizeVersion('v1.7.0')).toBe('1.7.0');
        expect(normalizeVersion(' V2.0.1 ')).toBe('2.0.1');
        expect(normalizeVersion('1.6.1')).toBe('1.6.1');
    });

    it('parses bilingual release notes split by ---', () => {
        const notes = 'English notes\n---\nРусские заметки';
        expect(parseBilingualNotes(notes)).toEqual({
            en: 'English notes',
            ru: 'Русские заметки',
        });
    });

    it('returns full text for both languages when separator is missing', () => {
        expect(parseBilingualNotes('Single language')).toEqual({
            en: 'Single language',
            ru: 'Single language',
        });
        expect(parseBilingualNotes('')).toEqual({ en: '', ru: '' });
    });

    it('updates tray when an update is available', async () => {
        const fakeUpdate = { available: true, version: 'v1.7.0' };
        mockCheck.mockResolvedValue(fakeUpdate);

        const result = await checkAppUpdate();
        expect(result).toBe(fakeUpdate);
        expect(mockInvoke).toHaveBeenCalledWith('set_tray_update_available', {
            version: '1.7.0',
        });
    });

    it('clears tray update indicator when no update is available', async () => {
        mockCheck.mockResolvedValue(null);

        const result = await checkAppUpdate();
        expect(result).toBeNull();
        expect(mockInvoke).toHaveBeenCalledWith('set_tray_update_available', {
            version: null,
        });
    });
});
