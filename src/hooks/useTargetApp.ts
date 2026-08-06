import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Phase } from '@/lib/types';

export function useTargetApp() {
    const [targetApp, setTargetApp] = useState('');

    const updateTarget = useCallback(async (currentPhase: Phase) => {
        if (currentPhase === 'result' || currentPhase === 'editing') {
            if (currentPhase === 'result') {
                await invoke('update_target_app').catch(console.error);
            }
            invoke<string>('get_target_app').then(name => {
                if (name && name !== 'Unknown') setTargetApp(name);
                else setTargetApp('');
            }).catch(console.error);
        } else if (currentPhase === 'idle') {
            setTargetApp('');
        }
    }, []);

    // Live target app updates from backend
    useEffect(() => {
        let isMounted = true;
        let unlistenFn: (() => void) | null = null;

        listen<string>('target-app-changed', (event) => {
            if (isMounted && event.payload && event.payload !== 'Unknown' && event.payload !== 'NYX Vox' && event.payload !== 'app') {
                setTargetApp(event.payload);
            }
        }).then(u => {
            if (isMounted) unlistenFn = u; else u();
        });

        return () => { isMounted = false; if (unlistenFn) unlistenFn(); };
    }, []);

    return { targetApp, setTargetApp, updateTarget };
}
