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
    "субтитры",
    "субтитры создавал",
    "субтитры делал",
    "редактор субтитров",
    "автор субтитров",
    "переводчик",
    "дима торзок",
    "подпишитесь на канал",
    "спасибо за просмотр",
    "с вами был",
    "DimaTorzok",
    "Dima Torzok",
    "Hoje pursui",
    "pursui",
    "uvoir",
    "продолжение следует",
    "to be continued",
    "subtitles by amara.org",
    "amara.org",
    "amara",
    "translated by",
    "Translated by",
    "Transcribed by",
    "end of transcript",
    "transcript end",
    "конец записи",
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

/// Ratio threshold for ALL CAPS detection (0.0–1.0).
const ALL_CAPS_THRESHOLD: f32 = 0.8;
/// Ratio threshold for hallucination substring overlap (0.0–1.0).
const HALLUCINATION_OVERLAP_THRESHOLD: f32 = 0.8;

// ── Whisper transcription ───────────────────────────────────────────────────

/// Runs Whisper inference on the given 16kHz audio samples.
/// Returns the transcribed text with hallucinations filtered and ALL CAPS normalized.
#[allow(dead_code)]
pub(super) fn run_whisper(
    samples: &[f32],
    language: &str,
    model_type: WhisperModelType,
) -> Result<String, String> {
    run_whisper_with_prompt(samples, language, model_type, None)
}

/// Runs Whisper inference with an optional dynamic context prompt (last words from committed buffer).
pub(super) fn run_whisper_with_prompt(
    samples: &[f32],
    language: &str,
    model_type: WhisperModelType,
    context_prompt: Option<&str>,
) -> Result<String, String> {
    // ── 1. Acoustic Guard ───────────────────────────────────────────────────
    // Check useful audio length and RMS energy before engaging Whisper.
    // Prevents model execution on silence/noise and eliminates hallucination generation.
    let useful = crate::utils::trim_silence(samples, 0.0025, 16000);
    let useful_duration = useful.len() as f32 / 16000.0;
    if useful.is_empty() || useful_duration < 0.350 {
        log::debug!(
            "Acoustic Guard: useful audio duration ({:.3}s) < 350ms, skipping Whisper inference",
            useful_duration
        );
        return Ok(String::new());
    }

    let overall_rms =
        (useful.iter().map(|s| s * s).sum::<f32>() / useful.len().max(1) as f32).sqrt();
    if overall_rms < 0.003 {
        log::debug!(
            "Acoustic Guard: audio RMS {:.6} < 0.003, skipping Whisper inference",
            overall_rms
        );
        return Ok(String::new());
    }

    let t0 = std::time::Instant::now();
    log::debug!("Using model: {:?}", model_type);

    let mut lock = super::model_cache::get_or_load_model(model_type)?;
    let model = lock.as_mut().ok_or("Failed to initialize Whisper model")?;

    let params = configure_params(language, samples, context_prompt);
    let wstate = &mut model.state;

    let t_infer = std::time::Instant::now();
    wstate
        .full(params, samples)
        .map_err(|e| format!("{:?}", e))?;
    log::debug!("Inference completed in {:?}", t_infer.elapsed());

    let lang_id = wstate.full_lang_id_from_state();
    log::debug!("Detected language ID: {}", lang_id);

    let result = collect_segments(wstate);

    log::debug!("Total run_whisper time: {:?}", t0.elapsed());
    Ok(convert_all_caps_to_normal(
        crate::utils::clean_repetitive_phrases(result.trim()),
    ))
}

// ── Parameter configuration ─────────────────────────────────────────────────

/// Builds Whisper FullParams for the given language, sample count, and optional context prompt.
fn configure_params<'a>(
    language: &'a str,
    samples: &'a [f32],
    context_prompt: Option<&'a str>,
) -> FullParams<'a, 'a> {
    // Local dictation is latency-sensitive. Greedy decoding is much faster than
    // beam search and is accurate enough for short command/dictation snippets,
    // especially with the mixed RU+EN prompt and technical vocabulary hints.
    let mut params = FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });

    let lang_code = match language {
        "mixed" => Some("ru"),
        "auto" => None, // let whisper.cpp auto-detect the spoken language
        _ => Some(language),
    };
    params.set_language(lang_code);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);
    params.set_no_timestamps(true);
    params.set_split_on_word(false);
    params.set_no_context(true);
    params.set_translate(false);
    params.set_temperature(0.0);
    // Keep a single decoding pass: temperature_inc(0.0) prevents Whisper from
    // re-decoding with raised temperatures on uncertain audio, which is the
    // main source of multi-second delays on short dictation clips.
    params.set_temperature_inc(0.0);
    params.set_no_speech_thold(0.68);
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

    let base_prompt = build_initial_prompt(language);
    let initial_prompt = match context_prompt {
        Some(cp) if !cp.trim().is_empty() => {
            format!("{} {}", base_prompt, cp.trim())
        }
        _ => base_prompt,
    };
    params.set_initial_prompt(&initial_prompt);

    params
}

