// whisper/transcribe.rs — Whisper inference + hallucination filtering
//
// Runs the actual Whisper transcription on cached model state and applies
// post-processing: hallucination filtering and ALL CAPS normalization.

use whisper_rs::FullParams;

use crate::state::WhisperModelType;

// ── Hallucination patterns ──────────────────────────────────────────────────
//
// Common Whisper hallucination patterns. These are checked against each
// segment after transcription. Exact matches and high-overlap substring
// matches are filtered.

const HALLUCINATION_PATTERNS: &[&str] = &[
    "[music]",
    "[silence]",
    "[noise]",
    "[ music ]",
    "[ silence ]",
    "♪",
    "♫",
    "♬",
    "♭",
    "♮",
    "[ ♪ ]",
    "(музыка)",
    "(тишина)",
    "(шум)",
    "(аплодисменты)",
    "(Music)",
    "(Silence)",
    "(Laughter)",
    "(Applause)",
    "[BLANK_AUDIO]",
    "[blank_audio]",
    "[BLANK]",
    "[blank]",
    "[AUDIO]",
    "[audio]",
    "BLANK_AUDIO",
    "blank audio",
    "subtitles by",
    "transcribed by",
    "copyright",
    "subtitles",
    "www.",
    "http",
    ".com",
    ".ru",
    "https://",
    "редактор субтитров",
    "кулакова",
    "игорь негода",
    "игорь не года",
    "а. кулаков",
    "а. кулакова",
    "диктор",
    "подпишитесь на канал",
    "спасибо за просмотр",
    "с вами был",
    "диктовка",
    "диктовка.",
    "DimaTorzok",
    "Dima Torzok",
    "Hoje pursui",
    "pursui",
    "uvoir",
    "продолжение следует",
    "to be continued",
    "continued",
    "subtitles by amara.org",
    "amara.org",
    "amara",
    "субтитры",
    "перевод",
    "translated by",
    "translation",
    "специально для",
    "благодарим за",
    "автор субтитров",
    "в выпуске",
    "следующий выпуск",
    "смотрите далее",
    "реклама",
    "спонсор",
    "партнёр",
    "sponsor",
    "end of transcript",
    "transcript end",
    "конец записи",
    "тишина",
    "пауза",
    "pause",
    "silence",
    "неразборчиво",
    "не разборчиво",
    "inaudible",
    "unclear",
    "аплодисменты",
    "смех",
    "laughter",
    "applause",
    "music fades",
    "music plays",
    "играет музыка",
    "ИНТРИГУЮЩАЯ МУЗЫКА",
    "интригующая музыка",
    "intriguing music",
    "[ИНТРИГУЮЩАЯ МУЗЫКА]",
    "[интригующая музыка]",
    "[intriguing music]",
    "НАПРЯЖЁННАЯ МУЗЫКА",
    "напряжённая музыка",
    "tense music",
    "[НАПРЯЖЁННАЯ МУЗЫКА]",
    "[напряжённая музыка]",
    "[tense music]",
];

// ── Constants ───────────────────────────────────────────────────────────────

/// Vocabulary hint for technical terms used in initial_prompt.
const VOCAB_HINT: &str = "GitHub, GitLab, Node, Node.js, Bun, npm, API, CLI, JSON, TypeScript, JavaScript, React, Next.js, Docker, Linux, macOS, Tauri, DeepSeek, Groq, Whisper, Antigravity";

/// Ratio threshold for ALL CAPS detection (0.0–1.0).
const ALL_CAPS_THRESHOLD: f32 = 0.8;
/// Ratio threshold for hallucination substring overlap (0.0–1.0).
const HALLUCINATION_OVERLAP_THRESHOLD: f32 = 0.8;

// ── Whisper transcription ───────────────────────────────────────────────────

/// Runs Whisper inference on the given 16kHz audio samples.
/// Returns the transcribed text with hallucinations filtered and ALL CAPS normalized.
pub(super) fn run_whisper(
    samples: &[f32],
    language: &str,
    model_type: WhisperModelType,
) -> Result<String, String> {
    let t0 = std::time::Instant::now();
    log::debug!("Using model: {:?}", model_type);

    let lock = super::model_cache::get_or_load_model(model_type)?;
    let model = lock.as_ref().ok_or("Failed to initialize Whisper model")?;

    let params = configure_params(language, samples);
    let mut wstate = model.ctx.create_state().map_err(|e| format!("{:?}", e))?;

    let t_infer = std::time::Instant::now();
    wstate
        .full(params, samples)
        .map_err(|e| format!("{:?}", e))?;
    log::debug!("Inference completed in {:?}", t_infer.elapsed());

    let lang_id = wstate.full_lang_id_from_state();
    log::debug!("Detected language ID: {}", lang_id);

    let result = collect_segments(&wstate);

    log::debug!("Total run_whisper time: {:?}", t0.elapsed());
    Ok(convert_all_caps_to_normal(
        crate::utils::clean_repetitive_phrases(result.trim()),
    ))
}

