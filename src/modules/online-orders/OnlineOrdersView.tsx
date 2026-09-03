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
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Volume2
} from 'lucide-react';
import { restaurantDataService } from '../../services/restaurantDataService';

interface OnlineOrder {
  id: string;
  platform: 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI';
  platformCode: string;
  customerName: string;
  customerPhone: string;
  address: string;
  orderNote?: string;
  items: { name: string; quantity: number; price: number; note?: string }[];
  totalAmount: number;
  paymentMethod: string;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'ON_WAY' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
}

export const OnlineOrdersView: React.FC = () => {
  const [activePlatformFilter, setActivePlatformFilter] = useState<'ALL' | 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI'>('ALL');
  const [activeStatusTab, setActiveStatusTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  
  // Örnek Online Sipariş Havuzu
  const [orders, setOrders] = useState<OnlineOrder[]>([
    {
      id: 'onl-1',
      platform: 'TRENDYOL',
      platformCode: '#TY-9842',
      customerName: 'Emre Kılıç',
      customerPhone: '0533 111 22 33',
      address: 'İbrahimli Mah. 23. Sokak No:12 D:4 Şehitkamil / Gaziantep',
      orderNote: 'Zil çalışmıyor lütfen telefon ediniz. Lavaşlar sıcak olsun.',
      items: [
        { name: 'Adana Kebap (Porsiyon)', quantity: 2, price: 340, note: 'Bol acılı' },
        { name: 'Lahmacun (Çıtır)', quantity: 4, price: 110, note: 'Yeşillik ve limon bol' },
        { name: 'Kutu Kola', quantity: 2, price: 45 }
      ],
      totalAmount: 1210,
      paymentMethod: 'Online Kredi Kartı',
      status: 'NEW',
      createdAt: '15:24'
    },
    {
      id: 'onl-2',
      platform: 'GETIR',
      platformCode: '#GT-4102',
      customerName: 'Zeynep Kaya',
      customerPhone: '0544 555 66 77',
      address: 'Gazimuhtarpaşa Bulv. Kent Plaza K:5 No:18',
      orderNote: 'Soğansız olsun lütfen.',
      items: [
        { name: 'Kuşbaşılı Kaşarlı Pide', quantity: 1, price: 290 },
        { name: 'Açık Yayık Ayran', quantity: 2, price: 35 }
      ],
      totalAmount: 360,
      paymentMethod: 'Getir Online Ödeme',
      status: 'PREPARING',
      createdAt: '15:10'
    },
    {
      id: 'onl-3',
      platform: 'YEMEKSEPETI',
      platformCode: '#YS-8831',
      customerName: 'Murat Arslan',
      customerPhone: '0555 999 88 77',
      address: 'Batıkent Mah. Kürşat Tüzmen Cad. No:8',
      items: [
        { name: 'Karışık Kebap', quantity: 1, price: 520, note: 'Lavaş ekstra' },
        { name: 'Künefe (Antep Fıstıklı)', quantity: 1, price: 190 }
      ],
      totalAmount: 710,
      paymentMethod: 'Kapıda Kredi Kartı',
      status: 'NEW',
      createdAt: '15:28'
    }
  ]);

  const filteredOrders = orders.filter(o => {
    if (activePlatformFilter !== 'ALL' && o.platform !== activePlatformFilter) return false;
    if (activeStatusTab === 'ACTIVE') return o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
    return o.status === 'DELIVERED' || o.status === 'CANCELLED';
  });

  const handleUpdateStatus = (orderId: string, newStatus: OnlineOrder['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const handlePrintKitchenSlip = (order: OnlineOrder) => {
    alert(
      `🖨️ [AFANDA 892E - MUTFAK & KURYEFİŞİ BASILDI]\n` +
      `Platform: ${order.platform} (${order.platformCode})\n` +
      `Müşteri: ${order.customerName} - ${order.customerPhone}\n` +
      `Adres: ${order.address}\n` +
      `Tutar: ${order.totalAmount} TL\n\n` +
      `Fırın ve Kebap Ocağı yazıcılarına fişler başarıyla gönderildi!`
    );
  };

  const formatMoney = (val: number) => {
    return (Number(val) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none font-sans text-[#FAF7F2] bg-[#141416] min-h-screen">
      
      {/* ÜST BAŞLIK & ENTEGRASYON KANALLARI */}
      <div className="bg-[#1C1C20] rounded-3xl p-6 border border-[#2C2C34] shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-2xl shadow-lg shadow-[#F5C877]/10">
            <Bike className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Online Yemek Platformları</span>
              <span className="px-2.5 py-0.5 bg-[#F5C877]/15 text-[#F5C877] border border-[#F5C877]/30 rounded-full text-[10px] font-black uppercase">CANLI ENTEGRASYON</span>
            </h1>
            <p className="text-xs text-[#8E8E98] font-medium">Trendyol Yemek, Getir Yemek ve Yemeksepeti siparişleri tek ekranda.</p>
          </div>
        </div>

        {/* Platform Filtreleme Butonları */}
        <div className="flex bg-[#141416] p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
          <button
            onClick={() => setActivePlatformFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activePlatformFilter === 'ALL' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            Tümü ({orders.length})
          </button>
          <button
            onClick={() => setActivePlatformFilter('TRENDYOL')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activePlatformFilter === 'TRENDYOL' ? 'bg-orange-500 text-white shadow-md' : 'text-orange-400 hover:text-white'
            }`}
          >
            Trendyol
          </button>
          <button
            onClick={() => setActivePlatformFilter('GETIR')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activePlatformFilter === 'GETIR' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-400 hover:text-white'
            }`}
          >
            Getir
          </button>
          <button
            onClick={() => setActivePlatformFilter('YEMEKSEPETI')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activePlatformFilter === 'YEMEKSEPETI' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-400 hover:text-white'
            }`}
          >
            Yemeksepeti
          </button>
        </div>
      </div>

      {/* SİPARİŞ LİSTESİ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOrders.length === 0 ? (
          <div className="col-span-3 p-16 text-center text-xs text-[#8E8E98] bg-[#1C1C20] rounded-3xl border border-[#2C2C34]">
            Bekleyen online platform siparişi bulunmuyor.
          </div>
        ) : (
          filteredOrders.map((ord) => (
            <div 
              key={ord.id} 
              className={`bg-[#1C1C20] rounded-3xl border p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all ${
                ord.status === 'NEW' 
                  ? 'border-[#F5C877] shadow-[#F5C877]/10 animate-pulse' 
                  : 'border-[#2C2C34]'
              }`}
            >
              <div>
                {/* Üst Platform Rozeti */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide uppercase ${
                    ord.platform === 'TRENDYOL'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                      : ord.platform === 'GETIR'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {ord.platform} {ord.platformCode}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-[#8E8E98] font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#F5C877]" />
                    <span>{ord.createdAt}</span>
                  </div>
                </div>

                {/* Müşteri ve Adres */}
                <div className="p-3.5 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-1.5 text-xs">
                  <div className="font-black text-white text-sm">{ord.customerName}</div>
                  <div className="text-[11px] text-[#F5C877] font-mono font-bold">{ord.customerPhone}</div>
                  <div className="text-[11px] text-[#8E8E98] leading-relaxed line-clamp-2">{ord.address}</div>
                  {ord.orderNote && (
                    <div className="pt-1.5 border-t border-[#2C2C34] text-[11px] text-amber-300 font-medium">
                      ⚠️ Not: {ord.orderNote}
                    </div>
                  )}
                </div>

                {/* Ürünler */}
                <div className="mt-3 space-y-1.5 divide-y divide-[#2C2C34]/50 text-xs">
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
                  <span className="text-[#8E8E98]">{ord.paymentMethod}</span>
                  <span className="font-mono font-black text-lg text-[#F5C877]">{formatMoney(ord.totalAmount)}</span>
                </div>

                <div className="flex gap-2">
                  {ord.status === 'NEW' ? (
                    <>
                      <button
                        onClick={() => {
                          handleUpdateStatus(ord.id, 'PREPARING');
                          handlePrintKitchenSlip(ord);
                        }}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Onayla & Mutfak Fişi Bas</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(ord.id, 'CANCELLED')}
                        className="p-3 bg-rose-950 hover:bg-rose-900 text-rose-400 rounded-xl border border-rose-800/40 cursor-pointer"
                        title="Reddet"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handlePrintKitchenSlip(ord)}
                        className="p-3 bg-[#282830] hover:bg-[#32323D] text-[#F5C877] border border-[#2C2C34] rounded-xl cursor-pointer"
                        title="Fişi Tekrar Bas"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(ord.id, 'DELIVERED')}
                        className="flex-1 py-3 bg-[#F5C877] hover:bg-[#D4A351] text-[#141416] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Teslim Edildi Olarak Tamamla</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};