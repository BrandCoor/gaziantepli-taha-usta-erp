import React, { useRef, useState, useEffect } from 'react';
import { 
  Bike, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  Printer, 
  AlertCircle, 
  Check, 
  X, 
  TrendingUp,
  RefreshCw,
  Volume2,
  VolumeX,
  Plus,
  Settings,
  Bell,
  Radio,
  Store,
  Building2,
  ArrowRightLeft,
  Phone,
  MapPin,
  FileText,
  Power
} from 'lucide-react';
import {
  restaurantDataService,
  FoodPlatformsConfig,
  getApiSyncUrl,
  isApiSyncConfigured
} from '../../services/restaurantDataService';
import { 
  onlinePlatformService, 
  OnlinePlatformCode, 
  StoreAvailabilityStatus,
  PlatformState 
} from '../../services/onlinePlatformService';
import { printerService } from '../../services/printerService';
import { notify } from '../../services/notificationService';
import { TRENDYOL_CANCEL_REASONS } from '../../services/onlinePlatformService';


export type OrderDeliveryModel = 'RESTAURANT' | 'PLATFORM' | 'RESTAURANT_COURIER' | 'PLATFORM_COURIER';

export interface OnlineOrder {
  id: string;
  platform: 'TRENDYOL' | 'YEMEKSEPETI';
  /** Siparişin geldiği uygulama: Trendyol üzerinden gelen GetirYemek siparişleri 'GETIR' olur. */
  sourceApp?: 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI';
  platformCode: string;
  deliveryModel: OrderDeliveryModel; // Platformun bildirdiği teslimat modeli (bilgi amaçlı; kasada seçilmez)
  customerName: string;
  customerPhone: string;
  address: string;
  orderNote?: string;
  items: { name: string; quantity: number; price: number; note?: string }[];
  totalAmount: number;
  paymentMethod: string;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'ON_WAY' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  preparationTimeMinutes?: number;
  rejectionReason?: string;
  platformOrderId?: string;
  platformSync?: 'OK' | 'FAILED' | 'MANUAL';
  platformSyncMessage?: string;
}

/** Reddetme nedenleri: Trendyol için resmi iptal nedenleri (kurye gerektirenler yalnızca restoran kuryesinde); Yemeksepeti için genel nedenler. */
function rejectReasonsFor(order: OnlineOrder): Array<{ id: number; label: string }> {
  if (order.platform === 'TRENDYOL') {
    const own = order.deliveryModel !== 'PLATFORM_COURIER';
    return TRENDYOL_CANCEL_REASONS.filter(r => own || !r.ownCourierOnly);
  }
  return [
    { id: 1, label: 'Mutfak kapasitesi dolu / aşırı yoğunluk' },
    { id: 2, label: 'Ürün veya hammadde tükendi' },
    { id: 3, label: 'Teslimat bölgesi dışı' },
    { id: 4, label: 'İşletme kapalı' },
  ];
}

const STORAGE_KEY_ONLINE_ORDERS = 'gtu_online_orders';

// Sunucu durum sözlüğü (BEKLIYOR…) → ekran durum sözlüğü. (Eskiden eşleşmediği için gelen siparişler hiçbir gruba girmiyor, zil çalmıyordu.)
const STATUS_FROM_SERVER: Record<string, OnlineOrder['status']> = {
  BEKLIYOR: 'NEW', HAZIRLANIYOR: 'PREPARING', YOLA_CIKTI: 'ON_WAY', TESLIM_EDILDI: 'DELIVERED', IPTAL: 'CANCELLED',
};

export function mapServerOrder(o: any): OnlineOrder {
  const created = o.createdAt ? new Date(String(o.createdAt).replace(' ', 'T')) : null;
  return {
    id: String(o.id),
    platform: o.platform || o.platformCode,
    platformCode: `#${o.displayCode || o.platformOrderId}`,
    platformOrderId: String(o.platformOrderId || ''),
    deliveryModel: (o.deliveryModel === 'PLATFORM_COURIER' || o.deliveryModel === 'PLATFORM') ? 'PLATFORM_COURIER' : 'RESTAURANT_COURIER',
    sourceApp: o.sourceApp || undefined,
    customerName: o.customerName || 'Müşteri',
    customerPhone: o.customerPhone || '',
    address: o.address || '',
    orderNote: o.orderNote || '',
    items: (o.items || []).map((it: any) => ({ name: it.name, quantity: Number(it.quantity) || 1, price: Number(it.price) || 0, note: [it.note, ...(it.options || [])].filter(Boolean).join(' · ') || undefined })),
    totalAmount: Number(o.totalAmount) || 0,
    paymentMethod: o.paymentMethod || 'Online',
    status: STATUS_FROM_SERVER[o.status] || 'NEW',
    createdAt: created && !isNaN(created.getTime()) ? created.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
    rejectionReason: o.cancelReason || undefined,
    platformSync: o.platformSync || undefined,
    platformSyncMessage: o.platformSyncMessage || undefined,
  };
}


