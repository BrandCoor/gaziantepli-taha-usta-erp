import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Cpu, 
  FileText, 
  Grid, 
  Tag, 
  UtensilsCrossed, 
  Smartphone, 
  Wallet, 
  HardDrive,
  DollarSign,
  Bell,
  Download,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  restaurantDataService, 
  PrinterConfig, 
  SectionConfig, 
  CategoryConfig, 
  ProductConfig, 
  WaiterConfig, 
  PaymentMethodConfig, 
  ReceiptSettingsConfig,
  HardwareSettingsConfig
} from '../../services/restaurantDataService';
import { notify } from '../../services/notificationService';

// Sub-components
import { PrintersTab } from './components/PrintersTab';
import { HardwarePeripheralsTab } from './components/HardwarePeripheralsTab';
import { ReceiptTemplateTab } from './components/ReceiptTemplateTab';
import { SectionsTablesTab } from './components/SectionsTablesTab';
import { CategoriesTab } from './components/CategoriesTab';
import { ProductsTab } from './components/ProductsTab';
import { PaymentsTab } from './components/PaymentsTab';
import { SystemBackupTab } from './components/SystemBackupTab';

type SettingsSubTab = 
  | 'PRINTERS' 
  | 'HARDWARE' 
  | 'RECEIPT' 
  | 'SECTIONS' 
  | 'CATEGORIES' 
  | 'PRODUCTS' 
  | 'PAYMENTS' 
  | 'BACKUP';

