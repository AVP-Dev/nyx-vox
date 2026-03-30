import React from 'react';
import { Trash, Check, History, ChevronRight } from 'lucide-react';
import { SectionTitle } from './Common';

interface HistoryTabProps {
    c: {
        history: {
            title: string;
            clearAll: string;
            openHistory: string;
            search: string;
            smartCleanup: string;
            smartCleanupDesc: string;
            retention: string;
            periods: Record<string, string>;
        };
    };
    lang: string;
    handleClearHistory: () => void;
    isConfirmingClear: boolean;
    handleOpenHistory: () => void;
    historySmartCleanup: boolean;
    historyRetentionPeriod: string;
    handleHistorySettingsChange: (cleanup: boolean, period: string) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    c, lang, handleClearHistory, isConfirmingClear, handleOpenHistory,
    historySmartCleanup, historyRetentionPeriod, handleHistorySettingsChange
}) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <SectionTitle>{c.history.title}</SectionTitle>
                <button 
                    onClick={handleClearHistory}
                    className={`p-1 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1 ${
                        isConfirmingClear 
                        ? 'bg-red-500 text-white border-red-600' 
                        : 'bg-red-400/5 hover:bg-red-400/10 border border-red-500/10 text-red-400/50 hover:text-red-400'
                    }`}
                >
                    {isConfirmingClear ? <Check className="w-3 h-3" /> : <Trash className="w-3 h-3" />}
                    {isConfirmingClear ? (lang === 'ru' ? 'Уверен?' : 'Sure?') : c.history.clearAll}
                </button>
            </div>

            <button
                onClick={handleOpenHistory}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 hover:border-white/15 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white/60 transition-colors">
                        <History className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <div className="text-[13px] font-semibold text-white/90">{c.history.openHistory}</div>
                        <div className="text-[11px] text-white/30">{c.history.search}</div>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-all" />
            </button>

            <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <div className="text-[12px] font-semibold text-white/90">{c.history.smartCleanup}</div>
                        <div className="text-[11px] text-white/30">{c.history.smartCleanupDesc}</div>
                    </div>
                    <button
                        onClick={() => handleHistorySettingsChange(!historySmartCleanup, historyRetentionPeriod)}
                        className={`w-10 h-6 rounded-full transition-all relative ${historySmartCleanup ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${historySmartCleanup ? 'left-5' : 'left-1'}`} />
                    </button>
                </div>

                {historySmartCleanup && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <SectionTitle>{c.history.retention}</SectionTitle>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(c.history.periods).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => handleHistorySettingsChange(historySmartCleanup, key as string)}
                                    className={`py-1.5 rounded-lg border text-[10px] font-medium transition-all ${historyRetentionPeriod === key
                                        ? 'bg-white/10 border-white/20 text-white'
                                        : 'bg-white/3 border-white/8 text-white/40 hover:border-white/15'
                                        }`}
                                >
                                    {label as string}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
