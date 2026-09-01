'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { QuickMenu } from '@/components/QuickMenu';
import type { Phase, FormattingMode, AppLanguage } from '@/lib/types';

export interface HeaderBarProps {
    phase: Phase;
    isRec: boolean;
    isProc: boolean;
    isIdle: boolean;
    isOverlay: boolean;
    aiStatus: string;
    formattingStatus: string | null;
    lang: AppLanguage;
    sttMode: string;
    formattingMode: FormattingMode;
    lastActiveFormatting: Exclude<FormattingMode, 'none'>;
    showQuickMenu: boolean;
    transcriptText: string;
    autoPaste: boolean;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    onTriggerStart: () => void;
    onTriggerStop: () => void;
    onSetShowQuickMenu: (v: boolean) => void;
    onSetShowSettings: (v: boolean) => void;
    onToggleFormatting: (mode: FormattingMode) => void;
    onToggleSTTMode: () => void;
    onSetPhase: (phase: Phase) => void;
    onSetProcessing: (v: boolean) => void;
    onSetTranscript: (text: string) => void;
}

export function HeaderBar(props: HeaderBarProps) {
    const {
        phase, isRec, isProc, isIdle, isOverlay,
        aiStatus, formattingStatus, lang, sttMode,
        formattingMode, lastActiveFormatting,
        showQuickMenu, transcriptText, autoPaste,
        scrollRef,
        onTriggerStart, onTriggerStop, onSetShowQuickMenu,
        onSetShowSettings, onToggleFormatting, onToggleSTTMode,
        onSetPhase, onSetProcessing, onSetTranscript,
    } = props;

    const handleCancel = async () => {
        if (phase === 'recording') {
            try {
                await invoke('stop_recording');
            } catch (err) {
                // ALREADY_IDLE/ALREADY_PROCESSING mean the backend already
                // transitioned — that's fine, we just reset the UI. Other
                // errors should surface so the user isn't left in limbo.
                if (err !== 'ALREADY_IDLE' && err !== 'ALREADY_PROCESSING') {
                    console.error('stop_recording failed during cancel:', err);
                }
            }
        } else if (phase === 'processing') {
            onSetProcessing(false);
        }
        onSetTranscript('');
        onSetPhase('idle');
    };

    // Auto-scroll to the latest spoken words
    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [transcriptText, scrollRef]);

    return (
        <div data-tauri-drag-region className="flex items-center h-10 w-full relative px-2 shrink-0 cursor-default">
            {/* Left: Mic Button */}
            <div className="absolute left-2 top-0 bottom-0 flex items-center z-20">
                <motion.button
                    onMouseDown={(e) => { e.stopPropagation(); void (isIdle ? onTriggerStart() : onTriggerStop()); }}
                    className={`rounded-full flex items-center justify-center transition-all duration-300 w-8 h-8 ${isRec ? 'bg-red-500 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'}`}
                >
                    {isRec ? <div className="w-2.5 h-2.5 bg-white rounded-sm" /> : <Mic size={14} />}
                </motion.button>
            </div>

            {/* Center: Status / Live Speech Stream Display */}
            <div data-tauri-drag-region className="flex-1 flex items-center h-full mx-10 overflow-hidden pointer-events-none">
                <AnimatePresence mode="wait">
                    {isRec || isProc || (autoPaste && phase === 'result' && !isOverlay) ? (
                        <motion.div key="rec-lbl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full overflow-hidden flex items-center">
                            <div
                                ref={scrollRef}
                                className="w-full overflow-hidden whitespace-nowrap text-[12px] text-white/90 font-medium tracking-tight flex items-center scroll-smooth [mask-image:linear-gradient(to_right,transparent_0%,black_16px,black_100%)]"
                            >
                                {isRec ? (
                                    transcriptText ? (
                                        <div className="flex items-center gap-1 min-w-full justify-end pr-1">
                                            <span className="text-white/95">{transcriptText}</span>
                                            <span className="inline-block w-1.5 h-3.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                                        </div>
                                    ) : (
                                        <div className="w-full flex justify-center">
                                            <span className="text-white/30 text-[11px] font-mono tracking-widest animate-pulse">● ● ●</span>
                                        </div>
                                    )
                                ) : (
                                    <div className="w-full flex justify-center items-center gap-1.5 text-[11px] text-white/80 font-bold">
                                        <span>{aiStatus || (lang === 'ru' ? 'Обработка...' : 'Processing...')}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (phase === 'result' || isProc) ? (
                        <motion.div key="res-lbl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${aiStatus.toLowerCase().includes("ошибка") || aiStatus.toLowerCase().includes("error") ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"} ${isProc ? "animate-bounce" : ""}`} />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40 select-none">
                                    {aiStatus.toLowerCase().includes("ошибка") || aiStatus.toLowerCase().includes("error")
                                        ? (lang === "ru" ? `ОШИБКА: ${aiStatus.replace(/Ошибка:? ?/i, "")}` : `ERROR: ${aiStatus.replace(/Error:? ?/i, "")}`)
                                        : isProc
                                            ? (aiStatus || (lang === 'ru' ? 'ИИ-агент работает...' : 'AI-agent is working...'))
                                            : (lang === 'ru' ? 'РЕЗУЛЬТАТ' : 'RESULT')
                                    }
                                </span>
                                {formattingStatus?.startsWith('error') && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0.7, 1, 0.7] }}
                                        transition={{ opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)] h-[18px]"
                                    >
                                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center leading-none">
                                            {lang === 'ru' ? 'AI-ОШИБКА' : 'AI-ERROR'}
                                            <span className="ml-1 opacity-60 font-medium whitespace-nowrap">({formattingStatus.split(':')[1] || 'Err'})</span>
                                        </span>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    ) : phase === 'editing' ? (
                        <motion.div key="edit-lbl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40 select-none">
                                {lang === 'ru' ? 'РЕДАКТОР' : 'EDITOR'}
                            </span>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Right: Close Button or NV Logo + Quick Menu Trigger */}
            <div className="absolute right-2 top-0 bottom-0 flex items-center h-full z-20">
                {!isIdle ? (
                    <motion.button
                        onMouseDown={(e) => { e.stopPropagation(); handleCancel(); }}
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                    >
                        <X size={14} />
                    </motion.button>
                ) : (
                    <motion.div
                        onMouseDown={(e) => { e.stopPropagation(); onSetShowQuickMenu(!showQuickMenu); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/4 border border-white/5 transition-all cursor-pointer active:scale-95 hover:bg-white/10 ${showQuickMenu ? 'bg-white/10 border-orange-500/30' : ''}`}
                    >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/20">
                            <span className="text-[9px] font-black tracking-tighter select-none text-orange-500">NV</span>
                        </div>

                        <AnimatePresence mode="wait">
                            {showQuickMenu ? (
                                <motion.span
                                    key="menu-lbl" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="text-[10px] font-black text-orange-500 tracking-[0.1em] whitespace-nowrap uppercase"
                                >
                                    {lang === 'ru' ? 'МЕНЮ' : 'MENU'}
                                </motion.span>
                            ) : (
                                <motion.div key="idle-dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1.5 items-center">
                                    <div className={`w-1.5 h-1.5 rounded-full ${sttMode === 'whisper' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                                    <div className={`w-1.5 h-1.5 rounded-full ${formattingMode !== 'none' ? 'bg-cyan-400' : 'bg-white/5'}`} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>

            {/* Quick Menu Popover */}
            <QuickMenu
                isOpen={showQuickMenu && isIdle}
                formattingMode={formattingMode}
                lastActiveFormatting={lastActiveFormatting}
                lang={lang}
                sttMode={sttMode}
                onToggleFormatting={onToggleFormatting}
                onToggleSTTMode={onToggleSTTMode}
                onOpenSettings={() => { onSetShowSettings(true); onSetShowQuickMenu(false); }}
                onClose={() => onSetShowQuickMenu(false)}
            />
        </div>
    );
}
