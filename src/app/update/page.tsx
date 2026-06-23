'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, Check, Github as GithubIcon, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
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

    const t = {
        ru: {
            title: 'НОВАЯ ВЕРСИЯ!',
            ver: `Версия ${latestVersion} доступна`,
            download: 'СКАЧАТЬ ИЗ GITHUB',
            later: 'Напомнить позже',
            cancel: 'Отмена',
            dontShow: 'Больше не показывать',
            notes: 'Что нового:',
            loading: 'Загрузка...',
        },
        en: {
            title: 'NEW UPDATE!',
            ver: `Version ${latestVersion} available`,
            download: 'DOWNLOAD FROM GITHUB',
            later: 'Remind Later',
            cancel: 'Cancel',
            dontShow: 'Don\'t show again',
            notes: 'Release Notes:',
            loading: 'Loading...',
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

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleDownload}
                            className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-black uppercase tracking-[0.18em] rounded-[14px] flex items-center justify-center gap-3 shadow-[0_6px_20px_rgba(234,88,12,0.25)] transition-all active:scale-[0.98]"
                        >
                            <GithubIcon size={15} />
                            <span>{t.download}</span>
                        </button>

                        <button
                            onClick={handleLater}
                            className="w-full h-10 bg-surface hover:bg-white/[0.08] text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-[14px] flex items-center justify-center gap-2 transition-all border border-white/[0.05]"
                        >
                            <Clock size={13} className="opacity-40" />
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
