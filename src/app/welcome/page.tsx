'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShieldCheck, Zap, Mic2, Accessibility, BookOpen, AlertTriangle, ShieldAlert, Check, X, Info, Keyboard, UserCircle, Globe, Github, MessageCircle, Send, Instagram, Linkedin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { CONTENT, APP_VERSION } from '@/components/SettingsPanel';

type Tab = 'welcome' | 'perms' | 'help' | 'quarantine' | 'about';

export default function WelcomePage() {
    const [tab, setTab] = useState<Tab>('welcome');
    const [welcomeDoNotShowAgain, setWelcomeDoNotShowAgain] = useState(false);
    const [language, setLanguage] = useState<'ru' | 'en'>('ru');
    const [isLoaded, setIsLoaded] = useState(false);
    const [accGranted, setAccGranted] = useState<boolean | null>(null);
    const [micStatus, setMicStatus] = useState<number | null>(null); // 0: NotDetermined, 1: Restricted, 2: Denied, 3: Authorized

    useEffect(() => {
        setIsLoaded(true);
        
        const initLang = async () => {
            try {
                const savedLang = await invoke<'ru' | 'en'>('get_app_language');
                setLanguage(savedLang);
            } catch {
                if (navigator.language.startsWith('ru')) setLanguage('ru');
                else setLanguage('en');
            }
        };
        initLang();

        const checkPerms = async () => {
            try {
                const acc = await invoke<boolean>('check_accessibility');
                setAccGranted(acc);
                const mic = await invoke<number>('check_microphone_permission');
                setMicStatus(mic);
            } catch (e) {
                console.error(e);
            }
        };

        checkPerms();
        const interval = setInterval(checkPerms, 2000);
        return () => clearInterval(interval);
    }, []);

    const C = CONTENT[language];

    const handleExit = async () => {
        try {
            await invoke('set_welcome_seen', { version: APP_VERSION, seen: welcomeDoNotShowAgain });
            if (window.__TAURI_INTERNALS__) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                await win.close();
            }
        } catch (e) {
            console.error('Failed to close window:', e);
        }
    };

    const handleRequestMic = async () => {
        try {
            await invoke('request_microphone_permission');
        } catch (e) {
            console.error('Mic request failed:', e);
        }
    };

    const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
        { id: 'welcome', icon: <Info className="w-[12px] h-[12px]" />, label: language === 'ru' ? 'Старт' : 'Home' },
        { id: 'perms', icon: <ShieldCheck className="w-[12px] h-[12px]" />, label: language === 'ru' ? 'Права' : 'Privacy' },
        { id: 'help', icon: <BookOpen className="w-[12px] h-[12px]" />, label: language === 'ru' ? 'FAQ' : 'FAQ' },
        { id: 'about', icon: <UserCircle className="w-[12px] h-[12px]" />, label: language === 'ru' ? 'Автор' : 'About' },
        { id: 'quarantine', icon: <AlertTriangle className="w-[12px] h-[12px]" />, label: language === 'ru' ? 'Фикс' : 'Fix' },
    ];

    if (!isLoaded) return <div className="bg-[#121214] w-screen h-screen" />;

    return (
        <div
            className="w-screen h-screen flex flex-col pointer-events-auto overflow-hidden border border-white/10 rounded-[28px] relative bg-[#121214]"
        >
            {/* 1. ULTRA-COMPACT HEADER FOR 5 TABS */}
            <div data-tauri-drag-region className="flex items-center justify-between px-3 pt-4 pb-2 shrink-0 z-50">
                <div className="flex gap-0.5 p-0.5 bg-white/5 rounded-[12px] border border-white/5 overflow-x-auto no-scrollbar">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all whitespace-nowrap border ${tab === t.id
                                ? 'bg-white/10 text-white border-white/20 shadow-sm'
                                : 'text-white/40 hover:text-white/60 hover:bg-white/5 border-transparent'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleExit}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white transition-all shadow-lg shadow-black/20 shrink-0"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>

            {/* 2. SCROLLABLE AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-2" style={{ paddingBottom: '160px' }}>
                <AnimatePresence mode="wait">
                    {tab === 'welcome' && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="flex flex-col items-center justify-center min-h-full pb-10 text-center"
                        >
                            <div className="w-16 h-16 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative">
                                <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain drop-shadow-lg" />
                                <div className="absolute -bottom-1 -right-1 bg-orange-600 w-4 h-4 rounded-full flex items-center justify-center border-2 border-black/50">
                                    <Zap size={8} className="text-white" fill="white" />
                                </div>
                            </div>

                            <h1 className="text-[20px] font-black text-white uppercase italic tracking-[0.1em] leading-tight">
                                {C.welcome.title}
                            </h1>
                            <div className="w-16 h-1.5 bg-orange-600/60 rounded-full mt-4 mb-6 shadow-[0_0_15px_rgba(234,88,12,0.3)]" />

                            <p className="text-[13px] text-white/50 leading-relaxed max-w-[280px] font-bold italic">
                                {C.welcome.subtitle}
                            </p>

                            <div className="mt-8 w-full max-w-[340px] p-5 rounded-2xl bg-white/3 border border-white/10 space-y-4">
                                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] text-center mb-1">Production Release {C.about.version}</div>
                                <div className="flex flex-col gap-4 mx-auto w-fit">
                                    {[
                                        { icon: <Keyboard size={13} />, label: language === 'ru' ? '⌥ + Space (Запись / Вставка)' : '⌥ + Space (Record / Paste)', color: 'text-orange-500' },
                                        { icon: <Zap size={13} />, label: language === 'ru' ? 'Нейросетевая обработка голоса' : 'Neural Audio Engine', color: 'text-amber-500' },
                                        { icon: <ShieldCheck size={13} />, label: language === 'ru' ? 'Приватная безопасная архитектура' : 'Encrypted Privacy Protocol', color: 'text-blue-500' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-4 text-[13px] font-bold text-white/70">
                                            <div className={`${item.color} opacity-90 drop-shadow-md`}>{item.icon}</div>
                                            <span className="tracking-tight">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 w-full max-w-[340px] p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3 text-left">
                                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[11px] font-black text-orange-500 uppercase tracking-widest">{C.welcome.updateWarningTitle}</div>
                                    <div className="text-[11px] text-white/50 leading-snug mt-1 font-bold">
                                        {C.welcome.updateWarning}
                                    </div>
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
                                    id: 'acc',
                                    icon: <Accessibility className="text-orange-400" size={17} />,
                                    title: C.welcome.permAccess,
                                    desc: C.welcome.permAccessDesc,
                                    action: () => invoke('open_accessibility_settings'),
                                    granted: accGranted,
                                    btnLabel: language === 'ru' ? 'ВЫДАТЬ' : 'SET'
                                },
                                {
                                    id: 'mic',
                                    icon: <Mic2 className="text-emerald-400" size={17} />,
                                    title: C.welcome.permMic,
                                    desc: micStatus === 0 ? (language === 'ru' ? 'Будет запрошен при первой записи' : 'Will be requested on first record') : C.welcome.permMicDesc,
                                    action: micStatus === 0 ? handleRequestMic : () => invoke('open_microphone_settings'),
                                    granted: micStatus === 3,
                                    btnLabel: micStatus === 0 ? (language === 'ru' ? 'ЗАПРОС' : 'ASK') : (language === 'ru' ? 'НАСТРОЙКИ' : 'SETTINGS')
                                }
                            ].map((p, i) => (
                                <div key={i} className={`flex items-center gap-4 p-4 rounded-xl bg-white/5 border transition-all group ${p.granted ? 'border-green-500/50 hover:bg-green-500/5' : 'border-white/5 hover:bg-white/10'}`}>
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20">
                                        {p.granted ? <Check className="text-green-500" size={17} strokeWidth={3} /> : p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-black text-white/90">{p.title}</div>
                                        <div className="text-[11px] text-white/30 leading-snug mt-1 font-bold">{p.desc}</div>
                                    </div>
                                    <button
                                        onClick={p.action}
                                        className={`h-8 px-3 rounded-lg text-[10px] font-black transition-all border uppercase tracking-widest ${p.granted ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-white/5 hover:bg-orange-600 active:scale-95 text-white/70 hover:text-white border-white/10'}`}
                                    >
                                        {p.granted ? (language === 'ru' ? 'ВЫДАНО' : 'GRANTED') : p.btnLabel}
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {tab === 'help' && (
                        <motion.div
                            key="help"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-5 max-w-[380px] mx-auto"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-2">Technical Guide / FAQ</div>
                            {[
                                { q: C.welcome.faqQ1, a: C.welcome.faqA1 },
                                { q: C.welcome.faqQ2, a: C.welcome.faqA2 },
                                { q: C.welcome.faqQ3, a: C.welcome.faqA3 },
                                { q: C.welcome.faqQ4, a: C.welcome.faqA4 },
                            ].filter(f => f.q).map((f, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="text-[11px] font-black text-white/25 uppercase tracking-wider ml-1">{f.q}</div>
                                    <div className="p-4 rounded-xl bg-white/4 border border-white/5 text-[12px] text-white/50 leading-relaxed font-black italic">
                                        {f.a}
                                    </div>
                                    {i < 3 && <div className="w-full h-px bg-white/5 mt-4" />}
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {tab === 'about' && (
                        <motion.div
                            key="about"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2 space-y-5 max-w-[380px] mx-auto pb-4"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-2">{C.about.title}</div>

                            {/* App info */}
                            <div className="flex items-center gap-4 px-1">
                                <div className="w-[60px] h-[60px] rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shadow-xl overflow-hidden shrink-0 relative">
                                    <Image src="/logo.png" alt="NYX Vox" width={40} height={40} className="object-cover" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[20px] font-bold text-white tracking-widest uppercase italic">{C.about.app}</span>
                                        <span className="text-[12px] text-white/30 font-mono italic tracking-widest">{C.about.version}</span>
                                    </div>
                                    <div className="text-[11px] text-white/60 mt-1 leading-relaxed max-w-[260px] font-bold">{C.about.desc}</div>
                                </div>
                            </div>

                            {/* Creator card with social links */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{C.about.author}</div>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="text-[15px] font-black tracking-wider uppercase text-white">Aliaksei Patskevich</div>
                                        <div className="text-[11px] text-white/40 font-mono">Software Engineer • Code, Design & AI</div>
                                        <div className="text-[11px] text-white/50 mt-1 leading-relaxed font-bold">
                                            {language === 'ru'
                                                ? 'Проектирую и разрабатываю современные IT-решения на стыке интерфейсов и ИИ.'
                                                : 'Designing and building modern IT solutions at the intersection of UI and AI.'}
                                        </div>
                                    </div>
                                </div>
                                {/* Social links — icon only with glow */}
                                <div className="flex items-center gap-2 pt-2 flex-wrap">
                                    {([
                                        { title: 'avpdev.com', href: 'https://avpdev.com', icon: <Globe className="w-4 h-4" />, color: 'hover:text-sky-400   hover:shadow-[0_0_12px_rgba(56,189,248,0.5)]' },
                                        { title: 'GitHub', href: 'https://github.com/AVP-Dev', icon: <Github className="w-4 h-4" />, color: 'hover:text-white      hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]' },
                                        { title: 'Telegram', href: 'https://t.me/AVP_Dev', icon: <Send className="w-4 h-4" />, color: 'hover:text-sky-400   hover:shadow-[0_0_12px_rgba(56,189,248,0.5)]' },
                                        { title: 'Email', href: 'mailto:contact@avpdev.com', icon: <Send className="w-4 h-4" />, color: 'hover:text-emerald-400 hover:shadow-[0_0_12px_rgba(52,211,153,0.5)]' },
                                        { title: 'WhatsApp', href: 'https://wa.me/375291217371', icon: <MessageCircle className="w-4 h-4" />, color: 'hover:text-green-400  hover:shadow-[0_0_12px_rgba(74,222,128,0.5)]' },
                                        { title: 'Instagram', href: 'https://instagram.com/avpdev', icon: <Instagram className="w-4 h-4" />, color: 'hover:text-pink-400  hover:shadow-[0_0_12px_rgba(244,114,182,0.5)]' },
                                        { title: 'LinkedIn', href: 'https://www.linkedin.com/in/aliaksei-alexey-patskevich-545586b8', icon: <Linkedin className="w-4 h-4" />, color: 'hover:text-blue-400  hover:shadow-[0_0_12px_rgba(96,165,250,0.5)]' },
                                    ] as const).map(({ title, href, icon, color }) => (
                                        <a
                                            key={title}
                                            href={href}
                                            title={title}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => {
                                                e.preventDefault();
                                                const url = href;
                                                invoke('open_url', { url: url }).catch(() => window.open(url, '_blank'));
                                            }}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/40 transition-all duration-200 ${color}`}
                                        >
                                            {icon}
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* mission */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">{C.about.mission}</div>
                                <div className="text-[13px] text-white/50 italic leading-relaxed font-bold">&ldquo;{C.about.missionText}&rdquo;</div>
                            </div>

                            {/* stack */}
                            <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">{C.about.stack}</div>
                                <div className="flex flex-wrap gap-2">
                                    {['Next.js 16', 'Tauri 2', 'Whisper.cpp', 'Rust', 'TypeScript', 'cpal'].map(s => (
                                        <span key={s} className="px-2.5 py-1.5 rounded-lg bg-white/8 text-[11px] text-white/50 font-bold border border-white/5">{s}</span>
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
                            className="pt-2 max-w-[380px] mx-auto"
                        >
                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] ml-1 mb-4">Fix Issues</div>
                            <div className="p-5 rounded-2xl bg-red-600/5 border border-red-500/20 space-y-5 backdrop-blur-md">
                                <div className="flex items-start gap-4">
                                    <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="text-[14px] font-black text-white uppercase italic leading-none">{C.welcome.fixQuarantine}</div>
                                        <div className="text-[11px] text-white/35 leading-relaxed mt-3 font-bold">{C.welcome.fixQuarantineDesc}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => invoke('fix_quarantine')}
                                    className="w-full h-11 rounded-lg bg-red-600/20 hover:bg-red-600 active:scale-95 text-red-500 hover:text-white font-black text-[11px] uppercase tracking-[0.3em] transition-all border border-red-500/30 shadow-2xl"
                                >
                                    {C.welcome.fixBtn}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 3. CENTERED FOOTER DOCK */}
            <footer className="absolute bottom-0 left-0 right-0 p-6 bg-[#18181B] border-t border-white/10 flex flex-col items-center gap-5 z-50 rounded-b-[28px]">
                <div className="flex items-center gap-6">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {(['ru', 'en'] as const).map(l => (
                            <button
                                key={l}
                                onClick={() => {
                                    setLanguage(l);
                                    invoke('set_app_language', { lang: l });
                                }}
                                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all uppercase ${language === l ? 'bg-white/20 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    
                    <label className="flex items-center gap-3.5 cursor-pointer group opacity-90 hover:opacity-100 transition-opacity">
                        <div className="relative flex items-center justify-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={welcomeDoNotShowAgain}
                                onChange={(e) => setWelcomeDoNotShowAgain(e.target.checked)}
                            />
                            <div className={`w-4.5 h-4.5 border-2 rounded-md transition-all flex items-center justify-center ${welcomeDoNotShowAgain ? 'bg-orange-600 border-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.4)]' : 'bg-white/5 border-white/30 group-hover:border-white/50'}`}>
                                {welcomeDoNotShowAgain && <Check className="w-3.5 h-3.5 text-white" strokeWidth={5} />}
                            </div>
                        </div>
                        <span className="text-[10px] text-white/30 group-hover:text-white/60 transition-colors font-black uppercase tracking-widest">
                            {C.welcome.dontShow}
                        </span>
                    </label>
                </div>

                <button
                    onClick={handleExit}
                    className="w-full max-w-[280px] h-11 rounded-xl bg-[#F97316] hover:bg-orange-500 active:scale-[0.98] transition-all text-white font-black text-[13px] uppercase tracking-[0.25em] shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex items-center justify-center gap-3 group border border-white/10"
                >
                    <span>{C.welcome.startBtn}</span>
                    <Zap className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="currentColor" />
                </button>
            </footer>
        </div>
    );
}
