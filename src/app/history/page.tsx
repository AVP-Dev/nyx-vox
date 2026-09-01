'use client';

import React, { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
    Search, Trash2, HardDrive, Cpu,
    Zap, Trash, Clock, X, Copy,
    ArrowLeft, History, AppWindow, Check, CheckCheck
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

interface HistoryCardProps {
    entry: HistoryEntry;
    isSelected: boolean;
    isConfirmingDelete: boolean;
    isCopied: boolean;
    onSelect: (entry: HistoryEntry) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onCopy: (text: string, id: string, e: React.MouseEvent) => void;
    formattedDate: string;
    unknownAppText: string;
}

const HistoryCard = React.memo(function HistoryCard({
    entry,
    isSelected,
    isConfirmingDelete,
    isCopied,
    onSelect,
    onDelete,
    onCopy,
    formattedDate,
    unknownAppText
}: HistoryCardProps) {
    const handleCardClick = () => {
        onSelect(entry);
    };

    const handleCopyClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onCopy(entry.final_text, entry.id, e);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(entry.id, e);
    };

    return (
        <div
            onClick={handleCardClick}
            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 group relative overflow-hidden active:scale-[0.99] ${
                isSelected
                    ? 'bg-orange-600/10 border-orange-500/50 shadow-lg shadow-orange-500/5'
                    : 'bg-white/3 border-subtle hover:border-strong hover:bg-surface'
            }`}
        >
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-subtle group-hover:border-strong transition-all">
                        {entry.engine === 'deepgram' ? <Zap size={14} className="text-amber-400" /> : 
                         entry.engine === 'whisper' ? <HardDrive size={14} className="text-sky-400" /> :
                         <Cpu size={14} className="text-emerald-400" />}
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-primary">{entry.engine}</div>
                        <div className="text-[9px] font-bold text-white/30 uppercase flex items-center gap-1">
                            <Clock size={10} /> {formattedDate}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-subtle text-[10px] font-black uppercase tracking-tight text-muted">
                    <AppWindow size={10} /> {entry.target_app || unknownAppText}
                </div>
            </div>
            <p className="text-[13px] font-bold text-white/70 line-clamp-2 leading-relaxed pr-16 group-hover:pr-20 transition-all">
                {entry.final_text}
            </p>

            {/* Action buttons */}
            <div className="absolute right-2 bottom-2 flex gap-1 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-150">
                <button 
                    onClick={handleCopyClick}
                    className={`p-1.5 rounded-lg border transition-all ${
                        isCopied
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-sm'
                            : 'bg-surface-hover border-subtle hover:bg-surface-hover text-muted hover:text-white'
                    }`}
                    title={isCopied ? 'Скопировано!' : 'Копировать'}
                >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button 
                    onClick={handleDeleteClick}
                    className={`p-1.5 rounded-lg border transition-all ${
                        isConfirmingDelete
                            ? 'bg-red-500 border-red-600 text-white'
                            : 'bg-red-500/10 border-red-500/10 hover:bg-red-500/20 text-red-500'
                    }`}
                >
                    {isConfirmingDelete ? <Check size={12} /> : <Trash size={12} />}
                </button>
            </div>
        </div>
    );
});

export default function HistoryPage() {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [isLoaded, setIsLoaded] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
    const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadHistory = useCallback(async () => {
        try {
            const history = await invoke<HistoryEntry[]>('get_history');
            setEntries([...history].reverse());
        } catch (e) {
            console.error('Failed to refresh history:', e);
        }
    }, []);

    useEffect(() => {
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
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        };
    }, [loadHistory]);

    const handleCloseWindow = useCallback(async () => {
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            getCurrentWindow().hide();
        }
    }, []);

    // Global keyboard shortcuts (Escape to close details or window)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (selectedEntry) {
                    setSelectedEntry(null);
                } else {
                    handleCloseWindow();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEntry, handleCloseWindow]);

    const C = CONTENT[language].history;

    const filteredEntries = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();
        if (!query) return entries;
        return entries.filter(e => 
            e.final_text.toLowerCase().includes(query) ||
            e.target_app.toLowerCase().includes(query) ||
            e.engine.toLowerCase().includes(query)
        );
    }, [entries, deferredSearchQuery]);

    const formatDate = useCallback((timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [language]);

    const handleCopy = useCallback((text: string, key: string) => {
        writeText(text).catch(console.error);
        setCopiedKey(key);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => {
            setCopiedKey(null);
        }, 1500);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (confirmingDeleteId !== id) {
            setConfirmingDeleteId(id);
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => setConfirmingDeleteId(null), 3000);
            return;
        }
        try {
            setEntries(prev => prev.filter(e => e.id !== id));
            setSelectedEntry(prev => (prev?.id === id ? null : prev));
            setConfirmingDeleteId(null);
            await invoke('delete_history_item', { id });
        } catch (e) {
            console.error('Delete failed:', e);
        }
    }, [confirmingDeleteId]);

    const handleClearAll = useCallback(async () => {
        if (!isConfirmingClearAll) {
            setIsConfirmingClearAll(true);
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => setIsConfirmingClearAll(false), 3000);
            return;
        }
        try {
            setEntries([]);
            setSelectedEntry(null);
            setIsConfirmingClearAll(false);
            await invoke('clear_history');
        } catch (e) {
            console.error('Clear failed:', e);
        }
    }, [isConfirmingClearAll]);

    const handleSelectEntry = useCallback((entry: HistoryEntry) => {
        setSelectedEntry(entry);
    }, []);

    const handleCardCopy = useCallback((text: string, id: string) => {
        handleCopy(text, `card-${id}`);
    }, [handleCopy]);

    const handleCardDelete = useCallback((id: string) => {
        handleDelete(id);
    }, [handleDelete]);

    if (!isLoaded) return <div className="bg-app-bg w-screen h-screen" />;

    const unknownAppText = CONTENT[language].ui.unknownApp;

    return (
        <div className="w-screen h-screen flex flex-col pointer-events-auto overflow-hidden border border-subtle rounded-[28px] relative bg-app-bg text-white select-none">
            {/* Header */}
            <div data-tauri-drag-region className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 z-50">
                <div className="flex items-center gap-3 pointer-events-none">
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
                            : 'bg-surface border-subtle text-muted hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20'
                        }`}
                        title={C.clearAll}
                    >
                        {isConfirmingClearAll ? <Check size={18} /> : <Trash2 size={18} />}
                        {isConfirmingClearAll && <span className="text-[11px] font-bold uppercase">{language === 'ru' ? 'Уверен?' : 'Sure?'}</span>}
                    </button>
                    <button
                        onClick={handleCloseWindow}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-surface hover:bg-surface-hover border border-subtle text-white/30 hover:text-white transition-all shadow-lg shrink-0"
                    >
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-6 pb-4 shrink-0">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-orange-500 transition-colors pointer-events-none" size={16} />
                    <input 
                        type="text"
                        placeholder={C.search}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 bg-surface border border-subtle rounded-2xl pl-12 pr-4 text-[13px] font-bold focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all placeholder:text-white/20 select-text"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0 relative">
                {/* List Side */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 space-y-3">
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 pointer-events-none">
                            <History size={48} strokeWidth={1} className="mb-4" />
                            <div className="text-[14px] font-bold uppercase tracking-widest">{C.noEntries}</div>
                        </div>
                    ) : (
                        filteredEntries.map((entry) => (
                            <HistoryCard
                                key={entry.id}
                                entry={entry}
                                isSelected={selectedEntry?.id === entry.id}
                                isConfirmingDelete={confirmingDeleteId === entry.id}
                                isCopied={copiedKey === `card-${entry.id}`}
                                onSelect={handleSelectEntry}
                                onDelete={handleCardDelete}
                                onCopy={handleCardCopy}
                                formattedDate={formatDate(entry.timestamp)}
                                unknownAppText={unknownAppText}
                            />
                        ))
                    )}
                </div>

                {/* Details Side (Slide-over Panel) */}
                <AnimatePresence>
                    {selectedEntry && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                            className="absolute inset-y-0 right-0 w-[440px] bg-panel border-l border-subtle shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-subtle flex items-center justify-between gap-2">
                                <button onClick={() => setSelectedEntry(null)} className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-muted hover:text-white transition-all">
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="text-center flex-1 min-w-0">
                                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20">{C.date}</div>
                                    <div className="text-[13px] font-bold truncate">{formatDate(selectedEntry.timestamp)}</div>
                                </div>
                                <div className="flex gap-2">
                                    {selectedEntry.raw_text && selectedEntry.raw_text !== selectedEntry.final_text && (
                                        <button
                                            onClick={() => handleCopy(selectedEntry.raw_text, 'detail-raw')}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-wider ${
                                                copiedKey === 'detail-raw'
                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-surface-hover border-strong text-muted hover:bg-surface-hover hover:text-white'
                                            }`}
                                            title="Copy raw text"
                                        >
                                            {copiedKey === 'detail-raw' ? <Check size={14} /> : <Copy size={14} />}
                                            <span>{copiedKey === 'detail-raw' ? (C.copiedRaw || 'Copied Raw!') : 'Raw'}</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleCopy(selectedEntry.final_text, 'detail-final')}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all font-black text-[11px] uppercase tracking-wider ${
                                            copiedKey === 'detail-final'
                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                                                : 'bg-orange-600/10 border-orange-500/20 text-orange-500 hover:bg-orange-600 hover:text-white'
                                        }`}
                                    >
                                        {copiedKey === 'detail-final' ? <CheckCheck size={14} /> : <Copy size={14} />}
                                        <span>{copiedKey === 'detail-final' ? (C.copied || 'Copied!') : C.copy}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 select-text">
                                {/* Metadata grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 rounded-2xl bg-white/3 border border-subtle">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">{C.engine}</div>
                                        <div className="flex items-center gap-2">
                                            {selectedEntry.engine === 'deepgram' ? <Zap size={14} className="text-amber-400" /> : 
                                             selectedEntry.engine === 'whisper' ? <HardDrive size={14} className="text-sky-400" /> :
                                             <Cpu size={14} className="text-emerald-400" />}
                                            <span className="text-[13px] font-black uppercase">{selectedEntry.engine}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/3 border border-subtle">
                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">{C.app}</div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <AppWindow size={14} className="text-muted shrink-0" />
                                            <span className="text-[13px] font-bold truncate opacity-80">{selectedEntry.target_app || unknownAppText}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Text content */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em] ml-1">{C.finalText}</div>
                                            {copiedKey === 'detail-final' && (
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                                    <Check size={12} /> {C.copied || 'Скопировано!'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-5 rounded-2xl bg-white/2 border border-subtle text-[15px] leading-relaxed font-bold text-white/90 selection:bg-orange-500/30">
                                            {selectedEntry.final_text}
                                        </div>
                                    </div>

                                    {selectedEntry.raw_text && selectedEntry.raw_text !== selectedEntry.final_text && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">{C.rawText}</div>
                                                {copiedKey === 'detail-raw' && (
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                                        <Check size={12} /> {C.copiedRaw || 'Исходник скопирован!'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-5 rounded-2xl bg-white/1 border border-subtle text-[13px] leading-relaxed font-bold text-muted italic selection:bg-orange-500/30">
                                                {selectedEntry.raw_text}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-subtle">
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
