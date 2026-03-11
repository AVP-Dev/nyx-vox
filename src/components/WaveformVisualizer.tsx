"use client";

import React, { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

interface WaveformVisualizerProps {
    isActive: boolean;
}

const BAR_COUNT = 9;
const BAR_NATURAL_HEIGHTS = [0.2, 0.4, 0.6, 0.8, 1.0, 0.8, 0.6, 0.4, 0.2];

export function WaveformVisualizer({ isActive }: WaveformVisualizerProps) {
    const barsRef = useRef<(HTMLDivElement | null)[]>([]);
    const animFrameRef = useRef<number>(0);
    const levelRef = useRef<number>(0);
    const timeRef = useRef<number>(0);

    // Listen to audio-level from Rust cpal
    useEffect(() => {
        if (!isActive) {
            barsRef.current.forEach((el, i) => {
                if (!el) return;
                const h = BAR_NATURAL_HEIGHTS[i] * 0.1;
                el.style.height = `${h * 16}px`;
                el.style.background = `rgba(255,255,255,0.15)`;
                el.style.boxShadow = 'none';
            });
            return;
        }

        let unlisten: (() => void) | null = null;
        listen<number>('audio-level', (event) => {
            levelRef.current = event.payload;
        }).then(fn => { unlisten = fn; });

        const animate = (t: number) => {
            timeRef.current = t;
            const level = levelRef.current;

            barsRef.current.forEach((el, i) => {
                if (!el) return;
                const baseH = BAR_NATURAL_HEIGHTS[i];
                const phase = (i / BAR_COUNT) * Math.PI * 2;
                const organic = Math.sin((t / 250) + phase) * 0.1;
                const rawH = (baseH * level * 1.8) + organic * level + baseH * 0.1;
                const height = Math.min(1.0, Math.max(0.1, rawH));

                el.style.height = `${height * 16}px`;
                el.style.background = `rgba(255, 255, 255, ${0.3 + height * 0.7})`;
                el.style.boxShadow = 'none';
            });

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            if (unlisten) unlisten();
        };
    }, [isActive]);

    return (
        <div className="flex items-center justify-center gap-[3px] h-[16px]">
            {BAR_NATURAL_HEIGHTS.map((baseH, i) => (
                <div
                    key={i}
                    ref={(el) => { barsRef.current[i] = el; }}
                    className="rounded-full transition-all"
                    style={{
                        width: '3px',
                        height: `${baseH * 0.1 * 16}px`,
                        background: `rgba(255,255,255,0.15)`,
                        transitionDuration: '80ms',
                        transitionProperty: 'height, background, box-shadow',
                    }}
                />
            ))}
        </div>
    );
}