// ── Parameter configuration ─────────────────────────────────────────────────

/// Builds Whisper FullParams for the given language and sample count.
fn configure_params<'a>(language: &'a str, samples: &'a [f32]) -> FullParams<'a, 'a> {
    // Local dictation is latency-sensitive. Greedy decoding is much faster than
    // beam search and is accurate enough for short command/dictation snippets,
    // especially with the mixed RU+EN prompt and technical vocabulary hints.
    let mut params = FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });

    let lang_code = match language {
        "mixed" => Some("ru"),
        _ => Some(language),
    };
    params.set_language(lang_code);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);
    params.set_split_on_word(false);
    params.set_no_context(true);
    params.set_translate(false);
    params.set_temperature(0.0);
    // Keep a single decoding pass: temperature_inc(0.0) prevents Whisper from
    // re-decoding with raised temperatures on uncertain audio, which is the
    // main source of multi-second delays on short dictation clips.
    params.set_temperature_inc(0.0);
    params.set_entropy_thold(2.4);
    params.set_logprob_thold(-1.0);
    params.set_max_initial_ts(1.0);

    let n_threads = std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4);
    params.set_n_threads(n_threads);
    log::debug!(
        "Using {} threads, {} samples ({:.1}s audio)",
        n_threads,
        samples.len(),
        samples.len() as f64 / 16000.0
    );

    let initial_prompt = build_initial_prompt(language);
    params.set_initial_prompt(&initial_prompt);

    params
}

/// Constructs the initial prompt for Whisper based on language setting.
fn build_initial_prompt(language: &str) -> String {
    // System context with base IT vocabulary.
    // Russian prompt is written in Russian to avoid biasing the decoder
    // toward English hallucinations.
    // For mixed mode: language is forced to Russian, initial_prompt handles English terms.
    match language {
        "en" => format!("Transcribe all speech accurately. Tech terms: {}", VOCAB_HINT),
        "mixed" => format!(
            "Русская речь с английскими техническими терминами. {}",
            crate::prompts::MIXED_RU_EN_STT_PROMPT
        ),
        _ => format!(
            "Точная транскрипция русской речи. Сохраняйте английские технические термины. Словарь: {}",
            VOCAB_HINT
        ),
    }
}

// ── Segment extraction ──────────────────────────────────────────────────────

/// Iterates over Whisper segments, filters hallucinations, and concatenates
/// the remaining text.
fn collect_segments(wstate: &whisper_rs::WhisperState) -> String {
    let n = wstate.full_n_segments();
    let mut result = String::new();

    for i in 0..n {
        if let Some(seg) = wstate.get_segment(i) {
            if let Ok(text) = seg.to_str() {
                let text = text.trim();
                if is_hallucination(text) {
                    continue;
                }
                result.push_str(text);
                result.push(' ');
            }
        }
    }

    result
}

// ── Hallucination detection ─────────────────────────────────────────────────

/// Returns true if the segment text is likely a Whisper hallucination.
///
/// Matches:
/// - Empty or non-alphabetic text
/// - Exact match against known hallucination patterns
/// - Substring match where the pattern covers >80% of the text
fn is_hallucination(text: &str) -> bool {
    if text.is_empty() {
        return true;
    }
    let lower = text.to_lowercase();
    let trimmed = lower.trim();
    let text_len = trimmed.len();

    for pattern in HALLUCINATION_PATTERNS {
        if trimmed == *pattern {
            return true;
        }
        if text_len > 0
            && trimmed.contains(pattern)
            && pattern.len() as f32 / text_len as f32 > HALLUCINATION_OVERLAP_THRESHOLD
        {
            return true;
        }
    }

    let alpha_count = text.chars().filter(|c| c.is_alphabetic()).count();
    if alpha_count == 0 {
        return true;
    }

    false
}

// ── ALL CAPS normalization ──────────────────────────────────────────────────

