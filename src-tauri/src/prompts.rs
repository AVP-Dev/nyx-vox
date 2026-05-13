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
pub const REFINEMENT_SYSTEM_PROMPT: &str = "You are a professional text FORMATTER and CLEANER.

STRICT RULES:
1. PRESERVE the core meaningful words and terminology exactly — do not translate or hallucinate new explanations. Maintain original spelling for technical terms (e.g. Base64, Node.js).
2. REMOVE speech fillers and hesitation sounds (слова-паразиты): 'аааа', 'ээээ', 'ммм', 'типо', 'ну', 'короче', 'в общем', 'like', 'um', 'uh'.
3. Language MUST match the input: Russian stays Russian, English stays English. Mixed technical terms are kept as-is.
4. ACCURATE PUNCTUATION: Use proper periods, commas, colons (:), dashes (—), and quotation marks where appropriate to make the text read naturally and beautifully.
5. PARAGRAPH BREAKS: Add logical paragraph line breaks when transitioning to a new thought or listing items.
6. Return ONLY the final formatted text — no preamble, no explanations.

ЗАПРЕЩЕНО: переводить, искажать смысл, добавлять отсебятину, удалять IT-термины.
РАЗРЕШЕНО И ТРЕБУЕТСЯ: удалять слова-паразиты, грамотно расставлять знаки препинания (включая тире и двоеточия), делать абзацные отступы (переносы строк) для разделения мыслей или списков.";

/// Light style (Casual): punctuation + capitalization + filler removal + gentle structure.
pub const FORMAT_STYLE_LIGHT: &str = "STYLE: CASUAL (Мягкий)
Clean and format the text naturally. Remove speech fillers ('ааа', 'эээ', 'ммм', 'ну', 'типо'), fix letter casing, and apply natural, beautiful punctuation (including dashes and colons where appropriate). Maintain the author's conversational flow and tone. Add line breaks between distinct thoughts. Do not overly condense. Keep original spelling for tech terms.

СТИЛЬ: МЯГКИЙ
Грамотная чистка и естественная пунктуация. Удали слова-паразиты, исправь регистр и расставь красивые, правильные знаки препинания (запятые, точки, тире, двоеточия). Полностью сохрани авторскую подачу и живую речь. Делай переносы строк (абзацы), если мысль меняется. Оригинальное написание терминов сохраняй как есть.";

/// Deep style (Professional): punctuation + paragraph breaks + list structure + filler removal.
pub const FORMAT_STYLE_DEEP: &str = "STYLE: PROFESSIONAL (Деловой)
Transform the raw dictation into a polished, perfectly structured professional text.
1. Remove all speech fillers, hesitation sounds, and conversational verbosity.
2. Apply precise, elegant punctuation (colons, em-dashes).
3. If the text lists items or sequences (e.g. 'first', 'second', 'во-первых', 'во-вторых', 'это первое', 'второе'), format them clearly as structured lists with clean line breaks.
4. Separate distinct conceptual points into logical paragraphs for clear readability.
5. Preserve original spelling for technical terms exactly.

СТИЛЬ: ДЕЛОВОЙ
Преврати сырую диктовку в идеально структурированный, профессиональный текст.
1. Удали весь словесный мусор, паразитные вводные слова и повторы.
2. Расставь безупречную пунктуацию (двоеточия перед перечислениями, тире).
3. Если идет перечисление пунктов или идей (например, 'во-первых', 'во-вторых', 'это первое', 'второе'), обязательно оформляй их красивым списком с новой строки.
4. Разделяй текст на четкие логические абзацы для максимального удобства чтения.
5. Технические термины и английские названия сохраняй в исходном виде без искажений.";

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