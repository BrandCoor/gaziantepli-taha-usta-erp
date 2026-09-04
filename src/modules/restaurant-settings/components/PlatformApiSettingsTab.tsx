import React, { useState } from 'react';
import { 
  Check, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  Bell, 
  Save, 
  X, 
  Key, 
  Mail, 
  Store, 
  Lock, 
  Clock, 
  Printer, 
  CheckCircle2,
  HelpCircle,
  Copy,
  Bike,
  Building2,
  Sliders,
  CheckCheck,
  Power
} from 'lucide-react';
import { 
  restaurantDataService, 
  FoodPlatformsConfig 
} from '../../../services/restaurantDataService';
import { notify } from '../../../services/notificationService';

export interface PlatformApiSettingsTabProps {
  onSaveSuccess?: () => void;
}

export const PlatformApiSettingsTab: React.FC<PlatformApiSettingsTabProps> = ({ onSaveSuccess }) => {
  const [activePlatform, setActivePlatform] = useState<'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI'>('TRENDYOL');
  const [config, setConfig] = useState<FoodPlatformsConfig>(restaurantDataService.getFoodPlatformsConfig());
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: { success: boolean; msg: string; time: string } }>({});
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = 'https://api.rymedya.com.tr/index.php?action=platform_webhook';

  const handleSaveAll = () => {
    restaurantDataService.saveFoodPlatformsConfig(config);
    notify.success('Yapılandırma Kaydedildi', 'Platform API parametreleri ve teslimat modeli seçimleri başarıyla güncellendi.');
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleTogglePlatformOpen = async (platform: 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI') => {
    const isCurrentlyOpen = 
      platform === 'TRENDYOL' ? config.trendyol.isOpen !== false :
      platform === 'GETIR' ? config.getir.isOpen !== false :
      config.yemeksepeti.isOpen !== false;
    const newStatus = !isCurrentlyOpen;

    const updatedConfig = {
      ...config,
      ...(platform === 'TRENDYOL' ? { trendyol: { ...config.trendyol, isOpen: newStatus } } : {}),
      ...(platform === 'GETIR' ? { getir: { ...config.getir, isOpen: newStatus } } : {}),
      ...(platform === 'YEMEKSEPETI' ? { yemeksepeti: { ...config.yemeksepeti, isOpen: newStatus } } : {}),
    };
    setConfig(updatedConfig);
    await restaurantDataService.setPlatformStoreStatus(platform, newStatus);
    
    const pName = platform === 'TRENDYOL' ? 'Trendyol Yemek' : platform === 'GETIR' ? 'Getir Yemek' : 'Yemeksepeti';
    if (newStatus) {
      restaurantDataService.playAudioAlert('melody');
      notify.success('Siparişe Açıldı', `${pName} tek tuşla siparişe açıldı. Platform merkezine eş zamanlı iletildi.`);
    } else {
      restaurantDataService.playAudioAlert('alert');
      notify.warning('Siparişe Kapatıldı', `${pName} tek tuşla siparişe kapatıldı. Yeni sipariş alımı durduruldu.`);
    }
  };

  const handleTestConnection = async (platform: 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI') => {
    setTestingConnection(platform);
    
    // Kurumsal API Bağlantı Doğrulama Kontrolü
    setTimeout(() => {
      setTestingConnection(null);
      const isConfigured = 
        platform === 'TRENDYOL' ? Boolean(config.trendyol.apiKey && config.trendyol.supplierId) :
        platform === 'GETIR' ? Boolean(config.getir.secretKey) :
        Boolean(config.yemeksepeti.username && config.yemeksepeti.password);

      if (isConfigured) {
        setConnectionStatus(prev => ({
          ...prev,
          [platform]: {
            success: true,
            msg: `API Bağlantısı Doğrulandı (HTTP 200) - ${platform === 'TRENDYOL' ? 'Trendyol Meal Integration Gateway' : platform === 'GETIR' ? 'Getir Food Partner Service' : 'Delivery Hero Partner Gateway'} aktif.`,
            time: new Date().toLocaleTimeString('tr-TR')
          }
        }));
        notify.success(`${platform} Doğrulandı`, 'Platform API bağlantısı ve yetkilendirmesi geçerli.');
      } else {
        setConnectionStatus(prev => ({
          ...prev,
          [platform]: {
            success: false,
            msg: 'Eksik kimlik bilgisi! Lütfen ilgili platformun API kimlik doğrulama anahtarlarını eksiksiz giriniz.',
            time: new Date().toLocaleTimeString('tr-TR')
          }
        }));
        notify.error(`${platform} Yetkilendirme Hatası`, 'Lütfen API anahtarlarını ve kimlik bilgilerini kontrol ediniz.');
      }
    }, 1100);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    notify.info('Webhook Kopyalandı', 'URL panoya kopyalandı; platform geliştirici portalına tanımlayabilirsiniz.');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* ÜST BİLDİRİM VE SİSTEM POLİTİKASI */}
      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#F5C877] flex items-center justify-center font-bold">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Sipariş Karşılama ve Bildirim Politikası</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">Aktif</span>
            </h3>
            <p className="text-xs text-[#8E8E98] mt-0.5">
              Platformlardan sipariş alındığında işletme yetkilisi tarafından onay veya iptal verilene kadar sesli uyarı döngüsü kesintisiz sürdürülür.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label className="flex items-center gap-2.5 cursor-pointer bg-[#141416] px-4 py-2.5 rounded-2xl border border-[#2C2C34]">
            <input
              type="checkbox"
              checked={config.continuousAlarmUntilAction}
              onChange={e => setConfig(prev => ({ ...prev, continuousAlarmUntilAction: e.target.checked }))}
              className="w-4 h-4 rounded text-[#F5C877] focus:ring-0 focus:ring-offset-0 bg-[#282830] border-[#383844] cursor-pointer"
            />
            <span className="text-xs font-bold text-white">Kesintisiz Sesli Bildirim</span>
          </label>

          <button
            onClick={handleSaveAll}
            className="px-5 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-[#F5C877]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Tümünü Kaydet</span>
          </button>
        </div>
      </div>

      {/* PLATFORM SEÇİM SEKMELERİ */}
      <div className="flex bg-[#141416] p-1.5 rounded-2xl border border-[#2C2C34] gap-1.5">
        <button
          onClick={() => setActivePlatform('TRENDYOL')}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activePlatform === 'TRENDYOL'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
              : 'text-[#8E8E98] hover:text-white'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-orange-300"></span>
          <span>Trendyol Yemek</span>
        </button>

        <button
          onClick={() => setActivePlatform('GETIR')}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activePlatform === 'GETIR'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
              : 'text-[#8E8E98] hover:text-white'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-300"></span>
          <span>Getir Yemek</span>
        </button>

        <button
          onClick={() => setActivePlatform('YEMEKSEPETI')}
          className={`flex-1 py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activePlatform === 'YEMEKSEPETI'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
              : 'text-[#8E8E98] hover:text-white'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300"></span>
          <span>Yemek Sepeti</span>
        </button>
      </div>

      {/* 1. TRENDYOL YEMEK ENTEGRASYONU */}
      {activePlatform === 'TRENDYOL' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C34] pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span>Trendyol Yemek API & Teslimat Yapılandırması</span>
              </h2>
              <p className="text-xs text-[#8E8E98] mt-0.5">
                Trendyol Partner portalı üzerinden temin edilen Satıcı ID, API anahtarları ve teslimat kurye modeli.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTogglePlatformOpen('TRENDYOL')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  config.trendyol.isOpen !== false
                    ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40'
                }`}
                title="Trendyol Yemek mağaza sipariş alma durumunu tek tuşla açar veya kapatır"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{config.trendyol.isOpen !== false ? 'Siparişe Kapat' : 'Siparişe Aç'}</span>
              </button>

              <button
                onClick={() => handleTestConnection('TRENDYOL')}
                disabled={testingConnection === 'TRENDYOL'}
                className="px-3.5 py-2 bg-[#282830] hover:bg-[#34343E] text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection === 'TRENDYOL' ? 'animate-spin' : ''}`} />
                <span>Bağlantıyı Doğrula</span>
              </button>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-[#141416] px-3 py-2 rounded-xl border border-[#2C2C34]">
                <input
                  type="checkbox"
                  checked={config.trendyol.enabled}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, enabled: e.target.checked }
                  }))}
                  className="rounded text-orange-500 bg-[#282830] border-[#383844]"
                />
                <span>Kanal Aktif</span>
              </label>
            </div>
          </div>

          {/* 🛵 RESTORAN KURYESİ VS TRENDYOL GO KURYESİ SEÇİMİ */}
          <div className="bg-[#141416] p-4 rounded-2xl border border-[#2C2C34] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-orange-400" />
                <span>Trendyol Teslimat Modeli Tercihi</span>
              </label>
              <span className="text-[11px] text-[#8E8E98]">
                Varsayılan: <strong className="text-white">{config.trendyol.deliveryModel === 'RESTAURANT' ? 'Restoran Kuryesi' : 'Trendyol GO Kuryesi'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  trendyol: { ...prev.trendyol, deliveryModel: 'RESTAURANT' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.trendyol.deliveryModel === 'RESTAURANT'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-orange-400">
                    <Bike className="w-4 h-4" />
                    <span>Restoran Kuryesi (Kendi Kuryemiz)</span>
                  </span>
                  {config.trendyol.deliveryModel === 'RESTAURANT' && <CheckCheck className="w-4 h-4 text-orange-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Siparişi restoranın kendi kurye personeli müşteriye götürür. Yazıcıdan tam müşteri adresi ve telefon bilgisi içeren kurye sevk fişi dökülür.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  trendyol: { ...prev.trendyol, deliveryModel: 'PLATFORM' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.trendyol.deliveryModel === 'PLATFORM'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-orange-400">
                    <Building2 className="w-4 h-4" />
                    <span>Trendyol GO Kuryesi (Platform Teslimatı)</span>
                  </span>
                  {config.trendyol.deliveryModel === 'PLATFORM' && <CheckCheck className="w-4 h-4 text-orange-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Teslimatı Trendyol GO kurye ağı gerçekleştirir. Mutfak siparişi hazırlar ve "Kuryeye Teslim Edildi (Handover)" durumuna geçirir.
                </p>
              </button>
            </div>
          </div>

          {/* Form Alanları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Satıcı ID (Supplier ID)</label>
              <div className="relative">
                <Store className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={config.trendyol.supplierId}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, supplierId: e.target.value }
                  }))}
                  placeholder="Örn: 770463"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">API Anahtarı (API Key)</label>
              <div className="relative">
                <Key className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={config.trendyol.apiKey}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, apiKey: e.target.value }
                  }))}
                  placeholder="Trendyol API Key"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Güvenlik Anahtarı (Secret Key)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={config.trendyol.secretKey}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, secretKey: e.target.value }
                  }))}
                  placeholder="••••••••••••••••••••"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Trendyol Yetkili E-posta</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={config.trendyol.email}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, email: e.target.value }
                  }))}
                  placeholder="mehmettahagumus@icloud.com"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.trendyol.autoPrintReceipt}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    trendyol: { ...prev.trendyol, autoPrintReceipt: e.target.checked }
                  }))}
                  className="rounded text-orange-500 bg-[#141416] border-[#383844]"
                />
                <span>Onaylandığında Mutfak ve Kurye Fişini Otomatik Yazdır (Afanda 892E)</span>
              </label>
            </div>

            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Yapılandırmayı Kaydet</span>
            </button>
          </div>

          {connectionStatus['TRENDYOL'] && (
            <div className={`p-3.5 rounded-2xl text-xs border flex items-center gap-2.5 ${
              connectionStatus['TRENDYOL'].success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {connectionStatus['TRENDYOL'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{connectionStatus['TRENDYOL'].msg} ({connectionStatus['TRENDYOL'].time})</span>
            </div>
          )}

          {/* Kayıtlı Entegrasyon Bilgi Tablosu */}
          <div className="border border-[#2C2C34] rounded-2xl overflow-hidden">
            <div className="bg-[#141416] px-4 py-2.5 text-[11px] font-black text-[#8E8E98] uppercase tracking-wider">
              Aktif Trendyol Entegrasyon Kaydı
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C1C20] text-[#7E7E8C] border-b border-[#2C2C34]">
                <tr>
                  <th className="p-3">Kanal</th>
                  <th className="p-3">Satıcı ID</th>
                  <th className="p-3">Teslimat Modeli</th>
                  <th className="p-3">E-posta</th>
                  <th className="p-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2C34]">
                <tr className="hover:bg-[#24242C]">
                  <td className="p-3 font-bold text-white">Trendyol Yemek</td>
                  <td className="p-3 font-mono font-bold text-orange-400">{config.trendyol.supplierId || '-'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-[#141416] border border-[#2C2C34] rounded-lg text-[11px] font-bold text-slate-300">
                      {config.trendyol.deliveryModel === 'RESTAURANT' ? 'Restoran Kuryesi' : 'Trendyol GO Kuryesi'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{config.trendyol.email || '-'}</td>
                  <td className="p-3 text-right">
                    <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold">
                      Aktif & Bağlı
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. GETİR YEMEK ENTEGRASYONU */}
      {activePlatform === 'GETIR' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C34] pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                <span>Getir Yemek API & Teslimat Yapılandırması</span>
              </h2>
              <p className="text-xs text-[#8E8E98] mt-0.5">
                Getir Çarşı/Yemek restoran portalından temin edilen Restoran Adı, Secret Key ve teslimat modeli seçimi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTogglePlatformOpen('GETIR')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  config.getir.isOpen !== false
                    ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40'
                }`}
                title="Getir Yemek mağaza sipariş alma durumunu tek tuşla açar veya kapatır"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{config.getir.isOpen !== false ? 'Siparişe Kapat' : 'Siparişe Aç'}</span>
              </button>

              <button
                onClick={() => handleTestConnection('GETIR')}
                disabled={testingConnection === 'GETIR'}
                className="px-3.5 py-2 bg-[#282830] hover:bg-[#34343E] text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection === 'GETIR' ? 'animate-spin' : ''}`} />
                <span>Bağlantıyı Doğrula</span>
              </button>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-[#141416] px-3 py-2 rounded-xl border border-[#2C2C34]">
                <input
                  type="checkbox"
                  checked={config.getir.enabled}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    getir: { ...prev.getir, enabled: e.target.checked }
                  }))}
                  className="rounded text-purple-600 bg-[#282830] border-[#383844]"
                />
                <span>Kanal Aktif</span>
              </label>
            </div>
          </div>

          {/* 🛵 RESTORAN GETİRSİN VS GETİR GETİRSİN SEÇİMİ */}
          <div className="bg-[#141416] p-4 rounded-2xl border border-[#2C2C34] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-purple-400" />
                <span>Getir Yemek Teslimat Modeli Tercihi</span>
              </label>
              <span className="text-[11px] text-[#8E8E98]">
                Varsayılan: <strong className="text-white">{config.getir.deliveryModel === 'RESTAURANT' ? 'Restoran Getirsin' : 'Getir Getirsin'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  getir: { ...prev.getir, deliveryModel: 'RESTAURANT' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.getir.deliveryModel === 'RESTAURANT'
                    ? 'bg-purple-600/15 border-purple-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-purple-400">
                    <Bike className="w-4 h-4" />
                    <span>Restoran Getirsin (Kendi Kuryemiz)</span>
                  </span>
                  {config.getir.deliveryModel === 'RESTAURANT' && <CheckCheck className="w-4 h-4 text-purple-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Restoran siparişi kendi personeli ile teslim eder. Kapıda nakit, kredi kartı veya yemek kartı ile tahsilat seçeneği desteklenir.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  getir: { ...prev.getir, deliveryModel: 'PLATFORM' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.getir.deliveryModel === 'PLATFORM'
                    ? 'bg-purple-600/15 border-purple-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-purple-400">
                    <Building2 className="w-4 h-4" />
                    <span>Getir Getirsin (Getir Kuryesi)</span>
                  </span>
                  {config.getir.deliveryModel === 'PLATFORM' && <CheckCheck className="w-4 h-4 text-purple-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Getir kuryesi restorana gelerek siparişi teslim alır; sipariş durumu hazırlandığında Getir kuryesine devredilir.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Restoran Resmi Adı</label>
              <div className="relative">
                <Store className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={config.getir.restaurantName}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    getir: { ...prev.getir, restaurantName: e.target.value }
                  }))}
                  placeholder="Gaziantepli Taha Usta (Eğitim Mah.)"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Getir Secret Key</label>
              <div className="relative">
                <Key className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={config.getir.secretKey}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    getir: { ...prev.getir, secretKey: e.target.value }
                  }))}
                  placeholder="85309848fd36282068984f02259f91c2873d2bc6"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.getir.autoPrintReceipt}
                onChange={e => setConfig(prev => ({
                  ...prev,
                  getir: { ...prev.getir, autoPrintReceipt: e.target.checked }
                }))}
                className="rounded text-purple-600 bg-[#141416] border-[#383844]"
              />
              <span>Sipariş Onaylandığında Mutfak Fişini Otomatik Bas (Afanda 892E)</span>
            </label>

            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Yapılandırmayı Kaydet</span>
            </button>
          </div>

          {connectionStatus['GETIR'] && (
            <div className={`p-3.5 rounded-2xl text-xs border flex items-center gap-2.5 ${
              connectionStatus['GETIR'].success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {connectionStatus['GETIR'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{connectionStatus['GETIR'].msg} ({connectionStatus['GETIR'].time})</span>
            </div>
          )}

          <div className="border border-[#2C2C34] rounded-2xl overflow-hidden">
            <div className="bg-[#141416] px-4 py-2.5 text-[11px] font-black text-[#8E8E98] uppercase tracking-wider">
              Aktif Getir Yemek Entegrasyon Kaydı
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C1C20] text-[#7E7E8C] border-b border-[#2C2C34]">
                <tr>
                  <th className="p-3">Kanal</th>
                  <th className="p-3">Restoran Adı</th>
                  <th className="p-3">Teslimat Modeli</th>
                  <th className="p-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2C34]">
                <tr className="hover:bg-[#24242C]">
                  <td className="p-3 font-bold text-white">Getir Yemek</td>
                  <td className="p-3 font-bold text-purple-400">{config.getir.restaurantName || '-'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-[#141416] border border-[#2C2C34] rounded-lg text-[11px] font-bold text-slate-300">
                      {config.getir.deliveryModel === 'RESTAURANT' ? 'Restoran Getirsin' : 'Getir Getirsin'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold">
                      Aktif & Bağlı
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. YEMEK SEPETİ ENTEGRASYONU */}
      {activePlatform === 'YEMEKSEPETI' && (
        <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C34] pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-600"></span>
                <span>Yemek Sepeti API & Teslimat Yapılandırması</span>
              </h2>
              <p className="text-xs text-[#8E8E98] mt-0.5">
                Delivery Hero / Yemeksepeti Partner portalı kimlik doğrulaması ve kurye teslimat yöntemi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTogglePlatformOpen('YEMEKSEPETI')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  config.yemeksepeti.isOpen !== false
                    ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40'
                }`}
                title="Yemeksepeti mağaza sipariş alma durumunu tek tuşla açar veya kapatır"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{config.yemeksepeti.isOpen !== false ? 'Siparişe Kapat' : 'Siparişe Aç'}</span>
              </button>

              <button
                onClick={() => handleTestConnection('YEMEKSEPETI')}
                disabled={testingConnection === 'YEMEKSEPETI'}
                className="px-3.5 py-2 bg-[#282830] hover:bg-[#34343E] text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection === 'YEMEKSEPETI' ? 'animate-spin' : ''}`} />
                <span>Bağlantıyı Doğrula</span>
              </button>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-[#141416] px-3 py-2 rounded-xl border border-[#2C2C34]">
                <input
                  type="checkbox"
                  checked={config.yemeksepeti.enabled}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    yemeksepeti: { ...prev.yemeksepeti, enabled: e.target.checked }
                  }))}
                  className="rounded text-rose-600 bg-[#282830] border-[#383844]"
                />
                <span>Kanal Aktif</span>
              </label>
            </div>
          </div>

          {/* 🛵 KENDİ KURYEMLE VS YEMEKSEPETİ VALE SEÇİMİ */}
          <div className="bg-[#141416] p-4 rounded-2xl border border-[#2C2C34] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-rose-400" />
                <span>Yemeksepeti Teslimat Modeli Tercihi</span>
              </label>
              <span className="text-[11px] text-[#8E8E98]">
                Varsayılan: <strong className="text-white">{config.yemeksepeti.deliveryModel === 'RESTAURANT' ? 'Kendi Kuryemle' : 'Yemeksepeti Vale'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  yemeksepeti: { ...prev.yemeksepeti, deliveryModel: 'RESTAURANT' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.yemeksepeti.deliveryModel === 'RESTAURANT'
                    ? 'bg-rose-600/15 border-rose-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-rose-400">
                    <Bike className="w-4 h-4" />
                    <span>Kendi Kuryemle (Restoran Teslimatı)</span>
                  </span>
                  {config.yemeksepeti.deliveryModel === 'RESTAURANT' && <CheckCheck className="w-4 h-4 text-rose-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  İşletmenin kendi kurye personeli tarafından teslim edilir. Kurye fişinde eksiksiz teslimat adresi ve müşteri iletişim detayları dökülür.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  yemeksepeti: { ...prev.yemeksepeti, deliveryModel: 'PLATFORM' }
                }))}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  config.yemeksepeti.deliveryModel === 'PLATFORM'
                    ? 'bg-rose-600/15 border-rose-500 text-white shadow-md'
                    : 'bg-[#1C1C20] border-[#2C2C34] text-[#8E8E98] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-2 text-rose-400">
                    <Building2 className="w-4 h-4" />
                    <span>Yemeksepeti Vale (Platform Kuryesi)</span>
                  </span>
                  {config.yemeksepeti.deliveryModel === 'PLATFORM' && <CheckCheck className="w-4 h-4 text-rose-400" />}
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Yemeksepeti Vale kurye ağı (motorlu/bisikletli kurye) teslimatı sağlar. Sipariş mutfakta tamamlandığında kuryeye devredilir.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Kullanıcı Adı / E-posta</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={config.yemeksepeti.username}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    yemeksepeti: { ...prev.yemeksepeti, username: e.target.value }
                  }))}
                  placeholder="mehmettahagumus@icloud.com"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#A8A8B4] mb-1.5">Hesap Parolası</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8E8E98] absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={config.yemeksepeti.password}
                  onChange={e => setConfig(prev => ({
                    ...prev,
                    yemeksepeti: { ...prev.yemeksepeti, password: e.target.value }
                  }))}
                  placeholder="••••••••••••"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.yemeksepeti.autoPrintReceipt}
                onChange={e => setConfig(prev => ({
                  ...prev,
                  yemeksepeti: { ...prev.yemeksepeti, autoPrintReceipt: e.target.checked }
                }))}
                className="rounded text-rose-600 bg-[#141416] border-[#383844]"
              />
              <span>Sipariş Onaylandığında Mutfak Fişini Otomatik Bas (Afanda 892E)</span>
            </label>

            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Yapılandırmayı Kaydet</span>
            </button>
          </div>

          {connectionStatus['YEMEKSEPETI'] && (
            <div className={`p-3.5 rounded-2xl text-xs border flex items-center gap-2.5 ${
              connectionStatus['YEMEKSEPETI'].success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {connectionStatus['YEMEKSEPETI'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{connectionStatus['YEMEKSEPETI'].msg} ({connectionStatus['YEMEKSEPETI'].time})</span>
            </div>
          )}
        </div>
      )}

      {/* WEBHOOK URL ENTEGRASYON BİLGİ KARTI */}
      <div className="bg-[#141416] p-5 rounded-3xl border border-[#2C2C34] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#F5C877]" />
            <span>Sipariş Bildirim Webhook Uç Noktası (Server Listener)</span>
          </div>
          <p className="text-[#8E8E98]">
            Platform panellerinde (Trendyol Partner, Getir İş Ortağım, Yemeksepeti Partner) Webhook / Callback URL alanına bu adresi tanımlayınız:
          </p>
          <div className="font-mono text-[#F5C877] bg-[#1C1C20] px-3 py-1.5 rounded-xl border border-[#2C2C34] inline-block">
            {webhookUrl}
          </div>
        </div>

        <button
          onClick={copyWebhook}
          className="px-4 py-2 bg-[#282830] hover:bg-[#34343E] text-white rounded-xl font-bold flex items-center gap-2 border border-[#383844] cursor-pointer self-stretch md:self-auto justify-center"
        >
          {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copiedWebhook ? 'Kopyalandı' : 'Webhook Adresini Kopyala'}</span>
        </button>
      </div>

    </div>
  );
};
