import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, UserCircle, LogOut, Bell, Minus, X, AlertTriangle, Lock, UserCheck, Power, Receipt } from 'lucide-react';
import { dataService } from '../../services/dataService';

interface HeaderProps {
  pendingAccrualCount: number;
  onOpenPendingAccruals: () => void;
  onQuickDebt: () => void;
  onQuickCollection: () => void;
  onQuickExpense: () => void;
  onQuickEmployeePayment: () => void;
  onSwitchUser: () => void;
  onLockApp: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  pendingAccrualCount,
  onOpenPendingAccruals,
  onQuickDebt, 
  onQuickCollection, 
  onQuickExpense,
  onQuickEmployeePayment,
  onSwitchUser,
  onLockApp 
}) => {
  const currentUser = dataService.getCurrentUser();
  const company = dataService.getCompanySettings();
  const canDebt = dataService.hasPermission('CUSTOMERS_TRANSACTION');
  const canPay = dataService.hasPermission('EMPLOYEES_PAYMENT');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleMinimize = () => {
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('window-minimize');
      } catch {}
    }
  };

  const handleConfirmClose = () => {
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('window-close');
      } catch {}
    } else {
      window.close();
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    onLockApp();
  };

  return (
    <>
      <header className="h-16 lg:h-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between select-none shadow-sm z-10 transition-all">
        {/* Sol Hızlı Butonlar */}
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto py-1">
          {canDebt && (
            <>
              <button 
                onClick={onQuickDebt}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black border border-rose-200 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Müşteriye </span><span>Borç Yaz</span>
              </button>

              <button 
                onClick={onQuickCollection}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black border border-emerald-200 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Tahsilat Al</span>
              </button>
            </>
          )}

          {/* + Gider Ekle Hızlı Butonu */}
          <button 
            onClick={onQuickExpense}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-black border border-amber-200 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Receipt className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Gider Ekle</span>
          </button>

          {canPay && (
            <button 
              onClick={onQuickEmployeePayment}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black border border-blue-200 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Personel Ödemesi</span>
            </button>
          )}
        </div>

        {/* Orta: Firma İsmi */}
        <div className="hidden xl:flex items-center gap-2.5 font-black text-slate-800 text-base tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>{company.companyName}</span>
        </div>

        {/* Sağ: Bildirim, Oturum Butonları ve Pencere Kontrolleri */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {pendingAccrualCount > 0 && (
            <button
              onClick={onOpenPendingAccruals}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl text-xs font-black animate-pulse shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="Maaş Hakedişi Onay Bekleyen Personeller"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              <span className="hidden md:inline">{pendingAccrualCount} Maaş Onay Bekliyor</span>
              <span className="md:hidden">{pendingAccrualCount}</span>
            </button>
          )}

          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-300 shadow-inner">
              <UserCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-black text-slate-900 leading-tight">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-500 font-semibold">{currentUser.roleName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLockApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Ekranı Kilitle (Şifre Ekranına Alır)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Kilitle</span>
          </button>

          <button
            type="button"
            onClick={onSwitchUser}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Farklı Kullanıcı Hesabına Geç"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Kullanıcı Değiştir</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Oturumu Güvenle Kapat"
          >
            <Power className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Çıkış</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-1.5 pl-2 sm:pl-3 border-l-2 border-slate-200">
            <button
              type="button"
              onClick={handleMinimize}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-sm"
              title="Simge Durumuna Küçült"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-sm"
              title="Programı Kapat"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Power className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Oturumu Kapat</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Mevcut oturumunuz kapatılacak ve ana giriş ekranına yönlendirileceksiniz. Onaylıyor musunuz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowLogoutModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmLogout} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-600/20 cursor-pointer">Evet, Çıkış Yap</button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Programı Kapat</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <strong>{company.companyName}</strong> programını kapatmak istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowCloseModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmClose} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Kapat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};