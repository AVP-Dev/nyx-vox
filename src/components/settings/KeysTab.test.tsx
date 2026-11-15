import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { KeysTab } from './KeysTab';
import { DICTIONARY } from './translations';

const makeProps = (
    overrides: Partial<ComponentProps<typeof KeysTab>> = {}
): ComponentProps<typeof KeysTab> => ({
    c: DICTIONARY.en,
    dgApiKey: '',
    setDgApiKey: vi.fn(),
    groqApiKey: '',
    setGroqApiKey: vi.fn(),
    geminiApiKey: '',
    setGeminiApiKey: vi.fn(),
    qwenApiKey: '',
    setQwenApiKey: vi.fn(),
    deepseekApiKey: '',
    setDeepseekApiKey: vi.fn(),
    gigachatApiKey: '',
    setGigachatApiKey: vi.fn(),
    elevenlabsApiKey: '',
    setElevenlabsApiKey: vi.fn(),
    azureSpeechApiKey: '',
    setAzureSpeechApiKey: vi.fn(),
    speechmaticsApiKey: '',
    setSpeechmaticsApiKey: vi.fn(),
    nvidiaSttApiKey: '',
    setNvidiaSttApiKey: vi.fn(),
    azureEndpoint: '',
    setAzureEndpoint: vi.fn(),
    azureDeployment: '',
    setAzureDeployment: vi.fn(),
    handleSaveAzureConfig: vi.fn(),
    showKeys: {},
    setShowKeys: vi.fn(),
    handleSaveKey: vi.fn(),
    handleDeleteKey: vi.fn(),
    savedStatus: {},
    setTab: vi.fn(),
    customModels: { nvidia_stt: '1598d209-5e27-4d3c-8079-4751568b1081' },
    handleSetCustomModel: vi.fn(),
    ...overrides,
});

describe('KeysTab', () => {
    it('does not show the manual NVIDIA function UUID input', () => {
        render(<KeysTab {...makeProps()} />);

        expect(screen.queryByText(/function UUID/i)).toBeNull();
        expect(screen.queryByDisplayValue('1598d209-5e27-4d3c-8079-4751568b1081')).toBeNull();
        expect(screen.getByText(DICTIONARY.en.settings.nvidiaSttApiKeyLabel)).toBeTruthy();
    });
});
