import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EnginesTab, type EngineHelp } from './EnginesTab';
import { DICTIONARY } from './translations';

const helpItem = {
    title: 'Engine',
    badge: 'Cloud',
    type: 'Speech recognition',
    desc: 'Engine description',
};

const engineHelp: EngineHelp = {
    ru: { deepgram: helpItem, gigachat: helpItem, formatting: helpItem },
    en: { deepgram: helpItem, gigachat: helpItem, formatting: helpItem },
};

const makeProps = (
    overrides: Partial<ComponentProps<typeof EnginesTab>> = {}
): ComponentProps<typeof EnginesTab> => ({
    c: DICTIONARY.en,
    lang: 'en',
    sttMode: 'deepgram',
    handleModeChange: vi.fn(),
    showHelp: null,
    setShowHelp: vi.fn(),
    ENGINE_HELP: engineHelp,
    formattingMode: 'gemini',
    handleFormattingModeChange: vi.fn(),
    whisperModel: 'small',
    handleWhisperModelChange: vi.fn(),
    modelAvailable: false,
    downloading: false,
    downloadProgress: '',
    handleDownload: vi.fn(),
    handleDeleteModel: vi.fn(),
    nemotronAssetAvailable: false,
    nemotronAssetDownloading: false,
    nemotronAssetProgress: 0,
    handleDownloadNemotronAsset: vi.fn(),
    handleDeleteNemotronAsset: vi.fn(),
    isPaused: false,
    handlePause: vi.fn(),
    handleResume: vi.fn(),
    handleCancel: vi.fn(),
    ...overrides,
});

describe('EnginesTab model controls', () => {
    it('shows only the selected engine model controls', () => {
        const { rerender } = render(<EnginesTab {...makeProps({ sttMode: 'deepgram' })} />);

        expect(screen.queryByText(/Nemotron/i)).toBeNull();

        rerender(<EnginesTab {...makeProps({ sttMode: 'whisper' })} />);

        expect(screen.queryByText(/Nemotron/i)).toBeNull();
        expect(screen.getByText('Whisper Model Selection')).toBeTruthy();

        rerender(<EnginesTab {...makeProps({ sttMode: 'nvidia' })} />);

        expect(screen.getByText(DICTIONARY.en.settings.nemotronAssetTitle)).toBeTruthy();
        expect(screen.queryByText('Whisper Model Selection')).toBeNull();
    });

    it('keeps the selected Whisper model download controls available', () => {
        const props = makeProps({ sttMode: 'whisper' });
        render(<EnginesTab {...props} />);

        expect(screen.getByText('Whisper Model Selection')).toBeTruthy();
        expect(screen.getByText(DICTIONARY.en.settings.modelStatus)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: DICTIONARY.en.settings.modelDownload }));

        expect(props.handleDownload).toHaveBeenCalledTimes(1);
    });

    it('starts downloading and offers deletion for the selected Nemotron model', () => {
        const props = makeProps({ sttMode: 'nvidia' });
        const { rerender } = render(<EnginesTab {...props} />);

        fireEvent.click(screen.getByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDownload }));
        expect(props.handleDownloadNemotronAsset).toHaveBeenCalledTimes(1);

        rerender(<EnginesTab {...makeProps({ sttMode: 'nvidia', nemotronAssetAvailable: true })} />);
        expect(screen.getByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDelete })).toBeTruthy();
    });
});
