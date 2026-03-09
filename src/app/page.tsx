"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { Copy, Send, Pencil, Settings2, X, Check, ChevronDown, GripVertical, Power } from 'lucide-react';
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
    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<'deepgram' | 'whisper' | 'groq'>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [whisperLanguage, setWhisperLanguage] = useState<'auto' | 'ru' | 'en'>('ru');
    const [groqLanguage, setGroqLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [autoPaste, setAutoPaste] = useState(true);
    const [clearOnPaste, setClearOnPaste] = useState(true);
    const [targetApp, setTargetApp] = useState<string>('');
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);


    // Track the last known idle position
    const lastIdlePos = useRef<{ x: number, y: number } | null>(null);

    // ── Dynamic Window Resizing ──────────────────────────────────────────────
    const resizeWindow = useCallback(async (w: number, h: number, currentPhase: string) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const { getCurrentWindow, LogicalSize, PhysicalPosition, primaryMonitor } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            const actualW = w + SHADOW_PAD * 2;
            const actualH = h + SHADOW_PAD * 2;

            const oldPos = await win.outerPosition();
            const oldSize = await win.outerSize();

            const monitor = await primaryMonitor();
            const scale = monitor ? monitor.scaleFactor : 2;
            const newPhysicalW = actualW * scale;

            // Track the absolute center of the idle widget.
            // Since the user can drag it, we update this center whenever we are in the idle phase.
            if (currentPhase === 'idle' && oldSize.width > 0) {
                lastIdlePos.current = {
                    x: oldPos.x + oldSize.width / 2,
                    y: oldPos.y + oldSize.height / 2
                };
            }

            let newX = oldPos.x;
            let newY = oldPos.y;

            let targetCenter_x = oldPos.x + oldSize.width / 2;
            let targetCenter_y = oldPos.y + oldSize.height / 2;

            // Anchor logic for all phases (including settings)
            if (lastIdlePos.current) {
                targetCenter_x = lastIdlePos.current.x;
                targetCenter_y = lastIdlePos.current.y;
            }

            newX = Math.round(targetCenter_x - newPhysicalW / 2);

            if (monitor) {
                const screenHeight = monitor.size.height;
                const isBottomHalf = targetCenter_y > screenHeight / 2;

                if (isBottomHalf) {
                    newY = Math.round(targetCenter_y + (oldSize.height / 2) - (actualH * scale));
                } else {
                    newY = Math.round(targetCenter_y - (oldSize.height / 2));
                }
            } else {
                newY = Math.round(targetCenter_y - (24 * scale));
            }

            if (monitor) {
                const screenWidth = monitor.size.width;
                const screenHeight = monitor.size.height;
                const pad = 10 * scale;
                if (newX < pad) newX = Math.max(pad, newX);
                if (newX + newPhysicalW > screenWidth - pad) newX = screenWidth - newPhysicalW - pad;

                // Vertical bounds check
                if (newY < pad) newY = Math.max(pad, newY);
                const physicalH = actualH * scale;
                if (newY + physicalH > screenHeight - pad) newY = screenHeight - physicalH - pad;
            }

            await win.setSize(new LogicalSize(actualW, actualH));

            if (oldSize.width > 0) {
                await win.setPosition(new PhysicalPosition(newX, newY));
            }
        } catch (err) { console.error('Resize error:', err); }
    }, []);

    // ── Window Move Listener ────────────────────────────────────────────────
    // This is the most robust way to track where the user drags the window.
    useEffect(() => {
        const setup = async () => {
            if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            const unlistenMove = await win.onMoved(async ({ payload: pos }) => {
                // If we aren't currently resizing or in settings, this is a clean user drag
                const size = await win.outerSize();
                // Check if it's the idle pill size (or close to it)
                if (size.width > 0) {
                    lastIdlePos.current = {
                        x: pos.x + size.width / 2,
                        y: pos.y + size.height / 2
                    };
                }
            });

            // Listen for position reset from Tray
            const unlistenReset = await listen('reset-position', () => {
                lastIdlePos.current = null;
                // Force a resize calculation
                setPhase(p => p);
            });

            return { unlistenMove, unlistenReset };
        };
        const cleanupPromise = setup();
        return () => {
            cleanupPromise.then(res => {
                if (res) {
                    if (res.unlistenMove) res.unlistenMove();
                    if (res.unlistenReset) res.unlistenReset();
                }
            });
        };
    }, []);

    useEffect(() => {
        let w = 48, h = 48;
        if (showSettings) {
            w = 440; h = 540;
        } else if (phase === 'recording' || phase === 'processing') {
            w = 260; h = 48;
        } else if (phase === 'result') {
            const textLen = transcriptText?.length || 0;
            const rows = Math.max(1, Math.ceil(textLen / 38));
            const calcH = 120 + (rows * 20);
            w = 380; h = Math.min(400, Math.max(120, calcH));
        } else if (phase === 'editing') {
            w = 440; h = 320;
        } else if (phase === 'idle') {
            w = 140; h = 48;
        }
        resizeWindow(w, h, showSettings ? 'settings' : phase);
    }, [phase, showSettings, transcriptText, resizeWindow]);

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

    // ── Context Awareness: Target App detection ─────────────────────────────
    useEffect(() => {
        if (phase === 'result' || phase === 'editing') {
            invoke<string>('get_target_app').then(name => {
                if (name && name !== 'Unknown') setTargetApp(name);
                else setTargetApp('');
            }).catch(console.error);
        } else if (phase === 'idle') {
            setTargetApp('');
        }
    }, [phase]);

    // ── Tray Localization sync ──────────────────────────────────────────────
    useEffect(() => {
        const lang = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
        const trayLang = lang === 'auto' ? (navigator.language.startsWith('ru') ? 'ru' : 'en') : lang;
        invoke('update_tray_lang', { lang: trayLang }).catch(console.error);
    }, [sttMode, dgLanguage, whisperLanguage, groqLanguage]);

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
        setShowSettings(false); // Auto-close settings when recording starts
        invoke('start_recording').catch(err => {
            setTranscript(`Ошибка: ${String(err)}`);
            setPhase('result');
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
        } finally {
            setProcessing(false);
        }
    }, [setTranscript, setProcessing]);

    // ── Listeners ────────────────────────────────────────────────────────────
    useEffect(() => {
        const unlistenShortcut = listen('shortcut-trigger', () => {
            setPhase(p => {
                if (p === 'idle' || p === 'result') {
                    setShowSettings(false); // Ensure settings close on shortcut too
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
        idle: { width: 140, height: 48, borderRadius: 24 },
        recording: { width: 260, height: 48, borderRadius: 24 },
        result: { width: 380, height: 'auto', borderRadius: 16 },
        editing: { width: 440, height: 320, borderRadius: 20 }
    };

    return (
        <main className="fixed inset-0 flex flex-col items-center justify-center bg-transparent select-none font-sans antialiased overflow-hidden">
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
                        <div
                            data-tauri-drag-region
                            className={`flex px-3 shrink-0 relative overflow-hidden transition-all duration-300 ${phase === 'idle'
                                ? 'items-center justify-center h-[48px] w-[140px] px-2 gap-2'
                                : 'items-center h-[48px]'
                                }`}
                        >
                            {/* LEFT: Mic Icon / IDLE Logo / Grip */}
                            <motion.div layout className={`z-10 flex items-center ${phase === 'idle' ? 'justify-center' : ''}`}>
                                {isIdle && (
                                    <div data-tauri-drag-region className="w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/10 rounded-full transition-colors mr-1">
                                        <GripVertical className="w-4 h-4 text-white/40 pointer-events-none" />
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (isIdle) { setPhase('recording'); triggerStart(); }
                                        else if (isRec) { setPhase('processing'); triggerStop(); }
                                        else if (phase === 'result') { setPhase('recording'); triggerStart(); }
                                    }}
                                    className={`rounded-full flex items-center justify-center transition-all duration-300 ${isIdle ? 'w-8 h-8' : 'w-[36px] h-[36px]'
                                        } ${isRec ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    {isIdle ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
                                        </svg>
                                    ) : isRec ? (
                                        <div className="w-[12px] h-[12px] bg-white rounded-[3px]" />
                                    ) : isProc ? (
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93A9.004 9.004 0 0 1 3.06 12H1a11 11 0 0 0 10 10.97V22h2v-.07A11 11 0 0 0 23 12h-2.06a9.004 9.004 0 0 1-7.94 7.93V16h-2v3.93z" />
                                        </svg>
                                    )}
                                </button>

                                {isIdle && (
                                    <>
                                        <button onClick={() => setShowSettings(true)} className="w-8 h-8 ml-1 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                                            <Settings2 className="w-4 h-4 text-white/50" />
                                        </button>
                                        <button onClick={() => invoke('plugin:process|exit', { code: 0 }).catch(() => window.close())} className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 rounded-full transition-colors group">
                                            <Power className="w-4 h-4 text-white/50 group-hover:text-red-400 transition-colors" />
                                        </button>
                                    </>
                                )}

                                {/* Quick Language Toggle (hidden when idle) */}
                                {!isIdle && (
                                    <>
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
                                    </>
                                )}
                            </motion.div>

                            {/* CENTER: Text / Running Line */}
                            {!isIdle && (
                                <motion.div layout data-tauri-drag-region className="flex-1 px-3 overflow-hidden relative cursor-default">
                                    <AnimatePresence mode="wait">
                                        {isRec ? (
                                            <motion.div
                                                key="rec-line"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className={`flex flex-col ${transcriptText ? 'gap-1' : 'justify-center h-full'}`}
                                            >
                                                {transcriptText && (
                                                    <div ref={scrollRef} className="whitespace-nowrap overflow-hidden text-[13px] text-white/80 font-medium tracking-tight">
                                                        {transcriptText}
                                                    </div>
                                                )}
                                                <WaveformVisualizer isActive />
                                            </motion.div>
                                        ) : isProc ? (
                                            <div className="flex-1 px-4">
                                                <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div
                                                        animate={{
                                                            x: ['-100%', '100%'],
                                                            opacity: [0.3, 0.7, 0.3]
                                                        }}
                                                        transition={{
                                                            duration: 1.5,
                                                            repeat: Infinity,
                                                            ease: "easeInOut"
                                                        }}
                                                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </AnimatePresence>
                                </motion.div>
                            )}

                            {/* RIGHT: Actions / Settings */}
                            {!isIdle && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1"
                                >
                                    {(phase === 'recording' || phase === 'result' || isProc) && (
                                        <ActionBtn onClick={() => setShowSettings(true)} icon={<Settings2 className="w-4 h-4" />} />
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* ── ADAPTIVE EXPANSION AREA ── */}
                        {(phase === 'result' || phase === 'editing') && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex-1 flex flex-col min-h-0 px-3 pb-3 gap-2"
                            >
                                <div className={`flex-1 min-h-0 rounded-xl border border-white/5 p-3 overflow-y-auto custom-scrollbar select-text ${phase === 'editing' ? 'bg-white/5' : ''}`}>
                                    {phase === 'editing' ? (
                                        <textarea
                                            autoFocus
                                            value={transcriptText}
                                            onChange={e => setTranscript(e.target.value)}
                                            className="w-full h-full bg-transparent text-[14px] text-white/95 leading-relaxed resize-none focus:outline-none custom-scrollbar"
                                            spellCheck={false}
                                        />
                                    ) : (
                                        <div className="text-[13px] text-white/80 leading-relaxed font-medium">
                                            {transcriptText || <span className="text-white/20 italic">Текст не распознан</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-2 h-8 px-1">
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            onClick={() => setPhase(p => p === 'editing' ? 'result' : 'editing')}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all"
                                            title={phase === 'editing' ? "Готово" : "Редактировать"}
                                        >
                                            {phase === 'editing' ? <Check size={14} className="text-emerald-400" /> : <Pencil size={14} />}
                                        </button>
                                        <button
                                            onClick={handleCopy}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all"
                                            title="Копировать"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setTranscript(''); setPhase('idle'); }}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                                            title="Очистить"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={handlePaste}
                                        disabled={!transcriptText}
                                        className={`h-8 px-4 flex items-center gap-1.5 rounded-lg font-semibold text-[12px] transition-all ${transcriptText
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                                            : 'bg-white/5 text-white/10 cursor-not-allowed opacity-50'
                                            }`}
                                    >
                                        <Send size={13} />
                                        <span>
                                            {(() => {
                                                const l = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
                                                const isEn = l === 'en';
                                                if (isEn) return targetApp ? `Paste to ${targetApp}` : 'Paste';
                                                return targetApp ? `Вставить в ${targetApp}` : 'Вставить';
                                            })()}
                                        </span>
                                    </button>
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
