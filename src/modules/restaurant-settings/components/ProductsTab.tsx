import React, { useState, useRef } from 'react';
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
  Save,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { 
  ProductConfig, 
  CategoryConfig, 
  PrinterConfig, 
  restaurantDataService,
  FOOD_IMAGE_PRESETS,
  getProductFallbackImage
} from '../../../services/restaurantDataService';
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    imageUrl: '',
    description: '',
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
      imageUrl: '',
      description: '',
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
      imageUrl: prod.imageUrl || '',
      description: prod.description || '',
    });
    setModalOpen(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return notify.error('Geçersiz Dosya', 'Lütfen bir resim dosyası seçiniz.');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize & compress to max 600x600 for optimal storage & speed
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          setForm(prev => ({ ...prev, imageUrl: compressedBase64 }));
          notify.success('Görsel Yüklendi', 'Ürün görseli hazırlandı.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Bilgi', 'Ürün adını giriniz.');

    const finalImage = form.imageUrl.trim() || getProductFallbackImage(form.name, form.categoryId);

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
        imageUrl: finalImage,
        description: form.description.trim() || undefined,
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
        imageUrl: finalImage,
        description: form.description.trim() || undefined,
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
                <th className="p-4 w-16 text-center">Görsel</th>
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
                const displayImg = prod.imageUrl || getProductFallbackImage(prod.name, prod.categoryId);

                return (
                  <tr key={prod.id} className="hover:bg-[#232328] transition-colors">
                    <td className="p-3 w-16 text-center">
                      <div 
                        onClick={() => openEditProductModal(prod)}
                        title="Görseli Değiştir / Düzenle"
                        className="w-12 h-12 mx-auto rounded-2xl overflow-hidden bg-[#141416] border border-[#2C2C34] relative group cursor-pointer shadow-sm hover:border-[#F5C877] transition-all"
                      >
                        <img 
                          src={displayImg} 
                          alt={prod.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getProductFallbackImage(prod.name, prod.categoryId);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ImageIcon className="w-4 h-4 text-[#F5C877]" />
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-black text-white text-xs">
                      <div>
                        <div>{prod.name}</div>
                        {prod.description && (
                          <div className="text-[10px] text-[#A0A0AA] font-normal line-clamp-1 mt-0.5">{prod.description}</div>
                        )}
                      </div>
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

              {/* GÖRSEL SEÇİM ALANI */}
              <div className="p-3.5 bg-[#1C1C20] rounded-2xl border border-[#2C2C34] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#F5C877] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Ürün Görseli (POS, Garson ve QR Menü)</span>
                  </label>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: '' })}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Görseli Kaldır
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-[#141416] border border-[#383844] overflow-hidden shrink-0 relative group shadow-md">
                    <img 
                      src={form.imageUrl || getProductFallbackImage(form.name, form.categoryId)} 
                      alt="Önizleme" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getProductFallbackImage(form.name, form.categoryId);
                      }}
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] font-bold text-white cursor-pointer transition-opacity"
                    >
                      <Upload className="w-3.5 h-3.5 mb-0.5 text-[#F5C877]" />
                      Değiştir
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-[#282830] hover:bg-[#34343e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#383844]"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#F5C877]" />
                        <span>Cihazdan Yükle</span>
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={form.imageUrl}
                          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                          placeholder="veya Görsel URL'si yapıştırın (https://...)"
                          className="w-full p-1.5 pl-7 bg-[#141416] border border-[#383844] rounded-xl text-[11px] text-white focus:outline-none focus:border-[#F5C877]"
                        />
                        <LinkIcon className="w-3 h-3 text-[#A0A0AA] absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {/* Hızlı Antep Yemek Görselleri Hazır Şablonları */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-[#A0A0AA] font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#F5C877]" />
                        <span>Hızlı Hazır Antep Fotoğrafı Seç:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                        {FOOD_IMAGE_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setForm({ ...form, imageUrl: preset.url })}
                            className="px-2 py-0.5 rounded-lg bg-[#141416] hover:bg-[#282830] text-[10px] text-[#C4C4CC] hover:text-white border border-[#2C2C34] transition-colors"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ÜRÜN AÇIKLAMASI (QR MENÜ İÇİN) */}
              <div>
                <label className="text-xs font-bold text-[#C4C4CC] flex items-center justify-between">
                  <span>Ürün Açıklaması & Malzeme Detayı (QR Menüde Görünür)</span>
                  <span className="text-[10px] text-[#A0A0AA] font-normal">Müşteri menüsünde sergilenir</span>
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Örn: Zırhta çekilmiş kuzu eti, Antep pul biberi ve közlenmiş garnitürlerle..."
                  className="w-full mt-1 p-2 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs text-white focus:outline-none focus:border-[#F5C877] resize-none"
                />
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
