"use client";

import React, { Suspense, lazy, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useStore } from '@/store/useStore';

// Hooks
import { useSettings } from '@/hooks/useSettings';
import { useRecording } from '@/hooks/useRecording';
import { useWindowManager } from '@/hooks/useWindowManager';
import { useInitialSettings } from '@/hooks/useInitialSettings';
import { useTargetApp } from '@/hooks/useTargetApp';
import { useTauriEvents } from '@/hooks/useTauriEvents';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Components
import { HeaderBar } from '@/components/HeaderBar';
import { ResultPane } from '@/components/ResultPane';
import { ActionBar } from '@/components/ActionBar';

// Utilities
import { windowEntrance, buildContainerVariants } from '@/lib/animations';

// Lazy-loaded heavy panels
const SettingsPanel = lazy(() =>
    import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel }))
);
const WelcomeOverlay = lazy(() =>
    import('@/components/WelcomeOverlay').then(m => ({ default: m.WelcomeOverlay }))
);

export default function Home() {
    const { transcriptText, setProcessing, setTranscript, compactResultWindow } = useStore();

    // --- Settings ---
    const settings = useSettings();

    // --- Target App (before recording so updateTarget can be passed) ---
    const { targetApp, updateTarget } = useTargetApp();

    // --- Recording ---
    const rec = useRecording({
        autoPaste: settings.autoPaste,
        clearOnPaste: settings.clearOnPaste,
        alwaysOnTop: settings.alwaysOnTop,
        appLanguage: settings.appLanguage,
        updateTarget,
    });

    // Formatting status lives alongside recording state
    const [formattingStatus, setFormattingStatus] = React.useState<string | null>(null);

    // Extract stable reference for useCallback deps
    const rawTriggerStart = rec.triggerStart;

    // Wrapper that also clears formatting status on start
    const triggerStart = useCallback(async () => {
        setFormattingStatus(null);
        await rawTriggerStart();
    }, [rawTriggerStart]);

    // --- Initial Settings Load ---
    const { showWelcome, setShowWelcome, isVisible, permsMissing } = useInitialSettings({
        setSttMode: settings.setSttMode,
        setAppLanguage: settings.setAppLanguage,
        setAutoPaste: settings.setAutoPaste,
        setClearOnPaste: settings.setClearOnPaste,
        setStartMinimized: settings.setStartMinimized,
        setAlwaysOnTop: settings.setAlwaysOnTop,
        setAutoPauseMedia: settings.setAutoPauseMedia,
        setAudioGain: settings.setAudioGain,
        setFormattingMode: settings.setFormattingMode,
        setLastActiveFormatting: settings.setLastActiveFormatting,
        setFormattingStyle: settings.setFormattingStyle,
        setShowWelcome: () => {}, // local state managed by useInitialSettings
        setIsVisible: () => {},   // local state managed by useInitialSettings
    });

    // --- Window Manager ---
    const isOverlay = settings.showSettings || showWelcome;
    const isCompact = (rec.phase === 'recording' || rec.phase === 'processing')
        || (settings.autoPaste && rec.phase === 'result');
    const { containerRef, scrollRef } = useWindowManager({
        phase: rec.phase,
        isIdle: rec.isIdle,
        isOverlay,
        isCompact,
        compactResultWindow,
        isVisible,
        showSettings: settings.showSettings,
        showWelcome,
        showQuickMenu: settings.showQuickMenu,
        alwaysOnTop: settings.alwaysOnTop,
        transcriptTextLength: transcriptText?.length || 0,
    });

    // --- Tauri Events ---
    useTauriEvents({
        setTranscript,
        setPhase: rec.setPhase,
        setFormattingStatus,
        setSttMode: settings.setSttMode,
        setAiStatus: rec.setAiStatus,
        setShowSettings: settings.setShowSettings,
        setShowWelcome,
        phaseRef: rec.phaseRef,
        appLanguageRef: rec.appLanguageRef,
        autoPasteRef: rec.autoPasteRef,
        handlersRefs: rec.handlersRefs,
        lastTriggerTime: rec.lastTriggerTime,
    });

    // Keep handlersRefs in sync with the wrapping triggerStart
    React.useEffect(() => {
        rec.handlersRefs.current = {
            triggerStart,
            triggerStop: rec.triggerStop,
            handlePaste: rec.handlePaste,
            updateTarget,
        };
    }, [triggerStart, rec.triggerStop, rec.handlePaste, updateTarget, rec.handlersRefs]);

    // --- Keyboard Shortcuts ---
    useKeyboardShortcuts({
        handlePaste: rec.handlePaste,
        setTranscript,
        setPhase: rec.setPhase,
        phaseRef: rec.phaseRef,
    });

    // --- Update target on phase change ---
    React.useEffect(() => { updateTarget(rec.phase); }, [rec.phase, updateTarget]);

    // --- Derived values ---
    const lang = settings.appLanguage;
    const resultTextLen = transcriptText?.length || 0;
    const isCompactIdle = compactResultWindow && rec.isIdle && !settings.showQuickMenu;
    const containerVariants = buildContainerVariants(resultTextLen, isCompactIdle);

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
                            animate={
                                settings.showSettings ? 'settings'
                                : (showWelcome ? 'welcome'
                                : (rec.phase === 'editing' ? 'editing'
                                : (rec.phase === 'result' && !settings.autoPaste ? 'result'
                                : (rec.isIdle ? (settings.showQuickMenu ? 'quickMenu' : 'idle')
                                : 'recording'))))
                            }
                            variants={containerVariants}
                            transition={{ type: "spring", stiffness: 350, damping: 32 }}
                            className="bg-[#1C1C1E] border border-white/10 flex flex-col relative h-full w-full shadow-none overflow-hidden"
                            style={{ backdropFilter: 'blur(40px) saturate(200%)' }}
                        >
                            <AnimatePresence mode="wait">
                                {settings.showSettings ? (
                                    <motion.div key="settings-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <Suspense fallback={<div className="w-full h-full" />}>
                                            <SettingsPanel
                                                onClose={() => settings.setShowSettings(false)}
                                                lang={lang}
                                                setLang={(v) => { settings.setAppLanguage(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_app_language', { lang: v })); }}
                                                autoPaste={settings.autoPaste}
                                                clearOnPaste={settings.clearOnPaste}
                                                startMinimized={settings.startMinimized}
                                                onToggleAutoPaste={(v) => { settings.setAutoPaste(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_auto_paste', { enabled: v })); }}
                                                onToggleClearOnPaste={(v) => { settings.setClearOnPaste(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_clear_on_paste', { enabled: v })); }}
                                                onToggleStartMinimized={(v) => { settings.setStartMinimized(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_start_minimized', { minimized: v })); }}
                                                alwaysOnTop={settings.alwaysOnTop}
                                                onToggleAlwaysOnTop={(v) => { settings.setAlwaysOnTop(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_always_on_top', { enabled: v })); }}
                                                autoPauseMedia={settings.autoPauseMedia}
                                                handleToggleAutoPauseMedia={(v) => { settings.setAutoPauseMedia(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_auto_pause', { pause: v })); }}
                                                formattingStyle={settings.formattingStyle}
                                                onSetFormattingStyle={(s) => { settings.setFormattingStyle(s); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_formatting_style', { style: s })); }}
                                                sttMode={settings.sttMode}
                                                onSetSttMode={settings.setSttMode}
                                                formattingMode={settings.formattingMode}
                                                onSetFormattingMode={settings.handleFormattingModeChange}
                                                noiseGate={settings.noiseGate}
                                                onSetNoiseGate={(v) => { settings.setNoiseGate(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_noise_gate', { value: v })); }}
                                                audioGain={settings.audioGain}
                                                onSetAudioGain={(v) => { settings.setAudioGain(v); import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_audio_gain', { gain: v })); }}
                                            />
                                        </Suspense>
                                    </motion.div>
                                ) : showWelcome ? (
                                    <motion.div key="welcome-overlay" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full flex flex-col">
                                        <Suspense fallback={<div className="w-full h-full" />}>
                                            <WelcomeOverlay
                                                onClose={() => setShowWelcome(false)}
                                                appLanguage={lang}
                                                onLanguageToggle={settings.handleLanguageToggle}
                                                initialTab={permsMissing ? 'perms' : undefined}
                                            />
                                        </Suspense>
                                    </motion.div>
                                ) : isCompactIdle ? (
                                    /* Compact idle bubble — a round mic button only */
                                    <motion.button
                                        key="compact-idle"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                        onMouseDown={(e) => { e.stopPropagation(); void triggerStart(); }}
                                        title={lang === 'ru' ? 'Начать запись' : 'Start recording'}
                                        className="w-10 h-10 m-1 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all active:scale-90"
                                    >
                                        <Mic size={16} />
                                    </motion.button>
                                ) : (
                                    <motion.div key="main-pill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="w-full h-full flex flex-col relative px-1 py-1">
                                        <HeaderBar
                                            phase={rec.phase}
                                            isRec={rec.isRec}
                                            isProc={rec.isProc}
                                            isIdle={rec.isIdle}
                                            isOverlay={isOverlay}
                                            aiStatus={rec.aiStatus}
                                            formattingStatus={formattingStatus}
                                            lang={lang}
                                            sttMode={settings.sttMode}
                                            formattingMode={settings.formattingMode}
                                            lastActiveFormatting={settings.lastActiveFormatting}
                                            showQuickMenu={settings.showQuickMenu}
                                            transcriptText={transcriptText}
                                            autoPaste={settings.autoPaste}
                                            scrollRef={scrollRef}
                                            onTriggerStart={triggerStart}
                                            onTriggerStop={rec.triggerStop}
                                            onSetShowQuickMenu={settings.setShowQuickMenu}
                                            onSetShowSettings={settings.setShowSettings}
                                            onToggleFormatting={settings.handleFormattingModeChange}
                                            onToggleSTTMode={settings.toggleSTTMode}
                                            onSetPhase={rec.setPhase}
                                            onSetProcessing={setProcessing}
                                            onSetTranscript={setTranscript}
                                        />

                                        {/* Content Area (Result/Editing) */}
                                        {(rec.phase === 'result' || rec.phase === 'editing' || rec.phase === 'processing')
                                            && !((rec.phase === 'result' && settings.autoPaste) || rec.phase === 'processing')
                                            && !isOverlay && (
                                            <motion.div data-tauri-drag-region initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col min-h-0 px-3 pb-3 gap-2">
                                                {rec.phase === 'editing' ? (
                                                    <div className="flex-1 rounded-[12px] border border-white/5 overflow-hidden bg-white/[0.03] p-4 pt-1.5">
                                                        <textarea
                                                            autoFocus value={transcriptText} onChange={e => setTranscript(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                // Plain Enter sends the edited text; Escape exits editing.
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    void rec.handlePaste();
                                                                }
                                                            }}
                                                            className="w-full h-full bg-transparent text-[13px] text-white/95 leading-relaxed resize-none focus:outline-none custom-scrollbar" spellCheck={false}
                                                        />
                                                    </div>
                                                ) : (
                                                    <ResultPane
                                                        lang={lang}
                                                        aiStatus={rec.aiStatus}
                                                        transcriptText={transcriptText}
                                                        onTextSelection={rec.handleTextSelection}
                                                    />
                                                )}

                                                <ActionBar
                                                    phase={rec.phase}
                                                    lang={lang}
                                                    transcriptText={transcriptText}
                                                    targetApp={targetApp}
                                                    onToggleEdit={() => rec.setPhase(p => p === 'editing' ? 'result' : 'editing')}
                                                    onCopy={() => rec.handleCopy()}
                                                    onReset={() => { setTranscript(''); rec.setPhase('idle'); }}
                                                    onPaste={() => rec.handlePaste()}
                                                    onUpdateTarget={() => updateTarget(rec.phase)}
                                                />
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
