import { describe, expect, it } from 'vitest';
import { DICTIONARY } from './translations';

describe('cloud STT settings translations', () => {
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
});
