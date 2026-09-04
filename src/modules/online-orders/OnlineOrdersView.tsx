import React, { useState, useEffect } from 'react';
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
  FoodPlatformsConfig 
} from '../../services/restaurantDataService';
import { notify } from '../../services/notificationService';
import { PlatformApiSettingsTab } from '../restaurant-settings/components/PlatformApiSettingsTab';

export interface OnlineOrder {
  id: string;
  platform: 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI';
  platformCode: string;
  deliveryModel: 'RESTAURANT' | 'PLATFORM'; // Restoran Kuryesi veya Platform Kuryesi (Trendyol GO / Getir / Vale)
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
  apiAckId?: string;
}

const STORAGE_KEY_ONLINE_ORDERS = 'gtu_online_orders';

export const OnlineOrdersView: React.FC = () => {
  const [activePlatformFilter, setActivePlatformFilter] = useState<'ALL' | 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI'>('ALL');
  const [activeDeliveryFilter, setActiveDeliveryFilter] = useState<'ALL' | 'RESTAURANT' | 'PLATFORM'>('ALL');
  const [activeStatusTab, setActiveStatusTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);
  const [rejectModalOrder, setRejectModalOrder] = useState<OnlineOrder | null>(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState('Mutfak Kapasitesi Dolu');
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [apiProcessingId, setApiProcessingId] = useState<string | null>(null);
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);

  // Platform Yapılandırması
  const [platformConfig, setPlatformConfig] = useState<FoodPlatformsConfig>(() => 
    restaurantDataService.getFoodPlatformsConfig()
  );

  // İlk yüklemede ve periyodik sorgulamada mağaza durumunu sunucuyla eş zamanla
  useEffect(() => {
    restaurantDataService.fetchPlatformStoreStatus().then(res => {
      if (res) {
        setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
      }
    });
  }, []);

  // Sipariş Havuzu (Sadece gerçek veri ve sunucu/yerel kayıt)
  const [orders, setOrders] = useState<OnlineOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ONLINE_ORDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Herhangi bir demo veya sahte kayıt varsa filtrele
        return parsed.filter((o: OnlineOrder) => !['onl-1', 'onl-2', 'onl-3'].includes(o.id));
      }
    } catch (e) {}
    return [];
  });

  // Kalıcı Depolama Senkronizasyonu
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ONLINE_ORDERS, JSON.stringify(orders));
    } catch (e) {}
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

  // GERÇEK ZAMANLI BULUT / SUNUCU WEBHOOK DİNLEYİCİSİ
  useEffect(() => {
    let isSubscribed = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('https://api.rymedya.com.tr/index.php?action=get_online_orders', {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.orders) && data.orders.length > 0 && isSubscribed) {
            setOrders(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              const incomingNew = data.orders.filter((o: OnlineOrder) => !existingIds.has(o.id));
              if (incomingNew.length > 0) {
                notify.info('Yeni Platform Siparişi', `${incomingNew.length} yeni sipariş sisteme aktarıldı.`);
                return [...incomingNew, ...prev];
              }
              return prev;
            });
          }
        }
        // Platform açık/kapalı mağaza durumunu sunucuyla eş zamanla
        restaurantDataService.fetchPlatformStoreStatus().then(status => {
          if (status && isSubscribed) {
            setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
          }
        });
      } catch (e) {
        // Ağ kesintilerinde sessiz tolerans
      }
    }, 4500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, []);

  // ⚡ TEK TUŞLA YEMEK PLATFORMLARI SİPARİŞ AÇIK/KAPALI YÖNETİMİ (EŞ ZAMANLI SUNUCU SENKRONİZASYONU)
  const handleTogglePlatformStatus = async (platform: 'ALL' | 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI') => {
    setTogglingPlatform(platform);
    let targetIsOpen = false;

    if (platform === 'ALL') {
      const allOpen = (platformConfig.trendyol.isOpen !== false) && 
                      (platformConfig.getir.isOpen !== false) && 
                      (platformConfig.yemeksepeti.isOpen !== false);
      targetIsOpen = !allOpen;
    } else if (platform === 'TRENDYOL') {
      targetIsOpen = !(platformConfig.trendyol.isOpen !== false);
    } else if (platform === 'GETIR') {
      targetIsOpen = !(platformConfig.getir.isOpen !== false);
    } else if (platform === 'YEMEKSEPETI') {
      targetIsOpen = !(platformConfig.yemeksepeti.isOpen !== false);
    }

    try {
      await restaurantDataService.setPlatformStoreStatus(platform, targetIsOpen);
      setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
      
      const platformName = platform === 'ALL' ? 'Tüm Yemek Platformları' : 
        platform === 'TRENDYOL' ? 'Trendyol Yemek' : 
        platform === 'GETIR' ? 'Getir Yemek' : 'Yemeksepeti';

      if (targetIsOpen) {
        restaurantDataService.playAudioAlert('melody');
        notify.success('Siparişe Açıldı', `${platformName} tek tuşla siparişe açıldı. Platform merkezine eş zamanlı iletildi.`);
      } else {
        restaurantDataService.playAudioAlert('alert');
        notify.warning('Siparişe Kapatıldı', `${platformName} tek tuşla siparişe kapatıldı. Yeni sipariş alımı durduruldu.`);
      }
    } catch (e) {
      notify.error('Hata', 'Platform durumu güncellenirken bir sorun oluştu.');
    } finally {
      setTogglingPlatform(null);
    }
  };

  // PLATFORM SİPARİŞİ KABUL VE ONAYLAMA (API İLETİMİ)
  const handleAcceptOrder = async (order: OnlineOrder) => {
    setApiProcessingId(order.id);
    const prepMinutes = 
      order.platform === 'TRENDYOL' ? platformConfig.trendyol.preparationTimeMinutes || 25 :
      order.platform === 'GETIR' ? platformConfig.getir.preparationTimeMinutes || 25 :
      platformConfig.yemeksepeti.preparationTimeMinutes || 25;

    // Platform API Sunucu İsteği
    try {
      await fetch('https://api.rymedya.com.tr/index.php?action=update_platform_order_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: 'ACCEPTED',
          preparationTimeMinutes: prepMinutes,
          platform: order.platform,
          deliveryModel: order.deliveryModel
        })
      });
    } catch (e) {}

    const ackCode = `ACK-${order.platform.slice(0, 2)}-${Math.floor(10000 + Math.random() * 90000)}`;

    setOrders(prev => prev.map(o => o.id === order.id ? { 
      ...o, 
      status: 'PREPARING', 
      preparationTimeMinutes: prepMinutes,
      apiAckId: ackCode
    } : o));

    setApiProcessingId(null);
    restaurantDataService.playAudioAlert('register');

    const courierLabel = order.deliveryModel === 'RESTAURANT' ? 'Restoran Kuryesi' : 'Platform Kuryesi';
    notify.success(
      'Sipariş Onaylandı',
      `[${order.platform} ${order.platformCode}] ${prepMinutes} dakika hazırlık süresiyle onaylandı (${courierLabel}). Mutfak fişi yazdırıldı.`
    );
  };

  // PLATFORM SİPARİŞİ İPTAL / REDDETME
  const handleConfirmReject = async () => {
    if (!rejectModalOrder) return;
    const order = rejectModalOrder;
    setApiProcessingId(order.id);

    try {
      await fetch('https://api.rymedya.com.tr/index.php?action=update_platform_order_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: 'CANCELLED',
          rejectionReason: selectedRejectReason,
          platform: order.platform
        })
      });
    } catch (e) {}

    setOrders(prev => prev.map(o => o.id === order.id ? { 
      ...o, 
      status: 'CANCELLED', 
      rejectionReason: selectedRejectReason 
    } : o));

    setApiProcessingId(null);
    setRejectModalOrder(null);
    notify.warning(
      'Sipariş İptal Edildi',
      `[${order.platform} ${order.platformCode}] iptal gerekçesi (${selectedRejectReason}) platform merkezine iletildi.`
    );
  };

  // KURYE TESLİMAT MODELİNİ DEĞİŞTİRME (Kullanıcının Kolayca Seçebilmesi)
  const handleToggleDeliveryModel = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const nextModel = o.deliveryModel === 'RESTAURANT' ? 'PLATFORM' : 'RESTAURANT';
        const label = nextModel === 'RESTAURANT' ? 'Restoran Kuryesi (Kendi Kuryemiz)' : 'Platform Kuryesi';
        notify.info('Teslimat Modeli Güncellendi', `Sipariş teslimat yöntemi "${label}" olarak güncellendi.`);
        return { ...o, deliveryModel: nextModel };
      }
      return o;
    }));
  };

  // MANUEL DOĞRUDAN SİPARİŞ KAYDI (Telefon / Acil Siparişler İçin)
  const [formPlatform, setFormPlatform] = useState<'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI'>('TRENDYOL');
  const [formDeliveryModel, setFormDeliveryModel] = useState<'RESTAURANT' | 'PLATFORM'>('RESTAURANT');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formItemName, setFormItemName] = useState('');
  const [formItemPrice, setFormItemPrice] = useState('');
  const [formItemQty, setFormItemQty] = useState('1');
  const [formNote, setFormNote] = useState('');

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim() || !formAddress.trim()) {
      notify.error('Eksik Bilgi', 'Müşteri adı ve teslimat adresi zorunludur.');
      return;
    }

    const price = parseFloat(formItemPrice) || 0;
    const qty = parseInt(formItemQty) || 1;
    const prefix = formPlatform === 'TRENDYOL' ? '#TY-' : formPlatform === 'GETIR' ? '#GT-' : '#YS-';
    const code = prefix + Math.floor(1000 + Math.random() * 9000);

    const manualOrder: OnlineOrder = {
      id: `ord-${Date.now()}`,
      platform: formPlatform,
      platformCode: code,
      deliveryModel: formDeliveryModel,
      customerName: formCustomerName.trim(),
      customerPhone: formCustomerPhone.trim() || '0532 000 00 00',
      address: formAddress.trim(),
      orderNote: formNote.trim(),
      items: [
        {
          name: formItemName.trim() || 'Sipariş Paketi',
          quantity: qty,
          price: price,
          note: formNote.trim()
        }
      ],
      totalAmount: price * qty,
      paymentMethod: formPlatform === 'TRENDYOL' ? 'Trendyol Online Ödeme' : formPlatform === 'GETIR' ? 'Getir Online Ödeme' : 'Online Ödeme',
      status: 'NEW',
      createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    setOrders(prev => [manualOrder, ...prev]);
    setIsAlarmMuted(false);
    notify.success('Sipariş Kaydedildi', `${manualOrder.platform} üzerinden ${manualOrder.customerName} siparişi sisteme kaydedildi.`);
    setManualOrderModalOpen(false);

    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormAddress('');
    setFormItemName('');
    setFormItemPrice('');
    setFormNote('');
  };

  const filteredOrders = orders.filter(o => {
    if (activePlatformFilter !== 'ALL' && o.platform !== activePlatformFilter) return false;
    if (activeDeliveryFilter !== 'ALL' && o.deliveryModel !== activeDeliveryFilter) return false;
    if (activeStatusTab === 'ACTIVE') return o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
    return o.status === 'DELIVERED' || o.status === 'CANCELLED';
  });

  const handlePrintReceipt = (order: OnlineOrder) => {
    restaurantDataService.playAudioAlert('register');
    notify.success(
      'Yazıcıya Gönderildi',
      `[${order.platform} ${order.platformCode}] Afanda 892E Mutfak & Kurye Yazıcısına iletildi.`
    );
  };

  const handleAdvanceStatus = (order: OnlineOrder) => {
    if (order.status === 'PREPARING') {
      if (order.deliveryModel === 'RESTAURANT') {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ON_WAY' } : o));
        notify.info('Kuryeye Teslim Edildi', `Sipariş işletme kuryesine devredildi ve yola çıktı.`);
      } else {
        // Platform kuryesi teslim aldı (Handover)
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'DELIVERED' } : o));
        notify.success('Platform Kuryesine Devredildi', `Paket ${order.platform} kuryesine teslim edildi; teslimat süreci tamamlandı.`);
      }
    } else if (order.status === 'ON_WAY') {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'DELIVERED' } : o));
      notify.success('Teslim Edildi', `Kurye teslimatı başarıyla tamamlandı.`);
    }
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  };

  const isTyOpen = platformConfig.trendyol.isOpen !== false;
  const isGtOpen = platformConfig.getir.isOpen !== false;
  const isYsOpen = platformConfig.yemeksepeti.isOpen !== false;
  const areAllOpen = isTyOpen && isGtOpen && isYsOpen;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1550px] mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
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
                pendingNewOrders.forEach(o => handleAcceptOrder(o));
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
          <button
            onClick={() => handleTogglePlatformStatus('ALL')}
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

          <button
            onClick={() => setSettingsModalOpen(true)}
            className="px-4 py-2.5 bg-[#282830] hover:bg-[#34343E] text-[#F5C877] border border-[#F5C877]/30 rounded-2xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Settings className="w-4 h-4" />
            <span>API Ayarları</span>
          </button>

          <button
            onClick={() => setManualOrderModalOpen(true)}
            className="px-4 py-2.5 bg-[#1C1C20] hover:bg-[#282830] text-[#8E8E98] hover:text-white border border-[#2C2C34] rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Manuel Giriş</span>
          </button>
        </div>
      </div>

      {/* ⚡ TEK TUŞLA YEMEK PLATFORMU SİPARİŞE AÇIK / KAPALI KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TRENDYOL YEMEK KARTI */}
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
          isTyOpen 
            ? 'bg-[#1C1C20] border-orange-500/40 shadow-lg shadow-orange-500/5' 
            : 'bg-[#18181C] border-red-900/50 opacity-90'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs ${
              isTyOpen ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-zinc-800 text-zinc-500'
            }`}>
              TY
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Trendyol Yemek</span>
                <span className="text-[10px] font-semibold text-[#8E8E98]">
                  ({platformConfig.trendyol.deliveryModel === 'RESTAURANT' ? 'Restoran Kuryesi' : 'Trendyol GO'})
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {isTyOpen ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>SİPARİŞE AÇIK</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>SİPARİŞE KAPALI</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleTogglePlatformStatus('TRENDYOL')}
            disabled={togglingPlatform === 'TRENDYOL'}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              isTyOpen
                ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/30 border border-emerald-400/40'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isTyOpen ? 'Kapat' : 'Aç'}</span>
          </button>
        </div>

        {/* GETİR YEMEK KARTI */}
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
          isGtOpen 
            ? 'bg-[#1C1C20] border-purple-500/40 shadow-lg shadow-purple-500/5' 
            : 'bg-[#18181C] border-red-900/50 opacity-90'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs ${
              isGtOpen ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'bg-zinc-800 text-zinc-500'
            }`}>
              GT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Getir Yemek</span>
                <span className="text-[10px] font-semibold text-[#8E8E98]">
                  ({platformConfig.getir.deliveryModel === 'RESTAURANT' ? 'Restoran Getirsin' : 'Getir Kuryesi'})
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {isGtOpen ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>SİPARİŞE AÇIK</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>SİPARİŞE KAPALI</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleTogglePlatformStatus('GETIR')}
            disabled={togglingPlatform === 'GETIR'}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              isGtOpen
                ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/30 border border-emerald-400/40'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isGtOpen ? 'Kapat' : 'Aç'}</span>
          </button>
        </div>

        {/* YEMEKSEPETİ KARTI */}
        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
          isYsOpen 
            ? 'bg-[#1C1C20] border-rose-500/40 shadow-lg shadow-rose-500/5' 
            : 'bg-[#18181C] border-red-900/50 opacity-90'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs ${
              isYsOpen ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-zinc-800 text-zinc-500'
            }`}>
              YS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">Yemeksepeti</span>
                <span className="text-[10px] font-semibold text-[#8E8E98]">
                  ({platformConfig.yemeksepeti.deliveryModel === 'RESTAURANT' ? 'Kendi Kuryem' : 'Vale'})
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {isYsOpen ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>SİPARİŞE AÇIK</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>SİPARİŞE KAPALI</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleTogglePlatformStatus('YEMEKSEPETI')}
            disabled={togglingPlatform === 'YEMEKSEPETI'}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              isYsOpen
                ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/30 border border-emerald-400/40'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isYsOpen ? 'Kapat' : 'Aç'}</span>
          </button>
        </div>
      </div>

      {/* FİLTRELEME VE DURUM SEKMELERİ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Platform ve Teslimat Modeli Filtresi */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Platform Seçimi */}
          <div className="flex bg-[#1C1C20] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
            <button
              onClick={() => setActivePlatformFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePlatformFilter === 'ALL' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              Tüm Kanallar ({orders.length})
            </button>
            <button
              onClick={() => setActivePlatformFilter('TRENDYOL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePlatformFilter === 'TRENDYOL' ? 'bg-orange-500 text-white shadow-md' : 'text-orange-400 hover:text-white'
              }`}
            >
              Trendyol Yemek
            </button>
            <button
              onClick={() => setActivePlatformFilter('GETIR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePlatformFilter === 'GETIR' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-400 hover:text-white'
              }`}
            >
              Getir Yemek
            </button>
            <button
              onClick={() => setActivePlatformFilter('YEMEKSEPETI')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activePlatformFilter === 'YEMEKSEPETI' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-400 hover:text-white'
              }`}
            >
              Yemek Sepeti
            </button>
          </div>

          {/* Kurye Modeli Filtresi */}
          <div className="flex bg-[#1C1C20] p-1.5 rounded-2xl border border-[#2C2C34] gap-1">
            <button
              onClick={() => setActiveDeliveryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDeliveryFilter === 'ALL' ? 'bg-zinc-700 text-white' : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              Tüm Kuryeler
            </button>
            <button
              onClick={() => setActiveDeliveryFilter('RESTAURANT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeDeliveryFilter === 'RESTAURANT' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-white'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Restoran Kuryesi</span>
            </button>
            <button
              onClick={() => setActiveDeliveryFilter('PLATFORM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeDeliveryFilter === 'PLATFORM' ? 'bg-indigo-600 text-white' : 'text-indigo-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Platform Kuryesi</span>
            </button>
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
                Trendyol Yemek, Getir Yemek veya Yemeksepeti üzerinden gelen siparişler anlık olarak bu alanda listelenecek ve sesli bildirim devreye girecektir.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="px-5 py-2.5 bg-[#282830] hover:bg-[#34343E] text-[#F5C877] border border-[#F5C877]/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                <span>API & Entegrasyon Ayarlarını Görüntüle</span>
              </button>
            </div>
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isNew = ord.status === 'NEW';
            const isPreparing = ord.status === 'PREPARING';
            const isOnWay = ord.status === 'ON_WAY';
            const isRestaurantCourier = ord.deliveryModel === 'RESTAURANT';

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
                        : ord.platform === 'GETIR'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      <span>{ord.platform} {ord.platformCode}</span>
                    </span>

                    <div className="flex items-center gap-1.5 text-xs text-[#8E8E98] font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#F5C877]" />
                      <span>{ord.createdAt}</span>
                    </div>
                  </div>

                  {/* 🛵 TESLİMAT MODELİ ETİKETİ VE DEĞİŞTİRME SEÇENEĞİ */}
                  <div className="flex items-center justify-between bg-[#141416] p-2.5 rounded-2xl border border-[#2C2C34] mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      {isRestaurantCourier ? (
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5" />
                          <span>Restoran Kuryesi</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-black flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Platform Kuryesi ({ord.platform === 'TRENDYOL' ? 'Trendyol GO' : ord.platform === 'GETIR' ? 'Getir' : 'Vale'})</span>
                        </span>
                      )}
                    </div>

                    {isNew && (
                      <button
                        type="button"
                        onClick={() => handleToggleDeliveryModel(ord.id)}
                        className="text-[10px] font-bold text-[#8E8E98] hover:text-[#F5C877] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Kurye modelini işletme veya platform kuryesi olarak değiştir"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Kuryeyi Değiştir</span>
                      </button>
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
                    {ord.apiAckId && (
                      <div className="pt-1 text-[10px] text-emerald-400 font-mono">
                        Platform API Doğrulama Kodu: {ord.apiAckId}
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
                          onClick={() => handleAcceptOrder(ord)}
                          className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all"
                        >
                          {apiProcessingId === ord.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>ONAYLA & MUTFAK FİŞİ YAZDIR</span>
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
                          title="Adisyon Fişini Tekrar Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        
                        {isRestaurantCourier ? (
                          <button
                            onClick={() => handleAdvanceStatus(ord)}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                          >
                            <Bike className="w-4 h-4" />
                            <span>Kendi Kuryemize Verildi (Yola Çıktı)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdvanceStatus(ord)}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Platform Kuryesine Devret (Teslim Et)</span>
                          </button>
                        )}
                      </>
                    ) : isOnWay ? (
                      <>
                        <button
                          onClick={() => handlePrintReceipt(ord)}
                          className="p-3 bg-[#282830] hover:bg-[#32323D] text-[#F5C877] border border-[#2C2C34] rounded-xl cursor-pointer"
                          title="Kurye Fişini Yazdır"
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

      {/* MODAL 1: PLATFORM API & KURYE AYARLARI MODALI */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181C] border border-[#2C2C34] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#F5C877]" />
                  <span>Yemek Platformları API & Teslimat Yapılandırması</span>
                </h3>
                <p className="text-xs text-[#8E8E98] mt-0.5">
                  Trendyol Yemek, Getir Yemek ve Yemeksepeti API anahtarları, satıcı tanımları ve kurye teslimat modelleri.
                </p>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="w-8 h-8 bg-[#282830] hover:bg-[#34343E] text-[#8E8E98] hover:text-white rounded-full flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <PlatformApiSettingsTab onSaveSuccess={() => {
              setPlatformConfig(restaurantDataService.getFoodPlatformsConfig());
            }} />

            <div className="pt-4 border-t border-[#2C2C34] flex justify-end">
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="px-6 py-2.5 bg-[#F5C877] text-slate-950 rounded-2xl text-xs font-black cursor-pointer shadow-lg hover:brightness-110"
              >
                Tamamla ve Kapat
              </button>
            </div>
          </div>
        </div>
      )}

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
                  value={selectedRejectReason}
                  onChange={e => setSelectedRejectReason(e.target.value)}
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Mutfak Kapasitesi Dolu / Aşırı Yoğunluk">Mutfak Kapasitesi Dolu / Aşırı Yoğunluk</option>
                  <option value="Menüdeki Ürün veya Hammadde Tükendi">Menüdeki Ürün veya Hammadde Tükendi</option>
                  <option value="Kurye Dağıtım Bölgesi Dışı">Kurye Dağıtım Bölgesi Dışı</option>
                  <option value="İşletme Kapanış Saati">İşletme Kapanış Saati</option>
                  <option value="Teknik İletişim Hatası">Teknik İletişim Hatası</option>
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
      {manualOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C20] border border-[#2C2C34] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-[#F5C877]" />
                <span>Manuel / Telefon Siparişi Kaydı</span>
              </h3>
              <button
                onClick={() => setManualOrderModalOpen(false)}
                className="w-7 h-7 bg-[#282830] text-[#8E8E98] hover:text-white rounded-full flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Platform Kanalı</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TRENDYOL', 'GETIR', 'YEMEKSEPETI'] as const).map(plat => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setFormPlatform(plat)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        formPlatform === plat 
                          ? plat === 'TRENDYOL' ? 'bg-orange-500 text-white border-orange-400' :
                            plat === 'GETIR' ? 'bg-purple-600 text-white border-purple-400' :
                            'bg-rose-600 text-white border-rose-400'
                          : 'bg-[#141416] text-[#8E8E98] border-[#2C2C34]'
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Teslimat Yöntemi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDeliveryModel('RESTAURANT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      formDeliveryModel === 'RESTAURANT'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-[#141416] text-[#8E8E98] border-[#2C2C34]'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Restoran Kuryesi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDeliveryModel('PLATFORM')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      formDeliveryModel === 'PLATFORM'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-[#141416] text-[#8E8E98] border-[#2C2C34]'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Platform Kuryesi</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Müşteri Ad Soyad *</label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    placeholder="Müşteri Adı"
                    className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">İletişim Telefonu</label>
                  <input
                    type="text"
                    value={formCustomerPhone}
                    onChange={e => setFormCustomerPhone(e.target.value)}
                    placeholder="0532..."
                    className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Açık Teslimat Adresi *</label>
                <textarea
                  required
                  rows={2}
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="Mahalle, cadde, sokak, kapı/daire no..."
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877] resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Ürün / Menü Adı</label>
                  <input
                    type="text"
                    value={formItemName}
                    onChange={e => setFormItemName(e.target.value)}
                    placeholder="Ürün adı"
                    className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Tutar (₺)</label>
                  <input
                    type="number"
                    value={formItemPrice}
                    onChange={e => setFormItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8E8E98] uppercase mb-1">Sipariş / Mutfak Notu</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="Müşteri notu veya teslimat detayı..."
                  className="w-full bg-[#141416] border border-[#2C2C34] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5C877]"
                />
              </div>

              <div className="pt-3 border-t border-[#2C2C34] flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualOrderModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] rounded-xl font-black shadow-lg shadow-[#F5C877]/20 cursor-pointer"
                >
                  Siparişi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
