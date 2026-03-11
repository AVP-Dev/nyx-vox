'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION } from '@/constants/version';

interface UpdatePopupProps {
    language: 'ru' | 'en';
}

export function UpdatePopup({ language }: UpdatePopupProps) {
    useEffect(() => {
        const checkUpdates = async () => {
            try {
                // Check if user has "remind me later" set
                const lastDismissed = await invoke<number>('get_update_dismissed_at');
                
                if (lastDismissed) {
                    const DayInMs = 24 * 60 * 60 * 1000;
                    if (Date.now() - lastDismissed < DayInMs) {
                        return; // Still in "Remind Later" period
                    }
                }

                const response = await fetch('https://api.github.com/repos/AVP-Dev/nyx-vox/releases/latest');
                const data = await response.json();
                const latest = data.tag_name;
                const currentVersion = `v${APP_VERSION}`;
                
                if (latest && latest !== currentVersion) {
                    // Open separate window via backend
                    invoke('show_update_window', { version: latest, lang: language });
                }
            } catch (e) {
                console.error('Failed to check for updates', e);
            }
        };

        const timer = setTimeout(checkUpdates, 5000); // Check 5s after startup
        return () => clearTimeout(timer);
    }, [language]);

    return null; // No UI in the main window anymore
}
