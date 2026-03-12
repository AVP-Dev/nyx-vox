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

Welcome to **NYX Vox**! This is our **very first project built with Rust** and our first steps into its ecosystem. It is a personal tool designed for daily use, and because it is a learning journey, we are actively looking for feedback, code reviews, and architectural recommendations to improve the implementation!

## 🌟 Vision
NYX Vox brings fast, offline-capable and cloud-accelerated voice transcription directly to your desktop. Built with modern, high-performance tools, it's designed to be functional, aesthetically pleasing, and remarkably stable. The interface leverages smooth Glassmorphism UI elements to keep things clean and engaging.

### 🎙 AI Transcription Engines
1. **CLOUD (Groq) — [Recommended]:** Our primary recommendation. Runs Whisper Large-v3-Turbo on blazing-fast LPU™ hardware. It offers the best balance of speed, accuracy, and smart punctuation.
2. **CLOUD (Deepgram):** Commercial-grade model. High stability and excellent noise filtering.
3. **OFFLINE (whisper-rs):** Runs locally on your Mac using `ggml-small.bin`. Ultimate privacy, no internet required.

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

### 🔐 Permissions & Access
NYX Vox requires **Accessibility** (for auto-pasting text) and **Microphone** permissions. We have implemented a native Rust bridge to provide **real-time status monitoring** directly in the Settings panel.

- **Automatic Mode**: The app detects permission changes instantly. If a status turns red, it means macOS has revoked access.
- **Why "Reset Permissions"?**: Sometimes macOS permissions "freeze" or stop responding correctly after an app update or hardware change. Use the **Reset** button in Settings to clear the system cache for NYX Vox and trigger a fresh request.

> [!IMPORTANT]
> Because the app is distributed without a paid developer signature, macOS may revoke "Accessibility" rights during every manual update. If auto-paste stops working, simply use the **Reset** button or manually remove `NYX Vox` from System Settings -> Privacy & Security -> Accessibility and restart the app.

## 🚀 Roadmap
- [x] Basic Speech-to-Text Pipeline (Whisper/Groq/Deepgram)
- [x] Glassmorphism UI & Dynamic Windows
- [x] Native HID Auto-Paste (MacOS)
- [ ] Custom Global Shortcuts
- [ ] Local Transcription History & Search
- [ ] **Intelligent AI Formatting**: Implementing LLM models to correct grammar, refine punctuation, and remove filler words from transcribed text.
- [ ] Multi-Modal AI Processing (Planned)

> [!TIP]
> **API Transparency & Accessibility**: NYX Vox utilizes modern, free, or freemium API models. We specifically choose engines like **Groq** and **Deepgram** because they provide high-tier performance while remaining accessible for individual developers and power users without high entry costs.

> [!NOTE]
> This is a passionate first foray into Rust for system-level audio and API integration. Please share any thoughts or constructive feedback on the repository!

---

## 🤝 Support & Contribution
NYX Vox is an open-heart project. If you'd like to **support the project**, suggest a feature, recommend a fix, or report a bug — please don't hesitate to reach out! Your feedback is what helps this first Rust experiment grow into a professional tool.

Simply [Open an Issue](https://github.com/AVP-Dev/nyx-vox/issues) or contact me directly via the links below.

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

