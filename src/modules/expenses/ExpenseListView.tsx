import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  Calendar, 
  CreditCard, 
  Banknote, 
  XCircle, 
  CheckCircle2, 
  ChevronRight,
  Wallet
} from 'lucide-react';
import { 
  dataService, 
  Expense, 
  Supplier, 
  SupplierTransaction 
} from '../../services/dataService';
import { notify } from '../../services/notificationService';

export const EXPENSE_CATEGORIES = [
  'Et & Tavuk Tedariği',
  'Hal & Sebze Tedariği',
  'Un & Fırın Malzemeleri',
  'Meşrubat & İçecek',
  'Kira Gideri',
  'Elektrik Faturası',
  'Doğalgaz Faturası',
  'Su Faturası',
  'Mutfak Sarf & Temizlik',
  'Personel Yemek & İhtiyaç',
  'Vergi & SGK Ödemeleri',
  'Bakım, Onarım & Tadilat',
  'Diğer İşletme Giderleri'
];

export const SUPPLIER_CATEGORIES = [
  'Et & Tavuk',
  'Hal / Sebze',
  'Un / Fırın',
  'Meşrubat / İçecek',
  'Bakliyat / Gıda',
  'Ambalaj / Sarf',
  'Diğer'
];

interface ExpenseListViewProps {
  expenses?: Expense[];
  suppliers?: Supplier[];
  onRefresh?: () => void;
  onOpenAddExpenseModal?: () => void;
}

