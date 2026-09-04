<div align="center">
  <img src="./branding/app-icon-safe.png" width="104" height="104" alt="NYX Vox Logo" />
  <h1>NYX Vox</h1>
  <p><strong>Premium, Zero-Latency AI Voice Interface for macOS and Windows</strong></p>

  <p>
    <a href="https://github.com/AVP-Dev/nyx-vox/releases/latest"><img src="https://img.shields.io/github/v/release/AVP-Dev/nyx-vox?label=Download%20(DMG%20%2F%20EXE)&style=for-the-badge&color=orange" alt="Download Latest Release" /></a>
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-black?style=for-the-badge&logo=apple" alt="macOS and Windows" />
    <img src="https://img.shields.io/badge/Rust-2021%20%7C%20Tauri%202.10-orange?style=for-the-badge&logo=rust" alt="Rust Tauri" />
  </p>

  <p>
    <a href="https://avp-dev.github.io/nyx-vox/" target="_blank" rel="noopener noreferrer">🌐 Interactive Landing Page</a> &nbsp;&bull;&nbsp;
    <a href="./README.ru.md">🇷🇺 Читать на русском</a> &nbsp;&bull;&nbsp;
    <a href="./docs/TECHNICAL.md" target="_blank" rel="noopener noreferrer">⚙️ Technical Specs</a> &nbsp;&bull;&nbsp;
    <a href="./docs/CHANGELOG.md" target="_blank" rel="noopener noreferrer">📝 Changelog</a>
  </p>
</div>

---

## ⚡ What is NYX Vox?

**NYX Vox** is a native cross-platform desktop tool (macOS & Windows) designed to make voice your primary, frictionless input method across any application. Speak into your microphone, see words stream on the fly with animated audio waveforms, and watch your thought get transcribed at sub-500ms latency, refined with **100% verbatim AI formatting** (zero rewrites or hallucinations), and **automatically pasted straight into your focused app** (VS Code, Telegram, Slack, Notion, Obsidian, or your browser) without touching your mouse or pressing Cmd+V / Ctrl+V.

Built with **Rust 2021 (Tauri 2)** and **Next.js 16 / React 19**, NYX Vox runs with a lightweight footprint, modern aesthetics, and strict local privacy controls.

---

## 🚀 How It Works (Pipeline)

```mermaid
graph LR
    subgraph Step1 ["1. Voice Capture & VAD"]
        MIC["🎙 Microphone (cpal)"] --> VAD["Smart VAD & Noise Gate"]
        VAD --> BUFF["300ms Pre-Speech FIFO"]
    end

    subgraph Step2 ["2. Ultra-Fast STT"]
        BUFF --> CLOUD["⚡ Cloud LPU: Groq Whisper Turbo (~500ms)<br/>Deepgram Nova-2 / Gemini / GigaChat"]
        BUFF -.-> LOCAL["🔒 Offline: Local Whisper<br/>(Metal & Core ML accelerated)"]
    end

    subgraph Step3 ["3. 100% Verbatim Refinement"]
        CLOUD --> LLM["✨ Verbatim AI Prompting<br/>(Gemini / DeepSeek / Qwen / GigaChat)"]
        LOCAL --> LLM
    end

    subgraph Step4 ["4. Instant macOS Auto-Paste"]
        LLM --> PASTE["🚀 Direct HID Injection via<br/>macOS Accessibility into Target App"]
        LLM --> CLIP["📋 Clipboard & Searchable History"]
    end

    style Step1 fill:#121218,stroke:#f97316,stroke-width:2px,color:#fff
    style Step2 fill:#121218,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Step3 fill:#121218,stroke:#10b981,stroke-width:2px,color:#fff
    style Step4 fill:#121218,stroke:#a855f7,stroke-width:2px,color:#fff
```

