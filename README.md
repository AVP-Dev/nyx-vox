<div align="center">
  <img src="./branding/app-icon-safe.png" width="96" height="96" alt="NYX Vox Logo" />
  <h1>NYX Vox</h1>

  [![Скачать](https://img.shields.io/github/v/release/AVP-Dev/nyx-vox?label=Download%20Latest&style=for-the-badge&color=orange)](https://github.com/AVP-Dev/nyx-vox/releases/latest)

  <p>
    <a href="https://avp-dev.github.io/nyx-vox/" target="_blank" rel="noopener noreferrer">🌐 Landing Page</a> &nbsp;|&nbsp; 
    <a href="./README.ru.md">🇷🇺 Russian Version</a> &nbsp;|&nbsp; 
    <a href="./docs/TECHNICAL.md" target="_blank" rel="noopener noreferrer">⚙️ Technical Specs</a>
  </p>
</div>

Welcome to **NYX Vox**! This is a test version of a personal project built for daily use. It's our first major implementation using **Rust** and Tauri, so we are actively looking for feedback, code reviews, and architectural recommendations to improve the desktop experience!

## 🌟 Vision
NYX Vox brings fast, offline-capable and cloud-accelerated voice transcription directly to your desktop. Built with modern, high-performance tools, it's designed to be functional, aesthetically pleasing, and remarkably stable. The interface leverages smooth Glassmorphism UI elements to keep things clean and engaging.

### 🎙 AI Transcription Engines
1. **CLOUD (Deepgram):** Instant commercial model. Perfect punctuation and ultimate noise filtering.
2. **CLOUD (Groq):** Runs Whisper Large-v3-Turbo on blazing-fast servers. Free, ultra-fast API.
3. **OFFLINE (whisper-rs):** Runs locally on your Mac without internet for ultimate privacy using `ggml-small.bin`.

## 📦 Installation & Setup

1. **Download**: Get the latest `.dmg` file from the [Releases](https://github.com/AVP-Dev/nyx-vox/releases) page.
2. **Install**: Open the `.dmg` and drag **NYX Vox** to your `Applications` folder.
3. **Launch**: Open the app from your Applications folder.

### 🛠 Troubleshooting: "App is damaged" error
If you see a message saying the app is damaged or cannot be opened, it’s because it lacks an Apple Developer signature. Follow these steps:
1. Open **Terminal**.
2. Run the following command:
   ```bash
   xattr -cr /Applications/NYX\ Vox.app
   ```
3. Open the app again.

> [!WARNING]
> ### ⚠️ Important: App Updates (Permissions Reset)
> Because the app is distributed outside of the Mac App Store (without a paid developer signature), macOS treats each manual update as a brand-new program. **When installing a new version, auto-paste will stop working** because macOS will revoke your "Accessibility" permissions.
> 
> **How to fix this after every update:**
> 1. Open **System Settings** -> **Privacy & Security** -> **Accessibility**.
> 2. Find `NYX Vox` in the list, select it, and click the minus **`-`** button (Remove).
> 3. Launch the new version of the app to trigger a fresh permission request, or manually add it back using the plus **`+`** button.

## 🚀 Roadmap
- [x] Basic Speech-to-Text Pipeline (Whisper/Groq/Deepgram)
- [x] Glassmorphism UI & Dynamic Windows
- [x] Native HID Auto-Paste (MacOS)
- [ ] Custom Global Shortcuts
- [ ] Local Transcription History & Search
- [ ] Advanced Formatting & Punctuation Cleanup
- [ ] Multi-Modal AI Processing (Planned)

> [!TIP]
> This is a passionate first foray into Rust for system-level audio and API integration. Please share any thoughts or constructive feedback on the repository!

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

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
  <br />
  <img src="https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white" />
  <img src="https://img.shields.io/badge/Autodesk_Fusion_360-0696D7?style=flat-square&logo=autodesk&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" />
</p>

