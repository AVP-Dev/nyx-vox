import React from 'react';
import { Wifi, Zap, Globe, HardDrive, HelpCircle, Check, Loader2, Download, Trash, Pause, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionTitle } from './Common';

type FormattingMode = 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq';

interface EngineInfo {
    title: string;
    badge: string;
    type: string;
    desc: string;
}

export interface EngineHelp {
    ru: Record<string, EngineInfo>;
    en: Record<string, EngineInfo>;
}

interface EnginesTabProps {
    c: Record<string, any>;
    lang: string;
    sttMode: 'deepgram' | 'whisper' | 'groq' | 'gemini';
    handleModeChange: (mode: 'deepgram' | 'whisper' | 'groq' | 'gemini') => void;
    showHelp: string | null;
    setShowHelp: (v: string | null) => void;
    ENGINE_HELP: EngineHelp;
    dgLanguage: 'auto' | 'ru' | 'en';
    whisperLanguage: 'auto' | 'ru' | 'en';
    groqLanguage: 'auto' | 'ru' | 'en';
    handleLanguageChange: (lang: 'auto' | 'ru' | 'en') => void;
    formattingMode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq';
    handleFormattingModeChange: (mode: 'none' | 'gemini' | 'deepseek' | 'qwen' | 'groq') => void;
    whisperModel: 'small' | 'medium' | 'turbo';
    handleWhisperModelChange: (model: 'small' | 'medium' | 'turbo') => void;
    modelAvailable: boolean;
    downloading: boolean;
    downloadProgress: string;
    handleDownload: () => void;
    handleDeleteModel: () => void;
    isPaused: boolean;
    handlePause: () => void;
    handleResume: () => void;
    handleCancel: () => void;
}

