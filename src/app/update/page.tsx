'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Zap, Check, Github as GithubIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

export default function UpdatePage() {
    const [latestVersion, setLatestVersion] = useState('');
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    
    useEffect(() => {
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
    }[language] || {
        title: 'НОВАЯ ВЕРСИЯ!',
        ver: `Версия ${latestVersion} доступна`,
        download: 'СКАЧАТЬ ИЗ GITHUB',
        later: 'Напомнить позже',
        cancel: 'Отмена',
        dontShow: 'Больше не показывать'
    };

    return (
        <main className="w-screen h-screen flex items-center justify-center bg-transparent overflow-hidden pointer-events-none p-0">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full bg-[#0F0F11] border border-white/10 flex flex-col pointer-events-auto relative overflow-hidden rounded-[32px]"
            >
                {/* Drag Region */}
                <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-16 cursor-grab active:cursor-grabbing z-0" />

                <div className="flex-1 flex flex-col p-6 justify-between relative z-10">
                    {/* Top Section */}
                    <div className="flex items-center gap-4 mt-1">
                        <div className="w-12 h-12 rounded-[18px] bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                            <Zap size={24} className="text-orange-500" fill="currentColor" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <div className="text-[15px] font-black text-white uppercase tracking-wider leading-none">{t.title}</div>
                            <div className="text-[11px] text-white/40 font-bold italic tracking-tight">{t.ver}</div>
                        </div>
                    </div>

                    {/* Middle Section: Actions */}
                    <div className="flex flex-col gap-2.5 w-full my-4">
                        <button
                            onClick={handleDownload}
                            className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-white text-[12px] font-black uppercase tracking-[0.18em] rounded-[18px] flex items-center justify-center gap-3 shadow-[0_6px_20px_rgba(234,88,12,0.25)] transition-all active:scale-[0.98]"
                        >
                            <GithubIcon size={16} />
                            <span>{t.download}</span>
                        </button>

                        <button
                            onClick={handleLater}
                            className="w-full h-12 bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white text-[11px] font-black uppercase tracking-widest rounded-[18px] flex items-center justify-center gap-2.5 transition-all border border-white/[0.05]"
                        >
                            <Clock size={14} className="opacity-40" />
                            <span>{t.later}</span>
                        </button>
                    </div>

                    {/* Bottom Section */}
                    <div className="flex items-center justify-between px-0.5 mb-1">
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                            />
                            <div className={`w-4 h-4 border rounded-md transition-all flex items-center justify-center ${dontShowAgain ? 'bg-orange-600 border-orange-600' : 'bg-white/5 border-white/20'}`}>
                                {dontShowAgain && <Check className="w-3 h-3 text-white" strokeWidth={5} />}
                            </div>
                            <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors font-bold uppercase tracking-[0.15em]">
                                {t.dontShow}
                            </span>
                        </label>

                        <button
                            onClick={handleCancel}
                            className="text-[10px] font-black text-white/10 hover:text-white/40 uppercase tracking-[0.25em] transition-colors"
                        >
                            {t.cancel}
                        </button>
                    </div>
                </div>

                {/* Subtle bottom flourish */}
                <div className="absolute bottom-0 h-[1.5px] w-full bg-gradient-to-r from-transparent via-orange-500/10 to-transparent" />
            </motion.div>
        </main>
    );
}
