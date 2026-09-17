import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  Flame, 
  CheckCircle2 
} from 'lucide-react';
import { CategoryConfig, PrinterConfig, ProductConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface CategoriesTabProps {
  categories: CategoryConfig[];
  printers: PrinterConfig[];
  products: ProductConfig[];
  onRefresh: () => void;
}

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', 
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', 
  '#ec4899', '#64748b'
];

export const CategoriesTab: React.FC<CategoriesTabProps> = ({ 
  categories, 
  printers, 
  products, 
  onRefresh 
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    color: '#ef4444',
    printerId: '',
  });

  const openNewCategoryModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      color: '#ef4444',
      printerId: printers[0]?.id || '',
    });
    setModalOpen(true);
  };

  const openEditCategoryModal = (cat: CategoryConfig) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      color: cat.color,
      printerId: cat.printerId || '',
    });
    setModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Kategori adını giriniz.');

    if (editingId) {
      restaurantDataService.updateCategory(editingId, {
        name: form.name,
        color: form.color,
        printerId: form.printerId,
      });
      notify.success('Kategori Güncellendi', `[${form.name}] güncellendi.`);
    } else {
      restaurantDataService.addCategory({
        name: form.name,
        color: form.color,
        printerId: form.printerId,
      });
      notify.success('Kategori Eklendi', `[${form.name}] oluşturuldu.`);
    }
    setModalOpen(false);
    onRefresh();
  };

  const handleDeleteCategory = (id: string, name: string) => {
    const hasProducts = products.some(p => p.categoryId === id);
    if (hasProducts) {
      return notify.warning('Silme Engellendi', `[${name}] kategorisine bağlı ürünler var. Önce ürünlerin kategorisini değiştirin.`);
    }

    notify.confirm({
      title: 'Kategoriyi Sil',
      message: `[${name}] kategorisini silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteCategory(id);
        notify.success('Kategori Silindi', `[${name}] kaldırıldı.`);
        onRefresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & YENİ KATEGORİ BUTONU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#F5C877]" />
            <span>Menü Kategorileri & Mutfak Yazıcı Yönlendirmeleri</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Ürün gruplarını renklendirin ve sipariş verildiğinde hangi mutfak istasyonuna yazdırılacağını belirleyin.
          </p>
        </div>

        <button
          onClick={openNewCategoryModal}
          className="px-4 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Yeni Kategori Ekle</span>
        </button>
      </div>

      {/* KATEGORİ KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const catProducts = products.filter(p => p.categoryId === cat.id);
          const targetPrinter = printers.find(p => p.id === cat.printerId);

          return (
            <div 
              key={cat.id} 
              className="bg-[#1C1C20] rounded-3xl p-5 border border-[#2C2C34] shadow-lg flex flex-col justify-between space-y-4 hover:border-[#3E3E4A] transition-all"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#2C2C34]">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white shadow-md"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white">{cat.name}</h3>
                      <span className="text-[11px] text-[#A0A0AA]">{catProducts.length} Ürün Tanımlı</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditCategoryModal(cat)}
                      className="p-1.5 text-[#C4C4CC] hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                      title="Düzenle"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mutfak Yazıcısı Hedef Kutusu */}
                <div className="mt-4 p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#C4C4CC] flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-[#F5C877]" />
                      Mutfak Fiş İstasyonu:
                    </span>
                    <strong className="text-amber-300 font-bold">
                      {targetPrinter ? targetPrinter.name : 'Genel Kasa'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#A0A0AA]">
                    <span>İstasyon Rolü:</span>
                    <span>{targetPrinter ? targetPrinter.role : 'Doğrudan Kasa Fişi'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mutfak yönlendirmesi aktif</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* KATEGORİ EKLE / DÜZENLE MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Kategoriyi Düzenle' : 'Yeni Menü Kategorisi Ekle'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Kategori Adı</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Kebaplar & Izgaralar"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC] block mb-2">Renk Etiketi</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer ${
                        form.color === c ? 'scale-110 border-white shadow-lg' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Hedef Mutfak Yazıcısı</label>
                <select
                  value={form.printerId}
                  onChange={(e) => setForm({ ...form, printerId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                >
                  <option value="">Varsayılan Kasa Yazıcısı</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#A0A0AA] mt-1">
                  Bu kategorideki ürünler sipariş edildiğinde fiş otomatik bu yazıcıya iletilir.
                </p>
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
