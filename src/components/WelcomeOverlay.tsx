'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ShieldCheck, Zap, Mic2, Accessibility, BookOpen, AlertTriangle, ShieldAlert, Check, X, Info, Keyboard, UserCircle, Globe, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { CONTENT } from './SettingsPanel';
import { APP_VERSION } from '@/constants/version';
import { CREATOR_INFO, APP_DESCRIPTION, MISSION, FUTURE_ITEMS } from '@/constants/appInfo';

type Tab = 'welcome' | 'perms' | 'help' | 'quarantine' | 'about';

interface WelcomeOverlayProps {
    onClose: () => void;
    appLanguage: 'ru' | 'en';
    onLanguageToggle: () => void;
}

export function WelcomeOverlay({ onClose, appLanguage, onLanguageToggle }: WelcomeOverlayProps) {
    const [tab, setTab] = useState<Tab>('welcome');
    const [welcomeDoNotShowAgain, setWelcomeDoNotShowAgain] = useState(false);
    const [accGranted, setAccGranted] = useState<boolean | null>(null);
    const [micGranted, setMicGranted] = useState<boolean | null>(null);

    // Focus back when granted
    useEffect(() => {
        if (micGranted === true || accGranted === true) {
            getCurrentWindow().show().then(() => {
                getCurrentWindow().setFocus();
            });
        }
    }, [micGranted, accGranted]);

    useEffect(() => {
        const checkPerms = async () => {
            try {
                const acc = await invoke<boolean>('check_accessibility');
                setAccGranted(acc);
                const mic = await invoke<boolean>('check_microphone_permission');
                setMicGranted(mic);
            } catch (e) {
                console.error(e);
            }
        };

        checkPerms();
        const interval = setInterval(checkPerms, 2000);
        return () => clearInterval(interval);
    }, []);

    const C = CONTENT[appLanguage];

    const handleExit = async () => {
        try {
            await invoke('set_welcome_seen', { version: APP_VERSION, seen: welcomeDoNotShowAgain });
            onClose();
        } catch (e) {
            console.error('Failed to mark welcome as seen:', e);
            onClose();
        }
    };

    const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
        { id: 'welcome', icon: <Info className="w-[12px] h-[12px]" />, label: appLanguage === 'ru' ? 'Старт' : 'Home' },
        { id: 'perms', icon: <ShieldCheck className="w-[12px] h-[12px]" />, label: appLanguage === 'ru' ? 'Права' : 'Privacy' },
        { id: 'help', icon: <BookOpen className="w-[12px] h-[12px]" />, label: appLanguage === 'ru' ? 'FAQ' : 'FAQ' },
        { id: 'about', icon: <UserCircle className="w-[12px] h-[12px]" />, label: appLanguage === 'ru' ? 'Автор' : 'About' },
        { id: 'quarantine', icon: <AlertTriangle className="w-[12px] h-[12px]" />, label: appLanguage === 'ru' ? 'Фикс' : 'Fix' },
    ];

    return (
        <div className="w-full h-full flex flex-col pointer-events-auto overflow-hidden bg-[#18181B] border border-white/10 rounded-[28px] relative shadow-none">
            {/* GLASSMORPHISM BACKGROUND */}
            <div className="absolute inset-0 z-0 pointer-events-none" style={{ backdropFilter: 'blur(32px) saturate(180%)' }} />

            {/* HEADER */}
            <div data-tauri-drag-region className="flex items-center justify-center px-4 pt-4 pb-2 shrink-0 z-10 transition-colors relative">
                <div className="flex gap-0.5 p-1 bg-white/5 rounded-xl border border-white/5">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${tab === t.id
                                ? 'bg-white/10 text-white'
                                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleExit}
                    className="absolute right-4 top-5 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all shrink-0 border border-white/5"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-2 z-10 font-sans" style={{ paddingBottom: '100px' }}>
                <AnimatePresence mode="wait">
                    {tab === 'welcome' && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="flex flex-col items-center justify-center min-h-full pb-6 text-center"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 relative">
                                <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" />
                                <div className="absolute -bottom-1 -right-1 bg-orange-600 w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-black/50">
                                    <Zap size={7} className="text-white" fill="white" />
                                </div>
                            </div>

                            <h1 className="text-[18px] font-black text-white uppercase italic tracking-[0.1em] leading-tight">
                                {C.welcome.title}
                            </h1>
                            <div className="w-12 h-1 bg-orange-600/60 rounded-full mt-3 mb-4" />

                            <p className="text-[12px] text-white/50 leading-relaxed max-w-[280px] font-bold italic">
                                {C.welcome.subtitle}
                            </p>

                            <div className="mt-6 w-full max-w-[340px] p-4 rounded-xl bg-white/3 border border-white/10 space-y-3">
                                <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] text-center mb-0.5">Production Release v{APP_VERSION}</div>
                                <div className="flex flex-col gap-3 mx-auto w-fit">
                                    {[
                                        { icon: <Zap size={12} />, label: appLanguage === 'ru' ? 'Мгновенная скорость (Groq/Deepgram)' : 'Instant Speed (Groq/Deepgram)', color: 'text-orange-500' },
                                        { icon: <ShieldCheck size={12} />, label: appLanguage === 'ru' ? 'Приватная безопасная архитектура' : 'Secure Privacy Architecture', color: 'text-emerald-500' },
                                        { icon: <Keyboard size={12} />, label: appLanguage === 'ru' ? '⌥ + Space — Старт / Стоп / Вставка' : '⌥ + Space — Start / Stop / Paste', color: 'text-blue-500' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-[12px] font-bold text-white/70">
                                            <div className={`${item.color} opacity-90 drop-shadow-md`}>{item.icon}</div>
                                            <span className="tracking-tight">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {tab === 'perms' && (
                        <motion.div
                            key="perms"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-2.5 max-w-[380px] mx-auto"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 mb-2">{C.welcome.permTitle}</div>
                            {[
                                {
                                    icon: <Accessibility className="text-orange-400" size={17} />,
                                    title: C.welcome.permAccess,
                                    desc: C.welcome.permAccessDesc,
                                    cmd: 'open_accessibility_settings',
                                    granted: accGranted
                                },
                                {
                                    icon: <Mic2 className="text-emerald-400" size={17} />,
                                    title: C.welcome.permMic,
                                    desc: C.welcome.permMicDesc,
                                    cmd: 'open_microphone_settings',
                                    granted: micGranted
                                }
                            ].map((p, i) => (
                                <div key={i} className={`flex items-center gap-4 p-4 rounded-xl bg-white/5 border transition-all group ${p.granted ? 'border-green-500/50 hover:bg-green-500/5' : 'border-white/5 hover:bg-white/10'}`}>
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20">
                                        {p.granted ? <Check className="text-green-500" size={17} strokeWidth={3} /> : p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <div className="text-[13px] font-black text-white/90 leading-tight">{p.title}</div>
                                        <div className="text-[11px] text-white/30 leading-snug mt-1 font-bold italic line-clamp-2">{p.desc}</div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 shrink-0 min-w-[70px]">
                                        <button
                                            onClick={() => invoke(p.cmd)}
                                            className={`h-7 px-4 rounded-lg text-[9px] font-black transition-all border uppercase tracking-[0.1em] ${p.granted ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-orange-600 text-white border-orange-500 shadow-[0_2px_8px_rgba(234,88,12,0.3)] active:scale-95'}`}
                                        >
                                            {p.granted ? (appLanguage === 'ru' ? 'OK' : 'OK') : (appLanguage === 'ru' ? 'ВКЛ' : 'ON')}
                                        </button>
                                        
                                        {p.cmd === 'open_accessibility_settings' && (
                                            <button
                                                onClick={async () => {
                                                    await invoke('reset_accessibility_permissions');
                                                    alert(C.settings.accessibilityResetAlert);
                                                }}
                                                className="text-[8px] font-black text-red-500/60 hover:text-red-500 transition-colors uppercase tracking-[0.15em] border-b border-red-500/20 hover:border-red-500/50 pb-0.5"
                                            >
                                                {appLanguage === 'ru' ? 'СБРОСИТЬ' : 'RESET'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {tab === 'help' && (
                        <motion.div
                            key="help"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-4 max-w-[380px] mx-auto"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-2">Technical Guide / FAQ</div>
                            {[
                                { q: C.settings.faqQ1, a: C.settings.faqA1 },
                                { q: C.settings.faqQ2, a: C.settings.faqA2 },
                                { q: C.settings.faqQ3, a: C.settings.faqA3 },
                                { q: C.welcome.faqQ4, a: C.welcome.faqA4 },
                            ].filter(f => f.q).map((f, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="text-[11px] font-black text-white/25 uppercase tracking-wider ml-1">{f.q}</div>
                                    <div className="p-4 rounded-xl bg-white/4 border border-white/5 text-[12px] text-white/50 leading-relaxed font-bold italic opacity-80 hover:opacity-100 transition-opacity">
                                        {f.a}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {tab === 'about' && (
                        <motion.div
                            key="about"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-4 max-w-[380px] mx-auto pb-4"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-2">{C.about.title}</div>
                            <div className="flex items-center gap-4 px-1">
                                <div className="w-[60px] h-[60px] rounded-[16px] border border-white/10 flex items-center justify-center shadow-xl overflow-hidden shrink-0 relative bg-white/5">
                                    <Image src="/logo.png" alt="NYX Vox" width={48} height={48} className="object-cover opacity-80" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[20px] font-bold text-white tracking-tight">{C.about.app}</span>
                                        <span className="text-[12px] text-white/30 font-mono">v{APP_VERSION}</span>
                                    </div>
                                    <div className="text-[12px] text-white/50 mt-0.5 leading-relaxed font-medium">{APP_DESCRIPTION[appLanguage]}</div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest leading-none">{C.about.author}</div>
                                <div>
                                    <div className="text-[15px] font-bold text-white tracking-tight">{CREATOR_INFO.name}</div>
                                    <div className="text-[11px] text-white/40 font-mono mt-0.5 leading-none">{CREATOR_INFO.role}</div>
                                </div>
                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                    {CREATOR_INFO.links.map((s, i) => (
                                        <a 
                                            key={i} 
                                            href={s.href} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            title={s.title}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/30 transition-all duration-200 ${s.color} hover:bg-white/10`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                invoke('open_url', { url: s.href }).catch(() => window.open(s.href, '_blank'));
                                            }}
                                        >
                                            {s.icon}
                                        </a>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">{C.about.mission}</div>
                                <div className="text-[13px] text-white/80 italic leading-relaxed font-medium">&ldquo;{MISSION[appLanguage]}&rdquo;</div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{C.about.future}</div>
                                <div className="space-y-1.5">
                                    {FUTURE_ITEMS[appLanguage].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[12px] text-white/50 font-bold italic">
                                            <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {tab === 'quarantine' && (
                        <motion.div
                            key="quarantine"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-4 max-w-[380px] mx-auto pb-4"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-2">{C.welcome.troubleshootTitle}</div>
                            <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                        <ShieldAlert className="text-red-500" size={20} />
                                    </div>
                                    <div className="text-[14px] font-black text-white uppercase tracking-wider">{C.welcome.fixQuarantine}</div>
                                </div>
                                <p className="text-[12px] text-white/40 leading-relaxed font-bold italic">
                                    {C.welcome.fixQuarantineDesc}
                                </p>
                                <button
                                    onClick={() => invoke('fix_quarantine').catch(console.error)}
                                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-[11px] uppercase tracking-[0.2em] border border-white/10 transition-all active:scale-95"
                                >
                                    {C.welcome.fixBtn}
                                </button>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/3 border border-white/5 space-y-3">
                                <div className="text-[11px] font-black text-white/30 uppercase tracking-widest">{C.welcome.updateWarningTitle}</div>
                                <p className="text-[12px] text-white/40 leading-relaxed font-bold italic">{C.welcome.updateWarning}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* FOOTER */}
            <footer className="absolute bottom-0 left-0 right-0 p-3 bg-[#18181B] border-t border-white/5 flex flex-col items-center gap-3 z-20 rounded-b-[28px] shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={welcomeDoNotShowAgain}
                            onChange={(e) => setWelcomeDoNotShowAgain(e.target.checked)}
                        />
                        <div className={`w-4 h-4 border-2 rounded-md transition-all flex items-center justify-center ${welcomeDoNotShowAgain ? 'bg-orange-600 border-orange-600' : 'bg-white/5 border-white/20 group-hover:border-white/40'}`}>
                            {welcomeDoNotShowAgain && <Check className="w-3 h-3 text-white" strokeWidth={5} />}
                        </div>
                        <span className="text-[9px] text-white/30 group-hover:text-white/60 transition-colors font-black uppercase tracking-widest">
                            {C.welcome.dontShow}
                        </span>
                    </label>

                    <div className="w-[1px] h-3 bg-white/10" />

                    <button
                        onClick={onLanguageToggle}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                    >
                        <Globe className="w-3 h-3 text-white/30" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{appLanguage}</span>
                    </button>
                </div>

                <button
                    onClick={handleExit}
                    className="w-full max-w-[240px] h-10 rounded-xl bg-[#F97316] hover:bg-orange-500 active:scale-[0.98] transition-all text-white font-black text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border border-white/10 shrink-0 shadow-[0_4px_12px_rgba(249,115,22,0.3)]"
                >
                    <span>{C.welcome.startBtn}</span>
                    <Zap className="w-3.5 h-3.5" fill="currentColor" />
                </button>
            </footer>
        </div>
    );
}
