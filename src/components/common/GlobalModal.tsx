import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle } from 'lucide-react';
import { notify, ToastItem, ConfirmDialogOptions } from '../../services/notificationService';

export const GlobalModal: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  useEffect(() => {
    const unsub = notify.subscribe(() => {
      setToasts([...notify.getToasts()]);
      setConfirmDialog(notify.getActiveConfirm());
    });
    return () => unsub();
  }, []);

  return (
    <>
      {/* 1. SAĞ ÜST TOAST BİLDİRİM LİSTESİ */}
      <div className="fixed top-5 right-5 z-50 space-y-2.5 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start gap-3 pointer-events-auto transform transition-all duration-300 animate-slideDown ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-white shadow-emerald-500/10'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-white shadow-rose-500/10'
                : t.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-white shadow-amber-500/10'
                : 'bg-slate-900/90 border-slate-700 text-white shadow-black/20'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-black text-xs tracking-tight">{t.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{t.message}</p>
            </div>

            <button
              onClick={() => notify.removeToast(t.id)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 2. ÖZEL LÜKS ONAY MODALI (CONFIRM YERİNE) */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn select-none font-sans">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                confirmDialog.type === 'danger'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : confirmDialog.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
              }`}>
                {confirmDialog.type === 'danger' ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Lütfen işlemi onaylayın</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800 whitespace-pre-line font-medium">
              {confirmDialog.message}
            </p>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  if (confirmDialog.onCancel) confirmDialog.onCancel();
                  notify.closeConfirm();
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {confirmDialog.cancelText || 'Vazgeç'}
              </button>

              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  notify.closeConfirm();
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-transform transform active:scale-95 ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {confirmDialog.confirmText || 'Evet, Onaylıyorum'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
