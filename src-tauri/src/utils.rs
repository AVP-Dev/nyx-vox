pub fn is_media_playing() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let music_playing = Command::new("osascript")
            .arg("-e")
            .arg("if application \"Music\" is running then tell application \"Music\" to get player state is playing")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);
        if music_playing {
            return true;
        }

        let spotify_playing = Command::new("osascript")
            .arg("-e")
            .arg("if application \"Spotify\" is running then tell application \"Spotify\" to get player state is playing")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);
        if spotify_playing {
            return true;
        }

        let pmset_output = Command::new("pmset").arg("-g").arg("assertions").output();

        if let Ok(output) = pmset_output {
            let s = String::from_utf8_lossy(&output.stdout);
            if s.contains("Playing audio") {
                return true;
            }
            if s.contains("audio-out") && s.contains("coreaudiod") {
                return true;
            }
        }

        false
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

pub fn system_media_control(cmd: i32) {
    #[cfg(target_os = "macos")]
    {
        use libc::{c_int, c_void};
        use std::ptr;

        unsafe {
            let handle = libc::dlopen(
                c"/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote".as_ptr(),
                libc::RTLD_NOW,
            );
            if !handle.is_null() {
                let sym = libc::dlsym(handle, c"MRMediaRemoteSendCommand".as_ptr());
                if !sym.is_null() {
                    let func: extern "C" fn(c_int, *const c_void) -> bool =
                        std::mem::transmute(sym);
                    func(cmd, ptr::null());
                }
                libc::dlclose(handle);
            }
        }
    }
}

pub fn resample_to_16k(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return samples.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let out_len = (samples.len() as f64 / ratio) as usize;
    let mut result = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 * ratio;
        let idx = src_pos as usize;
        let frac = src_pos - idx as f64;
        if idx + 1 < samples.len() {
            let s = samples[idx] as f64 + (samples[idx + 1] as f64 - samples[idx] as f64) * frac;
            result.push(s as f32);
        } else if idx < samples.len() {
            result.push(samples[idx]);
        }
    }
    result
}

/// Convert float samples to 16-bit mono WAV bytes in memory.
pub fn samples_to_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    let mut wav_cursor = Cursor::new(Vec::new());
    {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(&mut wav_cursor, spec)
            .map_err(|e| format!("WavWriter error: {}", e))?;

        for &sample in samples {
            let val: f32 = sample * 32767.0;
            let amplitude = val.clamp(-32768.0, 32767.0) as i16;
            writer
                .write_sample(amplitude)
                .map_err(|e| format!("Write sample error: {}", e))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("Wav finalize error: {}", e))?;
    }
    let wav_data = wav_cursor.into_inner();
    if wav_data.is_empty() {
        return Err("WAV data empty".to_string());
    }
    Ok(wav_data)
}

/// Convert float samples [-1.0, 1.0] to raw 16-bit little-endian PCM bytes.
pub fn samples_to_i16_pcm(samples: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for &sample in samples {
        let val = sample * 32767.0;
        let amplitude = val.clamp(-32768.0, 32767.0) as i16;
        bytes.extend_from_slice(&amplitude.to_le_bytes());
    }
    bytes
}

