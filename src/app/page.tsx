"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type Event } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { SettingsPanel } from '@/components/SettingsPanel';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Settings2, Mic, Check, Copy, Send, Pencil, X } from 'lucide-react';

type Phase = 'idle' | 'recording' | 'processing' | 'result' | 'editing';

export default function Home() {
    const { transcriptText, setProcessing, setTranscript } = useStore();
    const [phase, setPhase] = useState<Phase>('idle');
    const phaseRef = useRef<Phase>('idle');
    
    useEffect(() => { 
        phaseRef.current = phase; 
    }, [phase]);

    const isIdle = phase === 'idle';

    const cleanHallucinations = useCallback((t: string | undefined | null): string => {
        if (!t) return '';
        const text = t.trim();
        const lower = text.toLowerCase();
        const badPhrases = ['продолжение следует', 'спасибо за просмотр', 'подписывайтесь на канал', 'subtitles by', 'amara.org', 'субтитры', 'диктор', 'с вами был', 'а. кулаков', '[music]', '[silence]'];
        
        // Only clear if the text is short and contains a hallucination pattern
        if (text.length < 100) {
            for (const p of badPhrases) { 
                if (lower.includes(p)) return ''; 
            }
        }
        return text;
    }, []);

    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<'deepgram' | 'whisper' | 'groq'>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [whisperLanguage, setWhisperLanguage] = useState<'auto' | 'ru' | 'en'>('ru');
    const [groqLanguage, setGroqLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [appLanguage, setAppLanguageState] = useState<'ru' | 'en'>('ru');
    const [autoPaste, setAutoPaste] = useState(true);
    const [clearOnPaste, setClearOnPaste] = useState(false);
    const [startMinimized, setStartMinimized] = useState(false);
    const [targetApp, setTargetApp] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Track the last known idle position (Top-Center)
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    const checkUpdates = useCallback(async (appLang: string) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const current = 'v0.1.2-beta';
            const ignored = await invoke<string>('get_ignored_update').catch(() => '');
            const dismissedAt = await invoke<number>('get_update_dismissed_at').catch(() => 0);
            
            if (dismissedAt && Date.now() - dismissedAt < 2 * 60 * 60 * 1000) return;

            const response = await fetch('https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest');
            if (!response.ok) return;
            const data = await response.json();
            const latest = data.tag_name;
            
            if (latest && latest !== current && latest !== ignored) {
                const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                const label = `update-${latest.replace(/\./g, '-')}`;
                
                new WebviewWindow(label, {
                    url: `/update?version=${latest}&lang=${appLang}`,
                    title: 'NYX Vox Update',
                    width: 320,
                    height: 380,
                    resizable: false,
                    decorations: false,
                    transparent: true,
                    alwaysOnTop: true,
                    shadow: false,
                    center: true,
                    skipTaskbar: false,
                });
            }
        } catch (e) {
            console.error('[UpdateCheck] Error:', e);
        }
    }, []);

    const resizeWindow = useCallback(async (w: number, h: number) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const { getCurrentWindow, LogicalSize, PhysicalPosition, primaryMonitor } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            
            const oldPos = await win.outerPosition();
            const oldSize = await win.outerSize();
            const monitor = await primaryMonitor();
            const scale = monitor ? monitor.scaleFactor : 2;

            // Target dimensions in physical pixels
            const newPhysicalW = w * scale;

            // Anchor logic: TOP-CENTER
            // We want the horizontal center of the window to remain the same after resize.
            let targetCenter_x = oldPos.x + oldSize.width / 2;
            let targetTop_y = oldPos.y;

            // If we have a saved position (from dragging), use it.
            if (lastPos.current) {
                targetCenter_x = lastPos.current.x;
                targetTop_y = lastPos.current.y;
            }

            let newX = Math.round(targetCenter_x - newPhysicalW / 2);
            let newY = targetTop_y;

            // Clinging to top menu bar by default if y is near 0 or not set
            if (!lastPos.current || newY < 5) {
                newY = 0;
            }

            // Safety clamping to screen
            if (monitor) {
                const screenW = monitor.size.width;
                const screenH = monitor.size.height;
                const minX = 0;
                const maxX = screenW - newPhysicalW;
                
                if (newX < minX) newX = minX;
                if (newX > maxX) newX = maxX;
                
                // Keep it on screen vertically but prioritize top cling
                const maxY = screenH - (h * scale);
                if (newY > maxY) newY = maxY;
            }

            // Apply size first, then position
            await win.setSize(new LogicalSize(w, h));
            await win.setPosition(new PhysicalPosition(newX, newY));
            
        } catch (err) {
            console.error('Window management error:', err);
        }
    }, []);

    // Listen for window movement to update lastPos
    useEffect(() => {
        const setupMoveListener = async () => {
            if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            const unlistenMove = await listen('tauri://move', async () => {
                const pos = await win.outerPosition();
                const size = await win.outerSize();
                if (size.width > 0) {
                    lastPos.current = {
                        x: pos.x + size.width / 2,
                        y: pos.y
                    };
                }
            });

            const unlistenReset = await listen('reset-position', () => {
                lastPos.current = null;
                setPhase(p => p); // Trigger re-render to apply default position
            });

            return { unlistenMove, unlistenReset };
        };

        const cleanupPromise = setupMoveListener();
        return () => {
            cleanupPromise.then(res => {
                if (res) {
                    res.unlistenMove();
                    res.unlistenReset();
                }
            });
        };
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const w = (showSettings || showWelcome) ? 440 : (phase === 'editing' ? 440 : (phase === 'result' ? 380 : (isIdle ? 140 : 260)));
        
        // Dynamic height for result phase
        let h = 48;
        if (showSettings || showWelcome) h = 540;
        else if (phase === 'editing') h = 320;
        else if (phase === 'result') {
            const textLen = transcriptText?.length || 0;
            const rows = Math.max(1, Math.ceil(textLen / 38));
            const calcH = 120 + (rows * 20);
            h = Math.min(400, Math.max(140, calcH));
        }

        resizeWindow(w, h);
    }, [phase, isIdle, showSettings, showWelcome, isVisible, transcriptText, resizeWindow]);

    useEffect(() => {
        const load = async () => {
            try {
                const results = await Promise.all([
                    invoke<string>('get_stt_mode'),
                    invoke<'auto'|'ru'|'en'>('get_deepgram_language'),
                    invoke<'auto'|'ru'|'en'>('get_whisper_language'),
                    invoke<'auto'|'ru'|'en'>('get_groq_language'),
                    invoke<boolean>('get_auto_paste'),
                    invoke<boolean>('get_clear_on_paste'),
                    invoke<boolean>('get_start_minimized'),
                    invoke<boolean>('check_model_available')
                ]);

                setSttMode(results[0] as 'deepgram' | 'whisper' | 'groq');
                setDgLanguage(results[1]);
                setWhisperLanguage(results[2]);
                setGroqLanguage(results[3]);
                setAutoPaste(results[4]);
                setClearOnPaste(results[5]);
                setStartMinimized(results[6]);
                
                const savedAppLang = await invoke<'ru' | 'en'>('get_app_language').catch(() => 'ru' as const);
                setAppLanguageState(savedAppLang || 'ru');
                setTimeout(() => checkUpdates(savedAppLang || 'ru'), 5000);

                const seen = await invoke<boolean>('get_welcome_seen', { version: '0.1.2-beta' }).catch(() => true);
                if (!seen) setShowWelcome(true);

                setIsVisible(true);
            } catch (err) {
                console.error('Initial settings load error:', err);
                // Even if some settings fail to load, show the UI
                setIsVisible(true);
            }
        };
        load();
    }, [checkUpdates]);

    useEffect(() => {
        if (!showSettings) {
            invoke<string>('get_stt_mode').then(m => m && setSttMode(m as 'deepgram' | 'whisper' | 'groq'));
            invoke<'ru'|'en'>('get_app_language').then(l => l && setAppLanguageState(l));
        }
    }, [showSettings]);

    const updateTarget = useCallback(() => {
         if (phaseRef.current === 'result' || phaseRef.current === 'editing') {
            invoke<string>('get_target_app').then(name => {
                if (name && name !== 'Unknown') setTargetApp(name);
                else setTargetApp('');
            }).catch(console.error);
        } else if (phaseRef.current === 'idle') {
            setTargetApp('');
        }
    }, []);

    useEffect(() => {
        updateTarget();
    }, [phase, updateTarget]);

    useEffect(() => {
        const langCode = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
        const trayLang = langCode === 'auto' ? (appLanguage || 'en') : langCode;
        invoke('update_tray_lang', { lang: trayLang }).catch(console.error);
    }, [sttMode, dgLanguage, whisperLanguage, groqLanguage, appLanguage]);

    useEffect(() => {
        let unlisten: (() => void) | null = null;
        listen<string>('language-changed', (e) => setAppLanguageState(e.payload as 'ru' | 'en')).then(u => unlisten = u);
        return () => { if (unlisten) unlisten(); };
    }, []);

    const toggleQuickLang = useCallback(async () => {
        const sequence: ('auto' | 'ru' | 'en')[] = ['auto', 'ru', 'en'];
        const cur = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
        const next = sequence[(sequence.indexOf(cur) + 1) % sequence.length];
        
        try {
            if (sttMode === 'deepgram') {
                setDgLanguage(next);
                await invoke('set_deepgram_language', { lang: next });
            } else if (sttMode === 'whisper') {
                setWhisperLanguage(next);
                await invoke('set_whisper_language', { lang: next });
            } else if (sttMode === 'groq') {
                setGroqLanguage(next);
                await invoke('set_groq_language', { lang: next });
            }
        } catch (err) {
            console.error(err);
        }
    }, [sttMode, dgLanguage, whisperLanguage, groqLanguage]);

    const triggerStart = useCallback(() => {
        setTranscript('');
        setShowSettings(false);
        invoke('start_recording').catch(err => {
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        });
    }, [setTranscript]);

    const triggerStop = useCallback(async () => {
        setProcessing(true);
        try {
            const rawText = await invoke<string>('stop_recording');
            if (rawText) {
                setTranscript(cleanHallucinations(rawText));
            }
            setPhase('result');
        } catch (err) {
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        } finally {
            setProcessing(false);
        }
    }, [setTranscript, setProcessing, cleanHallucinations]);

    const handleLanguageToggle = useCallback(async () => {
        const next = appLanguage === 'ru' ? 'en' : 'ru';
        setAppLanguageState(next);
        await invoke('set_app_language', { lang: next });
    }, [appLanguage]);

    useEffect(() => {
        let isMounted = true;
        const unlisteners: (() => void)[] = [];

        const setup = async () => {
            const add = async <T,>(ev: string, cb: (e: Event<T>) => void) => {
                const u = await listen<T>(ev, cb);
                if (isMounted) unlisteners.push(u); else u();
            };

            await add<void>('shortcut-trigger', () => {
                setPhase(p => {
                    if (p === 'idle' || p === 'result') { 
                        setShowSettings(false); 
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

            await add<void>('open-settings', () => {
                setShowWelcome(false);
                setShowSettings(true);
            });

            await add<void>('open-welcome', () => {
                setShowSettings(false);
                setShowWelcome(true);
            });

            await add<void>('app-summon', () => updateTarget());

            await add<string>('transcript-partial', (e) => {
                const t = cleanHallucinations(e.payload);
                if (t) setTranscript(t);
            });

            await add<string>('deepgram-final', (e) => {
                const t = cleanHallucinations(e.payload);
                if (t) {
                    setTranscript(t);
                    setPhase('result');
                }
            });

            await add<string>('deepgram-error', (e) => {
                const err = String(e.payload);
                if (err.includes('401') || err.includes('Unauthorized')) {
                    const msg = (appLanguage === 'ru' ? 'Ошибка API ключа (401). Проверьте настройки.' : 'API Key Error (401). Check settings.');
                    setTranscript(msg);
                } else {
                    setTranscript(`Ошибка: ${err}`);
                }
                setPhase('result');
            });

            await add<string>('stt-fallback', (e) => {
                setTranscript(`[Fallback: ${e.payload}]`);
                setPhase('result');
            });

            await add<string>('mode-changed', (e) => {
                if (e.payload) setSttMode(e.payload as 'deepgram' | 'whisper' | 'groq');
            });
        };

        setup();
        return () => { 
            isMounted = false; 
            unlisteners.forEach(u => u()); 
        };
    }, [triggerStart, triggerStop, updateTarget, cleanHallucinations, setTranscript, appLanguage]);

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
        } catch (err) {
            console.error(err); 
            const msg = appLanguage === 'ru' ? 'Ошибка вставки' : 'Paste error';
            setTranscript(`[${msg}: ${err}]`);
        } finally {
            setProcessing(false);
        }
    };

    const isRec = phase === 'recording';
    const isProc = phase === 'processing';
    const lang = appLanguage || 'ru';

    const windowEntrance: Variants = {
        hidden: { opacity: 0, scale: 0.8, y: 100 },
        show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25, mass: 1 } },
        exit: { opacity: 0, scale: 0.9, y: 40, transition: { duration: 0.2, ease: "easeIn" } }
    };

    const containerVariants: Variants = {
        idle: { width: 140, height: 48, borderRadius: 24 },
        recording: { width: 260, height: 48, borderRadius: 24 },
        result: { width: 380, height: 'auto', borderRadius: 16 },
        editing: { width: 440, height: 320, borderRadius: 20 },
        overlay: { width: 440, height: 540, borderRadius: 28 }
    };

    return (
        <main className="w-screen h-screen flex flex-col items-center justify-center bg-transparent select-none font-sans antialiased overflow-hidden pointer-events-none z-[9999]">
            <AnimatePresence>
                {isVisible && (
                    <motion.div 
                        key="window-wrapper"
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        variants={windowEntrance}
                        className="pointer-events-auto flex items-center justify-center origin-top p-0 bg-transparent w-fit h-fit"
                    >
                        <motion.div 
                            ref={containerRef}
                            data-tauri-drag-region
                            initial="idle"
                            animate={showSettings || showWelcome ? 'overlay' : (phase === 'editing' ? 'editing' : (phase === 'result' ? 'result' : (isIdle ? 'idle' : 'recording')))}
                            variants={containerVariants}
                            transition={{ layout: { type: "spring", stiffness: 350, damping: 32 }, opacity: { duration: 0.15 } }}
                            className="bg-[#18181B] border border-white/10 overflow-hidden flex flex-col relative shadow-none"
                            style={{ backdropFilter: 'blur(32px) saturate(180%)' }}
                        >
                            <AnimatePresence mode="wait">
                                {showSettings ? (
                                    <motion.div key="settings-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <SettingsPanel 
                                            onClose={() => setShowSettings(false)} 
                                            autoPaste={autoPaste} 
                                            clearOnPaste={clearOnPaste} 
                                            startMinimized={startMinimized} 
                                            onToggleAutoPaste={() => { const n = !autoPaste; setAutoPaste(n); invoke('set_auto_paste', { enabled: n }); }} 
                                            onToggleClearOnPaste={() => { const n = !clearOnPaste; setClearOnPaste(n); invoke('set_clear_on_paste', { enabled: n }); }} 
                                            onToggleStartMinimized={() => { const n = !startMinimized; setStartMinimized(n); invoke('set_start_minimized', { minimized: n }); }} 
                                        />
                                    </motion.div>
                                ) : showWelcome ? (
                                    <motion.div key="welcome-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <WelcomeOverlay 
                                            onClose={() => setShowWelcome(false)} 
                                            appLanguage={appLanguage} 
                                            onLanguageToggle={handleLanguageToggle} 
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div key="main-pill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col">
                                        <div data-tauri-drag-region className="flex items-center h-12 px-2 shrink-0">
                                            <motion.div layout className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                                                <button 
                                                    onClick={isIdle ? triggerStart : triggerStop} 
                                                    className={`rounded-full flex items-center justify-center transition-all duration-300 w-8 h-8 ${isRec ? 'bg-red-500 shadow-none' : 'bg-white/5 hover:bg-white/10'}`}
                                                >
                                                    {isIdle ? <Mic size={16} className="text-white/50" /> : isRec ? <div className="w-[10px] h-[10px] bg-white rounded-[2px]" /> : isProc ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Mic size={16} className="text-white/50" />}
                                                </button>
                                                
                                                {isIdle && (
                                                    <button 
                                                        onClick={() => setShowSettings(true)} 
                                                        className="w-8 h-8 ml-1 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                                                    >
                                                        <Settings2 className="w-4 h-4 text-white/50" />
                                                    </button>
                                                )}

                                                {!isIdle && (
                                                    <>
                                                        <button 
                                                            onClick={toggleQuickLang} 
                                                            className="ml-2 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex items-center justify-center min-w-[32px]"
                                                        >
                                                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-tight">
                                                                {(() => { 
                                                                    const cur = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage); 
                                                                    return cur === 'auto' ? 'Auto' : (cur === 'ru' ? 'RU' : 'EN'); 
                                                                })()}
                                                            </span>
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={async () => { 
                                                                const next = sttMode === 'deepgram' ? 'whisper' : sttMode === 'whisper' ? 'groq' : 'deepgram'; 
                                                                setSttMode(next); 
                                                                invoke('set_stt_mode', { mode: next }).catch(console.error); 
                                                            }} 
                                                            className="ml-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex items-center justify-center min-w-[40px]"
                                                        >
                                                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-tight">
                                                                {sttMode === 'deepgram' ? (lang === 'ru' ? 'ОБЛАКО' : 'CLOUD') : sttMode === 'whisper' ? (lang === 'ru' ? 'ОФФЛАЙН' : 'OFFLINE') : 'GROQ'}
                                                            </span>
                                                        </button>
                                                    </>
                                                )}
                                            </motion.div>
                                            
                                            {isIdle && (
                                                <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-end pr-1 opacity-40 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                                                    <div data-tauri-drag-region className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative pointer-events-none">
                                                        <span className="text-[12px] font-black text-white/40 tracking-tighter">NV</span>
                                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-600/60 blur-[1px]" />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {!isIdle && (
                                                <motion.div layout data-tauri-drag-region className="flex-1 px-3 overflow-hidden relative cursor-default">
                                                    <AnimatePresence mode="wait">
                                                        {isRec ? (
                                                            <motion.div 
                                                                key="rec-feedback" 
                                                                initial={{ opacity: 0, x: 20 }} 
                                                                animate={{ opacity: 1, x: 0 }} 
                                                                exit={{ opacity: 0, x: -20 }} 
                                                                className="flex flex-col justify-center h-full gap-1"
                                                            >
                                                                {transcriptText && (
                                                                    <div ref={scrollRef} className="whitespace-nowrap overflow-hidden text-[13px] text-white/80 font-medium tracking-tight">
                                                                        {transcriptText}
                                                                    </div>
                                                                )}
                                                                <WaveformVisualizer isActive />
                                                            </motion.div>
                                                        ) : isProc ? (
                                                            <div key="proc-loader" className="flex-1 px-4 flex items-center">
                                                                <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <motion.div 
                                                                        animate={{ x: ['-100%', '100%'] }} 
                                                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} 
                                                                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </AnimatePresence>
                                                </motion.div>
                                            )}
                                            
                                            {!isIdle && (phase === 'recording' || phase === 'result' || isProc) && (
                                                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1">
                                                    <ActionBtn onClick={() => setShowSettings(true)} icon={<Settings2 className="w-4 h-4" />} />
                                                </motion.div>
                                            )}
                                        </div>
                                        
                                        {(phase === 'result' || phase === 'editing') && (
                                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col min-h-0 px-3 pb-3 gap-2">
                                                <div className={`flex-1 min-h-[60px] rounded-xl border border-white/5 p-3 overflow-y-auto custom-scrollbar select-text ${phase === 'editing' ? 'bg-white/5' : ''}`}>
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
                                                            {transcriptText || <span className="text-white/20 italic">{lang === 'ru' ? 'Текст не распознан' : 'No text detected'}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center justify-between gap-2 h-8 px-1">
                                                    <div className="flex items-center gap-0.5 relative group/target">
                                                        <button 
                                                            onClick={() => setPhase(p => p === 'editing' ? 'result' : 'editing')} 
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all"
                                                        >
                                                            {phase === 'editing' ? <Check size={14} className="text-emerald-400" /> : <Pencil size={14} />}
                                                        </button>
                                                        <button onClick={handleCopy} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
                                                            <Copy size={14} />
                                                        </button>
                                                        <button onClick={() => { setTranscript(''); setPhase('idle'); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all">
                                                            <X size={15} />
                                                        </button>
                                                        {targetApp && (
                                                            <div className="flex items-center gap-1.5 ml-2 mr-1 px-2 py-1 rounded bg-white/5 border border-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest whitespace-nowrap overflow-hidden max-w-[120px]">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                                                <span className="truncate">{targetApp}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={handlePaste} 
                                                        disabled={!transcriptText} 
                                                        className={`h-8 px-4 flex items-center gap-1.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${transcriptText ? 'bg-[#F97316] hover:bg-orange-500 text-white active:scale-95 shadow-[0_4px_12px_rgba(249,115,22,0.3)]' : 'bg-white/5 text-white/10 opacity-50'}`}
                                                    >
                                                        <Send size={12} strokeWidth={3} />
                                                        <span>{lang === 'en' ? 'Paste' : 'Вставить'}</span>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label?: string }) {
    return (
        <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all duration-200 active:scale-95">
            {icon}
            {label && <span className="text-[11px] font-medium tracking-wide">{label}</span>}
        </button>
    );
}