export const ExpenseListView: React.FC<ExpenseListViewProps> = () => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'suppliers' | 'statement'>('expenses');

  // Canlı Veriler
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);

  // Filtreler
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierForStatement, setSelectedSupplierForStatement] = useState<Supplier | null>(null);

  // MODAL STATELERİ
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: EXPENSE_CATEGORIES[0],
    supplierId: '',
    amount: '',
    paymentMethod: 'CASH' as Expense['paymentMethod'],
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    category: SUPPLIER_CATEGORIES[0],
    address: '',
    notes: '',
  });

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    amount: '',
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    supplierId: '',
    amount: '',
    paymentMethod: 'BANK' as SupplierTransaction['paymentMethod'],
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const refreshAll = () => {
    const exp = dataService.getExpenses() || [];
    const sup = dataService.getSuppliers() || [];
    const stx = dataService.getSupplierTransactions() || [];

    setExpenses(exp);
    setSuppliers(sup);
    setSupplierTransactions(stx);

    if (selectedSupplierForStatement) {
      const freshSup = sup.find(s => s.id === selectedSupplierForStatement.id);
      if (freshSup) setSelectedSupplierForStatement(freshSup);
    }
  };

  useEffect(() => {
    refreshAll();
    const unsub = dataService.subscribe(refreshAll);
    return () => unsub();
  }, []);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // 1. GİDER İŞLEMLERİ
  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      title: '',
      category: EXPENSE_CATEGORIES[0],
      supplierId: '',
      amount: '',
      paymentMethod: 'CASH',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseForm({
      title: exp.title,
      category: exp.category,
      supplierId: exp.supplierId || '',
      amount: String(exp.amount),
      paymentMethod: exp.paymentMethod,
      date: exp.date,
      description: exp.description || '',
    });
    setExpenseModalOpen(true);
  };

  const handleSaveExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) return notify.error('Eksik Alan', 'Gider başlığını girin!');
    const amountNum = parseFloat(expenseForm.amount);
    if (!amountNum || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir tutar girin!');

    const selectedSup = suppliers.find(s => s.id === expenseForm.supplierId);

    if (editingExpenseId) {
      dataService.updateExpense(editingExpenseId, {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        supplierId: expenseForm.supplierId || undefined,
        supplierName: selectedSup?.name,
        amount: amountNum,
        paymentMethod: expenseForm.paymentMethod,
        date: expenseForm.date,
        description: expenseForm.description.trim(),
      });
      notify.success('Gider Güncellendi', `[${expenseForm.title}] güncellendi.`);
    } else {
      dataService.saveExpense({
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        supplierId: expenseForm.supplierId || undefined,
        supplierName: selectedSup?.name,
        amount: amountNum,
        paymentMethod: expenseForm.paymentMethod,
        date: expenseForm.date,
        description: expenseForm.description.trim(),
      });
      notify.success('Gider Kaydedildi', `${formatMoney(amountNum)} tutarında harcama işlendi.`);
    }

    setExpenseModalOpen(false);
  };

  const handleDeleteExpense = (id: string, title: string) => {
    notify.confirm({
      title: 'Gider Kaydını Sil',
      message: `[${title}] gider kaydını silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        dataService.deleteExpense(id);
        notify.success('Silindi', `[${title}] gideri silindi.`);
      }
    });
  };

  // 2. TOPTANCI İŞLEMLERİ
  const openNewSupplierModal = () => {
    setEditingSupplierId(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      category: SUPPLIER_CATEGORIES[0],
      address: '',
      notes: '',
    });
    setSupplierModalOpen(true);
  };

  const openEditSupplierModal = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setSupplierForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      category: s.category || SUPPLIER_CATEGORIES[0],
      address: s.address || '',
      notes: s.notes || '',
    });
    setSupplierModalOpen(true);
  };

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return notify.error('Eksik Alan', 'Toptancı adını girin!');

    if (editingSupplierId) {
      dataService.updateSupplier(editingSupplierId, {
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim(),
        phone: supplierForm.phone.trim(),
        category: supplierForm.category,
        address: supplierForm.address.trim(),
        notes: supplierForm.notes.trim(),
      });
      notify.success('Toptancı Güncellendi', `[${supplierForm.name}] bilgileri kaydedildi.`);
    } else {
      dataService.addSupplier({
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim(),
        phone: supplierForm.phone.trim(),
        category: supplierForm.category,
        address: supplierForm.address.trim(),
        notes: supplierForm.notes.trim(),
        balance: 0,
      });
      notify.success('Toptancı Eklendi', `[${supplierForm.name}] tedarikçi listesine eklendi.`);
    }

    setSupplierModalOpen(false);
  };

  const handleDeleteSupplier = (id: string, name: string) => {
    notify.confirm({
      title: 'Toptancıyı Sil',
      message: `[${name}] toptancısını silmek istediğinize emin misiniz? Cari hareketleri de silinecektir.`,
      type: 'danger',
      onConfirm: () => {
        dataService.deleteSupplier(id);
        notify.success('Silindi', `[${name}] silindi.`);
      }
    });
  };

  // 3. FATURA GİRİŞİ (BORÇLANDIRMA)
  const handleSaveInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.supplierId) return notify.error('Eksik Alan', 'Lütfen toptancı seçin!');
    const amountNum = parseFloat(invoiceForm.amount);
    if (!amountNum || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir fatura tutarı girin!');

    const sup = suppliers.find(s => s.id === invoiceForm.supplierId);

    dataService.addSupplierTransaction(invoiceForm.supplierId, {
      type: 'INVOICE',
      amount: amountNum,
      paymentMethod: 'CASH',
      date: invoiceForm.date,
      invoiceNo: invoiceForm.invoiceNo.trim() || undefined,
      description: invoiceForm.description.trim() || 'Alış Faturası Girişi',
    });

    notify.success('Fatura İşlendi', `[${sup?.name}] hesabına ${formatMoney(amountNum)} tutarında alış faturası borç kaydedildi.`);
    setInvoiceModalOpen(false);
    setInvoiceForm({ supplierId: '', amount: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], description: '' });
  };

  // 4. TOPTANCIYA ÖDEME ÇIKIŞI
  const handleSavePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.supplierId) return notify.error('Eksik Alan', 'Lütfen toptancı seçin!');
    const amountNum = parseFloat(paymentForm.amount);
    if (!amountNum || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir ödeme tutarı girin!');

    const sup = suppliers.find(s => s.id === paymentForm.supplierId);

    dataService.addSupplierTransaction(paymentForm.supplierId, {
      type: 'PAYMENT',
      amount: amountNum,
      paymentMethod: paymentForm.paymentMethod,
      date: paymentForm.date,
      description: paymentForm.description.trim() || 'Toptancıya Ödeme Çıkışı',
    });

    notify.success('Ödeme İşlendi', `[${sup?.name}] hesabına ${formatMoney(amountNum)} tutarında ödeme işlendi.`);
    setPaymentModalOpen(false);
    setPaymentForm({ supplierId: '', amount: '', paymentMethod: 'BANK', date: new Date().toISOString().split('T')[0], description: '' });
  };

  // Filtrelenmiş Veriler
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(expenseSearch.toLowerCase()) || (e.supplierName || '').toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCategory = expenseCategoryFilter === 'ALL' || e.category === expenseCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || 
    (s.contactPerson || '').toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.phone || '').includes(supplierSearch)
  );

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalSupplierDebtSum = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.balance) || 0), 0);

  const statementTransactions = selectedSupplierForStatement 
    ? dataService.getSupplierStatement(selectedSupplierForStatement.id) 
    : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-slate-900 min-h-screen">
      
      {/* ÜST BAŞLIK VE SEKME BARI */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center font-black text-2xl shadow-lg">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Giderler & Toptancılar ERP Merkezi</span>
              <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase">FİNANS</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">İşletme harcamaları, toptancı alış faturaları, tedarikçi ödemeleri ve cari ekstreler.</p>
          </div>
        </div>

        {/* Sekme Butonları */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'expenses' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>İşletme Giderleri ({expenses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'suppliers' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Toptancılar & Cariler ({suppliers.length})</span>
          </button>

          {selectedSupplierForStatement && (
            <button
              onClick={() => setActiveTab('statement')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'statement' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Ekstre: {selectedSupplierForStatement.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. İŞLETME GİDERLERİ & HARCAMALAR SEKMESİ */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          
          {/* Arama, Kategori Filtresi & Yeni Gider Butonu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Gider adı veya tedarikçi ara..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">Tüm Kategoriler</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Toplam Harcama</div>
                <div className="text-lg font-black text-rose-400 font-mono">{formatMoney(totalExpenseSum)}</div>
              </div>

              <button
                onClick={openNewExpenseModal}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Yeni Gider Ekle</span>
              </button>
            </div>
          </div>

          {/* Gider Tablosu */}
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-extrabold uppercase">
                  <th className="pb-3">Gider Başlığı</th>
                  <th className="pb-3">Kategori</th>
                  <th className="pb-3">Tedarikçi</th>
                  <th className="pb-3">Ödeme Türü</th>
                  <th className="pb-3">Tarih</th>
                  <th className="pb-3">Tutar</th>
                  <th className="pb-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Kayıtlı gider bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3.5 font-black text-white">{exp.title}</td>
                      <td className="py-3.5">
                        <span className="px-2.5 py-0.5 bg-slate-900 border border-slate-700 rounded-md text-[10px] font-bold text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-400">{exp.supplierName || '—'}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          exp.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
                        }`}>
                          {exp.paymentMethod === 'CASH' ? 'Nakit' : exp.paymentMethod === 'BANK' ? 'Banka / Havale' : 'Kredi Kartı'}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-400 font-mono">{exp.date}</td>
                      <td className="py-3.5 font-black font-mono text-rose-400 text-sm">
                        {formatMoney(exp.amount)}
                      </td>
                      <td className="py-3.5 text-right space-x-1">
                        <button
                          onClick={() => openEditExpenseModal(exp)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOPTANCILAR & TEDARİKÇİLER SEKMESİ */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Toptancı adı, yetkili veya telefon ara..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-right mr-3">
                <div className="text-[10px] uppercase font-bold text-slate-400">Toptancılara Toplam Borç</div>
                <div className="text-lg font-black text-rose-400 font-mono">{formatMoney(totalSupplierDebtSum)}</div>
              </div>

              {/* FATURA GİRİŞ BUTONU */}
              <button
                onClick={() => {
                  setInvoiceForm({ supplierId: suppliers[0]?.id || '', amount: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], description: '' });
                  setInvoiceModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>+ Fatura Girişi (Borçlan)</span>
              </button>

              {/* ÖDEME ÇIKIŞ BUTONU */}
              <button
                onClick={() => {
                  setPaymentForm({ supplierId: suppliers[0]?.id || '', amount: '', paymentMethod: 'BANK', date: new Date().toISOString().split('T')[0], description: '' });
                  setPaymentModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>+ Ödeme Yap (Borç Düş)</span>
              </button>

              {/* YENİ TOPTANCI BUTONU */}
              <button
                onClick={openNewSupplierModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Yeni Toptancı</span>
              </button>
            </div>
          </div>

          {/* Toptancı Kartları Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] font-black uppercase">
                      {s.category}
                    </span>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditSupplierModal(s)} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteSupplier(s.id, s.name)} className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-black text-base text-white">{s.name}</h3>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Yetkili: {s.contactPerson || 'Girilmedi'}</div>
                  <div className="text-xs text-amber-300 font-mono mt-0.5">{s.phone || 'Telefon yok'}</div>

                  <div className="mt-4 p-3.5 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Mevcut Borcumuz</span>
                      <div className={`font-mono font-black text-base ${s.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatMoney(s.balance)}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSupplierForStatement(s);
                        setActiveTab('statement');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Ekstre</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TOPTANCI CARİ EKSTRE DÖKÜMÜ */}
      {/* ========================================================================= */}
      {activeTab === 'statement' && selectedSupplierForStatement && (
        <div className="space-y-6">
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">{selectedSupplierForStatement.name}</h2>
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-black uppercase">CARİ EKSTRE</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Yetkili: {selectedSupplierForStatement.contactPerson} • {selectedSupplierForStatement.phone}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500">Kalan Net Borcumuz</span>
                <div className="text-2xl font-black text-rose-400 font-mono">{formatMoney(selectedSupplierForStatement.balance)}</div>
              </div>

              <button
                onClick={() => {
                  setInvoiceForm({ supplierId: selectedSupplierForStatement.id, amount: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], description: '' });
                  setInvoiceModalOpen(true);
                }}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                + Fatura Ekle
              </button>

              <button
                onClick={() => {
                  setPaymentForm({ supplierId: selectedSupplierForStatement.id, amount: '', paymentMethod: 'BANK', date: new Date().toISOString().split('T')[0], description: '' });
                  setPaymentModalOpen(true);
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                + Ödeme Yap
              </button>
            </div>
          </div>

          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-extrabold uppercase">
                  <th className="pb-3">Tarih</th>
                  <th className="pb-3">İşlem Türü</th>
                  <th className="pb-3">Fatura No</th>
                  <th className="pb-3">Açıklama</th>
                  <th className="pb-3">Ödeme Türü</th>
                  <th className="pb-3 text-right">Borç / Fatura (+)</th>
                  <th className="pb-3 text-right">Ödeme (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {statementTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Bu toptancıya ait henüz fatura veya ödeme hareketi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  statementTransactions.map((tx) => {
                    const isInvoice = tx.type === 'INVOICE';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-900/60">
                        <td className="py-3.5 text-slate-400 font-mono">{tx.date}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black ${
                            isInvoice ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isInvoice ? '📄 Alış Faturası' : '💳 Ödeme Yapıldı'}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-slate-300">{tx.invoiceNo || '—'}</td>
                        <td className="py-3.5 text-slate-300">{tx.description || '—'}</td>
                        <td className="py-3.5 text-slate-400">{tx.paymentMethod}</td>
                        <td className="py-3.5 text-right font-black font-mono text-rose-400">
                          {isInvoice ? `+${formatMoney(tx.amount)}` : '—'}
                        </td>
                        <td className="py-3.5 text-right font-black font-mono text-emerald-400">
                          {!isInvoice ? `-${formatMoney(tx.amount)}` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. GİDER EKLE / DÜZENLE MODALI */}
      {/* ========================================================================= */}
      {expenseModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">{editingExpenseId ? 'Gideri Düzenle' : 'Yeni İşletme Gideri Ekle'}</h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveExpenseSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Gider Başlığı / Açıklama</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="Örn: Mutfak Sıvı Yağ Alımı"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Harcama Tutarı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="1250.00"
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-rose-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Kategori</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Ödeme Şekli</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    <option value="CASH">Nakit Kasa</option>
                    <option value="BANK">Banka / Havale</option>
                    <option value="CREDIT_CARD">Kredi Kartı</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Tarih</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">İlgili Toptancı (İsteğe Bağlı)</label>
                <select
                  value={expenseForm.supplierId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, supplierId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  <option value="">Toptancı Seçilmedi</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setExpenseModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOPTANCI EKLE / DÜZENLE MODALI */}
      {/* ========================================================================= */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">{editingSupplierId ? 'Toptancıyı Düzenle' : 'Yeni Toptancı / Tedarikçi Tanımla'}</h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveSupplierSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Toptancı / Firma Adı</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Örn: Antep Et ve Kasap Hali"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Yetkili Kişi</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    placeholder="Örn: Mustafa Bey"
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Telefon Numarası</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="0532..."
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Faaliyet Kategorisi</label>
                <select
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  {SUPPLIER_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Adres Bilgisi</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Gaziantep Toptancılar Hali..."
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setSupplierModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ALIŞ FATURASI GİRİŞİ MODALI (BORÇLANDIRMA) */}
      {/* ========================================================================= */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Alış Faturası Girişi (Borçlanma)</h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveInvoiceSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Toptancı / Tedarikçi Seçin</label>
                <select
                  required
                  value={invoiceForm.supplierId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  <option value="">Seçiniz...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Bakiye: {formatMoney(s.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Fatura Tutarı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="4500.00"
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-rose-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Fatura / İrsaliye No</label>
                  <input
                    type="text"
                    value={invoiceForm.invoiceNo}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNo: e.target.value })}
                    placeholder="GZT-2026-081"
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Fatura Tarihi</label>
                <input
                  type="date"
                  value={invoiceForm.date}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Açıklama</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="50 kg Kuzu Boşluk, 30 kg Kuşbaşı..."
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setInvoiceModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg">Faturayı İşle (+Borç)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TOPTANCIYA ÖDEME YAPMA MODALI (BORÇTAN DÜŞME) */}
      {/* ========================================================================= */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Toptancıya Ödeme Çıkışı</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><XCircle className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSavePaymentSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Toptancı Seçin</label>
                <select
                  required
                  value={paymentForm.supplierId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, supplierId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  <option value="">Seçiniz...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Borç: {formatMoney(s.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Ödenen Tutar (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="3000.00"
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Ödeme Şekli</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    <option value="BANK">Banka / Havale</option>
                    <option value="CASH">Nakit Kasa</option>
                    <option value="CREDIT_CARD">Kredi Kartı</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Ödeme Tarihi</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Açıklama / Dekont Notu</label>
                <input
                  type="text"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="Kısmi ödeme, havale dekontu..."
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg">Ödemeyi Düş (-Borç)</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
