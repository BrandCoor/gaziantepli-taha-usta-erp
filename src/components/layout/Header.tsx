import React from 'react';
import { notify } from '../../services/notificationService';
import { Minus, Maximize, Power, Lock, Calendar, Clock, ShieldCheck, Sparkles } from 'lucide-react';

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

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-minimize');
    }
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('window-toggle-fullscreen');
    }
  };

  const handleExitApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    notify.confirm({
      title: 'Programı Kapat',
      message: 'Gaziantepli Taha Usta ERP / Restoran Sistemini kapatmak istediğinize emin misiniz?',
      type: 'danger',
      confirmText: 'Evet, Kapat',
      onConfirm: () => {
        if ((window as any).require) {
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.send('window-close');
        }
      }
    });
  };

  return (
    <header className="h-14 bg-[#121214] border-b border-[#2C2C34] px-5 flex items-center justify-between select-none z-30 flex-shrink-0 text-[#FAF7F2]" style={{ WebkitAppRegion: 'drag' } as any}>
      
      {/* Sol: Tarih & Canlı Durum */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center gap-2 text-xs font-bold text-[#E4E4E8]">
          <Calendar className="w-4 h-4 text-[#F5C877]" />
          <span>{currentDate}</span>
        </div>
        <div className="h-4 w-px bg-[#2C2C34]"></div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] rounded-full text-[10px] font-black uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F5C877] animate-pulse"></span>
          <span>Ana Kasa Terminali Aktif</span>
        </div>
      </div>

      {/* Sağ: Pencere ve Kilit Butonları */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {onLockApp && (
          <button
            onClick={onLockApp}
            className="px-3.5 py-1.5 bg-[#1C1C20] hover:bg-[#24242A] border border-[#2C2C34] rounded-xl text-xs font-bold text-[#FAF7F2] flex items-center gap-1.5 cursor-pointer mr-2 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-[#F5C877]" />
            <span>Kasa Kilitle</span>
          </button>
        )}

        <button
          onClick={handleMinimize}
          className="w-8 h-8 rounded-xl bg-[#1C1C20] hover:bg-[#24242A] text-[#8E8E98] hover:text-[#FAF7F2] border border-[#2C2C34] flex items-center justify-center cursor-pointer transition-colors"
          title="Simge Durumuna Küçült"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          onClick={handleToggleFullscreen}
          className="w-8 h-8 rounded-xl bg-[#1C1C20] hover:bg-[#24242A] text-[#8E8E98] hover:text-[#FAF7F2] border border-[#2C2C34] flex items-center justify-center cursor-pointer transition-colors"
          title="Tam Ekran"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleExitApp}
          className="w-8 h-8 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shadow-sm ml-1"
          title="Programı Kapat"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};