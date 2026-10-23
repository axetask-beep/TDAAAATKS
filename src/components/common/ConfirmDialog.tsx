import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Trap focus on confirm button
      setTimeout(() => confirmRef.current?.focus(), 50);
      // Close on Escape
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm bg-[#0B1120] border border-[#1E293B] rounded-lg shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-150 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b ${isDanger ? 'border-rose-500/20' : 'border-amber-500/20'} flex items-start gap-3`}>
          <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center ${isDanger ? 'bg-rose-500/15 border border-rose-500/30' : 'bg-amber-500/15 border border-amber-500/30'}`}>
            {isDanger ? (
              <Trash2 className="w-4 h-4 text-rose-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] hover:text-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded text-xs font-bold transition-all shadow-sm ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/25 border border-rose-500/50'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/25 border border-amber-500/50'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage a single ConfirmDialog state imperatively.
 * Usage:
 *   const { confirmProps, confirm } = useConfirm();
 *   await confirm({ title: '...', message: '...' }); // resolves true/false
 *   <ConfirmDialog {...confirmProps} />
 */
export function useConfirm() {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
    resolve?: (value: boolean) => void;
  }>({ isOpen: false, title: '', message: '' });

  const confirm = React.useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' }) =>
      new Promise<boolean>((resolve) => {
        setState({ isOpen: true, ...opts, resolve });
      }),
    []
  );

  const handleConfirm = React.useCallback(() => {
    setState((s) => { s.resolve?.(true); return { ...s, isOpen: false }; });
  }, []);

  const handleCancel = React.useCallback(() => {
    setState((s) => { s.resolve?.(false); return { ...s, isOpen: false }; });
  }, []);

  const confirmProps: ConfirmDialogProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    variant: state.variant,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return { confirmProps, confirm };
}
