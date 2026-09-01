/**
 * Clean Whisper hallucinations and junk phrases from transcribed text.
 * Pure function — no side effects beyond console logging.
 */
export function cleanHallucinations(t: string | undefined | null): string {
    if (!t) {
        return '';
    }
    let text = t.trim();

    // Remove common Whisper hallucinations and junk phrases
    const junkPhrases = [
        // Music/sound markers
        '[music]', '[silence]', '[noise]',
        '♪', '♫', '♬', '♭', '♮',
        '(музыка)', '(тишина)', '(шум)', '(аплодисменты)',
        '(Music)', '(Silence)', '(Laughter)', '(Applause)',

        // Subtitle credits
        'subtitles by', 'transcribed by', 'copyright',
        'редактор субтитров', 'автор субтитров', 'translated by',

        // Common hallucinations
        'DimaTorzok', 'Dima Torzok', 'Hoje pursui', 'pursui', 'uvoir', 'Não mais', 'Today pursui',
        'продолжение следует', 'to be continued',
        'amara.org', 'amara',
        'тебя отдаю code', 'увидеть şunu с',

        // YouTube/video endings
        'подпишитесь на канал', 'спасибо за просмотр', 'с вами был',

        // Technical markers
        'end of transcript', 'transcript end', 'конец записи',
    ];

    const lowerText = text.toLowerCase();
    for (const phrase of junkPhrases) {
        const lowerPhrase = phrase.toLowerCase();
        if (lowerText.includes(lowerPhrase)) {
            text = text.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
        }
    }

    // Clean up multiple spaces and trim
    text = text.replace(/\s+/g, ' ').trim();

    // Remove trailing incomplete sentence markers
    const trailingJunk = ['...', '—', '–', '…'];
    for (const junk of trailingJunk) {
        if (text.endsWith(junk)) {
            text = text.slice(0, text.lastIndexOf(junk)).trim();
        }
    }

    // If text has no letters or numbers (only punctuation/symbols), return empty
    if (!text || !/[a-zA-Zа-яА-ЯёЁ0-9]/.test(text)) {
        return '';
    }

    // Capitalize first letter of cleaned text
    text = text.charAt(0).toUpperCase() + text.slice(1);

    return text;
}

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