export const RestaurantSettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('PRINTERS');

  // Core Data
  const [printers, setPrinters] = useState<PrinterConfig[]>(restaurantDataService.getPrinters());
  const [sections, setSections] = useState<SectionConfig[]>(restaurantDataService.getSections());
  const [categories, setCategories] = useState<CategoryConfig[]>(restaurantDataService.getCategories());
  const [products, setProducts] = useState<ProductConfig[]>(restaurantDataService.getProducts());
  const [waiters, setWaiters] = useState<WaiterConfig[]>(restaurantDataService.getWaiters());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(restaurantDataService.getPaymentMethods());
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsConfig>(restaurantDataService.getReceiptSettings());
  const [hardwareSettings, setHardwareSettings] = useState<HardwareSettingsConfig>(restaurantDataService.getHardwareSettings());

  const refreshAllData = () => {
    setPrinters(restaurantDataService.getPrinters());
    setSections(restaurantDataService.getSections());
    setCategories(restaurantDataService.getCategories());
    setProducts(restaurantDataService.getProducts());
    setWaiters(restaurantDataService.getWaiters());
    setPaymentMethods(restaurantDataService.getPaymentMethods());
    setReceiptSettings(restaurantDataService.getReceiptSettings());
    setHardwareSettings(restaurantDataService.getHardwareSettings());
  };

  useEffect(() => {
    const unsub = restaurantDataService.subscribe(refreshAllData);
    return () => unsub();
  }, []);

  // Quick Hardware Actions
  const handleQuickDrawerOpen = async () => {
    const res = await restaurantDataService.openCashDrawer();
    if (res.success) {
      notify.success('Çekmece Açıldı', res.message);
    } else {
      notify.warning('Uyarı', res.message);
    }
  };

  const handleQuickChime = () => {
    restaurantDataService.playAudioAlert('kitchen');
    notify.info('Ses Testi', 'Mutfak çağrı çanı (Ding-Dong) çalındı.');
  };

  const handleQuickBackup = () => {
    const jsonStr = restaurantDataService.exportRestaurantBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `taha_usta_pos_yedek_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.success('Yedek İndirildi', 'Restoran yapılandırması JSON olarak kaydedildi.');
  };

  const handleHardwareSave = (updated: HardwareSettingsConfig) => {
    restaurantDataService.saveHardwareSettings(updated);
    setHardwareSettings(updated);
  };

  const handleReceiptSave = (updated: ReceiptSettingsConfig) => {
    restaurantDataService.saveReceiptSettings(updated);
    setReceiptSettings(updated);
  };

  const tabsConfig: { id: SettingsSubTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'PRINTERS', label: 'Termal Yazıcılar', icon: <Printer className="w-4 h-4" />, badge: printers.length },
    { id: 'HARDWARE', label: 'Donanım & Çevre Birimleri', icon: <Cpu className="w-4 h-4" />, badge: 'Yeni' },
    { id: 'RECEIPT', label: 'Fiş & Adisyon Şablonu', icon: <FileText className="w-4 h-4" /> },
    { id: 'SECTIONS', label: 'Salon & Masalar', icon: <Grid className="w-4 h-4" />, badge: sections.length },
    { id: 'CATEGORIES', label: 'Kategoriler & Mutfak', icon: <Tag className="w-4 h-4" />, badge: categories.length },
    { id: 'PRODUCTS', label: 'Menü & Ürünler', icon: <UtensilsCrossed className="w-4 h-4" />, badge: products.length },
    { id: 'PAYMENTS', label: 'Ödeme Yöntemleri', icon: <Wallet className="w-4 h-4" /> },
    { id: 'BACKUP', label: 'Bulut & Yedekleme', icon: <HardDrive className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1550px] mx-auto min-h-screen">
      
      {/* BAŞLIK & HIZLI DONANIM AKSİYON BARI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2C2C34] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Restoran & Donanım Yapılandırma Merkezi
            </h1>
          </div>
          <p className="text-xs text-[#C4C4CC] mt-1">
            Gaziantepli Taha Usta • Termal yazıcılar, para çekmecesi, terazi, müşteri ekranı, salon yerleşimi ve fiş tasarımı.
          </p>
        </div>

        {/* Hızlı Test & Donanım Kontrol Butonları */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-quick-chime-test"
            onClick={handleQuickChime}
            className="px-3.5 py-2 bg-[#1C1C20] hover:bg-slate-800 text-[#C4C4CC] hover:text-white border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            title="Mutfak zili çal"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Zil Sesi Testi</span>
          </button>

          <button
            id="btn-quick-drawer-open"
            onClick={handleQuickDrawerOpen}
            className="px-3.5 py-2 bg-[#1C1C20] hover:bg-slate-800 text-[#C4C4CC] hover:text-white border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            title="Para çekmecesine darbe gönder"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Çekmeceyi Aç</span>
          </button>

          <button
            id="btn-quick-backup"
            onClick={handleQuickBackup}
            className="px-3.5 py-2 bg-[#1C1C20] hover:bg-slate-800 text-[#C4C4CC] hover:text-white border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            title="Yapılandırmayı JSON olarak indir"
          >
            <Download className="w-3.5 h-3.5 text-[#F5C877]" />
            <span>Hızlı Yedek Al</span>
          </button>
        </div>
      </div>

      {/* YATAY SEKMELER (NAV TABS) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tabsConfig.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all shrink-0 select-none ${
                isActive 
                  ? 'bg-[#F5C877] text-slate-950 shadow-lg shadow-[#F5C877]/10' 
                  : 'bg-[#1C1C20] text-[#C4C4CC] hover:text-white hover:bg-slate-800 border border-[#2C2C34]'
              }`}
            >
              <span className={isActive ? 'text-slate-950' : 'text-[#A0A0AA]'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                  isActive 
                    ? 'bg-slate-950 text-amber-300' 
                    : 'bg-[#141416] text-[#C4C4CC] border border-[#2C2C34]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* AKTİF SEKME İÇERİĞİ */}
      <div className="pt-2 animate-fadeIn">
        {activeSubTab === 'PRINTERS' && (
          <PrintersTab 
            printers={printers} 
            onRefresh={refreshAllData} 
          />
        )}

        {activeSubTab === 'HARDWARE' && (
          <HardwarePeripheralsTab 
            hardware={hardwareSettings} 
            printers={printers} 
            onSave={handleHardwareSave} 
          />
        )}

        {activeSubTab === 'RECEIPT' && (
          <ReceiptTemplateTab 
            settings={receiptSettings} 
            onSave={handleReceiptSave} 
          />
        )}

        {activeSubTab === 'SECTIONS' && (
          <SectionsTablesTab 
            sections={sections} 
            onRefresh={refreshAllData} 
          />
        )}

        {activeSubTab === 'CATEGORIES' && (
          <CategoriesTab 
            categories={categories} 
            printers={printers} 
            products={products} 
            onRefresh={refreshAllData} 
          />
        )}

        {activeSubTab === 'PRODUCTS' && (
          <ProductsTab 
            products={products} 
            categories={categories} 
            printers={printers} 
            onRefresh={refreshAllData} 
          />
        )}

        {activeSubTab === 'PAYMENTS' && (
          <PaymentsTab 
            paymentMethods={paymentMethods} 
            onRefresh={refreshAllData} 
          />
        )}

        {activeSubTab === 'BACKUP' && (
          <SystemBackupTab 
            onRefresh={refreshAllData} 
          />
        )}
      </div>

    </div>
  );
};
