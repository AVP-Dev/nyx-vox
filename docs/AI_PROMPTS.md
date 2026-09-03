# NYX Vox: AI Prompts Documentation

> **Источник истины:** `src-tauri/src/prompts.rs`.
> Этот документ — зеркало кода: если промпты меняются, обновляй сначала `prompts.rs`, затем этот файл.

**Актуально для:** v1.4.0

---

## ⚙️ Глобальные параметры API

Все AI-форматтеры (Gemini, DeepSeek, Qwen, Groq) используют одинаковые параметры для детерминированного форматирования без галлюцинаций:

| Константа | Значение | Назначение |
|---|---|---|
| `DEFAULT_TEMPERATURE` | `0.0` | Строгое следование правилам, без галлюцинаций |
| `DEFAULT_TOP_P` | `0.3` | Позволяет естественный выбор пунктуации, оставаясь строгим |

## 🎙️ 1. Транскрипционные промпты (STT)

Промпты для движков распознавания речи. Языки: `mixed` (русский с английскими тех-терминами), `ru`, `en`. **Режима `auto` больше нет** — он удалён как нестабильный.

### 1.1. `GROQ_STT_PROMPT` — Groq (Whisper-Large-v3-Turbo)

Словарь технических терминов для предотвращения ошибок распознавания:

```
RAG, векторная база, PostgreSQL, Worker, статус New, GitHub, GitLab, Cursor, Node, Node.js, Bun, npm, API, CLI, UI, UX, JSON, SQL, CSS, HTML, TypeScript, JavaScript, Rust, Python, Docker, Nginx, Linux, macOS, iOS, Android, React, Next.js, Tailwind, Prisma, Supabase, Antigravity, DeepSeek, Gemini, Groq, Whisper, Deepgram, Tauri, VS Code, Xcode
```

Используется как `prompt` в multipart-запросе Groq. Для `mixed`-режима к нему добавляется `MIXED_RU_EN_STT_PROMPT`. Промпт обрезается до 896 символов по границе слова (лимит Groq Whisper API).

### 1.2. `GEMINI_STT_PROMPT` — Gemini (мультимодальная транскрибация)

```
Transcribe audio exactly as spoken. Rules:
- Detect language and transcribe in THAT language only
- Russian speech → Russian text
- English speech → English text
- Mixed Russian+English (code-switching) → preserve each word in original language
- DO NOT translate
- DO NOT add commentary
- Preserve technical terms: GitHub, Node, Bun, API, CLI, TypeScript, React, etc.
- Return ONLY transcript text
```

Передаётся в `systemInstruction`. В `mixed`-режиме как user-text добавляется `MIXED_RU_EN_STT_PROMPT`.

### 1.3. `MIXED_RU_EN_STT_PROMPT` — смешанная русско-английская диктовка

Базовый язык — русский, английские вставки остаются английскими. Ограничен 896 символами для совместимости с Groq Whisper API.

```
Transcribe mixed Russian-English speech exactly as spoken.
RULES: Russian stays Russian. English IT terms stay English.
NEVER transliterate English into Cyrillic (API NOT апи, React NOT реакт).
NEVER translate Russian into English.
Keep original spoken form if uncertain.
Examples: 'нужно задеплоить API' 'React компонент' 'PostgreSQL база' 'установить npm пакет'.
English IT terms: GitHub, pull request, branch, endpoint, deploy, token, API, cache, React, TypeScript, Node.js, Next.js, Docker, CLI, JSON, SQL, Rust, Python, Bun, npm, Tauri, Linux, macOS
```

### 1.4. Deepgram — русская речь с тех-терминами

Deepgram использует встроенную поддержку языков модели `nova-3`:
- `mixed` → `language=multi` (нативная мультиязычная код-переключалка; произвольный `prompt` с `ru` отклоняется API).
- `ru` → `language=ru`
- `en` → `language=en`

---

## 🧹 2. Промпты форматирования (AI-очистка)

Единая архитектура пост-обработки сырого текста через LLM (GigaChat, DeepSeek, Qwen, Groq, Gemini).

### 2.1. `REFINEMENT_SYSTEM_PROMPT` — системный промпт (для всех форматтеров)

