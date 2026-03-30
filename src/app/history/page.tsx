'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
    Search, Trash2, HardDrive, Cpu,
    Zap, Trash, Clock, X, Copy,
    ArrowLeft, History, AppWindow, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CONTENT } from '@/components/SettingsPanel';

interface HistoryEntry {
    id: string;
    timestamp: number;
    final_text: string;
    raw_text: string;
    engine: string;
    target_app: string;
}

export default function HistoryPage() {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [isLoaded, setIsLoaded] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const history = await invoke<HistoryEntry[]>('get_history');
                setEntries(history.reverse());
            } catch (e) {
                console.error('Failed to refresh history:', e);
            }
        };

        const init = async () => {
            try {
                const savedLang = await invoke<'ru' | 'en'>('get_app_language');
                setLanguage(savedLang);
                await loadHistory();
                setIsLoaded(true);
            } catch (e) {
                console.error('Failed to load history:', e);
                setIsLoaded(true);
            }
        };
        init();

        let unlisten: (() => void) | null = null;
        const setupListener = async () => {
            unlisten = await listen('history-updated', () => {
                loadHistory();
            });
        };
        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    const C = CONTENT[language].history;

    const filteredEntries = useMemo(() => {
        return entries.filter(e => 
            e.final_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.target_app.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.engine.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [entries, searchQuery]);

    const handleDelete = async (id: string) => {
        if (confirmingDeleteId !== id) {
            setConfirmingDeleteId(id);
            setTimeout(() => setConfirmingDeleteId(null), 3000);
            return;
        }
        try {
            await invoke('delete_history_item', { id });
            setEntries(prev => prev.filter(e => e.id !== id));
            if (selectedEntry?.id === id) setSelectedEntry(null);
            setConfirmingDeleteId(null);
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    const handleClearAll = async () => {
        if (!isConfirmingClearAll) {
            setIsConfirmingClearAll(true);
            setTimeout(() => setIsConfirmingClearAll(false), 3000);
            return;
        }
        try {
            await invoke('clear_history');
            setEntries([]);
            setSelectedEntry(null);
            setIsConfirmingClearAll(false);
        } catch (e) {
            console.error('Clear failed:', e);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCopy = (text: string) => {
        writeText(text).catch(console.error);
    };

    const handleCloseWindow = async () => {
        if (window.__TAURI_INTERNALS__) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            getCurrentWindow().close();
        }
    };

    if (!isLoaded) return <div className="bg-[#121214] w-screen h-screen" />;

    return (
        <div className="w-screen h-screen flex flex-col pointer-events-auto overflow-hidden border border-white/10 rounded-[28px] relative bg-[#121214] text-white">
            {/* Header */}
            <div data-tauri-drag-region className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-600/20 flex items-center justify-center">
                        <History className="text-orange-500" size={20} />
                    </div>
                    <div>
                        <h1 className="text-[18px] font-black uppercase italic tracking-wider">{C.title}</h1>
                        <div className="text-[10px] text-white/30 font-bold tracking-[0.2em] uppercase">{C.entriesCount(entries.length)}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleClearAll}
                        className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center gap-2 ${
                            isConfirmingClearAll 
                            ? 'bg-red-500 border-red-600 text-white' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20'
                        }`}
                        title={C.clearAll}
                    >
                        {isConfirmingClearAll ? <Check size={18} /> : <Trash2 size={18} />}
                        {isConfirmingClearAll && <span className="text-[11px] font-bold uppercase">{language === 'ru' ? 'Уверен?' : 'Sure?'}</span>}
                    </button>
                    <button
                        onClick={handleCloseWindow}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white transition-all shadow-lg shrink-0"
                    >
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-6 pb-4 shrink-0">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-orange-500 transition-colors" size={16} />
                    <input 
                        type="text"
                        placeholder={C.search}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-[13px] font-bold focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all placeholder:text-white/20"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* List Side */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 space-y-3">
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                            <History size={48} strokeWidth={1} className="mb-4" />
                            <div className="text-[14px] font-bold uppercase tracking-widest">{C.noEntries}</div>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {filteredEntries.map((entry) => (
                                <motion.div
                                    key={entry.id as string}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={() => setSelectedEntry(entry)}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all group relative overflow-hidden ${
                                        selectedEntry?.id === entry.id
                                            ? 'bg-orange-600/10 border-orange-500/50'
                                            : 'bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all">
                                                {entry.engine === 'deepgram' ? <Zap size={14} className="text-amber-400" /> : 
                                                 entry.engine === 'whisper' ? <HardDrive size={14} className="text-sky-400" /> :
                                                 <Cpu size={14} className="text-emerald-400" />}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black uppercase tracking-wider text-white/80">{entry.engine}</div>
                                                <div className="text-[9px] font-bold text-white/30 uppercase flex items-center gap-1">
                                                    <Clock size={10} /> {formatDate(entry.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-tight text-white/40">
                                            <AppWindow size={10} /> {entry.target_app || CONTENT[language].ui.unknownApp}
                                        </div>
                                    </div>
                                    <p className="text-[13px] font-bold text-white/70 line-clamp-2 leading-relaxed pr-16 group-hover:pr-20 transition-all">
                                        {entry.final_text}
                                    </p>

                                    {/* Action tags on hover */}
                                    <div className="absolute right-2 bottom-2 flex gap-1 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleCopy(entry.final_text); }}
                                            className="p-1.5 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20 text-white/60 hover:text-white"
                                        >
                                            <Copy size={12} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                            className={`p-1.5 rounded-lg border transition-all ${
                                                confirmingDeleteId === entry.id
                                                ? 'bg-red-500 border-red-600 text-white'
                                                : 'bg-red-500/10 border-red-500/10 hover:bg-red-500/20 text-red-500'
                                            }`}
                                        >
                                            {confirmingDeleteId === entry.id ? <Check size={12} /> : <Trash size={12} />}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Details Side (Slide-over or Panel) */}
                <AnimatePresence>
                    {selectedEntry && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute inset-y-0 right-0 w-[420px] bg-[#1a1a1e] border-l border-white/10 shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between gap-2">
                                <button onClick={() => setSelectedEntry(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="text-center flex-1">
                                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20">{C.date}</div>
                                    <div className="text-[14px] font-bold">{formatDate(selectedEntry.timestamp)}</div>
                                </div>
                                <div className="flex gap-2">
                                    {selectedEntry.raw_text && selectedEntry.raw_text !== selectedEntry.final_text && (
                                        <button
                                            onClick={() => handleCopy(selectedEntry.raw_text)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/60 hover:bg-white/20 hover:text-white transition-all font-black text-[10px] uppercase tracking-wider"
                                            title="Copy raw text"
                                        >
                                            <Copy size={14} /> Raw
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleCopy(selectedEntry.final_text)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-500 hover:bg-orange-600 hover:text-white transition-all font-black text-[11px] uppercase tracking-wider"
                                    >
                                        <Copy size={14} /> {C.copy}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                {/* Metadata grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">{C.engine}</div>
                                        <div className="flex items-center gap-2">
                                            <Zap size={14} className="text-amber-400" />
                                            <span className="text-[13px] font-black uppercase">{selectedEntry.engine}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">{C.app}</div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <AppWindow size={14} className="text-white/40 shrink-0" />
                                            <span className="text-[13px] font-bold truncate opacity-80">{selectedEntry.target_app || CONTENT[language].ui.unknownApp}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Text content */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] ml-1">{C.finalText}</div>
                                        <div className="p-5 rounded-2xl bg-white/2 border border-white/5 text-[15px] leading-relaxed font-bold text-white/90 selection:bg-orange-500/30">
                                            {selectedEntry.final_text}
                                        </div>
                                    </div>

                                    {selectedEntry.raw_text && selectedEntry.raw_text !== selectedEntry.final_text && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">{C.rawText}</div>
                                            <div className="p-5 rounded-2xl bg-white/1 border border-white/5 text-[13px] leading-relaxed font-bold text-white/40 italic">
                                                {selectedEntry.raw_text}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5">
                                <button 
                                    onClick={() => handleDelete(selectedEntry.id)}
                                    className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl bg-red-500/5 hover:bg-red-500 border border-red-500/20 text-red-500 hover:text-white transition-all font-black text-[11px] uppercase tracking-[0.2em]"
                                >
                                    <Trash2 size={16} /> {CONTENT[language].ui.reset}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
