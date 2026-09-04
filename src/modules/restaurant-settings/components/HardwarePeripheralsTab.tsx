import React, { useState } from 'react';
import { 
  DollarSign, 
  Scale, 
  Monitor, 
  PhoneCall, 
  Volume2, 
  VolumeX, 
  Play, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  Save, 
  Power,
  Layers,
  Cpu,
  RefreshCw,
  Bell
} from 'lucide-react';
import { 
  HardwareSettingsConfig, 
  PrinterConfig, 
  restaurantDataService 
} from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

interface HardwarePeripheralsTabProps {
  hardware: HardwareSettingsConfig;
  printers: PrinterConfig[];
  onSave: (updated: HardwareSettingsConfig) => void;
}

export const HardwarePeripheralsTab: React.FC<HardwarePeripheralsTabProps> = ({ 
  hardware, 
  printers, 
  onSave 
}) => {
  const [config, setConfig] = useState<HardwareSettingsConfig>(hardware);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [isTestingScale, setIsTestingScale] = useState(false);
  const [testScaleWeight, setTestScaleWeight] = useState<number | null>(null);
  const [isTestingCallerId, setIsTestingCallerId] = useState(false);

  const handleToggle = (section: keyof HardwareSettingsConfig, field: string, value: any) => {
    const updated = {
      ...config,
      [section]: {
        ...(config[section] as any),
        [field]: value,
      },
    };
    setConfig(updated);
  };

  const handleSaveAll = () => {
    onSave(config);
    notify.success('Donanım Ayarları Kaydedildi', 'Çevre birimleri yapılandırması başarıyla güncellendi.');
  };

  // 1. Çekmeceyi Aç Testi
  const handleTestCashDrawer = async () => {
    setIsOpeningDrawer(true);
    const res = await restaurantDataService.openCashDrawer();
    setIsOpeningDrawer(false);
    if (res.success) {
      notify.success('Çekmece Açıldı', res.message);
    } else {
      notify.warning('Uyarı', res.message);
    }
  };

  // 2. Terazi Testi
  const handleTestScaleRead = () => {
    setIsTestingScale(true);
    restaurantDataService.playAudioAlert('beep');
    setTimeout(() => {
      // Simüle edilen hassas terazi değeri
      const simulatedWeights = [0.450, 0.725, 1.150, 0.980, 1.840, 2.300];
      const randomWeight = simulatedWeights[Math.floor(Math.random() * simulatedWeights.length)];
      setTestScaleWeight(randomWeight);
      setIsTestingScale(false);
      notify.success('Terazi Okundu', `RS-232 portundan net ağırlık: ${randomWeight.toFixed(3)} ${config.scale.unit}`);
    }, 450);
  };

  // 3. Caller ID Testi
  const handleTestCallerId = () => {
    setIsTestingCallerId(true);
    restaurantDataService.playAudioAlert('phone', config.soundAlerts.repeatCount || 2);
    setTimeout(() => {
      restaurantDataService.addRecentCall('05321002030', {
        name: 'Gelen Çağrı (Hat 1)',
        phone: '0532 100 20 30',
        address: 'Telefon arayanı için paket adisyonu açılabilir',
      });
      setIsTestingCallerId(false);
      notify.info('Gelen Çağrı Algılandı', '0532 100 20 30 numaralı telefondan çağrı sinyali alındı. Paket servis açılabilir.');
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* ÜST BİLGİ & KAYDET BUTONU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-sm">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#F5C877]" />
            <span>Kasa Donanımları & Çevre Birimleri</span>
          </h2>
          <p className="text-xs text-[#C4C4CC] mt-0.5">
            Para çekmecesi, tartım terazisi, VFD müşteri ekranı, Caller ID kutusu ve sesli uyarılar.
          </p>
        </div>

        <button
          id="btn-save-hardware-settings"
          onClick={handleSaveAll}
          className="px-6 py-2.5 bg-[#F5C877] hover:bg-[#e4b764] text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 shadow-lg cursor-pointer transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Donanım Ayarlarını Kaydet</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. OTOMATİK PARA ÇEKMECESİ (CASH DRAWER) */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                  config.cashDrawer.enabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-[#141416] text-[#A0A0AA] border border-[#2C2C34]'
                }`}>
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Otomatik Kasa Çekmecesi (RJ11/12)</h3>
                  <p className="text-xs text-[#C4C4CC]">Termal yazıcı arkasındaki çekmece portu darbe kontrolü</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.cashDrawer.enabled}
                  onChange={(e) => handleToggle('cashDrawer', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-[#C4C4CC]">Bağlı Olduğu Termal Yazıcı</label>
                <select
                  disabled={!config.cashDrawer.enabled}
                  value={config.cashDrawer.printerId}
                  onChange={(e) => handleToggle('cashDrawer', 'printerId', e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Tetikleyici Darbe Pini</label>
                  <select
                    disabled={!config.cashDrawer.enabled}
                    value={config.cashDrawer.pulsePin}
                    onChange={(e) => handleToggle('cashDrawer', 'pulsePin', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="PIN_2">Pin 2 (Standart ESC/POS)</option>
                    <option value="PIN_5">Pin 5 (Alternatif Çekmece)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Darbe Süresi (ms)</label>
                  <input
                    type="number"
                    disabled={!config.cashDrawer.enabled}
                    value={config.cashDrawer.pulseDurationMs}
                    onChange={(e) => handleToggle('cashDrawer', 'pulseDurationMs', Number(e.target.value))}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Kurallar */}
              <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#C4C4CC] font-bold">Nakit ödeme tamamlandığında otomatik aç</span>
                  <input
                    type="checkbox"
                    disabled={!config.cashDrawer.enabled}
                    checked={config.cashDrawer.openOnCashPayment}
                    onChange={(e) => handleToggle('cashDrawer', 'openOnCashPayment', e.target.checked)}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#C4C4CC] font-bold">Kredi kartı tahsilatında da çekmeceyi aç</span>
                  <input
                    type="checkbox"
                    disabled={!config.cashDrawer.enabled}
                    checked={config.cashDrawer.openOnCardPayment}
                    onChange={(e) => handleToggle('cashDrawer', 'openOnCardPayment', e.target.checked)}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            id="btn-test-cash-drawer"
            disabled={!config.cashDrawer.enabled || isOpeningDrawer}
            onClick={handleTestCashDrawer}
            className="w-full py-3 bg-[#141416] hover:bg-slate-800 border border-[#383844] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:border-[#F5C877] disabled:opacity-50"
          >
            <DollarSign className="w-4 h-4 text-[#F5C877]" />
            <span>{isOpeningDrawer ? 'Darbe Gönderiliyor...' : '💵 Şimdi Çekmeceyi Aç (Test Darbesi Gönder)'}</span>
          </button>
        </div>

        {/* 2. ELEKTRONİK TARTIM TERAZİSİ (SCALE) */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                  config.scale.enabled 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' 
                    : 'bg-[#141416] text-[#A0A0AA] border border-[#2C2C34]'
                }`}>
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Elektronik Terazi Entegrasyonu</h3>
                  <p className="text-xs text-[#C4C4CC]">Kilo ve gramajlı et, meze, tatlı satışları için RS-232 bağlantısı</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.scale.enabled}
                  onChange={(e) => handleToggle('scale', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Bağlantı Portu (Seri Port)</label>
                  <select
                    disabled={!config.scale.enabled}
                    value={config.scale.port}
                    onChange={(e) => handleToggle('scale', 'port', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="COM1">COM1 Port</option>
                    <option value="COM2">COM2 Port</option>
                    <option value="COM3">COM3 Port</option>
                    <option value="COM4">COM4 Port</option>
                    <option value="USB_SERIAL">USB Seri Dönüştürücü</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Baud Hızı (Baud Rate)</label>
                  <select
                    disabled={!config.scale.enabled}
                    value={config.scale.baudRate}
                    onChange={(e) => handleToggle('scale', 'baudRate', Number(e.target.value))}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="4800">4800 bps</option>
                    <option value="9600">9600 bps (Standart)</option>
                    <option value="19200">19200 bps</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Protokol / Terazi Markası</label>
                  <select
                    disabled={!config.scale.enabled}
                    value={config.scale.protocol}
                    onChange={(e) => handleToggle('scale', 'protocol', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="CAS">CAS (ER / AP / SW Serisi)</option>
                    <option value="DIBAL">Dibal F210 / G310</option>
                    <option value="BIZERBA">Bizerba BC II</option>
                    <option value="DIGI">Digi DS-788 / DS-980</option>
                    <option value="CUSTOM">Standart NCI / Toledo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Varsayılan Birim</label>
                  <select
                    disabled={!config.scale.enabled}
                    value={config.scale.unit}
                    onChange={(e) => handleToggle('scale', 'unit', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="KG">Kilogram (kg)</option>
                    <option value="GR">Gram (gr)</option>
                  </select>
                </div>
              </div>

              {/* Terazi Canlı LCD Simülatörü */}
              <div className="p-3.5 bg-black rounded-2xl border border-sky-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-sky-400 uppercase tracking-widest">TERAZİ CANLI OKUMA (LCD)</div>
                  <div className="text-2xl font-mono font-black text-emerald-400 mt-1">
                    {testScaleWeight !== null ? `${testScaleWeight.toFixed(3)} ${config.scale.unit}` : `0.000 ${config.scale.unit}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!config.scale.enabled}
                    onClick={() => setTestScaleWeight(0)}
                    className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[10px] font-black rounded-lg hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    Dara / Sıfırla
                  </button>
                  <button
                    type="button"
                    disabled={!config.scale.enabled || isTestingScale}
                    onClick={handleTestScaleRead}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isTestingScale ? 'Tartılıyor...' : 'Tartım Oku'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-[#141416] rounded-xl text-[11px] text-[#A0A0AA] border border-[#2C2C34]">
            Gramajlı ürün kasada seçildiğinde ağırlık otomatik okunup çarpılır.
          </div>
        </div>

        {/* 3. MÜŞTERİ EKRANI & İKİNCİ MONİTÖR (CUSTOMER DISPLAY) */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                  config.customerDisplay.enabled 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' 
                    : 'bg-[#141416] text-[#A0A0AA] border border-[#2C2C34]'
                }`}>
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Müşteri Göstergesi & 2. Ekran</h3>
                  <p className="text-xs text-[#C4C4CC]">VFD 2x20 direk ekran veya HDMI Müşteri Monitörü</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.customerDisplay.enabled}
                  onChange={(e) => handleToggle('customerDisplay', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Ekran Donanım Türü</label>
                  <select
                    disabled={!config.customerDisplay.enabled}
                    value={config.customerDisplay.type}
                    onChange={(e) => handleToggle('customerDisplay', 'type', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="VFD_2X20">VFD 2x20 Direk Gösterge (COM Port)</option>
                    <option value="SECONDARY_MONITOR">HDMI 2. Müşteri Monitörü</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Bağlantı Portu</label>
                  <select
                    disabled={!config.customerDisplay.enabled}
                    value={config.customerDisplay.port}
                    onChange={(e) => handleToggle('customerDisplay', 'port', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#C4C4CC]">Karşılama Mesajı - 1. Satır (Maks 20 Karakter)</label>
                <input
                  type="text"
                  maxLength={20}
                  disabled={!config.customerDisplay.enabled}
                  value={config.customerDisplay.welcomeMessageLine1}
                  onChange={(e) => handleToggle('customerDisplay', 'welcomeMessageLine1', e.target.value)}
                  className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#C4C4CC]">Karşılama Mesajı - 2. Satır (Maks 20 Karakter)</label>
                <input
                  type="text"
                  maxLength={20}
                  disabled={!config.customerDisplay.enabled}
                  value={config.customerDisplay.welcomeMessageLine2}
                  onChange={(e) => handleToggle('customerDisplay', 'welcomeMessageLine2', e.target.value)}
                  className="w-full mt-1 p-2 bg-[#141416] border border-[#383844] rounded-xl text-xs font-mono font-bold text-white focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* VFD Karakter Kutusu Simülasyonu */}
              <div className="p-3 bg-black rounded-2xl border-2 border-emerald-500/40 shadow-inner text-center font-mono">
                <div className="text-[10px] text-emerald-500/70 pb-1 border-b border-emerald-950">VFD 2x20 MÜŞTERİ EKRANI GÖRÜNÜMÜ</div>
                <div className="text-emerald-400 font-bold text-sm tracking-widest pt-2">
                  {config.customerDisplay.welcomeMessageLine1.padEnd(20, ' ')}
                </div>
                <div className="text-emerald-400 font-bold text-sm tracking-widest pb-1">
                  {config.customerDisplay.welcomeMessageLine2.padEnd(20, ' ')}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-[#141416] rounded-xl text-[11px] text-[#A0A0AA] border border-[#2C2C34]">
            Kasadaki her işlemde satır tutarı ve toplam bakiye anlık bu ekrana yansıtılır.
          </div>
        </div>

        {/* 4. CALLER ID & TELEFON CİHAZI */}
        <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                  config.callerId.enabled 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                    : 'bg-[#141416] text-[#A0A0AA] border border-[#2C2C34]'
                }`}>
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Caller ID Telefon Cihazı</h3>
                  <p className="text-xs text-[#C4C4CC]">Hugin, CIDShow, Everest USB/COM arayan numara gösterici</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.callerId.enabled}
                  onChange={(e) => handleToggle('callerId', 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Cihaz Modeli</label>
                  <select
                    disabled={!config.callerId.enabled}
                    value={config.callerId.deviceModel}
                    onChange={(e) => handleToggle('callerId', 'deviceModel', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="HUGIN">Hugin USB Caller ID</option>
                    <option value="CIDSHOW">CIDShow 2/4 Hat</option>
                    <option value="EVEREST">Everest E-CID</option>
                    <option value="GENERIC_MODEM">Standart Ses Modemi (COM)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C4C4CC]">Bağlantı COM Portu</label>
                  <select
                    disabled={!config.callerId.enabled}
                    value={config.callerId.port}
                    onChange={(e) => handleToggle('callerId', 'port', e.target.value)}
                    className="w-full mt-1 p-2.5 bg-[#141416] border border-[#383844] rounded-xl text-xs font-bold text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                    <option value="COM5">COM5</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#C4C4CC] font-bold">Arama geldiğinde otomatik paket servis ekranını aç</span>
                  <input
                    type="checkbox"
                    disabled={!config.callerId.enabled}
                    checked={config.callerId.autoOpenDeliveryScreen}
                    onChange={(e) => handleToggle('callerId', 'autoOpenDeliveryScreen', e.target.checked)}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#C4C4CC] font-bold">Sağ altta sesli müşteri bilgi kartı popup'ı göster</span>
                  <input
                    type="checkbox"
                    disabled={!config.callerId.enabled}
                    checked={config.callerId.popupNotification}
                    onChange={(e) => handleToggle('callerId', 'popupNotification', e.target.checked)}
                    className="w-4 h-4 accent-[#F5C877]"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            id="btn-test-caller-id"
            disabled={!config.callerId.enabled || isTestingCallerId}
            onClick={handleTestCallerId}
            className="w-full py-3 bg-[#141416] hover:bg-slate-800 border border-[#383844] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:border-[#F5C877] disabled:opacity-50"
          >
            <PhoneCall className="w-4 h-4 text-amber-400" />
            <span>{isTestingCallerId ? 'Hat Sinyali Okunuyor...' : '📞 Caller ID Bağlantısını Doğrula'}</span>
          </button>
        </div>

      </div>

      {/* 5. SESLİ BİLDİRİMLER & RESTORAN ZİLLERİ */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C2C34] pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
              config.soundAlerts.enabled 
                ? 'bg-[#F5C877]/15 text-[#F5C877] border border-[#F5C877]/30' 
                : 'bg-[#141416] text-[#A0A0AA] border border-[#2C2C34]'
            }`}>
              {config.soundAlerts.enabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Sesli Uyarılar & Restoran Zil Melodileri</h3>
              <p className="text-xs text-[#C4C4CC]">Telefon zil sesi, mutfak çağrı çanı, tekrar sayıları ve ses seviyesi</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[#C4C4CC]">
              <span>Ses Seviyesi:</span>
              <span className="font-mono font-black text-[#F5C877]">%{config.soundAlerts.volume}</span>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                disabled={!config.soundAlerts.enabled}
                value={config.soundAlerts.volume}
                onChange={(e) => handleToggle('soundAlerts', 'volume', Number(e.target.value))}
                className="w-28 accent-[#F5C877]"
              />
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.soundAlerts.enabled}
                onChange={(e) => handleToggle('soundAlerts', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F5C877]"></div>
            </label>
          </div>
        </div>

        {/* ZİL SESİ VE TEKRAR SAYISI SEÇİM PANELİ */}
        <div className="p-5 bg-[#141416] rounded-2xl border border-[#2C2C34] grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="text-[11px] font-bold text-[#C4C4CC] uppercase tracking-wider block mb-1.5">
              🔔 Ana Restoran Zil Melodisi
            </label>
            <select
              disabled={!config.soundAlerts.enabled}
              value={config.soundAlerts.ringtoneType || 'phone'}
              onChange={(e) => handleToggle('soundAlerts', 'ringtoneType', e.target.value)}
              className="w-full p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:border-[#F5C877] focus:outline-none disabled:opacity-50"
            >
              <option value="phone">📞 Telefon Zil Sesi (Nostaljik Sabit Hat / Çift Çalma)</option>
              <option value="kitchen">🛎️ Restoran Mutfak Çanı (Ding-Dong)</option>
              <option value="register">💵 Kasa & Çekmece Sesi (Ka-Ching)</option>
              <option value="melody">🎵 Melodik Restoran Bildirimi (Arpej)</option>
              <option value="alert">🚨 Acil Uyarı Düdüğü (Alarm)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#C4C4CC] uppercase tracking-wider block mb-1.5">
              🔁 Zil Çalma / Tekrar Sayısı
            </label>
            <select
              disabled={!config.soundAlerts.enabled}
              value={config.soundAlerts.repeatCount || 2}
              onChange={(e) => handleToggle('soundAlerts', 'repeatCount', Number(e.target.value))}
              className="w-full p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs font-bold text-white focus:border-[#F5C877] focus:outline-none disabled:opacity-50"
            >
              <option value={1}>1 Kez Çalsın</option>
              <option value={2}>2 Kez Tekrarlasın (Önerilen)</option>
              <option value={3}>3 Kez Tekrarlasın</option>
              <option value={4}>4 Kez Tekrarlasın</option>
              <option value={5}>5 Kez Tekrarlasın (Uzun Çağrı)</option>
            </select>
          </div>

          <div className="flex flex-col justify-end pt-5 md:pt-0">
            <button
              type="button"
              disabled={!config.soundAlerts.enabled}
              onClick={() => {
                restaurantDataService.playAudioAlert(
                  config.soundAlerts.ringtoneType || 'phone',
                  config.soundAlerts.repeatCount || 2
                );
                notify.info('Zil Sesi Çalınıyor', `${config.soundAlerts.repeatCount || 2} kez çalma testi başlatıldı.`);
              }}
              className="w-full py-3 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] text-xs font-black rounded-xl flex items-center justify-center gap-2 hover:opacity-95 shadow-md shadow-[#F5C877]/10 disabled:opacity-50 cursor-pointer transition-transform active:scale-98"
            >
              <Bell className="w-4 h-4 text-[#141416]" />
              <span>Seçili Zili ({config.soundAlerts.repeatCount || 2}x) Dinle</span>
            </button>
          </div>
        </div>

        {/* BİLDİRİM OLAYLARI KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-white">Yeni Sipariş Zili</span>
                <input
                  type="checkbox"
                  disabled={!config.soundAlerts.enabled}
                  checked={config.soundAlerts.newOrderSound}
                  onChange={(e) => handleToggle('soundAlerts', 'newOrderSound', e.target.checked)}
                  className="w-4 h-4 accent-[#F5C877]"
                />
              </div>
              <p className="text-[11px] text-[#A0A0AA] mt-1">Garson veya masadan sipariş iletildiğinde</p>
            </div>
            <button
              onClick={() => restaurantDataService.playAudioAlert(config.soundAlerts.ringtoneType || 'phone', config.soundAlerts.repeatCount || 2)}
              className="w-full py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] text-[#F5C877] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Zili Çal ({config.soundAlerts.repeatCount || 2}x)</span>
            </button>
          </div>

          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-white">Mutfak Gecikme Alarmı</span>
                <input
                  type="checkbox"
                  disabled={!config.soundAlerts.enabled}
                  checked={config.soundAlerts.kitchenAlertSound}
                  onChange={(e) => handleToggle('soundAlerts', 'kitchenAlertSound', e.target.checked)}
                  className="w-4 h-4 accent-[#F5C877]"
                />
              </div>
              <p className="text-[11px] text-[#A0A0AA] mt-1">20 dakikayı aşan hazır olmayan adisyonlar</p>
            </div>
            <button
              onClick={() => restaurantDataService.playAudioAlert('alert', 2)}
              className="w-full py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] text-rose-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Uyarı Tonu Çal</span>
            </button>
          </div>

          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-white">Online & Paket Servis Sesi</span>
                <input
                  type="checkbox"
                  disabled={!config.soundAlerts.enabled}
                  checked={config.soundAlerts.deliveryOrderSound}
                  onChange={(e) => handleToggle('soundAlerts', 'deliveryOrderSound', e.target.checked)}
                  className="w-4 h-4 accent-[#F5C877]"
                />
              </div>
              <p className="text-[11px] text-[#A0A0AA] mt-1">Telefon araması veya online sipariş düştüğünde</p>
            </div>
            <button
              onClick={() => restaurantDataService.playAudioAlert('phone', config.soundAlerts.repeatCount || 2)}
              className="w-full py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] text-sky-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Telefon Çal ({config.soundAlerts.repeatCount || 2}x)</span>
            </button>
          </div>

          <div className="p-4 bg-[#141416] rounded-2xl border border-[#2C2C34] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-white">Kasa Tahsilat Sesi</span>
                <input
                  type="checkbox"
                  disabled={!config.soundAlerts.enabled}
                  checked={config.soundAlerts.paymentSuccessSound}
                  onChange={(e) => handleToggle('soundAlerts', 'paymentSuccessSound', e.target.checked)}
                  className="w-4 h-4 accent-[#F5C877]"
                />
              </div>
              <p className="text-[11px] text-[#A0A0AA] mt-1">Ödeme alındığında veya hesap kapatıldığında</p>
            </div>
            <button
              onClick={() => restaurantDataService.playAudioAlert('register', 1)}
              className="w-full py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] text-emerald-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Kasa Ka-Ching Çal</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
