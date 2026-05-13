// NYX Vox: Centralized AI Prompts
// Single source of truth for all AI interactions.
// v1.1.0: Bilingual prompts, mixed RU+EN speech support, formatter-only mode.

// ── Transcription Prompts (STT) ──────────────────────────────────────────────

/// Groq Whisper STT: handles mixed Russian + English tech speech.
/// Vocabulary hint teaches the model common tech terms to avoid mishearing them.
pub const GROQ_STT_PROMPT: &str = "Transcribe accurately. Language detection rules:
- Russian speech → write in Russian
- English speech → write in English
- Mixed speech (Russian with English tech terms) → keep each word in its original language

Tech vocabulary (recognize these exactly): GitHub, GitLab, Cursor, Node, Node.js, Bun, npm, pnpm, API, CLI, UI, UX, JSON, SQL, CSS, HTML, TypeScript, JavaScript, Rust, Python, Docker, Nginx, Linux, macOS, iOS, Android, React, Next.js, Tailwind, Prisma, Supabase, Antigravity, DeepSeek, Gemini, Groq, Whisper, Deepgram, Tauri, VS Code, Xcode

Rules:
- DO NOT translate
- DO NOT mix up languages unnaturally
- Preserve proper nouns and product names as-is
- Return ONLY the transcript text";

/// Gemini STT: multimodal audio transcription.
#[allow(dead_code)]
pub const GEMINI_STT_PROMPT: &str = "Transcribe audio exactly as spoken. Rules:
- Detect language and transcribe in THAT language only
- Russian speech → Russian text
- English speech → English text
- Mixed Russian+English (code-switching) → preserve each word in original language
- DO NOT translate
- DO NOT add commentary
- Preserve technical terms: GitHub, Node, Bun, API, CLI, TypeScript, React, etc.
- Return ONLY transcript text";

/// Deepgram auto-detect: bilingual hint.
pub const DEEPGRAM_AUTO_PROMPT: &str = "Transcribe in the detected language. Preserve technical terms in English (GitHub, Node, API, etc.) even in Russian speech. DO NOT translate.";

/// Deepgram forced Russian: allow English tech terms inline.
pub const DEEPGRAM_RU_PROMPT: &str = "Русская речь с английскими техническими терминами. Пиши по-русски, но сохраняй английские термины как есть: GitHub, Node, Bun, API, TypeScript, React, Docker и другие. НЕ переводи.";

// ── Refinement / Formatting Prompts ──────────────────────────────────────────
// CORE PRINCIPLE: Format-only. Do NOT change words. Do NOT translate.
// Add punctuation, fix capitalization, add paragraph breaks where needed.

/// System prompt for ALL AI formatters (Gemini, Groq, Qwen, DeepSeek).
/// Bilingual for maximum model compliance.
pub const REFINEMENT_SYSTEM_PROMPT: &str = "You are a text FORMATTER, not a translator or editor.

STRICT RULES:
1. PRESERVE every word exactly as written — do not substitute, rephrase, or remove words
2. Language MUST match the input: Russian stays Russian, English stays English
3. Mixed Russian+English text is NORMAL — keep both languages as-is
4. DO NOT translate ANY word
5. DO NOT add new words, explanations, or commentary
6. DO NOT remove technical terms (GitHub, Node, API, etc.)
7. ONLY fix: punctuation, capitalization, paragraph breaks
8. Return ONLY the formatted text — no preamble, no explanations

ЗАПРЕЩЕНО: переводить, перефразировать, добавлять слова, убирать технические термины.
РАЗРЕШЕНО: расставить знаки препинания, заглавные буквы, абзацы.";

/// Light style (Casual): punctuation + capitalization only.
pub const FORMAT_STYLE_LIGHT: &str = "FORMAT ONLY — add punctuation and capitalization. Preserve every word. Keep original language (Russian/English/mixed). No translation. No rephrasing.

ТОЛЬКО ФОРМАТИРОВАНИЕ — расставь знаки препинания и заглавные буквы. Каждое слово сохраняй как есть. Язык не меняй.";

/// Deep style (Professional): punctuation + paragraph breaks + structure.
pub const FORMAT_STYLE_DEEP: &str = "FORMAT AND STRUCTURE — add punctuation, capitalization, and paragraph breaks where logical pauses occur. Preserve every word exactly. Keep original language (Russian/English/mixed). No translation. No rephrasing. No summarizing.

ФОРМАТИРОВАНИЕ И СТРУКТУРА — расставь знаки препинания, заглавные буквы и абзацы в логических паузах. Каждое слово сохраняй точно. Язык не меняй.";

/// Universal rule appended to all formatter system prompts.
pub const FORMAT_STYLE_UNIVERSAL_RULE: &str = "Output: ONLY the formatted text. No labels, no comments, no preamble.";

/// Delimiter used in user message construction.
pub const REFINEMENT_USER_DELIMITER: &str = "\n---\n";
pub const REFINEMENT_USER_SUFFIX: &str = "\n---\n";

/// Generic user instruction prefix for refinement.
pub const REFINEMENT_USER_INSTRUCTION_GENERIC: &str = "FORMAT:";
pub const REFINEMENT_USER_INSTRUCTION_DEEPSEEK: &str = "FORMAT:";

// ── API Parameters ───────────────────────────────────────────────────────────

/// Low temperature = strict rule-following, no hallucinations.
pub const DEFAULT_TEMPERATURE: f32 = 0.0;
/// Moderate top_p for formatters — allows natural punctuation choice.
pub const DEFAULT_TOP_P: f32 = 0.3;