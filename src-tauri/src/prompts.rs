// NYX Vox: Centralized AI Prompts
// Single source of truth for all AI interactions.
// v1.1.0: Bilingual prompts, mixed RU+EN speech support, formatter-only mode.

// ── Transcription Prompts (STT) ──────────────────────────────────────────────

/// Groq Whisper STT: handles natural Russian and mixed Russian + English speech.
/// Primed as natural dialogue to teach Whisper accurate spelling, casing, punctuation, and terms.
pub const GROQ_STT_PROMPT: &str = "Привет! Обсуждаем задачи, созвоны, код и сервисы: Сбер, Яндекс, Telegram, WhatsApp, Zoom, GitHub, GitLab, Node.js, Bun, API, CLI, JSON, SQL, TypeScript, React, Next.js, Docker, Linux, macOS, DeepSeek, Gemini, Groq, Whisper, PostgreSQL.";

/// Multimodal STT system prompt (Gemini, GigaChat).
/// Teaches the multimodal LLM to behave purely as an audio transcriber, NOT a conversational chatbot.
pub const MULTIMODAL_STT_SYSTEM_PROMPT: &str = "Ты — специализированная модель транскрибации речи (Speech-to-Text).
Твоя ЕДИНСТВЕННАЯ задача: прослушать прикреплённое аудио и перевести речь в текст ТОЧНО И ДОСЛОВНО.
ПРАВИЛА:
1. Выведи ТОЛЬКО текст того, что сказано в аудиозаписи.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО отвечать на вопросы из аудиозаписи, давать советы, писать код или вести диалог.
3. Сохраняй исходный язык (русский, английский или смешанный).
4. НЕ переводи, НЕ добавляй никаких комментариев от себя.";

/// Multimodal STT user prompt (Gemini, GigaChat).
pub const MULTIMODAL_STT_USER_PROMPT: &str = "Расшифруй прикреплённое аудио слово в слово. Верни только распознанный текст без комментариев.";

/// Legacy alias for compatibility.
#[allow(dead_code)]
pub const GEMINI_STT_PROMPT: &str = MULTIMODAL_STT_SYSTEM_PROMPT;

/// Mixed RU+EN dictation context for Whisper ASR.
pub const MIXED_RU_EN_STT_PROMPT: &str = "Привет! Обсуждаем проект: deploy на server, pull request в main, endpoint в API, база данных PostgreSQL, фронтенд на React и Next.js, Docker, TypeScript, Сбер, Telegram.";

// ── Refinement / Formatting Prompts ──────────────────────────────────────────
// CORE PRINCIPLE: 100% Verbatim Formatting. Do NOT rewrite, rephrase, or substitute words.
// Add punctuation, fix capitalization, remove stutters/fillers, add paragraph breaks where needed.

/// System prompt for ALL AI formatters (GigaChat, Gemini, Groq, Qwen, DeepSeek).
/// High-precision refinement / disfluency filter per architecture specification.
pub const REFINEMENT_SYSTEM_PROMPT: &str = "Ты — специализированный модуль нормализации и пунктуации устной речи в реальном времени.
Твоя цель: преобразовать сырую транскрипцию в чистый, синтаксически верный текст, сохранив 100% авторского смысла.

