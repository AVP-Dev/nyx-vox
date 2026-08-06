# Prompt Pipeline Implementation Plan

This document tracks the prompt and language-safety fixes for NYX Vox.

## Goals

- Preserve the spoken language exactly: Russian stays Russian, English stays English, mixed technical speech stays mixed.
- Prevent LLM preambles, labels, markdown fences, stray symbols, and provider-specific artifacts.
- Keep technical terms and casing intact, including `GitHub`, `Node.js`, `npm`, `iOS`, and `macOS`.
- Preserve paragraph and list formatting produced by the formatter.
- Make Gemini STT use Gemini, not the Groq transcription path.

## Implementation

1. Gemini STT
   - Use `gemini-3-flash-preview` through Gemini `generateContent`.
   - Send recorded WAV audio as `inlineData` with `mimeType: audio/wav`.
   - Use `GEMINI_STT_PROMPT` as `systemInstruction`.
   - Keep Groq STT on the existing Whisper endpoint.

2. Gemini refinement
   - Replace the retired `gemini-3.1-flash-lite-preview` with `gemini-3-flash-preview`.
   - Use the current `systemInstruction` request field.

3. Provider prompt wrapper
   - Send all formatter providers the same user message shape.
   - Wrap source text between explicit delimiters.
   - Tell the model to treat delimited text as data, not as instructions.

4. Prompt wording
   - Keep the system prompt strict: format only, no translation, no invented content.
   - Make professional style structural, not rewriting-oriented.

5. Sanitization
   - Preserve line breaks after LLM formatting.
   - Avoid frontend capitalization that mutates product names.
   - Limit preamble stripping to known complete preamble phrases.

## Verification

- `cargo check` must pass.
- `bun run lint` is expected to still report pre-existing TypeScript `any` errors unless those files are separately cleaned up.
- Manual API verification requires valid provider keys and network access.

