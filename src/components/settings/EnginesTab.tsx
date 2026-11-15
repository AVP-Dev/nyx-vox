import React from 'react';
import { Wifi, Zap, Globe, HardDrive, Cpu, HelpCircle, Check, Loader2, Download, Trash, Pause, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionTitle } from './Common';
import type { SttMode } from '@/lib/types';

type FormattingMode = 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq' | 'gigachat';
interface EngineInfo {
    title: string;
    badge: string;
    type: string;
    desc: string;
}

import { type DICTIONARY } from './translations';

export interface EngineHelp {
    ru: Record<string, EngineInfo>;
    en: Record<string, EngineInfo>;
}

interface EnginesTabProps {
    c: typeof DICTIONARY.en;
    lang: string;
    sttMode: SttMode;
    handleModeChange: (mode: SttMode) => void;
    showHelp: string | null;
    setShowHelp: (v: string | null) => void;
    ENGINE_HELP: EngineHelp;
    formattingMode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq' | 'gigachat';
    handleFormattingModeChange: (mode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq' | 'gigachat') => void;
    whisperModel: 'small' | 'medium' | 'turbo';
    handleWhisperModelChange: (model: 'small' | 'medium' | 'turbo') => void;
    modelAvailable: boolean;
    downloading: boolean;
    downloadProgress: string;
    handleDownload: () => void;
    handleDeleteModel: () => void;
    nemotronAssetAvailable: boolean;
    nemotronAssetDownloading: boolean;
    nemotronAssetProgress: number;
    handleDownloadNemotronAsset: () => void;
    handleDeleteNemotronAsset: () => void;
    isPaused: boolean;
    handlePause: () => void;
    handleResume: () => void;
    handleCancel: () => void;
}

export const EnginesTab: React.FC<EnginesTabProps> = ({
    c, lang, sttMode, handleModeChange, showHelp, setShowHelp, ENGINE_HELP,
    formattingMode, handleFormattingModeChange, whisperModel, handleWhisperModelChange,
    modelAvailable, downloading, downloadProgress, handleDownload, handleDeleteModel,
    nemotronAssetAvailable, nemotronAssetDownloading, nemotronAssetProgress,
    handleDownloadNemotronAsset, handleDeleteNemotronAsset,
    isPaused, handlePause, handleResume, handleCancel
}) => {
    return (
        <div className="space-y-5">
            <div>
                <SectionTitle>
                    <div className="flex items-center justify-between w-full">
                        {c.settings.sttMode}
                        <button onClick={() => setShowHelp(showHelp === 'engines' ? null : 'engines')} className="hover:text-muted transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </SectionTitle>
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <EngineButton 
                        active={sttMode === 'deepgram'} 
                        icon={<Wifi className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'deepgram' ? 'text-primary' : 'text-white/30'}`} />} 
                        label={c.settings.deepgramLabel} 
                        desc={c.settings.deepgramDesc} 
                        onClick={() => handleModeChange('deepgram')}
                        activeColor="border-strong"
                    />
                    <EngineButton 
                        active={sttMode === 'groq'} 
                        icon={<Zap className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'groq' ? 'text-amber-400' : 'text-white/30'}`} />} 
                        label={c.settings.groqLabel} 
                        desc={c.settings.groqDesc} 
                        onClick={() => handleModeChange('groq')}
                        activeColor="border-amber-500/30"
                        activeLabelColor="text-amber-400/90"
                    />
                    <EngineButton 
                        active={sttMode === 'gemini'} 
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'gemini' ? 'text-sky-400' : 'text-white/30'}`} />} 
                        label={c.settings.geminiLabel} 
                        desc={c.settings.geminiDesc} 
                        onClick={() => handleModeChange('gemini')}
                        activeColor="border-sky-500/30"
                        activeLabelColor="text-sky-400/90"
                    />
                    <EngineButton 
                        active={sttMode === 'gigachat'}
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'gigachat' ? 'text-emerald-400' : 'text-white/30'}`} />}
                        label={c.settings.gigachatSTTLabel || 'GigaChat'}
                        desc={c.settings.gigachatSTTDesc || ''}
                        onClick={() => handleModeChange('gigachat')}
                        activeColor="border-emerald-500/30"
                        activeLabelColor="text-emerald-400/90"
                    />
                    <EngineButton 
                        active={sttMode === 'whisper'} 
                        icon={<HardDrive className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'whisper' ? 'text-primary' : 'text-white/30'}`} />} 
                        label={c.settings.whisperLabel} 
                        desc={c.settings.whisperDesc} 
                        onClick={() => handleModeChange('whisper')}
                        activeColor="border-strong"
                    />
                    <EngineButton
                        active={sttMode === 'elevenlabs'}
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'elevenlabs' ? 'text-violet-400' : 'text-white/30'}`} />}
                        label={c.settings.elevenlabsSTTLabel}
                        desc={c.settings.elevenlabsSTTDesc}
                        onClick={() => handleModeChange('elevenlabs')}
                        activeColor="border-violet-500/30"
                        activeLabelColor="text-violet-400/90"
                    />
                    <EngineButton
                        active={sttMode === 'azure_speech'}
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'azure_speech' ? 'text-sky-400' : 'text-white/30'}`} />}
                        label={c.settings.azureSpeechSTTLabel}
                        desc={c.settings.azureSpeechSTTDesc}
                        onClick={() => handleModeChange('azure_speech')}
                        activeColor="border-sky-500/30"
                        activeLabelColor="text-sky-400/90"
                    />
                    <EngineButton
                        active={sttMode === 'speechmatics'}
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'speechmatics' ? 'text-cyan-400' : 'text-white/30'}`} />}
                        label={c.settings.speechmaticsSTTLabel}
                        desc={c.settings.speechmaticsSTTDesc}
                        onClick={() => handleModeChange('speechmatics')}
                        activeColor="border-cyan-500/30"
                        activeLabelColor="text-cyan-400/90"
                    />
                    <EngineButton
                        active={sttMode === 'nvidia'}
                        icon={<Cpu className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'nvidia' ? 'text-emerald-400' : 'text-white/30'}`} />}
                        label={c.settings.nvidiaSTTLabel}
                        desc={c.settings.nvidiaSTTDesc}
                        onClick={() => handleModeChange('nvidia')}
                        activeColor="border-emerald-500/30"
                        activeLabelColor="text-emerald-400/90"
                    />
                </div>
            </div>

            {sttMode === 'whisper' && (
                <WhisperModelControls
                    c={c} lang={lang} whisperModel={whisperModel}
                    handleWhisperModelChange={handleWhisperModelChange}
                    modelAvailable={modelAvailable} downloading={downloading}
                    downloadProgress={downloadProgress} handleDownload={handleDownload}
                    handleDeleteModel={handleDeleteModel} isPaused={isPaused}
                    handlePause={handlePause} handleResume={handleResume} handleCancel={handleCancel}
                />
            )}
            {sttMode === 'nvidia' && (
                <NemotronModelControls
                    c={c} available={nemotronAssetAvailable} downloading={nemotronAssetDownloading}
                    progress={nemotronAssetProgress} onDownload={handleDownloadNemotronAsset}
                    onDelete={handleDeleteNemotronAsset}
                />
            )}

            <AnimatePresence>
                {showHelp === 'engines' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-5 overflow-hidden">
                        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-4">
                            {Object.entries(ENGINE_HELP[lang as keyof EngineHelp]).filter(([k]) => k !== 'formatting').map(([key, info]) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-black text-white/90">{info.title}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface border border-subtle text-muted font-bold uppercase tracking-wider">{info.badge}</span>
                                        <span className="text-[9px] text-orange-500/60 font-bold ml-auto uppercase tracking-tighter">{info.type}</span>
                                    </div>
                                    <p className="text-[11px] text-muted leading-relaxed italic">{info.desc}</p>
                                </div>
                            ))}
                            <button onClick={() => setShowHelp(null)} className="w-full py-1 text-[10px] font-bold text-white/20 hover:text-muted uppercase tracking-[0.2em]">{c.ui.close}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <SectionTitle>{c.settings.formattingEngine}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'gemini', label: c.settings.formattingGemini, color: 'border-sky-500/30 text-sky-400' },
                        { id: 'groq', label: c.settings.formattingGroq, color: 'border-amber-500/30 text-amber-400' },
                        { id: 'qwen', label: c.settings.formattingQwen, color: 'border-purple-500/30 text-purple-400' },
                        { id: 'deepseek', label: c.settings.formattingDeepSeek, color: 'border-cyan-500/30 text-cyan-400' },
                        { id: 'gigachat', label: c.settings.formattingGigachat, color: 'border-emerald-500/30 text-emerald-400' },
                        { id: 'none', label: c.settings.formattingNone, color: 'border-strong text-muted' },
                    ].map((m) => (
                        <button key={m.id} onClick={() => handleFormattingModeChange(m.id as FormattingMode)} className={`p-2.5 rounded-xl border transition-all text-left flex flex-col items-start ${formattingMode === m.id ? `bg-white/8 ${m.color.split(' ')[0]}` : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
                            <div className={`text-[11px] font-bold ${formattingMode === m.id ? m.color.split(' ')[1] : 'text-muted'}`}>{m.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>{c.welcome.faqTitle}</SectionTitle>
                <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3 text-[12px] leading-relaxed text-muted">
                    <FaqItem icon={<Wifi className="w-4 h-4 text-primary shrink-0 mt-0.5" />} text={c.settings.faqDeepgram} />
                    <FaqSeparator />
                    <FaqItem icon={<Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />} text={c.settings.faqGroq} />
                    <FaqSeparator />
                    <FaqItem icon={<Globe className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />} text={c.settings.faqGemini} />
                    <FaqSeparator />
                    <FaqItem icon={<HardDrive className="w-4 h-4 text-muted shrink-0 mt-0.5" />} text={c.settings.faqWhisper} />
                    <FaqSeparator />
                    <FaqItem icon={<Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />} text={ENGINE_HELP[lang as keyof EngineHelp].gigachat.desc} isItalic color="text-emerald-400/80" />
                    <FaqSeparator />
                    <FaqItem icon={<HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />} text={ENGINE_HELP[lang as keyof EngineHelp].formatting.desc} isItalic color="text-sky-400/80" />
                </div>
            </div>
        </div>
    );
};

