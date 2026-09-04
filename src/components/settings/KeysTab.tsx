import React from 'react';
import { ExternalLink, Eye, EyeOff, Check, X, HelpCircle, Copy, Cpu, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionTitle } from './Common';
import type { CustomModelsMap } from '@/lib/types';

interface ModelSlotConfig {
    slot: string;
    label: string;
    defaultModel: string;
    presets: string[];
}

const SERVICE_MODEL_SLOTS: Record<string, ModelSlotConfig[]> = {
    groq: [
        {
            slot: 'groq_format',
            label: 'Форматирование AI',
            defaultModel: 'llama-3.3-70b-versatile',
            presets: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']
        },
        {
            slot: 'groq_stt',
            label: 'Распознавание (STT)',
            defaultModel: 'whisper-large-v3-turbo',
            presets: ['whisper-large-v3-turbo', 'whisper-large-v3']
        }
    ],
    gemini: [
        {
            slot: 'gemini_format',
            label: 'Форматирование AI',
            defaultModel: 'gemini-3.8-flash',
            presets: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-flash']
        },
        {
            slot: 'gemini_stt',
            label: 'Распознавание (STT)',
            defaultModel: 'gemini-3.8-flash',
            presets: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']
        }
    ],
    deepseek: [
        {
            slot: 'deepseek_format',
            label: 'Форматирование AI',
            defaultModel: 'deepseek-v4-flash',
            presets: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner']
        }
    ],
    qwen: [
        {
            slot: 'qwen_format',
            label: 'Форматирование AI',
            defaultModel: 'qwen3.7-flash',
            presets: ['qwen3.7-flash', 'qwen3.7-plus', 'qwen-turbo', 'qwen-plus', 'qwen-max']
        }
    ],
    gigachat: [
        {
            slot: 'gigachat_format',
            label: 'Форматирование AI',
            defaultModel: 'GigaChat-2',
            presets: ['GigaChat-2', 'GigaChat-2-Pro', 'GigaChat-2-Max', 'GigaChat']
        },
        {
            slot: 'gigachat_stt',
            label: 'Распознавание (STT)',
            defaultModel: 'GigaChat-2-Pro',
            presets: ['GigaChat-2-Pro', 'GigaChat-2', 'GigaChat']
        }
    ]
};

interface KeysTabProps {
    c: {
        settings: {
            apiKeyLabel: string;
            groqApiKeyLabel: string;
            geminiApiKeyLabel: string;
            qwenApiKeyLabel: string;
            deepseekApiKeyLabel: string;
            gigachatApiKeyLabel: string;
            apiKeysTitle: string;
            howToChoose: string;
            apiKeyHowTo: string;
            apiKeyPlaceholder: string;
            apiKeySave: string;
            customModelLabel?: string;
            customModelPreset?: string;
            customModelCustom?: string;
            customModelPlaceholder?: string;
            resetToDefault?: string;
            keySteps?: Record<string, string[]>;
        };
    };
    dgApiKey: string; setDgApiKey: (v: string) => void;
    groqApiKey: string; setGroqApiKey: (v: string) => void;
    geminiApiKey: string; setGeminiApiKey: (v: string) => void;
    qwenApiKey: string; setQwenApiKey: (v: string) => void;
    deepseekApiKey: string; setDeepseekApiKey: (v: string) => void;
    gigachatApiKey: string; setGigachatApiKey: (v: string) => void;
    showKeys: Record<string, boolean>;
    setShowKeys: (v: React.SetStateAction<Record<string, boolean>>) => void;
    handleSaveKey: (service: string, key: string) => void;
    handleDeleteKey: (service: string) => void;
    savedStatus: Record<string, boolean>;
    setTab: (t: string) => void;
    customModels?: CustomModelsMap;
    handleSetCustomModel?: (slot: string, model: string) => void;
}

