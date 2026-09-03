import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Users, 
  Receipt, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  CheckCircle2, 
  Building2, 
  CreditCard, 
  Banknote,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Bike
} from 'lucide-react';
import { restaurantDataService, TableState } from '../../services/restaurantDataService';
import { dataService, Customer, Expense, CustomerTransaction } from '../../services/dataService';

interface DashboardViewProps {
  onNavigate?: (tab: any) => void;
  onQuickDebt?: () => void;
  onQuickCollection?: () => void;
  onQuickExpense?: () => void;
  onQuickEmployeePayment?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onQuickDebt,
  onQuickCollection,
  onQuickExpense,
  onQuickEmployeePayment
}) => {
  const [tables, setTables] = useState<TableState[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);

  const refreshData = () => {
    try {
      setTables(restaurantDataService.getTables() || []);
      setCustomers(dataService.getCustomers() || []);
      setExpenses(dataService.getExpenses() || []);
      setTransactions(dataService.getCustomerTransactions() || []);
    } catch (e) {
      console.error('Dashboard veri çekme hatası:', e);
    }
  };

  useEffect(() => {
    refreshData();
    const unsubRestaurant = restaurantDataService.subscribe(refreshData);
    const unsubData = dataService.subscribe(refreshData);

    return () => {
      unsubRestaurant();
      unsubData();
    };
  }, []);

  // 1. RESTORAN CANLI METRİKLERİ
  const occupiedTables = (tables || []).filter(t => t && t.status !== 'EMPTY');
  const occupiedCount = occupiedTables.length;
  const totalTableCount = (tables || []).length;
  const openTablesTurnover = (tables || []).reduce((sum, t) => sum + (Number(t.order?.totalAmount) || 0), 0);

  // 2. FİNANSAL CARİ VE KASA METRİKLERİ
  const totalCariReceivables = (customers || []).reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
  const totalExpensesAmount = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const formatMoney = (amount: number) => {
    return (Number(amount) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-slate-900 min-h-screen">
      
      {/* ÜST BAŞLIK VE HIZLI AKSİYONLAR */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/10">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Gaziantepli Taha Usta — Özet & Kasa Durumu</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">CANLI KASA</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Restoran masa ciroları, cari alacaklar ve kasa hareketleri.</p>
          </div>
        </div>

        {/* Hızlı Kısayol Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate && onNavigate('pos')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Restoran Masaları (POS)</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('customers')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Users className="w-4 h-4 text-sky-400" />
            <span>Müşteriler & Cari</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('expenses')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Receipt className="w-4 h-4 text-rose-400" />
            <span>Gider Ekle</span>
          </button>
        </div>
      </div>

      {/* 4 ANA METRİK KARTI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KART 1: AÇIK MASALAR CİROSU */}
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Açık Masalar Cirosu</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400 tracking-tight font-mono">
              {formatMoney(openTablesTurnover)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <span>{occupiedCount} Masada aktif adisyon var</span>
            </div>
          </div>
        </div>

        {/* KART 2: DOLU MASA ORANI */}
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Masa Doluluk Oranı</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {occupiedCount} / {totalTableCount} Masa
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              <span>%{totalTableCount > 0 ? Math.round((occupiedCount / totalTableCount) * 100) : 0} Doluluk Kapasitesi</span>
            </div>
          </div>
        </div>

        {/* KART 3: TOPLAM CARİ ALACAKLAR */}
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Toplam Cari Alacak</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-sky-400 tracking-tight font-mono">
              {formatMoney(totalCariReceivables)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              <span>{customers.length} Kayıtlı Cari Müşteri</span>
            </div>
          </div>
        </div>

        {/* KART 4: TOPLAM GİDERLER */}
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Toplam Giderler</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400 tracking-tight font-mono">
              {formatMoney(totalExpensesAmount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              <span>{expenses.length} Adet İşletme Gideri</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2 SÜTUNLU ALT ALAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SOL SÜTUN: AÇIK MASALARIN CANLI LİSTESİ */}
        <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-black text-white">Canlı Açık Masalar & Adisyonlar</h2>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('pos')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>Tüm Masalar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {occupiedTables.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 rounded-2xl">
                Şu anda restoranda açık veya hesap bekleyen masa bulunmuyor.
              </div>
            ) : (
              occupiedTables.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onNavigate && onNavigate('pos')}
                  className="p-3.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${t.status === 'BILL_REQUESTED' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`}></span>
                    <div>
                      <div className="font-black text-xs text-white flex items-center gap-2">
                        <span>{t.name}</span>
                        {t.status === 'BILL_REQUESTED' && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-black">HESAP İSTENDİ</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Garson: {t.order?.waiterName || 'Taha Usta'} • {(t.order?.items || []).length} Kalem
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-amber-300 font-mono">
                      {formatMoney(t.order?.totalAmount || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" /> {t.order?.orderTime || '12:00'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SAĞ SÜTUN: SON CARİ VE KASA İŞLEMLERİ */}
        <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-white">Son Cari & Tahsilat Hareketleri</h2>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('customers')}
              className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>Cari Listesi</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 rounded-2xl">
                Henüz kayıtlı cari hareket bulunmuyor.
              </div>
            ) : (
              [...transactions].reverse().slice(0, 6).map((tx) => {
                const cust = customers.find(c => c.id === tx.customerId);
                const isDebt = tx.type === 'DEBT';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                        isDebt ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {isDebt ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-black text-white">{cust?.name || 'Müşteri'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{tx.description || (isDebt ? 'Borç Kaydı' : 'Tahsilat')}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-black font-mono ${isDebt ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isDebt ? `+${formatMoney(tx.amount)}` : `-${formatMoney(tx.amount)}`}
                      </div>
                      <div className="text-[10px] text-slate-500">{tx.date}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
