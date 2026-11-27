import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';

export function normalizeVersion(version: string): string {
    return version.trim().replace(/^v/i, '');
}

export function parseBilingualNotes(raw: string): { en: string; ru: string } {
    if (!raw) return { en: '', ru: '' };
    const parts = raw.split(/\n---\n/);
    if (parts.length < 2) return { en: raw, ru: raw };
    const enPart = parts[0].trim();
    const ruPart = parts.slice(1).join('\n---\n').trim();
    return { en: enPart, ru: ruPart };
}

/**
 * Checks for an app update via tauri-plugin-updater and syncs the tray indicator.
 */
export async function checkAppUpdate(): Promise<Update | null> {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
        return null;
    }

    const update = await check();
    if (update?.available) {
        const cleanVersion = normalizeVersion(update.version);
        await invoke('set_tray_update_available', { version: cleanVersion }).catch(() => {});
        return update;
    }

    await invoke('set_tray_update_available', { version: null }).catch(() => {});
    return null;
}
