import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Sliders, 
  Grid, 
  UtensilsCrossed, 
  Printer, 
  Smartphone, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3,
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Flame, 
  Search, 
  QrCode,
  Receipt,
  RotateCcw,
  Tag,
  Save,
  CreditCard,
  Wallet,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  restaurantDataService, 
  SectionConfig, 
  ProductConfig, 
  CategoryConfig, 
  WaiterConfig, 
  PrinterConfig,
  PaymentMethodConfig,
  ReceiptSettingsConfig 
} from '../../services/restaurantDataService';

export const RestaurantSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payments' | 'waiters' | 'printers' | 'categories' | 'products' | 'tables' | 'receipts'>('payments');

  // Canlı Servis Verileri
  const [sections, setSections] = useState<SectionConfig[]>(restaurantDataService.getSections());
  const [categories, setCategories] = useState<CategoryConfig[]>(restaurantDataService.getCategories());
  const [products, setProducts] = useState<ProductConfig[]>(restaurantDataService.getProducts());
  const [waiters, setWaiters] = useState<WaiterConfig[]>(restaurantDataService.getWaiters());
  const [printers, setPrinters] = useState<PrinterConfig[]>(restaurantDataService.getPrinters());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(restaurantDataService.getPaymentMethods());
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsConfig>(restaurantDataService.getReceiptSettings());

  const [selectedWaiter, setSelectedWaiter] = useState<WaiterConfig>(waiters[0] || {} as any);

  // ÖDEME YÖNTEMİ EKLEME MODALI STATE
  const [newPmModalOpen, setNewPmModalOpen] = useState(false);
  const [newPmName, setNewPmName] = useState('');
  const [newPmType, setNewPmType] = useState<PaymentMethodConfig['type']>('MEAL_CARD');

  // GARSON MODALI STATE
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [editingWaiterId, setEditingWaiterId] = useState<string | null>(null);
  const [waiterForm, setWaiterForm] = useState({
    name: '',
    pin: '',
    allowedSections: ['sec-salon', 'sec-bahce'],
  });

  // YAZICI MODALI STATE
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerForm, setPrinterForm] = useState<Omit<PrinterConfig, 'id'>>({
    name: '',
    type: 'NETWORK',
    ipAddress: '192.168.1.205',
    port: 9100,
    usbName: 'Afanda 892E',
    role: 'Mutfak / Fırın Fişleri',
    paperWidth: 80,
    autoCut: true,
    beepOnPrint: true,
    isBillPrinter: false,
    isKitchen: true,
  });

  // KATEGORİ MODALI STATE
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<Omit<CategoryConfig, 'id'>>({
    name: '',
    color: '#ef4444',
    printerId: printers[0]?.id || 'pr-ocak',
  });

  // ÜRÜN MODALI STATE
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Omit<ProductConfig, 'id'>>({
    name: '',
    categoryId: categories[0]?.id || 'cat-kebap',
    price: 150,
    costPrice: 80,
    preparationMin: 15,
    isAvailable: true,
  });

  // Masalar & Ağ Arama State
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionTables, setNewSectionTables] = useState('8');
  const [productSearch, setProductSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState<any[]>([]);

  useEffect(() => {
    const unsub = restaurantDataService.subscribe(() => {
      const freshWaiters = restaurantDataService.getWaiters();
      setSections(restaurantDataService.getSections());
      setCategories(restaurantDataService.getCategories());
      setProducts(restaurantDataService.getProducts());
      setWaiters(freshWaiters);
      setPrinters(restaurantDataService.getPrinters());
      setPaymentMethods(restaurantDataService.getPaymentMethods());
      setReceiptSettings(restaurantDataService.getReceiptSettings());

      if (freshWaiters.length > 0 && (!selectedWaiter || !freshWaiters.some(w => w.id === selectedWaiter.id))) {
        setSelectedWaiter(freshWaiters[0]);
      }
    });
    return () => unsub();
  }, [selectedWaiter]);

  // ÖDEME YÖNTEMİ EKLE / AÇ-KAPA / SİL
  const handleTogglePaymentMethod = (id: string) => {
    restaurantDataService.togglePaymentMethod(id);
  };

  const handleAddCustomPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmName.trim()) return alert('Ödeme sistemi adını girin!');

    restaurantDataService.addPaymentMethod({
      name: newPmName.trim(),
      type: newPmType,
      color: '#0284c7',
      isActive: true,
    });

    setNewPmName('');
    setNewPmModalOpen(false);
  };

  const handleDeletePaymentMethod = (id: string, name: string) => {
    if (confirm(`[${name}] ödeme sistemi silinsin mi?`)) {
      restaurantDataService.deletePaymentMethod(id);
    }
  };

  // GARSON İŞLEMLERİ
  const openNewWaiterModal = () => {
    setEditingWaiterId(null);
    setWaiterForm({
      name: '',
      pin: '',
      allowedSections: sections.map(s => s.id),
    });
    setWaiterModalOpen(true);
  };

  const openEditWaiterModal = (w: WaiterConfig) => {
    setEditingWaiterId(w.id);
    setWaiterForm({
      name: w.name,
      pin: w.pin,
      allowedSections: w.allowedSections || [],
    });
    setWaiterModalOpen(true);
  };

  const handleSaveWaiterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterForm.name.trim()) return alert('Garson adını girin!');
    if (!waiterForm.pin || waiterForm.pin.length < 4) return alert('4 Haneli PIN girin!');

    if (editingWaiterId) {
      restaurantDataService.updateWaiter(editingWaiterId, {
        name: waiterForm.name.trim(),
        pin: waiterForm.pin.trim(),
        allowedSections: waiterForm.allowedSections,
      });
      const updated = restaurantDataService.getWaiters().find(w => w.id === editingWaiterId);
      if (updated) setSelectedWaiter(updated);
    } else {
      const created = restaurantDataService.addWaiter({
        name: waiterForm.name.trim(),
        pin: waiterForm.pin.trim(),
        allowedSections: waiterForm.allowedSections,
        permissions: { canDiscount: false, canVoidItem: false, canGift: true, canTransferTable: true, canPrintBill: true },
      });
      setSelectedWaiter(created);
    }

    setWaiterModalOpen(false);
  };

  const handleDeleteWaiter = (id: string, name: string) => {
    if (confirm(`[${name}] isimli garson silinsin mi?`)) {
      restaurantDataService.deleteWaiter(id);
      const remaining = restaurantDataService.getWaiters().filter(w => w.id !== id);
      if (remaining.length > 0) {
        setSelectedWaiter(remaining[0]);
      }
    }
  };

  const garsonConnectUrl = selectedWaiter?.qrToken 
    ? `https://garson.rymedya.com.tr/?id=${selectedWaiter.id}&name=${encodeURIComponent(selectedWaiter.name)}&pin=${selectedWaiter.pin}&token=${selectedWaiter.qrToken}`
    : 'https://garson.rymedya.com.tr';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      
      {/* ÜST BAŞLIK VE SEKME BARI */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shadow-lg shadow-slate-900/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Restoran Yapılandırma & Donanım Merkezi</span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black tracking-wide uppercase">CANLI SENKRON</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Ödeme platformları, garson yetkileri, yazıcılar, kategoriler ve menü yönetimi.</p>
          </div>
        </div>

        {/* Sekme Butonları */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payments' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span>Ödeme Sistemleri ({paymentMethods.filter(p => p.isActive).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('waiters')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'waiters' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Garsonlar ({waiters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('printers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'printers' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Yazıcılar ({printers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'categories' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Kategoriler ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'products' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
            <span>Menü & Ürünler ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tables' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-amber-400" />
            <span>Masalar & Bölgeler</span>
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'receipts' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-amber-400" />
            <span>Fiş Şablonu</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ÖDEME SİSTEMLERİ & PLATFORMLAR YÖNETİMİ */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-slate-900">Ödeme Yöntemleri & Platformlar Yönetimi</h2>
              <p className="text-xs text-slate-500">Kasada aktif olmasını istediğiniz ödeme kanallarını açıp kapatabilir veya yeni sistemler ekleyebilirsiniz.</p>
            </div>

            <button
              onClick={() => {
                setNewPmName('');
                setNewPmModalOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Ödeme Sistemi Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                    pm.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-xs text-slate-900">{pm.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{pm.type}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePaymentMethod(pm.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      pm.isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {pm.isActive ? 'Aktif' : 'Kapalı'}
                  </button>

                  {!['pm-cash', 'pm-card', 'pm-cari', 'pm-discount', 'pm-gift'].includes(pm.id) && (
                    <button
                      onClick={() => handleDeletePaymentMethod(pm.id, pm.name)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GARSONLAR & YETKİLER */}
      {/* ========================================================================= */}
      {activeTab === 'waiters' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">Kayıtlı Garsonlar</h2>
                <p className="text-[11px] text-slate-500">Düzenle, sil veya QR incele</p>
              </div>
              <button
                onClick={openNewWaiterModal}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Garson Ekle</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {waiters.map((w) => {
                const isSelected = selectedWaiter?.id === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWaiter(w)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-amber-50/90 border-amber-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black flex-shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-xs text-slate-900 truncate">{w.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">PIN: <strong className="text-slate-800">{w.pin}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditWaiterModal(w)}
                        className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Garsonu Düzenle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteWaiter(w.id, w.name)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                        title="Garsonu Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedWaiter && (
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl flex flex-col items-center justify-between text-center">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/30">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-white">{selectedWaiter.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Garson telefonundan bu QR kodu 1 kez okutun</p>
                </div>

                <div className="p-4 bg-white rounded-3xl shadow-xl my-4">
                  <QRCodeSVG value={garsonConnectUrl} size={180} level="H" />
                </div>

                <div className="w-full space-y-2">
                  <div className="p-2.5 bg-slate-800/80 rounded-xl text-xs text-amber-300 font-mono flex items-center justify-between">
                    <span>Giriş PIN Kodu:</span>
                    <strong className="text-sm text-white">{selectedWaiter.pin}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Cihaz ve Yetki Detayı</span>
                  </h3>
                  <button
                    onClick={() => openEditWaiterModal(selectedWaiter)}
                    className="px-3 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Düzenle
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="text-[10px] font-black uppercase text-slate-400">Eşleşen Cihaz</div>
                    <div className="text-xs font-black text-slate-800 mt-1">{selectedWaiter.deviceName}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="text-[10px] font-black uppercase text-slate-400">Donanım Kimliği (MAC)</div>
                    <div className="text-xs font-mono font-black text-blue-600 mt-1 truncate">{selectedWaiter.deviceUuid}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    restaurantDataService.updateWaiter(selectedWaiter.id, { deviceUuid: 'Henüz Eşleşmedi', deviceName: 'Eşleşme Bekleniyor', status: 'NOT_PAIRED' });
                    alert('Cihaz eşleşmesi sıfırlandı!');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cihaz Eşleşmesini Sıfırla</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. YAZICILAR */}
      {activeTab === 'printers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {printers.map((pr) => (
              <div key={pr.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      pr.isKitchen ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {pr.isKitchen ? <Flame className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black">● Aktif</span>
                  </div>

                  <h3 className="font-black text-sm text-slate-900">{pr.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{pr.role}</p>

                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600"><span>Tür:</span><strong>{pr.type}</strong></div>
                    <div className="flex justify-between text-slate-600"><span>Hedef:</span><strong className="font-mono text-blue-600">{pr.type === 'NETWORK' ? `${pr.ipAddress}:${pr.port}` : pr.usbName}</strong></div>
                  </div>
                </div>

                <button
                  onClick={() => alert(`🖨️ [${pr.name}] için test fişi basıldı!`)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Fişi Bas</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. KATEGORİLER */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const targetPrinter = printers.find(p => p.id === cat.printerId);
            return (
              <div key={cat.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full shadow-xs" style={{ backgroundColor: cat.color }}></span>
                    <span className="font-black text-sm text-slate-900">{cat.name}</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <span>Yazıcı: <strong>{targetPrinter ? targetPrinter.name : 'Yazıcı Seçilmedi'}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MENÜ & ÜRÜNLER */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase">
                <th className="pb-3">Ürün Adı</th>
                <th className="pb-3">Kategori</th>
                <th className="pb-3">Satış Fiyatı (₺)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {products.map((p) => {
                const cat = categories.find(c => c.id === p.categoryId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 font-black text-slate-800">{p.name}</td>
                    <td className="py-3"><span className="px-2 py-0.5 rounded-md text-[10px] font-black" style={{ backgroundColor: `${cat?.color}20`, color: cat?.color }}>{cat?.name || 'Diğer'}</span></td>
                    <td className="py-3 font-bold font-mono">{p.price.toFixed(2)} ₺</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MASALAR & BÖLGELER */}
      {activeTab === 'tables' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-slate-900">Bölgeler ve Masa Sayıları</h2>
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div className="font-black text-xs text-slate-900">{sec.name}</div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">Masa Sayısı:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={sec.tableCount}
                    onChange={(e) => {
                      const updated = [...sections];
                      updated[idx].tableCount = Number(e.target.value) || 1;
                      restaurantDataService.saveSections(updated);
                    }}
                    className="w-16 text-center font-black text-xs text-slate-900 bg-white border border-slate-300 rounded-xl p-1.5"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FİŞ ŞABLONU AYARLARI */}
      {activeTab === 'receipts' && (
        <div className="max-w-2xl bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-slate-900">Termal Fiş Şablonu</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500">İşletme Başlığı</label>
              <input
                type="text"
                value={receiptSettings.title}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, title: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500">Fiş Altı Mesajı</label>
              <input
                type="text"
                value={receiptSettings.footerMessage}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, footerMessage: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold mt-1"
              />
            </div>
            <button
              onClick={() => {
                restaurantDataService.saveReceiptSettings(receiptSettings);
                alert('✅ Fiş şablonu başarıyla kaydedildi!');
              }}
              className="w-full py-3 bg-emerald-600 text-white font-black text-xs rounded-2xl cursor-pointer"
            >
              Şablonu Kaydet
            </button>
          </div>
        </div>
      )}

      {/* YENİ ÖDEME YÖNTEMİ EKLEME MODALI */}
      {newPmModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">Yeni Ödeme Sistemi / Platform Ekle</h3>

            <form onSubmit={handleAddCustomPaymentMethod} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Ödeme Sistemi Adı</label>
                <input
                  type="text"
                  required
                  value={newPmName}
                  onChange={(e) => setNewPmName(e.target.value)}
                  placeholder="Örn: Paycell / BKM Express / Kurumsal Kart"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Ödeme Türü Kategorisi</label>
                <select
                  value={newPmType}
                  onChange={(e) => setNewPmType(e.target.value as any)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="MEAL_CARD">Yemek Kartı</option>
                  <option value="CARD">Banka / Kredi Kartı</option>
                  <option value="OTHER">Platform / Diğer</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewPmModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg cursor-pointer"
                >
                  + Sistemi Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GARSON EKLE / DÜZENLE MODALI */}
      {waiterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">{editingWaiterId ? 'Garson Düzenle' : 'Yeni Garson Ekle'}</h3>

            <form onSubmit={handleSaveWaiterSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Garson Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={waiterForm.name}
                  onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}
                  placeholder="Örn: İbrahim Usta"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">4 Haneli Giriş PIN Kodu</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={waiterForm.pin}
                  onChange={(e) => setWaiterForm({ ...waiterForm, pin: e.target.value })}
                  placeholder="Örn: 4141"
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setWaiterModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet & QR Üret</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