### 🛡️ Multi-Tier Resilient Fallback
NYX Vox features an **engine-agnostic, multi-tier fallback architecture** ensuring **zero lost dictations**:
1. **STT Tier**: If a live network stream drops or stalls during a long sentence, the engine immediately executes a full batch-STT pass on the recorded audio file.
2. **AI Tier**: If an LLM formatting provider hits rate limits (429/503), an automatic retry is scheduled; if it fails, NYX Vox **never discards your speech** — it instantly delivers the raw verbatim transcription.
3. **OS Injection Tier**: If macOS Accessibility permissions are revoked, the result window automatically expands with a one-click manual copy button.

---

## 🎙️ AI Transcription Engines (Comparison Matrix)

Bring your own API keys (stored locally with AES-256-GCM hardware encryption) or run 100% offline:

| Engine | Type | Latency | Privacy | Cost / Limits | Best For |
|---|---|---|---|---|---|
| **Groq LPU™** | Cloud LPU | **~500 ms** | Standard Cloud | Free Generous Tier | **[Recommended]** Daily driver, extreme speed |
| **Whisper Local** | On-Device | **~1.2 – 2.0 s** | **100% Private** | Free Forever | Confidential data, offline/travel use |
| **Sber GigaChat** | Cloud AI | **~700 ms** | Russian Cloud | Free Dev Tier | Native Russian dictation, works in РФ without VPN |
| **Google Gemini** | Multimodal | **~800 ms** | Google Cloud | Free AI Studio Quota | Complex code syntax & multi-language dictation |
| **Deepgram Nova** | Cloud STT | **~600 ms** | Enterprise | $200 Free Credits | Noisy backgrounds, acoustic isolation |

### ✨ 100% Verbatim AI Refinement Models (LLM)
NYX Vox formats raw transcriptions with zero rewriting, preserving your exact words while adding punctuation, capitalization, and paragraph structure:
- **DeepSeek V4 (`deepseek-v4-flash`)**: Flagship SOTA reasoning, code casing, and technical punctuation.
- **Qwen 3.7 (`qwen3.7-flash` / `plus`)**: Next-gen logical structure, rapid throughput, and clean paragraphs.
- **Google Gemini 3.8 (`gemini-3.8-flash` / `pro`)**: Multimodal precision across mixed languages.
- **Sber GigaChat 2 (`GigaChat-2-Pro` / `Max`)**: Native Russian grammar with Russian Trusted CA, works in РФ without VPN.
- **Groq LPU™ (`llama-3.3-70b-versatile`)**: Sub-second cloud inference on ultra-fast LPU hardware.
- **Custom Model Slot**: Configure any provider or model identifier on the fly with one-click reset.

<details>
<summary><b>🔑 How to get free API keys in 2 minutes</b></summary>