export const OnlineOrdersView: React.FC = () => {
  const [activePlatformFilter, setActivePlatformFilter] = useState<'ALL' | 'TRENDYOL' | 'YEMEKSEPETI'>('ALL');
  const [activeStatusTab, setActiveStatusTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [rejectModalOrder, setRejectModalOrder] = useState<OnlineOrder | null>(null);
  const [selectedRejectReasonId, setSelectedRejectReasonId] = useState<number>(623);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [apiProcessingId, setApiProcessingId] = useState<string | null>(null);
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);

  // Platform Yapılandırması ve Canlı Durumları
  const [platforms, setPlatforms] = useState<PlatformState[]>(() => onlinePlatformService.getPlatforms());
  const [platformConfig, setPlatformConfig] = useState<FoodPlatformsConfig>(() => 
    restaurantDataService.getFoodPlatformsConfig()
  );

  // İlk yüklemede ve periyodik sorgulamada mağaza durumunu sunucuyla eş zamanla
  useEffect(() => {
    const syncPlatforms = () => {
      setPlatforms(onlinePlatformService.getPlatforms());
    };
    syncPlatforms();
    const interval = setInterval(syncPlatforms, 2500);

    restaurantDataService.fetchPlatformStoreStatus().then(res => {
      if (res) {
        setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
      }
    });

    return () => clearInterval(interval);
  }, []);

  const enabledPlatforms = platforms.filter(p => p.isEnabled);
  const enabledPlatformCodes = new Set(enabledPlatforms.map(p => p.code));

  // Sipariş havuzu: tek kaynak SUNUCUDUR (uydurma/yerel sipariş yok). Son başarılı liste önbellekten yalnızca ilk çizim içindir.
  const [orders, setOrders] = useState<OnlineOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ONLINE_ORDERS);
      if (saved) return (JSON.parse(saved) as OnlineOrder[]).filter((o) => o && o.platformOrderId);
    } catch (e) {}
    return [];
  });
  const [serverError, setServerError] = useState<string>('');
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_ONLINE_ORDERS, JSON.stringify(orders)); } catch (e) {}
  }, [orders]);

  // Ayarlar Değişiklik Aboneliği
  useEffect(() => {
    const unsub = restaurantDataService.subscribe(() => {
      setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
    });
    return () => unsub();
  }, []);

  // KESİNTİSİZ SESLİ BİLDİRİM DÖNGÜSÜ
  // Yeni sipariş onaylanana veya reddedilene kadar zil durmaksızın çalar
  const pendingNewOrders = orders.filter(o => o.status === 'NEW');
  const hasNewOrder = pendingNewOrders.length > 0;

  useEffect(() => {
    if (hasNewOrder && platformConfig.continuousAlarmUntilAction && !isAlarmMuted) {
      restaurantDataService.startContinuousAlarm('phone');
    } else {
      restaurantDataService.stopContinuousAlarm();
    }

    return () => {
      restaurantDataService.stopContinuousAlarm();
    };
  }, [hasNewOrder, platformConfig.continuousAlarmUntilAction, isAlarmMuted]);

  // CANLI SİPARİŞ AKIŞI: sunucudaki tüm siparişler eşitlenir (yeni gelen + durum değişikliği). Hata sessiz geçilmez.
  const prevNewIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      if (!isApiSyncConfigured()) { if (alive) setServerError('Sunucu adresi ayarlanmamış: Restoran & Donanım Ayarları › Bulut & Yedekleme.'); return; }
      try {
        const res = await fetch(`${getApiSyncUrl()}?action=get_online_orders&status=ALL`, { headers: { Accept: 'application/json' } });
        if (res.status === 401) { if (alive) setServerError('Sunucu kasa anahtarını kabul etmiyor (401): Bulut & Yedekleme › Kasa API Anahtarı.'); return; }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.success !== true || !Array.isArray(data.orders)) { if (alive) setServerError(`Sipariş listesi alınamadı (HTTP ${res.status}).`); return; }
        if (!alive) return;
        setServerError('');
        setHiddenCount(Number(data.hiddenCount) || 0);
        const mapped: OnlineOrder[] = data.orders.map(mapServerOrder);
        const fresh = mapped.filter((o) => o.status === 'NEW' && !prevNewIds.current.has(o.id));
        if (fresh.length > 0 && prevNewIds.current.size >= 0) {
          const firstLoad = prevNewIds.current.size === 0 && orders.length === 0 ? false : true;
          if (firstLoad || fresh.length > 0) { notify.info('Yeni Platform Siparişi', `${fresh.length} yeni sipariş geldi.`); setIsAlarmMuted(false); }
        }
        prevNewIds.current = new Set(mapped.filter((o) => o.status === 'NEW').map((o) => o.id));
        setOrders(mapped);
        restaurantDataService.fetchPlatformStoreStatus().then((status) => { if (status && alive) setPlatformConfig(restaurantDataService.getFoodPlatformsConfig()); });
      } catch (e: any) {
        if (alive) setServerError('Sunucuya ulaşılamıyor: siparişler güncellenemiyor (' + (e?.message || 'ağ hatası') + ').');
      }
    };
    sync();
    const t = setInterval(sync, 4000);
    // Yedek yol: webhook gelmezse sunucuya platformları sorgulatır (Trendyol/Yemeksepeti siparişleri)
    const poll = setInterval(() => { onlinePlatformService.pollOrders().catch(() => undefined); }, 60000);
    onlinePlatformService.pollOrders().catch(() => undefined);
    return () => { alive = false; clearInterval(t); clearInterval(poll); };
  }, []);

  // ⚡ TEK TUŞLA YEMEK PLATFORMLARI SİPARİŞ AÇIK/YOĞUN/KAPALI YÖNETİMİ
  const handleSetPlatformStoreStatus = async (code: OnlinePlatformCode, status: StoreAvailabilityStatus) => {
    setTogglingPlatform(code);
    try {
      await onlinePlatformService.setStoreStatus(code, status);
      setPlatforms(onlinePlatformService.getPlatforms());
      
      const isOpen = status !== 'CLOSED';
      await restaurantDataService.setPlatformStoreStatus(code, isOpen);
      setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());

      const statusLabels: Record<StoreAvailabilityStatus, { label: string; tone: 'register' | 'melody' | 'alert' }> = {
        OPEN: { label: '🟢 Siparişe Açık', tone: 'melody' },
        BUSY: { label: '🟡 Yoğun Mod (+20 Dk)', tone: 'register' },
        CLOSED: { label: '🔴 Siparişe Kapalı', tone: 'alert' },
      };

      restaurantDataService.playAudioAlert(statusLabels[status].tone);
      notify.info(
        'Mağaza Durumu Güncellendi',
        `${code} durumu: ${statusLabels[status].label} olarak platform API'sine iletildi.`
      );
    } catch (e) {
      notify.error('Hata', 'Platform durumu güncellenirken bir sorun oluştu.');
    } finally {
      setTogglingPlatform(null);
    }
  };

  // TÜM AKTİF PLATFORMLARI BİRDEN AÇ / KAPAT
  const handleToggleAllPlatforms = async () => {
    setTogglingPlatform('ALL');
    const allAreOpen = enabledPlatforms.every(p => p.storeStatus === 'OPEN');
    const targetStatus: StoreAvailabilityStatus = allAreOpen ? 'CLOSED' : 'OPEN';

    try {
      for (const p of enabledPlatforms) {
        await onlinePlatformService.setStoreStatus(p.code, targetStatus);
        await restaurantDataService.setPlatformStoreStatus(p.code, targetStatus === 'OPEN');
      }
      setPlatforms(onlinePlatformService.getPlatforms());
      setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());

      if (targetStatus === 'OPEN') {
        restaurantDataService.playAudioAlert('melody');
        notify.success('Tüm Platformlar Açıldı', 'Tüm aktif platformlar tek tuşla siparişe açıldı.');
      } else {
        restaurantDataService.playAudioAlert('alert');
        notify.warning('Tüm Platformlar Kapatıldı', 'Tüm platformlar tek tuşla siparişe kapatıldı.');
      }
    } finally {
      setTogglingPlatform(null);
    }
  };

  // PLATFORM SİPARİŞİ KABUL VE ONAYLAMA (kurye/teslimat modeli seçimi yoktur)
  const handleInitiateAcceptOrder = (order: OnlineOrder) => {
    executeAcceptOrder(order);
  };

  const executeAcceptOrder = async (order: OnlineOrder) => {
    setApiProcessingId(order.id);
    const prepMinutes =
      order.platform === 'TRENDYOL' ? platformConfig.trendyol.preparationTimeMinutes || 25 :
      platformConfig.yemeksepeti.preparationTimeMinutes || 25;

    const deliveryModel = 'RESTAURANT_COURIER' as const;

    // 1. Sunucuya (ve oradan platforma) iletilir. Sunucu onaylamazsa HİÇBİR yerel değişiklik yapılmaz.
    const result = await onlinePlatformService.acceptOrder({
      id: order.id,
      platform: order.platform,
      platformOrderId: order.platformOrderId || order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      orderNote: order.orderNote,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      status: 'BEKLIYOR',
      createdAt: order.createdAt,
    }, prepMinutes);

    if (!result.success) {
      setApiProcessingId(null);
      notify.error('Sipariş Onaylanamadı', result.message);
      return;
    }

    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      status: 'PREPARING',
      preparationTimeMinutes: prepMinutes,
      platformSync: result.platformSync,
      platformSyncMessage: result.platformSyncMessage,
    } : o));

    setApiProcessingId(null);
    restaurantDataService.playAudioAlert('register');

    // 2. Mutfak / kurye fişleri (kalıcı yazdırma kuyruğu üzerinden)
    let printNote = '';
    try {
      const pr = await printerService.printOnlineOrder({
        platform: order.platform,
        platformOrderId: order.platformCode || order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        orderNote: order.orderNote,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        deliveryModel,
      });
      if (!pr.success) printNote = ' Fişler yazdırma kuyruğunda bekliyor (sağ alttaki Yazdırma Kuyruğu).';
    } catch (pErr) {
      printNote = ' Fiş yazdırılamadı; Yazdırma Kuyruğu\'ndan tekrar deneyin.';
    }

    const syncOk = result.platformSync === 'OK';
    (syncOk ? notify.success : notify.warning)(
      syncOk ? 'Sipariş Onaylandı' : 'Sipariş Onaylandı — platform bildirimi eksik',
      `[${order.platform} ${order.platformCode}] .${result.message.replace(/^\[[^\]]*\][^.]*\./, '')}${printNote}`
    );
  };

  // PLATFORM SİPARİŞİ İPTAL / REDDETME
  const handleConfirmReject = async () => {
    if (!rejectModalOrder) return;
    const order = rejectModalOrder;
    const rejectReasonLabel = (rejectReasonsFor(order).find(r => r.id === selectedRejectReasonId) || rejectReasonsFor(order)[0]).label;
    setApiProcessingId(order.id);

    const result = await onlinePlatformService.rejectOrder(order.id, rejectReasonLabel, order.platform, order.platform === 'TRENDYOL' ? selectedRejectReasonId : undefined);
    setApiProcessingId(null);
    if (!result.success) {
      notify.error('Sipariş İptal Edilemedi', result.message);
      return;
    }

    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      status: 'CANCELLED',
      rejectionReason: rejectReasonLabel,
      platformSync: result.platformSync,
      platformSyncMessage: result.platformSyncMessage,
    } : o));
    setRejectModalOrder(null);
    (result.platformSync === 'OK' ? notify.success : notify.warning)('Sipariş İptal Edildi', `[${order.platform} ${order.platformCode}] ${result.message}`);
  };

  const filteredOrders = orders.filter(o => {
    // 1. Görünürlük Kuralı: Pasif duruma getirilen platformlar sipariş listesinden TAMAMEN gizlenir
    if (!enabledPlatformCodes.has(o.platform)) return false;

    // 2. Platform Filtresi
    if (activePlatformFilter !== 'ALL' && o.platform !== activePlatformFilter) return false;

    // 3. Teslimat Modeli Filtresi

    // 4. Durum Sekmesi
    if (activeStatusTab === 'ACTIVE') return o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
    return o.status === 'DELIVERED' || o.status === 'CANCELLED';
  });

  const handlePrintReceipt = (order: OnlineOrder) => {
    restaurantDataService.playAudioAlert('register');
    printerService.printOnlineOrder({
      platform: order.platform,
      platformOrderId: order.platformCode || order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      orderNote: order.orderNote,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      deliveryModel: 'RESTAURANT_COURIER',
    }).then(res => {
      if (res.success) {
        notify.success('Yazıcıya Gönderildi', `[${order.platform} ${order.platformCode}] mutfak ve teslimat fişleri basıldı.`);
      } else {
        notify.warning('Yazıcı Uyarısı', res.details[0] || 'Yazıcı çıktısı gönderilemedi.');
      }
    });
  };

  const handleAdvanceStatus = async (order: OnlineOrder) => {
    setApiProcessingId(order.id);

    if (order.status === 'PREPARING') {
      const r = await onlinePlatformService.dispatchOrder(order.id, order.platform);
      setApiProcessingId(null);
      if (!r.success) { notify.error('Durum Güncellenemedi', r.message); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ON_WAY', platformSync: r.platformSync, platformSyncMessage: r.platformSyncMessage } : o));
      (r.platformSync === 'OK' ? notify.info : notify.warning)('Sipariş Yola Çıktı', r.message);
    } else if (order.status === 'ON_WAY') {
      const r = await onlinePlatformService.deliverOrder(order.id, order.platform);
      setApiProcessingId(null);
      if (!r.success) { notify.error('Durum Güncellenemedi', r.message); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'DELIVERED', platformSync: r.platformSync, platformSyncMessage: r.platformSyncMessage } : o));
      (r.platformSync === 'OK' ? notify.success : notify.warning)('Teslim Edildi', r.message);
    } else {
      setApiProcessingId(null);
    }
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  };

  const areAllOpen = enabledPlatforms.length > 0 && enabledPlatforms.every(p => p.storeStatus === 'OPEN');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1550px] mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      {serverError && (
        <div className="mb-3 p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold">
          ⚠ {serverError} Siparişler güncellenemiyor; platformdan gelen siparişleri kaçırmamak için bağlantıyı düzeltin.
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-bold">
          ⚠ {hiddenCount} aktif sipariş, platform "PASİF" olduğu için bu listede GİZLİ. Platformu Ayarlar › Yemek Platformları'ndan aktif edin.
        </div>
      )}
      
      {/* 🔴 SESLİ BİLDİRİM VE BEKLEYEN SİPARİŞ ÇUBUĞU */}
      {hasNewOrder && (
        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 p-4 rounded-3xl text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-red-400">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white text-red-600 flex items-center justify-center font-black shadow-lg">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="text-base font-black flex items-center gap-2">
                <span>ONAY BEKLEYEN ONLINE SİPARİŞ ({pendingNewOrders.length} Adet)</span>
                <span className="px-2.5 py-0.5 bg-black/40 rounded-full text-[11px] font-bold">Sesli Uyarı Devrede</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsAlarmMuted(prev => !prev)}
              className="px-4 py-2.5 bg-black/30 hover:bg-black/50 text-white rounded-2xl text-xs font-black flex items-center gap-2 border border-white/20 cursor-pointer transition-all"
            >
              {isAlarmMuted ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-amber-300" />}
              <span>{isAlarmMuted ? 'Zili Aç' : 'Sesi Sustur'}</span>
            </button>

            <button
              onClick={() => {
                pendingNewOrders.forEach(o => handleInitiateAcceptOrder(o));
              }}
              className="px-5 py-2.5 bg-white text-slate-950 hover:bg-amber-100 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-xl cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Tümünü Onayla ({pendingNewOrders.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ÜST BAŞLIK VE HIZLI YÖNETİM ÇUBUĞU */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#F5C877]/20 to-[#F5C877]/5 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg shadow-[#F5C877]/10">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Yemek Platformları Sipariş Yönetimi</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>CANLI ENTEGRASYON</span>
              </span>
            </h1>
            <p className="text-xs text-[#8E8E98] mt-0.5">
              Platform siparişlerini tek merkezden yönetin; mağaza durumunu anlık olarak açıp kapatın.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          

          {/* TÜMÜNÜ AÇ / TÜMÜNÜ KAPAT ANA ŞALTERİ */}
          {enabledPlatforms.length > 0 && (
            <button
              onClick={handleToggleAllPlatforms}
              disabled={togglingPlatform === 'ALL'}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 border shadow-lg cursor-pointer transition-all active:scale-95 ${
                areAllOpen
                  ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40'
              }`}
              title="Tüm platformları tek tuşla siparişe kapatır veya açar"
            >
              <Power className="w-4 h-4" />
              <span>{areAllOpen ? 'Tüm Platformları Kapat' : 'Tüm Platformları Aç'}</span>
            </button>
          )}

        </div>
      </div>

      {/* ⚡ DİNAMİK PLATFORM KARTLARI (YALNIZCA AKTİF OLANLAR GÖSTERİLİR) */}
      {enabledPlatforms.length === 0 ? (
        <div className="bg-[#1C1C20] rounded-3xl p-8 border border-dashed border-[#2C2C34] text-center space-y-3 shadow-xl">
          <Store className="w-12 h-12 text-[#8E8E98] mx-auto opacity-50" />
          <h3 className="text-base font-black text-white">Aktif Online Yemek Platformu Bulunmuyor</h3>
          <p className="text-xs text-[#8E8E98] max-w-md mx-auto">
            Yemeksepeti veya Trendyol Go Yemek (GetirYemek dahil) kanallarını kullanmak için Restoran & Donanım Ayarları bölümünden platformu etkinleştirin.
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${
          enabledPlatforms.length === 1 ? 'md:grid-cols-1' :
          enabledPlatforms.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
        } gap-4`}>
          {enabledPlatforms.map((p) => {
            const isOpen = p.storeStatus === 'OPEN';
            const isBusy = p.storeStatus === 'BUSY';
            const isClosed = p.storeStatus === 'CLOSED';
            const brandColor = p.badgeColor?.pill || (p.code === 'TRENDYOL' ? '#f97316' : '#e11d48');

            return (
              <div 
                key={p.code} 
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 shadow-xl ${
                  isOpen 
                    ? 'bg-[#1C1C20] border-emerald-500/30' 
                    : isBusy
                    ? 'bg-[#1C1C20] border-amber-500/40'
                    : 'bg-[#18181C] border-rose-950/60 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xs shadow-lg"
                      style={{ backgroundColor: brandColor }}
                    >
                      {p.code === 'TRENDYOL' ? 'TY' : 'YS'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isOpen ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>SİPARİŞE AÇIK</span>
                          </span>
                        ) : isBusy ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>YOĞUN MOD (+20 Dk)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>SİPARİŞE KAPALI</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  
                </div>

                {/* 3 KADEMELİ HIZLI DURUM BUTONLARI (AÇIK / YOĞUN / KAPALI) */}
                <div className="pt-2 border-t border-[#2C2C34] flex items-center gap-1.5">
                  <button
                    onClick={() => handleSetPlatformStoreStatus(p.code, 'OPEN')}
                    disabled={togglingPlatform === p.code || isOpen}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      isOpen
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                        : 'bg-[#141416] text-[#8E8E98] hover:text-emerald-400 hover:bg-[#202026]'
                    }`}
                  >
                    Açık
                  </button>
                  <button
                    onClick={() => handleSetPlatformStoreStatus(p.code, 'BUSY')}
                    disabled={togglingPlatform === p.code || isBusy}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      isBusy
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                        : 'bg-[#141416] text-[#8E8E98] hover:text-amber-400 hover:bg-[#202026]'
                    }`}
                  >
                    Yoğun
                  </button>
                  <button
                    onClick={() => handleSetPlatformStoreStatus(p.code, 'CLOSED')}
                    disabled={togglingPlatform === p.code || isClosed}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      isClosed
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                        : 'bg-[#141416] text-[#8E8E98] hover:text-rose-400 hover:bg-[#202026]'
                    }`}
                  >
                    Kapalı
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FİLTRELEME VE DURUM SEKMELERİ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Platform ve Teslimat Modeli Filtresi */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Platform Seçimi - SADECE AKTİF PLATFORMLAR LİSTELENİR */}
          <div className="flex bg-[#1C1C20] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
            <button
              onClick={() => setActivePlatformFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePlatformFilter === 'ALL' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              Tüm Kanallar ({filteredOrders.length})
            </button>
            {enabledPlatforms.map((p) => {
              const count = orders.filter(o => o.platform === p.code).length;
              const isSelected = activePlatformFilter === p.code;
              const tabColor = p.badgeColor?.pill || (p.code === 'TRENDYOL' ? '#f97316' : '#e11d48');
              return (
                <button
                  key={p.code}
                  onClick={() => setActivePlatformFilter(p.code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected ? 'text-white shadow-md' : 'text-[#8E8E98] hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? tabColor : undefined
                  }}
                >
                  {p.name} ({count})
                </button>
              );
            })}
          </div>

        </div>

        {/* Aktif / Geçmiş Sekmeleri */}
        <div className="flex bg-[#1C1C20] p-1.5 rounded-2xl border border-[#2C2C34] gap-1">
          <button
            onClick={() => setActiveStatusTab('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeStatusTab === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            Aktif Siparişler
          </button>
          <button
            onClick={() => setActiveStatusTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeStatusTab === 'HISTORY' ? 'bg-slate-700 text-white' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            Tamamlanan & İptal Arşivi
          </button>
        </div>
      </div>

      {/* SİPARİŞ LİSTESİ / KARTLAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full p-16 text-center text-xs text-[#8E8E98] bg-[#1C1C20] rounded-3xl border border-[#2C2C34] space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#24242C] flex items-center justify-center mx-auto text-[#F5C877]">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <div className="text-base font-bold text-white">Aktif Platform Siparişi Bulunmamaktadır</div>
              <p className="max-w-md mx-auto text-[#7A7A88] mt-1 text-xs leading-relaxed">
                Trendyol Go Yemek (GetirYemek dahil) veya Yemeksepeti üzerinden gelen siparişler anlık olarak bu alanda listelenecek ve sesli bildirim devreye girecektir.
              </p>
            </div>
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isNew = ord.status === 'NEW';
            const isPreparing = ord.status === 'PREPARING';
            const isOnWay = ord.status === 'ON_WAY';

            return (
              <div 
                key={ord.id} 
                className={`bg-[#1C1C20] rounded-3xl border p-5 shadow-2xl flex flex-col justify-between space-y-4 transition-all ${
                  isNew 
                    ? 'border-red-500 ring-2 ring-red-500/30 shadow-red-500/10' 
                    : isPreparing 
                    ? 'border-amber-500/50' 
                    : isOnWay 
                    ? 'border-sky-500/50' 
                    : 'border-[#2C2C34]'
                }`}
              >
                <div>
                  {/* Üst Rozetler ve Teslimat Modeli */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide uppercase flex items-center gap-1.5 ${
                      ord.platform === 'TRENDYOL'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      <span>{ord.sourceApp === 'GETIR' ? 'GETİR' : ord.platform} {ord.platformCode}</span>
                    </span>

                    <div className="flex items-center gap-1.5 text-xs text-[#8E8E98] font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#F5C877]" />
                      <span>{ord.createdAt}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                {/* Kapıda Tahsilat ve Kurye Zimmet Uyarısı */}
                {(ord.paymentMethod.toLowerCase().includes('nakit') || ord.paymentMethod.toLowerCase().includes('pos') || ord.paymentMethod.toLowerCase().includes('kapı')) && (
                  <div className="px-3 py-2 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-[11px] text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Kapıda Tahsil Edilecek ({ord.paymentMethod}):</span>
                    </span>
                    <span className="font-mono font-black text-amber-200">{formatMoney(ord.totalAmount)}</span>
                  </div>
                )}
                  </div>

                  {/* Durum Göstergesi */}
                  <div className="mb-3">
                    {isNew ? (
                      <div className="px-3 py-1.5 bg-red-950/60 border border-red-500/50 text-red-300 rounded-xl text-xs font-black flex items-center justify-between animate-pulse">
                        <span className="flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-red-400" />
                          <span>ONAY BEKLİYOR (Sesli Uyarı Aktif)</span>
                        </span>
                        <span className="text-[10px] font-mono">Beklemede</span>
                      </div>
                    ) : isPreparing ? (
                      <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>🍳 Mutfakta Hazırlanıyor ({ord.preparationTimeMinutes || 25} dk)</span>
                        <span className="text-[10px] font-mono text-emerald-400">API: Onaylandı</span>
                      </div>
                    ) : isOnWay ? (
                      <div className="px-3 py-1.5 bg-sky-950/40 border border-sky-500/40 text-sky-300 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>🛵 Kuryede / Dağıtımda</span>
                        <span className="text-[10px] font-mono text-sky-400">Yolda</span>
                      </div>
                    ) : ord.status === 'DELIVERED' ? (
                      <div className="px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>✓ Teslimat Tamamlandı</span>
                        <span className="text-[10px] font-mono text-emerald-400">Kapandı</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>✕ İptal Edildi ({ord.rejectionReason || 'Restoran Reddi'})</span>
                        <span className="text-[10px] font-mono text-red-400">API: İptal</span>
                      </div>
                    )}
                  </div>

                  {/* Müşteri ve Adres Kartı */}
                  <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-1.5 text-xs">
                    <div className="font-black text-white text-sm flex items-center justify-between">
                      <span>{ord.customerName}</span>
                      <span className="text-[11px] text-[#F5C877] font-mono font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{ord.customerPhone}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8E8E98] leading-relaxed flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{ord.address}</span>
                    </div>
                    {ord.orderNote && (
                      <div className="pt-1.5 border-t border-[#2C2C34] text-[11px] text-amber-300 font-medium flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Sipariş Notu: {ord.orderNote}</span>
                      </div>
                    )}
                    {ord.platformSync && (
                      <div className={`mt-1 text-[10px] font-bold ${ord.platformSync === 'OK' ? 'text-emerald-400' : ord.platformSync === 'MANUAL' ? 'text-amber-300' : 'text-rose-400'}`}>
                        {ord.platformSync === 'OK' ? '✔ Platforma iletildi' : ord.platformSync === 'MANUAL' ? '⚠ Platforma otomatik iletilmedi — platform uygulamasında da işlem yapın' : '✖ Platforma İLETİLEMEDİ'}
                        {ord.platformSyncMessage ? ` — ${ord.platformSyncMessage}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Sipariş Edilen Yemekler */}
                  <div className="mt-3 space-y-1.5 divide-y divide-[#2C2C34]/60 text-xs">
                    {ord.items.map((item, i) => (
                      <div key={i} className="pt-1.5 flex justify-between items-start">
                        <div>
                          <span className="font-bold text-white">{item.quantity}x {item.name}</span>
                          {item.note && <span className="block text-[10px] text-[#F5C877]">({item.note})</span>}
                        </div>
                        <span className="font-mono font-black text-[#E4E4E8]">{formatMoney(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alt Tutar ve Aksiyon Butonları */}
                <div className="pt-3 border-t border-[#2C2C34] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8E8E98] font-medium">{ord.paymentMethod}</span>
                    <span className="font-mono font-black text-lg text-[#F5C877]">{formatMoney(ord.totalAmount)}</span>
                  </div>

                  {/* Duruma Göre Aksiyon Butonları */}
                  <div className="flex gap-2">
                    {isNew ? (
                      <>
                        <button
                          disabled={apiProcessingId === ord.id}
                          onClick={() => handleInitiateAcceptOrder(ord)}
                          className="flex-1 py-3 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer active:scale-95 transition-all bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 shadow-emerald-600/25"
                        >
                          {apiProcessingId === ord.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>ONAYLA & FİŞLERİ BAS</span>
                        </button>
                        <button
                          disabled={apiProcessingId === ord.id}
                          onClick={() => setRejectModalOrder(ord)}
                          className="px-3.5 py-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl border border-rose-800/40 text-xs font-bold cursor-pointer transition-all"
                          title="Siparişi Reddet / İptal Bildir"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : isPreparing ? (
                      <>
                        <button
                          onClick={() => handlePrintReceipt(ord)}
                          className="p-3 bg-[#282830] hover:bg-[#32323D] text-[#F5C877] border border-[#2C2C34] rounded-xl cursor-pointer"
                          title="Fişleri Tekrar Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleAdvanceStatus(ord)}
                          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          <Check className="w-4 h-4" />
                          <span>Hazır / Yola Çıktı</span>
                        </button>
                      </>
                    ) : isOnWay ? (
                      <>
                        <button
                          onClick={() => handlePrintReceipt(ord)}
                          className="p-3 bg-[#282830] hover:bg-[#32323D] text-[#F5C877] border border-[#2C2C34] rounded-xl cursor-pointer"
                          title="Fişleri Tekrar Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAdvanceStatus(ord)}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Müşteriye Teslim Edildi Olarak Kapat</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handlePrintReceipt(ord)}
                        className="w-full py-2.5 bg-[#282830] hover:bg-[#32323D] text-[#C4C4CC] border border-[#2C2C34] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Arşiv Adisyonunu Yazdır</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* MODAL 2: SİPARİŞ İPTAL / RED GEREKÇESİ MODALI */}
      {rejectModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C20] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-sm font-black text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Siparişi Reddet & Platform API'ye Bildir</span>
              </h3>
              <button
                onClick={() => setRejectModalOrder(null)}
                className="w-7 h-7 bg-[#282830] text-[#8E8E98] hover:text-white rounded-full flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#8E8E98] space-y-2">
              <p>
                <strong className="text-white">[{rejectModalOrder.platform} {rejectModalOrder.platformCode}]</strong> siparişi iptal edilecek ve seçtiğiniz resmi gerekçe platform merkezine API üzerinden iletilecektir.
              </p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Resmi İptal Gerekçesi</label>
                <select
                  value={selectedRejectReasonId}
                  onChange={e => setSelectedRejectReasonId(Number(e.target.value))}
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  {rejectReasonsFor(rejectModalOrder).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                className="flex-1 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl font-bold text-xs"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={apiProcessingId === rejectModalOrder.id}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                {apiProcessingId === rejectModalOrder.id ? 'İletiliyor...' : 'İptali Onayla & Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUEL TELEFON / DOĞRUDAN SİPARİŞ GİRİŞİ */}
      

    </div>
  );
};
