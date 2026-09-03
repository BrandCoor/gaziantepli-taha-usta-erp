import React from 'react';
import { 
  Minus, 
  Maximize, 
  Power, 
  Lock, 
  Sparkles, 
  Calendar, 
  Clock 
} from 'lucide-react';

interface HeaderProps {
  pendingAccrualCount?: number;
  onOpenPendingAccruals?: () => void;
  onQuickDebt?: () => void;
  onQuickCollection?: () => void;
  onQuickExpense?: () => void;
  onQuickEmployeePayment?: () => void;
  onSwitchUser?: () => void;
  onLockApp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLockApp }) => {
  const currentDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  // Electron Pencere Kontrolleri
  const handleMinimize = () => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-minimize');
    }
  };

  const handleToggleFullscreen = () => {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-toggle-fullscreen');
    }
  };

  const handleExitApp = () => {
    if (confirm('Gaziantepli Taha Usta POS Sistemini kapatmak istediğinize emin misiniz?')) {
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('window-close');
      }
    }
  };

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-5 flex items-center justify-between select-none z-30 flex-shrink-0 text-slate-100">
      
      {/* Sol: Tarih & Canlı Durum */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>{currentDate}</span>
        </div>
        <div className="h-4 w-px bg-slate-800"></div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-black uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Ana Kasa Aktif</span>
        </div>
      </div>

      {/* Sağ: Pencere ve Güvenlik Kontrolleri */}
      <div className="flex items-center gap-2">
        {onLockApp && (
          <button
            onClick={onLockApp}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors mr-2"
            title="Ekranı Kilitle"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Kilitle</span>
          </button>
        )}

        {/* PENCERE KÜÇÜLT */}
        <button
          onClick={handleMinimize}
          className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Simge Durumuna Küçült"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* TAM EKRAN AÇ / KAPA */}
        <button
          onClick={handleToggleFullscreen}
          className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Tam Ekran Modunu Değiştir"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        {/* UYGULAMADAN ÇIKIŞ YAP */}
        <button
          onClick={handleExitApp}
          className="w-8 h-8 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm ml-1"
          title="Programı Kapat ve Çık"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
