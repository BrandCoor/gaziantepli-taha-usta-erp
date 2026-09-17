import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle, X, Sparkles, Printer } from 'lucide-react';
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
      {/* 1. SAĞ ÜST LÜKS TOAST BİLDİRİM LİSTESİ */}
      <div className="fixed top-5 right-5 z-[9999] space-y-3 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 pointer-events-auto transform transition-all duration-300 animate-slideDown ${
              t.type === 'success'
                ? 'bg-[#18181C]/95 border-emerald-500/50 text-[#FAF7F2] shadow-emerald-900/30'
                : t.type === 'error'
                ? 'bg-[#18181C]/95 border-rose-500/50 text-[#FAF7F2] shadow-rose-900/30'
                : t.type === 'warning'
                ? 'bg-[#18181C]/95 border-[#F5C877]/60 text-[#FAF7F2] shadow-[#F5C877]/20'
                : 'bg-[#18181C]/95 border-[#2C2C34] text-[#FAF7F2] shadow-black/40'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {t.type === 'success' && <div className="p-1.5 bg-emerald-500/10 rounded-xl text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>}
              {t.type === 'error' && <div className="p-1.5 bg-rose-500/10 rounded-xl text-rose-400"><XCircle className="w-5 h-5" /></div>}
              {t.type === 'warning' && <div className="p-1.5 bg-[#F5C877]/10 rounded-xl text-[#F5C877]"><AlertTriangle className="w-5 h-5" /></div>}
              {t.type === 'info' && <div className="p-1.5 bg-sky-500/10 rounded-xl text-sky-400"><Info className="w-5 h-5" /></div>}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-black text-xs text-white tracking-tight flex items-center gap-1.5">
                <span>{t.title}</span>
              </h4>
              <p className="text-[11px] text-[#C4C4CC] mt-0.5 leading-relaxed font-medium">{t.message}</p>
            </div>

            <button
              onClick={() => notify.removeToast(t.id)}
              className="text-[#8E8E98] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 2. LÜKS ONAY MODALI (CONFIRM YERİNE AÇILAN KUSURSUZ POPUP) */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[99999] backdrop-blur-md animate-fadeIn select-none font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                confirmDialog.type === 'danger'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : confirmDialog.type === 'warning'
                  ? 'bg-[#F5C877]/10 text-[#F5C877] border border-[#F5C877]/30'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              }`}>
                {confirmDialog.type === 'danger' ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-[#8E8E98] mt-0.5">Lütfen işlemi onaylayınız</p>
              </div>
            </div>

            <div className="p-4 bg-[#121214] rounded-2xl border border-[#2C2C34] text-xs text-[#E4E4E8] leading-relaxed whitespace-pre-line font-medium">
              {confirmDialog.message}
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  if (confirmDialog.onCancel) confirmDialog.onCancel();
                  notify.closeConfirm();
                }}
                className="px-5 py-2.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {confirmDialog.cancelText || 'Vazgeç'}
              </button>

              <button
                onClick={() => {
                  const onConf = confirmDialog.onConfirm;
                  notify.closeConfirm();
                  onConf();
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-transform transform active:scale-95 ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] shadow-[#F5C877]/20'
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