import React, { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { Expense, dataService } from '../../services/dataService';
import { notify } from '../../services/notificationService';

interface ExpenseListViewProps {
  expenses: Expense[];
  suppliers: any[];
  onRefresh: () => void;
  onOpenAddExpenseModal?: () => void;
}

type SortField = 'date' | 'title' | 'category' | 'amount';
type SortOrder = 'asc' | 'desc';

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({ expenses, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modallar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Hammadde & Et Alımı');
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Nakit');
  const [formSupplier, setFormSupplier] = useState('');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedExpenses = useMemo(() => {
    let list = expenses.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
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

  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [expenses]);

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormCategory('Hammadde & Et Alımı');
    setFormAmount('');
    setFormPaymentMethod('Nakit');
    setFormSupplier('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: Expense) => {
    setEditingExpense(e);
    setFormTitle(e.title);
    setFormCategory(e.category || 'Hammadde & Et Alımı');
    setFormAmount(String(e.amount || 0));
    setFormPaymentMethod(e.paymentMethod || 'Nakit');
    setFormSupplier((e as any).supplierName || '');
    setIsModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!formTitle.trim()) return notify.error('Eksik Bilgi', 'Gider başlığı giriniz.');
    if (isNaN(amountNum) || amountNum <= 0) return notify.error('Geçersiz Tutar', 'Geçerli bir tutar giriniz.');

    if (editingExpense) {
      dataService.updateExpense(editingExpense.id, {
        title: formTitle,
        category: formCategory,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
      });
      notify.success('Gider Güncellendi', `${formTitle} kaydı güncellendi.`);
    } else {
      dataService.addExpense({
        title: formTitle,
        category: formCategory,
        amount: amountNum,
        paymentMethod: formPaymentMethod,
      });
      notify.success('Gider Eklendi', `${formTitle} harcaması kaydedildi.`);
    }

    setIsModalOpen(false);
    onRefresh();
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
        onRefresh();
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Toplam Giderler & Harcamalar</div>
            <div className="text-3xl font-black text-rose-400 font-mono mt-1">{formatMoney(totalExpense)}</div>
            <div className="text-[11px] text-[#8E8E98] mt-0.5">Et, un, sebze ve işletme faturaları</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-black">
            <TrendingDown className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#8E8E98]">Kayıtlı Gider Sayısı</div>
            <div className="text-3xl font-black text-white mt-1">{expenses.length} Fiş / Fatura</div>
            <div className="text-[11px] text-[#F5C877] mt-0.5">Toptancı ve cari alımlar</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 text-[#F5C877] flex items-center justify-center font-black">
            <Receipt className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ARAMA VE BUTON BARI */}
      <div className="bg-[#1C1C20] p-4 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Gider adı, toptancı veya kategori ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#121214] border border-[#2C2C34] rounded-2xl text-xs text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-2xl shadow-lg shadow-[#F5C877]/15 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#141416]" />
            <span>Yeni Gider / Fatura Ekle</span>
          </button>
        </div>
      </div>

      {/* DİNAMİK SIRALANABİLİR GİDER TABLOSU (KOYU ERP) */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181C] border-b border-[#2C2C34] text-[#8E8E98] font-black uppercase text-[10px] tracking-wider">
                
                {/* Tarih Sıralama */}
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

                {/* Açıklama / Toptancı Sıralama */}
                <th onClick={() => toggleSort('title')} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <span>GİDER AÇIKLAMASI / TOPTANCI</span>
                    {sortField === 'title' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F5C877]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F5C877]" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#5A5A66]" />
                    )}
                  </div>
                </th>

                {/* Kategori Sıralama */}
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

                {/* Tutar Sıralama */}
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

                    <td className="py-4 px-6 text-[#8E8E98]">
                      {exp.paymentMethod || 'Nakit'}
                    </td>

                    <td className="py-4 px-6 text-right font-mono font-black text-sm text-rose-400">
                      -{formatMoney(exp.amount || 0)}
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1.5 bg-[#282830] hover:bg-[#32323D] text-[#FAF7F2] border border-[#2C2C34] rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded-lg cursor-pointer"
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

      {/* YENİ GİDER MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3.5">
              <h3 className="text-base font-black text-white">{editingExpense ? 'Gider Düzenle' : 'Yeni Harcama / Toptancı Fişi'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Gider Başlığı / Açıklama *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 50 Kg Dana Kıyma & Kuzu Boşluk Alımı"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] placeholder-[#7A7A88] focus:border-[#F5C877] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                  >
                    <option value="Hammadde & Et Alımı">Hammadde & Et Alımı</option>
                    <option value="Un & Ekmekçilik">Un & Ekmekçilik</option>
                    <option value="Sebze & Manav">Sebze & Manav</option>
                    <option value="İçecek & Meşrubat">İçecek & Meşrubat</option>
                    <option value="Dükkan Kirası & Fatura">Dükkan Kirası & Fatura</option>
                    <option value="Kömür & Odun Yakıt">Kömür & Odun Yakıt</option>
                    <option value="Genel Gider">Genel Gider</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#FAF7F2] font-bold block mb-1.5">Tutar (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none font-mono font-black"
                  />
                </div>
              </div>
              <div>
                <label className="text-[#FAF7F2] font-bold block mb-1.5">Ödeme Kanalı</label>
                <select
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="w-full p-3 bg-[#121214] border border-[#2C2C34] rounded-2xl text-[#FAF7F2] focus:border-[#F5C877] focus:outline-none"
                >
                  <option value="Nakit (Kasa)">Nakit (Kasa)</option>
                  <option value="Banka Havalesi / EFT">Banka Havalesi / EFT</option>
                  <option value="Şirket Kredi Kartı">Şirket Kredi Kartı</option>
                  <option value="Veresiye (Toptancı Borcu)">Veresiye (Toptancı Borcu)</option>
                </select>
              </div>
              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-[#282830] text-[#FAF7F2] rounded-xl font-bold">Vazgeç</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black rounded-xl shadow-lg">{editingExpense ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};