"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '@/store/useStore';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { SettingsPanel, CONTENT, APP_VERSION } from '@/components/SettingsPanel';

interface TranslationDict {
    ui: Record<string, string>;
    settings: Record<string, any>;
    history: Record<string, string>;
    about: Record<string, string>;
    guide: Record<string, any>;
    welcome: Record<string, any>;
    perms: Record<string, any>;
    quarantine: Record<string, any>;
    update: Record<string, string>;
}

const C = CONTENT as unknown as Record<string, TranslationDict>;
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Settings2, Mic, Check, Copy, Send, Pencil, X, Zap, History } from 'lucide-react';

type Phase = 'idle' | 'recording' | 'processing' | 'result' | 'editing';

type FormattingMode = 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq';

interface QuickMenuProps {
    isOpen: boolean;
    formattingMode: FormattingMode;
    lastActiveFormatting: Exclude<FormattingMode, 'none'>;
    lang: string;
    sttMode: string;
    onToggleFormatting: (mode: FormattingMode) => void;
    onToggleSTTMode: () => void;
    onOpenSettings: () => void;
    onClose: () => void;
}

const QuickMenu = ({ 
    isOpen, 
    formattingMode, 
    lastActiveFormatting, 
    lang, 
    sttMode,
    onToggleFormatting,
    onToggleSTTMode,
    onOpenSettings,
    onClose
}: QuickMenuProps) => {
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
};

