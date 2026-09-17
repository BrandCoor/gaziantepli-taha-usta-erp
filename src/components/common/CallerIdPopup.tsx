import React, { useState, useEffect } from 'react';
import { 
  PhoneIncoming, 
  PhoneCall, 
  User, 
  MapPin, 
  Navigation, 
  ShoppingBag, 
  RotateCcw, 
  X, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { callerIdService, ActiveCall } from '../../services/callerIdService';
import { restaurantDataService, CustomerDeliveryInfo, getApiSyncUrl } from '../../services/restaurantDataService';
import { dataService } from '../../services/dataService';

interface CallerIdPopupProps {
  onOpenOrder?: (tableId: string) => void;
}

export const CallerIdPopup: React.FC<CallerIdPopupProps> = ({ onOpenOrder }) => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [registerForms, setRegisterForms] = useState<{ [callId: string]: { name: string; address: string; directions: string; notes: string } }>({});
  const [showOrderHistory, setShowOrderHistory] = useState<{ [callId: string]: boolean }>({});

  useEffect(() => {
    const unsubscribe = callerIdService.subscribe((calls) => {
      setActiveCalls(calls);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (callId: string, field: string, value: string) => {
    setRegisterForms(prev => ({
      ...prev,
      [callId]: {
        ...(prev[callId] || { name: '', address: '', directions: '', notes: '' }),
        [field]: value
      }
    }));
  };

  const handleDismiss = (callId: string) => {
    callerIdService.dismissCall(callId);
  };

  /**
   * Paket Masasına Bağlan ve Siparişi Aç
   */
  const launchOrder = (call: ActiveCall, customerInfo: CustomerDeliveryInfo, prefillItems?: any[]) => {
    const allTables = restaurantDataService.getTables();
    
    // 1. Önce "sec-paket" altındaki boş masayı bul
    let targetTable = allTables.find(t => t.sectionId === 'sec-paket' && t.status === 'EMPTY');
    // 2. Yoksa boş herhangi bir masa al
    if (!targetTable) {
      targetTable = allTables.find(t => t.status === 'EMPTY');
    }

    if (!targetTable) {
      alert('Tüm paket adisyonları ve masalar dolu! Lütfen önce bir adisyonu kapatın.');
      return;
    }

    // Masaya müşteri ve sipariş kalemlerini bağla
    restaurantDataService.updateTableOrder(
      targetTable.id,
      prefillItems || [],
      `Kasa (Hat ${call.line})`,
      customerInfo
    );

    restaurantDataService.setPendingPosTableToOpen(targetTable.id);
    callerIdService.completeCall(call.id);

    if (onOpenOrder) {
      onOpenOrder(targetTable.id);
    }
  };

  /**
   * Kayıtlı Müşteri için Yeni Paket Siparişi Başlat
   */
  const handleStartNewOrder = (call: ActiveCall) => {
    if (!call.customer) return;
    const customerInfo: CustomerDeliveryInfo = {
      customerId: call.customer.id,
      name: call.customer.name,
      phone: call.customer.phone || call.phone,
      address: call.customer.address || '',
      directions: call.customer.directions || '',
      balance: call.customer.balance || 0,
      notes: call.customer.notes || ''
    };
    launchOrder(call, customerInfo);
  };

  /**
   * Kayıtlı Müşterinin Son Siparişini Tekrarla
   */
  const handleRepeatOrder = (call: ActiveCall, order: any) => {
    if (!call.customer) return;
    const customerInfo: CustomerDeliveryInfo = {
      customerId: call.customer.id,
      name: call.customer.name,
      phone: call.customer.phone || call.phone,
      address: call.customer.address || '',
      directions: call.customer.directions || '',
      balance: call.customer.balance || 0,
      notes: call.customer.notes || ''
    };

    const itemsToClone = (order.items || []).map((it: any) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: it.name || it.productName,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      notes: it.notes || it.note || '',
      options: it.options || []
    }));

    launchOrder(call, customerInfo, itemsToClone);
  };

  /**
   * Kayıtsız Numarayı Hızlı Kaydet ve Sipariş Başlat
   */
  const handleRegisterAndOrder = (call: ActiveCall) => {
    const formData = registerForms[call.id] || { name: '', address: '', directions: '', notes: '' };
    if (!formData.name.trim()) {
      alert('Lütfen müşteri ad ve soyadını girin!');
      return;
    }

    // 1. Yerel veritabanına kaydet
    const created = dataService.addCustomer({
      name: formData.name.trim(),
      phone: call.phone,
      address: formData.address.trim(),
      balance: 0,
      notes: `Hat ${call.line} GCallerID ile kaydedildi. ${formData.directions ? 'Tarif: ' + formData.directions : ''}`
    });

    // 2. Bulut phpMyAdmin senkronizasyonu
    const apiUrl = getApiSyncUrl();
    fetch(`${apiUrl}?action=save_customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          id: created.id,
          name: created.name,
          phone: created.phone,
          address: created.address,
          directions: formData.directions,
          balance: 0,
          notes: created.notes
        }
      })
    }).catch(() => {});

    const customerInfo: CustomerDeliveryInfo = {
      customerId: created.id,
      name: created.name,
      phone: created.phone || call.phone,
      address: created.address || '',
      directions: formData.directions || '',
      balance: 0,
      notes: created.notes || ''
    };

    launchOrder(call, customerInfo);
  };

  if (activeCalls.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 max-w-lg w-full pointer-events-none select-none">
      {activeCalls.map((call) => {
        const isLine1 = call.line === 1;
        const isRegistered = !!call.customer;
        const formData = registerForms[call.id] || { name: '', address: '', directions: '', notes: '' };
        const historyOpen = !!showOrderHistory[call.id];

        return (
          <div 
            key={call.id}
            className="pointer-events-auto bg-slate-900/95 border-2 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5"
            style={{
              borderColor: isLine1 ? '#22c55e' : '#3b82f6',
              boxShadow: isLine1 ? '0 10px 25px -5px rgba(34, 197, 94, 0.3)' : '0 10px 25px -5px rgba(59, 130, 246, 0.3)'
            }}
          >
            {/* Header / Hat Bilgisi */}
            <div className={`px-5 py-3.5 flex items-center justify-between text-white ${isLine1 ? 'bg-emerald-600/90' : 'bg-blue-600/90'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <PhoneIncoming className="w-6 h-6 animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm tracking-wider px-2 py-0.5 rounded bg-black/30">
                      {isLine1 ? '🟢 HAT 1' : '🔵 HAT 2'}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                      Gelen Arama
                    </span>
                  </div>
                  <div className="text-lg font-black tracking-wide font-mono mt-0.5">
                    {call.phone}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDismiss(call.id)}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
                title="Kapat / Yanıtlama"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* İçerik */}
            <div className="p-5 space-y-4 text-slate-100">
              {isRegistered ? (
                /* KAYITLI MÜŞTERİ KARTI */
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-bold text-base text-white">
                          {call.customer?.name}
                        </h4>
                      </div>
                      <span className="inline-block text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full mt-1">
                        ✓ Kayıtlı Müşteri
                      </span>
                    </div>

                    {call.customer?.balance !== undefined && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Cari Bakiye</span>
                        <span className={`text-sm font-black ${call.customer.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {call.customer.balance.toFixed(2)} TL
                        </span>
                      </div>
                    )}
                  </div>

                  {call.customer?.address && (
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-start gap-2 text-slate-300">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{call.customer.address}</span>
                      </div>
                      {call.customer.directions && (
                        <div className="flex items-start gap-2 text-amber-300/90 pt-1 border-t border-slate-700/40">
                          <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>Tarif: {call.customer.directions}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Son Siparişler ve Aynı Siparişi Tekrarla */}
                  {call.recentOrders && call.recentOrders.length > 0 && (
                    <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-800/40">
                      <button
                        type="button"
                        onClick={() => setShowOrderHistory(prev => ({ ...prev, [call.id]: !prev[call.id] }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-700/40 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          Müşterinin Son {call.recentOrders.length} Siparişi
                        </span>
                        {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {/* En son sipariş hızlı kartı */}
                      <div className="p-3 bg-slate-800/80 border-t border-slate-700/60 flex items-center justify-between">
                        <div className="text-xs">
                          <div className="text-slate-400 text-[11px]">Son Siparişi:</div>
                          <div className="font-semibold text-white truncate max-w-[200px]">
                            {call.recentOrders[0].items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Paket Sipariş'}
                          </div>
                          <div className="text-emerald-400 font-bold text-xs mt-0.5">
                            {call.recentOrders[0].totalAmount.toFixed(2)} TL
                          </div>
                        </div>

                        <button
                          onClick={() => handleRepeatOrder(call, call.recentOrders[0])}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Aynı Siparişi Tekrarla
                        </button>
                      </div>

                      {/* Genişletilmiş Sipariş Geçmişi */}
                      {historyOpen && (
                        <div className="p-3 space-y-2 border-t border-slate-700/60 max-h-40 overflow-y-auto">
                          {call.recentOrders.slice(1).map((ord, idx) => (
                            <div key={ord.id || idx} className="p-2 bg-slate-900/60 rounded-lg text-xs flex items-center justify-between">
                              <div>
                                <span className="text-slate-400 text-[10px] block">
                                  {new Date(ord.createdAt).toLocaleDateString('tr-TR')}
                                </span>
                                <span className="text-slate-200">
                                  {ord.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRepeatOrder(call, ord)}
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] font-medium text-white"
                              >
                                Tekrarla
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Eylemler */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleStartNewOrder(call)}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
                        isLine1 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Yeni Paket Siparişi Başlat
                    </button>
                    <button
                      onClick={() => handleDismiss(call.id)}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              ) : (
                /* KAYITSIZ NUMARA FORMU */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-xl p-2.5 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Bu numara rehberde kayıtlı değil. Hızlıca kaydedip siparişi açabilirsiniz:</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Müşteri Ad Soyad *
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Mehmet Çelik"
                        value={formData.name}
                        onChange={(e) => handleInputChange(call.id, 'name', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Teslimat Adresi *
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Mahalle, Cadde, Sokak, No, Daire..."
                        value={formData.address}
                        onChange={(e) => handleInputChange(call.id, 'address', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Adres / Yol Tarifi (Opsiyonel)
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Eczane yanı, 3. kat"
                        value={formData.directions}
                        onChange={(e) => handleInputChange(call.id, 'directions', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleRegisterAndOrder(call)}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Kaydet ve Sipariş Başlat
                    </button>
                    <button
                      onClick={() => handleDismiss(call.id)}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