/// Converts ALL CAPS text to sentence case (first letter uppercase, rest lowercase).
/// Only activates when >80% of alphabetic characters are uppercase.
fn convert_all_caps_to_normal(text: String) -> String {
    let alpha_chars: Vec<char> = text.chars().filter(|c| c.is_alphabetic()).collect();
    if alpha_chars.is_empty() {
        return text;
    }

    let uppercase_count = alpha_chars.iter().filter(|c| c.is_uppercase()).count();
    let uppercase_ratio = uppercase_count as f32 / alpha_chars.len() as f32;

    if uppercase_ratio > ALL_CAPS_THRESHOLD {
        let mut result = String::new();
        let mut capitalize_next = true;

        for c in text.chars() {
            if c.is_alphabetic() {
                if capitalize_next {
                    result.extend(c.to_uppercase());
                    capitalize_next = false;
                } else {
                    result.extend(c.to_lowercase());
                }
            } else {
                result.push(c);
                if c == '.' || c == '?' || c == '!' {
                    capitalize_next = true;
                }
            }
        }

        log::debug!("Converted ALL CAPS to normal case");
        return result;
    }

    text
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── is_hallucination ─────────────────────────────────────────────────────

    #[test]
    fn hallucination_empty_text() {
        assert!(is_hallucination(""));
    }

    #[test]
    fn hallucination_music_tag() {
        assert!(is_hallucination("[music]"));
    }

    #[test]
    fn hallucination_silence_tag() {
        assert!(is_hallucination("[silence]"));
    }

    #[test]
    fn hallucination_subtitles_by() {
        assert!(is_hallucination("subtitles by amara.org"));
    }

    #[test]
    fn hallucination_russian_subtitles_short() {
        assert!(is_hallucination("Субтитры"));
    }

    #[test]
    fn hallucination_russian_subtitles_with_extra_text() {
        // "Субтитры создавал" — pattern "субтитры" covers only ~48% of text,
        // not an exact match. Text contains a hallucination word but is longer,
        // so it's not flagged as hallucination (avoids false positives).
        assert!(!is_hallucination("Субтитры создавал"));
    }

    #[test]
    fn hallucination_russian_thanks() {
        assert!(is_hallucination("Спасибо за просмотр"));
    }

    #[test]
    fn hallucination_normal_text() {
        assert!(!is_hallucination("Привет мир"));
    }

    #[test]
    fn hallucination_english_text() {
        assert!(!is_hallucination("Hello world"));
    }

    #[test]
    fn hallucination_mixed_text() {
        assert!(!is_hallucination("Использую GitHub для деплоя"));
    }

    #[test]
    fn hallucination_only_symbols() {
        assert!(is_hallucination("♪ ♫ ♬"));
    }

    #[test]
    fn hallucination_substring_not_flagged() {
        // Pattern "subtitles" is a small part of a longer legitimate sentence
        assert!(!is_hallucination(
            "The subtitles by the author were very helpful for understanding"
        ));
    }

    #[test]
    fn hallucination_exact_pattern_match() {
        // Exact match after trimming should be flagged
        assert!(is_hallucination("subtitles by amara.org"));
    }

    #[test]
    fn hallucination_pattern_covers_most_of_text() {
        // Pattern "тишина" (6 bytes) with just a period -> covers most of text
        assert!(is_hallucination("тишина."));
    }

    // ── convert_all_caps_to_normal ───────────────────────────────────────────

    #[test]
    fn caps_converts_all_uppercase() {
        let result = convert_all_caps_to_normal("ПРИВЕТ МИР".to_string());
        assert_eq!(result, "Привет мир");
    }

    #[test]
    fn caps_preserves_normal_case() {
        let result = convert_all_caps_to_normal("Привет мир".to_string());
        assert_eq!(result, "Привет мир");
    }

    #[test]
    fn caps_preserves_english_normal() {
        let result = convert_all_caps_to_normal("Hello World".to_string());
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn caps_converts_english_all_caps() {
        let result = convert_all_caps_to_normal("HELLO WORLD".to_string());
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn caps_empty_string() {
        let result = convert_all_caps_to_normal("".to_string());
        assert_eq!(result, "");
    }

    #[test]
    fn caps_preserves_mixed_content() {
        let result = convert_all_caps_to_normal("Использую API".to_string());
        assert_eq!(result, "Использую API");
    }

    #[test]
    fn caps_handles_multi_char_uppercase() {
        // ß (lowercase sharp s, U+00DF) uppercases to "SS" (2 chars).
        // The old code used .next() which lost the second char.
        // "ßIST GUT" is 86% uppercase -> gets converted to sentence case.
        // First char ß -> to_uppercase() -> "SS" (must not lose the second S).
        let result = convert_all_caps_to_normal("ßIST GUT".to_string());
        assert_eq!(result, "SSist gut");
    }

    #[test]
    fn caps_sentence_with_punctuation() {
        let result = convert_all_caps_to_normal("HELLO. WORLD!".to_string());
        assert_eq!(result, "Hello. World!");
    }
}