pub fn get_frontmost_app_info() -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        use core_foundation::array::CFArray;
        use core_foundation::base::TCFType;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::number::CFNumber;
        use core_foundation::string::CFString;
        use core_graphics::display::{
            kCGNullWindowID, kCGWindowListOptionOnScreenOnly, CGWindowListCopyWindowInfo,
        };

        // 1. Get all on-screen windows in Z-order (top to bottom)
        let window_list_ref =
            unsafe { CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) };

        use core_foundation::base::CFType;
        if !window_list_ref.is_null() {
            let window_list = unsafe {
                CFArray::<CFDictionary>::wrap_under_create_rule(window_list_ref as *const _)
            };
            let count = window_list.len();

            for i in 0..count {
                let dict_ref = unsafe {
                    core_foundation::array::CFArrayGetValueAtIndex(
                        window_list.as_concrete_TypeRef(),
                        i,
                    )
                };
                if dict_ref.is_null() {
                    continue;
                }

                let dict = unsafe {
                    CFDictionary::<CFString, CFType>::wrap_under_get_rule(dict_ref as *const _)
                };

                // Keys
                let pid_key = CFString::from_static_string("kCGWindowOwnerPID");
                let name_key = CFString::from_static_string("kCGWindowOwnerName");
                let layer_key = CFString::from_static_string("kCGWindowLayer");

                let pid_val = dict.find(pid_key);
                let name_val = dict.find(name_key);
                let layer_val = dict.find(layer_key);

                if let (Some(p_ptr), Some(n_ptr), Some(l_ptr)) = (pid_val, name_val, layer_val) {
                    let pid_num =
                        unsafe { CFNumber::wrap_under_get_rule(p_ptr.as_CFTypeRef() as *const _) };
                    let layer_num =
                        unsafe { CFNumber::wrap_under_get_rule(l_ptr.as_CFTypeRef() as *const _) };
                    let owner_name_cf =
                        unsafe { CFString::wrap_under_get_rule(n_ptr.as_CFTypeRef() as *const _) };

                    let pid = pid_num.to_i64().unwrap_or(0);
                    let layer = layer_num.to_i32().unwrap_or(0);
                    let owner_name = owner_name_cf.to_string();

                    // Skip our own app and background/system layers (layer > 0)
                    if owner_name == "NYX Vox" || owner_name == "app" || layer > 0 {
                        continue;
                    }

                    // For the found PID, get the Bundle ID via AppleScript
                    let script = format!(
                        "tell application \"System Events\" to return bundle identifier of first application process whose unix id is {}",
                        pid
                    );

                    if let Ok(output) = std::process::Command::new("osascript")
                        .arg("-e")
                        .arg(&script)
                        .output()
                    {
                        let bundle_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        if !bundle_id.is_empty() {
                            return (owner_name, bundle_id);
                        }
                    }

                    return (owner_name, "Unknown".to_string());
                }
            }
        }
    }
    ("Unknown".to_string(), "Unknown".to_string())
}

pub fn remove_hallucinations(text: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;

    static RE_SPACES: OnceLock<Regex> = OnceLock::new();
    let re_spaces = RE_SPACES.get_or_init(|| Regex::new(r"\s+").unwrap());

    let patterns = [
        "DimaTorzok",
        "Dima Torzok",
        "Субтитры",
        "Отредактировано",
        "Перевод",
        "Транскрибация",
        "Подпишитесь",
        "продолжение следует",
        "Hoje pursui",
        "Não mais",
        "uvoir",
        "pursui",
        "тебя отдаю code",
        "увидеть şunu с",
        "Today pursui",
        "Subtitles by",
        "Amara.org",
        "для сайта",
        "специально для",
        "благодарим за",
        "автор субтитров",
        "Продолжение следует",
        "Спасибо за просмотр",
        "Подписывайтесь на канал",
        "редактор субтитров",
        "кулакова",
        "игорь негода",
        "игорь не года",
        "а. кулаков",
        "а. кулакова",
        "диктор",
        "диктовка",
        "диктовка.",
        "субтитры",
        "перевод",
        "translated by",
        "translation",
        "Translated by",
        "Transcribed by",
        "в выпуске",
        "следующий выпуск",
        "смотрите далее",
        "реклама",
        "спонсор",
        "партнёр",
        "sponsor",
        "Sponsor",
        "end of transcript",
        "transcript end",
        "конец записи",
        "to be continued",
        "continued",
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
        "звучит музыка",
        "фоновая музыка",
        "музыкальное сопровождение",
    ];

    static HALLUCINATION_RES: OnceLock<Vec<Regex>> = OnceLock::new();
    let res = HALLUCINATION_RES.get_or_init(|| {
        patterns
            .iter()
            .filter_map(|p| Regex::new(&format!(r"(?i)\b{}\b", regex::escape(p))).ok())
            .collect()
    });

    // Special music phrase hallucinations: "Музыка, которая тут была...", "[музыка]", "(музыка)"
    static RE_MUSIC_COMPLEX: OnceLock<Regex> = OnceLock::new();
    let re_music = RE_MUSIC_COMPLEX.get_or_init(|| {
        Regex::new(r"(?i)(?:\[(?:музыка|тишина|аплодисменты|смех)\]|\((?:музыка|тишина)\)|музыка,\s*которая\s+тут\s+была[^\.\?!]*[\.\?!]?|звучит\s+мелодия[^\.\?!]*[\.\?!]?)").unwrap()
    });

    let mut cleaned = text.to_string();
    cleaned = re_music.replace_all(&cleaned, "").to_string();
    for re in res {
        cleaned = re.replace_all(&cleaned, "").to_string();
    }
    re_spaces.replace_all(cleaned.trim(), " ").to_string()
}