/// Constructs the initial prompt for Whisper based on language setting.
/// Primed as natural dialogue & vocabulary to teach Whisper correct casing,
/// punctuation, and common terms without instructional commands.
fn build_initial_prompt(language: &str) -> String {
    match language {
        "en" => "Hello! We are discussing tasks, meetings, services, and software development: GitHub, GitLab, Node.js, Bun, API, CLI, JSON, TypeScript, React, Next.js, Docker, Linux, macOS, Telegram, WhatsApp, DeepSeek, Gemini, Groq, Whisper, PostgreSQL.".to_string(),
        "mixed" => crate::prompts::MIXED_RU_EN_STT_PROMPT.to_string(),
        _ => "Привет! Обсуждаем задачи, встречи, код и сервисы: Сбер, Яндекс, Telegram, WhatsApp, Zoom, GitHub, GitLab, Node.js, Bun, API, CLI, JSON, TypeScript, React, Next.js, Docker, Linux, macOS, DeepSeek, Gemini, Groq, Whisper, PostgreSQL.".to_string(),
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

/// Returns true if the segment text is likely a Whisper hallucination.
///
/// Matches:
/// - Empty or non-alphabetic text
/// - Isolated closing hallucination on silence (e.g. standalone "Спасибо", "До свидания", "Благодарю", "Конец")
/// - Subtitle and translator metadata (e.g. "субтитры создавал", "дима торзок", "редактор субтитров")
/// - Exact match against known hallucination patterns
/// - Substring match where the pattern covers >80% of the text
fn is_hallucination(text: &str) -> bool {
    if text.is_empty() {
        return true;
    }
    let lower = text.to_lowercase();
    let trimmed = lower.trim();
    let text_len = trimmed.len();

    // Isolated closing hallucination match (e.g. standalone "Спасибо", "Благодарю", "Конец")
    if is_isolated_closing_hallucination(trimmed) {
        return true;
    }

    // Subtitle creation and translator metadata hallucination match
    if is_subtitle_or_metadata_hallucination(trimmed) {
        return true;
    }

    for pattern in HALLUCINATION_PATTERNS {
        let pat_lower = pattern.to_lowercase();
        if trimmed == pat_lower {
            return true;
        }
        if text_len > 0
            && trimmed.contains(&pat_lower)
            && pat_lower.len() as f32 / text_len as f32 > HALLUCINATION_OVERLAP_THRESHOLD
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

/// Checks if a segment is an isolated closing hallucination on silence.
/// Matches strictly if the trimmed text (stripped of surrounding punctuation and whitespace)
/// is an isolated closing formula.
fn is_isolated_closing_hallucination(trimmed: &str) -> bool {
    let stripped = trimmed
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_lowercase();
    matches!(
        stripped.as_str(),
        "спасибо"
            | "спасибо за внимание"
            | "спасибо за просмотр"
            | "до свидания"
            | "всего доброго"
            | "благодарю"
            | "конец"
            | "конец записи"
            | "thank you"
            | "thank you for watching"
            | "thanks for watching"
            | "goodbye"
    )
}

/// Checks if a segment matches subtitle creation or translator metadata.
fn is_subtitle_or_metadata_hallucination(trimmed: &str) -> bool {
    let stripped = trimmed
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_lowercase();
    if matches!(
        stripped.as_str(),
        "субтитры"
            | "субтитры создавал"
            | "субтитры делал"
            | "редактор субтитров"
            | "автор субтитров"
            | "перевод"
            | "переводчик"
            | "дима торзок"
            | "dimatorzok"
            | "amara.org"
            | "subtitles by amara.org"
            | "продолжение следует"
            | "to be continued"
    ) {
        return true;
    }

    use regex::Regex;
    use std::sync::OnceLock;

    static SUBTITLE_RES: OnceLock<Vec<Regex>> = OnceLock::new();
    let res = SUBTITLE_RES.get_or_init(|| {
        vec![
            Regex::new(r"(?i)^\s*(?:субтитр[ыа-я]*\s+(?:создавал|делал|готовил)[а-я]*|субтитры\s*:\s*[\w\s\.\-]+)\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*(?:редактор|автор)\s+субтитр[ыа-я]*\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*дима\s+торзок\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*dimatorzok\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*subtitles\s+by\s+[a-z0-9_\.\- ]+\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*(?:transcribed|translated)\s+by\s+[a-z0-9_\.\- ]+\s*[\.\?!]?\s*$").unwrap(),
            Regex::new(r"(?i)^\s*(?:продолжение\s+следует|to\s+be\s+continued)\s*[\.\?!]?\s*$").unwrap(),
        ]
    });

    for re in res {
        if re.is_match(trimmed) {
            return true;
        }
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
        assert!(is_hallucination("редактор субтитров"));
    }

    #[test]
    fn hallucination_russian_subtitles_with_extra_text() {
        // "Субтитры создавал" / "Субтитры делал" are known Whisper YouTube metadata hallucinations and must be flagged!
        assert!(is_hallucination("Субтитры создавал"));
        assert!(is_hallucination("Субтитры делал"));
        assert!(is_hallucination("Дима Торзок"));
        assert!(is_hallucination("dimatorzok"));
    }

    #[test]
    fn hallucination_russian_thanks() {
        assert!(is_hallucination("Спасибо за просмотр"));
    }

    #[test]
    fn hallucination_isolated_closing_words_are_flagged() {
        assert!(is_hallucination("Спасибо"));
        assert!(is_hallucination("Спасибо."));
        assert!(is_hallucination("  спасибо!  "));
        assert!(is_hallucination("Спасибо за внимание"));
        assert!(is_hallucination("Спасибо за внимание."));
        assert!(is_hallucination("До свидания."));
        assert!(is_hallucination("Благодарю"));
        assert!(is_hallucination("Конец"));
        assert!(is_hallucination("Конец записи"));
        assert!(is_hallucination("Thank you."));
    }

    #[test]
    fn hallucination_preserves_sentences_with_thanks() {
        // Nuance 1 test: sentences containing "спасибо" must NEVER be dropped as hallucinations!
        assert!(!is_hallucination("Спасибо за ревью, я поправил этот PR"));
        assert!(!is_hallucination(
            "Большое спасибо команде за отличную работу"
        ));
        assert!(!is_hallucination(
            "До свидания мы вернёмся завтра к обсуждению"
        ));
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
        // Pattern "DimaTorzok" (10 bytes) with punctuation covers most of text
        assert!(is_hallucination("DimaTorzok."));
    }

    #[test]
    fn hallucination_preserves_vocabulary_words() {
        // Real dictionary words like "тишина", "партнёр", "реклама", "перевод" are NOT hallucinations
        assert!(!is_hallucination("наш партнёр запустил рекламу"));
        assert!(!is_hallucination("в зале наступила тишина"));
        assert!(!is_hallucination("нужен перевод текста"));
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

    // ── Acoustic Guard ────────────────────────────────────────────────────────

    #[test]
    fn acoustic_guard_drops_pure_silence() {
        let silence = vec![0.0f32; 16000]; // 1 second of silence
        let res = run_whisper_with_prompt(&silence, "ru", WhisperModelType::Turbo, None);
        assert_eq!(res.unwrap(), "");
    }

    #[test]
    fn acoustic_guard_drops_sub_350ms_audio() {
        let short_audio = vec![0.05f32; 3200]; // 200ms of audio (< 350ms)
        let res = run_whisper_with_prompt(&short_audio, "ru", WhisperModelType::Turbo, None);
        assert_eq!(res.unwrap(), "");
    }

    #[test]
    fn acoustic_guard_drops_quiet_ambient_noise() {
        let low_noise = vec![0.001f32; 16000]; // RMS = 0.001 (< 0.003 threshold)
        let res = run_whisper_with_prompt(&low_noise, "ru", WhisperModelType::Turbo, None);
        assert_eq!(res.unwrap(), "");
    }
}
