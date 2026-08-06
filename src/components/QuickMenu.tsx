'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Mic, Zap, History } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { CONTENT } from '@/components/SettingsPanel';
import type { FormattingMode, AppLanguage, TranslationDict } from '@/lib/types';

const C = CONTENT as unknown as Record<string, TranslationDict>;

export interface QuickMenuProps {
    isOpen: boolean;
    formattingMode: FormattingMode;
    lastActiveFormatting: Exclude<FormattingMode, 'none'>;
    lang: AppLanguage;
    sttMode: string;
    onToggleFormatting: (mode: FormattingMode) => void;
    onToggleSTTMode: () => void;
    onOpenSettings: () => void;
    onClose: () => void;
}

export function QuickMenu({
    isOpen,
    formattingMode,
    lastActiveFormatting,
    lang,
    sttMode,
    onToggleFormatting,
    onToggleSTTMode,
    onOpenSettings,
    onClose,
}: QuickMenuProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -5, x: '-50%', scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                    exit={{ opacity: 0, y: -5, x: '-50%', scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
                    className="absolute top-[42px] left-1/2 w-[190px] bg-[#1A1A1C]/98 backdrop-blur-3xl border border-white/10 rounded-2xl p-1.5 z-[99999] flex flex-col gap-0.5 shadow-xl pointer-events-auto overflow-hidden"
                >
                    <button
                        onClick={() => {
                            const next = formattingMode === 'none' ? lastActiveFormatting : 'none';
                            onToggleFormatting(next);
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${formattingMode !== 'none' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-white/5 text-white/50 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={14} className={formattingMode !== 'none' ? 'animate-pulse' : ''} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{C[lang].ui.aiRefine}</span>
                        </div>
                        <div className={`w-6 h-3 rounded-full relative transition-colors ${formattingMode !== 'none' ? 'bg-cyan-500/40' : 'bg-white/10'}`}>
                            <motion.div animate={{ x: formattingMode !== 'none' ? 12 : 2 }} className="absolute top-0.5 w-2 h-2 bg-white rounded-full shadow-none" />
                        </div>
                    </button>

                    <button
                        onClick={onToggleSTTMode}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all border border-transparent hover:border-white/5"
                    >
                        <div className="flex items-center gap-2">
                            <Mic size={14} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{C[lang].ui.engine}</span>
                        </div>
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">
                            {sttMode === 'deepgram' ? 'Cloud' : sttMode === 'whisper' ? 'Local' : sttMode.toUpperCase()}
                        </span>
                    </button>

                    <div className="h-px bg-white/5 my-1 mx-2" />

                    <button
                        onClick={() => {
                            invoke('open_history_window').catch(console.error);
                            onClose();
                        }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-all"
                    >
                        <History size={14} />
                        <span className="text-[11px] font-black uppercase tracking-wider">{C[lang].history.openHistory}</span>
                    </button>

                    <button
                        onClick={onOpenSettings}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-all"
                    >
                        <Settings2 size={14} />
                        <span className="text-[11px] font-black uppercase tracking-wider">{C[lang].ui.settings}</span>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