export default function Home() {
    const { transcriptText, setProcessing, setTranscript } = useStore();
    const [aiStatus, setAiStatus] = useState<string>('');
    const [phase, setPhase] = useState<Phase>('idle');
    const isRec = phase === 'recording';
    const isProc = phase === 'processing';
    const phaseRef = useRef<Phase>('idle');
    const lastTriggerTime = useRef<number>(0);
    
    useEffect(() => { 
        phaseRef.current = phase; 
    }, [phase]);

    const isIdle = phase === 'idle';

    const cleanHallucinations = useCallback((t: string | undefined | null): string => {
        if (!t) {
            console.log('>>> [CLEAN] Input is empty, returning empty');
            return '';
        }
        let text = t.trim();
        console.log('>>> [CLEAN] Input text:', text.substring(0, 50));
        
        // Capitalize first letter
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        
        // Remove common Whisper hallucinations and junk phrases
        const junkPhrases = [
            // Music/sound markers
            '[music]', '[silence]', '[noise]',
            '♪', '♫', '♬', '♭', '♮',
            '(музыка)', '(тишина)', '(шум)', '(аплодисменты)',
            '(Music)', '(Silence)', '(Laughter)', '(Applause)',
            
            // Subtitle credits
            'subtitles by', 'transcribed by', 'copyright', 'subtitles',
            'редактор субтитров', 'субтитры', 'перевод', 'translated by', 'translation',
            'автор субтитров', 'специально для', 'благодарим за',
            
            // Common hallucinations
            'DimaTorzok', 'Dima Torzok', 'Hoje pursui', 'pursui', 'uvoir',
            'продолжение следует', 'to be continued', 'continued',
            'amara.org', 'amara', 'www.', 'http', '.com', '.ru', 'https://',
            
            // YouTube/video endings
            'подпишитесь на канал', 'спасибо за просмотр', 'с вами был',
            'диктор', 'диктовка', 'диктовка.', 'в выпуске', 'следующий выпуск',
            'смотрите далее', 'реклама', 'спонсор', 'партнёр', 'sponsor',
            
            // Technical markers
            'end of transcript', 'transcript end', 'конец записи',
            'тишина', 'пауза', 'pause', 'silence',
            'неразборчиво', 'не разборчиво', 'inaudible', 'unclear',
            'аплодисменты', 'смех', 'laughter', 'applause',
            'music fades', 'music plays', 'играет музыка',
            
            // Random junk
            'игорь негода', 'игорь не года', 'а. кулаков', 'а. кулакова', 'кулакова'
        ];
        
        const lowerText = text.toLowerCase();
        let foundJunk = false;
        for (const phrase of junkPhrases) {
            const lowerPhrase = phrase.toLowerCase();
            if (lowerText.includes(lowerPhrase)) {
                foundJunk = true;
                console.log('>>> [CLEAN] Found junk phrase:', phrase);
                text = text.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
            }
        }
        if (foundJunk) {
            console.log('>>> [CLEAN] Text after junk removal:', text.substring(0, 50));
        }
        
        // Clean up multiple spaces and trim
        text = text.replace(/\s+/g, ' ').trim();
        
        // Remove trailing incomplete sentences (common Whisper artifact)
        const trailingJunk = ['...', '—', '–', '…'];
        for (const junk of trailingJunk) {
            if (text.endsWith(junk)) {
                text = text.slice(0, text.lastIndexOf(junk)).trim();
            }
        }
        
        // If text is too short (less than 2 characters), return empty
        // DON'T check for punctuation-only as regex breaks with Cyrillic
        if (text.length < 2) {
            console.log('>>> [CLEAN] Text too short (< 2 chars), returning empty');
            return '';
        }
        
        console.log('>>> [CLEAN] Final cleaned text:', text.substring(0, 50));
        return text;
    }, []);

    const [showSettings, setShowSettings] = useState(false);
    const [sttMode, setSttMode] = useState<'deepgram' | 'whisper' | 'groq' | 'gemini'>('deepgram');
    const [dgLanguage, setDgLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [whisperLanguage, setWhisperLanguage] = useState<'auto' | 'ru' | 'en'>('ru');
    const [groqLanguage, setGroqLanguage] = useState<'auto' | 'ru' | 'en'>('auto');
    const [appLanguage, setAppLanguageState] = useState<'ru' | 'en'>('ru');
    const [autoPaste, setAutoPaste] = useState(true);
    const [clearOnPaste, setClearOnPaste] = useState(false);
    const [startMinimized, setStartMinimized] = useState(false);
    const [alwaysOnTop, setAlwaysOnTop] = useState(true);
    const [autoPauseMedia, setAutoPauseMedia] = useState(false);
    const [targetApp, setTargetApp] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [formattingStatus, setFormattingStatus] = useState<string | null>(null);
    const [formattingStyle, setFormattingStyle] = useState<'casual' | 'professional'>('casual');

    // Helper visibility states
    const isOverlay = showSettings || showWelcome;
    const isCompact = (phase === 'recording' || phase === 'processing') || (autoPaste && phase === 'result');
    
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [formattingMode, setFormattingMode] = useState<FormattingMode>('none'); // По умолчанию ВЫКЛЮЧЕНО!
    const [lastActiveFormatting, setLastActiveFormatting] = useState<Exclude<FormattingMode, 'none'>>('gemini');

    // Quick alias for translation logic
    const lang = appLanguage;
    
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Track the last known idle position (Top-Center)
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    const checkUpdates = useCallback(async (appLang: string) => {
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
        try {
            const current = `v${APP_VERSION}`;
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
            const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();

            // Only center if we haven't been dragged yet
            if (!lastPos.current) {
                await invoke('resize_window', { width: w, height: h, center: true });
            } else {
                const scale = await win.scaleFactor();
                // lastPos is physical, convert center point to logical
                const logCenterX = lastPos.current.x / scale;
                const logTopY = lastPos.current.y / scale;

                const newX = logCenterX - (w / 2);

                // Set size and then adjust position to keep it centered around lastPos.x
                await win.setSize(new LogicalSize(w, h));
                await win.setPosition(new LogicalPosition(newX, logTopY));
            }

            // Always on top during recording/processing/result, otherwise use user setting
            const shouldBeOnTop = (phase === 'recording' || phase === 'processing' || phase === 'result') ? true : alwaysOnTop;
            await win.setAlwaysOnTop(shouldBeOnTop);
        } catch (err) {
            console.error('Window management error:', err);
        }
    }, [alwaysOnTop, phase]);

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
        
        // Sizing logic
        let w = 260;
        let h = 48;

        if (showSettings) {
            w = 620;
            h = 680;
        } else if (showWelcome) {
            w = 580;
            h = 560;
        } else if (isOverlay) {
            w = 440;
            h = 540;
        } else if (showQuickMenu && isIdle) {
            w = 200;
            h = 230;
        } else if (phase === 'editing') {
            w = 400; // Unified with Result
            h = 360;
        } else if (phase === 'result' && !isCompact) {
            w = 400;
            const textLen = transcriptText?.length || 0;
            const rows = Math.max(1, Math.ceil(textLen / 36));
            const calcH = 160 + (rows * 20); 
            h = Math.min(500, Math.max(160, calcH));
        } else if (isIdle) {
            w = 150;
        }

        resizeWindow(w, h);
    }, [phase, isIdle, isOverlay, isCompact, isVisible, transcriptText, showQuickMenu, resizeWindow, showSettings, showWelcome]);

    useEffect(() => {
        const load = async () => {
            try {
                // 1. Check welcome first as it's critical for the initial screen state
                const seen = await invoke<boolean>('get_welcome_seen', { version: APP_VERSION }).catch(() => true);
                if (!seen) setShowWelcome(true);
                
                // 2. Show the window content immediately so there is no blank delay
                setIsVisible(true);

                // 3. Load the rest of settings in background
                const results = await Promise.all([
                    invoke<string>('get_stt_mode'),
                    invoke<'auto'|'ru'|'en'>('get_deepgram_language'),
                    invoke<'auto'|'ru'|'en'>('get_whisper_language'),
                    invoke<'auto'|'ru'|'en'>('get_groq_language'),
                    invoke<boolean>('get_auto_paste'),
                    invoke<boolean>('get_clear_on_paste'),
                    invoke<boolean>('get_start_minimized'),
                    invoke<boolean>('check_model_available'),
                    invoke<boolean>('get_always_on_top'),
                    invoke<string>('get_formatting_mode').catch(() => 'none'),
                    invoke<string>('get_formatting_style').catch(() => 'casual'),
                    invoke<boolean>('get_auto_pause').catch(() => false)
                ]);

                setSttMode(results[0] as 'deepgram' | 'whisper' | 'groq' | 'gemini');
                setDgLanguage(results[1]);
                setWhisperLanguage(results[2]);
                setGroqLanguage(results[3]);
                setAutoPaste(results[4]);
                setClearOnPaste(results[5]);
                setStartMinimized(results[6]);
                setAlwaysOnTop(results[8] ?? true);

                const fMode = results[9] as FormattingMode;
                setFormattingMode(fMode || 'none');
                if (fMode && fMode !== 'none') setLastActiveFormatting(fMode);

                const fStyle = results[10] as 'casual' | 'professional';
                setFormattingStyle(fStyle || 'casual');

                setAutoPauseMedia(results[11] ?? false);
                
                const savedAppLang = await invoke<'ru' | 'en'>('get_app_language').catch(() => 'ru' as const);
                setAppLanguageState(savedAppLang || 'ru');
                setTimeout(() => checkUpdates(savedAppLang || 'ru'), 5000);
            } catch (err) {
                console.error('Initial settings load error:', err);
                setIsVisible(true);
            }
        };
        load();
        
        // Self-diagnosis on start
        invoke('run_self_diagnosis').then(res => {
            console.log('🛡️ NYX Vox Self-Diagnosis:', res);
        }).catch(err => console.error('🚫 Diagnosis failed:', err));
    }, [checkUpdates]);

