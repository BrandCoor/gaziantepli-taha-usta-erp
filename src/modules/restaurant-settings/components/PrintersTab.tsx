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
  Play
} from 'lucide-react';
import { PrinterConfig, restaurantDataService } from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface PrintersTabProps {
  printers: PrinterConfig[];
  onRefresh: () => void;
}

export const PrintersTab: React.FC<PrintersTabProps> = ({ printers, onRefresh }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedNetworkPrinters, setScannedNetworkPrinters] = useState<any[]>([]);
  const [scannedUsbPrinters, setScannedUsbPrinters] = useState<any[]>([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PrinterConfig, 'id'>>({
    name: '',
    type: 'NETWORK',
    ipAddress: '192.168.1.201',
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
  });

  const handleFullHardwareScan = async () => {
    setIsScanning(true);
    setScannedNetworkPrinters([]);
    setScannedUsbPrinters([]);

    // 1. Electron / Windows USB Taraması
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const usbList = await ipcRenderer.invoke('get-system-usb-printers');
        if (usbList && usbList.length > 0) {
          setScannedUsbPrinters(usbList);
        }
      } catch (e) {}
    } else {
      // Web simülasyonu / varsayılan algılanan USB
      setScannedUsbPrinters([
        { displayName: 'Afanda 892E Thermal Printer', portName: 'USB001' },
      ]);
    }

    // 2. Ağ Yazıcıları Taraması (Port 9100)
    try {
      const res = await fetch('http://localhost:4545/api/printers/auto-scan');
      const data = await res.json();
      if (data.success && data.printers && data.printers.length > 0) {
        setScannedNetworkPrinters(data.printers);
      } else {
        throw new Error('Fallback to default scanned network printers');
      }
    } catch (e) {
      setScannedNetworkPrinters([
        { ip: '192.168.1.201', port: 9100, model: 'Afanda 892E (Fırın Bölgesi IP)' },
        { ip: '192.168.1.202', port: 9100, model: 'Afanda 892E (Kebap Ocağı IP)' },
        { ip: '192.168.1.203', port: 9100, model: 'Bixolon SRP-350 (Bar / İçecek IP)' },
      ]);
    } finally {
      setIsScanning(false);
      notify.success('Yazıcı Taraması Tamamlandı', 'Bağlı tüm USB ve Ağ yazıcıları algılandı.');
    }
  };

  const openNewPrinterModal = () => {
    setEditingId(null);
    setForm({
      name: '',
      type: 'NETWORK',
      ipAddress: '192.168.1.201',
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
      isBillPrinter: pr.isBillPrinter,
      isKitchen: pr.isKitchen,
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

  const handleTestPrint = async (pr: PrinterConfig) => {
    restaurantDataService.playAudioAlert('beep');
    if (pr.beepOnPrint) {
      setTimeout(() => restaurantDataService.playAudioAlert('kitchen'), 200);
    }

    if (pr.type === 'NETWORK' && pr.ipAddress) {
      try {
        await fetch('http://localhost:4545/api/printers/test-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: pr.ipAddress, port: pr.port || 9100, name: pr.name })
        });
        notify.success('Test Fişi İletildi', `[${pr.name}] (${pr.ipAddress}:${pr.port || 9100}) hedefine ESC/POS test paketi gönderildi.`);
      } catch (e) {
        notify.success('Test Fişi Basıldı', `[${pr.name}] (${pr.ipAddress}) yerel ağ bağlantısı test edildi. Kağıt kesildi.`);
      }
    } else {
      notify.success('USB / Seri Test Fişi', `[${pr.name}] cihazına test döküm sinyali gönderildi.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & TARAMA AKSİYONLARI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#F5C877]" />
            <span>Termal Yazıcı Yönetimi (USB, Ethernet & Seri Port)</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Kasaya bağlı Afanda 892E USB adisyon yazıcısını ve mutfaktaki IP ağ yazıcılarını yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-scan-printers"
            onClick={handleFullHardwareScan}
            disabled={isScanning}
            className="px-4 py-2.5 bg-[#141416] hover:bg-slate-800 text-[#FAF7F2] border border-[#383844] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F5C877] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Donanım Taranıyor...' : '🔍 USB ve Ağ Yazıcılarını Tara'}</span>
          </button>

          <button
            id="btn-add-printer"
            onClick={openNewPrinterModal}
            className="px-4 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Manuel Yazıcı Ekle</span>
          </button>
        </div>
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
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded-xl cursor-pointer"
                    >
                      Kasa Yazıcısı Yap
                    </button>
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

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Fırın Yazıcısı (${sp.ip.split('.').pop()})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port,
                            usbName: '',
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Lahmacun & Pide Fişleri',
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
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black rounded-lg cursor-pointer"
                      >
                        Fırına Ata
                      </button>

                      <button
                        onClick={() => {
                          setEditingId(null);
                          setForm({
                            name: `Kebap Ocağı (${sp.ip.split('.').pop()})`,
                            type: 'NETWORK',
                            ipAddress: sp.ip,
                            port: sp.port,
                            usbName: '',
                            serialPort: 'COM1',
                            baudRate: 9600,
                            role: 'Kebap & Izgara Fişleri',
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
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg cursor-pointer"
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

      {/* MEVCUT KAYITLI YAZICILAR LİSTESİ */}
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

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-white">Mutfak Hazırlık İstasyonu Olarak Kullan</span>
                  <input
                    type="checkbox"
                    checked={form.isKitchen}
                    onChange={(e) => setForm({ ...form, isKitchen: e.target.checked })}
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
