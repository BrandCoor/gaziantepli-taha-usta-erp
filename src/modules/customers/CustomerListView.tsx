import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Upload, 
  Edit2, 
  Trash2, 
  Phone, 
  Receipt, 
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  X
} from 'lucide-react';
import { Customer, CustomerTransaction, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';
import ExcelJS from 'exceljs';

interface CustomerListViewProps {
  customers: Customer[];
  onRefresh: () => void;
  onOpenTxModal?: (customerId: string, type: 'DEBT' | 'COLLECTION') => void;
}

type SortField = 'name' | 'phone' | 'balance';
type SortOrder = 'asc' | 'desc';

export const CustomerListView: React.FC<CustomerListViewProps> = ({ customers, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DEBTORS' | 'ZERO'>('ALL');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modallar
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [txModalCustomer, setTxModalCustomer] = useState<Customer | null>(null);
  const [txType, setTxType] = useState<'DEBT' | 'COLLECTION'>('COLLECTION');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txDesc, setTxDesc] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<string>('Nakit');
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Form inputları
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // Sıralama Değiştirici
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtrelenmiş ve Sıralanmış Müşteriler
  const processedCustomers = useMemo(() => {
    let result = customers.filter(c => {
      const matchSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery)) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;
      if (filterType === 'DEBTORS') return (c.balance || 0) > 0;
      if (filterType === 'ZERO') return (c.balance || 0) <= 0;
      return true;
    });

    result.sort((a, b) => {
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

    return result;
  }, [customers, searchQuery, filterType, sortField, sortOrder]);

  const totalReceivable = useMemo(() => {
    return customers.reduce((sum, c) => sum + ((c.balance || 0) > 0 ? (c.balance || 0) : 0), 0);
  }, [customers]);

  const debtorCount = useMemo(() => {
    return customers.filter(c => (c.balance || 0) > 0).length;
  }, [customers]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setIsNewCustomerModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setIsNewCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      notify.error('Eksik Bilgi', 'Lütfen müşteri / firma adını giriniz.');
      return;
    }

    if (editingCustomer) {
      dataService.updateCustomer(editingCustomer.id, {
        name: formName,
        phone: formPhone,
        email: formEmail,
        address: formAddress
      });
      notify.success('Müşteri Güncellendi', `${formName} bilgileri başarıyla güncellendi.`);
    } else {
      dataService.addCustomer({
        name: formName,
        phone: formPhone,
        email: formEmail,
        address: formAddress
      });
      notify.success('Müşteri Eklendi', `${formName} cari listesine başarıyla eklendi.`);
    }

    setIsNewCustomerModalOpen(false);
    onRefresh();
  };

  const handleDeleteCustomer = (c: Customer) => {
    notify.confirm({
      title: 'Müşteri Kartını Sil',
      message: `"${c.name}" adlı müşteriyi ve bağlı tüm cari kayıtlarını silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        dataService.deleteCustomer(c.id);
        notify.success('Müşteri Silindi', `${c.name} cari sistemden kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txModalCustomer) return;
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify.error('Geçersiz Tutar', 'Lütfen geçerli bir tutar giriniz.');
      return;
    }

    dataService.addTransaction({
      customerId: txModalCustomer.id,
      type: txType,
      amount: amountNum,
      paymentMethod: txPaymentMethod,
      description: txDesc || (txType === 'DEBT' ? 'Veresiye Borç Kaydı' : 'Tahsilat Alındı')
    });

    notify.success(
      txType === 'DEBT' ? 'Borç Eklendi' : 'Tahsilat Kaydedildi',
      `${txModalCustomer.name} hesabına ${formatMoney(amountNum)} işlem yapıldı.`
    );

    setTxModalCustomer(null);
    setTxAmount('');
    setTxDesc('');
    onRefresh();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];

      let addedCount = 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = row.getCell(1).text?.trim();
        const phone = row.getCell(2).text?.trim();
        const address = row.getCell(3).text?.trim();
        const balance = parseFloat(row.getCell(4).text) || 0;

        if (name) {
          const newCust = dataService.addCustomer({ name, phone, address });
          if (balance > 0) {
            dataService.addTransaction({
              customerId: newCust.id,
              type: 'DEBT',
              amount: balance,
              paymentMethod: 'Cari',
              description: 'Menufay İçe Aktarım Bakiyesi'
            });
          }
          addedCount++;
        }
      });

      notify.success('Excel İçe Aktarıldı', `${addedCount} adet müşteri ve bakiye sisteme başarıyla yüklendi.`);
      onRefresh();
    } catch (err: any) {
      notify.error('Excel Yükleme Hatası', 'Dosya okunurken bir hata oluştu: ' + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const customerTransactions: CustomerTransaction[] = useMemo(() => {
    if (!statementCustomer) return [];
    return dataService.getCustomerTransactions(statementCustomer.id);
  }, [statementCustomer]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls" className="hidden" />

      {/* ÜST BAŞLIK & İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg shadow-[#F5C877]/10">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#FAF7F2] tracking-tight flex items-center gap-2.5">
                <span>Müşteriler & Cari Hesaplar</span>
                <span className="px-2.5 py-0.5 bg-[#F5C877]/15 text-[#F5C877] border border-[#F5C877]/30 rounded-full text-[10px] font-black uppercase">CARİ ERP</span>
              </h1>
              <p className="text-xs text-[#8E8E98] font-medium mt-0.5">Sütun başlıklarına tıklayarak A-Z veya Bakiyeye göre sıralayabilirsiniz.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#2C2C34]/60">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'ALL' ? 'bg-[#F5C877] text-[#141416] font-black' : 'bg-[#141416] text-[#8E8E98] hover:text-white border border-[#2C2C34]'
              }`}
            >
              Tümü ({customers.length})
            </button>
            <button
              onClick={() => setFilterType('DEBTORS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'DEBTORS' ? 'bg-rose-500 text-white font-black shadow-md' : 'bg-[#141416] text-rose-400 hover:text-white border border-[#2C2C34]'
              }`}
            >
              Borçlular ({debtorCount})
            </button>
            <button
              onClick={() => setFilterType('ZERO')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'ZERO' ? 'bg-emerald-500 text-white font-black shadow-md' : 'bg-[#141416] text-[#8E8E98] hover:text-white border border-[#2C2C34]'
              }`}
            >
              Bakiyesi Sıfır
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1C1C20] to-[#141416] rounded-3xl p-6 border border-[#F5C877]/30 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#F5C877]">Toplam Cari Alacak</span>
            <div className="w-8 h-8 rounded-xl bg-[#F5C877]/10 flex items-center justify-center text-[#F5C877]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#FAF7F2] font-mono mt-2">
            {formatMoney(totalReceivable)}
          </div>
          <div className="text-[11px] text-[#8E8E98] mt-1 font-medium">
            Toplam <strong className="text-rose-400 font-bold">{debtorCount} müşteride</strong> açık veresiye bakiye mevcut.
          </div>
        </div>
      </div>

      {/* ARAMA VE BUTONLAR */}
      <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Müşteri adı, telefon veya adres ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-[#282830] hover:bg-[#32323D] border border-[#383844] text-[#FAF7F2] font-bold text-xs rounded-2xl flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4 text-[#F5C877]" />
            <span>Excel'den Yükle (Menufay)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:from-[#F5C877] hover:to-[#C6923B] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer transition-transform transform active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#141416]" />
            <span>Yeni Müşteri Ekle</span>
          </button>
        </div>
      </div>

      {/* DİNAMİK SIRALANABİLİR MÜŞTERİ TABLOSU */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                
                {/* Müşteri Adı Sıralama */}
                <th 
                  onClick={() => toggleSort('name')}
                  className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <span>MÜŞTERİ / ŞİRKET ADI</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                {/* Telefon Sıralama */}
                <th 
                  onClick={() => toggleSort('phone')}
                  className="py-4 px-6 cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <span>TELEFON</span>
                    {sortField === 'phone' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-6">ADRES & AÇIKLAMA NOTLARI</th>

                {/* Bakiye Sıralama */}
                <th 
                  onClick={() => toggleSort('balance')}
                  className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-2">
                    <span>KALAN BORÇ BAKİYESİ</span>
                    {sortField === 'balance' ? (
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
              {processedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[#8E8E98]">
                    Kayıtlı müşteri bulunamadı.
                  </td>
                </tr>
              ) : (
                processedCustomers.map((c) => {
                  const hasDebt = (c.balance || 0) > 0;
                  return (
                    <tr key={c.id} className="hover:bg-[#222228]/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#282830] border border-[#383844] flex items-center justify-center font-black text-[#F5C877] text-xs">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-white text-xs">{c.name}</div>
                            {c.email && <div className="text-[10px] text-[#8E8E98]">{c.email}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 font-mono text-[#FAF7F2]">
                          <Phone className="w-3.5 h-3.5 text-[#F5C877]" />
                          <span>{c.phone || '-'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 max-w-xs truncate text-[#8E8E98]">
                        {c.address || '-'}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <span className={`font-mono font-black text-sm ${
                          hasDebt ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {formatMoney(c.balance || 0)}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setTxModalCustomer(c); setTxType('DEBT'); }}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            + Borç
                          </button>

                          <button
                            onClick={() => { setTxModalCustomer(c); setTxType('COLLECTION'); }}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            + Tahsilat
                          </button>

                          <button
                            onClick={() => setStatementCustomer(c)}
                            className="px-2.5 py-1 bg-[#F5C877]/10 hover:bg-[#F5C877]/20 text-[#F5C877] border border-[#F5C877]/30 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
                          >
                            Ekstre
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] border border-[#2C2C34] rounded-lg cursor-pointer transition-colors ml-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded-lg cursor-pointer transition-colors"
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

      {/* EKSTRE MODALI */}
      {statementCustomer && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{statementCustomer.name} - Hesap Ekstresi</h3>
                  <p className="text-xs text-[#8E8E98]">Güncel Borç: <strong className="text-rose-400">{formatMoney(statementCustomer.balance || 0)}</strong></p>
                </div>
              </div>
              <button onClick={() => setStatementCustomer(null)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {customerTransactions.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#8E8E98] bg-[#121214] rounded-2xl">
                  Bu müşteriye ait henüz hareket bulunmuyor.
                </div>
              ) : (
                customerTransactions.map((tx) => (
                  <div key={tx.id} className="p-3.5 bg-[#121214] border border-[#2C2C34] rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                          tx.type === 'DEBT' 
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {tx.type === 'DEBT' ? 'Veresiye Borç' : 'Tahsilat Alındı'}
                        </span>
                        <span className="text-[11px] text-[#8E8E98] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#F5C877]" />
                          {tx.date ? new Date(tx.date).toLocaleDateString('tr-TR') : 'Bugün'}
                        </span>
                      </div>
                      <div className="text-[#FAF7F2] font-medium">{tx.description || '-'}</div>
                      <div className="text-[10px] text-[#8E8E98]">Ödeme: {tx.paymentMethod}</div>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black text-sm ${
                        tx.type === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {tx.type === 'DEBT' ? '+' : '-'}{formatMoney(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end">
              <button
                onClick={() => setStatementCustomer(null)}
                className="px-5 py-2.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] rounded-xl font-bold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ MÜŞTERİ MODALI */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <h3 className="text-base font-black text-white">{editingCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}</h3>
              <button onClick={() => setIsNewCustomerModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Müşteri / Şirket Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Demir"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Telefon</label>
                  <input
                    type="text"
                    placeholder="05XX XXX XX XX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">E-posta</label>
                  <input
                    type="email"
                    placeholder="info@firma.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Adres</label>
                <textarea
                  rows={3}
                  placeholder="Adres bilgisi..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none resize-none"
                />
              </div>
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsNewCustomerModalOpen(false)} className="px-5 py-2.5 bg-[#282830] text-[#FAF7F2] rounded-xl font-bold">Vazgeç</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black rounded-xl shadow-lg">{editingCustomer ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BORÇ / TAHSİLAT MODALI */}
      {txModalCustomer && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <h3 className="text-base font-black text-white">{txType === 'DEBT' ? 'Veresiye Borç Ekle' : 'Cari Tahsilat Al'}</h3>
              <button onClick={() => setTxModalCustomer(null)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Tutar (TL) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full p-3.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xl font-mono font-black text-[#F5C877] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              {txType === 'COLLECTION' && (
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Ödeme Kanalı</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                  >
                    <option value="Nakit">Nakit</option>
                    <option value="Banka Havalesi / EFT">Banka Havalesi / EFT</option>
                    <option value="Kredi Kartı / POS">Kredi Kartı / POS</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Açıklama</label>
                <input
                  type="text"
                  placeholder="İşlem açıklaması..."
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2.5">
                <button type="button" onClick={() => setTxModalCustomer(null)} className="px-5 py-2.5 bg-[#282830] text-[#FAF7F2] rounded-xl font-bold">Vazgeç</button>
                <button type="submit" className={`px-6 py-2.5 font-black text-xs rounded-xl shadow-lg ${txType === 'DEBT' ? 'bg-rose-600 text-white' : 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416]'}`}>
                  {txType === 'DEBT' ? 'Borcu Kaydet' : 'Tahsilatı Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};