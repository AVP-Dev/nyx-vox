import { fireEvent, render, screen } from '@testing-library/react';
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
    customModels: {},
    handleSetCustomModel: vi.fn(),
    ...overrides,
});

describe('KeysTab', () => {
    it('allows overriding the NVIDIA function UUID and shows the suggested default', () => {
        const props = makeProps();
        render(<KeysTab {...props} />);

        const field = screen.getByLabelText(DICTIONARY.en.settings.nvidiaFunctionIdLabel) as HTMLInputElement;
        expect(field.value).toBe('');
        expect(field.placeholder).toBe('1598d209-5e27-4d3c-8079-4751568b1081');
        expect(screen.getByText(DICTIONARY.en.settings.nvidiaSttApiKeyLabel)).toBeTruthy();

        fireEvent.change(field, { target: { value: 'custom-function-id' } });
        expect(props.handleSetCustomModel).toHaveBeenCalledWith('nvidia_stt', 'custom-function-id');
    });

    it('shows a saved NVIDIA function UUID', () => {
        render(<KeysTab {...makeProps({ customModels: { nvidia_stt: 'saved-uuid' } })} />);

        expect(screen.getByDisplayValue('saved-uuid')).toBeTruthy();
    });
});
