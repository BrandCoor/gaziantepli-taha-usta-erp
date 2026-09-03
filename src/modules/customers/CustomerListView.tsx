import React, { useState, useMemo } from 'react';
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
  DollarSign
} from 'lucide-react';
import { Customer, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface CustomerListViewProps {
  customers: Customer[];
  onRefresh: () => void;
  onOpenTxModal?: (customerId?: string, type?: 'DEBT' | 'COLLECTION') => void;
}

type SortField = 'name' | 'phone' | 'balance' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export const CustomerListView: React.FC<CustomerListViewProps> = ({ customers, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Müşteri Ekle / Düzenle Modalı
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // HARİCİ CARİ HAREKET MODALI (BORÇLANDIR / TAHSİLAT AL)
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [selectedCustomerIdForTx, setSelectedCustomerIdForTx] = useState<string>('');
  const [txType, setTxType] = useState<'DEBT' | 'COLLECTION'>('DEBT');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<'CASH' | 'BANK' | 'CREDIT_CARD'>('CASH');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState<string>('');

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
      const matchSearch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.phone && c.phone.includes(searchQuery)) ||
                          (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
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

  const formatMoney = (val: any) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

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
    setFormName(c.name);
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
    onRefresh();
  };

  // HARİCİ BORÇ VEYA TAHSİLAT MODALINI AÇ
  const openTransactionModal = (customerId?: string, defaultType: 'DEBT' | 'COLLECTION' = 'DEBT') => {
    setSelectedCustomerIdForTx(customerId || customers[0]?.id || '');
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

    const targetCust = customers.find(c => c.id === selectedCustomerIdForTx);

    dataService.addCustomerTransaction(selectedCustomerIdForTx, {
      type: txType,
      amount: amountNum,
      paymentMethod: txPaymentMethod,
      date: txDate,
      description: txDescription.trim() || (txType === 'DEBT' ? 'Harici Borç Kaydı' : 'Tahsilat'),
    });

    notify.success(
      txType === 'DEBT' ? 'Borç İşlendi' : 'Tahsilat Alındı',
      `[${targetCust?.name}] hesabına ${formatMoney(amountNum)} ${txType === 'DEBT' ? 'borç eklendi' : 'tahsilat işlendi'}.`
    );

    setTxModalOpen(false);
    onRefresh();
  };

  const handleDeleteCustomer = (c: Customer) => {
    if (Math.abs(Number(c.balance) || 0) > 0.01) {
      return notify.error(
        'Müşteri Silinemez!',
        `Bu müşterinin ${formatMoney(c.balance)} cari borcu bulunmaktadır.\nBorç tahsil edilmeden müşteri silinemez!`
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
          onRefresh();
        } else {
          notify.error('Hata', res.message || 'Silinemedi.');
        }
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toplam Cari Alacağımız</div>
            <div className="text-3xl font-black text-[#F5C877] font-mono mt-1">{formatMoney(totalReceivables)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Müşterilerden tahsil edilecek veresiye tutarı</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Kayıtlı Müşteri Sayısı</div>
            <div className="text-3xl font-black text-white mt-1">{customers.length} Müşteri</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">Caller ID ve Cari Rehber</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <Users className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ARAMA VE BUTON BARI */}
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
          {/* HARİCİ BORÇ EKLEME BUTONU */}
          <button
            onClick={() => openTransactionModal(undefined, 'DEBT')}
            className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Harici Borç Ekle</span>
          </button>

          {/* HARİCİ TAHSİLAT ALMA BUTONU */}
          <button
            onClick={() => openTransactionModal(undefined, 'COLLECTION')}
            className="px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>+ Tahsilat Al</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
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

                <th className="py-4 px-6 text-center">HIZLI CARİ</th>
                <th className="py-4 px-6 text-center">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C34]/60 font-medium">
              {processedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#8E8E98]">
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

                      {/* SATIR BAZINDA HIZLI BORÇLANDIR / TAHSİLAT AL */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openTransactionModal(c.id, 'DEBT')}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-black cursor-pointer"
                            title="Borç Ekle"
                          >
                            + Borç
                          </button>
                          <button
                            onClick={() => openTransactionModal(c.id, 'COLLECTION')}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black cursor-pointer"
                            title="Tahsilat Al"
                          >
                            + Tahsilat
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-[#8E8E98] hover:text-[#F5C877] hover:bg-[#282830] rounded-lg transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasDebt ? 'text-[#8E8E98] hover:text-amber-400 hover:bg-amber-500/10' : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={hasDebt ? 'Borcu olduğu için silinemez' : 'Sil'}
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

      {/* HARİCİ CARİ HAREKET MODALI (BORÇLANDIRMA / TAHSİLAT ALMA) */}
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
                <label className="text-xs font-bold text-[#8E8E98]">Müşteri Seçiniz</label>
                <select
                  required
                  value={selectedCustomerIdForTx}
                  onChange={(e) => setSelectedCustomerIdForTx(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs font-bold text-[#FAF7F2]"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Bakiye: {formatMoney(c.balance)})</option>
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
                  <label className="text-xs font-bold text-[#8E8E98]">Tutar (₺)</label>
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
                <label className="text-xs font-bold text-[#8E8E98]">Açıklama</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Örn: Hizmet bedeli, elden ödeme..."
                  className="w-full mt-1 p-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button type="button" onClick={() => setTxModalOpen(false)} className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold">Vazgeç</button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg ${
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

    </div>
  );
};
