"use client";

import React, { useState } from 'react';
import { X, Bug, Lightbulb, MessageSquare, Send, CheckCircle } from 'lucide-react';

type FeedbackType = 'bug' | 'feature' | 'other';
type Status = 'idle' | 'sending' | 'success' | 'error';

interface Props {
    onClose: () => void;
}

const TYPES: { id: FeedbackType; ruLabel: string; enLabel: string; icon: React.ReactNode }[] = [
    { id: 'bug', ruLabel: '🐛 Ошибка', enLabel: '🐛 Bug', icon: <Bug className="w-3.5 h-3.5" /> },
    { id: 'feature', ruLabel: '💡 Идея', enLabel: '💡 Feature', icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'other', ruLabel: '💬 Другое', enLabel: '💬 Other', icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

export function FeedbackModal({ onClose }: Props) {
    const [lang, setLang] = useState<'ru' | 'en'>('ru');
    const [type, setType] = useState<FeedbackType>('bug');
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<Status>('idle');

    const ru = lang === 'ru';
    const typeObj = TYPES.find(t => t.id === type)!;

    const handleSend = async () => {
        if (!message.trim() || status === 'sending') return;
        setStatus('sending');

        const payload = {
            type: typeObj.enLabel,
            name: name.trim() || 'Anonymous',
            contact: contact.trim() || '—',
            message: message.trim(),
            app: 'NYX VOX v0.1.0-beta',
        };

        // Formspree endpoint — self-contained, no backend needed
        // Replace FORM_ID with your actual Formspree form ID
        // Sign up free at formspree.io -> Create Form -> copy the ID
        const FORMSPREE_URL = 'https://formspree.io/f/contact@avpdev.com';

        try {
            const res = await fetch(FORMSPREE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setStatus('success');
                setTimeout(onClose, 2500);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch {
            // Fallback: open mailto if Formspree fails (offline / no URL configured)
            const subject = encodeURIComponent(`[NYX VOX] ${typeObj.enLabel}`);
            const body = encodeURIComponent(
                `Type: ${typeObj.enLabel}\nFrom: ${payload.name}\nContact: ${payload.contact}\n\n${payload.message}\n\n---\nApp: ${payload.app}`
            );
            const mailto = `mailto:contact@avpdev.com?subject=${subject}&body=${body}`;

            if (window.__TAURI_INTERNALS__) {
                import('@tauri-apps/plugin-shell').then(({ open }) => open(mailto));
            } else {
                window.open(mailto, '_blank');
            }
            setStatus('success');
            setTimeout(onClose, 2000);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-end justify-center pointer-events-auto pb-4"
            onClick={onClose}
        >
            <div
                className="w-[460px] bg-[#0D0D0F] border border-white/10 rounded-[20px] shadow-[0_-8px_60px_rgba(0,0,0,0.9)] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-2.5 pb-0">
                    <div className="w-8 h-1 rounded-full bg-white/15" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-2 pb-3">
                    <div>
                        <h2 className="text-[14px] font-bold text-white">
                            {ru ? 'Обратная связь' : 'Feedback'}
                        </h2>
                        <p className="text-[11px] text-white/35 mt-0.5">
                            {ru ? 'Поможет сделать NYX VOX лучше' : 'Help us make NYX VOX better'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setLang(l => l === 'ru' ? 'en' : 'ru')}
                            className="px-2 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-white/40 hover:text-white/70 transition-colors uppercase tracking-widest"
                        >
                            {lang}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/6 hover:bg-white/15 text-white/40 hover:text-white transition-all"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="h-px bg-white/6" />

                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                        <p className="text-[14px] font-semibold text-white/80">
                            {ru ? 'Отправлено! Спасибо 🙏' : 'Sent! Thank you 🙏'}
                        </p>
                        <p className="text-[11px] text-white/30">contact@avpdev.com</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                            {TYPES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setType(t.id)}
                                    className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 border ${type === t.id
                                        ? 'bg-white/15 border-white/25 text-white'
                                        : 'border-white/8 text-white/35 hover:text-white/60 hover:bg-white/5'
                                        }`}
                                >
                                    {ru ? t.ruLabel : t.enLabel}
                                </button>
                            ))}
                        </div>

                        {/* Name */}
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={ru ? 'Имя (необязательно)' : 'Name (optional)'}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
                        />

                        {/* Contact */}
                        <input
                            value={contact}
                            onChange={e => setContact(e.target.value)}
                            placeholder={ru ? 'Email / Telegram (необязательно)' : 'Email / Telegram (optional)'}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
                        />

                        {/* Message */}
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={
                                ru
                                    ? (type === 'bug' ? 'Шаги для воспроизведения ошибки...' : 'Опишите вашу идею...')
                                    : (type === 'bug' ? 'Steps to reproduce the bug...' : 'Describe your idea...')
                            }
                            rows={4}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none"
                        />

                        {/* Send */}
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || status === 'sending'}
                            className="w-full py-2.5 rounded-xl bg-white/90 hover:bg-white text-black text-[12px] font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {status === 'sending' ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    {ru ? 'Отправка...' : 'Sending...'}
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    {ru ? 'Отправить' : 'Send'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
