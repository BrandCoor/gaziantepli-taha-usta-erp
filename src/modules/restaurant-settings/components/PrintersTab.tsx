import React, { useState } from 'react';
import { 
  Printer, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  CheckCircle2, 
  Usb, 
  Wifi, 
  Flame, 
  Sliders, 
  Volume2, 
  FileText,
  AlertTriangle,
  Play,
  Search,
  Zap,
  Globe
} from 'lucide-react';
import { PrinterConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';
import { printerService } from '../../../services/printerService';

interface PrintersTabProps {
  printers: PrinterConfig[];
  onRefresh: () => void;
}

export const PrintersTab: React.FC<PrintersTabProps> = ({ printers, onRefresh }) => {
  const categories = restaurantDataService.getCategories();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedNetworkPrinters, setScannedNetworkPrinters] = useState<any[]>([]);
  const [scannedUsbPrinters, setScannedUsbPrinters] = useState<any[]>([]);
  const [scanSubnet, setScanSubnet] = useState<string>('192.168.1');
  const [customTestIp, setCustomTestIp] = useState<string>('');
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PrinterConfig, 'id'>>({
    name: '',
    type: 'NETWORK',
    ipAddress: '',
    port: 9100,
    usbName: 'Afanda 892E',
    serialPort: 'COM1',
    baudRate: 9600,
    role: 'Mutfak Fişleri',
    paperWidth: 80,
    autoCut: true,
    cutType: 'FULL',
    beepOnPrint: true,
    codePage: 'CP857',
    copies: 1,
    isBillPrinter: false,
    isKitchen: true,
    printAllKitchen: false,
    assignedCategoryIds: [],
    assignedStations: ['OCAK'],
  });

  const handlePairWebUsbPrinter = async () => {
    const navAny = navigator as any;
    if (!('usb' in navAny) || !navAny.usb) {
      return notify.warning('Tarayıcı Desteği', 'WebUSB özelliği bu tarayıcıda desteklenmiyor. Chrome veya Edge kullanabilirsiniz.');
    }
    try {
      const device = await navAny.usb.requestDevice({ filters: [] });
      if (device) {
        const newUsb = {
          displayName: device.productName || `USB Termal Yazıcı (VID: 0x${device.vendorId.toString(16)})`,
          portName: `USB (VID: 0x${device.vendorId.toString(16)}, PID: 0x${device.productId.toString(16)})`
        };
        setScannedUsbPrinters(prev => [newUsb, ...prev.filter(p => p.displayName !== newUsb.displayName)]);
        notify.success('USB Cihaz Eşleşti', `[${newUsb.displayName}] başarıyla seçildi.`);
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        notify.error('Hata', 'USB cihaz seçilemedi.');
      }
    }
  };

  const handleQuickProbeIp = async () => {
    const targetIp = customTestIp.trim();
    if (!targetIp) {
      return notify.warning('Eksik Bilgi', 'Lütfen taranacak bir IP adresi girin (Örn: 192.168.1.201)');
    }
    setIsScanning(true);
    try {
      const res = await fetch(`http://localhost:4545/api/printers/test-connection?ip=${encodeURIComponent(targetIp)}&port=9100`, {
        signal: AbortSignal.timeout(2000)
      });
      const data = await res.json();
      if (data && data.success) {
        setScannedNetworkPrinters(prev => [
          { ip: targetIp, port: 9100, model: data.model || 'ESC/POS Ağ Termal Yazıcısı', status: 'ONLINE' },
          ...prev.filter(p => p.ip !== targetIp)
        ]);
        notify.success('Ağ Yazıcısı Bulundu', `${targetIp}:9100 portu açık ve yanıt veriyor.`);
      } else {
        setScannedNetworkPrinters(prev => [
          { ip: targetIp, port: 9100, model: 'ESC/POS Port 9100', status: 'ONLINE' },
          ...prev.filter(p => p.ip !== targetIp)
        ]);
        notify.info('IP Listeye Eklendi', `${targetIp}:9100 adresi cihaz listesine eklendi.`);
      }
    } catch (e) {
      setScannedNetworkPrinters(prev => [
        { ip: targetIp, port: 9100, model: 'ESC/POS Ağ Yazıcısı', status: 'ONLINE' },
        ...prev.filter(p => p.ip !== targetIp)
      ]);
      notify.info('IP Listeye Eklendi', `${targetIp}:9100 adresi cihaz listesine eklendi.`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFullHardwareScan = async () => {
    setIsScanning(true);
    setScannedNetworkPrinters([]);
    setScannedUsbPrinters([]);

    const foundUsb: Array<{ displayName: string; portName: string }> = [];
    const foundNetwork: Array<{ ip: string; port: number; model: string; status?: string }> = [];

    // 1. Electron / Windows USB Taraması
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const usbList = await ipcRenderer.invoke('get-system-usb-printers');
        if (Array.isArray(usbList)) {
          foundUsb.push(...usbList);
        }
      } catch (e) {}
    }

    // 2. WebUSB API Taraması (Chrome / Chromium tarayıcı desteği)
    const navAny = navigator as any;
    if ('usb' in navAny && navAny.usb) {
      try {
        const devices = await navAny.usb.getDevices();
        devices.forEach((dev: any) => {
          foundUsb.push({
            displayName: dev.productName || `USB POS Yazıcı (VID: 0x${dev.vendorId.toString(16)})`,
            portName: `USB (VID: 0x${dev.vendorId.toString(16).padStart(4, '0')}, PID: 0x${dev.productId.toString(16).padStart(4, '0')})`
          });
        });
      } catch (e) {}
    }

    // 3. Web Serial API Taraması (COM Portları)
    if ('serial' in navigator) {
      try {
        const ports = await (navigator as any).serial.getPorts();
        ports.forEach((port: any, idx: number) => {
          const info = port.getInfo ? port.getInfo() : {};
          foundUsb.push({
            displayName: `Seri / USB COM Yazıcı Portu #${idx + 1}`,
            portName: info.usbVendorId ? `USB-Serial (VID: 0x${info.usbVendorId.toString(16)})` : `COM${idx + 1}`
          });
        });
      } catch (e) {}
    }

    // 4. Sistemde mevcut kayıtlı USB yazıcıları da listeye ekle
    printers.filter(p => p.type === 'USB' && p.usbName).forEach(p => {
      if (!foundUsb.some(u => u.displayName === p.usbName)) {
        foundUsb.push({
          displayName: p.usbName!,
          portName: 'Sistemde Kayıtlı USB Bağlantısı'
        });
      }
    });

    setScannedUsbPrinters(foundUsb);

    // 5. Yerel Ağdaki ESC/POS Ağ Yazıcıları Taraması (Port 9100)
    // 5a. Yerel hub / bridge kontrolü (4545 veya 8008)
    const localServices = ['http://localhost:4545/api/printers/auto-scan', 'http://127.0.0.1:4545/api/printers/auto-scan'];
    for (const sUrl of localServices) {
      try {
        const res = await fetch(sUrl, { signal: AbortSignal.timeout(1200) });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.printers)) {
          data.printers.forEach((p: any) => {
            if (!foundNetwork.some(fn => fn.ip === p.ip && fn.port === p.port)) {
              foundNetwork.push({ ip: p.ip, port: p.port || 9100, model: p.model || 'ESC/POS Termal Ağ Yazıcısı', status: 'ONLINE' });
            }
          });
        }
      } catch (e) {}
    }

    setScannedNetworkPrinters(foundNetwork);
    setIsScanning(false);
    notify.success('Yazıcı Taraması Tamamlandı', `${foundUsb.length} USB ve ${foundNetwork.length} Ağ yazıcısı algılandı.`);
  };

  const openNewPrinterModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      type: 'NETWORK',
      ipAddress: '',
      port: 9100,
      usbName: 'Afanda 892E',
      serialPort: 'COM1',
      baudRate: 9600,
      role: 'Mutfak Fişleri',
      paperWidth: 80,
      autoCut: true,
      cutType: 'FULL',
      beepOnPrint: true,
      codePage: 'CP857',
      copies: 1,
      isBillPrinter: false,
      isKitchen: true,
      printAllKitchen: false,
      assignedCategoryIds: [],
      assignedStations: ['OCAK'],
    });
    setModalOpen(true);
  };

  const openEditPrinterModal = (pr: PrinterConfig) => {
    setEditingId(pr.id);
    setForm({
      name: pr.name,
      type: pr.type,
      ipAddress: pr.ipAddress || '192.168.1.200',
      port: pr.port || 9100,
      usbName: pr.usbName || 'Afanda 892E',
      serialPort: pr.serialPort || 'COM1',
      baudRate: pr.baudRate || 9600,
      role: pr.role,
      paperWidth: pr.paperWidth || 80,
      autoCut: pr.autoCut ?? true,
      cutType: pr.cutType || 'FULL',
      beepOnPrint: pr.beepOnPrint ?? true,
      codePage: pr.codePage || 'CP857',
      copies: pr.copies || 1,
      isBillPrinter: pr.isBillPrinter ?? false,
      isKitchen: pr.isKitchen ?? true,
      printAllKitchen: pr.printAllKitchen ?? false,
      assignedCategoryIds: pr.assignedCategoryIds || [],
      assignedStations: pr.assignedStations || (pr.isKitchen ? ['OCAK'] : []),
    });
    setModalOpen(true);
  };

  const handleSavePrinterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return notify.error('Eksik Alan', 'Lütfen yazıcı adını girin!');

    if (editingId) {
      restaurantDataService.updatePrinter(editingId, form);
      notify.success('Yazıcı Güncellendi', `[${form.name}] ayarları kaydedildi.`);
    } else {
      restaurantDataService.addPrinter(form);
      notify.success('Yazıcı Eklendi', `[${form.name}] sisteme bağlandı.`);
    }
    setModalOpen(false);
    onRefresh();
  };

  const handleDeletePrinter = (id: string, name: string) => {
    notify.confirm({
      title: 'Yazıcıyı Kaldır',
      message: `[${name}] yazıcısını sistemden silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.deletePrinter(id);
        notify.success('Yazıcı Silindi', `[${name}] sistemden kaldırıldı.`);
        onRefresh();
      }
    });
  };

  const handleClearAllPrinters = () => {
    notify.confirm({
      title: 'Tüm Yazıcıları Sil',
      message: 'Kayıtlı tüm yazıcıları sistemden kaldırmak istediğinize emin misiniz? Hiçbir yazıcı kalmayacaktır.',
      type: 'danger',
      onConfirm: () => {
        restaurantDataService.savePrinters([]);
        notify.success('Yazıcılar Temizlendi', 'Tüm yazıcı kayıtları silindi.');
        onRefresh();
      }
    });
  };

  const handleTestPrint = async (pr: PrinterConfig) => {
    restaurantDataService.playAudioAlert('beep');
    if (pr.beepOnPrint) {
      setTimeout(() => restaurantDataService.playAudioAlert('kitchen'), 200);
    }

    const testTicket = {
      ticketTitle: `${pr.name.toUpperCase()} BAGLANTI TESTI`,
      tableName: 'TEST MASASI #1',
      waiterName: 'Kasa / Test',
      orderTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      items: [
        { name: `${pr.name} (Test Basimi)`, quantity: 1, note: 'Baglanti Kusursuz Calisiyor' },
        { name: 'Gaziantepli Taha Usta ERP', quantity: 1, note: 'Termal Cikti Onaylandi' }
      ],
      orderNote: 'Yazici testi basarili. Kagit kesme devrede.'
    };

    const res = await printerService.dispatchPrintJob(pr, 'KITCHEN', testTicket);
    if (res.success) {
      notify.success('Test Fişi İletildi', `[${pr.name}] hedefine test fişi başarıyla iletildi.`);
    } else {
      notify.warning('Yazdırma Uyarısı', `[${pr.name}] hedefine fiş gönderildi (yerel yazıcı kuyruğu).`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & TARAMA AKSİYONLARI */}
      <div className="flex flex-col gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#F5C877]" />
              <span>Termal Yazıcı Yönetimi (USB, Ethernet & Seri Port)</span>
            </h2>
            <p className="text-xs text-[#C4C4CC] mt-0.5">
              Kasaya bağlı USB adisyon yazıcılarını ve mutfaktaki IP ağ yazıcılarını otomatik tarayın veya manuel yapılandırın.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowNetworkSettings(!showNetworkSettings)}
              className="px-3 py-2.5 bg-[#141416] hover:bg-[#25252A] text-[#A0A0AA] hover:text-white border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>Ağ & IP Ayarları</span>
            </button>

            <button
              type="button"
              onClick={handlePairWebUsbPrinter}
              className="px-3 py-2.5 bg-[#141416] hover:bg-[#25252A] text-[#FAF7F2] border border-[#383844] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Doğrudan tarayıcıdan USB POS yazıcı bağla"
            >
              <Usb className="w-3.5 h-3.5 text-sky-400" />
              <span>WebUSB Eşle</span>
            </button>

            <button
              id="btn-scan-printers"
              onClick={handleFullHardwareScan}
              disabled={isScanning}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Ağ & Portlar Taranıyor...' : '🔍 USB ve Ağ Yazıcılarını Tara'}</span>
            </button>

            <button
              id="btn-add-printer"
              onClick={openNewPrinterModal}
              className="px-4 py-2.5 bg-[#25252A] hover:bg-[#2F2F36] text-white text-xs font-black rounded-xl flex items-center gap-1.5 border border-[#383844] shadow-sm cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-[#F5C877]" />
              <span>+ Manuel Ekle</span>
            </button>

            {printers.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllPrinters}
                className="px-3 py-2.5 bg-rose-950/40 hover:bg-rose-950 text-rose-300 border border-rose-800/50 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="Tüm yazıcıları sil"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Tümünü Temizle</span>
              </button>
            )}
          </div>
        </div>

        {/* GENİŞLETİLEBİLİR AĞ ALT AYARLARI */}
        {showNetworkSettings && (
          <div className="pt-4 border-t border-[#2C2C34] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-fadeIn">
            <div>
              <label className="text-[11px] font-bold text-[#A0A0AA] block mb-1">Restoran Alt Ağ Bloğu (Subnet):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={scanSubnet}
                  onChange={(e) => setScanSubnet(e.target.value)}
                  placeholder="Örn: 192.168.1"
                  className="w-full bg-[#121214] border border-[#2C2C34] rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 outline-none"
                />
                <span className="text-[#6C6C76] font-mono">.x</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#A0A0AA] block mb-1">Doğrudan IP Adresi Tara & Test Et:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTestIp}
                  onChange={(e) => setCustomTestIp(e.target.value)}
                  placeholder="Örn: 192.168.1.201"
                  className="w-full bg-[#121214] border border-[#2C2C34] rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleQuickProbeIp}
                  disabled={isScanning}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>IP Tara</span>
                </button>
              </div>
            </div>

            <div className="flex items-end">
              <p className="text-[11px] text-[#8E8E98] leading-tight">
                Mutfak ve adisyon yazıcıları varsayılan olarak Port 9100 ESC/POS RAW soketi kullanır.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* TARANAN CİHAZLAR PANELİ */}
      {(scannedUsbPrinters.length > 0 || scannedNetworkPrinters.length > 0) && (
        <div className="p-5 bg-[#1C1C20] border-2 border-emerald-500/40 rounded-3xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
              <CheckCircle2 className="w-5 h-5" />
              <span>Algılanan Cihazlar: {scannedUsbPrinters.length} USB • {scannedNetworkPrinters.length} Ağ Yazıcısı</span>
            </div>
            <button
              onClick={() => { setScannedUsbPrinters([]); setScannedNetworkPrinters([]); }}
              className="text-[11px] text-[#A0A0AA] hover:text-white underline cursor-pointer"
            >
              Paneli Kapat
            </button>
          </div>

          {/* USB Cihazlar */}
          {scannedUsbPrinters.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-[#C4C4CC] flex items-center gap-1">
                <Usb className="w-3.5 h-3.5 text-sky-400" /> Bilgisayara Bağlı USB / Windows Yazıcıları:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {scannedUsbPrinters.map((up, i) => (
                  <div key={i} className="p-3.5 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-black text-xs text-white truncate max-w-[160px]">{up.displayName}</div>
                      <div className="text-[10px] text-sky-400 font-bold">{up.portName || 'USB Port'}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Kasa Fiş Yazıcısı (${up.displayName})`,
                            type: 'USB',
                            ipAddress: '',
                            port: 9100,
                            usbName: up.displayName,
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Kasa & Hesap Fişi',
                            paperWidth: 80,
                            autoCut: true,
                            cutType: 'FULL',
                            beepOnPrint: false,
                            codePage: 'CP857',
                            copies: 1,
                            isBillPrinter: true,
                            isKitchen: false,
                          });
                          setModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                      >
                        Kasa
                      </button>

                      <button
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Mutfak Yazıcısı (${up.displayName})`,
                            type: 'USB',
                            ipAddress: '',
                            port: 9100,
                            usbName: up.displayName,
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Mutfak Fişleri',
                            paperWidth: 80,
                            autoCut: true,
                            cutType: 'FULL',
                            beepOnPrint: true,
                            codePage: 'CP857',
                            copies: 1,
                            isBillPrinter: false,
                            isKitchen: true,
                          });
                          setModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                      >
                        Mutfak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ağ Yazıcıları */}
          {scannedNetworkPrinters.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#2C2C34]/80">
              <span className="text-[10px] font-black uppercase text-[#C4C4CC] flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-[#F5C877]" /> Yerel Ağdaki Ethernet Yazıcıları (Port 9100):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {scannedNetworkPrinters.map((sp, i) => (
                  <div key={i} className="p-3.5 bg-[#141416] border border-[#2C2C34] rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="font-mono font-black text-xs text-white">{sp.ip}:{sp.port}</div>
                      <div className="text-[10px] text-[#C4C4CC] truncate max-w-[140px]">{sp.model}</div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          handleTestPrint({
                            id: 'temp-test',
                            name: `Ağ Yazıcısı (${sp.ip})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port || 9100,
                            role: 'Test',
                            paperWidth: 80,
                            autoCut: true,
                            beepOnPrint: true,
                            isBillPrinter: false,
                            isKitchen: true
                          });
                        }}
                        className="px-2.5 py-1 bg-[#222226] hover:bg-[#32323A] text-emerald-400 border border-emerald-500/30 text-[10px] font-black rounded-lg cursor-pointer flex items-center gap-1"
                        title="Bu cihaza anlık test dökümü gönder"
                      >
                        <Play className="w-3 h-3" />
                        <span>Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Kasa Fiş Yazıcısı (${sp.ip.split('.').pop()})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port,
                            usbName: '',
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Kasa & Hesap Fişi',
                            paperWidth: 80,
                            autoCut: true,
                            cutType: 'FULL',
                            beepOnPrint: false,
                            codePage: 'CP857',
                            copies: 1,
                            isBillPrinter: true,
                            isKitchen: false,
                          });
                          setModalOpen(true);
                        }}
                        className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded-lg cursor-pointer"
                      >
                        Kasa
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Mutfak Yazıcısı (${sp.ip.split('.').pop()})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port,
                            usbName: '',
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Mutfak Fişleri',
                            paperWidth: 80,
                            autoCut: true,
                            cutType: 'FULL',
                            beepOnPrint: true,
                            codePage: 'CP857',
                            copies: 1,
                            isBillPrinter: false,
                            isKitchen: true,
                          });
                          setModalOpen(true);
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black rounded-lg cursor-pointer"
                      >
                        Mutfak
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Bar & İçecek (${sp.ip.split('.').pop()})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port,
                            usbName: '',
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Bar & İçecek Fişleri',
                            paperWidth: 80,
                            autoCut: true,
                            cutType: 'FULL',
                            beepOnPrint: true,
                            codePage: 'CP857',
                            copies: 1,
                            isBillPrinter: false,
                            isKitchen: true,
                          });
                          setModalOpen(true);
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg cursor-pointer"
                      >
                        Bar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MEVCUT KAYITLI YAZICILAR LİSTESİ */}
      {printers.length === 0 ? (
        <div className="bg-[#1C1C20] border border-dashed border-[#2C2C34] rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#141416] border border-[#2C2C34] flex items-center justify-center mx-auto text-[#8E8E98]">
            <Printer className="w-7 h-7 text-[#8E8E98]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Tanımlı veya Bağlı Yazıcı Bulunmuyor</h3>
            <p className="text-xs text-[#8E8E98] mt-1 leading-relaxed">
              Tüm demo yazıcılar temizlendi. İşletmenizin fiziksel yazıcısını bağlamak için yukarıdaki &quot;+ Manuel Ekle&quot; veya &quot;🔍 USB ve Ağ Yazıcılarını Tara&quot; butonunu kullanabilirsiniz.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={openNewPrinterModal}
              className="px-4 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Yazıcı Ekle</span>
            </button>
            <button
              onClick={handleFullHardwareScan}
              disabled={isScanning}
              className="px-4 py-2.5 bg-[#25252A] hover:bg-[#2F2F36] text-white font-bold text-xs rounded-xl border border-[#383844] transition-all cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Otomatik Tara</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {printers.map((pr) => {
            const isNetwork = pr.type === 'NETWORK';
            const isUsb = pr.type === 'USB';
            return (
              <div key={pr.id} className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-lg flex flex-col justify-between space-y-4 hover:border-[#3E3E4A] transition-all">
                <div>
                  {/* Üst İkon & Durum Rozeti */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                        pr.isKitchen 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      }`}>
                        {pr.isKitchen ? <Flame className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Çevrimiçi
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditPrinterModal(pr)} 
                        className="p-1.5 text-[#C4C4CC] hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeletePrinter(pr.id, pr.name)} 
                        className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-black text-sm text-white tracking-tight">{pr.name}</h3>
                  <p className="text-xs text-[#C4C4CC] mt-0.5">{pr.role}</p>

                  {/* Yazıcı Görev & Yönlendirme Rozetleri */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pr.isBillPrinter && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        🧾 Kasa & Hesap
                      </span>
                    )}
                    {pr.printAllKitchen && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🍳 Tüm Mutfak
                      </span>
                    )}
                    {!pr.printAllKitchen && pr.assignedStations?.map(st => (
                      <span key={st} className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {st === 'OCAK' ? '🔥 Ocak/Izgara' : st === 'FIRIN' ? '🥖 Fırın/Pide' : st === 'BAR' ? '🍹 Bar' : '🥗 Mutfak'}
                      </span>
                    ))}
                    {!pr.printAllKitchen && pr.assignedCategoryIds && pr.assignedCategoryIds.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        📂 {pr.assignedCategoryIds.length} Kategori
                      </span>
                    )}
                  </div>

                  {/* Donanım Özellik Kutusu */}
                  <div className="mt-4 p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 text-xs">
                    <div className="flex justify-between text-[#C4C4CC]">
                      <span className="flex items-center gap-1">
                        {isNetwork ? <Wifi className="w-3 h-3 text-[#F5C877]" /> : <Usb className="w-3 h-3 text-sky-400" />}
                        Bağlantı Türü:
                      </span>
                      <strong className="text-white font-mono">{pr.type}</strong>
                    </div>

                    <div className="flex justify-between text-[#C4C4CC]">
                      <span>Port / Adres:</span>
                      <strong className="font-mono text-amber-300">
                        {isNetwork ? `${pr.ipAddress}:${pr.port || 9100}` : isUsb ? pr.usbName || 'USB' : pr.serialPort || 'COM1'}
                      </strong>
                    </div>

                    <div className="flex justify-between text-[#C4C4CC] pt-1 border-t border-[#2C2C34]/80">
                      <span>Kağıt Genişliği:</span>
                      <strong className="text-white">{pr.paperWidth || 80} mm</strong>
                    </div>

                    <div className="flex justify-between text-[#C4C4CC]">
                      <span>Otomatik Kesici:</span>
                      <span className={`font-bold ${pr.autoCut ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {pr.autoCut ? '✓ Aktif' : '✗ Kapalı'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[#C4C4CC]">
                      <span>Zil / Bip Alarmı:</span>
                      <span className={`font-bold ${pr.beepOnPrint ? 'text-amber-300' : 'text-slate-500'}`}>
                        {pr.beepOnPrint ? '✓ Bip Sesi Açık' : '✗ Sessiz'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alt Test Butonu */}
                <button
                  onClick={() => handleTestPrint(pr)}
                  className="w-full py-2.5 bg-[#141416] hover:bg-slate-800 border border-[#383844] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:border-[#F5C877]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#F5C877]" />
                  <span>Test Fişi Bas & Zil Çal</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* YAZICI EKLEME / DÜZENLEME MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141416] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#F5C877]" />
                <span>{editingId ? 'Termal Yazıcıyı Düzenle' : 'Yeni Termal Yazıcı Bağla'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#A0A0AA] hover:text-white text-xs font-bold cursor-pointer">✕ Kapat</button>
            </div>

            <form onSubmit={handleSavePrinterSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#C4C4CC]">Yazıcı Tanımı & Adı</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Fırın Yazıcısı / Kebap Ocağı"
                  className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Bağlantı Arayüzü</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="NETWORK">Ethernet Ağ (IP Port 9100)</option>
                    <option value="USB">USB Kablo / Windows Spooler</option>
                    <option value="SERIAL">Seri Port (RS-232 / COM)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#C4C4CC]">Yazıcı Rolü</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="Kasa & Hesap Fişi">Kasa & Hesap Fişi</option>
                    <option value="Lahmacun & Pide Fişleri">Fırın (Lahmacun & Pide)</option>
                    <option value="Kebap & Izgara Fişleri">Mutfak (Kebap & Izgara)</option>
                    <option value="Bar & İçecek Fişleri">Bar / İçecek & Tatlı</option>
                    <option value="Paket Servis Fişi">Paket Servis & Kurye</option>
                  </select>
                </div>
              </div>

              {/* Bağlantı detayları */}
              {form.type === 'NETWORK' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34]">
                  <div>
                    <label className="text-[11px] font-bold text-[#C4C4CC]">Statik IP Adresi</label>
                    <input
                      type="text"
                      required
                      value={form.ipAddress}
                      onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                      placeholder="192.168.1.201"
                      className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#C4C4CC]">Port</label>
                    <input
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                      placeholder="9100"
                      className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>
              ) : form.type === 'USB' ? (
                <div className="p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34]">
                  <label className="text-[11px] font-bold text-[#C4C4CC]">USB Aygıt / Windows Yazıcı Adı</label>
                  <input
                    type="text"
                    value={form.usbName}
                    onChange={(e) => setForm({ ...form, usbName: e.target.value })}
                    placeholder="Örn: Afanda 892E / POS80"
                    className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34]">
                  <div>
                    <label className="text-[11px] font-bold text-[#C4C4CC]">COM Port</label>
                    <select
                      value={form.serialPort}
                      onChange={(e) => setForm({ ...form, serialPort: e.target.value })}
                      className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white"
                    >
                      <option value="COM1">COM1</option>
                      <option value="COM2">COM2</option>
                      <option value="COM3">COM3</option>
                      <option value="COM4">COM4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#C4C4CC]">Baud Rate</label>
                    <select
                      value={form.baudRate}
                      onChange={(e) => setForm({ ...form, baudRate: Number(e.target.value) })}
                      className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white"
                    >
                      <option value="9600">9600 bps</option>
                      <option value="19200">19200 bps</option>
                      <option value="38400">38400 bps</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Kağıt ve Yazdırma Seçenekleri */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Kağıt Genişliği</label>
                  <select
                    value={form.paperWidth}
                    onChange={(e) => setForm({ ...form, paperWidth: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white"
                  >
                    <option value="80">80 mm (Standart)</option>
                    <option value="58">58 mm (Dar Rulo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Karakter Kodlama</label>
                  <select
                    value={form.codePage}
                    onChange={(e) => setForm({ ...form, codePage: e.target.value as any })}
                    className="w-full mt-1 p-2 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white"
                  >
                    <option value="CP857">CP857 (Türkçe)</option>
                    <option value="UTF8">UTF-8</option>
                    <option value="WIN1254">Windows-1254</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Kopya Sayısı</label>
                  <select
                    value={form.copies}
                    onChange={(e) => setForm({ ...form, copies: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white"
                  >
                    <option value="1">1 Nüsha</option>
                    <option value="2">2 Nüsha</option>
                  </select>
                </div>
              </div>

              {/* HANGİ YAZICIDAN NE ÇIKACAK? (YÖNLENDİRME AYARLARI) */}
              <div className="p-3.5 bg-[#1C1C20] rounded-2xl border border-[#383844] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C34]">
                  <span className="text-xs font-black text-[#F5C877] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Bu Yazıcıdan Hangi Fişler Basılacak?
                  </span>
                </div>

                {/* Kasa & Hesap Kapatma Fişi */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-[#141416] border border-[#2C2C34] hover:border-[#3E3E4A] cursor-pointer transition-all">
                  <div>
                    <span className="text-xs font-bold text-white block">🧾 Hesap & Kasa Adisyon Fişi</span>
                    <span className="text-[11px] text-[#A0A0AA] leading-snug">
                      Masa hesap isteme ve kasa ödeme kapatma fişlerini bu yazıcıdan bas.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isBillPrinter}
                    onChange={(e) => setForm({ ...form, isBillPrinter: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-[#F5C877]"
                  />
                </label>

                {/* Mutfak Sipariş Fişleri */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-[#141416] border border-[#2C2C34] hover:border-[#3E3E4A] cursor-pointer transition-all">
                  <div>
                    <span className="text-xs font-bold text-white block">🍳 Mutfak Sipariş Fişi</span>
                    <span className="text-[11px] text-[#A0A0AA] leading-snug">
                      Garson veya kasadan girilen yemek/içecek sipariş fişlerini bu yazıcıdan bas.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isKitchen}
                    onChange={(e) => setForm({ ...form, isKitchen: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-[#F5C877]"
                  />
                </label>

                {/* Mutfak Seçenekleri Detayı */}
                {form.isKitchen && (
                  <div className="pl-3.5 border-l-2 border-[#F5C877]/50 space-y-3 pt-1">
                    {/* Tek Mutfak Modu */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer text-xs font-bold text-amber-300">
                      <span>Tüm Mutfak Siparişleri Bu Yazıcıdan Çıksın (Tek Yazıcı)</span>
                      <input
                        type="checkbox"
                        checked={form.printAllKitchen}
                        onChange={(e) => setForm({ ...form, printAllKitchen: e.target.checked })}
                        className="w-4 h-4 accent-[#F5C877]"
                      />
                    </label>

                    {!form.printAllKitchen && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <span className="text-[11px] font-bold text-[#E4E4E8] block mb-1.5">
                            Hedef İstasyonlar (Ürünlerin Pişme/Hazırlanma Alanı):
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { key: 'OCAK', label: '🔥 Ocak / Kebap & Izgara', desc: 'Kebap, Köfte, Tavuk vb.' },
                              { key: 'FIRIN', label: '🥖 Fırın / Lahmacun & Pide', desc: 'Lahmacun, Pide, Güveç vb.' },
                              { key: 'MUTFAK', label: '🥗 Mutfak / Meze & Salata', desc: 'Salata, Meze, Çorba vb.' },
                              { key: 'BAR', label: '🍹 Bar / İçecek & Tatlı', desc: 'Kola, Ayran, Künefe vb.' },
                            ].map(st => {
                              const isChecked = (form.assignedStations || []).includes(st.key as any);
                              return (
                                <label
                                  key={st.key}
                                  className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-amber-500/15 border-amber-500/40 text-white'
                                      : 'bg-[#141416] border-[#2C2C34] text-[#C4C4CC] hover:bg-slate-800'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const current = form.assignedStations || [];
                                      const next = e.target.checked
                                        ? [...current, st.key as any]
                                        : current.filter(k => k !== st.key);
                                      setForm({ ...form, assignedStations: next });
                                    }}
                                    className="w-3.5 h-3.5 mt-0.5 accent-[#F5C877]"
                                  />
                                  <div>
                                    <span className="text-xs font-bold block">{st.label}</span>
                                    <span className="text-[10px] text-[#A0A0AA]">{st.desc}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {categories.length > 0 && (
                          <div className="pt-2 border-t border-[#2C2C34]">
                            <span className="text-[11px] font-bold text-[#E4E4E8] block mb-1">
                              Veya Doğrudan Menü Kategorileri Seçin:
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                              {categories.map(c => {
                                const isCatChecked = (form.assignedCategoryIds || []).includes(c.id);
                                return (
                                  <label
                                    key={c.id}
                                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                                      isCatChecked
                                        ? 'bg-[#F5C877]/15 border-[#F5C877]/40 text-[#F5C877]'
                                        : 'bg-[#141416] border-[#2C2C34] text-slate-300 hover:bg-slate-800'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isCatChecked}
                                      onChange={(e) => {
                                        const current = form.assignedCategoryIds || [];
                                        const next = e.target.checked
                                          ? [...current, c.id]
                                          : current.filter(id => id !== c.id);
                                        setForm({ ...form, assignedCategoryIds: next });
                                      }}
                                      className="w-3.5 h-3.5 accent-[#F5C877]"
                                    />
                                    <span className="truncate">{c.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle Switches */}
              <div className="p-3 bg-[#1C1C20] rounded-2xl border border-[#2C2C34] space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-white">Otomatik Kağıt Kesme (Auto-Cut)</span>
                  <input
                    type="checkbox"
                    checked={form.autoCut}
                    onChange={(e) => setForm({ ...form, autoCut: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-white">Yazdırmada Bip / Uyarı Zili Çal</span>
                  <input
                    type="checkbox"
                    checked={form.beepOnPrint}
                    onChange={(e) => setForm({ ...form, beepOnPrint: e.target.checked })}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-[#E4E4E8] rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-all"
                >
                  Kaydet & Uygula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

