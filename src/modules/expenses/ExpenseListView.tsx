import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Receipt, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Calendar, 
  CreditCard, 
  Wallet, 
  Building2, 
  Printer, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown,
  Truck,
  FileText,
  Clock,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { dataService, Expense, Supplier, SupplierTransaction } from '../../services/dataService';
import { exportService, DateRange } from '../../services/exportService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface ExpenseListViewProps {
  expenses: Expense[];
  suppliers: Supplier[];
  onRefresh: () => void;
  onOpenAddExpenseModal: () => void;
}

type MainTab = 'INSTANT_EXPENSES' | 'SUPPLIERS';

export const EXPENSE_CATEGORIES = [
  'Hammadde & Gıda Alımı',
  'Tedarikçi & Toptancı Ödemesi',
  'Manav & Sebze-Meyve',
  'Kasap & Et Ürünleri',
  'Un, Maya & Fırın Girdileri',
  'Ambalaj & Paketleme Malzemeleri',
  'Temizlik & Hijyen',
  'Dükkan Bakım & Onarım',
  'Fatura & Sabit Giderler',
  'Genel İşletme Giderleri'
];

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({ 
  expenses, 
  suppliers, 
  onRefresh, 
  onOpenAddExpenseModal
}) => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('INSTANT_EXPENSES');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Toptancı Ekle/Düzenle
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('Un, Maya & Fırın Girdileri');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  // 2. Mal Alışı (İrsaliye/Fatura)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDoc, setPurchaseDoc] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseDesc, setPurchaseDesc] = useState('Faturalı / İrsaliyeli Mal Alışı');

  // 3. Toptancıya Ödeme Yap
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD' | 'CHECK'>('BANK');
  const [payAmount, setPayAmount] = useState('');
  const [payDoc, setPayDoc] = useState('');
  const [payDueDate, setPayDueDate] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDesc, setPayDesc] = useState('Toptancı Cari Ödemesi');

  // 4. Ekstre & Silme
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [stxToDeleteId, setStxToDeleteId] = useState<string | null>(null);

  // 5. Anlık Gider
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expSupplier, setExpSupplier] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expMethod, setExpMethod] = useState<'CASH' | 'CREDIT_CARD' | 'BANK'>('CASH');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

  const totalInstantExpenses = safeExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const totalSupplierDebt = safeSuppliers.reduce((acc, s) => acc + (Number(s.balance) || 0), 0);

  const handleOpenAddSupplier = () => {
    setEditingSupplierId(null);
    setSupplierName('');
    setSupplierCategory('Un, Maya & Fırın Girdileri');
    setSupplierPhone('');
    setSupplierContact('');
    setSupplierNotes('');
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setSupplierName(s.name);
    setSupplierCategory(s.category);
    setSupplierPhone(s.phone || '');
    setSupplierContact(s.contactPerson || '');
    setSupplierNotes(s.notes || '');
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return alert('Lütfen toptancı / firma adını girin');

    dataService.saveSupplier({
      id: editingSupplierId || undefined,
      name: supplierName,
      category: supplierCategory,
      phone: supplierPhone,
      contactPerson: supplierContact,
      notes: supplierNotes
    });

    setShowSupplierModal(false);
    onRefresh();
  };

  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete) return;
    dataService.deleteSupplier(supplierToDelete.id);
    setSupplierToDelete(null);
    onRefresh();
  };

  const handleOpenPurchase = (supId?: string) => {
    const fresh = dataService.getSuppliers();
    if (fresh.length === 0) {
      alert('Henüz kayıtlı toptancı bulunmuyor. Önce toptancı ekleyiniz.');
      handleOpenAddSupplier();
      return;
    }
    setPurchaseSupplierId(supId || fresh[0]?.id || '');
    setPurchaseAmount('');
    setPurchaseDoc('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseDesc('Faturalı / İrsaliyeli Mal Alışı');
    setShowPurchaseModal(true);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseSupplierId) return alert('Lütfen toptancı seçin');
    if (!purchaseAmount || Number(purchaseAmount) <= 0) return alert('Geçerli bir tutar girin');

    dataService.addSupplierTransaction(purchaseSupplierId, {
      type: 'PURCHASE',
      amount: Number(purchaseAmount),
      documentNumber: purchaseDoc,
      date: purchaseDate,
      description: purchaseDesc
    });

    setShowPurchaseModal(false);
    onRefresh();
  };

  const handleOpenSupplierPay = (supId?: string) => {
    const fresh = dataService.getSuppliers();
    if (fresh.length === 0) {
      alert('Henüz kayıtlı toptancı bulunmuyor. Önce toptancı ekleyiniz.');
      handleOpenAddSupplier();
      return;
    }
    setPaySupplierId(supId || fresh[0]?.id || '');
    setPayMethod('BANK');
    setPayAmount('');
    setPayDoc('');
    setPayDueDate('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayDesc('Toptancı Cari Ödemesi');
    setShowSupplierPayModal(true);
  };

  const handleSaveSupplierPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierId) return alert('Lütfen toptancı seçin');
    if (!payAmount || Number(payAmount) <= 0) return alert('Geçerli bir ödeme tutarı girin');

    dataService.addSupplierTransaction(paySupplierId, {
      type: 'PAYMENT',
      amount: Number(payAmount),
      paymentMethod: payMethod,
      documentNumber: payDoc,
      dueDate: payMethod === 'CHECK' ? payDueDate : undefined,
      date: payDate,
      description: payDesc
    });

    setShowSupplierPayModal(false);
    onRefresh();
  };

  const handleConfirmDeleteStx = () => {
    if (!selectedSupplier || !stxToDeleteId) return;
    const updated = dataService.deleteSupplierTransaction(selectedSupplier.id, stxToDeleteId);
    if (updated) {
      setSelectedSupplier({ ...updated });
      setStxToDeleteId(null);
      onRefresh();
    }
  };

  const handleSaveExpenseEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!expTitle.trim()) return alert('Lütfen gider adını girin');
    if (!expAmount || Number(expAmount) <= 0) return alert('Geçerli bir tutar girin');

    dataService.saveExpense({
      id: editingExpense.id,
      title: expTitle,
      category: expCategory,
      supplier: expSupplier,
      amount: Number(expAmount),
      paymentMethod: expMethod,
      date: expDate,
      description: expDesc
    });

    setEditingExpense(null);
    onRefresh();
  };

  const handleConfirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    dataService.deleteExpense(expenseToDelete.id);
    setExpenseToDelete(null);
    onRefresh();
  };

  return (
    <div className="p-10 space-y-8 max-w-[1700px] mx-auto">
      {/* Üst Başlık & Butonlar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shadow-sm">
              <Receipt className="w-5 h-5" />
            </span>
            <span>Giderler, Harcamalar & Toptancılar</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Nakit/Kart harcamaları ve toptancı faturalı/vadeli mal alımları</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {activeMainTab === 'INSTANT_EXPENSES' ? (
            <button
              type="button"
              onClick={onOpenAddExpenseModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Anlık Gider Ekle</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenPurchase()}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Mal Alışı (İrsaliye/Fatura)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSupplierPay()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>+ Toptancıya Ödeme Yap</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddSupplier}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Yeni Toptancı Ekle</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2 ANA SEÇİM SEKMESİ */}
      <div className="flex items-center gap-3 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 w-fit select-none">
        <button
          type="button"
          onClick={() => setActiveMainTab('INSTANT_EXPENSES')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainTab === 'INSTANT_EXPENSES'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>🏪 Anlık Harcamalar (Market, Kasa & Kart)</span>
          <span className="px-2 py-0.5 bg-black/20 rounded-full text-[10px] font-bold">
            {formatCurrency(totalInstantExpenses)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('SUPPLIERS')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainTab === 'SUPPLIERS'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/25'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>🚚 Toptancılar & Mal Alımları (Cari & Vadeli/Çekli)</span>
          <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-bold">
            Borç: {formatCurrency(totalSupplierDebt)}
          </span>
        </button>
      </div>

      {/* 1. SEKME: ANLIK GİDERLER TABLOSU */}
      {activeMainTab === 'INSTANT_EXPENSES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm">Anlık Harcamalar Listesi</h3>
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                Toplam Harcama: -{formatCurrency(totalInstantExpenses)}
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase select-none">
                <tr>
                  <th className="py-4 px-6">Tarih</th>
                  <th className="py-4 px-6">Gider / Malzeme Adı</th>
                  <th className="py-4 px-6">Kategori</th>
                  <th className="py-4 px-6">Alınan Yer / Market</th>
                  <th className="py-4 px-6">Ödeme Kanalı</th>
                  <th className="py-4 px-6 text-right">Tutar</th>
                  <th className="py-4 px-6 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600 text-sm">Kayıtlı anlık harcama bulunmuyor.</p>
                    </td>
                  </tr>
                ) : (
                  safeExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 text-slate-500 whitespace-nowrap font-medium">{formatDate(exp.date)}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm">{exp.title}</div>
                        {exp.description && <div className="text-[10px] text-slate-400">{exp.description}</div>}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{exp.supplier || '-'}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800">
                          {exp.paymentMethod === 'CASH' ? '💵 Nakit Kasa' : exp.paymentMethod === 'CREDIT_CARD' ? '💳 Kredi Kartı' : '🏦 Banka'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-black text-sm text-rose-600">
                        -{formatCurrency(exp.amount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(exp);
                              setExpTitle(exp.title);
                              setExpCategory(exp.category);
                              setExpSupplier(exp.supplier || '');
                              setExpAmount(exp.amount.toString());
                              setExpMethod(exp.paymentMethod);
                              setExpDate(exp.date);
                              setExpDesc(exp.description || '');
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs border border-slate-200 cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs border border-slate-200 cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SEKME: TOPTANCILAR & MAL ALIMLARI TABLOSU */}
      {activeMainTab === 'SUPPLIERS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm">Toptancı ve Tedarikçi Cari Hesapları</h3>
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                Toptancılara Toplam Borcumuz: {formatCurrency(totalSupplierDebt)}
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase select-none">
                <tr>
                  <th className="py-4 px-6">Toptancı / Firma Ünvanı</th>
                  <th className="py-4 px-6">Tedarik Kategorisi</th>
                  <th className="py-4 px-6">İletişim & Yetkili</th>
                  <th className="py-4 px-6 text-right">Kalan Borcumuz</th>
                  <th className="py-4 px-6 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600 text-sm">Kayıtlı toptancı bulunmuyor.</p>
                      <p className="text-[11px] text-slate-400 mt-1">"Yeni Toptancı Ekle" butonuna basarak uncu, kasap vb. firmaları kaydedebilirsiniz.</p>
                    </td>
                  </tr>
                ) : (
                  safeSuppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm">{sup.name}</div>
                        {sup.notes && <div className="text-[10px] text-slate-400 truncate max-w-xs">{sup.notes}</div>}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-[10px]">
                          {sup.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="font-medium">{sup.phone || '-'}</div>
                        {sup.contactPerson && <div className="text-[10px] text-slate-400">{sup.contactPerson}</div>}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className={`font-black text-sm ${sup.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(sup.balance)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sup.balance > 0 ? 'Borcumuz Var' : 'Hesap Kapandı (0 ₺)'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPurchase(sup.id)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px] border border-rose-200 cursor-pointer"
                            title="Mal Alışı / Fatura Borcu Gir"
                          >
                            + Mal Alışı
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSupplierPay(sup.id)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[11px] border border-blue-200 cursor-pointer"
                            title="Toptancıya Ödeme Yap"
                          >
                            + Ödeme
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedSupplier(sup)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer"
                            title="Toptancı Ekstresini Görüntüle ve Yazdır"
                          >
                            Ekstre
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditSupplier(sup)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs border border-slate-200 cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs border border-slate-200 cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. TOPTANCI EKLE / DÜZENLE MODALI */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingSupplierId ? 'Toptancı Bilgilerini Düzenle' : 'Yeni Toptancı / Tedarikçi Ekle'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Un, et, yağ, ambalaj toptancısı cari kartı oluşturun</p>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Toptancı / Firma Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="Örn: Öz Un Sanayi, Güven Et..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white font-medium select-text cursor-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tedarik Kategorisi</label>
                <select
                  value={supplierCategory}
                  onChange={e => setSupplierCategory(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                >
                  <option value="Un, Maya & Fırın Girdileri">Un, Maya & Fırın Girdileri</option>
                  <option value="Kasap & Et Ürünleri">Kasap & Et Ürünleri</option>
                  <option value="Hammadde & Yağ-Bakliyat">Hammadde & Yağ-Bakliyat</option>
                  <option value="Manav & Sebze">Manav & Sebze</option>
                  <option value="Baharat & Çeşni">Baharat & Çeşni</option>
                  <option value="Ambalaj & Kutu">Ambalaj & Kutu</option>
                  <option value="Temizlik Malzemesi">Temizlik Malzemesi</option>
                  <option value="Diğer Tedarikçi">Diğer Tedarikçi</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Yetkili Kişi</label>
                  <input
                    type="text"
                    value={supplierContact}
                    onChange={e => setSupplierContact(e.target.value)}
                    placeholder="Örn: Ahmet Bey"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Firma Adresi / Notlar</label>
                <textarea
                  rows={2}
                  value={supplierNotes}
                  onChange={e => setSupplierNotes(e.target.value)}
                  placeholder="Firma adresi veya özel notlar..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {editingSupplierId ? 'Değişiklikleri Kaydet' : 'Toptancıyı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. TOPTANCI MAL ALIŞI MODALI */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Mal Alışı / Fatura Girişi</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Toptancıdan alınan mal tutarını borç olarak işleyin</p>

            <form onSubmit={handleSavePurchase} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Toptancı / Tedarikçi Seçin *</label>
                <select
                  value={purchaseSupplierId}
                  onChange={e => setPurchaseSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                >
                  {safeSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mal Alış Tutarı (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchaseAmount}
                    onChange={e => setPurchaseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-sm font-black text-rose-600 bg-white select-text cursor-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fatura / İrsaliye Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs font-semibold bg-white cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fatura / İrsaliye Numarası</label>
                <input
                  type="text"
                  value={purchaseDoc}
                  onChange={e => setPurchaseDoc(e.target.value)}
                  placeholder="Örn: IRS-2026-0045 veya FAT-889"
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs bg-white font-mono select-text cursor-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alınan Malzeme Açıklaması</label>
                <input
                  type="text"
                  value={purchaseDesc}
                  onChange={e => setPurchaseDesc(e.target.value)}
                  placeholder="Örn: 20 Çuval Ekmeklik Un..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-rose-600 rounded-xl text-xs bg-white select-text cursor-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  Alışı Kaydet (+Borç Yaz)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. TOPTANCI ÖDEME MODALI */}
      {showSupplierPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Toptancıya Ödeme Yap</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Nakit, kart, havale veya çek ile ödemenizi kaydedin</p>

            <form onSubmit={handleSaveSupplierPay} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Toptancı Seçin *</label>
                <select
                  value={paySupplierId}
                  onChange={e => setPaySupplierId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                >
                  {safeSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Kalan Borç: {s.balance} TL)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Yöntemi</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold bg-white cursor-pointer"
                >
                  <option value="BANK">🏦 Banka / Havale / EFT</option>
                  <option value="CASH">💵 Nakit Kasa</option>
                  <option value="CREDIT_CARD">💳 Şirket Kredi Kartı</option>
                  <option value="CHECK">📑 Çek ile Ödeme</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödenen Tutar (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-sm font-black text-emerald-600 bg-white select-text cursor-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs font-semibold bg-white cursor-pointer"
                  />
                </div>
              </div>

              {payMethod === 'CHECK' && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">Çek Numarası</label>
                    <input
                      type="text"
                      value={payDoc}
                      onChange={e => setPayDoc(e.target.value)}
                      placeholder="Çek seri no..."
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white select-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">Çek Vade Tarihi</label>
                    <input
                      type="date"
                      value={payDueDate}
                      onChange={e => setPayDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs bg-white cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama / Dekont No</label>
                <input
                  type="text"
                  value={payDesc}
                  onChange={e => setPayDesc(e.target.value)}
                  placeholder="İşlem açıklaması..."
                  className="w-full px-3 py-2 border-2 border-slate-200 focus:border-blue-600 rounded-xl text-xs bg-white select-text cursor-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierPayModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Ödemeyi Kaydet (-Borç Düş)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. GÖRSELDEKİ TOPTANCI EKSTRE MODALI (YAZDIR / PDF & EXCEL ÇIKTILARI EKLİ) */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-7 shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col relative z-50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedSupplier.name} - Toptancı Cari Ekstresi</h3>
                <p className="text-xs text-slate-500">Kategori: {selectedSupplier.category} | Tel: {selectedSupplier.phone || '-'}</p>
              </div>

              <div className="flex items-center gap-3">
                {/* 🖨️ YAZDIR / PDF BUTONU */}
                <button
                  type="button"
                  onClick={() => exportService.exportSingleSupplierStatementPdf(selectedSupplier)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer transition-all"
                  title="Resmi PDF / Yazıcı Çıktısı Al"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Yazdır / PDF</span>
                </button>

                {/* 📊 EXCEL BUTONU */}
                <button
                  type="button"
                  onClick={() => exportService.exportSingleSupplierStatementExcel(selectedSupplier)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                  title="Excel (.xlsx) Tablosu Olarak İndir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>

                <div className="text-right pl-3 border-l border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Toptancıya Kalan Borcumuz</div>
                  <div className={`text-base font-black ${selectedSupplier.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(selectedSupplier.balance)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">İşlem Türü</th>
                    <th className="py-2.5 px-3">Belge / Çek No</th>
                    <th className="py-2.5 px-3">Açıklama & Vade</th>
                    <th className="py-2.5 px-3">Ödeme Kanalı</th>
                    <th className="py-2.5 px-3 text-right">Tutar</th>
                    <th className="py-2.5 px-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!selectedSupplier.transactions || selectedSupplier.transactions.length === 0) ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">Bu toptancıya ait mal alışı veya ödeme hareketi bulunmuyor.</td></tr>
                  ) : (
                    selectedSupplier.transactions.map(t => {
                      const isPurchase = t.type === 'PURCHASE';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDate(t.date)}</td>
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {isPurchase ? (
                              <span className="text-rose-600 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Mal Alışı (Borç)</span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" /> Ödeme Yapıldı</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{t.documentNumber || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <div>{t.description || '-'}</div>
                            {t.dueDate && <div className="text-[10px] text-amber-700 font-bold">Vade: {formatDate(t.dueDate)}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {t.paymentMethod === 'CHECK' ? '📑 Çek ile Ödendi' : t.paymentMethod === 'CREDIT_CARD' ? '💳 Kredi Kartı' : t.paymentMethod === 'BANK' ? '🏦 Banka / Havale' : t.paymentMethod === 'CASH' ? '💵 Nakit Kasa' : '-'}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${isPurchase ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isPurchase ? '+' : '-'}{formatCurrency(t.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setStxToDeleteId(t.id)}
                              className="p-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg border border-slate-200 cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => setSelectedSupplier(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* SİLME MODALLARI */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Toptancıyı Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <strong>"{supplierToDelete.name}"</strong> toptancısını ve tüm kayıtlarını silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setSupplierToDelete(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeleteSupplier} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {stxToDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Hareketi Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Bu alış veya ödeme hareketini dökümden silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setStxToDeleteId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeleteStx} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* ANLIK GİDER DÜZENLEME & SİLME */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative z-50 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Gider / Harcama Düzenle</h3>
            <p className="text-xs text-slate-500 mb-4">Gider kaydı detaylarını güncelleyin</p>

            <form onSubmit={handleSaveExpenseEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Harcama / Malzeme Adı *</label>
                <input type="text" required value={expTitle} onChange={e => setExpTitle(e.target.value)} placeholder="Örn: Gider / Malzeme Adı" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white font-medium select-text cursor-text" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tutar (TL) *</label>
                  <input type="number" step="0.01" required value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-sm font-black text-rose-600 bg-white select-text cursor-text" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tarih *</label>
                  <input type="date" required value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-semibold bg-white cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-bold bg-white cursor-pointer">
                  {EXPENSE_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ödeme Kanalı</label>
                  <select value={expMethod} onChange={e => setExpMethod(e.target.value as any)} className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs font-bold bg-white cursor-pointer">
                    <option value="CASH">💵 Nakit Kasa</option>
                    <option value="CREDIT_CARD">💳 Kredi / Banka Kartı</option>
                    <option value="BANK">🏦 Banka / Havale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tedarikçi / Alınan Yer</label>
                  <input type="text" value={expSupplier} onChange={e => setExpSupplier(e.target.value)} placeholder="Örn: Firma / Tedarikçi" className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white select-text cursor-text" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama / Fiş No</label>
                <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="İşlem açıklaması..." className="w-full px-3 py-2 border-2 border-slate-200 focus:border-amber-600 rounded-xl text-xs bg-white select-text cursor-text" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingExpense(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-600/20 cursor-pointer">Değişikliği Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Gideri Sil</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              <strong>"{expenseToDelete.title}"</strong> ({formatCurrency(expenseToDelete.amount)}) gider kaydını silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setExpenseToDelete(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeleteExpense} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};