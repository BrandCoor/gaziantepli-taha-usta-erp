import React, { useState, useMemo, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Plus, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2, 
  Calendar,
  Building2,
  TrendingDown,
  Tag,
  X,
  FileText,
  Banknote,
  CreditCard,
  ChevronRight,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Lock,
  ArrowLeft,
  Printer,
  Download
} from 'lucide-react';
import { 
  Expense, 
  Supplier, 
  SupplierTransaction, 
  dataService 
} from '../../services/dataService';
import { notify } from '../../services/notificationService';
import { exportService } from '../../services/exportService';
import { CariEkstre, EkstreHareketi } from '../../components/cari/CariEkstre';

export const EXPENSE_CATEGORIES = [
  'Kira Gideri',
  'Elektrik Faturası',
  'Doğalgaz Faturası',
  'Su Faturası',
  'Mutfak Sarf & Temizlik',
  'Personel Yemek & İhtiyaç',
  'Vergi & SGK Ödemeleri',
  'Bakım, Onarım & Tadilat',
  'İnternet & Telefon Faturası',
  'Muhasebe & Danışmanlık',
  'Reklam & Tanıtım',
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

type SortField = 'date' | 'title' | 'category' | 'amount';
type SortOrder = 'asc' | 'desc';

export const ExpenseListView: React.FC<ExpenseListViewProps> = () => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'suppliers'>('expenses');

  // Canlı Veriler
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);

  // Filtreler & Sıralama
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [supplierSearch, setSupplierSearch] = useState('');
  
  // REAKTİF TOPTANCI SEÇİMİ (ID BAZLI CANLI SENKRON)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // GİDER MODALLARI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'BANK'>('CASH');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');

  // TOPTANCI MODALLARI
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCategory, setSupCategory] = useState(SUPPLIER_CATEGORIES[0]);
  const [supAddress, setSupAddress] = useState('');

  // FATURA MODALI
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invSupplierId, setInvSupplierId] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invDesc, setInvDesc] = useState('');

  // ÖDEME MODALI
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDesc, setPayDesc] = useState('');

  // Ekstrede o an ekranda görünen (filtrelenmiş) hareketler — dışa aktarma bunu kullanır
  const [gorunenEkstreTx, setGorunenEkstreTx] = useState<SupplierTransaction[]>([]);

  // EKSTRE DÜZENLEME MODALI
  const [editTxModalOpen, setEditTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<SupplierTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxInvoiceNo, setEditTxInvoiceNo] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxMethod, setEditTxMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('BANK');
  const [editTxType, setEditTxType] = useState<'INVOICE' | 'PAYMENT'>('INVOICE');

  const refreshAll = () => {
    try {
      setExpenses(dataService.getExpenses() || []);
      setSuppliers(dataService.getSuppliers() || []);
      setSupplierTransactions(dataService.getSupplierTransactions() || []);
    } catch (e) {
      console.error('Veri çekme hatası:', e);
    }
  };

  useEffect(() => {
    refreshAll();
    const unsub = dataService.subscribe(refreshAll);
    return () => unsub();
  }, []);

  const activeSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return (suppliers || []).find(s => s && s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  const statementTransactions = useMemo(() => {
    if (!selectedSupplierId) return [];
    return (supplierTransactions || [])
      .filter(t => t && t.supplierId === selectedSupplierId)
      .sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime());
  }, [supplierTransactions, selectedSupplierId]);

  const tedarikciBakiye = useMemo(() => Number(activeSupplier?.balance) || 0, [activeSupplier]);

  /** Toptancı hareketlerini ortak ekstre bileşeninin anladığı biçime çevir.
   *  PAYMENT dışındaki her tür (INVOICE, PURCHASE) borç yazan harekettir. */
  const tedarikciEkstreHareketleri = useMemo<EkstreHareketi[]>(() =>
    statementTransactions.map(tx => {
      const odemeMi = tx.type === 'PAYMENT';
      return {
        id: tx.id,
        tarih: tx.date || tx.createdAt,
        yon: odemeMi ? 'ALACAK' : 'BORC',
        tutar: Number(tx.amount) || 0,
        tur: odemeMi ? 'Ödeme Yapıldı' : 'Alış Faturası',
        belgeNo: tx.invoiceNo || tx.documentNumber,
        aciklama: tx.description,
        odemeKanali: odemeMi ? tx.paymentMethod : undefined,
        kaynak: tx,
      };
    }),
    [statementTransactions]
  );

  const tedarikciOzet = useMemo(() => {
    let toplamFatura = 0;
    let toplamOdeme = 0;
    statementTransactions.forEach(tx => {
      if (tx.type === 'PAYMENT') toplamOdeme += Number(tx.amount) || 0;
      else toplamFatura += Number(tx.amount) || 0;
    });

    const son = statementTransactions[statementTransactions.length - 1];
    let sonHareket = '—';
    if (son) {
      const d = new Date(son.date || son.createdAt);
      if (!isNaN(d.getTime())) sonHareket = d.toLocaleDateString('tr-TR');
    }

    return { toplamFatura, toplamOdeme, sonHareket };
  }, [statementTransactions]);

  // Dışa aktarmada ekranda görünen hareketleri kullan (hiç filtre yoksa tamamı)
  const aktarilacakTedarikciHareketleri = useMemo(
    () => (gorunenEkstreTx.length > 0 ? gorunenEkstreTx : statementTransactions),
    [gorunenEkstreTx, statementTransactions]
  );

  const handleExportSupplierPdf = () => {
    if (!activeSupplier) return;
    try {
      exportService.exportSingleSupplierStatementPdf({
        ...activeSupplier,
        transactions: aktarilacakTedarikciHareketleri,
      });
    } catch (e: any) {
      notify.error('Yazdırma Hatası', e?.message || 'PDF oluşturulamadı.');
    }
  };

  const handleExportSupplierExcel = () => {
    if (!activeSupplier) return;
    try {
      exportService.exportSingleSupplierStatementExcel({
        ...activeSupplier,
        transactions: aktarilacakTedarikciHareketleri,
      });
      notify.success('Excel İndirildi', `${activeSupplier.name} cari ekstresi dışa aktarıldı.`);
    } catch (e: any) {
      notify.error('Excel Hatası', e?.message || 'Excel dosyası oluşturulamadı.');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedExpenses = useMemo(() => {
    let list = (expenses || []).filter(e => {
      if (!e) return false;
      const titleMatch = (e.title || '').toLowerCase().includes((searchQuery || '').toLowerCase());
      const catMatch = (e.category || '').toLowerCase().includes((searchQuery || '').toLowerCase());
      if (!titleMatch && !catMatch) return false;
      if (selectedCat !== 'ALL' && e.category !== selectedCat) return false;
      return true;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'amount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [expenses, searchQuery, selectedCat, sortField, sortOrder]);

  const filteredSuppliers = useMemo(() => {
    const q = (supplierSearch || '').toLowerCase();
    return (suppliers || []).filter(s => {
      if (!s) return false;
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const contactMatch = (s.contactPerson || '').toLowerCase().includes(q);
      const phoneMatch = (s.phone || '').includes(q);
      return nameMatch || contactMatch || phoneMatch;
    });
  }, [suppliers, supplierSearch]);

  const totalExpense = useMemo(() => (expenses || []).reduce((s, e) => s + (Number(e?.amount) || 0), 0), [expenses]);
  const totalSupplierDebt = useMemo(() => (suppliers || []).reduce((s, sup) => s + Math.max(0, Number(sup?.balance) || 0), 0), [suppliers]);

  const formatMoney = (val: any) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // 1. GİDER İŞLEMLERİ
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormAmount('');
    setFormPaymentMethod('CASH');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormTitle(exp.title || '');
    setFormCategory(exp.category || EXPENSE_CATEGORIES[0]);
    setFormAmount(String(exp.amount || ''));
    setFormPaymentMethod(exp.paymentMethod || 'CASH');
    setFormDate(exp.date || new Date().toISOString().split('T')[0]);
    setFormDescription(exp.description || '');
    setIsModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!formTitle.trim()) return notify.error('Eksik Bilgi', 'Gider başlığı giriniz.');
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Geçersiz Tutar', 'Geçerli bir tutar giriniz.');

    if (editingExpense) {
      dataService.updateExpense(editingExpense.id, {
        title: formTitle.trim(),
        category: formCategory,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
        date: formDate,
        description: formDescription.trim(),
      });
      notify.success('Gider Güncellendi', `${formTitle} kaydı güncellendi.`);
    } else {
      dataService.saveExpense({
        title: formTitle.trim(),
        category: formCategory,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
        date: formDate,
        description: formDescription.trim(),
      });
      notify.success('Gider Eklendi', `${formatMoney(amountNum)} harcama kaydedildi.`);
    }

    setIsModalOpen(false);
    refreshAll();
  };

  const handleDeleteExpense = (e: Expense) => {
    notify.confirm({
      title: 'Gider Kaydını Sil',
      message: `"${e.title}" tutarlı harcama kaydını silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteExpense(e.id);
        notify.success('Gider Silindi', 'Harcama kaydı kaldırıldı.');
        refreshAll();
      }
    });
  };

  // 2. TOPTANCI İŞLEMLERİ
  const openNewSupplierModal = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupCategory(SUPPLIER_CATEGORIES[0]);
    setSupAddress('');
    setSupplierModalOpen(true);
  };

  const openEditSupplierModal = (s: Supplier) => {
    setEditingSupplier(s);
    setSupName(s.name || '');
    setSupContact(s.contactPerson || '');
    setSupPhone(s.phone || '');
    setSupCategory(s.category || SUPPLIER_CATEGORIES[0]);
    setSupAddress(s.address || '');
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return notify.error('Eksik Alan', 'Toptancı adını giriniz.');

    if (editingSupplier) {
      dataService.updateSupplier(editingSupplier.id, {
        name: supName.trim(),
        contactPerson: supContact.trim(),
        phone: supPhone.trim(),
        category: supCategory,
        address: supAddress.trim(),
      });
      notify.success('Toptancı Güncellendi', `[${supName}] bilgileri kaydedildi.`);
    } else {
      dataService.addSupplier({
        name: supName.trim(),
        contactPerson: supContact.trim(),
        phone: supPhone.trim(),
        category: supCategory,
        address: supAddress.trim(),
        balance: 0,
      });
      notify.success('Toptancı Eklendi', `[${supName}] tedarikçi listesine eklendi.`);
    }

    setSupplierModalOpen(false);
    refreshAll();
  };

  const handleDeleteSupplier = (s: Supplier) => {
    const bal = Number(s?.balance) || 0;
    if (Math.abs(bal) > 0.01) {
      return notify.error(
        'Toptancı Silinemez!',
        `Bu toptancıya ${formatMoney(bal)} borç bakiyesi bulunmaktadır.\nBorç kapatılmadan toptancı kaydı silinemez!`
      );
    }

    notify.confirm({
      title: 'Toptancıyı Sil',
      message: `"${s.name}" toptancısını silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        const result = dataService.deleteSupplier(s.id);
        if (result.success) {
          notify.success('Toptancı Silindi', `${s.name} kaydı silindi.`);
          if (selectedSupplierId === s.id) {
            setSelectedSupplierId(null);
          }
          refreshAll();
        } else {
          notify.error('Hata', result.message || 'Silinemedi.');
        }
      }
    });
  };

  // 3. FATURA GİRİŞİ
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSupplierId) return notify.error('Eksik Alan', 'Lütfen toptancı seçiniz.');
    const amountNum = parseFloat(invAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir fatura tutarı giriniz.');

    const targetSup = (suppliers || []).find(s => s && s.id === invSupplierId);

    dataService.addSupplierTransaction(invSupplierId, {
      type: 'INVOICE',
      amount: amountNum,
      paymentMethod: 'CASH',
      date: invDate,
      invoiceNo: invNo.trim() || undefined,
      description: invDesc.trim() || 'Alış Faturası Girişi',
    });

    notify.success('Fatura İşlendi', `[${targetSup?.name || 'Toptancı'}] hesabına ${formatMoney(amountNum)} tutarında alış faturası kaydedildi.`);
    setInvoiceModalOpen(false);
    refreshAll();
  };

  // 4. ÖDEME ÇIKIŞI
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierId) return notify.error('Eksik Alan', 'Lütfen toptancı seçiniz.');
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir ödeme tutarı giriniz.');

    const targetSup = (suppliers || []).find(s => s && s.id === paySupplierId);

    dataService.addSupplierTransaction(paySupplierId, {
      type: 'PAYMENT',
      amount: amountNum,
      paymentMethod: payMethod,
      date: payDate,
      description: payDesc.trim() || 'Toptancıya Ödeme Çıkışı',
    });

    notify.success('Ödeme İşlendi', `[${targetSup?.name || 'Toptancı'}] hesabından ${formatMoney(amountNum)} ödeme düşüldü.`);
    setPaymentModalOpen(false);
    refreshAll();
  };

  // 5. EKSTRE DÜZENLEME & SİLME
  const openEditStatementTxModal = (tx: SupplierTransaction) => {
    setEditingTx(tx);
    setEditTxType(tx.type === 'INVOICE' ? 'INVOICE' : 'PAYMENT');
    setEditTxAmount(String(tx.amount || 0));
    setEditTxDate(tx.date || new Date().toISOString().split('T')[0]);
    setEditTxInvoiceNo(tx.invoiceNo || '');
    setEditTxDesc(tx.description || '');
    setEditTxMethod(tx.paymentMethod === 'CASH' ? 'CASH' : tx.paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'BANK');
    setEditTxModalOpen(true);
  };

  const handleSaveStatementTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = parseFloat(editTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir tutar giriniz.');

    dataService.updateSupplierTransaction(editingTx.id, {
      type: editTxType,
      amount: amountNum,
      date: editTxDate,
      invoiceNo: editTxType === 'INVOICE' ? (editTxInvoiceNo.trim() || undefined) : undefined,
      description: editTxDesc.trim() || undefined,
      paymentMethod: editTxType === 'PAYMENT' ? editTxMethod : 'CASH',
    });

    notify.success('Ekstre Güncellendi', 'İşlem güncellendi ve toptancı borç bakiyesi otomatik eşitlendi.');
    setEditTxModalOpen(false);
    refreshAll();
  };

  const handleDeleteStatementTx = (tx: SupplierTransaction) => {
    notify.confirm({
      title: 'Ekstre Kaydını Sil',
      message: `${tx.type === 'INVOICE' ? 'Fatura' : 'Ödeme'} kaydı silinecektir. Toptancının borç bakiyesi otomatik düzeltilecektir. Onaylıyor musunuz?`,
      type: 'danger',
      confirmText: 'Evet, Sil ve Bakiyeyi Düzelt',
      onConfirm: () => {
        dataService.deleteSupplierTransaction(tx.id);
        notify.success('Kayıt Silindi', 'Ekstre kaydı silindi ve cari bakiye güncellendi.');
        refreshAll();
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toplam İşletme Giderleri</div>
            <div className="text-3xl font-black text-rose-400 font-mono mt-1">{formatMoney(totalExpense)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Kira, faturalar, personel yemek ve sarf giderleri</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
            <TrendingDown className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toptancılara Toplam Borcumuz</div>
            <div className="text-3xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalSupplierDebt)}</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">{(suppliers || []).length} Kayıtlı Toptancı & Tedarikçi</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <Building2 className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* BÜYÜTÜLMÜŞ SEKME SEÇİCİ BARI */}
      <div className="bg-[#1C1C20] p-2 rounded-3xl border-2 border-[#2C2C34] shadow-2xl flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 min-w-[220px] py-3.5 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] shadow-xl shadow-[#F5C877]/25 ring-2 ring-[#F5C877]/40 scale-[1.01]'
              : 'text-[#8E8E98] hover:text-[#FAF7F2] hover:bg-[#282830]'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span>İşletme Giderleri</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'expenses' ? 'bg-[#141416]/20 text-[#141416]' : 'bg-[#121214] text-[#8E8E98]'}`}>
            {(expenses || []).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 min-w-[220px] py-3.5 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] shadow-xl shadow-[#F5C877]/25 ring-2 ring-[#F5C877]/40 scale-[1.01]'
              : 'text-[#8E8E98] hover:text-[#FAF7F2] hover:bg-[#282830]'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span>Toptancılar & Cariler</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'suppliers' ? 'bg-[#141416]/20 text-[#141416]' : 'bg-[#121214] text-[#8E8E98]'}`}>
            {(suppliers || []).length}
          </span>
        </button>

      </div>

      {/* ========================================================================= */}
      {/* 1. İŞLETME GİDERLERİ SEKMESİ */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Gider açıklaması veya kategori ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="py-2.5 px-3.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
              >
                <option value="ALL">Tüm Kategoriler</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#141416]" />
              <span>Yeni Gider Ekle</span>
            </button>
          </div>

          <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                    <th onClick={() => toggleSort('date')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                      <div className="flex items-center gap-2">
                        <span>TARİH</span>
                        {sortField === 'date' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th onClick={() => toggleSort('title')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                      <div className="flex items-center gap-2">
                        <span>GİDER AÇIKLAMASI</span>
                        {sortField === 'title' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th onClick={() => toggleSort('category')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                      <div className="flex items-center gap-2">
                        <span>KATEGORİ</span>
                        {sortField === 'category' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-6">ÖDEME KANALI</th>

                    <th onClick={() => toggleSort('amount')} className="py-4 px-6 text-right cursor-pointer hover:text-white select-none">
                      <div className="flex items-center justify-end gap-2">
                        <span>TUTAR (TL)</span>
                        {sortField === 'amount' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-6 text-center">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C34]/60">
                  {processedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#8E8E98]">
                        Kayıtlı gider bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    processedExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#222228]/60 transition-colors">
                        <td className="py-4 px-6 text-[#8E8E98] font-mono">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#F5C877]" />
                            <span>{exp.date ? new Date(exp.date).toLocaleDateString('tr-TR') : 'Bugün'}</span>
                          </div>
                        </td>

                        <td className="py-4 px-6 font-bold text-white">
                          {exp.title}
                        </td>

                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 bg-[#282830] border border-[#383844] text-[#F5C877] rounded-lg font-bold text-[11px]">
                            {exp.category || 'Genel Gider'}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 bg-[#18181C] border border-[#2C2C34] text-slate-300 rounded-lg text-[11px] font-bold">
                            {(exp.paymentMethod as string) === 'CASH' || (exp.paymentMethod as string) === 'Nakit' ? '💵 Nakit' : exp.paymentMethod === 'BANK' ? '🏦 Banka / Havale' : '💳 Kredi Kartı'}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right font-black font-mono text-rose-400 text-sm">
                          {formatMoney(exp.amount)}
                        </td>

                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(exp)}
                              className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOPTANCILAR & CARİLER SEKMESİ */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && !activeSupplier && (
        <div className="space-y-6">
          <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Toptancı adı, yetkili veya telefon ara..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setInvSupplierId(suppliers[0]?.id || '');
                  setInvAmount('');
                  setInvNo('');
                  setInvDesc('');
                  setInvoiceModalOpen(true);
                }}
                className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
              >
                <FileText className="w-4 h-4" />
                <span>+ Fatura Girişi (Borçlan)</span>
              </button>

              <button
                onClick={() => {
                  setPaySupplierId(suppliers[0]?.id || '');
                  setPayAmount('');
                  setPayDesc('');
                  setPaymentModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Banknote className="w-4 h-4" />
                <span>+ Ödeme Yap (Borç Düş)</span>
              </button>

              <button
                onClick={openNewSupplierModal}
                className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#141416]" />
                <span>Yeni Toptancı Ekle</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSuppliers.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-xs text-[#8E8E98] bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
                Kayıtlı toptancı bulunamadı.
              </div>
            ) : (
              filteredSuppliers.map((s) => {
                const bal = Number(s?.balance) || 0;
                const hasDebt = Math.abs(bal) > 0.01;

                return (
                  <div key={s.id} className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 bg-[#282830] border border-[#383844] text-[#F5C877] rounded-lg text-[10px] font-black uppercase">
                          {s.category || 'Genel'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditSupplierModal(s)} className="p-1.5 text-[#8E8E98] hover:text-white rounded-lg cursor-pointer">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteSupplier(s)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasDebt ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={hasDebt ? 'Bakiye olduğu için silinemez' : 'Sil'}
                          >
                            {hasDebt ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <h3 className="font-black text-base text-white">{s.name || 'Toptancı'}</h3>
                      <div className="text-xs text-[#8E8E98] font-medium mt-1">Yetkili: {s.contactPerson || 'Girilmedi'}</div>
                      <div className="text-xs text-[#F5C877] font-mono mt-0.5">{s.phone || 'Telefon yok'}</div>

                      <div className="mt-4 p-3.5 bg-[#121214] rounded-2xl border border-[#2C2C34] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#8E8E98]">Mevcut Borcumuz</span>
                          <div className={`font-mono font-black text-base ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatMoney(bal)}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setGorunenEkstreTx([]);
                            setSelectedSupplierId(s.id);
                          }}
                          className="px-3.5 py-2 bg-[#282830] hover:bg-[#343440] text-sky-400 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Detay &amp; Ekstre</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TOPTANCI DETAY KARTI + FİLTRELENEBİLİR EKSTRE                          */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && activeSupplier && (
        <div className="space-y-5 animate-fadeIn">
          {/* --- ÜST BAR: GERİ DÖN + İŞLEMLER --- */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-xl">
            <button
              onClick={() => setSelectedSupplierId(null)}
              className="px-4 py-2.5 bg-[#282830] hover:bg-[#32323D] text-white text-xs font-black rounded-2xl flex items-center gap-2 transition-all cursor-pointer w-fit"
            >
              <ArrowLeft className="w-4 h-4 text-[#F5C877]" />
              <span>Toptancı Listesine Dön</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setInvSupplierId(activeSupplier.id);
                  setInvAmount('');
                  setInvNo('');
                  setInvDesc('');
                  setInvDate(new Date().toISOString().split('T')[0]);
                  setInvoiceModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Fatura Ekle</span>
              </button>

              <button
                onClick={() => {
                  setPaySupplierId(activeSupplier.id);
                  setPayAmount('');
                  setPayDesc('');
                  setPayDate(new Date().toISOString().split('T')[0]);
                  setPaymentModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>Ödeme Yap</span>
              </button>

              <button
                onClick={() => openEditSupplierModal(activeSupplier)}
                className="px-3.5 py-2.5 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] font-black text-xs rounded-xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                title="Toptancı bilgilerini düzenle"
              >
                <Edit2 className="w-4 h-4 text-[#F5C877]" />
                <span>Kartı Düzenle</span>
              </button>
            </div>
          </div>

          {/* --- KİMLİK KARTI + GÜNCEL BORÇ --- */}
          <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5C877] to-[#D4A351] text-[#141416] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#F5C877]/10">
                <Building2 className="w-7 h-7" />
              </div>

              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-white">{activeSupplier.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#282830] text-[#F5C877] border border-[#383844]">
                    {activeSupplier.category || 'Genel'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8E8E98]">Yetkili:</span>
                    <span className="font-bold text-[#FAF7F2]">{activeSupplier.contactPerson || 'Girilmedi'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#8E8E98]">Telefon:</span>
                    <span className="font-mono font-bold text-[#F5C877]">{activeSupplier.phone || 'Girilmedi'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#8E8E98] flex-shrink-0" />
                    <span className="text-[#8E8E98]">Kayıt:</span>
                    <span className="font-bold text-[#FAF7F2]">
                      {activeSupplier.createdAt ? new Date(activeSupplier.createdAt).toLocaleDateString('tr-TR') : '—'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 sm:col-span-2">
                    <span className="text-[#8E8E98]">Adres:</span>
                    <span className="font-bold text-[#FAF7F2]">{activeSupplier.address || 'Girilmedi'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Güncel Borç */}
            <div className="bg-[#141416] px-5 py-4 rounded-2xl border border-[#2C2C34] flex flex-col justify-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8E8E98]">KALAN NET BORCUMUZ</div>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  tedarikciBakiye > 0.01 ? 'text-rose-400' : tedarikciBakiye < -0.01 ? 'text-sky-400' : 'text-emerald-400'
                }`}
              >
                {formatMoney(tedarikciBakiye)}
              </div>
              <div className="text-[11px] font-bold mt-1">
                {tedarikciBakiye > 0.01 && <span className="text-rose-400">Bu toptancıya borcumuz var</span>}
                {tedarikciBakiye < -0.01 && <span className="text-sky-400">Fazla ödeme / avans verilmiş</span>}
                {Math.abs(tedarikciBakiye) <= 0.01 && <span className="text-emerald-400">Hesap kapalı (bakiye sıfır)</span>}
              </div>
            </div>
          </div>

          {/* --- TÜM ZAMAN ÖZETİ --- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toplam Fatura</div>
                <div className="text-lg font-black text-rose-400 font-mono mt-0.5">{formatMoney(tedarikciOzet.toplamFatura)}</div>
                <div className="text-[10px] text-[#7A7A88] mt-0.5">Tüm zamanlar</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toplam Ödeme</div>
                <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">{formatMoney(tedarikciOzet.toplamOdeme)}</div>
                <div className="text-[10px] text-[#7A7A88] mt-0.5">Tüm zamanlar</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Hareket Sayısı</div>
                <div className="text-lg font-black text-[#FAF7F2] font-mono mt-0.5">{statementTransactions.length}</div>
                <div className="text-[10px] text-[#7A7A88] mt-0.5">Fatura + ödeme kaydı</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Son Hareket</div>
                <div className="text-lg font-black text-[#FAF7F2] font-mono mt-0.5">{tedarikciOzet.sonHareket}</div>
                <div className="text-[10px] text-[#7A7A88] mt-0.5">En güncel işlem tarihi</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#282830] text-[#F5C877] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* --- FİLTRELENEBİLİR EKSTRE --- */}
          <CariEkstre
            hareketler={tedarikciEkstreHareketleri}
            borcBasligi="FATURA (+)"
            alacakBasligi="ÖDEME (−)"
            guncelBakiye={tedarikciBakiye}
            belgeBasligi="FATURA NO"
            baslik="Toptancı Cari Hesap Ekstresi"
            bosMesaj="Bu toptancıya ait henüz fatura veya ödeme hareketi bulunmuyor."
            onDuzenle={(h) => openEditStatementTxModal(h.kaynak as SupplierTransaction)}
            onSil={(h) => handleDeleteStatementTx(h.kaynak as SupplierTransaction)}
            onGorunenDegisti={(gorunen) => setGorunenEkstreTx(gorunen.map(h => h.kaynak as SupplierTransaction))}
            ustEylemler={
              <>
                <span className="text-[10px] font-bold text-[#7A7A88] mr-1">Ekranda görünen hareketleri aktar:</span>
                <button
                  onClick={handleExportSupplierPdf}
                  className="px-3 py-2 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] font-black text-[11px] rounded-xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                  title="Filtrelenmiş ekstreyi yazdır / PDF kaydet"
                >
                  <Printer className="w-3.5 h-3.5 text-[#F5C877]" />
                  <span>Yazdır (PDF)</span>
                </button>
                <button
                  onClick={handleExportSupplierExcel}
                  className="px-3 py-2 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] font-black text-[11px] rounded-xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                  title="Filtrelenmiş ekstreyi Excel olarak indir"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Excel</span>
                </button>
              </>
            }
          />
        </div>
      )}

      {/* GİDER EKLEME / DÜZENLEME MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">{editingExpense ? 'Gideri Düzenle' : 'Yeni İşletme Gideri Ekle'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Gider Başlığı / Açıklama</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Örn: Elektrik Faturası Ödemesi"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Harcama Tutarı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="1250.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-rose-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödeme Şekli</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:outline-none"
                  >
                    <option value="CASH">Nakit Kasa</option>
                    <option value="BANK">Banka / Havale</option>
                    <option value="CREDIT_CARD">Kredi Kartı</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Tarih</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOPTANCI MODALI */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">{editingSupplier ? 'Toptancıyı Düzenle' : 'Yeni Toptancı / Tedarikçi Ekle'}</h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Toptancı / Firma Adı</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Örn: Antep Kasaplar Dünyası"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Yetkili Kişi</label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="Örn: Mustafa Usta"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Telefon Numarası</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="0532..."
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Faaliyet Alanı</label>
                <select
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  {SUPPLIER_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Adres Bilgisi</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Gaziantep Toptancılar Hali..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setSupplierModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALIŞ FATURASI GİRİŞİ MODALI */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">Alış Faturası Girişi (Borçlanma)</h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Toptancı / Tedarikçi Seçiniz</label>
                <select
                  required
                  value={invSupplierId}
                  onChange={(e) => setInvSupplierId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  <option value="">Seçiniz...</option>
                  {(suppliers || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Mevcut Borç: {formatMoney(s.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Fatura Tutarı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    placeholder="4500.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-rose-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Fatura / İrsaliye No</label>
                  <input
                    type="text"
                    value={invNo}
                    onChange={(e) => setInvNo(e.target.value)}
                    placeholder="GZT-2026-001"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Fatura Tarihi</label>
                <input
                  type="date"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama (Alınan Ürünler)</label>
                <input
                  type="text"
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                  placeholder="50 kg Kuzu Boşluk, 30 kg Kuşbaşı..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setInvoiceModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg">Faturayı İşle (+Borç)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÖDEME YAPMA MODALI */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">Toptancıya Ödeme Çıkışı</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Toptancı Seçiniz</label>
                <select
                  required
                  value={paySupplierId}
                  onChange={(e) => setPaySupplierId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  <option value="">Seçiniz...</option>
                  {(suppliers || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Borç: {formatMoney(s.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödenen Tutar (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="3000.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödeme Kanalı</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="BANK">Banka / Havale</option>
                    <option value="CASH">Nakit Kasa</option>
                    <option value="CREDIT_CARD">Kredi Kartı</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Ödeme Tarihi</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama / Dekont Notu</label>
                <input
                  type="text"
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  placeholder="Kısmi ödeme, havale dekontu..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg">Ödemeyi Düş (-Borç)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EKSTRE HAREKETİ DÜZENLEME MODALI */}
      {editTxModalOpen && editingTx && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div>
                <h3 className="text-base font-black text-white">Ekstre Hareketini Düzenle</h3>
                <p className="text-[10px] text-[#F5C877] font-bold">Toptancı: {activeSupplier?.name}</p>
              </div>
              <button onClick={() => setEditTxModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveStatementTxSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşlem Türü</label>
                  <select
                    value={editTxType}
                    onChange={(e) => setEditTxType(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="INVOICE">📄 Alış Faturası (+Borç)</option>
                    <option value="PAYMENT">💳 Ödeme Çıkışı (-Borç)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Tutar (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editTxAmount}
                    onChange={(e) => setEditTxAmount(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Tarih</label>
                  <input
                    type="date"
                    required
                    value={editTxDate}
                    onChange={(e) => setEditTxDate(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2]"
                  />
                </div>

                {editTxType === 'INVOICE' ? (
                  <div>
                    <label className="text-xs font-bold text-[#8E8E98]">Fatura / İrsaliye No</label>
                    <input
                      type="text"
                      value={editTxInvoiceNo}
                      onChange={(e) => setEditTxInvoiceNo(e.target.value)}
                      placeholder="GZT-2026-..."
                      className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-slate-300"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-[#8E8E98]">Ödeme Kanalı</label>
                    <select
                      value={editTxMethod}
                      onChange={(e) => setEditTxMethod(e.target.value as any)}
                      className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                    >
                      <option value="BANK">Banka / Havale</option>
                      <option value="CASH">Nakit Kasa</option>
                      <option value="CREDIT_CARD">Kredi Kartı</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama</label>
                <input
                  type="text"
                  value={editTxDesc}
                  onChange={(e) => setEditTxDesc(e.target.value)}
                  placeholder="İşlem açıklaması..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setEditTxModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
