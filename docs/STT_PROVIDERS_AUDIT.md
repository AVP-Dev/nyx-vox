# Cloud STT Provider Audit

**Updated:** 2026-11-14
**Status:** Research, provider adapters, configuration, and mode routing are implemented for the v1.6.0 test build.

## Findings

### ElevenLabs

- Realtime uses the WebSocket endpoint `wss://api.elevenlabs.io/v1/speech-to-text/realtime`. The documented client sends JSON `input_audio_chunk` events with `audio_base_64`; the service returns `partial_transcript` and stable `committed_transcript` events. The API key is sent in `xi-api-key`.
- Batch transcription uses `POST /v1/speech-to-text` with multipart `file` and required `model_id`. The response includes `text` for a single transcript. See [realtime API](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) and [create transcript](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).

### Azure Speech

- The older direct WebSocket framing (`speech.config`, `speech.hypothesis`, `speech.phrase`) is not documented as a public client protocol. Traditional Azure Speech realtime recognition is exposed through the Speech SDK; the short-audio REST endpoint is a single-request recognition path, not a continuous audio stream.
- Microsoft now documents MAI-Transcribe-2-Streaming over `wss://{resource}.services.ai.azure.com/mai/v1/realtime`. It requires a Foundry resource and deployed model name, supports API-key or Entra authentication, and accepts mono PCM16 at 16 or 24 kHz. The feature is in public preview without an SLA. This is a distinct Azure product path from the classic Speech resource; confirm that it is the intended provider before implementing. See [Microsoft's realtime guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe-2-streaming-realtime) and [Speech to text overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text).

### Speechmatics

- Realtime v2 uses a regional WebSocket endpoint such as `wss://eu2.rt.speechmatics.com/v2`, with `Authorization: Bearer …`.
- The client sends `StartRecognition`, binary PCM chunks, then `EndOfStream` with `last_seq_no`. The server emits `AddPartialTranscript` and `AddTranscript`. For mixed Russian/English, use `melia-1`, set `language` to `multi`, and pass `language_hints: ["ru", "en"]`; hints bias recognition without restricting other detected languages. Single-language models require a matching language code. See [Realtime transcription WebSocket API](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket) and [language hints](https://docs.speechmatics.com/speech-to-text/realtime/input#language-hints).

### NVIDIA Build

- Build exposes model-specific NVCF invocation URLs. The official [Parakeet CTC 1.1B API example](https://build.nvidia.com/nvidia/parakeet-ctc-1_1b-asr/api) sends `file` and `language` multipart fields to `https://<function-id>.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions`, with `Authorization: Bearer …`. The app omits `language` so a compatible multilingual model can detect it automatically.
- The function ID selects the deployed model; the generic `integrate.api.nvidia.com` URL and arbitrary model-ID/base-URL combinations are not established by that catalog contract. Do not present a private NIM base URL as a Build endpoint. The cited Parakeet catalog entry is English-only.

### Xiaomi MiMo (research only)

- The official API exposes `POST https://api.xiaomimimo.com/v1/chat/completions` with model `mimo-v2.5-asr`, `api-key` authentication, and one MP3 or WAV audio input as a base64 data URL. The documented language values are `auto`, `zh`, and `en`; the product description is bilingual Chinese-English, so Russian support is not established.
- `stream=true` streams the response text as SSE after an audio-input request. It does not provide a live audio-input stream. See [Speech Recognition API](https://mimo.mi.com/docs/en-US/api/audio/Speech-Recognition) and [usage guide](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/Speech-Recognition).
- The assigned task calls for researching MiMo. This audit does not add MiMo as a selectable engine.

## Local integration points

- Provider selection is currently a string `SttMode`; `commands/audio.rs` routes the selected mode in `start_recording` and finalizes it in `stop_recording`.
- API keys use the encrypted `keys::Service` map. The frontend maintains parallel provider unions and controls in `src/lib/types.ts`, `src/components/settings/EnginesTab.tsx`, `src/components/settings/KeysTab.tsx`, and `src/components/settings/translations.ts`.
- Existing cloud providers use different capture/streaming paths. A generic chunk pipe and provider adapters now exist, using the existing audio buffer and PCM conversion helpers. The current AI capture path also starts a Groq interim worker, so it is not safe to route other providers through it while a Groq key is configured.
- Routing and finalization changes in `commands/audio.rs` are within the frozen STT dispatcher boundary. No audio code, existing streaming implementation, VAD, rolling commit, Whisper, deduplication, or formatter prompt changes are included in this audit.

## Implementation status

1. Added encrypted key entries and Azure Foundry endpoint/deployment settings.
2. Added batch and realtime clients for ElevenLabs, realtime clients for Azure MAI and Speechmatics, and an NVIDIA Build batch client requiring the model's NVCF function UUID. MiMo remains research only.
3. Added key fields and Azure settings controls with Russian/English copy. Provider selection is not exposed yet.
4. The user authorized dispatcher changes with `редактируем диспетчер STT`. The remaining integration needs a provider-neutral capture that does not start or leak into the existing Groq interim worker. The frozen capture/worker code remains unchanged until separately authorized.

## Scope limitation

The user has authorized `src-tauri/src/commands/audio.rs` dispatcher edits. This does not authorize changing the frozen cpal/VAD/worker implementation, and current routing is intentionally left disconnected until the audio source can be separated safely.