- **Groq**: Go to [console.groq.com/keys](https://console.groq.com/keys) → Create an API key named `NYX-Vox`.
- **Google Gemini**: Go to [aistudio.google.com](https://aistudio.google.com/) → Click "Get API Key" → Create Key.
- **Deepgram**: Go to [console.deepgram.com](https://console.deepgram.com/) → Sign up for $200 free credit → Create API Key.
- **GigaChat (SberAI)**: Go to [developers.sber.ru](https://developers.sber.ru/) → Create GigaChat API project → Copy Client ID & Secret.
</details>

---

## 🎬 Live Interactive Demo

<div align="center">
  <img src="./docs/demo.gif" alt="NYX Vox Live Interactive Demo" width="700" />
  <br/>
  <sub><i>Universal Live Streaming &bull; Real-time Waveform &bull; 100% Verbatim AI Formatting &bull; Direct Auto-Paste into Active App</i></sub>
</div>

---

## ✨ Key Features

- ⚡ **Universal Live Streaming**: Real-time interim phrase preview with typing indicator across all STT engines.
- 🎯 **100% Verbatim AI Refinement**: Intelligent system prompts ensure zero hallucinations, zero synonym replacement, and strict preservation of emotional intent while formatting punctuation, capital letters, and technical syntax.
- 🧠 **Multi-LLM Formatter Support**: Format transcripts using DeepSeek V4, Qwen 3.7, Gemini 3.8, Groq LPU, or GigaChat 2.
- 🎙️ **Smart Speech Activity Detection (VAD)**: Configurable silence auto-stop (3.0s – 15.0s) with calibrated Noise Gate and microphone gain multiplier.
- 🚀 **Native macOS HID Auto-Paste**: Direct text injection via macOS Accessibility API into the active window.
- 🔒 **Encrypted Key Vault**: API keys are locally encrypted with AES-256-GCM using unique hardware fingerprints.
- 🫧 **Compact Bubble Mode**: Sits as a minimalist circular mic bubble next to the macOS menu bar when idle.
- 📂 **Local Searchable History**: Retain and search previous voice notes with duration, timestamp, and model badges.
- 🔇 **Anti-Hallucination Guard**: Automatic acoustic silence trimming (`trim_silence`) and media auto-pause during dictation.

---

## 🖥️ Crafted for macOS: Interface Showcase

<table align="center" width="100%">
  <tr>
    <td width="50%" align="center">
      <b>🎙️ Live Speech Streaming</b><br/><br/>
      <img src="./docs/screenshots/recording.png" alt="NYX Vox Live Speech Streaming" width="100%" />
    </td>
    <td width="50%" align="center">
      <b>✨ 100% Verbatim Result & Auto-Paste</b><br/><br/>
      <img src="./docs/screenshots/result.png" alt="NYX Vox Formatted Result" width="100%" />
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <br/>
      <b>⚡ Speech-to-Text & AI Refinement Hub</b><br/><br/>
      <img src="./docs/screenshots/engines.png" alt="NYX Vox Engines and AI Models Hub" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <br/>
      <b>🔒 Hardware-Bound Encrypted Key Vault</b><br/><br/>
      <img src="./docs/screenshots/keys.png" alt="NYX Vox AES-256 Key Vault" width="100%" />
    </td>
    <td width="50%" align="center">
      <br/>
      <b>🎛️ Audio Calibration & macOS Permissions</b><br/><br/>
      <img src="./docs/screenshots/perms.png" alt="NYX Vox Permissions and Audio" width="100%" />
    </td>
  </tr>
</table>

---

## 📦 Installation & Setup

1. **Download**: Grab the latest `.dmg` from the [Releases](https://github.com/AVP-Dev/nyx-vox/releases/latest) page.
2. **Install**: Open the `.dmg` file and drag **NYX Vox** into your `Applications` folder.
3. **Launch**: Start NYX Vox from Applications.

### 🛠️ Troubleshooting: macOS "App is damaged" Warning
Because NYX Vox is an open-source tool without a paid Apple Developer subscription, macOS Gatekeeper may flag it on first run. Open **Terminal** and run:

```bash
xattr -cr /Applications/NYX\ Vox.app
```

Then launch the app again.

### 🔐 Permissions Monitoring Bridge
NYX Vox requires **Microphone** (for recording) and **Accessibility** (for automatic text paste) permissions:
- **Live Status**: Settings panel provides real-time green/red health indicators for system access.
- **Reset Permissions**: If macOS input events freeze after a macOS update, use the **Reset** button in Settings to clear the system cache and trigger a fresh prompt.

---

## 💻 Platforms: macOS & Windows

NYX Vox is tailored for maximum performance on both desktop operating systems:

| Feature | macOS | Windows |
|---|---|---|
| **Primary Global Shortcut** | `⌥ Option + Space` (or `Ctrl + Space`) | `Ctrl + Space` (system-safe) |
| **Direct Auto-Paste** | Native HID injection via Accessibility API | Native Win32 API injection (`enigo`) |
| **Offline Whisper Engine** | Metal GPU & Core ML accelerated | High-throughput CPU vectorized inference (AVX2/AVX512) |
| **Cloud STT & LLMs (Groq, Deepgram, Gemini, GigaChat)** | Sub-second ultra-fast streaming | Sub-second ultra-fast streaming |
| **Permissions Required** | Accessibility + Microphone | Microphone only (no Accessibility required) |

> [!IMPORTANT]
> **❤️ Community Note for Windows & Mac Users (Feedback & Quality):**
> The Windows version is built natively with Tauri 2, Rust, and Win32 APIs. Because our primary everyday development environment is macOS, we cannot personally test on every conceivable Windows hardware, microphone, and software configuration.
> 
> We sincerely invite everyone using NYX Vox on Windows or Mac:
> - **Please share your feedback!** Let us know how transcription feels and whether auto-paste works reliably across your favorite tools (VS Code, Telegram, Word, Notion, Obsidian, browsers).
> - Encounter a bug, latency spike, or UI quirk? Feel free to open a [GitHub Issue](https://github.com/AVP-Dev/nyx-vox/issues) or reach out directly!
> 
> The more real-world feedback we receive, the better, faster, and more rock-solid NYX Vox becomes for everyone.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `⌥ + Space` (Mac) / `Ctrl + Space` (Windows) | Toggle Dictation (Start / Stop) | Global (any app) |
| `Enter` | Send / Paste text to active application | In NYX Vox window |
| `Esc` | Cancel recording / clear text | In NYX Vox window |
| `Cmd + C` (Mac) / `Ctrl + C` (Windows) | Copy formatted text to clipboard | In NYX Vox window |

---

## 🚀 Roadmap

**Shipped in v1.5.0:**
- [x] Cross-platform native Windows 10/11 support (Tauri 2, Win32 API, NSIS `.exe` installer)
- [x] Full UI selector for Groq LPU™ (`llama-3.3-70b-versatile`) formatting engine in Settings
- [x] Multi-engine STT pipeline (Whisper Offline / Groq / Deepgram / Gemini / GigaChat)
- [x] Universal live interim speech streaming preview
- [x] 100% Verbatim AI formatting (Gemini, DeepSeek, Qwen, Groq, GigaChat)
- [x] Custom AI model ID slot and presets
- [x] Smart VAD silence auto-stop (3.0s – 15.0s) & Noise Gate calibration
- [x] Glassmorphism UI & Compact Bubble idle mode
- [x] Native HID Auto-Paste into active window
- [x] AES-256-GCM hardware-bound API key vault
- [x] Searchable local dictation history

**Upcoming:**
- [ ] **Audio file transcription** — drag-and-drop audio files for batch transcription
- [ ] **System audio capture (calls/meetings)** — internal audio recording with speaker diarization
- [ ] **Custom global shortcut builder** — rebindable hotkeys
- [ ] **History export** — export transcriptions to Markdown, TXT, and JSON
- [ ] **Input device selector** — pick a specific microphone in Settings
- [ ] **Custom technical dictionary** — user-defined terms, acronyms, and names

---

## 🤝 Support & Contribution

NYX Vox is an open-heart project created by **Aliaksei Patskevich (AVPDev)** as a personal daily driver and a learning expedition into Rust and system-level audio engineering.

If you have architectural suggestions, code reviews, or bug reports, feel free to [Open an Issue](https://github.com/AVP-Dev/nyx-vox/issues) or reach out directly:

<p align="center">
  <a href="https://avpdev.com/"><b>Aliaksei Patskevich (AVPDev)</b></a>
  <br />
  <sub>
    <b>AI Solutions Architect</b> • Code, Design & AI
    <br />
    <a href="https://github.com/AVP-Dev">GitHub</a> &bull; <a href="https://t.me/AVP_Dev">Telegram</a>
  </sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-DEA584?style=flat-square&logo=rust&logoColor=black" alt="Rust" />
  <img src="https://img.shields.io/badge/Tauri_2-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>
