'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Clock, Zap, Check, Github as GithubIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

export default function UpdatePage() {
    const [latestVersion, setLatestVersion] = useState('');
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const currentVersion = 'v0.1.2-beta';

    useEffect(() => {
        // Get params from URL
        const params = new URLSearchParams(window.location.search);
        setLatestVersion(params.get('version') || '');
        setLanguage((params.get('lang') as 'ru' | 'en') || 'ru');
    }, []);

    const closeWindow = async () => {
        if (window.__TAURI_INTERNALS__) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
        }
    };

    const handleLater = async () => {
        try {
            // Remind in 4 hours
            await invoke('set_update_dismissed_at', { timestamp: Date.now() });
            if (dontShowAgain && latestVersion) {
                await invoke('set_ignored_update', { version: latestVersion });
            }
            await closeWindow();
        } catch (e) { console.error(e); await closeWindow(); }
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
        // Usually, after clicking download, we can still stay open or close.
        // Let's stay open so the user can see the "Later" or "Cancel" buttons if they want.
    };

    const t = {
        ru: {
            title: 'НОВАЯ ВЕРСИЯ!',
            ver: `Версия ${latestVersion} доступна`,
            download: 'СКАЧАТЬ ИЗ GITHUB',
            later: 'Напомнить позже',
            cancel: 'Отмена',
            dontShow: 'Больше не показывать'
        },
        en: {
            title: 'NEW UPDATE!',
            ver: `Version ${latestVersion} available`,
            download: 'DOWNLOAD FROM GITHUB',
            later: 'Remind Later',
            cancel: 'Cancel',
            dontShow: 'Don\'t show again'
        }
    }[language];

    return (
        <main className="w-screen h-screen flex items-center justify-center bg-transparent p-4 overflow-hidden pointer-events-none">
            {/* GLASS BLUR BG */}
            <div className="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm pointer-events-none rounded-[32px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-[320px] bg-[#18181B] border border-white/10 rounded-[32px] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.8)] flex flex-col gap-5 pointer-events-auto relative overflow-hidden z-10"
            >
                <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-12 cursor-grab active:cursor-grabbing z-0" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-orange-600/20 border border-orange-500/20 flex items-center justify-center shadow-inner">
                            <Zap size={22} className="text-orange-500" fill="currentColor" />
                        </div>
                        <div>
                            <div className="text-[14px] font-black text-white uppercase tracking-wider leading-tight">{t.title}</div>
                            <div className="text-[11px] text-white/40 font-bold mt-0.5 italic">{t.ver}</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                    <button
                        onClick={handleDownload}
                        className="w-full h-12 bg-[#F97316] hover:bg-orange-500 text-white text-[12px] font-black uppercase tracking-[0.15em] rounded-2xl flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(249,115,22,0.3)] transition-all active:scale-[0.97]"
                    >
                        <GithubIcon size={16} />
                        <span>{t.download}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleLater}
                            className="h-10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all border border-white/5"
                        >
                            <Clock size={14} />
                            <span>{t.later}</span>
                        </button>
                        <button
                            onClick={handleCancel}
                            className="h-10 bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/60 text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center transition-all border border-white/5"
                        >
                            {t.cancel}
                        </button>
                    </div>
                </div>

                <div className="pt-1 flex justify-center relative z-10">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                        />
                        <div className={`w-4 h-4 border-2 rounded-md transition-all flex items-center justify-center ${dontShowAgain ? 'bg-orange-600 border-orange-600' : 'bg-white/5 border-white/30'}`}>
                            {dontShowAgain && <Check className="w-3 h-3 text-white" strokeWidth={5} />}
                        </div>
                        <span className="text-[9px] text-white/30 group-hover:text-white/60 transition-colors font-black uppercase tracking-[0.2em]">
                            {t.dontShow}
                        </span>
                    </label>
                </div>
            </motion.div>
        </main>
    );
}
