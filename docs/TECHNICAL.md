# NYX-Vox: Technical Specifications

[🏠 Home](../README.md) | [🇷🇺 Russian Version](./TECHNICAL.ru.md)

This document covers the architectural and technical aspects of NYX-Vox, a fast, locally executing Tauri-based desktop application.

---

## 🛠 Tech Stack Overview

![Bun](https://img.shields.io/badge/Bun-Latest-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-cyan.svg)
![Rust](https://img.shields.io/badge/Rust-1.77+-orange.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.x-yellow.svg)

> [!IMPORTANT]
> **Core Architecture:** NYX-Vox follows a hybrid approach where high-performance audio processing (cpal) and AI inference (whisper.cpp) are handled by the Rust backend, while the glassmorphism UI is rendered by a decoupled Next.js 16 environment. Communication is strictly typed via Tauri's IPC bridge.

---

## 🧩 Architectural Topology

```mermaid
graph TD
    A["Tauri Core (Rust)"] -->|Hardware Thread| C["Audio Capture (cpal)"]
    A -->|1. Offline Engine| B["whisper-rs Engine (Local)"]
    A -->|2. Cloud Engine| G["Deepgram API (Remote)"]
    A -->|3. Cloud Engine| H["Groq Whisper API (Remote)"]
    note left of G: <a href="https://console.deepgram.com/">API Key Guide</a>
    note left of H: <a href="https://console.groq.com/keys">API Key Guide</a>
    A -->|Future: Post-Process| I["LLM Integration (Grammar/Format)"]
    A -->|IPC Bridge| D["React Frontend (Next.js)"]
    D --> E["Tailwind v4 Styling"]
    D --> F["Zustand Frontend State"]
```

---

## 🚀 Getting Started

To spin up the local development environment ensuring you bypass remote API limits:

```bash
# Install lightning-fast dependencies using Bun
bun install

# Start the Next.js frontend alongside the Tauri Rust backend
bun run tauri dev
```

> [!TIP]
> **API Economy & Optimization**: NYX-Vox focuses on utilizing high-performance, accessible, and free-tier (Freemium) API endpoints. Models like **Groq (Whisper Large-v3-Turbo)** are prioritized for their extreme processing speed on LPU™ hardware, enabling near-instant feedback without financial barriers for individual developers.

> [!TIP]
> All sensitive environmental setups and logs limit specific directory reporting for maximum privacy. No absolute paths or local system hashes are mapped during build cycles.

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

