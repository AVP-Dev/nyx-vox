/**
 * Clean Whisper hallucinations and junk phrases from transcribed text.
 * Pure function — no side effects beyond console logging.
 */
export function cleanHallucinations(t: string | undefined | null): string {
    if (!t) {
        return '';
    }
    let text = t.trim();

    // Capitalize first letter
    if (text.length > 0) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Remove common Whisper hallucinations and junk phrases
    const junkPhrases = [
        // Music/sound markers
        '[music]', '[silence]', '[noise]',
        '♪', '♫', '♬', '♭', '♮',
        '(музыка)', '(тишина)', '(шум)', '(аплодисменты)',
        '(Music)', '(Silence)', '(Laughter)', '(Applause)',

        // Subtitle credits
        'subtitles by', 'transcribed by', 'copyright', 'subtitles',
        'редактор субтитров', 'субтитры', 'перевод', 'translated by', 'translation',
        'автор субтитров', 'специально для', 'благодарим за', 'для сайта',

        // Common hallucinations
        'DimaTorzok', 'Dima Torzok', 'Hoje pursui', 'pursui', 'uvoir', 'Não mais', 'Today pursui',
        'продолжение следует', 'to be continued', 'continued',
        'amara.org', 'amara', 'www.', 'http', '.com', '.ru', 'https://',
        'тебя отдаю code', 'увидеть şunu с',

        // YouTube/video endings
        'подпишитесь на канал', 'спасибо за просмотр', 'с вами был',
        'диктор', 'диктовка', 'диктовка.', 'в выпуске', 'следующий выпуск',
        'смотрите далее', 'реклама', 'спонсор', 'партнёр', 'sponsor', 'отредактировано', 'транскрибация',

        // Technical markers
        'end of transcript', 'transcript end', 'конец записи',
        'тишина', 'пауза', 'pause', 'silence',
        'неразборчиво', 'не разборчиво', 'inaudible', 'unclear',
        'аплодисменты', 'смех', 'laughter', 'applause',
        'music fades', 'music plays', 'играет музыка',

        // Random junk
        'игорь негода', 'игорь не года', 'а. кулаков', 'а. кулакова', 'кулакова'
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

    // Remove trailing incomplete sentences (common Whisper artifact)
    const trailingJunk = ['...', '—', '–', '…'];
    for (const junk of trailingJunk) {
        if (text.endsWith(junk)) {
            text = text.slice(0, text.lastIndexOf(junk)).trim();
        }
    }

    // If text is too short (less than 2 characters), return empty
    if (text.length < 2) {
        return '';
    }

    return text;
}