type WhisperModelControlsProps = Pick<EnginesTabProps,
    'c' | 'lang' | 'whisperModel' | 'handleWhisperModelChange' | 'modelAvailable' |
    'downloading' | 'downloadProgress' | 'handleDownload' | 'handleDeleteModel' |
    'isPaused' | 'handlePause' | 'handleResume' | 'handleCancel'
>;

const WhisperModelControls: React.FC<WhisperModelControlsProps> = ({
    c, lang, whisperModel, handleWhisperModelChange, modelAvailable, downloading,
    downloadProgress, handleDownload, handleDeleteModel, isPaused, handlePause,
    handleResume, handleCancel,
}) => (
    <div className="space-y-4">
        <div>
            <SectionTitle>{lang === 'ru' ? 'Выбор модели Whisper' : 'Whisper Model Selection'}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 mb-3">
                {(['small', 'medium', 'turbo'] as const).map((model) => (
                    <button key={model} onClick={() => handleWhisperModelChange(model)} className={`p-2 rounded-xl border transition-all text-center text-[11px] font-bold ${whisperModel === model ? 'bg-white/8 border-strong text-white' : 'bg-white/3 border-white/8 text-muted hover:border-white/15'}`}>
                        {(c.settings as unknown as Record<string, string>)[`model${model[0].toUpperCase()}${model.slice(1)}`]}
                    </button>
                ))}
            </div>
        </div>
        <WhisperModelStatus
            c={c} whisperModel={whisperModel} modelAvailable={modelAvailable}
            downloading={downloading} downloadProgress={downloadProgress}
            onDownload={handleDownload} isPaused={isPaused} onPause={handlePause}
            onResume={handleResume} onCancel={handleCancel} onDelete={handleDeleteModel}
        />
    </div>
);