export const KeysTab: React.FC<KeysTabProps> = ({
    c, dgApiKey, setDgApiKey, groqApiKey, setGroqApiKey, geminiApiKey, setGeminiApiKey,
    qwenApiKey, setQwenApiKey, deepseekApiKey, setDeepseekApiKey, gigachatApiKey, setGigachatApiKey,
    showKeys, setShowKeys, handleSaveKey, handleDeleteKey, savedStatus, setTab,
    customModels = {}, handleSetCustomModel
}) => {
    const [copied, setCopied] = React.useState<string | null>(null);
    const [openGuide, setOpenGuide] = React.useState<string | null>(null);
    const [openModels, setOpenModels] = React.useState<string | null>(null);

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
        { id: 'gigachat', label: c.settings.gigachatApiKeyLabel, value: gigachatApiKey, setter: setGigachatApiKey, url: 'https://developers.sber.ru' },
    ];

    return (
        <div className="space-y-6">
            <SectionTitle>
                <div className="flex items-center justify-between w-full">
                    {c.settings.apiKeysTitle}
                    <button onClick={() => setTab('engines')} title={c.settings.howToChoose}>
                        <HelpCircle className="w-4 h-4 text-white/20 hover:text-muted cursor-help transition-colors" />
                    </button>
                </div>
            </SectionTitle>

            <div className="space-y-5">
                {services.map(service => {
                    const modelSlots = SERVICE_MODEL_SLOTS[service.id];
                    const isModelsOpen = openModels === service.id;

                    return (
                        <div key={service.id} className="space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                                    {service.label}
                                    {savedStatus[service.id] && <Check className="w-3 h-3 text-emerald-500/50" />}
                                </div>
                                <div className="flex items-center gap-3">
                                    {modelSlots && modelSlots.length > 0 && (
                                        <button 
                                            onClick={() => setOpenModels(isModelsOpen ? null : service.id)}
                                            className={`text-[10px] flex items-center gap-1 transition-colors font-bold ${isModelsOpen ? 'text-orange-400' : 'text-white/30 hover:text-muted'}`}
                                        >
                                            <Cpu className="w-2.5 h-2.5" />
                                            {c.settings.customModelLabel || 'Модели AI'}
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setOpenGuide(openGuide === service.id ? null : service.id)}
                                        className={`text-[10px] flex items-center gap-1.5 transition-colors font-bold ${openGuide === service.id ? 'text-cyan-400' : 'text-white/20 hover:text-muted'}`}
                                    >
                                        <HelpCircle className="w-2.5 h-2.5" />
                                        {c.settings.apiKeyHowTo}
                                    </button>
                                </div>
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
                                        className="w-full bg-surface border border-subtle rounded-xl pl-3 pr-20 py-2.5 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {service.value && (
                                            <button 
                                                onClick={() => handleCopy(service.value, service.id)} 
                                                className="text-white/20 hover:text-muted transition-colors"
                                                title="Copy API Key"
                                            >
                                                {copied === service.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setShowKeys((prev) => ({ ...prev, [service.id]: !prev[service.id] }))} 
                                            className="text-white/20 hover:text-muted transition-colors"
                                        >
                                            {showKeys[service.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={() => handleSaveKey(service.id, service.value)} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all min-w-[80px] flex justify-center items-center ${savedStatus[service.id] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-surface-hover hover:bg-white/15 text-primary'}`}>
                                    {savedStatus[service.id] ? <Check className="w-4 h-4" /> : c.settings.apiKeySave}
                                </button>
                                {service.value && (
                                    <button onClick={() => handleDeleteKey(service.id)} className="w-10 h-10 flex items-center justify-center bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl text-red-500/40 hover:text-red-400 transition-colors shrink-0">
                                        <X className="w-4 h-4" strokeWidth={3} />
                                    </button>
                                )}
                            </div>

                            <AnimatePresence>
                                {isModelsOpen && modelSlots && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-3 rounded-xl bg-surface border border-subtle space-y-3 mt-1">
                                            {modelSlots.map(slotConfig => {
                                                const currentVal = (customModels && customModels[slotConfig.slot]) || '';
                                                const activeModel = currentVal || slotConfig.defaultModel;
                                                const isCustom = !slotConfig.presets.includes(activeModel);

                                                return (
                                                    <div key={slotConfig.slot} className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="text-white/80 font-medium">{slotConfig.label}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-orange-400/90 text-[10px]">
                                                                    {activeModel}
                                                                </span>
                                                                {currentVal && (
                                                                    <button
                                                                        onClick={() => handleSetCustomModel?.(slotConfig.slot, '')}
                                                                        title={c.settings.resetToDefault || 'Сброс'}
                                                                        className="text-white/30 hover:text-white transition-colors"
                                                                    >
                                                                        <RotateCcw className="w-2.5 h-2.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1.5 items-center">
                                                            <select
                                                                value={isCustom ? '__custom__' : activeModel}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val !== '__custom__') {
                                                                        handleSetCustomModel?.(slotConfig.slot, val === slotConfig.defaultModel ? '' : val);
                                                                    }
                                                                }}
                                                                className="bg-surface-hover border border-subtle rounded-lg px-2 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-white/30 font-mono flex-1 cursor-pointer"
                                                            >
                                                                {slotConfig.presets.map(p => (
                                                                    <option key={p} value={p}>
                                                                        {p} {p === slotConfig.defaultModel ? '(default)' : ''}
                                                                    </option>
                                                                ))}
                                                                <option value="__custom__">
                                                                    {c.settings.customModelCustom || 'Своя модель...'}
                                                                </option>
                                                            </select>
                                                            {isCustom && (
                                                                <input
                                                                    type="text"
                                                                    value={currentVal}
                                                                    onChange={(e) => handleSetCustomModel?.(slotConfig.slot, e.target.value)}
                                                                    placeholder={c.settings.customModelPlaceholder || 'deepseek-chat'}
                                                                    className="flex-1 bg-surface-hover border border-subtle rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-white/30 font-mono"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
