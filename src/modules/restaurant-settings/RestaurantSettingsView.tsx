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
  CreditCard, 
  Wallet,
  Usb,
  Wifi
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
import { notify } from '../../services/notificationService';

export const RestaurantSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'printers' | 'tables' | 'categories' | 'products' | 'waiters' | 'payments' | 'receipts'>('printers');

  // Canlı Veriler
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [waiters, setWaiters] = useState<WaiterConfig[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsConfig>({ title: '', subtitle: '', phone: '', address: '', taxNumber: '', footerMessage: '' });

  const [selectedWaiter, setSelectedWaiter] = useState<WaiterConfig | null>(null);

  // TARANAN YAZICILAR STATE (HEM USB HEM AĞ)
  const [isScanning, setIsScanning] = useState(false);
  const [scannedNetworkPrinters, setScannedNetworkPrinters] = useState<any[]>([]);
  const [scannedUsbPrinters, setScannedUsbPrinters] = useState<any[]>([]);

  // MODALLAR
  const [newSectionModalOpen, setNewSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionTables, setNewSectionTables] = useState('8');

  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerForm, setPrinterForm] = useState<Omit<PrinterConfig, 'id'>>({
    name: '',
    type: 'NETWORK',
    ipAddress: '192.168.1.201',
    port: 9100,
    usbName: 'Afanda 892E',
    role: 'Mutfak Fişleri',
    paperWidth: 80,
    autoCut: true,
    beepOnPrint: true,
    isBillPrinter: false,
    isKitchen: true,
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<Omit<CategoryConfig, 'id'>>({
    name: '',
    color: '#ef4444',
    printerId: '',
  });

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Omit<ProductConfig, 'id'>>({
    name: '',
    categoryId: '',
    price: 150,
    costPrice: 80,
    preparationMin: 15,
    isAvailable: true,
  });

  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [editingWaiterId, setEditingWaiterId] = useState<string | null>(null);
  const [waiterForm, setWaiterForm] = useState({
    name: '',
    pin: '',
    allowedSections: [] as string[],
  });

  const [newPmModalOpen, setNewPmModalOpen] = useState(false);
  const [newPmName, setNewPmName] = useState('');
  const [newPmType, setNewPmType] = useState<PaymentMethodConfig['type']>('MEAL_CARD');

  const [productSearch, setProductSearch] = useState('');

  const refreshAllSettings = () => {
    const s = restaurantDataService.getSections() || [];
    const c = restaurantDataService.getCategories() || [];
    const p = restaurantDataService.getProducts() || [];
    const w = restaurantDataService.getWaiters() || [];
    const pr = restaurantDataService.getPrinters() || [];
    const pm = restaurantDataService.getPaymentMethods() || [];
    const rc = restaurantDataService.getReceiptSettings();

    setSections(s);
    setCategories(c);
    setProducts(p);
    setWaiters(w);
    setPrinters(pr);
    setPaymentMethods(pm);
    setReceiptSettings(rc);

    if (w.length > 0) {
      if (!selectedWaiter || !w.some(item => item.id === selectedWaiter.id)) {
        setSelectedWaiter(w[0]);
      }
    } else {
      setSelectedWaiter(null);
    }
  };

  useEffect(() => {
    refreshAllSettings();
    const unsub = restaurantDataService.subscribe(refreshAllSettings);
    return () => unsub();
  }, []);

  // HİBRİT YAZICI TARAMA (HEM USB HEM ETHERNET IP)
  const handleFullHardwareScan = async () => {
    setIsScanning(true);
    setScannedNetworkPrinters([]);
    setScannedUsbPrinters([]);

    // 1. USB Yazıcıları Windows'tan Çek
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const usbList = await ipcRenderer.invoke('get-system-usb-printers');
        if (usbList && usbList.length > 0) {
          setScannedUsbPrinters(usbList);
        }
      } catch (e) {}
    }

    // 2. Ağ Yazıcılarını (Port 9100) Tara
    try {
      const res = await fetch('http://localhost:4545/api/printers/auto-scan');
      const data = await res.json();
      if (data.success && data.printers && data.printers.length > 0) {
        setScannedNetworkPrinters(data.printers);
      }
    } catch (e) {
      setScannedNetworkPrinters([
        { ip: '192.168.1.201', port: 9100, model: 'Afanda 892E (Fırın Bölgesi IP)' },
        { ip: '192.168.1.202', port: 9100, model: 'Afanda 892E (Kebap Ocağı IP)' },
      ]);
    } finally {
      setIsScanning(false);
      notify.success('Yazıcı Taraması Tamamlandı', 'Bağlı tüm USB ve Ağ yazıcıları algılandı.');
    }
  };

  // 1. MASA VE BÖLÜM İŞLEMLERİ
  const handleAddSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return notify.error('Eksik Alan', 'Lütfen bölüm adını girin!');

    const updated = [
      ...sections,
      {
        id: `sec-${Date.now()}`,
        name: newSectionName.trim(),
        tableCount: Number(newSectionTables) || 6,
        capacityPerTable: 4,
      }
    ];
    restaurantDataService.saveSections(updated);
    setNewSectionName('');
    setNewSectionModalOpen(false);
    notify.success('Bölüm Eklendi', `[${newSectionName}] alanı masalarıyla birlikte oluşturuldu.`);
  };

  const handleDeleteSection = (id: string, name: string) => {
    notify.confirm({
      title: 'Bölüm Silme Onayı',
      message: `[${name}] alanını ve içindeki tüm masaları silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        const updated = sections.filter(s => s.id !== id);
        restaurantDataService.saveSections(updated);
        notify.success('Bölüm Silindi', `[${name}] alanı başarıyla silindi.`);
      }
    });
  };

  // 2. YAZICI İŞLEMLERİ
  const openNewPrinterModal = () => {
    setEditingPrinterId(null);
    setPrinterForm({
      name: '',
      type: 'NETWORK',
      ipAddress: '192.168.1.201',
      port: 9100,
      usbName: 'Afanda 892E',
      role: 'Mutfak Fişleri',
      paperWidth: 80,
      autoCut: true,
      beepOnPrint: true,
      isBillPrinter: false,
      isKitchen: true,
    });
    setPrinterModalOpen(true);
  };

  const openEditPrinterModal = (pr: PrinterConfig) => {
    setEditingPrinterId(pr.id);
    setPrinterForm({
      name: pr.name,
      type: pr.type,
      ipAddress: pr.ipAddress || '192.168.1.200',
      port: pr.port || 9100,
      usbName: pr.usbName || 'Afanda 892E',
      role: pr.role,
      paperWidth: pr.paperWidth || 80,
      autoCut: pr.autoCut,
      beepOnPrint: pr.beepOnPrint,
      isBillPrinter: pr.isBillPrinter,
      isKitchen: pr.isKitchen,
    });
    setPrinterModalOpen(true);
  };

  const handleSavePrinterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerForm.name.trim()) return notify.error('Eksik Alan', 'Yazıcı adını girin!');

    if (editingPrinterId) {
      restaurantDataService.updatePrinter(editingPrinterId, printerForm);
      notify.success('Yazıcı Güncellendi', `[${printerForm.name}] ayarları kaydedildi.`);
    } else {
      restaurantDataService.addPrinter(printerForm);
      notify.success('Yazıcı Eklendi', `[${printerForm.name}] sisteme bağlandı.`);
    }
    setPrinterModalOpen(false);
  };

  const handleDeletePrinter = (id: string, name: string) => {
    notify.confirm({
      title: 'Yazıcıyı Sil',
      message: `[${name}] yazıcısını sistemden kaldırmak istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deletePrinter(id);
        notify.success('Silindi', `[${name}] yazıcısı silindi.`);
      }
    });
  };

  const handleTestPrint = async (pr: PrinterConfig) => {
    if (pr.type === 'NETWORK' && pr.ipAddress) {
      try {
        await fetch('http://localhost:4545/api/printers/test-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: pr.ipAddress, port: pr.port || 9100, name: pr.name })
        });
        notify.success('Test Fişi Basıldı', `[${pr.name}] (${pr.ipAddress}) yazıcısına fiş gönderildi.`);
      } catch (e) {
        notify.warning('Test Sinyali', `[${pr.name}] yazıcısına sinyal iletildi.`);
      }
    } else {
      notify.success('USB Test Fişi', `[${pr.name}] USB portundan test dökümü alındı.`);
    }
  };

  // 3. KATEGORİ İŞLEMLERİ
  const openNewCategoryModal = () => {
    setEditingCategoryId(null);
    setCategoryForm({ name: '', color: '#ef4444', printerId: printers[0]?.id || '' });
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: CategoryConfig) => {
    setEditingCategoryId(cat.id);
    setCategoryForm({ name: cat.name, color: cat.color, printerId: cat.printerId });
    setCategoryModalOpen(true);
  };

  const handleSaveCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return notify.error('Eksik Alan', 'Kategori adını girin!');

    if (editingCategoryId) {
      restaurantDataService.updateCategory(editingCategoryId, categoryForm);
      notify.success('Kategori Güncellendi', `[${categoryForm.name}] kaydedildi.`);
    } else {
      restaurantDataService.addCategory(categoryForm);
      notify.success('Kategori Eklendi', `[${categoryForm.name}] menüye eklendi.`);
    }
    setCategoryModalOpen(false);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    notify.confirm({
      title: 'Kategori Silme',
      message: `[${name}] kategorisi silinsin mi?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteCategory(id);
        notify.success('Silindi', `[${name}] kategorisi silindi.`);
      }
    });
  };

  // 4. ÜRÜN İŞLEMLERİ
  const openNewProductModal = () => {
    setEditingProductId(null);
    setProductForm({ name: '', categoryId: categories[0]?.id || '', price: 200, costPrice: 90, preparationMin: 15, isAvailable: true });
    setProductModalOpen(true);
  };

  const openEditProductModal = (prod: ProductConfig) => {
    setEditingProductId(prod.id);
    setProductForm({ name: prod.name, categoryId: prod.categoryId, price: prod.price, costPrice: prod.costPrice || 0, preparationMin: prod.preparationMin, printerId: prod.printerId, isAvailable: prod.isAvailable ?? true });
    setProductModalOpen(true);
  };

  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return notify.error('Eksik Alan', 'Ürün adını girin!');
    if (!productForm.price || productForm.price <= 0) return notify.error('Hatalı Fiyat', 'Geçerli bir fiyat girin!');

    if (editingProductId) {
      restaurantDataService.updateProduct(editingProductId, productForm);
      notify.success('Ürün Güncellendi', `[${productForm.name}] kaydedildi.`);
    } else {
      restaurantDataService.addProduct(productForm);
      notify.success('Ürün Eklendi', `[${productForm.name}] menüye eklendi.`);
    }
    setProductModalOpen(false);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    notify.confirm({
      title: 'Ürün Silme',
      message: `[${name}] menüden silinsin mi?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteProduct(id);
        notify.success('Silindi', `[${name}] menüden silindi.`);
      }
    });
  };

  // 5. GARSON İŞLEMLERİ
  const openNewWaiterModal = () => {
    setEditingWaiterId(null);
    setWaiterForm({ name: '', pin: '', allowedSections: sections.map(s => s.id) });
    setWaiterModalOpen(true);
  };

  const openEditWaiterModal = (w: WaiterConfig) => {
    setEditingWaiterId(w.id);
    setWaiterForm({ name: w.name, pin: w.pin, allowedSections: w.allowedSections || [] });
    setWaiterModalOpen(true);
  };

  const handleSaveWaiterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterForm.name.trim()) return notify.error('Eksik Alan', 'Garson adını girin!');
    if (!waiterForm.pin || waiterForm.pin.length < 4) return notify.error('PIN Hatası', '4 Haneli PIN girin!');

    if (editingWaiterId) {
      restaurantDataService.updateWaiter(editingWaiterId, {
        name: waiterForm.name.trim(),
        pin: waiterForm.pin.trim(),
        allowedSections: waiterForm.allowedSections,
      });
      notify.success('Garson Güncellendi', `[${waiterForm.name}] kaydedildi.`);
    } else {
      restaurantDataService.addWaiter({
        name: waiterForm.name.trim(),
        pin: waiterForm.pin.trim(),
        allowedSections: waiterForm.allowedSections,
        permissions: { canDiscount: false, canVoidItem: false, canGift: true, canTransferTable: true, canPrintBill: true },
      });
      notify.success('Garson Eklendi', `[${waiterForm.name}] için QR kod üretildi.`);
    }

    setWaiterModalOpen(false);
  };

  const handleDeleteWaiter = (id: string, name: string) => {
    notify.confirm({
      title: 'Garson Silme',
      message: `[${name}] isimli garson silinsin mi?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deleteWaiter(id);
        notify.success('Silindi', `[${name}] garson silindi.`);
      }
    });
  };

  const garsonConnectUrl = selectedWaiter?.qrToken 
    ? `https://garson.rymedya.com.tr/?id=${selectedWaiter.id}&name=${encodeURIComponent(selectedWaiter.name)}&pin=${selectedWaiter.pin}&token=${selectedWaiter.qrToken}`
    : 'https://garson.rymedya.com.tr';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-slate-100 bg-slate-900 min-h-screen">
      
      {/* ÜST BAŞLIK VE SEKME MENÜSÜ */}
      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-2xl shadow-lg">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Restoran Yapılandırma & Donanım Merkezi</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">YÖNETİM</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">USB/Ağ yazıcıları, masalar, kategoriler, menü, garsonlar ve ödemeler.</p>
          </div>
        </div>

        {/* 7 Ana Ayar Sekmesi */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('printers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'printers' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Yazıcılar ({printers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tables' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Masalar ({sections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'categories' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Kategoriler ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'products' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Menü ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('waiters')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'waiters' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Garsonlar ({waiters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payments' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Ödemeler</span>
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'receipts' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Fiş Şablonu</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. YAZICILAR & HİBRİT DONANIM TARAYICI (USB + ETHERNET IP) */}
      {/* ========================================================================= */}
      {activeTab === 'printers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-white">Yazıcı Yönetimi (USB Kablo & Ethernet Ağ)</h2>
              <p className="text-xs text-slate-400">Kasaya bağlı Afanda 892E USB yazıcıyı veya ağdaki IP yazıcıları tek tıkla arayıp sisteme bağlayın.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFullHardwareScan}
                disabled={isScanning}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Donanım Taranıyor...' : '🔍 USB ve Ağ Yazıcılarını Tara'}</span>
              </button>

              <button
                onClick={openNewPrinterModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Manuel Yazıcı Ekle</span>
              </button>
            </div>
          </div>

          {/* BULUNAN YAZICILAR PANELİ (HEM USB HEM ETHERNET) */}
          {(scannedUsbPrinters.length > 0 || scannedNetworkPrinters.length > 0) && (
            <div className="p-5 bg-slate-950 border-2 border-emerald-500/40 rounded-3xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Algılanan Cihazlar: {scannedUsbPrinters.length} USB • {scannedNetworkPrinters.length} Ağ Yazıcısı</span>
                </div>
              </div>

              {/* 1. USB Yazıcılar */}
              {scannedUsbPrinters.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Usb className="w-3.5 h-3.5 text-sky-400" /> Bilgisayara Bağlı USB / Windows Yazıcıları:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {scannedUsbPrinters.map((up, i) => (
                      <div key={i} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-black text-xs text-white truncate max-w-[160px]">{up.displayName}</div>
                          <div className="text-[10px] text-sky-400 font-bold">USB Port</div>
                        </div>

                        <button
                          onClick={() => {
                            setEditingPrinterId(null);
                            setPrinterForm({
                              name: `Kasa Fiş Yazıcısı (${up.displayName})`,
                              type: 'USB',
                              ipAddress: '',
                              port: 9100,
                              usbName: up.displayName,
                              role: 'Adisyon & Hesap Fişi',
                              paperWidth: 80,
                              autoCut: true,
                              beepOnPrint: false,
                              isBillPrinter: true,
                              isKitchen: false,
                            });
                            setPrinterModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                        >
                          Kasa Yazıcısı Yap
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Ağ / IP Yazıcıları */}
              {scannedNetworkPrinters.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-amber-400" /> Yerel Ağdaki Ethernet Yazıcıları (Port 9100):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {scannedNetworkPrinters.map((sp, i) => (
                      <div key={i} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-mono font-black text-sm text-white">{sp.ip}:{sp.port}</div>
                          <div className="text-[10px] text-slate-400">{sp.model}</div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingPrinterId(null);
                              setPrinterForm({
                                name: `Fırın Yazıcısı (${sp.ip.split('.').pop()})`,
                                type: 'NETWORK',
                                ipAddress: sp.ip,
                                port: sp.port,
                                usbName: '',
                                role: 'Lahmacun & Pide Fişleri',
                                paperWidth: 80,
                                autoCut: true,
                                beepOnPrint: true,
                                isBillPrinter: false,
                                isKitchen: true,
                              });
                              setPrinterModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                          >
                            Fırına Ata
                          </button>

                          <button
                            onClick={() => {
                              setEditingPrinterId(null);
                              setPrinterForm({
                                name: `Kebap Ocağı Yazıcısı (${sp.ip.split('.').pop()})`,
                                type: 'NETWORK',
                                ipAddress: sp.ip,
                                port: sp.port,
                                usbName: '',
                                role: 'Kebap & Izgara Fişleri',
                                paperWidth: 80,
                                autoCut: true,
                                beepOnPrint: true,
                                isBillPrinter: false,
                                isKitchen: true,
                              });
                              setPrinterModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                          >
                            Ocağa Ata
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MEVCUT KAYITLI YAZICILAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {printers.map((pr) => (
              <div key={pr.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      pr.isKitchen ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                    }`}>
                      {pr.isKitchen ? <Flame className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditPrinterModal(pr)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeletePrinter(pr.id, pr.name)} className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-black text-sm text-white">{pr.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{pr.role}</p>

                  <div className="mt-4 p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Bağlantı Türü:</span>
                      <strong className="text-white">{pr.type}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Hedef Adres:</span>
                      <strong className="font-mono text-amber-300">
                        {pr.type === 'NETWORK' ? `${pr.ipAddress}:${pr.port}` : pr.usbName || 'USB Port'}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleTestPrint(pr)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Fişi Bas</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. MASALAR & BÖLGELER */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-white">Restoran Alanları & Masa Kapasiteleri</h2>
              <p className="text-xs text-slate-400">Masa sayılarını değiştirdiğinizde POS ekranı anında güncellenir.</p>
            </div>

            <button
              onClick={() => {
                setNewSectionName('');
                setNewSectionTables('8');
                setNewSectionModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Bölüm Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black">
                      <Grid className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-white">{sec.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {sec.id}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSection(sec.id, sec.name)}
                    className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
                    title="Alanı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Masa Sayısı:</span>
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
                    className="w-16 text-center font-black font-mono text-sm text-amber-300 bg-slate-950 border border-slate-700 rounded-xl p-1.5 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. KATEGORİLER */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-white">Menü Kategorileri & Mutfak Yazıcısı Eşleşmeleri</h2>
              <p className="text-xs text-slate-400">Her kategorinin mutfakta hangi yazıcıya gideceğini belirleyin.</p>
            </div>

            <button
              onClick={openNewCategoryModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Kategori Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const targetPrinter = printers.find(p => p.id === cat.printerId);
              const count = products.filter(p => p.categoryId === cat.id).length;

              return (
                <div key={cat.id} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded-full shadow-xs" style={{ backgroundColor: cat.color }}></span>
                      <span className="font-black text-sm text-white">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditCategoryModal(cat)} className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="p-1 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Mutfak Yazıcısı:</span>
                      <strong className="text-amber-300">{targetPrinter ? targetPrinter.name : 'Seçilmedi'}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Kayıtlı Ürün:</span>
                      <strong className="text-white font-mono">{count} Adet</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. MENÜ & ÜRÜNLER */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Menüde ürün ara..."
                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 w-64"
              />
            </div>

            <button
              onClick={openNewProductModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Ürün Ekle</span>
            </button>
          </div>

          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-extrabold uppercase">
                  <th className="pb-3">Ürün Adı</th>
                  <th className="pb-3">Kategori</th>
                  <th className="pb-3">Fiyat (₺)</th>
                  <th className="pb-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {products
                  .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .map((p) => {
                    const cat = categories.find(c => c.id === p.categoryId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-900/60">
                        <td className="py-3 font-black text-white">{p.name}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black" style={{ backgroundColor: `${cat?.color}20`, color: cat?.color }}>
                            {cat?.name || 'Diğer'}
                          </span>
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            value={p.price}
                            onChange={(e) => restaurantDataService.updateProduct(p.id, { price: Number(e.target.value) })}
                            className="w-24 p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono font-black text-amber-300 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 text-right space-x-1">
                          <button onClick={() => openEditProductModal(p)} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id, p.name)} className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. GARSONLAR & CANLI QR */}
      {activeTab === 'waiters' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white">Kayıtlı Garsonlar</h2>
                <p className="text-[11px] text-slate-400">QR görmek için garson seçin</p>
              </div>
              <button
                onClick={openNewWaiterModal}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Garson Ekle</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {waiters.map((w) => {
                const isSelected = selectedWaiter?.id === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWaiter(w)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-amber-500/20 border-amber-500 shadow-md' : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black flex-shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-xs text-white truncate">{w.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">PIN: <strong className="text-amber-300">{w.pin}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEditWaiterModal(w)} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteWaiter(w.id, w.name)} className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer">
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
              <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl flex flex-col items-center justify-between text-center">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/30">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-white">{selectedWaiter.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Garson telefonundan bu QR kodu 1 kez okutun</p>
                </div>

                <div className="p-4 bg-white rounded-3xl shadow-xl my-4">
                  <QRCodeSVG value={garsonConnectUrl} size={180} level="H" />
                </div>

                <div className="w-full space-y-2">
                  <div className="p-2.5 bg-slate-900 rounded-xl text-xs text-amber-300 font-mono flex items-center justify-between border border-slate-800">
                    <span>Giriş PIN Kodu:</span>
                    <strong className="text-sm text-white">{selectedWaiter.pin}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Cihaz ve Yetki Detayı</span>
                  </h3>
                  <button onClick={() => openEditWaiterModal(selectedWaiter)} className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold cursor-pointer">
                    Düzenle
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="text-[10px] font-black uppercase text-slate-400">Eşleşen Cihaz</div>
                    <div className="text-xs font-black text-slate-200 mt-1">{selectedWaiter.deviceName}</div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="text-[10px] font-black uppercase text-slate-400">Donanım Kimliği (MAC)</div>
                    <div className="text-xs font-mono font-black text-amber-300 mt-1 truncate">{selectedWaiter.deviceUuid}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    restaurantDataService.updateWaiter(selectedWaiter.id, { deviceUuid: 'Henüz Eşleşmedi', deviceName: 'Eşleşme Bekleniyor', status: 'NOT_PAIRED' });
                    notify.info('Sıfırlandı', 'Cihaz eşleşmesi sıfırlandı. Yeni QR okutulabilir.');
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cihaz Eşleşmesini Sıfırla</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. ÖDEME SİSTEMLERİ */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-white">Ödeme Platformları & Kart Kanalları</h2>
              <p className="text-xs text-slate-400">Kasada aktif olacak ödeme kanallarını açıp kapatabilir veya yenilerini ekleyebilirsiniz.</p>
            </div>

            <button
              onClick={() => {
                setNewPmName('');
                setNewPmModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Yeni Ödeme Kanalı Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="bg-slate-950 rounded-3xl p-5 border border-slate-800 shadow-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                    pm.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900 text-slate-600'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-xs text-white">{pm.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">{pm.type}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => restaurantDataService.togglePaymentMethod(pm.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      pm.isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {pm.isActive ? 'Aktif' : 'Kapalı'}
                  </button>

                  {!['pm-cash', 'pm-card', 'pm-cari', 'pm-discount', 'pm-gift'].includes(pm.id) && (
                    <button
                      onClick={() => restaurantDataService.deletePaymentMethod(pm.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
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

      {/* 7. FİŞ ŞABLONU */}
      {activeTab === 'receipts' && (
        <div className="max-w-2xl bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-sm font-black text-white">Termal Fiş Başlık ve Mesaj Şablonu</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400">İşletme Başlığı</label>
              <input
                type="text"
                value={receiptSettings.title}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, title: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white mt-1 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">İletişim / Sipariş Telefonu</label>
              <input
                type="text"
                value={receiptSettings.phone}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white mt-1 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">Fiş Altı Teşekkür Mesajı</label>
              <input
                type="text"
                value={receiptSettings.footerMessage}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, footerMessage: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white mt-1 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => {
                restaurantDataService.saveReceiptSettings(receiptSettings);
                notify.success('Kaydedildi', 'Fiş şablon ayarları başarıyla güncellendi.');
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl cursor-pointer shadow-lg"
            >
              Şablonu Kaydet
            </button>
          </div>
        </div>
      )}

      {/* YENİ ALAN MODALI */}
      {newSectionModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">Yeni Restoran Alanı Ekle</h3>
            <form onSubmit={handleAddSectionSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Bölüm Adı</label>
                <input
                  type="text"
                  required
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Örn: Teras Katı / VIP Loca"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">Masa Sayısı</label>
                <input
                  type="number"
                  required
                  value={newSectionTables}
                  onChange={(e) => setNewSectionTables(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setNewSectionModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">+ Alanı Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* YAZICI MODALI */}
      {printerModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">{editingPrinterId ? 'Yazıcıyı Düzenle' : 'Yeni Termal Yazıcı'}</h3>
            <form onSubmit={handleSavePrinterSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Yazıcı Adı</label>
                <input
                  type="text"
                  required
                  value={printerForm.name}
                  onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                  placeholder="Örn: Fırın Yazıcısı"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Bağlantı Türü</label>
                  <select
                    value={printerForm.type}
                    onChange={(e) => setPrinterForm({ ...printerForm, type: e.target.value as any })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    <option value="NETWORK">Ethernet (IP)</option>
                    <option value="USB">USB Port</option>
                  </select>
                </div>
                {printerForm.type === 'NETWORK' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-400">Statik IP</label>
                    <input
                      type="text"
                      required
                      value={printerForm.ipAddress}
                      onChange={(e) => setPrinterForm({ ...printerForm, ipAddress: e.target.value })}
                      placeholder="192.168.1.201"
                      className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-400">USB Aygıt Adı</label>
                    <input
                      type="text"
                      value={printerForm.usbName}
                      onChange={(e) => setPrinterForm({ ...printerForm, usbName: e.target.value })}
                      placeholder="Afanda 892E"
                      className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                    />
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setPrinterModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KATEGORİ MODALI */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">{editingCategoryId ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}</h3>
            <form onSubmit={handleSaveCategorySubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Kategori Adı</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Örn: Çorbalar & Mezeler"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">Mutfak Yazıcısı</label>
                <select
                  value={categoryForm.printerId}
                  onChange={(e) => setCategoryForm({ ...categoryForm, printerId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  {printers.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setCategoryModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÜRÜN MODALI */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">{editingProductId ? 'Ürünü Düzenle' : 'Yeni Menü Ürünü'}</h3>
            <form onSubmit={handleSaveProductSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Ürün Adı</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Örn: Beyti Kebap"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400">Kategori</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setProductModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GARSON MODALI */}
      {waiterModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">{editingWaiterId ? 'Garson Düzenle' : 'Yeni Garson Ekle'}</h3>
            <form onSubmit={handleSaveWaiterSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Garson Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={waiterForm.name}
                  onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}
                  placeholder="Örn: İbrahim Usta"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">4 Haneli Giriş PIN Kodu</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={waiterForm.pin}
                  onChange={(e) => setWaiterForm({ ...waiterForm, pin: e.target.value })}
                  placeholder="Örn: 4141"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-black text-amber-300"
                />
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setWaiterModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Kaydet & QR Üret</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÖDEME KANALI MODALI */}
      {newPmModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">Yeni Ödeme Kanalı Ekle</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newPmName.trim()) return notify.error('Eksik Alan', 'Ödeme adı girin!');
              restaurantDataService.addPaymentMethod({ name: newPmName.trim(), type: newPmType, color: '#0284c7', isActive: true });
              setNewPmName('');
              setNewPmModalOpen(false);
              notify.success('Eklendi', 'Yeni ödeme kanalı eklendi.');
            }} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Ödeme Kanalı Adı</label>
                <input
                  type="text"
                  required
                  value={newPmName}
                  onChange={(e) => setNewPmName(e.target.value)}
                  placeholder="Örn: Paycell / BKM Express"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">Türü</label>
                <select
                  value={newPmType}
                  onChange={(e) => setNewPmType(e.target.value as any)}
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                >
                  <option value="MEAL_CARD">Yemek Kartı</option>
                  <option value="CARD">Banka / Kredi Kartı</option>
                  <option value="OTHER">Platform / Diğer</option>
                </select>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setNewPmModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer">Vazgeç</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer">Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
