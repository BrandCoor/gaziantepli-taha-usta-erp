import React, { useState } from 'react';
import { 
  UtensilsCrossed, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  Save
} from 'lucide-react';
import { ProductConfig, CategoryConfig, PrinterConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface ProductsTabProps {
  products: ProductConfig[];
  categories: CategoryConfig[];
  printers: PrinterConfig[];
  onRefresh: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({ 
  products, 
  categories, 
  printers, 
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    categoryId: categories[0]?.id || '',
    price: 150,
    costPrice: 50,
    prepTimeMinutes: 15,
    isAvailable: true,
    printerId: '',
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const openNewProductModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      categoryId: categories[0]?.id || '',
      price: 150,
      costPrice: 50,
      prepTimeMinutes: 15,
      isAvailable: true,
      printerId: '',
    });
    setModalOpen(true);
  };

  const openEditProductModal = (prod: ProductConfig) => {
    setEditingId(prod.id);
    setForm({
      name: prod.name,
      categoryId: prod.categoryId,
      price: prod.price,
      costPrice: prod.costPrice || 0,
      prepTimeMinutes: prod.preparationMin || prod.prepTimeMinutes || 15,
      isAvailable: prod.isAvailable ?? true,
      printerId: prod.printerId || '',
    });
    setModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Ürün adını giriniz.');

    if (editingId) {
      restaurantDataService.updateProduct(editingId, {
        name: form.name,
        categoryId: form.categoryId,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        preparationMin: Number(form.prepTimeMinutes),
        prepTimeMinutes: Number(form.prepTimeMinutes),
        isAvailable: form.isAvailable,
        printerId: form.printerId || undefined,
      });
      notify.success('Ürün Güncellendi', `[${form.name}] güncellendi.`);
    } else {
      restaurantDataService.addProduct({
        name: form.name,
        categoryId: form.categoryId,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        preparationMin: Number(form.prepTimeMinutes),
        prepTimeMinutes: Number(form.prepTimeMinutes),
        isAvailable: form.isAvailable,
        printerId: form.printerId || undefined,
      });
      notify.success('Ürün Eklendi', `[${form.name}] menüye dahil edildi.`);
    }
    setModalOpen(false);
    onRefresh();
  };

  const handleDeleteProduct = (id: string, name: string) => {
    notify.confirm({
      title: 'Ürünü Sil',
      message: `[${name}] ürününü menüden kaldırmak istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteProduct(id);
        notify.success('Ürün Silindi', `[${name}] kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const handleToggleAvailability = (prod: ProductConfig) => {
    const updated = !prod.isAvailable;
    restaurantDataService.updateProduct(prod.id, { isAvailable: updated });
    notify.info(
      updated ? 'Ürün Satışa Açıldı' : 'Ürün Tükendi Olarak İşaretlendi',
      `[${prod.name}] durumu güncellendi.`
    );
    onRefresh();
  };

  const handleQuickPriceChange = (prod: ProductConfig, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    restaurantDataService.updateProduct(prod.id, { price: newPrice });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* ÜST FİLTRE & AKSİYON BARI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-[#F5C877]" />
            <span>Menü & Ürün Fiyat Yönetimi</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Toplam {products.length} ürün tanımlı. Fiyatları, maliyetleri ve mutfak hazırlık sürelerini güncelleyin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A0A0AA] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün ara (Kebap, Ayran...)"
              className="pl-9 pr-4 py-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-[#F5C877] w-56"
            />
          </div>

          <button
            onClick={openNewProductModal}
            className="px-4 py-2 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Yeni Ürün Ekle</span>
          </button>
        </div>
      </div>

      {/* KATEGORİ FİLTRE HAPLARI */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-[#F5C877] text-slate-950 shadow-md'
              : 'bg-[#1C1C20] text-[#C4C4CC] hover:text-white border border-[#2C2C34]'
          }`}
        >
          Tüm Kategoriler ({products.length})
        </button>

        {categories.map((c) => {
          const count = products.filter(p => p.categoryId === c.id).length;
          const isSelected = selectedCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-2 shrink-0 ${
                isSelected
                  ? 'bg-white text-slate-950 shadow-md'
                  : 'bg-[#1C1C20] text-[#C4C4CC] hover:text-white border border-[#2C2C34]'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></span>
              <span>{c.name} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* ÜRÜNLER TABLOSU */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141416] text-[#A0A0AA] border-b border-[#2C2C34] font-black uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Ürün Adı</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Satış Fiyatı (₺)</th>
                <th className="p-4">Reçete Maliyeti</th>
                <th className="p-4">Kar Marjı</th>
                <th className="p-4">Hazırlık</th>
                <th className="p-4 text-center">Durum</th>
                <th className="p-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C2C34]/80 text-[#E4E4E8]">
              {filteredProducts.map((prod) => {
                const cat = categories.find(c => c.id === prod.categoryId);
                const cost = prod.costPrice || 0;
                const profit = prod.price - cost;
                const marginPercent = prod.price > 0 ? Math.round((profit / prod.price) * 100) : 0;

                return (
                  <tr key={prod.id} className="hover:bg-[#232328] transition-colors">
                    <td className="p-4 font-black text-white text-xs">
                      {prod.name}
                    </td>

                    <td className="p-4">
                      {cat ? (
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-slate-500">Kategorisiz</span>
                      )}
                    </td>

                    <td className="p-4 font-mono font-black text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400">₺</span>
                        <input
                          type="number"
                          value={prod.price}
                          onChange={(e) => handleQuickPriceChange(prod, Number(e.target.value))}
                          className="w-20 p-1 bg-[#141416] border border-[#383844] rounded-lg text-xs font-mono font-black text-amber-300 text-right focus:outline-none focus:border-[#F5C877]"
                        />
                      </div>
                    </td>

                    <td className="p-4 font-mono text-[#A0A0AA]">
                      ₺{cost.toFixed(2)}
                    </td>

                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] ${
                        marginPercent >= 50 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        <TrendingUp className="w-3 h-3" />
                        %{marginPercent}
                      </span>
                    </td>

                    <td className="p-4 text-[#A0A0AA]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#A0A0AA]" />
                        {prod.preparationMin || prod.prepTimeMinutes || 15} dk
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleToggleAvailability(prod)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black cursor-pointer transition-colors ${
                          prod.isAvailable ?? true
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {prod.isAvailable ?? true ? 'Stokta Var' : 'Tükendi'}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditProductModal(prod)}
                          className="p-1.5 text-[#C4C4CC] hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                          title="Düzenle"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ÜRÜN EKLEME / DÜZENLEME MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Ürün Detaylarını Düzenle' : 'Yeni Menü Ürünü Ekle'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Ürün Adı</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Özel Taha Usta Kebap (1.5 Porsiyon)"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Kategori</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Hazırlık Süresi (Dakika)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={form.prepTimeMinutes}
                    onChange={(e) => setForm({ ...form, prepTimeMinutes: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-black text-amber-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Hammadde / Reçete Maliyeti (₺)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-mono font-bold text-[#C4C4CC] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Özel Mutfak İstasyonu (Opsiyonel)</label>
                <select
                  value={form.printerId}
                  onChange={(e) => setForm({ ...form, printerId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                >
                  <option value="">Kategori Varsayılan Yazıcısını Kullan</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34]">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-white">Ürün Satışa Açık (Stokta Var)</span>
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
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