/// Trims leading and trailing silence from audio samples based on RMS threshold,
/// keeping a small padding (150ms) to avoid clipping spoken consonants.
pub fn trim_silence(samples: &[f32], threshold: f32, sample_rate: u32) -> &[f32] {
    if samples.is_empty() {
        return samples;
    }
    let frame_size = (sample_rate / 50).max(160) as usize; // 20ms frames
    let pad_samples = (sample_rate as usize * 150) / 1000; // 150ms padding

    let mut start_idx = 0;
    for chunk_start in (0..samples.len()).step_by(frame_size) {
        let chunk_end = (chunk_start + frame_size).min(samples.len());
        let frame = &samples[chunk_start..chunk_end];
        let rms = (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt();
        if rms >= threshold {
            start_idx = chunk_start.saturating_sub(pad_samples);
            break;
        }
    }

    let mut end_idx = samples.len();
    for chunk_start in (0..samples.len()).step_by(frame_size).rev() {
        let chunk_end = (chunk_start + frame_size).min(samples.len());
        let frame = &samples[chunk_start..chunk_end];
        let rms = (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt();
        if rms >= threshold {
            end_idx = (chunk_end + pad_samples).min(samples.len());
            break;
        }
    }

    if start_idx >= end_idx {
        return &[];
    }

    &samples[start_idx..end_idx]
}

pub fn clean_repetitive_phrases(text: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;

    static RE_PREFIX: OnceLock<Regex> = OnceLock::new();
    static RE_PARASITES: OnceLock<Regex> = OnceLock::new();
    static RE_STUTTER: OnceLock<Regex> = OnceLock::new();

    let re_prefix =
        RE_PREFIX.get_or_init(|| Regex::new(r"(?i)([а-яёa-z])\s*-\s+([а-яёa-z])").unwrap());
    // Longer hesitation/filler sequences: "э-э-э", "а-а", "у-у", "м-м-м", "типо", "короче"
    let re_parasites = RE_PARASITES
        .get_or_init(|| Regex::new(r"(?i)\b(аа+|ээ+|мм+|типо|короче)\b[\s,\.]*").unwrap());
    // Stuttered syllables joined with hyphens: "э-э", "а-а-а", "у-у", "м-м", "э-э-э-э".
    // (regex crate has no backreferences, so enumerate the common cases)
    let re_stutter = RE_STUTTER.get_or_init(|| {
        Regex::new(r"(?i)\b(?:э(?:-э)+|а(?:-а)+|у(?:-у)+|м(?:-м)+|и(?:-и)+|о(?:-о)+)\b[\s,\.]*")
            .unwrap()
    });

    let text = remove_hallucinations(text);
    let text = re_prefix.replace_all(&text, "$1 $2").to_string();
    let text = re_parasites.replace_all(&text, " ").to_string();
    let text = re_stutter.replace_all(&text, " ").to_string();

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return text.to_string();
    }

    let mut result: Vec<&str> = Vec::new();
    let mut i = 0;

    while i < words.len() {
        // Lone hesitation vowels ("э", "у", "а", "м") between real words are
        // transcription noise, not words — drop them ("и э вот" -> "и вот").
        // The check is: drop only if there is any word before and any word
        // after in the ORIGINAL sequence, so leading/trailing and
        // single-letter-only text is never eaten.
        let prev_exists = i > 0;
        let next_exists = i + 1 < words.len();
        if prev_exists && next_exists && is_lone_filler(words[i]) {
            i += 1;
            continue;
        }
        result.push(words[i]);
        // Simple case: "word word" -> "word"
        if i + 1 < words.len() && words[i].to_lowercase() == words[i + 1].to_lowercase() {
            i += 1;
        }
        i += 1;
    }

    result.join(" ")
}

/// A standalone hesitation sound: single/duplicated "э", "а", "у", "о", "и", "м".
fn is_lone_filler(word: &str) -> bool {
    let lower = word.to_lowercase();
    let trimmed = lower.trim_matches(|c: char| !c.is_alphabetic());
    if trimmed.is_empty() {
        return false;
    }
    trimmed
        .chars()
        .all(|c| matches!(c, 'э' | 'а' | 'у' | 'о' | 'и' | 'м'))
}

/// A robust, smoothed Voice Activity Detection (VAD) tracker with adaptive noise floor.
#[derive(Debug, Clone)]
pub struct VadTracker {
    pub speech_started: bool,
    pub last_speech_time: Option<std::time::Instant>,
    pub smoothed_rms: f32,
    pub noise_floor: f32,
    pub frames_count: usize,
}

impl Default for VadTracker {
    fn default() -> Self {
        Self {
            speech_started: false,
            last_speech_time: None,
            smoothed_rms: 0.0,
            noise_floor: 0.001,
            frames_count: 0,
        }
    }
}

impl VadTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feeds a new audio buffer and returns `true` if continuous silence
    /// has exceeded `timeout_secs` after speech was already detected.
    pub fn update(&mut self, samples: &[f32], threshold: f32, timeout_secs: f32) -> bool {
        if samples.is_empty() {
            return false;
        }
        let buffer_rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();

        self.frames_count = self.frames_count.saturating_add(1);
        // Exponential moving average for smooth energy
        self.smoothed_rms = self.smoothed_rms * 0.70 + buffer_rms * 0.30;

        // Adapt background noise floor dynamically
        if self.frames_count <= 20 || buffer_rms < self.noise_floor {
            self.noise_floor = self.noise_floor * 0.90 + buffer_rms * 0.10;
        }

        // Active speech threshold: speech is detected when energy rises above the noise threshold
        let speech_threshold = threshold.max(0.0012);

        if self.smoothed_rms >= speech_threshold {
            self.speech_started = true;
            self.last_speech_time = Some(std::time::Instant::now());
            false
        } else if self.speech_started {
            if let Some(last_speech) = self.last_speech_time {
                if last_speech.elapsed().as_secs_f32() >= timeout_secs {
                    self.speech_started = false;
                    self.last_speech_time = None;
                    return true;
                }
            }
            false
        } else {
            false
        }
    }
}

