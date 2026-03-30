import React from 'react';
import { BookOpen, Zap, ExternalLink, UserCircle, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { SectionTitle, Card } from './Common';
import { CREATOR_INFO, APP_DESCRIPTION, MISSION, FUTURE_ITEMS } from '@/constants/appInfo';

interface InfoTabProps {
    c: {
        guide: {
            title: string;
            stepsHead: string[];
            stepsBody: string[];
        };
        settings: {
            updates: string;
            updateAvailable: string;
            noUpdate: string;
            checking: string;
            checkUpdatesBtn: string;
            checkUpdates: string;
        };
        about: {
            title: string;
            app: string;
            author: string;
            mission: string;
            future: string;
        };
    };
    APP_VERSION: string;
    updateStatus: string;
    handleCheckUpdates: () => void;
    lang: string;
}

export const InfoTab: React.FC<InfoTabProps> = ({
    c, APP_VERSION, updateStatus, handleCheckUpdates, lang
}) => {
    return (
        <div className="space-y-6">
            <div>
                <SectionTitle>
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-3 h-3 text-sky-400" />
                        {c.guide.title}
                    </div>
                </SectionTitle>
                <div className="space-y-3">
                    {c.guide.stepsHead.map((head: string, i: number) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                                <StepIcon index={i} />
                            </div>
                            <div>
                                <div className="text-[12px] font-bold text-white/80">{head}</div>
                                <div className="text-[11px] text-white/40 leading-snug">{c.guide.stepsBody[i]}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>
                    <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        {c.settings.updates}
                    </div>
                </SectionTitle>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                    <div>
                        <div className="text-[13px] font-semibold text-white/90">
                            {updateStatus === 'available' ? c.settings.updateAvailable : c.settings.noUpdate}
                        </div>
                        <div className="text-[11px] text-white/30 mt-0.5">v{APP_VERSION}</div>
                    </div>
                    <button onClick={handleCheckUpdates} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-[11px] font-bold transition-all uppercase tracking-widest">
                        {updateStatus === 'checking' ? c.settings.checking : (updateStatus === 'available' ? c.settings.checkUpdatesBtn : c.settings.checkUpdates)}
                    </button>
                </div>
            </div>

            <div>
                <SectionTitle>
                    <div className="flex items-center gap-2">
                        <UserCircle className="w-3 h-3 text-sky-400" />
                        {c.about.title}
                    </div>
                </SectionTitle>
                <div className="space-y-4">
                    <div className="flex items-center gap-4 px-1">
                        <div className="w-[60px] h-[60px] rounded-[16px] border border-white/10 flex items-center justify-center shadow-xl overflow-hidden shrink-0 relative bg-white/5">
                            <Image src="/logo.png" alt="NYX Vox" width={48} height={48} className="object-cover opacity-80" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[18px] font-bold text-white tracking-tight">{c.about.app}</span>
                                <span className="text-[12px] text-white/30 font-mono">v{APP_VERSION}</span>
                            </div>
                            <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed font-medium">
                                {APP_DESCRIPTION[lang as keyof typeof APP_DESCRIPTION] || APP_DESCRIPTION.en}
                            </div>
                        </div>
                    </div>

                    <Card className="space-y-3">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none">
                            {c.about.author}
                        </div>
                        <div>
                            <div className="text-[14px] font-bold text-white tracking-tight">{CREATOR_INFO.name}</div>
                            <div className="text-[10px] text-white/40 font-mono mt-0.5 leading-none">{CREATOR_INFO.role}</div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                            {CREATOR_INFO.links.map((s, i) => (
                                <a 
                                    key={i} 
                                    href={s.href} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    title={s.title}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-white/30 transition-all duration-200 ${s.color} hover:bg-white/10`}
                                >
                                    {s.icon}
                                </a>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">
                            {c.about.mission}
                        </div>
                        <div className="text-[12px] text-white/70 italic leading-relaxed font-medium">
                            &ldquo;{MISSION[lang as keyof typeof MISSION] || MISSION.en}&rdquo;
                        </div>
                    </Card>

                    <Card>
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2.5">
                            {c.about.future}
                        </div>
                        <div className="space-y-1.5">
                            {(FUTURE_ITEMS[lang as keyof typeof FUTURE_ITEMS] || FUTURE_ITEMS.en).map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] text-white/50 font-bold italic">
                                    <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const StepIcon = ({ index }: { index: number }) => {
    const icons = [
        { icon: <BookOpen key="book" className="w-4 h-4" /> },
        { icon: <Zap key="zap" className="w-4 h-4" /> },
        { icon: <ExternalLink key="link" className="w-4 h-4" /> },
        { icon: <BookOpen key="book2" className="w-4 h-4" /> },
        { icon: <Zap key="zap2" className="w-4 h-4" /> },
        { icon: <ExternalLink key="link2" className="w-4 h-4" /> }
    ];
    return icons[index % icons.length].icon;
};
