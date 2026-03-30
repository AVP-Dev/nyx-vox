# NYX Vox: Changelog

[🏠 Home](../README.md) | [🇷🇺 Russian Version](./CHANGELOG.ru.md)

---

## 📅 Version 1.0.0 (Current)

### 🎯 Critical Changes

#### 1. **Code Cleanup** ✅

**Problem:** 94 linter errors (42 critical, 52 warnings)

**Solution:**
- ✅ Replaced all `any` types with proper TypeScript interfaces
- ✅ Added missing React `key` props
- ✅ Fixed `useCallback`/`useEffect` dependencies
- ✅ Removed unused imports and variables
- ✅ Removed dead code files (`UpdatePopup.tsx`, `SettingsPanel_original.tsx`)

**Result:**
- **Errors:** 94 → 0 (**-100%**)
- **Warnings:** 52 → 0 (**-100%**)
- **Build:** ✅ Successful

---

#### 2. **Text Selection & Auto-Copy** ✅

**Feature:** Automatic copying of selected text fragments from the result window.

**Implementation:**
```typescript
const handleTextSelection = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    
    if (selectedText.length > 0) {
        handleCopy(selectedText);
        
        // Show "✓ Copied!" for 600ms
        setAiStatus('✓ Copied!');
        setTimeout(() => setAiStatus(''), 600);
    }
}, [handleCopy]);
```

**Features:**
- ✅ Mouse or keyboard selection (Shift + arrows)
- ✅ Instant copy to clipboard
- ✅ Status **"✓ Copied!"** appears **instead of** "Text not recognized"
- ✅ Display time: **600ms** (quick but noticeable)
- ✅ Semi-transparent orange badge with glassmorphism effect

---

#### 3. **Always-on-Top Logic** ✅

**Problem:** Window didn't stay on top during recording/processing.

**Solution:**
```typescript
const resizeWindow = useCallback(async (w: number, h: number) => {
    // ...
    const shouldBeOnTop = (
        phase === 'recording' || 
        phase === 'processing' || 
        phase === 'result'
    ) ? true : alwaysOnTop;
    
    await win.setAlwaysOnTop(shouldBeOnTop);
}, [alwaysOnTop, phase]);
```

**Logic:**

| Phase | Always on Top | Description |
|-------|---------------|----------|
| `recording` | ✅ **TRUE** | Window on top during recording |
| `processing` | ✅ **TRUE** | Window on top during processing |
| `result` | ✅ **TRUE** | Window on top with result |
| `idle` | ⚙️ **User Setting** | User preference |
| `settings` | ⚙️ **User Setting** | User preference |

**After paste:**
1. Returns `alwaysOnTop` to user setting
2. Window hides (`win.hide()`)
3. Phase → `idle`

---

#### 4. **Critical AI Bugs Fixed** ✅

**Problem 1:** AI translated text to English when speaking Russian.

**Solution:** Simplified prompts to maximum:
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

**Problem 2:** AI added words on its own (e.g., "CRITICAL" in text).

**Solution:**
- ✅ Added prohibition on adding new information
- ✅ Preserve original text length (±10%)
- ✅ Removed complex formulations from prompts

**Problem 3:** Critical crash during Whisper initialization.

**Solution:**
```rust
// Was (can panic):
let ctx = lock.as_ref().unwrap();

// Became (safe):
let ctx = lock.as_ref().ok_or("Failed to initialize Whisper context")?;
```

---

#### 5. **First Letter Capitalization** ✅

**Problem:** Text started with lowercase letter.

**Solution:**
```typescript
const cleanHallucinations = useCallback((t: string | undefined | null): string => {
    if (!t) return '';
    const text = t.trim();
    
    // Capitalize first letter
    if (text.length > 0) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    
    return text;
}, []);
```

**Result:**
- "проверка текста" → **"Проверка текста"**
- "test message" → **"Test message"**

---

#### 6. **AI Formatting Disabled by Default** ✅

**Problem:** Formatting was enabled by default, degraded recognition.

**Solution:**
```typescript
const [formattingMode, setFormattingMode] = useState<FormattingMode>('none'); // Disabled by DEFAULT!
```

**Now:**
- ✅ Formatting enabled **ONLY from settings**
- ✅ For clean recognition — use without formatting
- ✅ Zap button in menu for quick toggle

---

### 📊 Final Statistics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **TypeScript Errors** | 42 | 0 | **-100%** ✅ |
| **Warnings** | 52 | 0 | **-100%** ✅ |
| **Critical Crashes** | 1+ | 0 | **-100%** ✅ |
| **Text Translation** | Frequent | None | **Fixed** ✅ |
| **Text Selection** | ❌ Broken | ✅ Working | **Added** |
| **Always-on-Top** | ❌ Broken | ✅ Working | **Fixed** |

---

### 🔧 Technical Details

#### Modified Files:

**Frontend:**
- `src/app/page.tsx` — text selection, statuses, alwaysOnTop
- `src/app/globals.css` — text selection enabled (`.select-text`)
- `src/components/SettingsPanel.tsx` — types, dependencies
- `src/components/settings/*.tsx` — prop types

**Backend:**
- `src-tauri/src/prompts.rs` — simplified prompts
- `src-tauri/src/whisper.rs` — safe initialization
- `src-tauri/src/utils.rs` — improved filters
- `src-tauri/src/commands/audio.rs` — formatting by flag

**Configuration:**
- `next.config.ts` — image support (`images: { unoptimized: true }`)

---

### 🎯 Usage Scenarios

#### Scenario 1: Quick Fragment Copy
1. Press hotkey → say text
2. Select fragment with mouse or keyboard
3. Text **automatically copies**
4. **"✓ Copied!"** appears for 0.6 seconds
5. Continue working

#### Scenario 2: Recording with Auto-Paste
1. Enable "Auto-paste" in settings
2. Press hotkey → say text
3. Window **automatically on top of all windows**
4. After processing → **automatic paste**
5. Window **hides**

#### Scenario 3: Clean Recognition (without AI)
1. **Disable formatting** (Zap button)
2. Say text
3. Get **clean text without changes**
4. No translations or additions

---

### 📝 Known Limitations

1. **Text selection** works only in `result` mode
2. **Auto-copy** triggers on selection > 0 characters
3. **AlwaysOnTop** resets after paste
4. **Formatting** requires API key (Gemini/Qwen/DeepSeek)

---

### 🚀 Planned Improvements

- [ ] Transcription history with search
- [ ] Voice commands for control
- [ ] Export to various formats (TXT, MD, DOCX)
- [ ] Support for multiple languages simultaneously
- [ ] Sync between devices

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