pub fn strip_filler_phrases(text: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;

    static PREAMBLE_RES: OnceLock<Vec<Regex>> = OnceLock::new();

    let fillers = [
        "Вот исправленный текст:",
        "Вот ваш исправленный текст:",
        "Here's the cleaned text:",
        "Here you go:",
        "Вот результат:",
        "Результат:",
        "Исправленный текст:",
        "Отредактированный текст:",
    ];
    let mut cleaned = text.to_string();
    for filler in fillers {
        if cleaned.trim().starts_with(filler) {
            cleaned = cleaned.trim().trim_start_matches(filler).trim().to_string();
        }
    }

    let preamble_patterns = [
        r"^Here is the formatted text:\s*",
        r"^Here's the formatted text:\s*",
        r"^Here is the cleaned text:\s*",
        r"^Here's the cleaned text:\s*",
        r"^Как просили,? вот (?:отформатированный|исправленный) текст:\s*",
    ];
    let res = PREAMBLE_RES.get_or_init(|| {
        preamble_patterns
            .iter()
            .filter_map(|p| Regex::new(&format!(r"(?i){}", p)).ok())
            .collect()
    });
    for re in res {
        cleaned = re.replace(&cleaned, "").to_string();
    }

    // If text is only punctuation or very short noise, return empty
    let trimmed = cleaned.trim();
    if trimmed.is_empty() || trimmed.len() < 2 {
        return String::new();
    }

    // Check if text is only punctuation/symbols
    let alpha_count = trimmed.chars().filter(|c| c.is_alphabetic()).count();
    if alpha_count == 0 {
        return String::new();
    }

    cleaned
}