export const EnginesTab: React.FC<EnginesTabProps> = ({
    c, lang, sttMode, handleModeChange, showHelp, setShowHelp, ENGINE_HELP,
    dgLanguage, whisperLanguage, groqLanguage, handleLanguageChange,
    formattingMode, handleFormattingModeChange, whisperModel, handleWhisperModelChange,
    modelAvailable, downloading, downloadProgress, handleDownload, handleDeleteModel,
    isPaused, handlePause, handleResume, handleCancel
}) => {
    return (
        <div className="space-y-5">
            <div>
                <SectionTitle>
                    <div className="flex items-center justify-between w-full">
                        {c.settings.sttMode}
                        <button onClick={() => setShowHelp(showHelp === 'engines' ? null : 'engines')} className="hover:text-white/60 transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </SectionTitle>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <EngineButton 
                        active={sttMode === 'deepgram'} 
                        icon={<Wifi className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'deepgram' ? 'text-white/80' : 'text-white/30'}`} />} 
                        label={c.settings.deepgramLabel} 
                        desc={c.settings.deepgramDesc} 
                        onClick={() => handleModeChange('deepgram')}
                        activeColor="border-white/20"
                    />
                    <EngineButton 
                        active={sttMode === 'groq'} 
                        icon={<Zap className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'groq' ? 'text-amber-400' : 'text-white/30'}`} />} 
                        label={c.settings.groqLabel} 
                        desc={c.settings.groqDesc} 
                        onClick={() => handleModeChange('groq')}
                        activeColor="border-amber-500/30"
                        activeLabelColor="text-amber-400/90"
                    />
                    <EngineButton 
                        active={sttMode === 'gemini'} 
                        icon={<Globe className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'gemini' ? 'text-sky-400' : 'text-white/30'}`} />} 
                        label={c.settings.geminiLabel} 
                        desc={c.settings.geminiDesc} 
                        onClick={() => handleModeChange('gemini')}
                        activeColor="border-sky-500/30"
                        activeLabelColor="text-sky-400/90"
                    />
                    <EngineButton 
                        active={sttMode === 'whisper'} 
                        icon={<HardDrive className={`w-4 h-4 mb-1.5 shrink-0 ${sttMode === 'whisper' ? 'text-white/80' : 'text-white/30'}`} />} 
                        label={c.settings.whisperLabel} 
                        desc={c.settings.whisperDesc} 
                        onClick={() => handleModeChange('whisper')}
                        activeColor="border-white/20"
                    />
                </div>
            </div>

            <AnimatePresence>
                {showHelp === 'engines' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-5 overflow-hidden">
                        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-4">
                            {Object.entries(ENGINE_HELP[lang as keyof EngineHelp]).filter(([k]) => k !== 'formatting').map(([key, info]) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-black text-white/90">{info.title}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 font-bold uppercase tracking-wider">{info.badge}</span>
                                        <span className="text-[9px] text-orange-500/60 font-bold ml-auto uppercase tracking-tighter">{info.type}</span>
                                    </div>
                                    <p className="text-[11px] text-white/40 leading-relaxed italic">{info.desc}</p>
                                </div>
                            ))}
                            <button onClick={() => setShowHelp(null)} className="w-full py-1 text-[10px] font-bold text-white/20 hover:text-white/40 uppercase tracking-[0.2em]">{c.ui.close}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <SectionTitle>{c.settings.sttLanguage}</SectionTitle>
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                        { id: 'auto', label: c.settings.langAuto },
                        { id: 'ru', label: c.settings.langRu },
                        { id: 'en', label: c.settings.langEn },
                    ].map((l) => {
                        const currentLang = sttMode === 'deepgram' ? dgLanguage : (sttMode === 'whisper' ? whisperLanguage : groqLanguage);
                        const isActive = currentLang === l.id;
                        return (
                            <button key={l.id} onClick={() => handleLanguageChange(l.id as 'auto' | 'ru' | 'en')} className={`p-2 rounded-xl border transition-all text-center text-[12px] font-semibold ${isActive ? 'bg-white/8 border-white/20 text-white' : 'bg-white/3 border-white/8 text-white/50 hover:border-white/15'}`}>{l.label}</button>
                        );
                    })}
                </div>
            </div>

            <div>
                <SectionTitle>{c.settings.formattingEngine}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'gemini', label: c.settings.formattingGemini, color: 'border-sky-500/30 text-sky-400' },
                        { id: 'qwen', label: c.settings.formattingQwen, color: 'border-purple-500/30 text-purple-400' },
                        { id: 'deepseek', label: c.settings.formattingDeepSeek, color: 'border-cyan-500/30 text-cyan-400' },
                        { id: 'none', label: c.settings.formattingNone, color: 'border-white/20 text-white/60' },
                    ].map((m) => (
                        <button key={m.id} onClick={() => handleFormattingModeChange(m.id as FormattingMode)} className={`p-2.5 rounded-xl border transition-all text-left flex flex-col items-start ${formattingMode === m.id ? `bg-white/8 ${m.color.split(' ')[0]}` : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
                            <div className={`text-[11px] font-bold ${formattingMode === m.id ? m.color.split(' ')[1] : 'text-white/40'}`}>{m.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {sttMode === 'whisper' && (
                <div className="space-y-4">
                    <div>
                        <SectionTitle>{lang === 'ru' ? 'Выбор локальной модели' : 'Local Model Selection'}</SectionTitle>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {['small', 'medium', 'turbo'].map((m) => {
                                const isActive = whisperModel === m;
                                return (
                                    <button key={m} onClick={() => handleWhisperModelChange(m as 'small' | 'medium' | 'turbo')} className={`p-2 rounded-xl border transition-all text-center text-[11px] font-bold ${isActive ? 'bg-white/8 border-white/20 text-white' : 'bg-white/3 border-white/8 text-white/40 hover:border-white/15'}`}>{(c.settings as Record<string, string>)[`model${m.charAt(0).toUpperCase() + m.slice(1)}`]}</button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <SectionTitle>{c.settings.modelStatus}</SectionTitle>
                        <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                            {modelAvailable ? (
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <div className="text-[12px] font-medium text-emerald-400">{c.settings.modelInstalled}</div>
                                        <div className="text-[10px] text-white/30">{whisperModel === 'turbo' ? 'ggml-large-v3-turbo-q8_0.bin · ~830 MB' : whisperModel === 'medium' ? 'ggml-medium.bin · 1.5 GB' : 'ggml-small.bin · 500 MB'}</div>
                                    </div>
                                </div>
                            ) : downloading ? (
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        {isPaused ? <Pause className="w-4 h-4 text-amber-400" /> : <Loader2 className="w-4 h-4 text-white/50 animate-spin" />}
                                        <div>
                                            <div className="text-[12px] text-white/60">{isPaused ? (c.settings.modelPause || 'Paused') : (c.settings.modelDownloading || 'Downloading')}</div>
                                            <div className="text-[10px] text-white/30">{downloadProgress}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {isPaused ? (
                                            <button onClick={handleResume} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition-all" title={c.settings.modelResume}><Play className="w-3.5 h-3.5" /></button>
                                        ) : (
                                            <button onClick={handlePause} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition-all" title={c.settings.modelPause}><Pause className="w-3.5 h-3.5" /></button>
                                        )}
                                        <button onClick={handleCancel} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400/60 transition-all" title={c.settings.modelCancel}><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[12px] text-white/50">{c.settings.modelNotFound}</div>
                                        <div className="text-[10px] text-white/30">{whisperModel === 'turbo' ? '~830 MB' : whisperModel === 'medium' ? '~1.5 GB' : '~500 MB'}</div>
                                    </div>
                                    <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[11px] font-medium text-white/80 transition-all"><Download className="w-3.5 h-3.5" />{c.settings.modelDownload}</button>
                                </div>
                            )}
                        </div>
                    </div>
                    {modelAvailable && (
                        <button onClick={handleDeleteModel} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400/60 hover:text-red-400 text-[11px] font-medium transition-all"><Trash className="w-3 h-3" />{lang === 'ru' ? 'Удалить текущую модель' : 'Delete current model'}</button>
                    )}
                </div>
            )}

            <div>
                <SectionTitle>{c.welcome.faqTitle}</SectionTitle>
                <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3 text-[12px] leading-relaxed text-white/60">
                    <FaqItem icon={<Wifi className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />} text={c.settings.faqDeepgram} />
                    <FaqSeparator />
                    <FaqItem icon={<Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />} text={c.settings.faqGroq} />
                    <FaqSeparator />
                    <FaqItem icon={<HardDrive className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />} text={c.settings.faqWhisper} />
                    <FaqSeparator />
                    <FaqItem icon={<HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />} text={ENGINE_HELP[lang as keyof EngineHelp].formatting.desc} isItalic color="text-sky-400/80" />
                </div>
            </div>
        </div>
    );
};

interface EngineButtonProps {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    desc: string;
    onClick: () => void;
    activeColor: string;
    activeLabelColor?: string;
}

const EngineButton = ({ active, icon, label, desc, onClick, activeColor, activeLabelColor = "text-white/90" }: EngineButtonProps) => (
    <button onClick={onClick} className={`p-3 rounded-xl border transition-all text-left flex flex-col items-start ${active ? `bg-white/8 ${activeColor}` : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
        {icon}
        <div className={`text-[12px] font-semibold ${active ? activeLabelColor : 'text-white/50'}`}>{label}</div>
        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{desc}</div>
    </button>
);

interface FaqItemProps {
    icon: React.ReactNode;
    text: string;
    isItalic?: boolean;
    color?: string;
}

const FaqItem = ({ icon, text, isItalic = false, color = "text-white/60" }: FaqItemProps) => (
    <div className="flex gap-2">
        {icon}
        <p className={`${isItalic ? 'italic' : ''} ${color}`}>{text}</p>
    </div>
);

const FaqSeparator = () => <div className="w-full h-[1px] bg-white/5" />;