type WhisperModelStatusProps = Pick<WhisperModelControlsProps,
    'c' | 'whisperModel' | 'modelAvailable' | 'downloading' | 'downloadProgress'
> & {
    isPaused: boolean;
    onDownload: () => void;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onDelete: () => void;
};

const WhisperModelStatus: React.FC<WhisperModelStatusProps> = ({
    c, whisperModel, modelAvailable, downloading, downloadProgress,
    isPaused, onDownload, onPause, onResume, onCancel, onDelete,
}) => (
    <div>
        <SectionTitle>{c.settings.modelStatus}</SectionTitle>
        <div className="p-3 rounded-xl bg-white/3 border border-subtle">
            {modelAvailable ? (
                <WhisperInstalledStatus c={c} whisperModel={whisperModel} />
            ) : downloading ? (
                <WhisperDownloadingStatus
                    c={c} progress={downloadProgress} isPaused={isPaused}
                    onPause={onPause} onResume={onResume} onCancel={onCancel}
                />
            ) : (
                <WhisperMissingStatus
                    c={c} whisperModel={whisperModel} onDownload={onDownload}
                />
            )}
        </div>
        {modelAvailable && <button onClick={onDelete} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400/60 hover:text-red-400 text-[11px] font-medium"><Trash className="w-3 h-3" />{c.settings.modelDelete}</button>}
    </div>
);

const WhisperInstalledStatus: React.FC<Pick<WhisperModelStatusProps, 'c' | 'whisperModel'>> = ({ c, whisperModel }) => (
    <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-400" />
        <div>
            <div className="text-[12px] font-medium text-emerald-400">{c.settings.modelInstalled}</div>
            <div className="text-[10px] text-white/30">{getWhisperModelFile(whisperModel)}</div>
        </div>
    </div>
);

type WhisperDownloadingStatusProps = Pick<WhisperModelStatusProps, 'c' | 'isPaused'> & {
    progress: string;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
};

const WhisperDownloadingStatus: React.FC<WhisperDownloadingStatusProps> = ({
    c, progress, isPaused, onPause, onResume, onCancel,
}) => (
    <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
            {isPaused ? <Pause className="w-4 h-4 text-amber-400" /> : <Loader2 className="w-4 h-4 text-muted animate-spin" />}
            <div>
                <div className="text-[12px] text-muted">{isPaused ? c.settings.modelPause : c.settings.modelDownloading}</div>
                <div className="text-[10px] text-white/30">{progress}</div>
            </div>
        </div>
        <div className="flex items-center gap-1.5">
            {isPaused ? (
                <button onClick={onResume} className="p-1.5 bg-surface hover:bg-surface-hover rounded-lg text-muted" title={c.settings.modelResume}><Play className="w-3.5 h-3.5" /></button>
            ) : (
                <button onClick={onPause} className="p-1.5 bg-surface hover:bg-surface-hover rounded-lg text-muted" title={c.settings.modelPause}><Pause className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={onCancel} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400/60" title={c.settings.modelCancel}><X className="w-3.5 h-3.5" /></button>
        </div>
    </div>
);

const WhisperMissingStatus: React.FC<Pick<WhisperModelStatusProps, 'c' | 'whisperModel'> & { onDownload: () => void }> = ({
    c, whisperModel, onDownload,
}) => (
    <div className="flex items-center justify-between">
        <div>
            <div className="text-[12px] text-muted">{c.settings.modelNotFound}</div>
            <div className="text-[10px] text-white/30">{getWhisperModelSize(whisperModel)}</div>
        </div>
        <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-white/15 rounded-lg text-[11px] font-medium text-primary"><Download className="w-3.5 h-3.5" />{c.settings.modelDownload}</button>
    </div>
);

const getWhisperModelFile = (model: WhisperModelControlsProps['whisperModel']) =>
    model === 'turbo' ? 'ggml-large-v3-turbo-q8_0.bin · ~830 MB' : model === 'medium' ? 'ggml-medium.bin · 1.5 GB' : 'ggml-small.bin · 500 MB';

const getWhisperModelSize = (model: WhisperModelControlsProps['whisperModel']) =>
    model === 'turbo' ? '~830 MB' : model === 'medium' ? '~1.5 GB' : '~500 MB';

interface NemotronModelControlsProps {
    c: typeof DICTIONARY.en;
    available: boolean;
    downloading: boolean;
    progress: number;
    onDownload: () => void;
    onDelete: () => void;
}

const NemotronModelControls: React.FC<NemotronModelControlsProps> = ({
    c, available, downloading, progress, onDownload, onDelete,
}) => {
    const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
    return (
        <div>
            <SectionTitle>{c.settings.nemotronAssetTitle}</SectionTitle>
            <div className="p-4 rounded-xl bg-white/3 border border-subtle space-y-3">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        {downloading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : available ? <Check className="w-4 h-4 text-emerald-400" /> : <Cpu className="w-4 h-4 text-white/30" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={`text-[12px] font-medium ${available && !downloading ? 'text-emerald-400' : 'text-muted'}`}>
                            {downloading ? c.settings.nemotronAssetDownloading : available ? c.settings.nemotronAssetInstalled : c.settings.nemotronAssetMissing}
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-white/35">{c.settings.nemotronAssetDesc}</p>
                    </div>
                </div>
                {downloading ? (
                    <NemotronProgress c={c} value={safeProgress} />
                ) : available ? (
                    <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400/60 hover:text-red-400 text-[11px] font-medium">
                        <Trash className="w-3 h-3" />{c.settings.nemotronAssetDelete}
                    </button>
                ) : (
                    <button onClick={onDownload} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-hover hover:bg-white/15 text-primary text-[11px] font-medium">
                        <Download className="w-3.5 h-3.5" />{c.settings.nemotronAssetDownload}
                    </button>
                )}
            </div>
        </div>
    );
};

const NemotronProgress: React.FC<{ c: typeof DICTIONARY.en; value: number }> = ({ c, value }) => (
    <div className="space-y-1.5">
        <div role="progressbar" aria-label={c.settings.nemotronAssetProgressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${value}%` }} />
        </div>
        <div className="text-right text-[10px] text-white/40">{Math.round(value)}%</div>
    </div>
);

interface EngineButtonProps {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    desc: string;
    onClick: () => void;
    activeColor: string;
    activeLabelColor?: string;
}

const EngineButton = ({ active, icon, label, desc, onClick, activeColor, activeLabelColor = "text-white/90" }: EngineButtonProps) => (
    <button onClick={onClick} className={`p-3 rounded-xl border transition-all text-left flex flex-col items-start ${active ? `bg-white/8 ${activeColor}` : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
        {icon}
        <div className={`text-[12px] font-semibold ${active ? activeLabelColor : 'text-muted'}`}>{label}</div>
        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{desc}</div>
    </button>
);

interface FaqItemProps {
    icon: React.ReactNode;
    text: string;
    isItalic?: boolean;
    color?: string;
}

const FaqItem = ({ icon, text, isItalic = false, color = "text-muted" }: FaqItemProps) => (
    <div className="flex gap-2">
        {icon}
        <p className={`${isItalic ? 'italic' : ''} ${color}`}>{text}</p>
    </div>
);

const FaqSeparator = () => <div className="w-full h-[1px] bg-surface" />;
