import React from 'react';
import { ExternalLink, Eye, EyeOff, Check, X, HelpCircle, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionTitle } from './Common';

interface KeysTabProps {
    c: {
        settings: {
            apiKeyLabel: string;
            groqApiKeyLabel: string;
            geminiApiKeyLabel: string;
            qwenApiKeyLabel: string;
            deepseekApiKeyLabel: string;
            apiKeysTitle: string;
            howToChoose: string;
            apiKeyHowTo: string;
            apiKeyPlaceholder: string;
            apiKeySave: string;
            keySteps?: Record<string, string[]>;
        };
    };
    dgApiKey: string; setDgApiKey: (v: string) => void;
    groqApiKey: string; setGroqApiKey: (v: string) => void;
    geminiApiKey: string; setGeminiApiKey: (v: string) => void;
    qwenApiKey: string; setQwenApiKey: (v: string) => void;
    deepseekApiKey: string; setDeepseekApiKey: (v: string) => void;
    showKeys: Record<string, boolean>;
    setShowKeys: (v: React.SetStateAction<Record<string, boolean>>) => void;
    handleSaveKey: (service: string, key: string) => void;
    handleDeleteKey: (service: string) => void;
    savedStatus: Record<string, boolean>;
    setTab: (t: string) => void;
}

export const KeysTab: React.FC<KeysTabProps> = ({
    c, dgApiKey, setDgApiKey, groqApiKey, setGroqApiKey, geminiApiKey, setGeminiApiKey,
    qwenApiKey, setQwenApiKey, deepseekApiKey, setDeepseekApiKey,
    showKeys, setShowKeys, handleSaveKey, handleDeleteKey, savedStatus, setTab
}) => {
    const [copied, setCopied] = React.useState<string | null>(null);
    const [openGuide, setOpenGuide] = React.useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const services = [
        { id: 'deepgram', label: c.settings.apiKeyLabel, value: dgApiKey, setter: setDgApiKey, url: 'https://console.deepgram.com' },
        { id: 'groq', label: c.settings.groqApiKeyLabel, value: groqApiKey, setter: setGroqApiKey, url: 'https://console.groq.com/keys' },
        { id: 'gemini', label: c.settings.geminiApiKeyLabel, value: geminiApiKey, setter: setGeminiApiKey, url: 'https://aistudio.google.com/app/apikey' },
        { id: 'qwen', label: c.settings.qwenApiKeyLabel, value: qwenApiKey, setter: setQwenApiKey, url: 'https://dashscope.console.aliyun.com/apiKey' },
        { id: 'deepseek', label: c.settings.deepseekApiKeyLabel, value: deepseekApiKey, setter: setDeepseekApiKey, url: 'https://platform.deepseek.com' },
    ];

    return (
        <div className="space-y-6">
            <SectionTitle>
                <div className="flex items-center justify-between w-full">
                    {c.settings.apiKeysTitle}
                    <button onClick={() => setTab('engines')} title={c.settings.howToChoose}>
                        <HelpCircle className="w-4 h-4 text-white/20 hover:text-white/40 cursor-help transition-colors" />
                    </button>
                </div>
            </SectionTitle>

            <div className="space-y-5">
                {services.map(service => (
                    <div key={service.id} className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                                {service.label}
                                {savedStatus[service.id] && <Check className="w-3 h-3 text-emerald-500/50" />}
                            </div>
                            <button 
                                onClick={() => setOpenGuide(openGuide === service.id ? null : service.id)}
                                className={`text-[10px] flex items-center gap-1.5 transition-colors font-bold ${openGuide === service.id ? 'text-cyan-400' : 'text-white/20 hover:text-white/40'}`}
                            >
                                <HelpCircle className="w-2.5 h-2.5" />
                                {c.settings.apiKeyHowTo}
                            </button>
                        </div>

                        <AnimatePresence>
                            {openGuide === service.id && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }} 
                                    animate={{ height: 'auto', opacity: 1 }} 
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 mb-2 rounded-xl bg-cyan-500/5 border border-cyan-500/10 space-y-1.5">
                                        {(c.settings.keySteps?.[service.id] || []).map((step: string, i: number) => (
                                            <div key={i} className="flex items-start gap-2 text-[10px] text-cyan-400/70 font-medium">
                                                <span className="opacity-40">{i+1}.</span>
                                                <span>{step}</span>
                                            </div>
                                        ))}
                                        <a href={service.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold mt-1 pt-1 border-t border-cyan-500/10 w-full">
                                            <ExternalLink className="w-2.5 h-2.5" />
                                            {service.id === 'deepgram' ? 'console.deepgram.com' : 'Open Dashboard'}
                                        </a>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type={showKeys[service.id] ? 'text' : 'password'}
                                    value={service.value} 
                                    onChange={(e) => service.setter(e.target.value)}
                                    placeholder={c.settings.apiKeyPlaceholder}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-3 pr-20 py-2.5 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {service.value && (
                                        <button 
                                            onClick={() => handleCopy(service.value, service.id)} 
                                            className="text-white/20 hover:text-white/50 transition-colors"
                                            title="Copy API Key"
                                        >
                                            {copied === service.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setShowKeys((prev) => ({ ...prev, [service.id]: !prev[service.id] }))} 
                                        className="text-white/20 hover:text-white/50 transition-colors"
                                    >
                                        {showKeys[service.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => handleSaveKey(service.id, service.value)} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all min-w-[80px] flex justify-center items-center ${savedStatus[service.id] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/10 hover:bg-white/15 text-white/80'}`}>
                                {savedStatus[service.id] ? <Check className="w-4 h-4" /> : c.settings.apiKeySave}
                            </button>
                            {service.value && (
                                <button onClick={() => handleDeleteKey(service.id)} className="w-10 h-10 flex items-center justify-center bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl text-red-500/40 hover:text-red-400 transition-colors shrink-0">
                                    <X className="w-4 h-4" strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
