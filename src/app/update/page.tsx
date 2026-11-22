'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, Check, Github as GithubIcon, Globe, ExternalLink, Copy, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import Markdown from 'react-markdown';

function parseBilingualNotes(raw: string): { en: string; ru: string } {
    if (!raw) return { en: '', ru: '' };
    const parts = raw.split(/\n---\n/);
    if (parts.length < 2) return { en: raw, ru: raw };
    const enPart = parts[0].trim();
    const ruPart = parts.slice(1).join('\n---\n').trim();
    return { en: enPart, ru: ruPart };
}

export default function UpdatePage() {
    const [latestVersion, setLatestVersion] = useState('');
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [releaseNotes, setReleaseNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setLatestVersion(params.get('version') || '');
        setLanguage((params.get('lang') as 'ru' | 'en') || 'ru');
    }, []);

    useEffect(() => {
        if (!latestVersion) return;
        setLoading(true);
        fetch(`https://api.github.com/repos/AVP-Dev/nyx-vox/releases/tags/v${latestVersion}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.body) setReleaseNotes(data.body);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [latestVersion]);

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
            await closeWindow();
        } catch (e) {
            console.error(e);
            await closeWindow();
        }
    };

    const handleCancel = async () => {
        if (dontShowAgain && latestVersion) {
            await invoke('set_ignored_update', { version: latestVersion });
        }
        await closeWindow();
    };

    const handleDownload = async () => {
        const url = 'https://github.com/AVP-Dev/nyx-vox/releases/latest';
        await invoke('open_url', { url }).catch(() => window.open(url, '_blank'));
    };

    const handleOpenSite = async () => {
        const url = 'https://nyx-vox.avpdev.com/#download';
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
            title: 'НОВАЯ ВЕРСИЯ!',
            ver: `Версия ${latestVersion} доступна`,
            download: 'СКАЧАТЬ ИЗ GITHUB',
            site: 'ВЫБОР ВЕРСИИ НА САЙТЕ',
            howToUpdate: 'Как обновить?',
            later: 'Напомнить позже',
            cancel: 'Отмена',
            dontShow: 'Больше не показывать',
            notes: 'Что нового:',
            loading: 'Загрузка...',
            copied: 'Скопировано',
            macBrew: 'brew update && brew upgrade --cask AVP-Dev/apps/nyx-vox',
            macCurl: 'curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash',
        },
        en: {
            title: 'NEW UPDATE!',
            ver: `Version ${latestVersion} available`,
            download: 'DOWNLOAD FROM GITHUB',
            site: 'CHOOSE ON WEBSITE',
            howToUpdate: 'How to update?',
            later: 'Remind Later',
            cancel: 'Cancel',
            dontShow: 'Don\'t show again',
            notes: 'Release Notes:',
            loading: 'Loading...',
            copied: 'Copied',
            macBrew: 'brew update && brew upgrade --cask AVP-Dev/apps/nyx-vox',
            macCurl: 'curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash',
        }
    }[language];

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
                                <div className="text-[10px] text-muted font-bold italic tracking-tight mt-0.5">{t.ver}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setLanguage(l => l === 'ru' ? 'en' : 'ru')}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-subtle hover:bg-surface-hover transition-all"
                        >
                            <Globe size={12} className="text-muted" />
                            <span className="text-[10px] font-black text-muted uppercase tracking-wider">{language.toUpperCase()}</span>
                        </button>
                    </div>

                    {/* Release Notes */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/[0.02] rounded-xl border border-subtle p-3 min-h-0 mb-3">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-white/20 text-[11px] font-bold">{t.loading}</div>
                        ) : currentNotes ? (
                            <div className="prose-update">
                                <Markdown>{currentNotes}</Markdown>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/20 text-[11px] font-bold">v{latestVersion}</div>
                        )}
                    </div>

                    {/* How to Update Toggle */}
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleDownload}
                                className="h-10 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-all active:scale-[0.98]"
                            >
                                <GithubIcon size={13} />
                                <span>{t.download}</span>
                            </button>

                            <button
                                onClick={handleOpenSite}
                                className="h-10 bg-surface hover:bg-surface-hover text-white text-[10px] font-black uppercase tracking-wider rounded-[12px] flex items-center justify-center gap-1.5 border border-subtle transition-all active:scale-[0.98]"
                            >
                                <ExternalLink size={13} className="text-orange-400" />
                                <span>{t.site}</span>
                            </button>
                        </div>

                        <button
                            onClick={handleLater}
                            className="w-full h-8 bg-surface/50 hover:bg-white/[0.08] text-white/60 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-[10px] flex items-center justify-center gap-1.5 transition-all border border-white/[0.04]"
                        >
                            <Clock size={11} className="opacity-40" />
                            <span>{t.later}</span>
                        </button>
                    </div>

                    {/* Bottom */}
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
                </div>

                <div className="absolute bottom-0 h-[1.5px] w-full bg-gradient-to-r from-transparent via-orange-500/10 to-transparent" />
            </motion.div>
        </main>
    );
}
