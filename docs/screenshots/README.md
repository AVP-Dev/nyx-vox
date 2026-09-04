# NYX Vox — Screenshot Directory & Asset Specs

This directory is designated for high-resolution retina application screenshots (2x DPI, PNG format) showcased in `README.md`, `README.ru.md`, and the landing page (`docs/index.html`).

## Recommended Image Names & States

| Filename | App State / Screen | Description & Focus |
|---|---|---|
| `01-hero-recording.png` | Active Recording (`phase: 'recording'`) | Floating glassmorphism widget with pulsing red record button, dynamic 9-bar waveform, and real-time interim transcription stream. |
| `02-result-autopaste.png` | Result Card (`phase: 'result'`) | Expanded glassmorphism card displaying formatted text, action icons (Edit, Copy, Reset), and the orange `[▶ В VS Code]` or `[▶ To VS Code]` auto-paste button. |
| `03-compact-bubble.png` | Compact Idle Bubble (`isCompactIdle`) | The minimalist circular mic bubble anchored near the edge of the screen / macOS menu bar. |
| `04-quick-menu.png` | Quick Menu Popover (`QuickMenu`) | Compact switcher showing STT engine (Groq/Whisper), AI formatting modes, and Settings button. |
| `05-engines-hub.png` | Settings → Engines Tab (`EnginesTab`) | Multi-engine hub: Cloud Turbo (Groq LPU), Deepgram, Gemini, GigaChat, and Local Whisper with custom models. |
| `06-encrypted-keys.png` | Settings → Keys Tab (`KeysTab`) | Hardware-bound encrypted key vault (AES-256-GCM) with validated status badges. |
| `07-general-audio-perms.png` | Settings → General Tab (`GeneralTab`) | Noise Gate slider, Mic Gain slider, VAD auto-stop timeout, and macOS Accessibility & Microphone status checks. |
| `08-history-search.png` | Settings → History Tab (`HistoryTab`) | Searchable transcription history list with timestamps, durations, word counts, and engine tags. |

## Recommended Specifications
- **Format**: PNG (with transparent background around window shadows if taken with `Cmd + Shift + 4` then `Space` on macOS, or clean desktop background).
- **Scale**: 2x (Retina)
- **Language**: English (`en`) for `README.md`, Russian (`ru`) for `README.ru.md`.
