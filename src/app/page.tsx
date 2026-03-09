"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { Copy, Send, Pencil, Settings2, X, Check, ChevronDown } from 'lucide-react';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { SettingsPanel } from '@/components/SettingsPanel';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { motion, AnimatePresence } from 'framer-motion';

// —————————————————————————————————————————————————————————————————————————————
// Window dimensions are now truly dynamic. Tauri's window size will 
// match the content size to prevent invisible blocking areas.
// —————————————————————————————————————————————————————————————————————————————
const SHADOW_PAD = 0; // Extra pixels removed to prevent CSS shadow clipping/phantom bounding boxes.

type Phase = 'idle' | 'recording' | 'processing' | 'result' | 'editing';

export default function Home() {
    const { transcriptText, setProcessing, setTranscript } = useStore();
    const [phase, setPhase] = useState<Phase>('idle');
    const [expanded, setExpanded] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<'deepgram' | 'whisper' | 'groq'>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [whisperLanguage, setWhisperLanguage] = useState<'auto' | 'ru' | 'en'>('ru');
    const [groqLanguage, setGroqLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [autoPaste, setAutoPaste] = useState(true);
    const [clearOnPaste, setClearOnPaste] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);


    // ── Dynamic Window Resizing ──────────────────────────────────────────────
    const resizeWindow = useCallback(async (w: number, h: number) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            // Add padding for shadows
            const actualW = w + SHADOW_PAD * 2;
            const actualH = h + SHADOW_PAD * 2;

            await win.setSize(new LogicalSize(actualW, actualH));

            // Recenter horizontally to prevent "crawling" to the left after resize
            if (h < 500) { // Only recenter for the main overlays, not settings
                const { primaryMonitor } = await import('@tauri-apps/api/window');
                const monitor = await primaryMonitor();
                if (monitor) {
                    const scale = monitor.scaleFactor;
                    const screenW = monitor.size.width / scale;
                    const x = (screenW - actualW) / 2;
                    const { PhysicalPosition } = await import('@tauri-apps/api/window');
                    await win.setPosition(new PhysicalPosition(x * scale, 28 * scale));
                }
            }
        } catch (err) { console.error('Resize error:', err); }
    }, []);

    useEffect(() => {
        let w = 64, h = 64;
        if (showSettings) {
            w = 440; h = 540;
        } else if (phase === 'recording' || phase === 'processing') {
            w = 440; h = 64;
        } else if (phase === 'result') {
            w = 440; h = expanded ? 240 : 112;
        } else if (phase === 'editing') {
            w = 440; h = 320;
        }
        resizeWindow(w, h);
    }, [phase, expanded, showSettings, resizeWindow]);

    // ── Auto-scroll partial transcript ───────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current && phase === 'recording') {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [transcriptText, phase]);

    // Load initial settings
    useEffect(() => {
        const load = async () => {
            try {
                const mode = await invoke<string>('get_stt_mode');
                if (mode) setSttMode(mode as 'deepgram' | 'whisper' | 'groq');

                const dg = await invoke<string>('get_deepgram_language');
                if (dg) setDgLanguage(dg as 'auto' | 'ru' | 'en');

                const whisper = await invoke<string>('get_whisper_language');
                if (whisper) setWhisperLanguage(whisper as 'auto' | 'ru' | 'en');

                const groq = await invoke<string>('get_groq_language');
                if (groq) setGroqLanguage(groq as 'auto' | 'ru' | 'en');

                const paste = await invoke<boolean>('get_auto_paste');
                setAutoPaste(paste);
            } catch (err) { console.error('Settings load error:', err); }
        };
        load();
    }, [showSettings]); // Reload when settings close to sync changes

    const toggleQuickLang = useCallback(async () => {
        const sequence: ('auto' | 'ru' | 'en')[] = ['auto', 'ru', 'en'];
        const currentLang = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
        const nextIdx = (sequence.indexOf(currentLang) + 1) % sequence.length;
        const nextLang = sequence[nextIdx];

        try {
            if (sttMode === 'deepgram') {
                setDgLanguage(nextLang);
                await invoke('set_deepgram_language', { lang: nextLang });
            } else if (sttMode === 'whisper') {
                setWhisperLanguage(nextLang);
                await invoke('set_whisper_language', { lang: nextLang });
            } else if (sttMode === 'groq') {
                setGroqLanguage(nextLang);
                await invoke('set_groq_language', { lang: nextLang });
            }
        } catch (err) { console.error('Failed to set lang:', err); }
    }, [sttMode, dgLanguage, whisperLanguage, groqLanguage]);

    const triggerStart = useCallback(() => {
        setTranscript('');
        setExpanded(false);
        invoke('start_recording').catch(err => {
            setTranscript(`Ошибка: ${String(err)}`);
            setPhase('result');
            setExpanded(true);
        });
    }, [setTranscript]);

    const triggerStop = useCallback(async () => {
        setProcessing(true);
        try {
            const text = await invoke<string>('stop_recording');
            if (text?.trim()) setTranscript(text.trim());
            setPhase('result');
        } catch (err) {
            setTranscript(`Ошибка: ${String(err)}`);
            setPhase('result');
            setExpanded(true);
        } finally {
            setProcessing(false);
        }
    }, [setTranscript, setProcessing]);

    // ── Listeners ────────────────────────────────────────────────────────────
    useEffect(() => {
        const unlistenShortcut = listen('shortcut-trigger', () => {
            setPhase(p => {
                if (p === 'idle' || p === 'result') {
                    setTimeout(() => triggerStart(), 0);
                    return 'recording';
                }
                if (p === 'recording') {
                    setTimeout(() => triggerStop(), 0);
                    return 'processing';
                }
                return p;
            });
        });

        const unlistenSettings = listen('open-settings', () => setShowSettings(true));


        const unlistenPartial = listen<string>('transcript-partial', (e) => {
            const text = e.payload?.trim();
            if (text) setTranscript(text);
        });

        // Deepgram final result (comes after stop)
        const unlistenDgFinal = listen<string>('deepgram-final', (e) => {
            const text = e.payload?.trim();
            if (text) {
                setTranscript(text);
                setPhase('result');
                setProcessing(false);
            }
        });

        // Deepgram error
        const unlistenDgError = listen<string>('deepgram-error', (e) => {
            setTranscript(`Ошибка Deepgram: ${e.payload}`);
            setPhase('result');
        });

        // Fallback notification
        const unlistenFallback = listen<string>('stt-fallback', (e) => {
            console.warn('STT Fallback:', e.payload);
        });

        const unlistenModeChanged = listen<string>('mode-changed', (e) => {
            const newMode = e.payload?.trim() as 'deepgram' | 'whisper' | 'groq';
            if (newMode) setSttMode(newMode);
        });

        return () => {
            unlistenShortcut.then(f => f());
            unlistenSettings.then(f => f());
            unlistenPartial.then(f => f());
            unlistenDgFinal.then(f => f());
            unlistenDgError.then(f => f());
            unlistenFallback.then(f => f());
            unlistenModeChanged.then(f => f());
        };
    }, [setTranscript, setProcessing, triggerStart, triggerStop]);

    // Toggle Always-On-Top when settings open/close
    useEffect(() => {
        if (window.__TAURI_INTERNALS__) {
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
                const appWindow = getCurrentWindow();
                appWindow.setAlwaysOnTop(!showSettings).catch(console.error);
            });
        }
    }, [showSettings]);

    const handleCopy = async () => {
        if (transcriptText) await writeText(transcriptText);
    };

    const handlePaste = async () => {
        if (!transcriptText) return;
        try {
            setProcessing(true);
            await invoke('paste_text', { text: transcriptText });
            if (clearOnPaste) setTranscript('');
            setPhase('idle');
        } catch (err) { console.error(err); }
        finally { setProcessing(false); }
    };

    const isRec = phase === 'recording';
    const isProc = phase === 'processing';
    const isIdle = phase === 'idle';

    // ── Animation Variants ──────────────────────────────────────────────────
    const containerVariants = {
        idle: { width: 64, height: 64, borderRadius: 32 },
        recording: { width: 440, height: 64, borderRadius: 32 },
        result: { width: 440, height: expanded ? 240 : 112, borderRadius: 28 },
        editing: { width: 440, height: 320, borderRadius: 28 }
    };

    return (
        <main className="fixed inset-0 flex flex-col items-center bg-transparent select-none font-sans antialiased overflow-hidden">
            <AnimatePresence mode="wait">
                {!showSettings ? (
                    <motion.div
                        key="main-pill"
                        ref={containerRef}
                        data-tauri-drag-region
                        initial="idle"
                        animate={phase === 'editing' ? 'editing' : (phase === 'result' ? 'result' : (isIdle ? 'idle' : 'recording'))}
                        variants={containerVariants}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-[#0D0D0D]/90 border border-white/10 overflow-hidden flex flex-col relative"
                        style={{ backdropFilter: 'blur(20px)' }}
                    >
                        {/* ── CONTENT AREA ── */}
                        <div data-tauri-drag-region className={`flex px-3 shrink-0 relative overflow-hidden ${phase === 'result' && !expanded ? 'items-start pt-3 pb-3' : 'items-center h-[64px]'}`}>

                            {/* LEFT: Mic Icon / IDLE Logo */}
                            <motion.div layout className="z-10 flex items-center">
                                <button
                                    onClick={() => {
                                        if (isIdle) { setPhase('recording'); triggerStart(); }
                                        else if (isRec) { setPhase('processing'); triggerStop(); }
                                        else if (phase === 'result') { setPhase('recording'); triggerStart(); }
                                    }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isRec ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110' : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    {isIdle ? (
                                        <span className="text-white/60 font-bold text-lg select-none">N</span>
                                    ) : isRec ? (
                                        <div className="w-3.5 h-3.5 bg-white rounded-sm" />
                                    ) : isProc ? (
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93A9.004 9.004 0 0 1 3.06 12H1a11 11 0 0 0 10 10.97V22h2v-.07A11 11 0 0 0 23 12h-2.06a9.004 9.004 0 0 1-7.94 7.93V16h-2v3.93z" />
                                        </svg>
                                    )}
                                </button>

                                {/* Quick Language Toggle */}
                                <button
                                    onClick={toggleQuickLang}
                                    className="ml-2 px-1.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col items-center justify-center min-w-[28px]"
                                >
                                    <span className="text-[9px] font-bold text-white/40 leading-tight uppercase">
                                        {(() => {
                                            const l = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
                                            return l === 'auto' ? 'Auto' : (l === 'ru' ? 'RU' : 'EN');
                                        })()}
                                    </span>
                                </button>

                                {/* Quick STT Mode Toggle */}
                                <button
                                    onClick={async () => {
                                        const nextMode =
                                            sttMode === 'deepgram' ? 'whisper' :
                                                sttMode === 'whisper' ? 'groq' : 'deepgram';
                                        setSttMode(nextMode);
                                        try {
                                            await invoke('set_stt_mode', { mode: nextMode });
                                        } catch (err) { console.error('Failed to set mode:', err); }
                                    }}
                                    className="ml-1 px-1.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col items-center justify-center min-w-[32px]"
                                >
                                    <span className="text-[9px] font-bold text-white/40 leading-tight uppercase">
                                        {sttMode === 'deepgram' ? 'CLOUD' : sttMode === 'whisper' ? 'OFFLINE' : 'GROQ'}
                                    </span>
                                </button>
                            </motion.div>

                            {/* CENTER: Text / Running Line */}
                            <motion.div layout data-tauri-drag-region className="flex-1 px-3 overflow-hidden relative cursor-default">
                                <AnimatePresence mode="wait">
                                    {isRec ? (
                                        <motion.div
                                            key="rec-line"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="flex flex-col gap-1"
                                        >
                                            <div ref={scrollRef} className="whitespace-nowrap overflow-hidden text-[13px] text-white/80 font-medium tracking-tight">
                                                {transcriptText || "Слушаю..."}
                                            </div>
                                            <WaveformVisualizer isActive />
                                        </motion.div>
                                    ) : phase === 'result' ? (
                                        <motion.div
                                            key="res-line"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className={`text-[13px] text-white/90 font-medium leading-[1.5] pr-1 custom-scrollbar overflow-y-auto ${expanded ? 'hidden' : 'max-h-[88px]'}`}
                                            onClick={() => setExpanded(!expanded)}
                                        >
                                            {transcriptText || <span className="text-white/20 italic">Текст не распознан</span>}
                                        </motion.div>
                                    ) : isProc ? (
                                        <div className="flex items-center gap-2 text-[13px] text-white/40 font-medium ml-1 animate-pulse">
                                            Обработка...
                                        </div>
                                    ) : null}
                                </AnimatePresence>
                            </motion.div>

                            {/* RIGHT: Actions / Settings */}
                            {!isIdle && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1"
                                >
                                    {phase === 'result' && !expanded ? (
                                        <>
                                            <ActionBtn onClick={handleCopy} icon={<Copy className="w-3.5 h-3.5" />} />
                                            <ActionBtn onClick={handlePaste} icon={<Send className="w-3.5 h-3.5 text-blue-400" />} />
                                            <ActionBtn onClick={() => setExpanded(true)} icon={<ChevronDown className="w-4 h-4" />} />
                                        </>
                                    ) : (phase === 'recording' || isProc) && (
                                        <ActionBtn onClick={() => setShowSettings(true)} icon={<Settings2 className="w-4 h-4" />} />
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* ── ADAPTIVE EXPANSION AREA ── */}
                        {(expanded || phase === 'editing') && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex-1 flex flex-col min-h-0 p-4 pt-1 bg-white/[0.03] border-t border-white/5"
                            >
                                {phase === 'editing' ? (
                                    <textarea
                                        autoFocus
                                        value={transcriptText}
                                        onChange={e => setTranscript(e.target.value)}
                                        className="flex-1 bg-transparent text-[15px] text-white/90 leading-relaxed resize-none focus:outline-none custom-scrollbar pr-2"
                                        spellCheck={false}
                                    />
                                ) : (
                                    <div className="flex-1 min-h-0 text-[15px] text-white/90 leading-relaxed overflow-y-auto custom-scrollbar pr-2 select-text">
                                        {transcriptText}
                                    </div>
                                )}

                                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                                    <div className="flex gap-1">
                                        <ActionBtn onClick={() => setPhase(p => p === 'editing' ? 'result' : 'editing')} icon={phase === 'editing' ? <Check className="w-4 h-4 text-emerald-400" /> : <Pencil className="w-3.5 h-3.5" />} label={phase === 'editing' ? "Готово" : "Ред."} />
                                        <ActionBtn onClick={handleCopy} icon={<Copy className="w-3.5 h-3.5" />} label="Копировать" />
                                        <ActionBtn onClick={() => { setTranscript(''); setPhase('idle'); }} icon={<X className="w-4 h-4 text-red-400" />} label="Очистить" />
                                    </div>
                                    <ActionBtn onClick={handlePaste} icon={<Send className="w-4 h-4 text-blue-400" />} label="Вставить и закрыть" />
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="settings-panel"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-[440px] h-[540px]"
                    >
                        <SettingsPanel
                            onClose={() => setShowSettings(false)}
                            autoPaste={autoPaste}
                            clearOnPaste={clearOnPaste}
                            onToggleAutoPaste={() => {
                                const next = !autoPaste;
                                setAutoPaste(next);
                                invoke('set_auto_paste', { enabled: next }).catch(console.error);
                            }}
                            onToggleClearOnPaste={() => setClearOnPaste(v => !v)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label?: string }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all duration-200 active:scale-95"
        >
            {icon}
            {label && <span className="text-[11px] font-medium tracking-wide">{label}</span>}
        </button>
    );
}