// ── Recording skip reasons ─────────────────────────────────────────────────

/// Why a recording was rejected before transcription, so the user can be told
/// instead of silently getting an empty result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordingSkipReason {
    NoSamples,
    TooShort,
    TooQuiet,
}

impl RecordingSkipReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            RecordingSkipReason::NoSamples => "no_samples",
            RecordingSkipReason::TooShort => "too_short",
            RecordingSkipReason::TooQuiet => "too_quiet",
        }
    }
}

/// Human-readable message for a skip reason, localized to the app language.
pub fn skip_reason_message(reason: RecordingSkipReason, app_lang: &str) -> String {
    match reason {
        RecordingSkipReason::NoSamples => {
            if app_lang == "ru" {
                "Микрофон не захватил звук. Проверьте микрофон.".to_string()
            } else {
                "The microphone didn't capture any sound. Check your microphone.".to_string()
            }
        }
        RecordingSkipReason::TooShort => {
            if app_lang == "ru" {
                "Запись слишком короткая. Говорите дольше.".to_string()
            } else {
                "The recording is too short. Speak a bit longer.".to_string()
            }
        }
        RecordingSkipReason::TooQuiet => {
            if app_lang == "ru" {
                "Запись слишком тихая. Говорите громче.".to_string()
            } else {
                "The recording is too quiet. Speak up.".to_string()
            }
        }
    }
}

/// Logs a skip reason and emits a 'recording-error' event with a human-readable
/// message, so the user sees why the recording produced no transcript.
pub fn emit_skip_reason<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    reason: RecordingSkipReason,
    app_lang: &str,
) {
    use tauri::Emitter;
    let msg = skip_reason_message(reason, app_lang);
    log::debug!("Recording skipped: {} ({})", reason.as_str(), msg);
    let _ = app.emit("recording-error", &msg);
}

