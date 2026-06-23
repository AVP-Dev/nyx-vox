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
    ];

    static HALLUCINATION_RES: OnceLock<Vec<Regex>> = OnceLock::new();
    let res = HALLUCINATION_RES.get_or_init(|| {
        patterns
            .iter()
            .filter_map(|p| Regex::new(&format!(r"(?i)\b?{}\b?", regex::escape(p))).ok())
            .collect()
    });

    let mut cleaned = text.to_string();
    for re in res {
        cleaned = re.replace_all(&cleaned, "").to_string();
    }
    re_spaces.replace_all(cleaned.trim(), " ").to_string()
}

pub fn clean_repetitive_phrases(text: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;

    static RE_PREFIX: OnceLock<Regex> = OnceLock::new();
    static RE_PARASITES: OnceLock<Regex> = OnceLock::new();

    let re_prefix =
        RE_PREFIX.get_or_init(|| Regex::new(r"(?i)([а-яёa-z])\s*-\s+([а-яёa-z])").unwrap());
    let re_parasites = RE_PARASITES
        .get_or_init(|| Regex::new(r"(?i)\b(аа+|ээ+|мм+|типо|короче)\b[\s,\.]*").unwrap());

    let text = remove_hallucinations(text);
    let text = re_prefix.replace_all(&text, "$1 $2").to_string();
    let text = re_parasites.replace_all(&text, " ").to_string();

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return text.to_string();
    }

    let mut result = Vec::new();
    let mut i = 0;

    while i < words.len() {
        result.push(words[i]);
        // Simple case: "word word" -> "word"
        if i + 1 < words.len() && words[i].to_lowercase() == words[i + 1].to_lowercase() {
            i += 1;
        }
        i += 1;
    }

    result.join(" ")
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
