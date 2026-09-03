import React from 'react';
import { LayoutDashboard, Users, UserCheck, BarChart2, ShieldCheck, Building2, UtensilsCrossed, Sparkles, Code2, Receipt } from 'lucide-react';
import { dataService } from '../../services/dataService';

export type ActiveTab = 'dashboard' | 'customers' | 'employees' | 'expenses' | 'reports' | 'users' | 'company-settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const canManageUsers = dataService.hasPermission('USERS_MANAGE');
  const company = dataService.getCompanySettings();

  const menuItems = [
    { id: 'dashboard', label: 'Özet Ekranı', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteriler & Cari', icon: Users },
    { id: 'expenses', label: 'Giderler & Harcamalar', icon: Receipt },
    { id: 'employees', label: 'Personeller & Maaş', icon: UserCheck },
    { id: 'reports', label: 'Raporlar & Dökümler', icon: BarChart2 },
  ];

  if (canManageUsers) {
    menuItems.push({ id: 'users', label: 'Kullanıcılar & Yetkiler', icon: ShieldCheck });
    menuItems.push({ id: 'company-settings', label: 'Firma & Logo Ayarları', icon: Building2 });
  }

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 select-none shadow-2xl z-20">
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
            Özel İşletme Paneli
          </p>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
          Ana Modüller
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 m-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Özel Yazılım
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="text-white font-black text-xs tracking-tight truncate">
          Gaziantepli Taha Usta
        </div>
        <div className="text-slate-400 text-[11px] mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-400">
            <Code2 className="w-3.5 h-3.5 text-blue-400" /> Kodlama:
          </span>
          <span className="font-black text-blue-400 tracking-wider">RYMedya</span>
        </div>
      </div>
    </aside>
  );
};