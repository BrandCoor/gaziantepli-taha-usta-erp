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
  Code2, 
  Receipt,
  SlidersHorizontal
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
    { id: 'delivery', label: '📞 Paket & Caller ID', icon: PhoneCall },
    { id: 'online-orders', label: '🛵 Yemek Platformları', icon: Bike },
  ];

  const erpMenuItems = [
    { id: 'dashboard', label: 'Özet & Kasa Durumu', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteriler & Cari', icon: Users },
    { id: 'expenses', label: 'Giderler & Harcamalar', icon: Receipt },
    { id: 'employees', label: 'Personeller & Maaş', icon: UserCheck },
    { id: 'reports', label: 'Raporlar & Z Raporu', icon: BarChart2 },
  ];

  const settingsMenuItems = [
    { id: 'restaurant-settings', label: '⚙️ Restoran & Donanım Ayarları', icon: SlidersHorizontal },
  ];

  if (canManageUsers) {
    settingsMenuItems.push({ id: 'users', label: 'Kullanıcılar & Yetkiler', icon: ShieldCheck });
    settingsMenuItems.push({ id: 'company-settings', label: 'Firma & Logo Ayarları', icon: Building2 });
  }

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 select-none shadow-2xl z-20 flex-shrink-0">
      <div className="h-24 flex items-center gap-3.5 px-6 border-b border-slate-800/80 bg-slate-950/80">
        {company.logoBase64 ? (
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-500/60 shadow-xl bg-black flex-shrink-0">
            <img src={company.logoBase64} alt={company.companyName} className="w-full h-full object-fill rounded-full" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-400/40 flex items-center justify-center text-white font-black text-base shadow-lg shadow-amber-600/30 flex-shrink-0">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
        )}

        <div className="overflow-hidden">
          <h1 className="font-black text-sm text-white truncate tracking-tight" title={company.companyName}>
            {company.companyName}
          </h1>
          <p className="text-[11px] text-amber-400 font-bold tracking-wide flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Restoran & POS Paneli
          </p>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-amber-400/90 flex items-center justify-between">
            <span>Restoran Operasyonu</span>
            <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded-full">CANLI</span>
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
                    ? item.highlight 
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 translate-x-1' 
                      : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.highlight && !isActive ? 'text-amber-400' : ''}`} />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1 pt-2 border-t border-slate-800/60">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1 pt-2 border-t border-slate-800/60">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Yönetim & Sistem Ayarları
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
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-md translate-x-1' 
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4 text-amber-400" />
                <span className="text-xs tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
