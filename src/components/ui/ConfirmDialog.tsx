import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
}) => (
    <AnimatePresence>
        {open && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                onClick={onCancel}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="w-full max-w-xs bg-panel border border-subtle rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-3">
                        {destructive && (
                            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-sm font-black text-white leading-tight">{title}</h3>
                            <p className="text-xs text-white/50 mt-1 leading-relaxed">{message}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-muted hover:text-white font-bold text-xs transition-all"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all ${
                                destructive
                                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

// Hook for managing confirm dialog
export function useConfirm() {
    const [state, setState] = React.useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        destructive?: boolean;
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });

    const confirm = React.useCallback(
        (opts: Omit<typeof state, 'open' | 'onConfirm'>) =>
            new Promise<boolean>((resolve) => {
                setState({
                    ...opts,
                    open: true,
                    onConfirm: () => {
                        setState((s) => ({ ...s, open: false }));
                        resolve(true);
                    },
                });
            }),
        []
    );

    const cancel = React.useCallback(() => {
        setState((s) => ({ ...s, open: false }));
    }, []);

    return { ...state, confirm, cancel };
}
