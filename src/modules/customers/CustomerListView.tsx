import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2, 
  Phone, 
  MapPin, 
  TrendingUp, 
  X,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Banknote,
  DollarSign,
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Wallet,
  History,
  AlertCircle
} from 'lucide-react';
import { Customer, CustomerTransaction, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';
import { exportService } from '../../services/exportService';

interface CustomerListViewProps {
  customers?: Customer[];
  onRefresh?: () => void;
  onOpenTxModal?: (customerId?: string, type?: 'DEBT' | 'COLLECTION') => void;
}

type SortField = 'name' | 'phone' | 'balance' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type BalanceFilter = 'ALL' | 'DEBTORS' | 'CREDITORS' | 'ZERO';

export const CustomerListView: React.FC<CustomerListViewProps> = ({ 
  customers: externalCustomers, 
  onRefresh: externalOnRefresh 
}) => {
  // Canlı Müşteri ve Hareket Listesi (Kendi state'i ile bağımsız çalışır, asla çökmez)
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);

  // Görünüm Modu: 'LIST' (Müşteri Rehberi) veya 'STATEMENT' (Cari Hesap Ekstresi)
  const [viewMode, setViewMode] = useState<'LIST' | 'STATEMENT'>('LIST');
  const [activeCustomerForStatement, setActiveCustomerForStatement] = useState<Customer | null>(null);

  // Arama & Filtreleme
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Müşteri Ekle / Düzenle Modalı
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState('');

  // Harici Cari Hareket Modalı (Borçlandır / Tahsilat Al)
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [selectedCustomerIdForTx, setSelectedCustomerIdForTx] = useState<string>('');
  const [txType, setTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('CASH');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState<string>('');

  // Ekstre Hareketi Düzenleme Modalı
  const [editingTx, setEditingTx] = useState<CustomerTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState<string>('');
  const [editTxType, setEditTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [editTxPaymentMethod, setEditTxPaymentMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('CASH');
  const [editTxDate, setEditTxDate] = useState<string>('');
  const [editTxDescription, setEditTxDescription] = useState<string>('');

  // Verileri Senkronize Et
  const loadData = () => {
    try {
      const custs = dataService.getCustomers() || [];
      const txs = dataService.getCustomerTransactions() || [];
      setInternalCustomers(custs);
      setTransactions(txs);

      // Eğer açık olan ekstre müşterisi varsa güncel halini al
      if (activeCustomerForStatement) {
        const fresh = custs.find(c => c.id === activeCustomerForStatement.id);
        if (fresh) {
          setActiveCustomerForStatement(fresh);
        }
      }
    } catch (err) {
      console.error('Müşteri verileri yüklenirken hata:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Harici props değiştiğinde de senkronize ol
  useEffect(() => {
    if (externalCustomers && Array.isArray(externalCustomers)) {
      setInternalCustomers(externalCustomers);
    }
  }, [externalCustomers]);

  const activeCustomersList = useMemo(() => {
    if (internalCustomers && internalCustomers.length > 0) return internalCustomers;
    if (externalCustomers && externalCustomers.length > 0) return externalCustomers;
    return [];
  }, [internalCustomers, externalCustomers]);

  // Sıralama Değiştir
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filtrelenmiş ve Sıralanmış Müşteriler
  const processedCustomers = useMemo(() => {
    let list = (activeCustomersList || []).filter(c => {
      if (!c) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (c.name || '').toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const balance = Number(c.balance) || 0;
      if (balanceFilter === 'DEBTORS') return balance > 0.01;
      if (balanceFilter === 'CREDITORS') return balance < -0.01;
      if (balanceFilter === 'ZERO') return Math.abs(balance) <= 0.01;

      return true;
    });

    list.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'balance') {
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
  }, [activeCustomersList, searchQuery, balanceFilter, sortField, sortOrder]);

  // İstatistikler
  const totalReceivables = useMemo(() => 
    (activeCustomersList || []).reduce((s, c) => s + Math.max(0, Number(c?.balance) || 0), 0), 
    [activeCustomersList]
  );

  const totalDebtorCount = useMemo(() => 
    (activeCustomersList || []).filter(c => (Number(c?.balance) || 0) > 0.01).length, 
    [activeCustomersList]
  );

  const totalCollectionsAllTime = useMemo(() => 
    (transactions || []).filter(t => t.type === 'COLLECTION').reduce((s, t) => s + (Number(t.amount) || 0), 0), 
    [transactions]
  );

  const formatMoney = (val: any) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Müşteri Ekle / Düzenle Modalını Aç
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormInitialBalance('');
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name || '');
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormInitialBalance('');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return notify.error('Eksik Bilgi', 'Müşteri adı giriniz.');

    if (editingCustomer) {
      dataService.updateCustomer(editingCustomer.id, {
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
      });
      notify.success('Müşteri Güncellendi', `${formName} bilgileri güncellendi.`);
    } else {
      const initialBal = parseFloat(formInitialBalance);
      const newCust = dataService.addCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
        balance: 0,
      });

      // Eğer açılış borç bakiyesi girildiyse hemen harici hareket oluştur
      if (!isNaN(initialBal) && initialBal > 0) {
        dataService.addCustomerTransaction(newCust.id, {
          type: 'DEBT',
          amount: initialBal,
          paymentMethod: 'CASH',
          date: new Date().toISOString().split('T')[0],
          description: 'Açılış Devir Borç Bakiyesi',
        });
      }

      notify.success('Müşteri Eklendi', `${formName} cari rehbere kaydedildi.`);
    }

    setIsCustomerModalOpen(false);
    loadData();
    if (externalOnRefresh) externalOnRefresh();
  };

  // Müşteri Silme
  const handleDeleteCustomer = (c: Customer) => {
    if (Math.abs(Number(c.balance) || 0) > 0.01) {
      return notify.error(
        'Müşteri Silinemez!',
        `Bu müşterinin ${formatMoney(c.balance)} cari borcu bulunmaktadır.\nBorç tahsil edilmeden cari kart silinemez!`
      );
    }

    notify.confirm({
      title: 'Müşteriyi Sil',
      message: `"${c.name}" müşterisini silmek istediğinize emin misiniz? Cari hareketleri de silinecektir.`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        const res = dataService.deleteCustomer(c.id);
        if (res.success) {
          notify.success('Müşteri Silindi', `${c.name} rehberden silindi.`);
          if (activeCustomerForStatement?.id === c.id) {
            setViewMode('LIST');
            setActiveCustomerForStatement(null);
          }
          loadData();
          if (externalOnRefresh) externalOnRefresh();
        } else {
          notify.error('Hata', res.message || 'Silinemedi.');
        }
      }
    });
  };

  // HARİCİ BORÇ VEYA TAHSİLAT MODALINI AÇ
  const openTransactionModal = (customerId?: string, defaultType: 'DEBT' | 'COLLECTION' = 'DEBT') => {
    const targetId = customerId || (activeCustomersList[0]?.id || '');
    setSelectedCustomerIdForTx(targetId);
    setTxType(defaultType);
    setTxAmount('');
    setTxPaymentMethod('CASH');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxDescription(defaultType === 'DEBT' ? 'Harici Borçlandırma' : 'Elden Tahsilat Alındı');
    setTxModalOpen(true);
  };

  // CARİ HAREKETİ KAYDET (BORÇLANDIR / TAHSİLAT AL)
  const handleSaveTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerIdForTx) return notify.error('Eksik Alan', 'Lütfen müşteri seçin!');
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Geçersiz Tutar', 'Geçerli bir tutar girin!');

    const targetCust = activeCustomersList.find(c => c.id === selectedCustomerIdForTx);

    dataService.addCustomerTransaction(selectedCustomerIdForTx, {
      type: txType,
      amount: amountNum,
      paymentMethod: txPaymentMethod,
      date: txDate,
      description: txDescription.trim() || (txType === 'DEBT' ? 'Harici Borç Kaydı' : 'Tahsilat'),
    });

    notify.success(
      txType === 'DEBT' ? 'Borç İşlendi' : 'Tahsilat Alındı',
      `[${targetCust?.name || 'Müşteri'}] hesabına ${formatMoney(amountNum)} ${txType === 'DEBT' ? 'borç kaydedildi' : 'tahsilat işlendi'}.`
    );

    setTxModalOpen(false);
    loadData();
    if (externalOnRefresh) externalOnRefresh();
  };

  // CARİ EKSTREYE GİT
  const handleOpenStatement = (c: Customer) => {
    setActiveCustomerForStatement(c);
    setViewMode('STATEMENT');
  };

  // AKTİF MÜŞTERİNİN HAREKETLERİ
  const currentStatementTransactions = useMemo(() => {
    if (!activeCustomerForStatement) return [];
    return (transactions || [])
      .filter(t => t.customerId === activeCustomerForStatement.id)
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [activeCustomerForStatement, transactions]);

  // Ekstre Rakamları
  const statementStats = useMemo(() => {
    let totalDebt = 0;
    let totalCollection = 0;
    currentStatementTransactions.forEach(t => {
      if (t.type === 'DEBT') totalDebt += Number(t.amount) || 0;
      else if (t.type === 'COLLECTION') totalCollection += Number(t.amount) || 0;
    });
    return {
      totalDebt,
      totalCollection,
      balance: Number(activeCustomerForStatement?.balance) || (totalDebt - totalCollection)
    };
  }, [currentStatementTransactions, activeCustomerForStatement]);

  // Ekstre Hareketi Düzenle
  const handleOpenEditTx = (tx: CustomerTransaction) => {
    setEditingTx(tx);
    setEditTxAmount(String(tx.amount));
    setEditTxType(tx.type);
    setEditTxPaymentMethod(tx.paymentMethod || 'CASH');
    setEditTxDate(tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditTxDescription(tx.description || '');
  };

  const handleSaveEditTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = parseFloat(editTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Hata', 'Geçerli bir tutar giriniz!');

    dataService.updateCustomerTransaction(editingTx.id, {
      amount: amountNum,
      type: editTxType,
      paymentMethod: editTxPaymentMethod,
      date: editTxDate,
      description: editTxDescription.trim(),
    });

    notify.success('Ekstre Güncellendi', 'Cari hareket güncellendi ve bakiye otomatik eşitlendi.');
    setEditingTx(null);
    loadData();
    if (externalOnRefresh) externalOnRefresh();
  };

  // Ekstre Hareketi Sil
  const handleDeleteTx = (tx: CustomerTransaction) => {
    notify.confirm({
      title: 'Hareketi Sil',
      message: `${formatMoney(tx.amount)} tutarındaki cari kaydı silmek istediğinize emin misiniz? Müşteri bakiyesi otomatik güncellenecektir.`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteCustomerTransaction(tx.id);
        notify.success('Kayıt Silindi', 'Hareket kaydı silindi ve müşteri bakiyesi güncellendi.');
        loadData();
        if (externalOnRefresh) externalOnRefresh();
      }
    });
  };

  // PDF & Excel İhracatları
  const handleExportStatementPdf = () => {
    if (!activeCustomerForStatement) return;
    try {
      exportService.exportSingleCustomerStatementPdf({
        ...activeCustomerForStatement,
        transactions: currentStatementTransactions,
      });
    } catch (e: any) {
      notify.error('Yazdırma Hatası', e.message || 'PDF oluşturulamadı.');
    }
  };

  const handleExportStatementExcel = () => {
    if (!activeCustomerForStatement) return;
    try {
      exportService.exportSingleCustomerStatementExcel({
        ...activeCustomerForStatement,
        transactions: currentStatementTransactions,
      });
      notify.success('Excel İndirildi', `${activeCustomerForStatement.name} hesap ekstresi dışa aktarıldı.`);
    } catch (e: any) {
      notify.error('Excel Hatası', e.message || 'Excel dosyası oluşturulamadı.');
    }
  };

  const handleExportAllCustomersExcel = () => {
    try {
      exportService.exportCustomersExcel(processedCustomers, totalReceivables);
      notify.success('Excel İndirildi', 'Cari müşteri bakiye listesi dışa aktarıldı.');
    } catch (e: any) {
      notify.error('Excel Hatası', e.message || 'Excel oluşturulamadı.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ========================================================================= */}
      {/* 1. CARİ HESAP EKSTRESİ GÖRÜNÜMÜ                                           */}
      {/* ========================================================================= */}
      {viewMode === 'STATEMENT' && activeCustomerForStatement ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Üst Bar: Geri Dönüş ve İşlem Butonları */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-xl">
            <button
              onClick={() => {
                setViewMode('LIST');
                setActiveCustomerForStatement(null);
              }}
              className="px-4 py-2 bg-[#282830] hover:bg-[#32323D] text-white text-xs font-black rounded-2xl flex items-center gap-2 transition-all cursor-pointer w-fit"
            >
              <ArrowLeft className="w-4 h-4 text-[#F5C877]" />
              <span>← Cari Müşteri Listesine Dön</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openTransactionModal(activeCustomerForStatement.id, 'DEBT')}
                className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>+ Borç Ekle</span>
              </button>

              <button
                onClick={() => openTransactionModal(activeCustomerForStatement.id, 'COLLECTION')}
                className="px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>+ Tahsilat Al</span>
              </button>

              <button
                onClick={handleExportStatementPdf}
                className="px-3.5 py-2 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] font-black text-xs rounded-xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                title="Yazdır / PDF Olarak Kaydet"
              >
                <Printer className="w-4 h-4 text-[#F5C877]" />
                <span>Yazdır (PDF)</span>
              </button>

              <button
                onClick={handleExportStatementExcel}
                className="px-3.5 py-2 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] font-black text-xs rounded-xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                title="Excel Belgesi Olarak İndir"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Müşteri Kimlik ve Cari Bakiye Kartı */}
          <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F5C877] to-[#D4A351] text-[#141416] flex items-center justify-center font-black text-2xl shadow-lg shadow-[#F5C877]/10 flex-shrink-0">
                <FileText className="w-8 h-8 text-[#141416]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black text-white">{activeCustomerForStatement.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#282830] text-[#F5C877] border border-[#383844]">
                    CARİ HESAP EKSTRESİ
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#8E8E98]">
                  {activeCustomerForStatement.phone && (
                    <span className="flex items-center gap-1 font-mono text-[#F5C877]">
                      <Phone className="w-3.5 h-3.5" />
                      {activeCustomerForStatement.phone}
                    </span>
                  )}
                  {activeCustomerForStatement.address && (
                    <span className="flex items-center gap-1 text-[#AAAAB6]">
                      <MapPin className="w-3.5 h-3.5" />
                      {activeCustomerForStatement.address}
                    </span>
                  )}
                  {activeCustomerForStatement.notes && (
                    <span className="text-xs text-[#8E8E98] italic">
                      ({activeCustomerForStatement.notes})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bakiye Göstergesi */}
            <div className="flex items-center gap-4 bg-[#141416] px-6 py-4 rounded-2xl border border-[#2C2C34]">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[#8E8E98]">GÜNCEL CARİ BAKİYE</div>
                <div className={`text-2xl font-black font-mono mt-0.5 ${
                  statementStats.balance > 0.01 
                    ? 'text-rose-400' 
                    : statementStats.balance < -0.01 
                      ? 'text-blue-400' 
                      : 'text-emerald-400'
                }`}>
                  {formatMoney(statementStats.balance)}
                </div>
                <div className="text-[10px] font-bold mt-0.5">
                  {statementStats.balance > 0.01 && (
                    <span className="text-rose-400">⚠️ Müşterinin Borcu Var (Alacaklıyız)</span>
                  )}
                  {statementStats.balance < -0.01 && (
                    <span className="text-blue-400">ℹ️ Fazla Tahsilat / Avans Bakiye</span>
                  )}
                  {Math.abs(statementStats.balance) <= 0.01 && (
                    <span className="text-emerald-400">✓ Hesap Tamamen Kapalı (Bakiye 0)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ekstre İstatistik Mini Barları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toplam Borç Kaydı</div>
                <div className="text-lg font-black text-rose-400 font-mono mt-0.5">{formatMoney(statementStats.totalDebt)}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Toplam Yapılan Tahsilat</div>
                <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">{formatMoney(statementStats.totalCollection)}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-2xl p-4 border border-[#2C2C34] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-[#8E8E98]">Kayıtlı Hareket Sayısı</div>
                <div className="text-lg font-black text-[#FAF7F2] font-mono mt-0.5">{currentStatementTransactions.length} İşlem</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
                <History className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Ekstre Hareketleri Tablosu */}
          <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#2C2C34] flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#F5C877]" />
                <span>Hesap Hareketleri Dökümü (Tarih Sıralı)</span>
              </h3>
              <span className="text-xs text-[#8E8E98]">Tüm veresiye, masa aktarımları ve elden tahsilatlar</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">TARİH</th>
                    <th className="py-3.5 px-4">İŞLEM TÜRÜ</th>
                    <th className="py-3.5 px-6">AÇIKLAMA / BELGE NO</th>
                    <th className="py-3.5 px-4">ÖDEME KANALI</th>
                    <th className="py-3.5 px-4 text-right">BORÇ TUTARI (+)</th>
                    <th className="py-3.5 px-4 text-right">TAHSİLAT (-)</th>
                    <th className="py-3.5 px-4 text-center w-24">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
                  {currentStatementTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-[#8E8E98]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <History className="w-8 h-8 text-[#5A5A66]" />
                          <span>Bu müşteriye ait henüz cari hareket bulunmamaktadır.</span>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => openTransactionModal(activeCustomerForStatement.id, 'DEBT')}
                              className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                              + Borç Ekle
                            </button>
                            <button
                              onClick={() => openTransactionModal(activeCustomerForStatement.id, 'COLLECTION')}
                              className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                              + Tahsilat Yap
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentStatementTransactions.map((tx, idx) => {
                      const isDebt = tx.type === 'DEBT';

                      return (
                        <tr key={tx.id} className="hover:bg-[#222228]/60 transition-colors">
                          <td className="py-3.5 px-4 text-center font-mono text-[#7A7A88]">
                            {idx + 1}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[#FAF7F2]">
                            {tx.date ? new Date(tx.date).toLocaleDateString('tr-TR') : '—'}
                          </td>

                          <td className="py-3.5 px-4">
                            {isDebt ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <ArrowUpRight className="w-3 h-3" />
                                + Borç Eklendi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <ArrowDownRight className="w-3 h-3" />
                                - Tahsilat Alındı
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-6 text-[#FAF7F2] max-w-xs">
                            <span className="font-bold">{tx.description || 'Cari İşlem'}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#141416] text-[#C4C4CC] border border-[#2C2C34]">
                              {tx.paymentMethod === 'BANK' ? '🏦 Havale / Banka' : tx.paymentMethod === 'CREDIT_CARD' ? '💳 Kredi Kartı' : '💵 Nakit'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400">
                            {isDebt ? formatMoney(tx.amount) : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                            {!isDebt ? formatMoney(tx.amount) : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditTx(tx)}
                                className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                                title="Hareketi Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTx(tx)}
                                className="p-1.5 text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Hareketi Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. ANA MÜŞTERİ LİSTESİ VE REHBER GÖRÜNÜMÜ                                 */
        /* ========================================================================= */
        <div className="space-y-6">
          
          {/* ÜST İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#8E8E98]">Toplam Cari Alacağımız</div>
                <div className="text-2xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalReceivables)}</div>
                <div className="text-[10px] text-[#8E8E98] mt-0.5">Müşterilerden tahsil edilecek bakiye</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#8E8E98]">Kayıtlı Müşteri</div>
                <div className="text-2xl font-black text-white mt-1">{activeCustomersList.length} Cari</div>
                <div className="text-[10px] text-[#8E8E98] mt-0.5">Caller ID ve Rehber Portföyü</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#282830] text-[#F5C877] flex items-center justify-center font-black">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#8E8E98]">Borçlu Müşteriler</div>
                <div className="text-2xl font-black text-rose-400 mt-1">{totalDebtorCount} Müşteri</div>
                <div className="text-[10px] text-[#8E8E98] mt-0.5">Bakiyesi 0'dan büyük olanlar</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#8E8E98]">Toplam Tahsilat Hacmi</div>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{formatMoney(totalCollectionsAllTime)}</div>
                <div className="text-[10px] text-[#8E8E98] mt-0.5">Kayıtlı tahsilat toplamı</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* ARAMA, FİLTRE VE AKSİYON BARI */}
          <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Arama Kutusu */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Müşteri adı, telefon veya adres ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
              />
            </div>

            {/* Bakiye Filtre Butonları */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#141416] p-1 rounded-2xl border border-[#2C2C34]">
              <button
                onClick={() => setBalanceFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceFilter === 'ALL' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                Tümü ({activeCustomersList.length})
              </button>
              <button
                onClick={() => setBalanceFilter('DEBTORS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceFilter === 'DEBTORS' ? 'bg-rose-600 text-white' : 'text-[#8E8E98] hover:text-rose-400'
                }`}
              >
                Borçlular ({totalDebtorCount})
              </button>
              <button
                onClick={() => setBalanceFilter('ZERO')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  balanceFilter === 'ZERO' ? 'bg-emerald-600 text-white' : 'text-[#8E8E98] hover:text-emerald-400'
                }`}
              >
                Bakiyesi 0 Olanlar
              </button>
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportAllCustomersExcel}
                className="px-3.5 py-2.5 bg-[#282830] hover:bg-[#343440] text-emerald-400 font-bold text-xs rounded-2xl flex items-center gap-1.5 border border-[#3C3C48] cursor-pointer"
                title="Excel Olarak İndir"
              >
                <Download className="w-4 h-4" />
                <span>Excel</span>
              </button>

              <button
                onClick={() => openTransactionModal(undefined, 'DEBT')}
                className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>+ Harici Borç</span>
              </button>

              <button
                onClick={() => openTransactionModal(undefined, 'COLLECTION')}
                className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>+ Tahsilat Al</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#141416]" />
                <span>Yeni Müşteri Ekle</span>
              </button>
            </div>
          </div>

          {/* MÜŞTERİ LİSTESİ TABLOSU */}
          <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                    <th onClick={() => toggleSort('name')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                      <div className="flex items-center gap-2">
                        <span>MÜŞTERİ BİLGİSİ</span>
                        {sortField === 'name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-6">İLETİŞİM BİLGİLERİ</th>
                    <th className="py-4 px-6">ADRES & NOT</th>

                    <th onClick={() => toggleSort('balance')} className="py-4 px-6 text-right cursor-pointer hover:text-white select-none">
                      <div className="flex items-center justify-end gap-2">
                        <span>CARİ BAKİYE (BORÇ)</span>
                        {sortField === 'balance' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-4 text-center">HIZLI CARİ</th>
                    <th className="py-4 px-4 text-center">CARİ EKSTRE</th>
                    <th className="py-4 px-6 text-center">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
                  {processedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#8E8E98]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-[#5A5A66]" />
                          <span>Kriterlere uygun cari müşteri bulunamadı.</span>
                          <button
                            onClick={handleOpenAddModal}
                            className="mt-1 px-4 py-2 bg-[#F5C877] text-[#141416] rounded-xl text-xs font-black cursor-pointer"
                          >
                            + Yeni Müşteri Kaydet
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    processedCustomers.map((c) => {
                      const balanceNum = Number(c.balance) || 0;
                      const hasDebt = Math.abs(balanceNum) > 0.01;

                      return (
                        <tr key={c.id} className="hover:bg-[#222228]/60 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-black text-white text-sm">{c.name}</div>
                            <div className="text-[10px] text-[#7A7A88] font-mono mt-0.5">
                              ID: {c.id.substring(0, 12)}...
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            {c.phone ? (
                              <div className="font-mono text-[#F5C877] font-bold flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-[#8E8E98]" />
                                <span>{c.phone}</span>
                              </div>
                            ) : (
                              <span className="text-[#5A5A66]">—</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-[#8E8E98] max-w-xs">
                            <div className="truncate text-xs text-[#C4C4CC]">{c.address || '—'}</div>
                            {c.notes && (
                              <div className="truncate text-[10px] text-[#8E8E98] italic mt-0.5">{c.notes}</div>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right font-black font-mono text-base">
                            <span className={balanceNum > 0.01 ? 'text-rose-400' : balanceNum < -0.01 ? 'text-blue-400' : 'text-emerald-400'}>
                              {formatMoney(balanceNum)}
                            </span>
                          </td>

                          {/* SATIR BAZINDA HIZLI BORÇLANDIR / TAHSİLAT AL */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openTransactionModal(c.id, 'DEBT')}
                                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black cursor-pointer transition-colors"
                                title="Borç Ekle"
                              >
                                + Borç
                              </button>
                              <button
                                onClick={() => openTransactionModal(c.id, 'COLLECTION')}
                                className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black cursor-pointer transition-colors"
                                title="Tahsilat Al"
                              >
                                + Tahsilat
                              </button>
                            </div>
                          </td>

                          {/* EKSTRE DETAY BUTONU */}
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => handleOpenStatement(c)}
                              className="px-3 py-1.5 bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] hover:text-[#F5C877] border border-[#3C3C48] rounded-xl text-xs font-black flex items-center gap-1.5 mx-auto cursor-pointer transition-colors"
                              title="Hesap Ekstresi ve Hareket Detayları"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#F5C877]" />
                              <span>Ekstre</span>
                            </button>
                          </td>

                          {/* DÜZENLE VE SİL */}
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(c)}
                                className="p-2 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-xl transition-colors cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteCustomer(c)}
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                  hasDebt ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                                }`}
                                title={hasDebt ? 'Bakiyesi sıfır olmayan müşteri silinemez' : 'Müşteriyi Sil'}
                              >
                                {hasDebt ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MÜŞTERİ EKLE / DÜZENLE MODALI                                          */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">{editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Cari Müşteri Ekle'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Müşteri Adı Soyadı / Firma Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn: Mehmet Demir / Antep İnşaat A.Ş."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Telefon Numarası</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0532 000 00 00"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Teslimat / Fatura Adresi</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Mahalle, Cadde, Bina No, Daire..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Özel Notlar</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Örn: VIP müşteri, Caller ID notu vb."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Açılış Devir Borç Bakiyesi (Varsa ₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formInitialBalance}
                    onChange={(e) => setFormInitialBalance(e.target.value)}
                    placeholder="0.00 (Müşterinin eski borcu varsa)"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-rose-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HARİCİ CARİ HAREKET MODALI (BORÇLANDIRMA / TAHSİLAT ALMA)              */}
      {/* ========================================================================= */}
      {txModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">
                {txType === 'DEBT' ? 'Müşteri Borçlandırma (+Borç Ekle)' : 'Müşteriden Tahsilat Alma (-Borç Düş)'}
              </h3>
              <button onClick={() => setTxModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveTransactionSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Müşteri Seçiniz *</label>
                <select
                  required
                  value={selectedCustomerIdForTx}
                  onChange={(e) => setSelectedCustomerIdForTx(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  {(activeCustomersList || []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Bakiye: {formatMoney(c.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşlem Türü</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="DEBT">➕ Borçlandır (Borç Artar)</option>
                    <option value="COLLECTION">➖ Tahsilat Al (Borç Düşer)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Tutar (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="1500.00"
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödeme Şekli</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="CASH">💵 Nakit</option>
                    <option value="BANK">🏦 Banka / Havale</option>
                    <option value="CREDIT_CARD">💳 Kredi Kartı</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşlem Tarihi</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono text-[#FAF7F2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama / Fiş No</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Örn: Elden nakit teslim alındı, Masa 4 veresiye..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg cursor-pointer ${
                    txType === 'DEBT' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {txType === 'DEBT' ? 'Borcu Kaydet (+)' : 'Tahsilatı İşle (-)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EKSTRE HAREKETİ DÜZENLEME MODALI                                       */}
      {/* ========================================================================= */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">Ekstre Hareketini Düzenle</h3>
              <button onClick={() => setEditingTx(null)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveEditTx} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşlem Türü</label>
                  <select
                    value={editTxType}
                    onChange={(e) => setEditTxType(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="DEBT">➕ Borçlandırma (+)</option>
                    <option value="COLLECTION">➖ Tahsilat (-)</option>
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
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödeme Kanalı</label>
                  <select
                    value={editTxPaymentMethod}
                    onChange={(e) => setEditTxPaymentMethod(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="CASH">💵 Nakit</option>
                    <option value="BANK">🏦 Banka / Havale</option>
                    <option value="CREDIT_CARD">💳 Kredi Kartı</option>
                  </select>
                </div>

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
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama</label>
                <input
                  type="text"
                  value={editTxDescription}
                  onChange={(e) => setEditTxDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingTx(null)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-[#F5C877] text-[#141416] rounded-xl text-xs font-black shadow-lg cursor-pointer">Değişiklikleri Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
