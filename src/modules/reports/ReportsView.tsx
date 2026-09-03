import React, { useState } from 'react';
import { FileSpreadsheet, Users, UserCheck, Filter, Printer, Calendar, Clock, Receipt, Truck, Download } from 'lucide-react';
import { dataService, Customer, Employee, Expense, Supplier } from '../../services/dataService';
import { exportService, DateRange } from '../../services/exportService';
import { formatCurrency, formatDate } from '../../utils/formatters';

type ReportTab = 'CUSTOMERS' | 'SUPPLIERS' | 'EXPENSES' | 'EMPLOYEES';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('CUSTOMERS');
  
  // Filtreler
  const [customerFilter, setCustomerFilter] = useState<'ALL' | 'ONLY_DEBT'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<'ALL' | 'ONLY_DEBT'>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<'ALL' | 'ONLY_PENDING'>('ALL');
  const [expenseFilter, setExpenseFilter] = useState<string>('ALL');

  // Tarih Filtresi
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('ALL');

  const customers = dataService.getCustomers();
  const suppliers = dataService.getSuppliers();
  const expenses = dataService.getExpenses();
  const employees = dataService.getEmployees();

  const applyPreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
    setActivePreset(preset);
    const now = new Date();
    
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  // 1. Filtrelenmiş Müşteriler
  const filteredCustomers = customers.filter(c => {
    if (customerFilter === 'ONLY_DEBT' && c.balance <= 0) return false;
    if (startDate && c.createdAt < startDate) return false;
    if (endDate && c.createdAt > endDate) return false;
    return true;
  });
  const customerTotal = filteredCustomers.reduce((acc, c) => acc + c.balance, 0);

  // 2. Filtrelenmiş Toptancılar
  const filteredSuppliers = suppliers.filter(s => {
    if (supplierFilter === 'ONLY_DEBT' && s.balance <= 0) return false;
    if (startDate && s.createdAt < startDate) return false;
    if (endDate && s.createdAt > endDate) return false;
    return true;
  });
  const supplierTotal = filteredSuppliers.reduce((acc, s) => acc + s.balance, 0);

  // 3. Filtrelenmiş Giderler
  const filteredExpenses = expenses.filter(exp => {
    if (expenseFilter !== 'ALL' && exp.category !== expenseFilter) return false;
    if (startDate && exp.date < startDate) return false;
    if (endDate && exp.date > endDate) return false;
    return true;
  });
  const expenseTotal = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  // 4. Filtrelenmiş Personeller
  const filteredEmployees = employees.filter(e => {
    if (employeeFilter === 'ONLY_PENDING' && e.balance <= 0) return false;
    if (startDate && e.startDate < startDate) return false;
    if (endDate && e.startDate > endDate) return false;
    return true;
  });
  const employeeTotal = filteredEmployees.reduce((acc, e) => acc + e.balance, 0);

  const dateRangeParam: DateRange | undefined = (startDate && endDate) ? { startDate, endDate } : undefined;

  return (
    <div className="p-10 space-y-8 max-w-[1700px] mx-auto">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Raporlar & Dışa Aktarma</h2>
          <p className="text-xs text-slate-500">Müşteriler, toptancılar, giderler ve personel maaş dökümlerini resmi formatta alın</p>
        </div>

        {/* 4 MODÜLLÜ RAPOR SEÇİM SEKMELERİ */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300">
          <button
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'CUSTOMERS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-700 hover:bg-slate-300/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Müşteri Alacakları</span>
          </button>

          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'SUPPLIERS'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'text-slate-700 hover:bg-slate-300/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Toptancı Borçları</span>
          </button>

          <button
            onClick={() => setActiveTab('EXPENSES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'EXPENSES'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-700 hover:bg-slate-300/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>İşletme Giderleri</span>
          </button>

          <button
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'EMPLOYEES'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-700 hover:bg-slate-300/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Personel Maaşları</span>
          </button>
        </div>
      </div>

      {/* TARİH VE DURUM FİLTRE PANELİ */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
              <Clock className="w-4 h-4 text-blue-600" /> Hızlı Dönem:
            </span>
            <button
              onClick={() => applyPreset('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activePreset === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tüm Zamanlar
            </button>
            <button
              onClick={() => applyPreset('THIS_MONTH')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activePreset === 'THIS_MONTH' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => applyPreset('LAST_MONTH')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activePreset === 'LAST_MONTH' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Geçen Ay
            </button>
            <button
              onClick={() => applyPreset('THIS_YEAR')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activePreset === 'THIS_YEAR' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Bu Yıl
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" /> Tarih Aralığı:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset('ALL'); }}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            />
            <span className="text-slate-400 text-xs font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset('ALL'); }}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            />
          </div>
        </div>

        {/* 2. Satır: Durum Filtresi ve DIŞA AKTARMA BUTONLARI */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Filtre:</span>

            {activeTab === 'CUSTOMERS' && (
              <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value as any)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 cursor-pointer">
                <option value="ALL">Tüm Müşteriler</option>
                <option value="ONLY_DEBT">Sadece Alacak Olanlar</option>
              </select>
            )}

            {activeTab === 'SUPPLIERS' && (
              <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value as any)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 cursor-pointer">
                <option value="ALL">Tüm Toptancılar</option>
                <option value="ONLY_DEBT">Sadece Borcumuz Olanlar</option>
              </select>
            )}

            {activeTab === 'EXPENSES' && (
              <select value={expenseFilter} onChange={e => setExpenseFilter(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 cursor-pointer">
                <option value="ALL">Tüm Gider Kategorileri</option>
                <option value="Hammadde & Gıda Alımı">Hammadde & Gıda Alımı</option>
                <option value="Tedarikçi & Toptancı Ödemesi">Tedarikçi & Toptancı Ödemesi</option>
                <option value="Manav & Sebze-Meyve">Manav & Sebze-Meyve</option>
                <option value="Kasap & Et Ürünleri">Kasap & Et Ürünleri</option>
                <option value="Un, Maya & Fırın Girdileri">Un, Maya & Fırın Girdileri</option>
                <option value="Ambalaj & Paketleme Malzemeleri">Ambalaj & Paketleme</option>
                <option value="Temizlik & Hijyen">Temizlik & Hijyen</option>
                <option value="Fatura & Sabit Giderler">Fatura & Sabit Giderler</option>
              </select>
            )}

            {activeTab === 'EMPLOYEES' && (
              <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value as any)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 cursor-pointer">
                <option value="ALL">Tüm Personeller</option>
                <option value="ONLY_PENDING">Sadece Maaşı Kalanlar</option>
              </select>
            )}

            <div className="text-xs font-bold text-slate-500 pl-3">
              Toplam Tutar: <span className="text-rose-600 font-black text-sm">{formatCurrency(
                activeTab === 'CUSTOMERS' ? customerTotal :
                activeTab === 'SUPPLIERS' ? supplierTotal :
                activeTab === 'EXPENSES' ? expenseTotal : employeeTotal
              )}</span>
            </div>
          </div>

          {/* Dışa Aktarma Butonları */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'CUSTOMERS') exportService.exportCustomersExcel(filteredCustomers, customerTotal, dateRangeParam);
                else if (activeTab === 'SUPPLIERS') exportService.exportSuppliersExcel(filteredSuppliers, supplierTotal, dateRangeParam);
                else if (activeTab === 'EXPENSES') exportService.exportExpensesExcel(filteredExpenses, expenseTotal, dateRangeParam);
                else exportService.exportEmployeesExcel(filteredEmployees, employeeTotal, dateRangeParam);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Olarak İndir (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'CUSTOMERS') exportService.exportCustomersPdf(filteredCustomers, customerTotal, dateRangeParam);
                else if (activeTab === 'SUPPLIERS') exportService.exportSuppliersPdf(filteredSuppliers, supplierTotal, dateRangeParam);
                else if (activeTab === 'EXPENSES') exportService.exportExpensesPdf(filteredExpenses, expenseTotal, dateRangeParam);
                else exportService.exportEmployeesPdf(filteredEmployees, employeeTotal, dateRangeParam);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>PDF / Yazdır (.pdf)</span>
            </button>
          </div>
        </div>
      </div>

      {/* CANLI TABLO ÖNİZLEMESİ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            {activeTab === 'CUSTOMERS' && 'Müşteri Alacak Tablosu Önizleme'}
            {activeTab === 'SUPPLIERS' && 'Toptancı Borç & Tedarikçi Tablosu Önizleme'}
            {activeTab === 'EXPENSES' && 'İşletme Gider & Harcama Tablosu Önizleme'}
            {activeTab === 'EMPLOYEES' && 'Personel Maaş Tablosu Önizleme'}
            {startDate && endDate && (
              <span className="ml-2 lowercase font-normal text-slate-500">({formatDate(startDate)} - {formatDate(endDate)})</span>
            )}
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            {activeTab === 'CUSTOMERS' && `${filteredCustomers.length} Müşteri Kaydı`}
            {activeTab === 'SUPPLIERS' && `${filteredSuppliers.length} Toptancı Kaydı`}
            {activeTab === 'EXPENSES' && `${filteredExpenses.length} Harcama Kaydı`}
            {activeTab === 'EMPLOYEES' && `${filteredEmployees.length} Personel Kaydı`}
          </span>
        </div>

        {/* 1. Müşteri Tablosu */}
        {activeTab === 'CUSTOMERS' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Müşteri / Şirket Adı</th>
                <th className="py-3 px-4">Telefon</th>
                <th className="py-3 px-4">Adres / Notlar</th>
                <th className="py-3 px-4 text-right">Kalan Borç Bakiyesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 font-bold text-slate-800">{c.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{c.phone || '-'}</td>
                  <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">{c.notes || '-'}</td>
                  <td className={`py-3.5 px-4 text-right font-black ${c.balance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {formatCurrency(c.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 2. Toptancı Tablosu */}
        {activeTab === 'SUPPLIERS' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Toptancı / Firma Ünvanı</th>
                <th className="py-3 px-4">Tedarik Kategorisi</th>
                <th className="py-3 px-4">Telefon & Yetkili</th>
                <th className="py-3 px-4 text-right">Kalan Borcumuz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 font-bold text-slate-800">{s.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{s.category}</td>
                  <td className="py-3.5 px-4 text-slate-500">{s.phone || '-'} {s.contactPerson ? `(${s.contactPerson})` : ''}</td>
                  <td className={`py-3.5 px-4 text-right font-black ${s.balance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {formatCurrency(s.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 3. Gider Tablosu */}
        {activeTab === 'EXPENSES' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Harcama / Malzeme Adı</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Tedarikçi / Yer</th>
                <th className="py-3 px-4">Ödeme Kanalı</th>
                <th className="py-3 px-4 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 text-slate-500">{formatDate(exp.date)}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{exp.title}</td>
                  <td className="py-3.5 px-4 text-slate-600">{exp.category}</td>
                  <td className="py-3.5 px-4 text-slate-500">{exp.supplier || '-'}</td>
                  <td className="py-3.5 px-4">{exp.paymentMethod === 'CASH' ? 'Nakit Kasa' : exp.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : 'Banka'}</td>
                  <td className="py-3.5 px-4 text-right font-black text-rose-600">-{formatCurrency(exp.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 4. Personel Tablosu */}
        {activeTab === 'EMPLOYEES' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Personel Ad Soyad</th>
                <th className="py-3 px-4">Görevi / Pozisyonu</th>
                <th className="py-3 px-4">Telefon</th>
                <th className="py-3 px-4 text-right">Sabit Maaş</th>
                <th className="py-3 px-4 text-right">Kalan Borç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 font-bold text-slate-800">{e.fullName}</td>
                  <td className="py-3.5 px-4 text-slate-600">{e.position || '-'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{e.phone || '-'}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-700">{formatCurrency(e.salary)}</td>
                  <td className={`py-3.5 px-4 text-right font-black ${e.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(e.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};