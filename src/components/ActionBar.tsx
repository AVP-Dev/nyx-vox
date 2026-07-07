'use client';

import React from 'react';
import { Check, Copy, Send, Pencil, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { CONTENT } from '@/components/SettingsPanel';
import type { Phase, AppLanguage, TranslationDict } from '@/lib/types';

const C = CONTENT as unknown as Record<string, TranslationDict>;

export interface ActionBarProps {
    phase: Phase;
    lang: AppLanguage;
    transcriptText: string;
    targetApp: string;
    onToggleEdit: () => void;
    onCopy: () => void;
    onReset: () => void;
    onPaste: () => void;
    onUpdateTarget: () => void;
}

export function ActionBar({
    phase, lang, transcriptText, targetApp,
    onToggleEdit, onCopy, onReset, onPaste, onUpdateTarget,
}: ActionBarProps) {
    return (
        <div className="flex items-center justify-between gap-2 h-10 mt-auto shrink-0 pb-0.5">
            <div className="flex items-center gap-1 relative group/target">
                {/* Brand Accent */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/5 mr-0.5 pointer-events-none">
                    <span className="text-[9px] font-black text-white/20 select-none tracking-tighter">NV</span>
                </div>

                <button
                    onClick={onToggleEdit}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${phase === 'editing' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 shadow-[inset_0_0_10px_rgba(52,211,153,0.05)]' : 'hover:bg-white/10 text-white/40 hover:text-white'}`}
                    title={C[lang].ui.edit}
                >
                    {phase === 'editing' ? <Check size={14} /> : <Pencil size={14} />}
                </button>

                <button
                    onClick={onCopy}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                    title={C[lang].ui.copy}
                >
                    <Copy size={14} />
                </button>

                <button
                    onClick={onReset}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                    title={C[lang].ui.reset}
                >
                    <X size={15} />
                </button>
            </div>

            <button
                onClick={onPaste}
                onMouseEnter={() => {
                    if (phase === 'result' || phase === 'editing') {
                        invoke('update_target_app').then(() => onUpdateTarget()).catch(console.error);
                    }
                }}
                disabled={!transcriptText}
                className={`h-8.5 px-4 flex items-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 max-w-[180px] ${transcriptText ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white active:scale-95 shadow-lg shadow-orange-500/20' : 'bg-white/5 text-white/10 opacity-50 cursor-not-allowed'}`}
            >
                <Send size={12} strokeWidth={3} className="shrink-0" />
                <span className="truncate">
                    {targetApp
                        ? `${C[lang].ui.toApp} ${targetApp}`
                        : C[lang].ui.paste}
                </span>
            </button>
        </div>
    );
}
