import React from 'react';
import { ExternalLink, ShieldAlert, Mic2, Accessibility, Timer } from 'lucide-react';
import { Toggle, SectionTitle } from './Common';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useStore } from '@/store/useStore';
import { type DICTIONARY } from './translations';
import type { ToastType } from '../ui/Toast';

interface GeneralTabProps {
    c: typeof DICTIONARY.en;
    autoPaste: boolean;
    onToggleAutoPaste: (v: boolean) => void;
    clearOnPaste: boolean;
    onToggleClearOnPaste: (v: boolean) => void;
    startMinimized: boolean;
    onToggleStartMinimized: (v: boolean) => void;
    autoPauseMedia: boolean;
    handleToggleAutoPauseMedia: (v: boolean) => void;
    alwaysOnTop: boolean;
    onToggleAlwaysOnTop: (v: boolean) => void;
    lang: string;
    formattingStyle: 'casual' | 'professional';
    onSetFormattingStyle: (s: 'casual' | 'professional') => void;
    micGranted?: boolean | null;
    accGranted?: boolean | null;
    noiseGate: number;
    onSetNoiseGate: (v: number) => void;
    audioGain: number;
    onSetAudioGain: (v: number) => void;
    vadAutoStop?: boolean;
    onToggleVadAutoStop?: (v: boolean) => void;
    vadSilenceTimeout?: number;
    onSetVadSilenceTimeout?: (v: number) => void;
    addToast: (message: string, type?: ToastType) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
    c, autoPaste, onToggleAutoPaste, clearOnPaste, onToggleClearOnPaste,
    startMinimized, onToggleStartMinimized, autoPauseMedia, handleToggleAutoPauseMedia,
    alwaysOnTop, onToggleAlwaysOnTop, lang,
    formattingStyle, onSetFormattingStyle, micGranted, accGranted,
    noiseGate, onSetNoiseGate, audioGain, onSetAudioGain,
    vadAutoStop = false, onToggleVadAutoStop,
    vadSilenceTimeout = 7.0, onSetVadSilenceTimeout,
    addToast
}) => {
    const [resetting, setResetting] = React.useState(false);

    const {
        compactResultWindow, setCompactResultWindow,
        liveStreamPreview, setLiveStreamPreview,
    } = useStore();

    // Automatic focus back when settings/permissions are granted
    React.useEffect(() => {
        if (accGranted === true || micGranted === true) {
            getCurrentWindow().show().then(() => {
                getCurrentWindow().setFocus();
            });
        }
    }, [accGranted, micGranted]);

    const handleResetAcc = async () => {
        setResetting(true);
        try {
            await invoke('reset_accessibility_permissions');
            addToast(c.settings.accessibilityResetAlert, 'success');
        } catch (e) {
            addToast(`Error: ${e}`, 'error');
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="space-y-6 pb-4">
            <div>
                <SectionTitle>{c.settings.status || 'Status'}</SectionTitle>
                <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <StatusCard 
                            icon={Mic2} 
                            label={c.settings.microphone || 'Microphone'} 
                            granted={micGranted} 
                            color="text-orange-400"
                            action={() => invoke('open_microphone_settings')}
                            lang={lang}
                        />
                        <StatusCard 
                            icon={Accessibility} 
                            label={c.settings.accessibilityTab || 'Accessibility'} 
                            granted={accGranted} 
                            color="text-sky-400"
                            action={() => invoke('open_accessibility_settings')}
                            secondaryAction={handleResetAcc}
                            resetting={resetting}
                            lang={lang}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/10 text-emerald-400">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <div className="text-[13px] font-bold text-white/90">{c.settings.autoPaste}</div>
                                <div className="text-[10px] text-muted leading-none mt-0.5">{c.settings.autoPasteDesc}</div>
                            </div>
                        </div>
                        <Toggle checked={autoPaste} onChange={onToggleAutoPaste} />
                    </div>

                    <div className="flex flex-col p-3.5 rounded-xl bg-surface border border-subtle gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-surface text-muted">
                                    <Mic2 className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-white/90">{c.settings.noiseGateTitle}</div>
                                    <div className="text-[10px] text-muted leading-none mt-0.5">{c.settings.noiseGateDesc}</div>
                                </div>
                            </div>
                            <div className="text-[11px] font-mono text-muted bg-surface px-2 py-0.5 rounded">
                                {noiseGate.toFixed(3)}
                            </div>
                        </div>
                        <div className="px-1 mt-1 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{c.settings.noiseGateLoud}</span>
                            <input
                                type="range"
                                min="0.001"
                                max="0.025"
                                step="0.001"
                                value={noiseGate}
                                onChange={(e) => onSetNoiseGate(parseFloat(e.target.value))}
                                className="flex-1 accent-orange-500 h-1.5 bg-surface-hover rounded-full appearance-none cursor-pointer hover:bg-surface-hover transition-colors"
                            />
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{c.settings.noiseGateQuiet}</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-3.5 rounded-xl bg-surface border border-subtle gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-surface text-muted">
                                    <Mic2 className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-white/90">{c.settings.audioGainTitle}</div>
                                    <div className="text-[10px] text-muted leading-none mt-0.5">{c.settings.audioGainDesc}</div>
                                </div>
                            </div>
                            <div className="text-[11px] font-mono text-muted bg-surface px-2 py-0.5 rounded">
                                {audioGain.toFixed(1)}
                            </div>
                        </div>
                        <div className="px-1 mt-1 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{c.settings.audioGainLow}</span>
                            <input
                                type="range"
                                min="1.0"
                                max="5.0"
                                step="0.5"
                                value={audioGain}
                                onChange={(e) => onSetAudioGain(parseFloat(e.target.value))}
                                className="flex-1 accent-orange-500 h-1.5 bg-surface-hover rounded-full appearance-none cursor-pointer hover:bg-surface-hover transition-colors"
                            />
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{c.settings.audioGainHigh}</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-3.5 rounded-xl bg-surface border border-subtle gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-surface text-muted">
                                    <Timer className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-white/90">{c.settings.vadTitle}</div>
                                    <div className="text-[10px] text-muted leading-none mt-0.5">{c.settings.vadDesc}</div>
                                </div>
                            </div>
                            <Toggle checked={vadAutoStop} onChange={(v) => onToggleVadAutoStop?.(v)} />
                        </div>

                        {vadAutoStop && (
                            <div className="pt-2 border-t border-subtle">
                                <div className="flex items-center justify-between text-[11px] text-muted mb-1.5 px-0.5">
                                    <span>{c.settings.vadTimeoutLabel}</span>
                                    <span className="font-mono text-orange-400 font-bold">{vadSilenceTimeout.toFixed(0)} {c.settings.vadTimeoutUnit}</span>
                                </div>
                                <div className="px-1 flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">3s</span>
                                    <input
                                        type="range"
                                        min="3.0"
                                        max="15.0"
                                        step="1.0"
                                        value={vadSilenceTimeout}
                                        onChange={(e) => onSetVadSilenceTimeout?.(parseFloat(e.target.value))}
                                        className="flex-1 accent-orange-500 h-1.5 bg-surface-hover rounded-full appearance-none cursor-pointer hover:bg-surface-hover transition-colors"
                                    />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">15s</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <SectionTitle>{c.settings.behavior}</SectionTitle>
                <div className="space-y-2">
                    {[
                        { label: c.settings.clearOnPaste, desc: c.settings.clearOnPasteDesc, val: clearOnPaste, fn: onToggleClearOnPaste },
                        { label: c.settings.startMinimized, desc: c.settings.startMinimizedDesc, val: startMinimized, fn: onToggleStartMinimized },
                        { label: c.settings.autoPause, desc: c.settings.autoPauseDesc, val: autoPauseMedia, fn: handleToggleAutoPauseMedia },
                        { label: c.settings.alwaysOnTop, desc: c.settings.alwaysOnTopDesc, val: alwaysOnTop, fn: onToggleAlwaysOnTop },
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                            <div>
                                <div className="text-[13px] font-semibold text-white/90">{item.label}</div>
                                <div className="text-[11px] text-muted mt-0.5">{item.desc}</div>
                            </div>
                            <Toggle checked={item.val} onChange={item.fn} />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>{lang === 'ru' ? 'Интерфейс' : 'Interface'}</SectionTitle>
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                        <div>
                            <div className="text-[13px] font-semibold text-white/90">{lang === 'ru' ? 'Живой предпросмотр речи' : 'Live Speech Preview'}</div>
                            <div className="text-[11px] text-muted mt-0.5">{lang === 'ru' ? 'Отображать бегущий текст при записи' : 'Stream live text during recording'}</div>
                        </div>
                        <Toggle checked={liveStreamPreview} onChange={setLiveStreamPreview} />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/4 border border-white/8">
                        <div>
                            <div className="text-[13px] font-semibold text-white/90">{lang === 'ru' ? 'Компактный режим' : 'Compact Mode'}</div>
                            <div className="text-[11px] text-muted mt-0.5">{lang === 'ru' ? 'Уменьшить размер окна в простое' : 'Reduce window size when idle'}</div>
                        </div>
                        <Toggle checked={compactResultWindow} onChange={setCompactResultWindow} />
                    </div>
                </div>
            </div>

            <div>
                <SectionTitle>{c.settings.formatStyleLabel}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { 
                            id: 'casual', 
                            label: c.settings.formatStyleCasual, 
                            desc: lang === 'ru' ? 'Сохраняет живую речь, убирает запинки.' : 'Preserves natural speech, removes stutters.' 
                        },
                        { 
                            id: 'professional', 
                            label: c.settings.formatStyleProfessional, 
                            desc: lang === 'ru' ? 'Деловой стиль, четкая структура и логика.' : 'Business style, clear structure and logic.' 
                        },
                    ].map((style) => (
                        <button
                            key={style.id}
                            onClick={() => onSetFormattingStyle(style.id as 'casual' | 'professional')}
                            className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-300 ${
                                formattingStyle === style.id
                                ? 'bg-surface-hover border-strong shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                                : 'bg-white/2 border-subtle hover:bg-white/4 hover:border-subtle'
                            }`}
                        >
                            <span className={`text-[13px] font-bold ${formattingStyle === style.id ? 'text-white' : 'text-muted'}`}>{style.label}</span>
                            <span className="text-[10px] text-white/30 mt-1 leading-tight font-medium italic">{style.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-4 shrink-0" />
        </div>
    );
};

interface StatusCardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    granted: boolean | null | undefined;
    color: string;
    action: () => void;
    secondaryAction?: () => void;
    lang: string;
    resetting?: boolean;
}

const StatusCard = ({ icon: Icon, label, granted, color, action, secondaryAction, lang, resetting }: StatusCardProps) => (
    <div className="p-4 rounded-3xl bg-surface border border-subtle flex flex-col gap-4 group relative overflow-hidden transition-all hover:bg-white/[0.05]">
        <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-surface border border-subtle flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-[12px] font-black text-white/90 tracking-tight">{label}</div>
                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-0.5">
                        {granted === true ? (lang === 'ru' ? 'Активен' : 'Active') : (lang === 'ru' ? 'Требуется' : 'Required')}
                    </div>
                </div>
            </div>

            <div className={`w-2.5 h-2.5 rounded-full ${granted === true ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse'}`} />
        </div>

        <div className="grid grid-cols-1 gap-1.5 relative z-10">
            <button
                onClick={action}
                className="w-full h-9 rounded-xl bg-surface border border-subtle hover:bg-surface-hover hover:border-subtle text-[10px] font-black text-primary hover:text-white transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
            >
                {lang === 'ru' ? 'Настроить' : 'Setup'}
                <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
            
            {secondaryAction && (
                <button 
                    onClick={secondaryAction}
                    disabled={resetting}
                    className={`w-full h-8 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/5 hover:border-red-500/10 text-[9px] font-black text-red-500/40 hover:text-red-500 transition-all uppercase tracking-[0.15em] flex items-center justify-center gap-2 mt-0.5 ${resetting ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <ShieldAlert className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
                    {resetting ? (lang === 'ru' ? 'Сбрасываю...' : 'Resetting...') : (lang === 'ru' ? 'Сбросить' : 'Reset')}
                </button>
            )}
        </div>
        
        {secondaryAction && (
            <div className="text-[9px] text-white/15 italic leading-snug px-1 text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {lang === 'ru' ? 'Решает проблемы со вставкой текста' : 'Fixes text auto-paste issues'}
            </div>
        )}

        {/* Dynamic visual flair */}
        <div className={`absolute -right-4 -bottom-4 w-16 h-16 opacity-[0.02] ${color} pointer-events-none transition-transform duration-700 group-hover:scale-125 group-hover:-rotate-12`}>
            <Icon className="w-full h-full" />
        </div>
    </div>
);
