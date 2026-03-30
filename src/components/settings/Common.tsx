import React, { ComponentType } from 'react';
import { motion } from 'framer-motion';

export const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${checked ? 'bg-emerald-500' : 'bg-white/10'}`}
    >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
);

interface SidebarItemProps {
    id: string;
    active: boolean;
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: (id: string) => void;
    color?: string;
}

export const SidebarItem = ({
    id,
    active,
    icon: Icon,
    label,
    onClick,
    color = "text-white"
}: SidebarItemProps) => (
    <button
        onClick={() => onClick(id)}
        className={`relative flex items-center justify-center gap-2.5 px-3 py-2.5 w-full rounded-[18px] transition-all duration-300 group ${
            active ? 'text-white' : 'text-white/20 hover:text-white/40'
        }`}
    >
        {active && (
            <motion.div
                layoutId="active-tab"
                className="absolute inset-0 bg-white/5 border border-white/10 rounded-[18px] shadow-[0_4px_12_rgba(0,0,0,0.2)]"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />
        )}
        <Icon className={`w-4 h-4 relative z-10 transition-colors duration-300 ${active ? color : 'text-white/20 group-hover:text-white/40'}`} />
        <span className={`text-[11px] font-black relative z-10 whitespace-nowrap tracking-tight transition-all duration-300 ${active ? 'opacity-100' : 'opacity-80'}`}>
            {label}
        </span>
    </button>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3 ml-1">
        {children}
    </div>
);

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-4 rounded-xl bg-white/4 border border-white/8 ${className}`}>
        {children}
    </div>
);
