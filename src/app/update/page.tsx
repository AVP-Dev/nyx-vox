'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Clock, Zap, Check, Github as GithubIcon, Globe, ExternalLink,
    Copy, Terminal, ChevronDown, ChevronUp, Download, RefreshCw,
    AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import type { Update } from '@tauri-apps/plugin-updater';
import Markdown from 'react-markdown';
import { APP_VERSION } from '@/constants/version';
import { checkAppUpdate, normalizeVersion, parseBilingualNotes } from '@/lib/updater';

type UpdateStage = 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';

export default function UpdatePage() {
    const [latestVersion, setLatestVersion] = useState('');
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [releaseNotes, setReleaseNotes] = useState('');
    const [stage, setStage] = useState<UpdateStage>('checking');
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [showGuide, setShowGuide] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
    const [isMac, setIsMac] = useState(false);
    const updateRef = useRef<Update | null>(null);

    const runCheck = useCallback(async (expectedVersion?: string) => {
        setStage('checking');
        setErrorMsg('');
        setProgress(0);
        try {
            const update = await checkAppUpdate();
            if (update) {
                updateRef.current = update;
                const cleanVer = normalizeVersion(update.version);
                setLatestVersion(cleanVer);
                const rawBody = (update.body || '').trim();
                const isPlaceholder = rawBody === 'See the assets below to download the latest version.';
                if (rawBody && !isPlaceholder) {
                    setReleaseNotes(rawBody);
                } else {
                    fetch(`https://api.github.com/repos/AVP-Dev/nyx-vox/releases/tags/v${cleanVer}`, {
                        headers: { Accept: 'application/vnd.github.v3+json' },
                    })
                        .then((r) => (r.ok ? r.json() : null))
                        .then((data) => {
                            if (data?.body) setReleaseNotes(data.body);
                            else if (rawBody) setReleaseNotes(rawBody);
                        })
                        .catch(() => {
                            if (rawBody) setReleaseNotes(rawBody);
                        });
                }
                setStage('available');
            } else if (expectedVersion) {
                setLatestVersion(normalizeVersion(expectedVersion));
                setStage('up-to-date');
            } else {
                setStage('up-to-date');
            }
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setStage('error');
        }
    }, []);

    useEffect(() => {
        setIsMac(typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform));
        const params = new URLSearchParams(window.location.search);
        const paramVer = params.get('version') || '';
        setLatestVersion(normalizeVersion(paramVer));
        setLanguage((params.get('lang') as 'ru' | 'en') || 'ru');
        void runCheck(paramVer);
    }, [runCheck]);

    const parsed = useMemo(() => parseBilingualNotes(releaseNotes), [releaseNotes]);
    const currentNotes = language === 'ru' ? parsed.ru : parsed.en;

    const closeWindow = async () => {
        if (window.__TAURI_INTERNALS__) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
        }
    };

    const handleLater = async () => {
        try {
            await invoke('set_update_dismissed_at', { timestamp: Date.now() });
            if (dontShowAgain && latestVersion) {
                await invoke('set_ignored_update', { version: latestVersion });
            }
        } catch (e) {
            console.error(e);
        }
        await closeWindow();
    };

    const handleCancel = async () => {
        if (dontShowAgain && latestVersion) {
            await invoke('set_ignored_update', { version: latestVersion }).catch(() => {});
        }
        await closeWindow();
    };

    const handleInstallAndRestart = async () => {
        const update = updateRef.current;
        if (!update) return;

        setStage('downloading');
        setErrorMsg('');
        setProgress(0);

        let downloaded = 0;
        let contentLength = 0;

        try {
            await update.downloadAndInstall((event) => {
                if (event.event === 'Started') {
                    contentLength = event.data.contentLength ?? 0;
                } else if (event.event === 'Progress') {
                    downloaded += event.data.chunkLength;
                    if (contentLength > 0) {
                        setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
                    }
                } else if (event.event === 'Finished') {
                    setProgress(100);
                    setStage('installing');
                }
            });

            setStage('installing');
            if (isMac) {
                await invoke('reset_accessibility_cache').catch(() => {});
            }
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setStage('error');
        }
    };

    const handleDownloadFallback = async () => {
        const url = 'https://github.com/AVP-Dev/nyx-vox/releases/latest';
        await invoke('open_url', { url }).catch(() => window.open(url, '_blank'));
    };

    const handleCopy = (cmd: string) => {
        navigator.clipboard.writeText(cmd).then(() => {
            setCopiedCmd(cmd);
            setTimeout(() => setCopiedCmd(null), 2000);
        });
    };

    const t = {
        ru: {
            title: 'ОБНОВЛЕНИЕ',
            verAvailable: `Версия v${latestVersion} доступна (сейчас v${APP_VERSION})`,
            verCurrent: `Текущая версия v${APP_VERSION}`,
            checking: 'Проверка обновлений...',
            upToDateTitle: 'У вас последняя версия',
            upToDateDesc: `NYX Vox v${APP_VERSION} не требует обновления.`,
            installRestart: 'ОБНОВИТЬ И ПЕРЕЗАПУСТИТЬ',
            downloading: `Загрузка обновления... ${progress}%`,
            installing: 'Установка и перезапуск...',
            retry: 'ПОВТОРИТЬ',
            close: 'ЗАКРЫТЬ',
            downloadManual: 'СКАЧАТЬ С GITHUB',
            howToUpdate: 'Проблемы с обновлением? (ручной способ)',
            later: 'Напомнить позже',
            cancel: 'Отмена',
            dontShow: 'Больше не показывать',
            copied: 'Скопировано',
            macHint: 'macOS без подписи Apple: после перезапуска может потребоваться заново включить Accessibility.',
            macBrew: 'brew update && brew upgrade --cask AVP-Dev/apps/nyx-vox',
            macCurl: 'curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash',
        },
        en: {
            title: 'UPDATE',
            verAvailable: `Version v${latestVersion} available (current v${APP_VERSION})`,
            verCurrent: `Current version v${APP_VERSION}`,
            checking: 'Checking for updates...',
            upToDateTitle: 'You are up to date',
            upToDateDesc: `NYX Vox v${APP_VERSION} is the latest version.`,
            installRestart: 'UPDATE & RESTART',
            downloading: `Downloading update... ${progress}%`,
            installing: 'Installing & restarting...',
            retry: 'RETRY',
            close: 'CLOSE',
            downloadManual: 'DOWNLOAD FROM GITHUB',
            howToUpdate: 'Having trouble updating? (manual fallback)',
            later: 'Remind Later',
            cancel: 'Cancel',
            dontShow: "Don't show again",
            copied: 'Copied',
            macHint: 'Unsigned macOS build: you may need to re-enable Accessibility after restart.',
            macBrew: 'brew update && brew upgrade --cask AVP-Dev/apps/nyx-vox',
            macCurl: 'curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash',
        },
    }[language];

    const isBusy = stage === 'downloading' || stage === 'installing';

    return (
        <main className="w-screen h-screen flex items-center justify-center bg-transparent overflow-hidden pointer-events-none p-0">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full bg-panel border border-subtle flex flex-col pointer-events-auto relative overflow-hidden rounded-[32px]"
            >
                <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-16 cursor-grab active:cursor-grabbing z-0" />

                <div className="flex-1 flex flex-col p-5 relative z-10 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between mt-1 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[14px] bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                                <Zap size={20} className="text-orange-500" fill="currentColor" />
                            </div>
                            <div>
                                <div className="text-[14px] font-black text-white uppercase tracking-wider leading-none">{t.title}</div>
                                <div className="text-[10px] text-muted font-bold italic tracking-tight mt-0.5">
                                    {stage === 'available' || isBusy ? t.verAvailable : t.verCurrent}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setLanguage((l) => (l === 'ru' ? 'en' : 'ru'))}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-subtle hover:bg-surface-hover transition-all"
                            >
                                <Globe size={12} className="text-muted" />
                                <span className="text-[10px] font-black text-muted uppercase tracking-wider">{language.toUpperCase()}</span>
                            </button>
                            {!isBusy && (
                                <button
                                    onClick={closeWindow}
                                    className="p-1.5 rounded-lg bg-surface border border-subtle hover:bg-surface-hover text-muted hover:text-white transition-all"
                                    aria-label="Close"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/[0.02] rounded-xl border border-subtle p-3 min-h-0 mb-3 flex flex-col">
                        {stage === 'checking' && (
                            <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-white/60 text-[11px] font-bold">
                                <RefreshCw size={20} className="animate-spin text-orange-400" />
                                <span>{t.checking}</span>
                            </div>
                        )}

                        {stage === 'up-to-date' && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4">
                                <CheckCircle2 size={28} className="text-emerald-400" />
                                <div className="text-[13px] font-black text-white">{t.upToDateTitle}</div>
                                <div className="text-[11px] text-muted">{t.upToDateDesc}</div>
                            </div>
                        )}

                        {stage === 'error' && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-3">
                                <AlertTriangle size={24} className="text-red-400" />
                                <div className="text-[11px] text-red-300 font-mono break-all max-h-32 overflow-y-auto">
                                    {errorMsg}
                                </div>
                            </div>
                        )}

                        {(stage === 'available' || isBusy) && (
                            currentNotes ? (
                                <div className="prose-update">
                                    <Markdown>{currentNotes}</Markdown>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-white/30 text-[11px] font-bold">
                                    v{latestVersion}
                                </div>
                            )
                        )}
                    </div>

                    {/* Progress Bar during download/install */}
                    {isBusy && (
                        <div className="mb-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-orange-300">
                                <span>{stage === 'downloading' ? t.downloading : t.installing}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-surface overflow-hidden border border-subtle">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-200"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Manual fallback guide */}
                    {(stage === 'available' || stage === 'error') && (
                        <div className="mb-2">
                            <button
                                onClick={() => setShowGuide(!showGuide)}
                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface border border-subtle hover:bg-surface-hover transition-all text-[10px] font-bold text-muted hover:text-white"
                            >
                                <span className="flex items-center gap-1.5">
                                    <Terminal size={12} className="text-orange-400" />
                                    <span>{t.howToUpdate}</span>
                                </span>
                                {showGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            <AnimatePresence>
                                {showGuide && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden mt-1.5 space-y-1.5 bg-black/40 rounded-xl p-2.5 border border-white/5 text-[10px]"
                                    >
                                        <div>
                                            <div className="text-white/40 font-bold mb-1">macOS (Homebrew):</div>
                                            <div className="flex items-center justify-between bg-surface p-1.5 rounded-lg font-mono text-[9px] text-orange-300">
                                                <span className="truncate mr-2">{t.macBrew}</span>
                                                <button
                                                    onClick={() => handleCopy(t.macBrew)}
                                                    className="shrink-0 text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/5"
                                                >
                                                    {copiedCmd === t.macBrew ? t.copied : <Copy size={11} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-white/40 font-bold mb-1">macOS (curl):</div>
                                            <div className="flex items-center justify-between bg-surface p-1.5 rounded-lg font-mono text-[9px] text-orange-300">
                                                <span className="truncate mr-2">{t.macCurl}</span>
                                                <button
                                                    onClick={() => handleCopy(t.macCurl)}
                                                    className="shrink-0 text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/5"
                                                >
                                                    {copiedCmd === t.macCurl ? t.copied : <Copy size={11} />}
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleDownloadFallback}
                                            className="w-full h-7 rounded-lg bg-surface hover:bg-surface-hover text-white/80 font-bold flex items-center justify-center gap-1.5 border border-subtle"
                                        >
                                            <GithubIcon size={11} />
                                            <span>{t.downloadManual}</span>
                                            <ExternalLink size={10} />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5">
                        {stage === 'available' && (
                            <>
                                <button
                                    onClick={handleInstallAndRestart}
                                    className="w-full h-10 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-all active:scale-[0.98]"
                                >
                                    <Download size={13} />
                                    <span>{t.installRestart}</span>
                                </button>
                                {isMac && (
                                    <div className="text-[9px] text-white/40 text-center leading-tight px-1">
                                        {t.macHint}
                                    </div>
                                )}
                                <button
                                    onClick={handleLater}
                                    className="w-full h-8 bg-surface/50 hover:bg-white/[0.08] text-white/60 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1.5 transition-all border border-white/[0.04]"
                                >
                                    <Clock size={11} className="opacity-40" />
                                    <span>{t.later}</span>
                                </button>
                            </>
                        )}

                        {stage === 'error' && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => void runCheck()}
                                    className="h-10 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <RefreshCw size={13} />
                                    <span>{t.retry}</span>
                                </button>
                                <button
                                    onClick={handleDownloadFallback}
                                    className="h-10 bg-surface hover:bg-surface-hover text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] flex items-center justify-center gap-1.5 border border-subtle transition-all"
                                >
                                    <GithubIcon size={13} />
                                    <span>GitHub</span>
                                </button>
                            </div>
                        )}

                        {stage === 'up-to-date' && (
                            <button
                                onClick={closeWindow}
                                className="w-full h-10 bg-surface hover:bg-surface-hover text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] border border-subtle transition-all"
                            >
                                {t.close}
                            </button>
                        )}
                    </div>

                    {/* Bottom */}
                    {stage === 'available' && (
                        <div className="flex items-center justify-between px-0.5 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={dontShowAgain}
                                    onChange={(e) => setDontShowAgain(e.target.checked)}
                                />
                                <div className={`w-3.5 h-3.5 border rounded transition-all flex items-center justify-center ${dontShowAgain ? 'bg-orange-600 border-orange-600' : 'bg-surface border-strong'}`}>
                                    {dontShowAgain && <Check className="w-2.5 h-2.5 text-white" strokeWidth={5} />}
                                </div>
                                <span className="text-[9px] text-white/20 group-hover:text-muted transition-colors font-bold uppercase tracking-[0.15em]">
                                    {t.dontShow}
                                </span>
                            </label>
                            <button
                                onClick={handleCancel}
                                className="text-[9px] font-black text-white/10 hover:text-muted uppercase tracking-[0.25em] transition-colors"
                            >
                                {t.cancel}
                            </button>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 h-[1.5px] w-full bg-gradient-to-r from-transparent via-orange-500/10 to-transparent" />
            </motion.div>
        </main>
    );
}
