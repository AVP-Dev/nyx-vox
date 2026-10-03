
/**
 * Splits streaming text into committed (stable) prefix and draft (floating hypothesis) tail.
 * Useful for real-time live transcription display to prevent visual jitter.
 */
export function splitCommittedAndDraft(text: string | undefined | null): { committed: string; draft: string } {
    if (!text) {
        return { committed: '', draft: '' };
    }
    const trimmed = text.trim();
    if (!trimmed) {
        return { committed: '', draft: '' };
    }
    const words = trimmed.split(/\s+/);
    if (words.length <= 2) {
        return { committed: '', draft: trimmed };
    }
    const committed = words.slice(0, -2).join(' ');
    const draft = words.slice(-2).join(' ');
    return { committed, draft };
}

