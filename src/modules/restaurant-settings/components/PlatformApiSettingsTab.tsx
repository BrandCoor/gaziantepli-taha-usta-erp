import React, { useState, useEffect } from 'react';
import { 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  Bell, 
  Save, 
  X, 
  Key, 
  Store, 
  Lock, 
  Clock, 
  Copy, 
  Bike, 
  Building2, 
  CheckCheck, 
  Power,
  Volume2,
  ExternalLink,
  Send,
  SlidersHorizontal,
  Flame,
  Coffee,
  CheckCircle2
} from 'lucide-react';
import { 
  restaurantDataService, 
  FoodPlatformsConfig 
} from '../../../services/restaurantDataService';
import { 
  onlinePlatformService, 
  OnlinePlatformCode, 
  StoreAvailabilityStatus,
  DeliveryModel
} from '../../../services/onlinePlatformService';
import { notify } from '../../../services/notificationService';

export interface PlatformApiSettingsTabProps {
  onSaveSuccess?: () => void;
}

export const PlatformApiSettingsTab: React.FC<PlatformApiSettingsTabProps> = ({ onSaveSuccess }) => {
  const [activePlatform, setActivePlatform] = useState<OnlinePlatformCode>('TRENDYOL');
  const [config, setConfig] = useState<FoodPlatformsConfig>(restaurantDataService.getFoodPlatformsConfig());
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [sendingTestOrder, setSendingTestOrder] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: { success: boolean; msg: string; time: string } }>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Platform durumları ve bilgileri
  const [platforms, setPlatforms] = useState(onlinePlatformService.getPlatforms());

  useEffect(() => {
    setPlatforms(onlinePlatformService.getPlatforms());
  }, []);

  const getWebhookUrl = (code: OnlinePlatformCode) => {
    return `https://api.rymedya.com.tr/api/online/webhook.php?platform=${code}`;
  };

  const handleSaveAll = async () => {
    // 1. restaurantDataService kaydı
    restaurantDataService.saveFoodPlatformsConfig(config);

    // 2. onlinePlatformService ve cPanel veritabanı kaydı
    for (const p of platforms) {
      await onlinePlatformService.savePlatformConfig(p.code, {
        isEnabled: p.isEnabled,
        storeStatus: p.storeStatus,
        credentials: p.credentials,
        webhookSecret: p.webhookSecret,
      });
    }

    notify.success(
      'Yapılandırma Kaydedildi',
      'Yemeksepeti, Trendyol Yemek ve GetirYemek API anahtarları, aktiflik ve mağaza durumları başarıyla kaydedildi.'
    );
    if (onSaveSuccess) onSaveSuccess();
  };

  // Aktif / Pasif Toggle (Feature Toggling)
  const handleTogglePlatformActive = async (code: OnlinePlatformCode) => {
    const p = platforms.find(item => item.code === code);
    if (!p) return;

    const newActive = !p.isEnabled;
    await onlinePlatformService.togglePlatform(code, newActive);
    
    // UI state güncelle
    setPlatforms(onlinePlatformService.getPlatforms());

    // restaurantDataService'i de güncelle
    const updatedConfig = { ...config };
    if (code === 'TRENDYOL') updatedConfig.trendyol.enabled = newActive;
    if (code === 'GETIR') updatedConfig.getir.enabled = newActive;
    if (code === 'YEMEKSEPETI') updatedConfig.yemeksepeti.enabled = newActive;
    setConfig(updatedConfig);
    restaurantDataService.saveFoodPlatformsConfig(updatedConfig);

    if (newActive) {
      restaurantDataService.playAudioAlert('melody');
      notify.success(`${p.name} Aktif Edildi`, 'Platform sol menüde ve sipariş havuzunda görünür hale getirildi.');
    } else {
      restaurantDataService.playAudioAlert('alert');
      notify.warning(
        `${p.name} Pasife Alındı`,
        'Görünürlük kuralı gereğince platform; sol menüden, filtrelerden ve sipariş listelerinden tamamen gizlendi.'
      );
    }
  };

  // Restoran Sipariş Durum Kontrolü (OPEN, BUSY, CLOSED)
  const handleSetStoreStatus = async (code: OnlinePlatformCode, status: StoreAvailabilityStatus) => {
    await onlinePlatformService.setStoreStatus(code, status);
    setPlatforms(onlinePlatformService.getPlatforms());

    // restaurantDataService güncellemesi
    const isOpen = status !== 'CLOSED';
    await restaurantDataService.setPlatformStoreStatus(code, isOpen);

    const statusLabels: Record<StoreAvailabilityStatus, { label: string; tone: 'register' | 'melody' | 'alert' }> = {
      OPEN: { label: '🟢 Siparişe Açık (Normal Kabul)', tone: 'melody' },
      BUSY: { label: '🟡 Yoğun Mod (+20 Dk Hazırlık Süresi)', tone: 'register' },
      CLOSED: { label: '🔴 Siparişe Kapalı (Yeni Sipariş Durduruldu)', tone: 'alert' },
    };

    restaurantDataService.playAudioAlert(statusLabels[status].tone);
    notify.info(
      'Mağaza Durumu Güncellendi',
      `${code} durumu: ${statusLabels[status].label} olarak platform API'sine iletildi.`
    );
  };

  // Teslimat Modeli Kontrolü (RESTAURANT_COURIER vs. PLATFORM_COURIER)
  const handleSetDeliveryModel = async (code: OnlinePlatformCode, model: DeliveryModel) => {
    await onlinePlatformService.setDeliveryModel(code, model);
    setPlatforms(onlinePlatformService.getPlatforms());
    const modelLabel = model === 'RESTAURANT_COURIER' ? 'Restoran Kuryesi (Kendi Kuryemiz)' : 'Platform Kuryesi (Trendyol GO / Vale / Getir)';
    restaurantDataService.playAudioAlert('melody');
    notify.success('Teslimat Modeli Güncellendi', `${code} teslimatı artık '${modelLabel}' olarak yönetilecek.`);
  };

  // API Bağlantı Testi
  const handleTestConnection = async (code: OnlinePlatformCode) => {
    setTestingConnection(code);
    try {
      const result = await onlinePlatformService.testConnection(code);
      setConnectionStatus(prev => ({
        ...prev,
        [code]: {
          success: result.success,
          msg: result.message,
          time: new Date().toLocaleTimeString('tr-TR'),
        },
      }));

      if (result.success) {
        restaurantDataService.playAudioAlert('melody');
        notify.success('API Bağlantısı Doğrulandı', result.message);
      } else {
        restaurantDataService.playAudioAlert('alert');
        notify.error('Doğrulama Başarısız', result.message);
      }
    } catch (e: any) {
      setConnectionStatus(prev => ({
        ...prev,
        [code]: {
          success: false,
          msg: 'Sunucuya erişilemedi: ' + (e?.message || 'Bilinmeyen hata'),
          time: new Date().toLocaleTimeString('tr-TR'),
        },
      }));
    } finally {
      setTestingConnection(null);
    }
  };

  // Test Siparişi Gönderimi
  const handleSendTestOrder = async (code: OnlinePlatformCode) => {
    setSendingTestOrder(code);
    try {
      const order = await onlinePlatformService.createTestOrder(code);
      if (order) {
        notify.success(
          'Test Siparişi Oluşturuldu!',
          `[${code}] #${order.platformOrderId} siparişi başarıyla enjekte edildi. Kasa sesli uyarısı ve sipariş kartı tetiklendi.`
        );
      }
    } catch (e) {
      notify.error('Test Siparişi Hatası', 'Sipariş oluşturulamadı.');
    } finally {
      setSendingTestOrder(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify.info('Panoya Kopyalandı', 'Webhook adresi kopyalandı.');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentPlatform = platforms.find(p => p.code === activePlatform) || platforms[0];

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* ÜST BİLGİLENDİRME VE POLİTİKA */}
      <div className="bg-[#1C1C20] p-5 rounded-3xl border border-[#2C2C34] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#F5C877] flex items-center justify-center font-bold">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Online Yemek Platformları Entegrasyon Merkezi</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">Canlı API & Webhook</span>
            </h3>
            <p className="text-xs text-[#8E8E98] mt-0.5">
              Yemeksepeti (Delivery Hero), Trendyol Yemek ve GetirYemek resmi API standartlarında çift yönlü senkronize edilir.
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
            <span className="text-xs font-bold text-white">Kesintisiz Sesli Zil</span>
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

      {/* 3 BAĞIMSIZ PLATFORM KARTI VE AKTİF/PASİF DURUMLARI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map(p => {
          const isSelected = activePlatform === p.code;
          const statusBg = p.storeStatus === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                           p.storeStatus === 'BUSY' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                           'bg-rose-500/20 text-rose-400 border-rose-500/30';
          const statusText = p.storeStatus === 'OPEN' ? 'Siparişe Açık' :
                            p.storeStatus === 'BUSY' ? 'Yoğun Mod' : 'Siparişe Kapalı';

          return (
            <div
              key={p.code}
              onClick={() => setActivePlatform(p.code)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-[#222228] border-[#F5C877] shadow-xl shadow-[#F5C877]/5'
                  : 'bg-[#18181C] border-[#2C2C34] hover:border-[#383844]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${p.badgeColor.pill}`}>
                    {p.code === 'TRENDYOL' ? 'TY' : p.code === 'GETIR' ? 'GTR' : 'YS'}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">{p.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBg}`}>
                      {statusText}
                    </span>
                  </div>
                </div>

                {/* AKTİF / PASİF FEATURE TOGGLE */}
                <div 
                  onClick={e => {
                    e.stopPropagation();
                    handleTogglePlatformActive(p.code);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                  title={p.isEnabled ? 'Platformu pasife al' : 'Platformu aktif et'}
                >
                  <span className={`text-[11px] font-black ${p.isEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {p.isEnabled ? 'AKTİF' : 'PASİF'}
                  </span>
                  <div className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${p.isEnabled ? 'bg-emerald-600' : 'bg-[#2C2C34]'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${p.isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>

              {/* Görünürlük Uyarısı */}
              <div className="text-[11px] text-[#8E8E98] leading-tight">
                {p.isEnabled ? (
                  <span className="text-emerald-400/90 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Menüde ve sipariş akışında görünür.
                  </span>
                ) : (
                  <span className="text-rose-400/90 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Pasif: Menüden ve sipariş havuzundan tamamen gizli.
                  </span>
                )}
              </div>

              {/* Teslimat Modeli Bilgisi */}
              <div className="flex items-center justify-between pt-2.5 border-t border-[#2C2C34]/70">
                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                  <Bike className="w-3 h-3 text-[#F5C877]" />
                  <span>Lojistik:</span>
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  p.deliveryModel === 'PLATFORM_COURIER'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}>
                  {p.deliveryModel === 'PLATFORM_COURIER' ? 'Platform Kuryesi' : 'Restoran Kuryesi'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SEÇİLİ PLATFORM AYARLARI VE YAPILANDIRMASI */}
      <div className="bg-[#1C1C20] rounded-3xl border border-[#2C2C34] p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C2C34] pb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${currentPlatform.badgeColor.pill}`}>
              {currentPlatform.code === 'TRENDYOL' ? 'TY' : currentPlatform.code === 'GETIR' ? 'GTR' : 'YS'}
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>{currentPlatform.name} API & Mağaza Yönetimi</span>
                {currentPlatform.isEnabled ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase">
                    Pasif (Gizli)
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#8E8E98] mt-0.5">
                Resmi API parametreleri, mağaza durumu kontrolü ve anlık donanım entegrasyonu.
              </p>
            </div>
          </div>

          {/* AKSIYON BUTONLARI (TEST BAĞLANTI, TEST SİPARİŞİ, SİPARİŞ DURUMU) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleTestConnection(currentPlatform.code)}
              disabled={testingConnection === currentPlatform.code}
              className="px-3.5 py-2.5 bg-[#282830] hover:bg-[#34343E] text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="API anahtarlarını platform gateway üzerinde doğrular"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection === currentPlatform.code ? 'animate-spin' : ''}`} />
              <span>Bağlantıyı Doğrula</span>
            </button>

            <button
              onClick={() => handleSendTestOrder(currentPlatform.code)}
              disabled={sendingTestOrder === currentPlatform.code}
              className="px-3.5 py-2.5 bg-[#282830] hover:bg-[#34343E] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sisteme gerçekçi bir test siparişi düşürür"
            >
              <Send className={`w-3.5 h-3.5 ${sendingTestOrder === currentPlatform.code ? 'animate-pulse' : ''}`} />
              <span>Test Siparişi Gönder</span>
            </button>
          </div>
        </div>

        {/* RESTORAN MAĞAZA DURUMU (STORE AVAILABILITY KONTROLÜ) */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#2C2C34] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-[#F5C877]" />
                <span>{currentPlatform.name} Canlı Mağaza Durumu</span>
              </h4>
              <p className="text-[11px] text-[#8E8E98]">
                Tek tuşla platform API'sine sipariş kabul durumu (Açık, Yoğun, Kapalı) iletilir.
              </p>
            </div>

            {/* 3 SEÇENEKLİ DURUM BUTONLARI */}
            <div className="flex items-center gap-1.5 bg-[#1C1C20] p-1.5 rounded-xl border border-[#2C2C34]">
              <button
                type="button"
                onClick={() => handleSetStoreStatus(currentPlatform.code, 'OPEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentPlatform.storeStatus === 'OPEN'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Siparişe Açık</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetStoreStatus(currentPlatform.code, 'BUSY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentPlatform.storeStatus === 'BUSY'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Yoğun Mod (+20 dk)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetStoreStatus(currentPlatform.code, 'CLOSED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentPlatform.storeStatus === 'CLOSED'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Siparişe Kapalı</span>
              </button>
            </div>
          </div>
        </div>

        {/* TESLİMAT MODELİ SEÇİMİ (RESTORAN KURYESİ vs. PLATFORM KURYESİ) */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#2C2C34] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-[#F5C877]" />
                <span>Teslimat Modeli (Lojistik Tercihi)</span>
              </h4>
              <p className="text-[11px] text-[#8E8E98]">
                {currentPlatform.name} siparişlerinin teslimatını restoranın kendi personeli mi yapacak yoksa platformun kuryesi mi teslim alacak?
              </p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
              currentPlatform.deliveryModel === 'PLATFORM_COURIER'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            }`}>
              {currentPlatform.deliveryModel === 'PLATFORM_COURIER' ? 'Platform Kuryesi Aktif' : 'Restoran Kuryesi Aktif'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Restoran Kuryesi (Kendi Kuryemiz) */}
            <div
              onClick={() => handleSetDeliveryModel(currentPlatform.code, 'RESTAURANT_COURIER')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                (currentPlatform.deliveryModel || 'RESTAURANT_COURIER') === 'RESTAURANT_COURIER'
                  ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-500/5'
                  : 'bg-[#1C1C20] border-[#2C2C34] hover:border-[#3C3C48]'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="radio"
                  name={`delivery-model-${currentPlatform.code}`}
                  checked={(currentPlatform.deliveryModel || 'RESTAURANT_COURIER') === 'RESTAURANT_COURIER'}
                  onChange={() => handleSetDeliveryModel(currentPlatform.code, 'RESTAURANT_COURIER')}
                  className="w-4 h-4 text-blue-500 bg-[#282830] border-[#383844] cursor-pointer"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">Restoran Kuryesi</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md">Kendi Kuryemiz</span>
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Siparişi onaylarken kurye personeli seçilir. Kurye yazıcısından müşteri açık adresi, telefon ve yol tarifiyle <b>Kurye Yol Fişi</b> basılır. Kapıda nakit / POS tahsilatları kurye zimmetine kaydedilir.
                </p>
                <div className="pt-1 text-[10px] text-blue-400 font-medium">
                  • Buton Akışı: Onayla & Kurye Ata → Yola Çıktı → Teslim Edildi
                </div>
              </div>
            </div>

            {/* 2. Platform Kuryesi (Trendyol GO / Vale / Getir) */}
            <div
              onClick={() => handleSetDeliveryModel(currentPlatform.code, 'PLATFORM_COURIER')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                currentPlatform.deliveryModel === 'PLATFORM_COURIER'
                  ? 'bg-purple-950/30 border-purple-500/60 shadow-lg shadow-purple-500/5'
                  : 'bg-[#1C1C20] border-[#2C2C34] hover:border-[#3C3C48]'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="radio"
                  name={`delivery-model-${currentPlatform.code}`}
                  checked={currentPlatform.deliveryModel === 'PLATFORM_COURIER'}
                  onChange={() => handleSetDeliveryModel(currentPlatform.code, 'PLATFORM_COURIER')}
                  className="w-4 h-4 text-purple-500 bg-[#282830] border-[#383844] cursor-pointer"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">Platform Kuryesi</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                    {currentPlatform.code === 'TRENDYOL' ? 'Trendyol GO' : currentPlatform.code === 'GETIR' ? 'Getir Kuryesi' : 'Yemeksepeti Vale'}
                  </span>
                </div>
                <p className="text-[11px] text-[#8E8E98] leading-relaxed">
                  Teslimatı platform kuryesi yapar. Yol fişi yerine paket üzerine zımbalanacak <b>4 Haneli Teslimat Kodu & Paket Etiketi</b> basılır. Kuryenin adı, telefonu ve tahmini varış süresi canlı izlenir.
                </p>
                <div className="pt-1 text-[10px] text-purple-400 font-medium">
                  • Buton Akışı: Siparişi Onayla → Sipariş Hazır → Kuryeye Teslim Edildi
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BAĞLANTI DURUM LOGU */}
        {connectionStatus[currentPlatform.code] && (
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            connectionStatus[currentPlatform.code].success
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
          }`}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold flex items-center justify-between">
                <span>{connectionStatus[currentPlatform.code].success ? 'Bağlantı Doğrulandı' : 'Bağlantı Başarısız'}</span>
                <span className="text-[10px] opacity-75">{connectionStatus[currentPlatform.code].time}</span>
              </div>
              <p className="mt-0.5 opacity-90">{connectionStatus[currentPlatform.code].msg}</p>
            </div>
          </div>
        )}

        {/* PLATFORMA ÖZEL KİMLİK PARAMETRELERİ (CREDENTIALS) */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-[#F5C877]" />
            <span>Platform Kimlik Doğrulama Parametreleri</span>
          </h3>

          {/* 1. TRENDYOL YEMEK PARAMETRELERİ */}
          {currentPlatform.code === 'TRENDYOL' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Satıcı ID (Supplier ID)</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.supplierId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'TRENDYOL' ? {
                      ...p, credentials: { ...p.credentials, supplierId: val }
                    } : p));
                  }}
                  placeholder="Örn: 770463"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-orange-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">API Key</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.apiKey || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'TRENDYOL' ? {
                      ...p, credentials: { ...p.credentials, apiKey: val }
                    } : p));
                  }}
                  placeholder="Trendyol API Key"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-orange-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">API Secret</label>
                <input
                  type="password"
                  value={currentPlatform.credentials.secretKey || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'TRENDYOL' ? {
                      ...p, credentials: { ...p.credentials, secretKey: val }
                    } : p));
                  }}
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-orange-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* 2. GETİRYEMEK PARAMETRELERİ */}
          {currentPlatform.code === 'GETIR' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Restoran ID (Restaurant ID)</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.restaurantId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'GETIR' ? {
                      ...p, credentials: { ...p.credentials, restaurantId: val }
                    } : p));
                  }}
                  placeholder="Örn: 65ef9a2c8901bca2"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">App Key</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.appKey || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'GETIR' ? {
                      ...p, credentials: { ...p.credentials, appKey: val }
                    } : p));
                  }}
                  placeholder="Getir App Key"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Restaurant Secret Key</label>
                <input
                  type="password"
                  value={currentPlatform.credentials.restaurantSecretKey || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'GETIR' ? {
                      ...p, credentials: { ...p.credentials, restaurantSecretKey: val }
                    } : p));
                  }}
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* 3. YEMEKSEPETİ PARAMETRELERİ */}
          {currentPlatform.code === 'YEMEKSEPETI' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Vendor ID</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.vendorId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'YEMEKSEPETI' ? {
                      ...p, credentials: { ...p.credentials, vendorId: val }
                    } : p));
                  }}
                  placeholder="YS-770463"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Client ID</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.clientId || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'YEMEKSEPETI' ? {
                      ...p, credentials: { ...p.credentials, clientId: val }
                    } : p));
                  }}
                  placeholder="deliveryhero_client_id"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Client Secret</label>
                <input
                  type="password"
                  value={currentPlatform.credentials.clientSecret || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'YEMEKSEPETI' ? {
                      ...p, credentials: { ...p.credentials, clientSecret: val }
                    } : p));
                  }}
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Store UUID</label>
                <input
                  type="text"
                  value={currentPlatform.credentials.storeUuid || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPlatforms(prev => prev.map(p => p.code === 'YEMEKSEPETI' ? {
                      ...p, credentials: { ...p.credentials, storeUuid: val }
                    } : p));
                  }}
                  placeholder="c4b8e21a-7b3f-4e52..."
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-4 py-2.5 text-xs text-white focus:border-rose-500 outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* WEBHOOK CALLBACK URL ALANI */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#2C2C34] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>{currentPlatform.name} Webhook Bildirim Uç Noktası (Callback URL)</span>
            </h4>
            <span className="text-[11px] text-[#8E8E98]">
              Platform Geliştirici Portalı &gt; Webhooks alanına tanımlanacak URL
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={getWebhookUrl(currentPlatform.code)}
              className="flex-1 bg-[#1C1C20] border border-[#2C2C34] rounded-xl px-4 py-3 text-xs text-emerald-300 font-mono select-all outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(getWebhookUrl(currentPlatform.code), currentPlatform.code)}
              className="px-4 py-3 bg-[#282830] hover:bg-[#34343E] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-[#3C3C48]"
            >
              {copiedKey === currentPlatform.code ? (
                <>
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Kopyala</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#8E8E98]">
            {currentPlatform.name} üzerinden sipariş oluşturulduğunda bu adrese JSON formatında anlık bildirim düşer ve cPanel MySQL veritabanına kaydedilir.
          </p>
        </div>
      </div>
    </div>
  );
};