ПРАВИЛА ОЧИСТКИ ОТ МУСОРА:
1. Удаляй речевые заминки, паразитные звуки хезитации и зависания: \"э-э\", \"а-а\", \"ну-у\", \"хм-м\", \"ммм\", \"типа\", если они используются как пауза между мыслями.
2. Удаляй заикания, повторы слов из-за запинки и ложные старты фраз (например: \"мы с, мы с ребятами\" -> \"мы с ребятами\"; \"я думал... в общем мы решили\" -> \"в общем мы решили\").

ПРАВИЛО СОХРАНЕНИЯ ЭМОЦИОНАЛЬНЫХ МЕЖДОМЕТИЙ:
3. СТРОГО СОХРАНЯЙ смысловые и эмоциональные восклицания и междометия, если они выражают реакцию, оценку или отношение спикера.
   - Пример: \"М-м, как вкусно!\" -> ОСТАВЛЯТЬ \"М-м, как вкусно!\" (не удалять \"М-м\").
   - Пример: \"Ого, ничего себе новость\" -> ОСТАВЛЯТЬ.
   - Пример: \"Эх, не получилось\" -> ОСТАВЛЯТЬ.
   - Пример: \"Увы, проект закрыт\" -> ОСТАВЛЯТЬ.

ПРАВИЛА ОФОРМЛЕНИЯ:
4. Расставь грамматически верную пунктуацию (точки, запятые, тире, вопросительные и восклицательные знаки) и капитализацию (заглавные буквы в начале предложений и именах собственных).
5. Не меняй авторские термины, профессиональный сленг, числа, факты и падежные формы смысловых слов.
6. В ответе возвращай ТОЛЬКО финальный текст. Никаких пояснений, мета-сообщений, вводных слов и кавычек вокруг ответа.";

/// Light style (Casual): punctuation + capitalization + filler removal + preserve conversational flow.
pub const FORMAT_STYLE_LIGHT: &str = "СТИЛЬ: РАЗГОВОРНЫЙ (МЯГКИЙ)
- Максимально бережная расстановка знаков препинания (. , ? ! : -).
- Полное сохранение живого разговорного стиля, авторской интонации, эмоций и всех деталей.
- 0% рерайтинга: ни одно значимое слово автора не должно быть заменено или выброшено.
- Сохраняй все эмоциональные возгласы и технические названия как есть.

STYLE: CASUAL
- Apply natural punctuation while keeping 100% of original words and sentence structures.
- Do NOT rewrite, do NOT replace words with synonyms. Preserve conversational tone.";

/// Deep style (Professional): structured layout + lists if dictated + exact wording.
pub const FORMAT_STYLE_DEEP: &str = "СТИЛЬ: СТРУКТУРИРОВАННЫЙ (ДЕЛОВОЙ)
- 100% дословное сохранение всех слов и формулировок автора. БЕЗ пересказа и БЕЗ синонимов!
- Точная пунктуация (двоеточия перед перечислениями, тире, логические абзацы).
- Если сам автор в речи перечисляет пункты (например: «во-первых, во-вторых», «первое, второе»), оформи их аккуратным списком с новой строки.
- НЕ создавай собственные списки советов или рекомендаций.

STYLE: STRUCTURED
- Format raw dictation into structured paragraphs and clean lists (ONLY if the speaker enumerated points).
- Keep every meaningful word and word order EXACTLY as dictated. Do NOT rewrite or rephrase.";

/// Universal rule appended to all formatter system prompts.
pub const FORMAT_STYLE_UNIVERSAL_RULE: &str =
    "Output: ONLY the formatted text. No labels, no comments, no preamble.";

/// Delimiter used in user message construction.
pub const REFINEMENT_USER_DELIMITER: &str = "\n---\n";
pub const REFINEMENT_USER_SUFFIX: &str = "\n---\n";

/// Generic user instruction prefix for refinement.
pub const REFINEMENT_USER_INSTRUCTION_GENERIC: &str = "Отформатируй текст ниже (только знаки препинания, заглавные буквы, абзацы). НЕ ПЕРЕПИСЫВАЙ И НЕ МЕНЯЙ СЛОВА АВТОРА / Punctuate and capitalize ONLY. Do not rewrite words:";

// ── API Parameters ───────────────────────────────────────────────────────────

/// Low temperature = strict rule-following, no hallucinations.
pub const DEFAULT_TEMPERATURE: f32 = 0.0;
/// Moderate top_p for formatters — allows natural punctuation choice.
pub const DEFAULT_TOP_P: f32 = 0.3;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refinement_prompt_forbids_rewriting_and_mandates_verbatim() {
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("сохранив 100% авторского смысла"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("Не меняй авторские термины"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("падежные формы смысловых слов"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("ТОЛЬКО финальный текст"));
    }

    #[test]
    fn refinement_prompt_removes_hesitations_and_stutters() {
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("ПРАВИЛА ОЧИСТКИ ОТ МУСОРА"));
        assert!(
            REFINEMENT_SYSTEM_PROMPT.contains("Удаляй речевые заминки, паразитные звуки хезитации")
        );
        assert!(REFINEMENT_SYSTEM_PROMPT
            .contains("Удаляй заикания, повторы слов из-за запинки и ложные старты фраз"));
    }

    #[test]
    fn refinement_prompt_preserves_emotional_interjections() {
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("ПРАВИЛО СОХРАНЕНИЯ ЭМОЦИОНАЛЬНЫХ МЕЖДОМЕТИЙ"));
        assert!(REFINEMENT_SYSTEM_PROMPT
            .contains("СТРОГО СОХРАНЯЙ смысловые и эмоциональные восклицания и междометия"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("М-м, как вкусно!"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("Ого, ничего себе новость"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("Эх, не получилось"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("Увы, проект закрыт"));
    }

    #[test]
    fn refinement_prompt_demands_punctuation_and_capitalization() {
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("Расставь грамматически верную пунктуацию"));
        assert!(REFINEMENT_SYSTEM_PROMPT.contains("капитализацию"));
    }

    #[test]
    fn style_prompts_forbid_advice_and_list_creation() {
        assert!(FORMAT_STYLE_LIGHT.contains("0% рерайтинга"));
        assert!(
            FORMAT_STYLE_LIGHT.contains("ни одно значимое слово автора не должно быть заменено")
        );
        assert!(FORMAT_STYLE_DEEP.contains("100% дословное сохранение всех слов"));
        assert!(FORMAT_STYLE_DEEP.contains("НЕ создавай собственные списки советов"));
    }

    #[test]
    fn style_prompts_allow_grammar_but_forbid_synonyms() {
        assert!(FORMAT_STYLE_LIGHT.contains("do NOT replace words with synonyms"));
        assert!(FORMAT_STYLE_DEEP.contains("БЕЗ пересказа и БЕЗ синонимов"));
        assert!(FORMAT_STYLE_DEEP.contains("Do NOT rewrite or rephrase"));
    }
}
