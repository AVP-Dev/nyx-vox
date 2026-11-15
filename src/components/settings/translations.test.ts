import { describe, expect, it } from 'vitest';
import { DICTIONARY } from './translations';

describe('STT settings translations', () => {
    it('provides labels, descriptions, and Azure config copy in Russian and English', () => {
        for (const language of ['ru', 'en'] as const) {
            const settings = DICTIONARY[language].settings;

            expect(settings.elevenlabsApiKeyLabel).toBeTruthy();
            expect(settings.azureSpeechApiKeyLabel).toBeTruthy();
            expect(settings.speechmaticsApiKeyLabel).toBeTruthy();
            expect(settings.nvidiaSttApiKeyLabel).toBeTruthy();
            expect(settings.keyDescriptions.elevenlabs).toBeTruthy();
            expect(settings.keyDescriptions.azure_speech).toBeTruthy();
            expect(settings.keyDescriptions.speechmatics).toBeTruthy();
            expect(settings.keyDescriptions.nvidia).toBeTruthy();
            expect(settings.azureResourceEndpointLabel).toBeTruthy();
            expect(settings.azureDeploymentLabel).toBeTruthy();
            expect(settings.azureConfigSave).toBeTruthy();
        }
    });

    it('names the local engine Whisper and provides Nemotron model controls in both languages', () => {
        for (const language of ['ru', 'en'] as const) {
            const settings = DICTIONARY[language].settings;

            expect(settings.whisperLabel).toBe('Whisper');
            expect(settings.modelStatus).toContain('Whisper');
            expect(settings.nemotronAssetTitle).toContain('Nemotron');
            expect(settings.nemotronAssetDesc).toContain('nvidia/nemotron-3.5-asr-streaming-0.6b');
            expect(settings.nemotronAssetDownload).toBeTruthy();
            expect(settings.nemotronAssetDelete).toBeTruthy();
            expect(settings).not.toHaveProperty('nvidiaFunctionIdLabel');
            expect(settings).not.toHaveProperty('nvidiaFunctionIdDesc');
            expect(settings).not.toHaveProperty('nvidiaFunctionIdPlaceholder');
        }
    });
});