```text
Ты — специализированный модуль нормализации и пунктуации устной речи в реальном времени.
Твоя цель: преобразовать сырую транскрипцию в чистый, синтаксически верный текст, сохранив 100% авторского смысла.

ПРАВИЛА ОЧИСТКИ ОТ МУСОРА:
1. Удаляй речевые заминки, паразитные звуки хезитации и зависания: "э-э", "а-а", "ну-у", "хм-м", "ммм", "типа", если они используются как пауза между мыслями.
2. Удаляй заикания, повторы слов из-за запинки и ложные старты фраз (например: "мы с, мы с ребятами" -> "мы с ребятами"; "я думал... в общем мы решили" -> "в общем мы решили"). Циклические повторы фраз и механические зацикливания (например: многократные "в принципе, в принципе...") сворачивай строго в одно вхождение.

ПРАВИЛО СОХРАНЕНИЯ ЭМОЦИОНАЛЬНЫХ МЕЖДОМЕТИЙ:
3. СТРОГО СОХРАНЯЙ смысловые и эмоциональные восклицания и междометия, если они выражают реакцию, оценку или отношение спикера.
   - Пример: "М-м, как вкусно!" -> ОСТАВЛЯТЬ "М-м, как вкусно!" (не удалять "М-м").
   - Пример: "Ого, ничего себе новость" -> ОСТАВЛЯТЬ.
   - Пример: "Эх, не получилось" -> ОСТАВЛЯТЬ.
   - Пример: "Увы, проект закрыт" -> ОСТАВЛЯТЬ.

ПРАВИЛА ОФОРМЛЕНИЯ:
4. Расставь грамматически верную пунктуацию (точки, запятые, тире, вопросительные и восклицательные знаки) и капитализацию (заглавные буквы в начале предложений и именах собственных).
5. Не меняй авторские термины, профессиональный сленг, числа, факты и падежные формы смысловых слов.
6. В ответе возвращай ТОЛЬКО финальный текст. Никаких пояснений, мета-сообщений, вводных слов и кавычек вокруг ответа.
```

### 2.2. Стили форматирования

| Константа | Стиль | Назначение |
|---|---|---|
| `FORMAT_STYLE_LIGHT` | Casual (Разговорный / Мягкий) | Максимально бережная расстановка знаков препинания, 0% рерайтинга, полное сохранение живого разговорного стиля и интонации |
| `FORMAT_STYLE_DEEP` | Professional (Структурированный / Деловой) | 100% дословное сохранение слов автора, форматирование списков (только если сам автор перечислял пункты: «первое... второе...»), абзацы. Без пересказа |
| `FORMAT_STYLE_UNIVERSAL_RULE` | — | Аппендится ко всем системным промптам: `Output: ONLY the formatted text. No labels, no comments, no preamble.` |

### 2.3. Сборка user-сообщения

```
<instruction>
---
<RAW_TEXT>
---
```

- `REFINEMENT_USER_INSTRUCTION_GENERIC`: `Отформатируй текст ниже (только знаки препинания, заглавные буквы, абзацы). НЕ ПЕРЕПИСЫВАЙ И НЕ МЕНЯЙ СЛОВА АВТОРА / Punctuate and capitalize ONLY. Do not rewrite words:`
- `REFINEMENT_USER_DELIMITER` / `REFINEMENT_USER_SUFFIX`: `\n---\n`
- Промпт собирается в `build_refinement_user_content()` в `ai_provider.rs` и аналогично в других модулях.

---

## 🛡️ 3. Логика использования

### Zero-Hallucination
`temperature: 0.0` + строгие системные промпты + разграничение ввода (delimiters) блокируют диалог с моделью.

### Language Preservation
Все промпты явно запрещают перевод. Русский остаётся русским, английский — английским, тех-термины сохраняются в оригинале.

### Silent Fallback
Пустой/шумный текст → возвращается пустая строка (нет запросов к API). Причины отбраковки (слишком тихо/коротко/нет звука) передаются пользователю через событие `recording-error`.

### Cost Efficiency
Требование «ONLY TEXT» минимизирует исходящие токены.

---

## 📝 Changelog

- **v1.2.0** — Документ синхронизирован с `prompts.rs`: добавлены `MIXED_RU_EN_STT_PROMPT`, `DEEPGRAM_RU_PROMPT`, `GEMINI_STT_PROMPT`; удалены упоминания несуществующего «Auto-режима» и устаревшего Groq-промпта.
- **v1.0.0** — Упрощение промптов, явный запрет перевода и добавления информации.

---

<br />
<p align="center">
  <a href="https://avpdev.com/en/"><b>Alexios Odos</b></a>
  &nbsp;|&nbsp;
  <a href="https://avpdev.com/ru/"><b>Aliaksei Patskevich</b></a>
</p>
