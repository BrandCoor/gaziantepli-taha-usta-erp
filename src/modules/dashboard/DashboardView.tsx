import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Users, UserCheck, CheckCircle, Clock, Receipt, Wallet, TrendingDown } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface DashboardViewProps {
  onNavigate: (tab: 'customers' | 'employees' | 'expenses') => void;
  onQuickDebt: () => void;
  onQuickCollection: () => void;
  onQuickExpense: () => void;
  onQuickEmployeePayment: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onQuickDebt, onQuickCollection, onQuickExpense, onQuickEmployeePayment }) => {
  const stats = dataService.getSummaryStats();
  const customers = dataService.getCustomers();
  const employees = dataService.getEmployees();
  const expenses = dataService.getExpenses();

  const topDebtCustomers = [...customers].sort((a, b) => b.balance - a.balance).slice(0, 5);
  const recentExpenses = [...expenses].slice(0, 5);

  return (
    <div className="p-10 space-y-8 max-w-[1700px] mx-auto">
      {/* 4 Ana Finansal Kart */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Müşteri Alacakları</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{formatCurrency(stats.totalReceivables)}</div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Piyasadan tahsil edilecek toplam tutar</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Toplanan Tahsilat</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{formatCurrency(stats.totalCustomerCollections)}</div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Müşterilerden alınan toplam para</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">İşletme Giderleri</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">-{formatCurrency(stats.totalExpenses)}</div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Gıda, tedarikçi, fatura ve işletme harcamaları</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Personele Kalan Borç</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">{formatCurrency(stats.totalPersonnelDebt)}</div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Personele ödenecek net kalan tutar</p>
        </div>
      </div>

      {/* 2 Tablolu Detay Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alacak Bekleyen Müşteriler */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Alacak Bekleyen Müşteriler</h3>
                <p className="text-xs text-slate-500">En yüksek borç bakiyesine sahip müşteriler</p>
              </div>
              <button 
                onClick={() => onNavigate('customers')}
                className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                Tümünü Gör →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {topDebtCustomers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">Kayıtlı borçlu müşteri bulunmuyor.</div>
              ) : (
                topDebtCustomers.map(c => (
                  <div key={c.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                    <div>
                      <div className="font-black text-slate-800 text-sm">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.phone || 'Telefon yok'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-base">{formatCurrency(c.balance)}</div>
                      <div className="text-[11px] font-bold text-rose-600">Alacak Var</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex gap-3">
            <button 
              onClick={onQuickDebt}
              className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-2xl text-xs border border-rose-200 shadow-sm transition-all cursor-pointer"
            >
              + Borç Ekle
            </button>
            <button 
              onClick={onQuickCollection}
              className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-2xl text-xs border border-emerald-200 shadow-sm transition-all cursor-pointer"
            >
              + Tahsilat Al
            </button>
          </div>
        </div>

        {/* Son Yapılan Giderler */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Son Yapılan Giderler</h3>
                <p className="text-xs text-slate-500">Tedarikçi, hammadde ve işletme harcamaları</p>
              </div>
              <button 
                onClick={() => onNavigate('expenses')}
                className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                Tümünü Gör →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentExpenses.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">Henüz harcama kaydı bulunmuyor.</div>
              ) : (
                recentExpenses.map(exp => (
                  <div key={exp.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                    <div>
                      <div className="font-black text-slate-800 text-sm">{exp.title}</div>
                      <div className="text-xs text-slate-400">{exp.category} • {formatDate(exp.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-rose-600 text-base">-{formatCurrency(exp.amount)}</div>
                      <div className="text-[10px] text-slate-400">
                        {exp.paymentMethod === 'CASH' ? 'Nakit Kasa' : exp.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : 'Banka'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <button 
              onClick={onQuickExpense}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              <span>+ Yeni Gider / Harcama Ekle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};