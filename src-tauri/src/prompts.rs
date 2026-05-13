// NYX Vox: Centralized AI Prompts
// Single source of truth for all AI interactions.
// v1.1.0: Bilingual prompts, mixed RU+EN speech support, formatter-only mode.

// ── Transcription Prompts (STT) ──────────────────────────────────────────────

/// Groq Whisper STT: handles mixed Russian + English tech speech.
/// Vocabulary hint teaches the model common tech terms to avoid mishearing them.
pub const GROQ_STT_PROMPT: &str = "RAG, векторная база, PostgreSQL, Worker, статус New, GitHub, GitLab, Cursor, Node, Node.js, Bun, npm, API, CLI, UI, UX, JSON, SQL, CSS, HTML, TypeScript, JavaScript, Rust, Python, Docker, Nginx, Linux, macOS, iOS, Android, React, Next.js, Tailwind, Prisma, Supabase, Antigravity, DeepSeek, Gemini, Groq, Whisper, Deepgram, Tauri, VS Code, Xcode";

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
1. PRESERVE the core meaningful words, facts, and actions exactly — do not translate, hallucinate, or drop operational steps. Every action described by the speaker (e.g. clicks, button presses, sequence of events) MUST be kept to maintain the true scenario. Maintain original spelling for technical terms (e.g. Base64, Node.js).
2. REMOVE speech fillers and hesitation sounds (слова-паразиты): 'аааа', 'ээээ', 'ммм', 'типо', 'ну', 'короче', 'в общем', 'like', 'um', 'uh'.
3. Language MUST match the input: Russian stays Russian, English stays English. Mixed technical terms are kept as-is.
4. ACCURATE PUNCTUATION: Use proper periods, commas, colons (:), dashes (—), and quotation marks where appropriate to make the text read naturally and beautifully. Correct minor grammatical errors seamlessly.
5. PARAGRAPH BREAKS: Add logical paragraph line breaks when transitioning to a new thought or listing items.
6. Return ONLY the final formatted text — no preamble, no explanations.

ЗАПРЕЩЕНО: переводить, искажать суть, удалять описанные автором действия (клики, шаги) или факты, добавлять отсебятину.
РАЗРЕШЕНО И ТРЕБУЕТСЯ: аккуратно исправлять грамматику, удалять слова-паразиты, грамотно расставлять знаки препинания (включая тире и двоеточия), делать абзацные отступы.";

/// Light style (Casual): punctuation + capitalization + filler removal + gentle structure.
pub const FORMAT_STYLE_LIGHT: &str = "STYLE: CASUAL (Мягкий)
Clean the text, correct grammar, and apply natural punctuation.
CRITICAL: Do NOT drop actions, technical steps, or facts. Preserve every operation described by the speaker (e.g. clicking links, opening views) to ensure the scenario remains technically precise. Maintain the author's conversational but grammatically polished flow. Keep original spelling for tech terms.

СТИЛЬ: МЯГКИЙ
Грамотная чистка, исправление ошибок и естественная пунктуация.
КРИТИЧЕСКИ ВАЖНО: НИ В КОЕМ СЛУЧАЕ не удаляй действия, технические шаги и факты. Каждое описанное автором действие (клики, переходы, события) должно остаться в тексте, чтобы суть сценария не изменилась. Текст должен быть грамотным, аккуратным, но полностью сохранять все детали и авторский ход мысли.";

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