/// Current UI language ("ru" or "en") from app state, defaulting to "ru".
pub fn app_language<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> String {
    use tauri::Manager;
    app.state::<crate::state::AppLanguage>()
        .0
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "ru".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── resample_to_16k ──────────────────────────────────────────────────────

    #[test]
    fn resample_same_rate_returns_copy() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let output = resample_to_16k(&input, 16000, 16000);
        assert_eq!(input, output);
    }

    #[test]
    fn resample_empty_input() {
        let output = resample_to_16k(&[], 44100, 16000);
        assert!(output.is_empty());
    }

    #[test]
    fn resample_44100_to_16000_shortens() {
        let input = vec![0.0; 44100]; // 1 second at 44.1kHz
        let output = resample_to_16k(&input, 44100, 16000);
        assert_eq!(output.len(), 16000);
    }

    #[test]
    fn resample_preserves_silence() {
        let input = vec![0.0; 48000];
        let output = resample_to_16k(&input, 48000, 16000);
        assert!(output.iter().all(|&s| s == 0.0));
    }

    // ── clean_repetitive_phrases ─────────────────────────────────────────────

    #[test]
    fn clean_removes_duplicate_words() {
        let result = clean_repetitive_phrases("hello hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn clean_preserves_unique_words() {
        let result = clean_repetitive_phrases("hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn clean_empty_input() {
        let result = clean_repetitive_phrases("");
        assert_eq!(result, "");
    }

    #[test]
    fn clean_removes_hallucination_patterns() {
        // [music] is matched by remove_hallucinations which uses word-boundary regex
        // Brackets are not word chars, so the pattern must be in the explicit list
        let result = clean_repetitive_phrases("DimaTorzok hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn clean_removes_subtitles_pattern() {
        let result = clean_repetitive_phrases("hello world subtitles by amara.org");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn clean_removes_stutter_dashes() {
        // "э-э" is dropped, real words stay untouched
        let result = clean_repetitive_phrases("э-э форматируется текст");
        assert_eq!(result, "форматируется текст");
    }

    #[test]
    fn clean_removes_stutter_dashes_keeps_words() {
        let result = clean_repetitive_phrases("мне не нравится то, как э-э форматируется текст");
        assert_eq!(result, "мне не нравится то, как форматируется текст");
    }

    #[test]
    fn clean_removes_loose_filler_words() {
        let result = clean_repetitive_phrases("и э вот у этот а текст");
        assert_eq!(result, "и вот этот текст");
    }

    #[test]
    fn clean_keeps_short_real_words() {
        // "и", "на", "у" (preposition) are real words — only single-letter
        // hesitation sounds between real words are removed.
        let result = clean_repetitive_phrases("и на у");
        assert_eq!(result, "и на у");
    }

    // ── strip_filler_phrases ─────────────────────────────────────────────────

    #[test]
    fn strip_removes_russian_preamble() {
        let result = strip_filler_phrases("Вот исправленный текст: привет мир");
        assert_eq!(result, "привет мир");
    }

    #[test]
    fn strip_removes_english_preamble() {
        let result = strip_filler_phrases("Here's the cleaned text: hello world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn strip_preserves_normal_text() {
        let result = strip_filler_phrases("привет мир");
        assert_eq!(result, "привет мир");
    }

    #[test]
    fn strip_returns_empty_for_short_text() {
        let result = strip_filler_phrases("a");
        assert_eq!(result, "");
    }

    #[test]
    fn strip_returns_empty_for_punctuation_only() {
        let result = strip_filler_phrases("...");
        assert_eq!(result, "");
    }

    // ── remove_hallucinations ────────────────────────────────────────────────

    #[test]
    fn hallucination_removes_dima_torzok() {
        let result = remove_hallucinations("hello DimaTorzok world");
        assert_eq!(result, "hello world");
    }

    #[test]
    fn hallucination_removes_subtitles() {
        let result = remove_hallucinations("текст Субтитры далее");
        assert_eq!(result, "текст далее");
    }

    #[test]
    fn hallucination_preserves_normal_text() {
        let result = remove_hallucinations("привет мир");
        assert_eq!(result, "привет мир");
    }

    // ── VadTracker ───────────────────────────────────────────────────────────

    #[test]
    fn vad_tracker_does_not_trigger_before_speech() {
        let mut vad = VadTracker::new();
        let silence = vec![0.0001; 1600]; // 100ms silence
                                          // Should return false when no speech has ever occurred
        assert!(!vad.update(&silence, 0.002, 0.5));
        assert!(!vad.speech_started);
    }

    #[test]
    fn vad_tracker_detects_speech_start() {
        let mut vad = VadTracker::new();
        let loud_speech = vec![0.05; 1600]; // 100ms loud speech
        assert!(!vad.update(&loud_speech, 0.002, 0.5));
        assert!(vad.speech_started);
    }

    #[test]
    fn samples_to_i16_pcm_converts_correctly() {
        let input = vec![0.0_f32, 1.0_f32, -1.0_f32];
        let pcm = samples_to_i16_pcm(&input);
        assert_eq!(pcm.len(), 6);
        let sample_0 = i16::from_le_bytes([pcm[0], pcm[1]]);
        let sample_1 = i16::from_le_bytes([pcm[2], pcm[3]]);
        let sample_2 = i16::from_le_bytes([pcm[4], pcm[5]]);
        assert_eq!(sample_0, 0);
        assert_eq!(sample_1, 32767);
        assert_eq!(sample_2, -32767);
    }
}
