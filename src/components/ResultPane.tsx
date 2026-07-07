'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { AppLanguage } from '@/lib/types';

export interface ResultPaneProps {
    lang: AppLanguage;
    aiStatus: string;
    transcriptText: string;
    onTextSelection: () => void;
}

export function ResultPane({ lang, aiStatus, transcriptText, onTextSelection }: ResultPaneProps) {
    return (
        <motion.div
            key="result-pane"
            data-result-pane
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col p-4 pt-1.5 relative overflow-hidden rounded-[12px] border border-white/5 bg-white/[0.03] text-left items-start pointer-events-auto"
        >
            {/* Copy status overlay */}
            {aiStatus && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/20 backdrop-blur-sm">
                    <span className="px-4 py-2 rounded-xl bg-orange-500/30 backdrop-blur-md text-orange-300 text-[13px] font-black uppercase tracking-wider border border-orange-500/40 shadow-2xl">
                        {aiStatus}
                    </span>
                </div>
            )}

            <div
                onMouseUp={onTextSelection}
                onKeyUp={onTextSelection}
                className="flex-1 w-full overflow-y-auto custom-scrollbar select-text result-text text-[13px] text-white/80 leading-relaxed font-normal relative z-10 pointer-events-auto"
                style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text', display: 'block' }}
            >
                <span className="block whitespace-pre-wrap break-words" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                    {transcriptText || (
                        <span className="text-white/20 italic">
                            {lang === 'ru' ? 'Текст не распознан' : 'No text detected'}
                        </span>
                    )}
                </span>
            </div>
        </motion.div>
    );
}
