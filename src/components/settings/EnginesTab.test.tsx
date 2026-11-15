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

describe('EnginesTab Nemotron asset card', () => {
    it('renders outside Whisper mode without showing the Whisper model selector', () => {
        render(<EnginesTab {...makeProps({ sttMode: 'deepgram' })} />);

        expect(screen.getByText(DICTIONARY.en.settings.nemotronAssetTitle)).toBeTruthy();
        expect(screen.queryByText('Local Model Selection')).toBeNull();
    });

    it('shows Download for a missing asset and calls its handler', () => {
        const props = makeProps();
        render(<EnginesTab {...props} />);

        fireEvent.click(screen.getByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDownload }));

        expect(props.handleDownloadNemotronAsset).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDelete })).toBeNull();
    });

    it('shows Delete for an installed asset and calls its handler', () => {
        const props = makeProps({ nemotronAssetAvailable: true });
        render(<EnginesTab {...props} />);

        fireEvent.click(screen.getByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDelete }));

        expect(props.handleDeleteNemotronAsset).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDownload })).toBeNull();
    });

    it('shows a determinate progress bar while downloading', () => {
        render(<EnginesTab {...makeProps({ nemotronAssetDownloading: true, nemotronAssetProgress: 63 })} />);

        expect(screen.getByRole('progressbar', { name: DICTIONARY.en.settings.nemotronAssetProgressLabel }).getAttribute('aria-valuenow')).toBe('63');
        expect(screen.getByText('63%')).toBeTruthy();
        expect(screen.queryByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDownload })).toBeNull();
        expect(screen.queryByRole('button', { name: DICTIONARY.en.settings.nemotronAssetDelete })).toBeNull();
    });
});
