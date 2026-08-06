import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onDismiss: () => void;
    duration?: number;
}

const ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const STYLES: Record<ToastType, string> = {
    success: 'border-emerald-500/30 text-emerald-400',
    error: 'border-red-500/30 text-red-400',
    info: 'border-sky-500/30 text-sky-400',
};

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss, duration = 3000 }) => {
    const Icon = ICONS[type];

    useEffect(() => {
        const timer = setTimeout(onDismiss, duration);
        return () => clearTimeout(timer);
    }, [onDismiss, duration]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-panel border ${STYLES[type]} shadow-lg`}
        >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold text-white/90">{message}</span>
            <button
                onClick={onDismiss}
                className="ml-1 p-1 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            >
                <X className="w-3 h-3" />
            </button>
        </motion.div>
    );
};

interface ToastContainerProps {
    toasts: Array<{ id: string; message: string; type: ToastType }>;
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
        <AnimatePresence>
            {toasts.map((t) => (
                <Toast
                    key={t.id}
                    message={t.message}
                    type={t.type}
                    onDismiss={() => onDismiss(t.id)}
                />
            ))}
        </AnimatePresence>
    </div>
);

// Hook for managing toasts
export function useToast() {
    const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type: ToastType }>>([]);

    const addToast = React.useCallback((message: string, type: ToastType = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const dismissToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, addToast, dismissToast };
}
