# NYX Vox: AI Prompts Documentation

This document contains all current prompts and system settings for Speech-to-Text (STT) transcription and subsequent AI text refinement in the NYX Vox project.

**Last Updated:** v1.0.0 (Current)

---

## ⚙️ Global API Settings (Critical)

For the AI Cleaning stage (Gemini, DeepSeek, Qwen), be sure to use the following parameters when calling the API to exclude hallucinations and fabricated content:

- **temperature:** 0.1 (Maximum determinism, AI works as a strict corrector).
- **top_p:** 0.1 or 0.2.

> **IMPORTANT:** Starting from version 1.0.0, prompts are maximally simplified to prevent text translation and adding information on their own.

---

## 🎙️ 1. Transcription Prompts (STT)

Prompts for guiding STT engines (punctuation, language detection, formatting).

### 1.1. Google Gemini (Multimodal STT)

Used when transmitting audio files directly to Gemini (generateContent with audio/wav).

**Prompt:**
```
Transcribe audio. IMPORTANT:
- Detect language and transcribe in THAT language
- DO NOT translate
- DO NOT mix languages
- If speaker speaks Russian → write Russian
- If speaker speaks English → write English
- Return ONLY transcript text
```

### 1.2. Groq (Whisper-v3)

Used for the Groq cloud engine. Transmitted via multipart form field.

**Prompt:**
```
Transcribe audio. Detect language. DO NOT translate. DO NOT mix languages. Russian=Russian, English=English. Only transcript text.
```

### 1.3. Deepgram (Nova-2)

Transmitted as a Query parameter to improve punctuation.

- **Auto-mode:** `Detect language. Transcribe in that language. DO NOT translate. DO NOT mix languages.`
- **RU-mode:** `Русская речь. Пиши по-русски. НЕ переводи на английский.`

---

## 🧹 2. Refinement Prompts (AI Cleaning)

Unified architecture of prompts for post-processing raw text via LLM (Gemini, DeepSeek, Qwen).

### 2.1. System Prompt (Global / System Instruction)

This prompt should be transmitted in the `system` role (or `system_instruction` for Gemini). It contains ironclad processing rules.

**Prompt:**
```
ОЧИСТИ ТЕКСТ.
1. Язык КАК В ОРИГИНАЛЕ (русский=русский, английский=английский)
2. БЕЗ ПЕРЕВОДА
3. БЕЗ ДОБАВОК
4. ТОЛЬКО ТЕКСТ

RUSSIAN = RUSSIAN
ENGLISH = ENGLISH
NO TRANSLATION
```

### 2.2. User Instructions (Concatenation with Raw Text)

How to form the final `user` request to the API, combining the instruction and raw text from STT.

**For Gemini and Qwen:**
```
CLEAN:

[INSERT_RAW_TEXT_HERE]
```

**For DeepSeek (chat-mode):**
```
CLEAN:

[INSERT_RAW_TEXT_HERE]
```

---

## 🎨 3. Formatting Styles (Settings)

Prompts for various formatting styles available in the app settings.

### 3.1. Light Style (Casual)
```
ОЧИСТИ: убери мусор, слова-паразиты, ошибки. Язык как в оригинале. НЕ ПЕРЕВОДИ. НЕ ДОБАВЛЯЙ ничего.
```

### 3.2. Deep Style (Professional)
```
ОЧИСТИ И ОФОРМИ: убери мусор, расставь абзацы. Язык как в оригинале. НЕ ПЕРЕВОДИ. НЕ ДОБАВЛЯЙ ничего.
```

### 3.3. Universal Rule
```
Язык оригинала. БЕЗ ПЕРЕВОДА. БЕЗ ДОБАВОК.
```

---

## 🛡️ 4. Usage Logic

### Zero-Hallucination
Using `temperature: 0.1` and simplified prompts blocks the model's attempts to engage in dialogue with the user.

### Cost Efficiency
The strict requirement "ONLY TEXT" guarantees minimal consumption of outgoing tokens (Output Tokens).

### Silent Fallback
If the text is empty or contains only noise, an empty string is returned, saving requests to the DB and API.

### Language Preservation
**CRITICALLY IMPORTANT:** Starting from version 1.0.0, all prompts contain an explicit prohibition on text translation. Russian text remains Russian, English remains English.

---

## 📝 Changelog

### v1.0.0 — Major Refactoring

**Prompt Changes:**
- ✅ Simplified to maximum (150 characters instead of 1500+)
- ✅ Added explicit prohibition on translation
- ✅ Added prohibition on adding information
- ✅ Removed complex examples and formulations

**Result:**
- Text translation: **Fixed** ✅
- Adding words on own: **Fixed** ✅
- Critical crashes: **Fixed** ✅

[📄 Full Changelog](./CHANGELOG.md) | [📄 Полная история изменений](./CHANGELOG.ru.md)

---

<br />
<p align="center">
  <a href="https://avpdev.com/en/"><b>Alexios Odos</b></a>
  &nbsp;|&nbsp;
  <a href="https://avpdev.com/ru/"><b>Aliaksei Patskevich</b></a>
  <br />
  <sub>
    <b>Software Engineer</b> • Code, Design & AI
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>
