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
  Banknote,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Customer, CustomerTransaction, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface CustomerListViewProps {
  customers?: Customer[];
  onRefresh?: () => void;
  onOpenTxModal?: (customerId?: string, type?: 'DEBT' | 'COLLECTION') => void;
}

type SortField = 'name' | 'phone' | 'balance' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export const CustomerListView: React.FC<CustomerListViewProps> = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // MÜŞTERİ EKLEME / DÜZENLEME MODALI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // HARİCİ BORÇLANDIRMA / TAHSİLAT MODALI
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txCustomerId, setTxCustomerId] = useState('');
  const [txType, setTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [txAmount, setTxAmount] = useState('');
  const [txMethod, setTxMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('CASH');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDesc, setTxDesc] = useState('');

  const refreshAll = () => {
    setCustomers(dataService.getCustomers() || []);
    setTransactions(dataService.getCustomerTransactions() || []);
  };

  useEffect(() => {
    refreshAll();
    const unsub = dataService.subscribe(refreshAll);
    return () => unsub();
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedCustomers = useMemo(() => {
    let list = (customers || []).filter(c => {
      if (!c) return false;
      const q = searchQuery.toLowerCase();
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').includes(q);
      const matchAddress = (c.address || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchAddress;
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
  }, [customers, searchQuery, sortField, sortOrder]);

  const totalReceivables = useMemo(() => (customers || []).reduce((s, c) => s + Math.max(0, Number(c?.balance) || 0), 0), [customers]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  // 1. MÜŞTERİ EKLE / DÜZENLE
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name || '');
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setIsModalOpen(true);
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
      dataService.addCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
        balance: 0,
      });
      notify.success('Müşteri Eklendi', `${formName} cari rehbere eklendi.`);
    }

    setIsModalOpen(false);
    refreshAll();
  };

  const handleDeleteCustomer = (c: Customer) => {
    const bal = Number(c?.balance) || 0;
    if (Math.abs(bal) > 0.01) {
      return notify.error(
        'Müşteri Silinemez!',
        `Bu müşterinin ${formatMoney(bal)} cari borcu bulunmaktadır.\nBorç tahsil edilmeden müşteri silinemez!`
      );
    }

    notify.confirm({
      title: 'Müşteriyi Sil',
      message: `"${c.name}" müşterisini silmek istediğinize emin misiniz?`,
      type: 'danger',
      confirmText: 'Evet, Sil',
      onConfirm: () => {
        const res = dataService.deleteCustomer(c.id);
        if (res.success) {
          notify.success('Müşteri Silindi', `${c.name} rehberden silindi.`);
          refreshAll();
        } else {
          notify.error('Hata', res.message || 'Silinemedi.');
        }
      }
    });
  };

  // 2. HARİCİ BORÇLANDIRMA VE TAHSİLAT AÇMA
  const openExternalTxModal = (customer?: Customer, type: 'DEBT' | 'COLLECTION' = 'DEBT') => {
    setTxCustomerId(customer ? customer.id : (customers[0]?.id || ''));
    setTxType(type);
    setTxAmount('');
    setTxMethod('CASH');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxDesc(type === 'DEBT' ? 'Harici Borçlandırma (Veresiye)' : 'Cari Borç Tahsilatı');
    setTxModalOpen(true);
  };

  const handleSaveExternalTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txCustomerId) return notify.error('Eksik Alan', 'Lütfen müşteri seçiniz.');
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Hatalı Tutar', 'Geçerli bir tutar giriniz.');

    const targetCustomer = customers.find(c => c.id === txCustomerId);

    dataService.addCustomerTransaction(txCustomerId, {
      type: txType,
      amount: amountNum,
      paymentMethod: txMethod,
      date: txDate,
      description: txDesc.trim() || (txType === 'DEBT' ? 'Harici Borç Girişi' : 'Cari Tahsilat'),
    });

    if (txType === 'DEBT') {
      notify.success('Borç İşlendi', `[${targetCustomer?.name}] hesabına +${formatMoney(amountNum)} borç eklendi.`);
    } else {
      notify.success('Tahsilat Alındı', `[${targetCustomer?.name}] hesabından -${formatMoney(amountNum)} tahsilat düşüldü.`);
    }

    setTxModalOpen(false);
    refreshAll();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toplam Cari Alacağımız (Müşteri Borçları)</div>
            <div className="text-3xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalReceivables)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Müşterilerden tahsil edilecek veresiye toplamı</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Kayıtlı Cari Müşteri Sayısı</div>
            <div className="text-3xl font-black text-white mt-1">{customers.length} Müşteri</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">Caller ID ve Veresiye Rehberi</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <Users className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ARAMA VE HARİCİ İŞLEM BUTONLARI */}
      <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <div className="flex flex-wrap items-center gap-2">
          {/* HARİCİ BORÇLANDIRMA BUTONU */}
          <button
            onClick={() => openExternalTxModal(undefined, 'DEBT')}
            className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Harici Borç Yaz</span>
          </button>

          {/* HARİCİ TAHSİLAT BUTONU */}
          <button
            onClick={() => openExternalTxModal(undefined, 'COLLECTION')}
            className="px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>+ Tahsilat Al</span>
          </button>

          {/* YENİ MÜŞTERİ BUTONU */}
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-1.5 cursor-pointer"
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
                    <span>MÜŞTERİ ADI SOYADI</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                <th className="py-4 px-6">TELEFON</th>
                <th className="py-4 px-6">ADRES</th>

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

                <th className="py-4 px-6 text-center">HIZLI İŞLEM & KONTROL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
              {processedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[#8E8E98]">
                    Kayıtlı müşteri bulunamadı.
                  </td>
                </tr>
              ) : (
                processedCustomers.map((c) => {
                  const hasDebt = Math.abs(Number(c.balance) || 0) > 0.01;

                  return (
                    <tr key={c.id} className="hover:bg-[#222228]/60 transition-colors">
                      <td className="py-4 px-6 font-black text-white">
                        {c.name}
                      </td>

                      <td className="py-4 px-6 font-mono text-[#F5C877]">
                        {c.phone || '—'}
                      </td>

                      <td className="py-4 px-6 text-[#8E8E98] truncate max-w-[220px]">
                        {c.address || '—'}
                      </td>

                      <td className="py-4 px-6 text-right font-black font-mono text-sm">
                        <span className={c.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatMoney(c.balance)}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* HIZLI BORÇLANDIRMA */}
                          <button
                            onClick={() => openExternalTxModal(c, 'DEBT')}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-black cursor-pointer"
                            title="Bu Müşteriye Borç Yaz"
                          >
                            + Borç
                          </button>

                          {/* HIZLI TAHSİLAT */}
                          <button
                            onClick={() => openExternalTxModal(c, 'COLLECTION')}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-black cursor-pointer"
                            title="Bu Müşteriden Tahsilat Al"
                          >
                            ✓ Tahsilat
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasDebt ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={hasDebt ? 'Borcu olduğu için silinemez' : 'Sil'}
                          >
                            {hasDebt ? <Lock className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* MÜŞTERİ EKLE / DÜZENLE MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white">{editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Cari Müşteri Ekle'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Müşteri Adı Soyadı / Firma Adı</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn: Mehmet Demir"
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Telefon Numarası</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0532..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold text-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Teslimat / Fatura Adresi</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Cadde, Mahalle, Daire..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                  rows={2}
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl text-xs font-black shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HARİCİ BORÇLANDIRMA / TAHSİLAT MODALI */}
      {txModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                {txType === 'DEBT' ? <ArrowUpRight className="w-5 h-5 text-rose-400" /> : <ArrowDownRight className="w-5 h-5 text-emerald-400" />}
                <span>{txType === 'DEBT' ? 'Müşteriye Harici Borç Yaz' : 'Müşteriden Cari Tahsilat Al'}</span>
              </h3>
              <button onClick={() => setTxModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveExternalTx} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Müşteri Seçiniz</label>
                <select
                  required
                  value={txCustomerId}
                  onChange={(e) => setTxCustomerId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Bakiye: {formatMoney(c.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">İşlem Tutarı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="750.00"
                    className={`w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-mono font-bold focus:outline-none ${txType === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'}`}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8E8E98]">Ödeme / İşlem Kanalı</label>
                  <select
                    value={txMethod}
                    onChange={(e) => setTxMethod(e.target.value as any)}
                    className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                  >
                    <option value="CASH">💵 Nakit</option>
                    <option value="BANK">🏦 Banka / Havale</option>
                    <option value="CREDIT_CARD">💳 Kredi Kartı</option>
                  </select>
                </div>
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

              <div>
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama / Dekont Notu</label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Eski veresiye hesabı, havale..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-lg ${
                    txType === 'DEBT' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {txType === 'DEBT' ? 'Borcu Kaydet (+Borç)' : 'Tahsilatı İşle (-Borç)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
