import React from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  PhoneCall, 
  Bike, 
  Users, 
  UserCheck, 
  BarChart2, 
  ShieldCheck, 
  Building2, 
  Sparkles, 
  Receipt,
  SlidersHorizontal,
  QrCode
} from 'lucide-react';
import { dataService } from '../../services/dataService';

export type ActiveTab = 
  | 'pos' 
  | 'delivery' 
  | 'online-orders' 
  | 'dashboard' 
  | 'customers' 
  | 'expenses' 
  | 'employees' 
  | 'reports' 
  | 'restaurant-settings'
  | 'users' 
  | 'company-settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const canManageUsers = dataService.hasPermission('USERS_MANAGE');
  const company = dataService.getCompanySettings();

  const posMenuItems = [
    { id: 'pos', label: '🍽️ Restoran Masaları (POS)', icon: UtensilsCrossed, highlight: true },
    { id: 'delivery', label: '📞 Paket Servis & Caller ID', icon: PhoneCall },
    { id: 'online-orders', label: '🛵 Yemek Platformları', icon: Bike },
  ];

  const erpMenuItems = [
    { id: 'dashboard', label: 'Özet & Kasa Durumu', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteriler & Cari', icon: Users },
    { id: 'expenses', label: 'Giderler & Harcamalar', icon: Receipt },
    { id: 'employees', label: 'Personeller & Garsonlar', icon: UserCheck },
    { id: 'reports', label: 'Z Raporu & Mali Analiz', icon: BarChart2 },
  ];

  const settingsMenuItems = [
    { id: 'restaurant-settings', label: '⚙️ Restoran & Donanım Ayarları', icon: SlidersHorizontal },
  ];

  if (canManageUsers) {
    settingsMenuItems.push({ id: 'users', label: 'Kullanıcılar & Yetkiler', icon: ShieldCheck });
    settingsMenuItems.push({ id: 'company-settings', label: 'Firma & Logo Ayarları', icon: Building2 });
  }

  return (
    <aside className="w-72 bg-[#161619] text-[#E4E4E8] flex flex-col h-full border-r border-[#2C2C34] select-none shadow-2xl z-20 flex-shrink-0">
      
      {/* ÜST LOGO & BAŞLIK ALANI */}
      <div className="h-24 flex items-center gap-3.5 px-6 border-b border-[#2C2C34] bg-[#121214]">
        {company.logoBase64 ? (
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#F5C877]/80 shadow-xl bg-black flex-shrink-0">
            <img src={company.logoBase64} alt={company.companyName} className="w-full h-full object-fill rounded-full" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5C877] via-[#D4A351] to-[#A87B28] border border-[#F5C877]/50 flex items-center justify-center text-[#141416] font-black text-xl shadow-lg shadow-[#F5C877]/10 flex-shrink-0">
            <UtensilsCrossed className="w-7 h-7 text-[#141416]" />
          </div>
        )}

        <div className="overflow-hidden">
          <h1 className="font-black text-sm text-[#FAF7F2] truncate tracking-tight uppercase" title={company.companyName || 'GAZİANTEPLİ TAHA USTA'}>
            {company.companyName || 'GAZİANTEPLİ TAHA USTA'}
          </h1>
          <p className="text-[11px] text-[#F5C877] font-bold tracking-wide flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#F5C877] animate-pulse"></span>
            Restoran & POS ERP
          </p>
        </div>
      </div>

      {/* MENÜ LİSTESİ */}
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        
        {/* 1. RESTORAN VE MASALAR */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-[#F5C877]/90 flex items-center justify-between">
            <span>Restoran Operasyonu</span>
            <span className="text-[9px] bg-[#F5C877]/15 text-[#F5C877] px-2 py-0.5 rounded-full font-black">CANLI</span>
          </div>
          {posMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black shadow-lg shadow-[#F5C877]/15 translate-x-1' 
                    : 'text-[#9E9EA8] hover:bg-[#202025] hover:text-[#FAF7F2]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#141416]' : 'text-[#F5C877]'}`} />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. MUHASEBE & RAPORLAR */}
        <div className="space-y-1 pt-2 border-t border-[#2C2C34]/70">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-[#8E8E98]">
            Cari, Personel & Muhasebe
          </div>
          {erpMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#282830] text-[#F5C877] border border-[#F5C877]/40 shadow-md translate-x-1 font-black' 
                    : 'text-[#9E9EA8] hover:bg-[#202025] hover:text-[#FAF7F2]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#F5C877]' : 'text-[#8E8E98]'}`} />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. AYARLAR */}
        <div className="space-y-1 pt-2 border-t border-[#2C2C34]/70">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-[#8E8E98]">
            Sistem & Donanım
          </div>
          {settingsMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#282830] text-[#F5C877] border border-[#F5C877]/40 shadow-md translate-x-1 font-black' 
                    : 'text-[#9E9EA8] hover:bg-[#202025] hover:text-[#FAF7F2]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#F5C877]' : 'text-[#8E8E98]'}`} />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* ALT VERSİYON VE DONANIM BİLGİSİ */}
      <div className="p-4 border-t border-[#2C2C34] bg-[#121214] text-[10px] text-[#8E8E98] flex items-center justify-between">
        <div>
          <div className="font-black text-[#F5C877]">Gaziantepli Taha Usta</div>
          <div>Afanda 892E & POS Hazır</div>
        </div>
        <div className="px-2 py-1 bg-[#202025] border border-[#2C2C34] rounded-lg text-[#F5C877] font-mono font-bold">
          v2.0
        </div>
      </div>

    </aside>
  );
};