// Deleted redundant useEffect for reloading settings as it is now handled via shared props

    const updateTarget = useCallback(async (currentPhase: Phase) => {
         if (currentPhase === 'result' || currentPhase === 'editing') {
            // First, ask backend to recapture the frontmost app IF we just finished
            if (currentPhase === 'result') {
                await invoke('update_target_app').catch(console.error);
            }
            invoke<string>('get_target_app').then(name => {
                if (name && name !== 'Unknown') setTargetApp(name);
                else setTargetApp('');
            }).catch(console.error);
        } else if (currentPhase === 'idle') {
            setTargetApp('');
        }
    }, []);

    useEffect(() => {
        updateTarget(phase);
    }, [phase, updateTarget]);

    // Live target app updates from backend polling
    useEffect(() => {
        let isMounted = true;
        let unlistenFn: (() => void) | null = null;

        listen<string>('target-app-changed', (event) => {
            if (isMounted && event.payload && event.payload !== 'Unknown' && event.payload !== 'NYX Vox' && event.payload !== 'app') {
                setTargetApp(event.payload);
            }
        }).then(u => {
            if (isMounted) unlistenFn = u; else u();
        });

        return () => { isMounted = false; if (unlistenFn) unlistenFn(); };
    }, []);

    useEffect(() => {
        const langCode = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
        const trayLang = langCode === 'auto' ? (appLanguage || 'en') : langCode;
        invoke('update_tray_lang', { lang: trayLang }).catch(console.error);
    }, [sttMode, dgLanguage, whisperLanguage, groqLanguage, appLanguage]);

    useEffect(() => {
        let isMounted = true;
        let unlistenFn: (() => void) | null = null;
        listen<string>('language-changed', (e) => {
            if (isMounted) setAppLanguageState(e.payload as 'ru' | 'en');
        }).then(u => {
            if (isMounted) unlistenFn = u; else u();
        });
        return () => { isMounted = false; if (unlistenFn) unlistenFn(); };
    }, []);

    const handleFormattingModeChange = useCallback(async (mode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq') => {
        setFormattingMode(mode);
        if (mode !== 'none') setLastActiveFormatting(mode);
        await invoke('set_formatting_mode', { mode });
    }, []);

    const toggleSTTMode = useCallback(async () => {
        const modes: ('deepgram' | 'whisper' | 'groq' | 'gemini')[] = ['deepgram', 'whisper', 'groq', 'gemini'];
        const next = modes[(modes.indexOf(sttMode) + 1) % modes.length];
        setSttMode(next);
        await invoke('set_stt_mode', { mode: next });
    }, [sttMode]);

    const handlePaste = useCallback(async (explicitText?: string) => {
        // Safety: if called as an event handler, explicitText will be the Event object.
        // We only want to use it if it's explicitly a string.
        const textToPaste = (typeof explicitText === 'string') ? explicitText : transcriptText;
        
        if (!textToPaste) return;
        try {
            setProcessing(true);
            await invoke('paste_text', { text: textToPaste });
            if (clearOnPaste) setTranscript('');
            setPhase('idle');
            
            // После вставки — скрываем окно и возвращаем alwaysOnTop к пользовательскому значению
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.setAlwaysOnTop(alwaysOnTop);
            await win.hide();
        } catch (err) {
            console.error(err);
            const msg = appLanguage === 'ru' ? 'Ошибка вставки' : 'Paste error';
            setTranscript(`[${msg}: ${err}]`);
        } finally {
            setProcessing(false);
        }
    }, [transcriptText, clearOnPaste, setTranscript, appLanguage, setProcessing, alwaysOnTop]);

    const handleLanguageToggle = useCallback(async () => {
        const next = appLanguage === 'ru' ? 'en' : 'ru';
        setAppLanguageState(next);
        await invoke('set_app_language', { lang: next });
    }, [appLanguage]);

    const triggerStart = useCallback(() => {
        setTranscript('');
        setFormattingStatus(null);
        setAiStatus('');
        setShowSettings(false);
        setShowWelcome(false);
        setPhase('recording');
        invoke('start_recording').catch(err => {
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        });
    }, [setTranscript]);

    const triggerStop = useCallback(async () => {
        setPhase('processing');
        setProcessing(true);
        try {
            console.log('>>> [FRONTEND] stop_recording INVOKED');
            const rawText = await invoke<string>('stop_recording');
            console.log('DEBUG: UI received text:', rawText ? rawText.substring(0, 30) + '...' : 'empty');
            
            let processedText = rawText;
            if (rawText && (rawText.startsWith('{') || rawText.startsWith('['))) {
                try {
                    const parsed = JSON.parse(rawText);
                    processedText = parsed.content || parsed.text || rawText;
                } catch {
                    console.warn('Response looks like JSON but parsing failed, using as raw string');
                }
            }

            if (processedText) {
                const cleanedText = cleanHallucinations(processedText);
                setTranscript(cleanedText);
                if (autoPaste && cleanedText) {
                    handlePaste(cleanedText);
                    return;
                }
            }
            setPhase('result');
        } catch (err) {
            if (err === 'ALREADY_IDLE') {
                console.log('>>> [FRONTEND] Ignoring duplicate stop_recording call');
                return;
            }
            console.error('DEBUG: stop_recording failed:', err);
            setTranscript(`Ошибка: ${err}`);
            setPhase('result');
        } finally {
            setProcessing(false);
        }
    }, [setTranscript, setProcessing, cleanHallucinations, autoPaste, handlePaste]);

    // Stable Refs for state and handlers to prevent event listener re-subscription storms
    const autoPasteRef = useRef(autoPaste);
    useEffect(() => { autoPasteRef.current = autoPaste; }, [autoPaste]);

    const appLanguageRef = useRef(appLanguage);
    useEffect(() => { appLanguageRef.current = appLanguage; }, [appLanguage]);

    // Unified handlers ref for events
    const handlersRefs = useRef({ triggerStart, triggerStop, handlePaste, updateTarget });
    useEffect(() => {
        handlersRefs.current = { triggerStart, triggerStop, handlePaste, updateTarget };
    }, [triggerStart, triggerStop, handlePaste, updateTarget]);

    useEffect(() => {
        const unlisteners: (() => void)[] = [];

        const setupEvents = async () => {
            const handlers = [
                listen<void>('shortcut-trigger', () => {
                    const now = Date.now();
                    if (now - lastTriggerTime.current < 500) return;
                    lastTriggerTime.current = now;

                    const p = phaseRef.current;
                    if (p === 'idle' || p === 'result') { 
                        setShowSettings(false); 
                        handlersRefs.current.triggerStart(); 
                    } else if (p === 'recording') { 
                        handlersRefs.current.triggerStop(); 
                    }
                }),
                listen<void>('open-settings', () => { setShowWelcome(false); setShowSettings(true); }),
                listen<void>('open-welcome', () => { setShowSettings(false); setShowWelcome(true); }),
                listen<void>('app-summon', () => handlersRefs.current.updateTarget(phaseRef.current)),
                listen<string>('transcript-partial', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) setTranscript(t);
                }),
                listen<string>('deepgram-final', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) { 
                        setTranscript(t); 
                        if (autoPasteRef.current) {
                            handlersRefs.current.handlePaste(t);
                        } else {
                            setPhase('result'); 
                        }
                    }
                }),
                listen<string>('ai-status', (e) => setAiStatus(e.payload)),
                listen<string>('ai-result', (e) => {
                    const t = cleanHallucinations(e.payload);
                    if (t) setTranscript(t);
                }),
                listen<string>('deepgram-error', (e) => {
                    const err = String(e.payload);
                    const msg = err.includes('401') ? (appLanguageRef.current === 'ru' ? 'Ошибка ключа Deepgram' : 'Deepgram Key Error') : `Ошибка: ${err}`;
                    setTranscript(msg);
                    setPhase('result');
                }),
                listen<string>('recording-error', (e) => {
                    const err = String(e.payload || 'Recording error');
                    const msg = appLanguageRef.current === 'ru' ? `Ошибка записи: ${err}` : `Recording error: ${err}`;
                    setTranscript(msg);
                    setPhase('result');
                }),
                listen<string>('stt-fallback', (e) => {
                    setTranscript(`[Fallback: ${e.payload}]`);
                    setPhase('result');
                }),
                listen<string>('mode-changed', (e) => {
                    if (e.payload) setSttMode(e.payload as 'deepgram' | 'whisper' | 'groq' | 'gemini');
                }),
                listen<string>('formatting-status', (e) => {
                    setFormattingStatus(e.payload === 'done' ? null : e.payload);
                })
            ];

            const settled = await Promise.all(handlers);
            unlisteners.push(...settled);
        };

        setupEvents();

        return () => {
            unlisteners.forEach(fn => fn());
        };
    }, [cleanHallucinations, setTranscript, setPhase]);


    const handleCopy = useCallback(async (explicitText?: string) => {
        const text = explicitText || transcriptText;
        if (text) {
            await writeText(text);
        }
    }, [transcriptText]);

    const handleTextSelection = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        
        if (selectedText.length > 0) {
            handleCopy(selectedText);
            
            // Показываем "Скопировано!" на 600ms
            setAiStatus('✓ Скопировано!');
            setTimeout(() => setAiStatus(''), 600);
        }
    }, [handleCopy]);

    // Keyboard Shortcuts for Result/Editing phases
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const currentPhase = phaseRef.current;
            if (currentPhase === 'result' || currentPhase === 'editing') {
                // Enter: Send/Paste
                // In 'result' mode, plain Enter pastes.
                // In 'editing' mode, Command+Enter (or Ctrl+Enter) pastes.
                if (e.key === 'Enter') {
                    const isMod = e.metaKey || e.ctrlKey;
                    if (currentPhase === 'result' || isMod) {
                        e.preventDefault();
                        handlePaste();
                    }
                }
                
                // Escape: Dismiss
                if (e.key === 'Escape') {
                    setTranscript('');
                    setPhase('idle');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePaste, setTranscript, setPhase]);

    const windowEntrance: Variants = {
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    const resultTextLen = transcriptText?.length || 0;
    const resultRows = Math.max(1, Math.ceil(resultTextLen / 36));
    const resultHeight = Math.min(500, Math.max(160, 160 + (resultRows * 20)));

    const containerVariants: Variants = {
        idle: { width: 150, height: 48, borderRadius: 24 },      // [Pill: Idle]
        quickMenu: { width: 200, height: 230, borderRadius: 24 }, // [Menu: Quick Access]
        recording: { width: 260, height: 48, borderRadius: 24 },  // [Pill: Live]
        result: { width: 400, height: resultHeight, borderRadius: 24 }, // [Board: Result]
        editing: { width: 400, height: 360, borderRadius: 24 },   // [Board: Editor]
        overlay: { width: 440, height: 540, borderRadius: 24 },   // [Panel: Generic Overlay]
        settings: { width: 620, height: 680, borderRadius: 32 },  // [Panel: Settings]
        welcome: { width: 580, height: 560, borderRadius: 24 }    // [Panel: Welcome]
    };

    return (
        <main className="w-screen h-screen flex flex-col items-center justify-start bg-transparent font-sans antialiased overflow-hidden pointer-events-none z-[9999]">
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
                            initial={false}
                            animate={showSettings ? 'settings' : (showWelcome ? 'welcome' : (phase === 'editing' ? 'editing' : (phase === 'result' && !autoPaste ? 'result' : (isIdle ? (showQuickMenu ? 'quickMenu' : 'idle') : 'recording'))))}
                            variants={containerVariants}
                            transition={{ type: "spring", stiffness: 350, damping: 32 }}
                            className={`bg-[#1C1C1E] border border-white/10 flex flex-col relative h-full w-full shadow-none overflow-hidden`}
                            style={{ backdropFilter: 'blur(40px) saturate(200%)' }}
                        >
                            <AnimatePresence mode="wait">
                                {showSettings ? (
                                    <motion.div key="settings-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <SettingsPanel
                                            onClose={() => setShowSettings(false)}
                                            lang={appLanguage}
                                            setLang={(v: 'ru' | 'en') => { setAppLanguageState(v); invoke('set_app_language', { lang: v }); }}
                                            autoPaste={autoPaste}
                                            clearOnPaste={clearOnPaste}
                                            startMinimized={startMinimized}
                                            onToggleAutoPaste={(v) => { setAutoPaste(v); invoke('set_auto_paste', { enabled: v }); }}
                                            onToggleClearOnPaste={(v) => { setClearOnPaste(v); invoke('set_clear_on_paste', { enabled: v }); }}
                                            onToggleStartMinimized={(v) => { setStartMinimized(v); invoke('set_start_minimized', { minimized: v }); }} 
                                            alwaysOnTop={alwaysOnTop}
                                            onToggleAlwaysOnTop={(v) => { setAlwaysOnTop(v); invoke('set_always_on_top', { enabled: v }); }}
                                            autoPauseMedia={autoPauseMedia}
                                            handleToggleAutoPauseMedia={(v) => { setAutoPauseMedia(v); invoke('set_auto_pause', { pause: v }); }}
                                            formattingStyle={formattingStyle}
                                            onSetFormattingStyle={(s) => { setFormattingStyle(s); invoke('set_formatting_style', { style: s }); }}
                                            sttMode={sttMode}
                                            onSetSttMode={setSttMode}
                                            dgLanguage={dgLanguage}
                                            onSetDgLanguage={setDgLanguage}
                                            whisperLanguage={whisperLanguage}
                                            onSetWhisperLanguage={setWhisperLanguage}
                                            groqLanguage={groqLanguage}
                                            onSetGroqLanguage={setGroqLanguage}
                                            formattingMode={formattingMode}
                                            onSetFormattingMode={handleFormattingModeChange}
                                        />
                                    </motion.div>
                                ) : showWelcome ? (
                                    /* [Panel: Welcome] */
                                    <motion.div key="welcome-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <WelcomeOverlay 
                                            onClose={() => setShowWelcome(false)} 
                                            appLanguage={appLanguage} 
                                            onLanguageToggle={handleLanguageToggle} 
                                        />
                                    </motion.div>
                                ) : (
                                     <motion.div key="main-pill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="w-full h-full flex flex-col relative px-1 py-1">
                                         {/* Header Bar */}
                                        <div data-tauri-drag-region className="flex items-center h-10 w-full relative px-2 shrink-0 cursor-default">
                                              {/* Left Area: Main Action Button (Mic) */}
                                             <div className="absolute left-2 top-0 bottom-0 flex items-center">
                                                 <motion.button
                                                     onMouseDown={(e) => { e.stopPropagation(); void (isIdle ? triggerStart() : triggerStop()); }}
                                                     className={`rounded-full flex items-center justify-center transition-all duration-300 w-8 h-8 ${isRec ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'}`}
                                                 >
                                                     {isRec ? <div className="w-2.5 h-2.5 bg-white rounded-sm" /> : <Mic size={14} />}
                                                 </motion.button>
                                             </div>

                                             <div data-tauri-drag-region className="flex-1 flex justify-center items-center h-full pointer-events-none px-12">
                                                 <AnimatePresence mode="wait">
                                                     {isRec || isProc || (autoPaste && phase === 'result' && !isOverlay) ? (
                                                         <motion.div key="rec-lbl" initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 overflow-hidden max-w-full">
                                                             <div ref={scrollRef} className="whitespace-nowrap overflow-hidden text-[11px] text-white/80 font-bold tracking-tight truncate max-w-[150px]">
                                                                 {isRec 
                                                                    ? (transcriptText || (lang === 'ru' ? 'Слушаю...' : 'Listening...'))
                                                                    : (aiStatus || (lang === 'ru' ? 'Обработка...' : 'Processing...'))
                                                                 }
                                                             </div>
                                                             {isRec ? <WaveformVisualizer isActive={true} /> : <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
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

                                             {/* Right Area: Informational Label or Actions */}
                                             <div className="absolute right-2 top-0 bottom-0 flex items-center h-full">
                                                 {!isIdle ? (
                                                     <motion.button 
                                                         onMouseDown={async (e) => { 
                                                             e.stopPropagation(); 
                                                             if (phase === 'recording') {
                                                                 await invoke('stop_recording').catch(() => {});
                                                             } else if (phase === 'processing') {
                                                                 // If we are processing, we just want to stop and show what we have (or idle)
                                                                 setProcessing(false);
                                                             }
                                                             setTranscript('');
                                                             setPhase('idle');
                                                         }}
                                                         initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                                         className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                                                     >
                                                         <X size={14} />
                                                     </motion.button>
                                                 ) : (
                                                     <motion.div 
                                                         onMouseDown={(e) => { e.stopPropagation(); setShowQuickMenu(!showQuickMenu); }}
                                                         className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/4 border border-white/5 transition-all cursor-pointer active:scale-95 hover:bg-white/10 ${showQuickMenu ? 'bg-white/10 border-orange-500/30' : ''}`}
                                                     >
                                                         <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/20`}>
                                                             <span className={`text-[9px] font-black tracking-tighter select-none text-orange-500`}>NV</span>
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
                                                                     <div className={`w-1.5 h-1.5 rounded-full ${(() => { const cur = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage); return cur === 'ru' ? 'bg-blue-400' : (cur === 'en' ? 'bg-slate-200' : 'bg-white/20'); })()}`} />
                                                                     <div className={`w-1.5 h-1.5 rounded-full ${sttMode === 'whisper' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                                                                     <div className={`w-1.5 h-1.5 rounded-full ${formattingMode !== 'none' ? 'bg-cyan-400' : 'bg-white/5'}`} />
                                                                 </motion.div>
                                                             )}
                                                         </AnimatePresence>
                                                     </motion.div>
                                                 )}
                                             </div>
                                         </div>
                                         {/* Quick Menu Popover Layer */}
                                          <QuickMenu 
                                              isOpen={showQuickMenu && isIdle && !showSettings && !showWelcome}
                                              formattingMode={formattingMode}
                                              lastActiveFormatting={lastActiveFormatting}
                                              lang={appLanguage}
                                              sttMode={sttMode}
                                              onToggleFormatting={handleFormattingModeChange}
                                              onToggleSTTMode={toggleSTTMode}
                                              onOpenSettings={() => { setShowSettings(true); setShowQuickMenu(false); }}
                                              onClose={() => setShowQuickMenu(false)}
                                          />

                                        
                                        {/* Content Area (Result/Editing) */}
                                         {(phase === 'result' || phase === 'editing' || phase === 'processing') && !( (phase === 'result' && autoPaste) || phase === 'processing') && !isOverlay && (
                                            <motion.div data-tauri-drag-region initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col min-h-0 px-3 pb-3 gap-2">
                                                {phase === 'editing' ? (
                                                    <div className="flex-1 rounded-[12px] border border-white/5 overflow-hidden bg-white/[0.03] p-4 pt-1.5">
                                                        <textarea 
                                                            autoFocus value={transcriptText} onChange={e => setTranscript(e.target.value)} 
                                                            className="w-full h-full bg-transparent text-[13px] text-white/95 leading-relaxed resize-none focus:outline-none custom-scrollbar" spellCheck={false} 
                                                        />
                                                    </div>
                                                ) : (
                                                    /* [Board: Result / Processing] */
                                                    <motion.div
                                                        key="result-pane"
                                                        data-result-pane
                                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                        className="flex-1 flex flex-col p-4 pt-1.5 relative overflow-hidden rounded-[12px] border border-white/5 bg-white/[0.03] text-left items-start pointer-events-auto"
                                                    >
                                                        {/* Copy status - appears inside the result pane */}
                                                        {aiStatus && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/20 backdrop-blur-sm">
                                                                <span className="px-4 py-2 rounded-xl bg-orange-500/30 backdrop-blur-md text-orange-300 text-[13px] font-black uppercase tracking-wider border border-orange-500/40 shadow-2xl">
                                                                    {aiStatus}
                                                                </span>
                                                            </div>
                                                        )}
                                                        
                                                        <div
                                                            onMouseUp={handleTextSelection}
                                                            onKeyUp={handleTextSelection}
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
                                                )}
                                                
                                                {/* Bottom Action Bar */}
                                                <div className="flex items-center justify-between gap-2 h-10 mt-auto shrink-0 pb-0.5">
                                                    <div className="flex items-center gap-1 relative group/target">
                                                        {/* Brand Accent */}
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/5 mr-0.5 pointer-events-none">
                                                            <span className="text-[9px] font-black text-white/20 select-none tracking-tighter">NV</span>
                                                        </div>

                                                        <button 
                                                            onClick={() => setPhase(p => p === 'editing' ? 'result' : 'editing')} 
                                                            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${phase === 'editing' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 shadow-[inset_0_0_10px_rgba(52,211,153,0.05)]' : 'hover:bg-white/10 text-white/40 hover:text-white'}`}
                                                            title={C[lang].ui.edit}
                                                        >
                                                            {phase === 'editing' ? <Check size={14} /> : <Pencil size={14} />}
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => handleCopy()} 
                                                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                                            title={C[lang].ui.copy}
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => { setTranscript(''); setPhase('idle'); }} 
                                                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                                                            title={C[lang].ui.reset}
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                    
                                                    <button 
                                                          onClick={() => handlePaste()} 
                                                        onMouseEnter={() => {
                                                            if (phase === 'result' || phase === 'editing') {
                                                                invoke('update_target_app').then(() => updateTarget(phase)).catch(console.error);
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
