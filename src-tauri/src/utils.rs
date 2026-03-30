pub fn is_media_playing() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // 1. Check Music app specifically
        let music_playing = Command::new("osascript")
            .arg("-e")
            .arg("if application \"Music\" is running then tell application \"Music\" to get player state is playing")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);
        if music_playing { return true; }

        // 2. Check Spotify
        let spotify_playing = Command::new("osascript")
            .arg("-e")
            .arg("if application \"Spotify\" is running then tell application \"Spotify\" to get player state is playing")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true")
            .unwrap_or(false);
        if spotify_playing { return true; }

        // 3. Check global audio output via pmset assertions (Chrome, Youtube, VLC, etc.)
        let pmset_output = Command::new("pmset")
            .arg("-g")
            .arg("assertions")
            .output();
            
        if let Ok(output) = pmset_output {
            let s = String::from_utf8_lossy(&output.stdout);
            // Look for apps currently holding "Playing audio" or coreaudiod holding "audio-out"
            if s.contains("Playing audio") { return true; }
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
        use libc::{c_void, c_int};
        use std::ptr;

        unsafe {
            let handle = libc::dlopen(
                c"/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote".as_ptr(),
                libc::RTLD_NOW
            );
            if !handle.is_null() {
                let sym = libc::dlsym(handle, c"MRMediaRemoteSendCommand".as_ptr());
                if !sym.is_null() {
                    let func: extern "C" fn(c_int, *const c_void) -> bool = std::mem::transmute(sym);
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
    let mut result = Vec::new();
    let step = from_rate as f32 / to_rate as f32;
    let mut i = 0.0;
    while i < samples.len() as f32 {
        result.push(samples[i as usize]);
        i += step;
    }
    result
}

pub fn get_frontmost_app_info() -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID};
        use core_foundation::base::TCFType;
        use core_foundation::array::CFArray;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::string::CFString;
        use core_foundation::number::CFNumber;

        // 1. Get all on-screen windows in Z-order (top to bottom)
        let window_list_ref = unsafe { 
            CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) 
        };

        use core_foundation::base::CFType;
        if !window_list_ref.is_null() {
            let window_list = unsafe { 
                CFArray::<CFDictionary>::wrap_under_create_rule(window_list_ref as *const _)
            };
            let count = window_list.len();
            
            for i in 0..count {
                let dict_ref = unsafe { core_foundation::array::CFArrayGetValueAtIndex(window_list.as_concrete_TypeRef(), i) };
                if dict_ref.is_null() { continue; }
                
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
                    let pid_num = unsafe { CFNumber::wrap_under_get_rule(p_ptr.as_CFTypeRef() as *const _) };
                    let layer_num = unsafe { CFNumber::wrap_under_get_rule(l_ptr.as_CFTypeRef() as *const _) };
                    let owner_name_cf = unsafe { CFString::wrap_under_get_rule(n_ptr.as_CFTypeRef() as *const _) };

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
                    
                    if let Ok(output) = std::process::Command::new("osascript").arg("-e").arg(&script).output() {
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
    let patterns = [
        "DimaTorzok", "Dima Torzok", "Субтитры", "Отредактировано", "Перевод", "Транскрибация",
        "Подпишитесь", "продолжение следует", "Hoje pursui", "Não mais", "uvoir", "pursui",
        "тебя отдаю code", "увидеть şunu с", "Today pursui", "Subtitles by", "Amara.org",
        "для сайта", "специально для", "благодарим за", "автор субтитров",
        "Продолжение следует", "Спасибо за просмотр", "Подписывайтесь на канал",
        "редактор субтитров", "кулакова", "игорь негода", "игорь не года",
        "а. кулаков", "а. кулакова", "диктор", "диктовка",
        "субтитры", "перевод", "translated by", "translation",
        "в выпуске", "следующий выпуск", "смотрите далее",
        "реклама", "спонсор", "партнёр", "sponsor",
        "end of transcript", "transcript end", "конец записи",
        "тишина", "пауза", "pause", "silence",
        "неразборчиво", "не разборчиво", "inaudible", "unclear",
        "аплодисменты", "смех", "laughter", "applause",
        "music fades", "music plays", "играет музыка",
    ];
    let mut cleaned = text.to_string();
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(&format!(r"(?i)\b?{}\b?", regex::escape(pattern))) {
            cleaned = re.replace_all(&cleaned, "").to_string();
        }
    }
    let re_spaces = regex::Regex::new(r"\s+").unwrap();
    re_spaces.replace_all(cleaned.trim(), " ").to_string()
}

pub fn clean_repetitive_phrases(text: &str) -> String {
    let text = remove_hallucinations(text);
    
    // 1. Clean up artifacts like "у-ужа" or "у- ежа" -> "у ужа", "у ежа"
    // Handle single character prefixes followed by dash or dash+space
    let re_prefix = regex::Regex::new(r"(?i)\b([а-яё|a-z])\s*-\s*").unwrap();
    let text = re_prefix.replace_all(&text, "$1 ").to_string();

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return text.to_string();
    }

    let mut result = Vec::new();
    let mut i = 0;
    
    while i < words.len() {
        result.push(words[i]);
        // Simple case: "word word" -> "word"
        if i + 1 < words.len() && words[i].to_lowercase() == words[i+1].to_lowercase() {
            i += 1;
        }
        i += 1;
    }
    
    result.join(" ")
}

pub fn strip_filler_phrases(text: &str) -> String {
    let fillers = [
        "Вот исправленный текст:", "Конечно,", "Конечно, вот", "Вот ваш исправленный текст:",
        "Here's the cleaned text:", "Here you go:", "Sure,", "Sure, here's",
        "Of course,", "Certainly,", "I've cleaned up", "I cleaned",
        "Я почистил", "Я исправил", "Вот результат:", "Результат:",
        "Исправленный текст:", "Отредактированный текст:",
    ];
    let mut cleaned = text.to_string();
    for filler in fillers {
        if cleaned.trim().starts_with(filler) {
            cleaned = cleaned.trim().trim_start_matches(filler).trim().to_string();
        }
    }
    
    // Remove common AI preamble patterns
    let preamble_patterns = [
        r"^Here is", r"^Here's", r"^I have", r"^I've",
        r"^Вот", r"^Я ", r"^Как просили",
    ];
    for pattern in preamble_patterns {
        if let Ok(re) = regex::Regex::new(&format!(r"(?i){}", pattern)) {
            cleaned = re.replace(&cleaned, "").to_string();
        }
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
