// NYX Vox: Centralized AI Prompts
// This file acts as the single source of truth for all AI interactions.

// ── Transcription Prompts (STT) ──────────────────────────────────────────────

#[allow(dead_code)]
pub const GEMINI_STT_PROMPT: &str = "CRITICAL: Transcribe in the SAME language as spoken. DO NOT translate.
ВАЖНО: Распознай в ТОМ ЖЕ языке, на котором говорят. НЕ переводи.

- If Russian speech → write Russian text
- If English speech → write English text  
- НЕ СМЕШИВАЙ языки / DO NOT mix languages
- Return ONLY transcript text / Только текст";

pub const GROQ_STT_PROMPT: &str = "CRITICAL: Russian=Russian, English=English. DO NOT translate.
ВАЖНО: Русский=Русский, Английский=Английский. НЕ переводи.

Detect language and transcribe in THAT language only.
Распознай язык и пиши ТОЛЬКО на нём.";

pub const DEEPGRAM_AUTO_PROMPT: &str = "Detect language. Transcribe in that language. DO NOT translate. DO NOT mix languages.
Распознай язык. Пиши на нём. НЕ переводи. НЕ смешивай языки.";

pub const DEEPGRAM_RU_PROMPT: &str = "Русская речь. Пиши ТОЛЬКО по-русски. НЕ переводи на английский. НЕ смешивай языки.";

// ── Refinement Prompts (AI Cleaning) ─────────────────────────────────────────

pub const REFINEMENT_SYSTEM_PROMPT: &str = "ОЧИСТИ ТЕКСТ.
1. Язык КАК В ОРИГИНАЛЕ (русский=русский, английский=английский)
2. БЕЗ ПЕРЕВОДА
3. БЕЗ ДОБАВОК
4. ТОЛЬКО ТЕКСТ

RUSSIAN = RUSSIAN
ENGLISH = ENGLISH
NO TRANSLATION";

pub const REFINEMENT_USER_DELIMITER: &str = "\n---\n";
pub const REFINEMENT_USER_SUFFIX: &str = "\n---\n";

pub const REFINEMENT_USER_INSTRUCTION_GENERIC: &str = "CLEAN:";

pub const REFINEMENT_USER_INSTRUCTION_DEEPSEEK: &str = "CLEAN:";

// ── New Formatting Styles (Settings) ────────────────────────────────────────

pub const FORMAT_STYLE_LIGHT: &str = "ОЧИСТИ: убери мусор, слова-паразиты, ошибки. Язык как в оригинале. НЕ ПЕРЕВОДИ. НЕ ДОБАВЛЯЙ ничего.";

pub const FORMAT_STYLE_DEEP: &str = "ОЧИСТИ И ОФОРМИ: убери мусор, расставь абзацы. Язык как в оригинале. НЕ ПЕРЕВОДИ. НЕ ДОБАВЛЯЙ ничего.";

pub const FORMAT_STYLE_UNIVERSAL_RULE: &str = "Язык оригинала. БЕЗ ПЕРЕВОДА. БЕЗ ДОБАВОК.";

// ── API Parameters ───────────────────────────────────────────────────────────

pub const DEFAULT_TEMPERATURE: f32 = 0.0;
pub const DEFAULT_TOP_P: f32 = 0.3;