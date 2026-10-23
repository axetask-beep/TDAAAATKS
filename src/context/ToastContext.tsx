import React, { createContext, useContext, useState, useCallback } from 'react';
import { playPreferredNotificationSound, playNotificationSound, SoundEffectType, getSoundSettings, setSoundSettings } from '../lib/sound';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Volume2, Sparkles } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'sound_preview';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  soundPlayed?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  notify: (opts: { type?: ToastType; title: string; message?: string; sound?: boolean | SoundEffectType }) => void;
  removeToast: (id: string) => void;
  soundEnabled: boolean;
  soundVolume: number;
  soundType: SoundEffectType;
  toggleSound: (enabled: boolean) => void;
  updateVolume: (vol: number) => void;
  selectSoundType: (type: SoundEffectType) => void;
  playTestSound: (type?: SoundEffectType) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [soundConfig, setSoundConfigState] = useState(() => getSoundSettings());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((opts: { 
    type?: ToastType; 
    title: string; 
    message?: string; 
    sound?: boolean | SoundEffectType 
  }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let soundName: string | undefined = undefined;

    // Trigger random audio chime unless explicitly sound: false
    if (opts.sound !== false) {
      const specificEffect = typeof opts.sound === 'string' ? opts.sound : undefined;
      soundName = playNotificationSound(specificEffect);
    }

    const newToast: ToastItem = {
      id,
      type: opts.type || 'info',
      title: opts.title,
      message: opts.message,
      soundPlayed: soundName,
    };

    setToasts((prev) => [...prev.slice(-4), newToast]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  const toggleSound = (enabled: boolean) => {
    setSoundSettings({ enabled });
    setSoundConfigState((prev) => ({ ...prev, enabled }));
    if (enabled) {
      playPreferredNotificationSound();
    }
  };

  const updateVolume = (vol: number) => {
    setSoundSettings({ volume: vol });
    setSoundConfigState((prev) => ({ ...prev, volume: vol }));
  };

  const selectSoundType = (type: SoundEffectType) => {
    setSoundSettings({ type });
    setSoundConfigState((prev) => ({ ...prev, type }));
  };

  const playTestSound = (type?: SoundEffectType): string => {
    const played = playNotificationSound(type);
    return played;
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        notify,
        removeToast,
        soundEnabled: soundConfig.enabled,
        soundVolume: soundConfig.volume,
        soundType: soundConfig.type,
        toggleSound,
        updateVolume,
        selectSoundType,
        playTestSound,
      }}
    >
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => {
          const typeStyles = {
            success: {
              border: 'border-emerald-500/40',
              bg: 'bg-[#0F1E19]/95',
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
              badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            },
            error: {
              border: 'border-rose-500/40',
              bg: 'bg-[#1F1015]/95',
              icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
              badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
            },
            warning: {
              border: 'border-amber-500/40',
              bg: 'bg-[#1F1A0F]/95',
              icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
              badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            },
            info: {
              border: 'border-blue-500/40',
              bg: 'bg-[#0E1526]/95',
              icon: <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />,
              badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            },
            sound_preview: {
              border: 'border-indigo-500/40',
              bg: 'bg-[#121226]/95',
              icon: <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
              badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
            },
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${typeStyles.border} ${typeStyles.bg} backdrop-blur-md shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
            >
              {typeStyles.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-100 font-mono leading-snug truncate">
                    {toast.title}
                  </p>
                  {toast.soundPlayed && toast.soundPlayed !== 'disabled' && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-400">
                      <Volume2 className="w-2.5 h-2.5" />
                      {toast.soundPlayed.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {toast.message && (
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
