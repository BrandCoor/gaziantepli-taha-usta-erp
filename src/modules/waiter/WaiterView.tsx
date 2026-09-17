import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  Receipt, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Layers,
  FileText,
  User,
  Coffee,
  X
} from 'lucide-react';
import { getApiSyncUrl, restaurantDataService } from '../../services/restaurantDataService';
import { deviceService } from '../../services/deviceService';
import { realtimeSyncService } from '../../services/realtimeSyncService';
import { notify } from '../../services/notificationService';
import { sortTablesNaturally } from '../../utils/tableSorting';

interface WaiterViewProps {
  waiterUser: {
    id: string;
    ad: string;
    rol?: string;
  };
  onLogout: () => void;
  onBackToKasa?: () => void;
}

interface TableData {
  id: string;
  sectionId: string;
  name: string;
  status: 'EMPTY' | 'OCCUPIED' | 'BILL_REQUESTED';
  order?: {
    id?: string;
    items?: Array<{
      name: string;
      price: number;
      quantity: number;
      note?: string;
    }>;
    totalAmount?: number;
    createdAt?: string;
  };
}

interface ProductData {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  isAvailable?: boolean;
}

interface CategoryData {
  id: string;
  name: string;
  color?: string;
}

interface SectionData {
  id: string;
  name: string;
}

export const WaiterView: React.FC<WaiterViewProps> = ({ waiterUser, onLogout, onBackToKasa }) => {
  const [sections, setSections] = useState<SectionData[]>(() => (restaurantDataService.getSections() as any) || []);
  const [tables, setTables] = useState<TableData[]>(() => (restaurantDataService.getTables() as any) || []);
  const [products, setProducts] = useState<ProductData[]>(() => (restaurantDataService.getProducts() as any) || []);
  const [categories, setCategories] = useState<CategoryData[]>(() => (restaurantDataService.getCategories() as any) || []);
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');

  // Sipariş Modalı State'leri
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [cartItems, setCartItems] = useState<Array<{
    product: ProductData;
    quantity: number;
    note: string;
  }>>([]);
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString('tr-TR'));
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  // 1. Yerel ve Çapraz Sekme Gerçek Zamanlı Dinleyiciler (0ms Gecikme)
  useEffect(() => {
    const unsubData = restaurantDataService.subscribe(() => {
      const freshTables = (restaurantDataService.getTables() as any) || [];
      setTables(freshTables);
      setSections((restaurantDataService.getSections() as any) || []);
      setCategories((restaurantDataService.getCategories() as any) || []);
      setProducts((restaurantDataService.getProducts() as any) || []);

      if (selectedTable) {
        const freshSelected = freshTables.find((t: any) => t.id === selectedTable.id);
        if (freshSelected) {
          if (freshSelected.status === 'EMPTY' && selectedTable.status !== 'EMPTY') {
            notify.info('Masa Kapatıldı', `[${selectedTable.name}] kasada tahsil edilip kapatıldı.`);
            setSelectedTable(null);
            setCartItems([]);
          } else {
            setSelectedTable(freshSelected);
          }
        }
      }
    });

    const unsubRealtime = realtimeSyncService.subscribe((event) => {
      if (event.type === 'TABLES_UPDATED') {
        const freshTables = (restaurantDataService.getTables() as any) || [];
        setTables(freshTables);
        if (selectedTable) {
          const freshSelected = freshTables.find((t: any) => t.id === selectedTable.id);
          if (freshSelected) {
            if (freshSelected.status === 'EMPTY' && selectedTable.status !== 'EMPTY') {
              notify.info('Masa Kapatıldı', `[${selectedTable.name}] kasada tahsil edilip kapatıldı.`);
              setSelectedTable(null);
              setCartItems([]);
            } else {
              setSelectedTable(freshSelected);
            }
          }
        }
      }
    });

    return () => {
      unsubData();
      unsubRealtime();
    };
  }, [selectedTable?.id, selectedTable?.status]);

  // 2. MySQL / Bulut Canlı Senkronizasyon (Ağ ve Uzak Cihazlar İçin)
  const fetchLiveState = async () => {
    try {
      const baseUrl = getApiSyncUrl();
      const url = baseUrl.includes('?') 
        ? `${baseUrl}&action=get_live_state` 
        : `${baseUrl}?action=get_live_state`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('API bağlantı hatası');
      const data = await res.json();

      if (data && data.success) {
        if (Array.isArray(data.sections) && data.sections.length > 0) setSections(data.sections);
        if (Array.isArray(data.tables) && data.tables.length > 0) {
          setTables(data.tables);
          // Eğer bir masa açıksa ve kasadan tahsil edilip kapatıldıysa modalı güncelle
          if (selectedTable) {
            const updatedCurrent = data.tables.find((t: TableData) => t.id === selectedTable.id);
            if (updatedCurrent) {
              if (updatedCurrent.status === 'EMPTY' && selectedTable.status !== 'EMPTY') {
                notify.info('Masa Kapatıldı', `[${selectedTable.name}] kasada kapatıldı.`);
                setSelectedTable(null);
                setCartItems([]);
              } else {
                setSelectedTable(prev => prev ? { ...prev, ...updatedCurrent } : null);
              }
            }
          }
        }
        if (Array.isArray(data.products) && data.products.length > 0) setProducts(data.products);
        if (Array.isArray(data.categories) && data.categories.length > 0) setCategories(data.categories);

        setIsLiveConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      setIsLiveConnected(false);
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 2000);
    return () => clearInterval(interval);
  }, [selectedTable?.id]);

  // Filtrelenmiş Masalar (Küçükten Büyüğe Sıralı)
  const filteredTables = useMemo(() => {
    const list = activeSectionId === 'ALL' ? tables : tables.filter(t => t.sectionId === activeSectionId);
    return sortTablesNaturally(list, sections);
  }, [tables, activeSectionId, sections]);

  // Filtrelenmiş Ürünler
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
      const matchSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchSearch && p.isAvailable !== false;
    });
  }, [products, selectedCategoryId, productSearch]);

  // Masaya Tıklama (Adisyon Aç)
  const handleOpenTable = (tbl: TableData) => {
    setSelectedTable(tbl);
    setCartItems([]);
    setOrderNote('');
    setProductSearch('');
    setSelectedCategoryId('ALL');
  };

  // Sepete Ürün Ekle
  const handleAddToCart = (product: ProductData) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === product.id && item.note === '');
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1, note: '' }];
    });
  };

  // Sepetten Ürün Azalt / Kaldır
  const handleRemoveFromCart = (productId: string, note: string) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === productId && item.note === note);
      if (existingIdx > -1) {
        const currentQty = prev[existingIdx].quantity;
        if (currentQty > 1) {
          const updated = [...prev];
          updated[existingIdx].quantity -= 1;
          return updated;
        } else {
          return prev.filter((_, idx) => idx !== existingIdx);
        }
      }
      return prev;
    });
  };

  // Sepet Toplam Tutarı
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cartItems]);

  // Mevcut Masadaki Açık Tutar
  const existingOrderTotal = useMemo(() => {
    if (!selectedTable?.order?.items) return 0;
    return selectedTable.order.items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  }, [selectedTable]);

  // Siparişi Onayla ve Anında Kasa & Mutfağa İlet
  const handleSubmitOrder = async () => {
    if (!selectedTable || cartItems.length === 0) return;

    setSubmitting(true);
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tableName = selectedTable.name;
    const tableId = selectedTable.id;

    const orderPayload = {
      id: orderId,
      type: 'ORDER',
      tableId: tableId,
      tableName: tableName,
      waiterName: waiterUser.ad,
      waiterId: waiterUser.id,
      items: cartItems.map(it => ({
        productId: it.product.id,
        productName: it.product.name,
        price: it.product.price,
        quantity: it.quantity,
        note: it.note || (orderNote ? orderNote : '')
      })),
      totalAmount: cartTotal,
      orderNote: orderNote,
      timestamp: Date.now()
    };

    try {
      // 1. ANINDA YEREL GÜNCELLEME (0ms gecikme ile masa doluya döner ve ürünler eklenir)
      restaurantDataService.processIncomingOrder(orderPayload);

      // 2. TÜM AÇIK KASA VE CİHAZ PENCERELERİNE ANINDA YAYINLA
      realtimeSyncService.broadcastOrderSubmitted(orderPayload, 'WAITER');

      // 3. MERKEZİ SUNUCUYA İLET
      // Sonucu beklemeden "başarılı" demek, ağ kesintisinde siparişin sessizce
      // kaybolmasına ve garsonun bundan haberi olmamasına yol açıyordu.
      const baseUrl = getApiSyncUrl();
      const url = baseUrl.includes('?')
        ? `${baseUrl}&action=send_order`
        : `${baseUrl}?action=send_order`;

      let deliveredToCloud = false;
      let deliveryError = 'Sunucuya ulaşılamadı.';
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        deliveredToCloud = res.ok;
        if (!res.ok) deliveryError = `Sunucu ${res.status} kodu döndürdü.`;
      } catch (err: any) {
        deliveryError = err?.message || deliveryError;
      }

      setCartItems([]);
      setOrderNote('');
      setSelectedTable(null);

      if (deliveredToCloud) {
        notify.success('Sipariş İletildi', `[${tableName}] siparişi kaydedildi ve mutfağa aktarıldı.`);
      } else {
        notify.error(
          'DİKKAT: Sipariş Kasaya İletilemedi',
          `[${tableName}] siparişi bu cihaza kaydedildi ancak kasaya/mutfağa ULAŞMADI (${deliveryError}) Siparişi kasaya sözlü olarak bildirin.`
        );
      }
    } catch (e: any) {
      notify.error('Hata', 'Sipariş işlenirken bir sorun oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hesap İste / Fiş Bas Talebi Gönder
  const handleRequestBill = async () => {
    if (!selectedTable) return;
    const tableId = selectedTable.id;
    const tableName = selectedTable.name;

    try {
      // 1. ANINDA YEREL MASAYI HESAP İSTENDİYE ÇEVİR
      restaurantDataService.setBillRequested(tableId);

      // 2. KASAYA ANINDA YAYINLA
      realtimeSyncService.broadcastBillRequested(tableId, tableName, waiterUser.ad);

      notify.info('Hesap İstendi', `[${tableName}] için kasaya hesap fişi bildirimi gönderildi.`);
      setSelectedTable(null);

      // 3. BULUT SUNUCUSUNA ARKA PLANDA BİLDİR
      const baseUrl = getApiSyncUrl();
      const url = baseUrl.includes('?') 
        ? `${baseUrl}&action=send_order` 
        : `${baseUrl}?action=send_order`;

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BILL_REQUEST',
          tableId: tableId,
          tableName: tableName,
          waiterName: waiterUser.ad
        })
      }).catch(() => {});
    } catch (e) {
      notify.error('Hata', 'Hesap talebi kasaya iletilemedi.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121214] text-white flex flex-col font-sans select-none pb-12">
      {/* Üst Sabit Bar */}
      <header className="sticky top-0 z-30 bg-[#18181C]/95 backdrop-blur-md border-b border-[#2A2A34] px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#F5C877]">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
              <span>{waiterUser.ad}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md font-mono">
                GARSON
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#8E8E98]">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
              <span>{isLiveConnected ? 'Canlı MySQL Bağlantısı' : 'Bağlantı Kesildi'}</span>
              <span className="font-mono text-[#606068]">({lastSyncTime})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveState}
            className="p-2 rounded-xl bg-[#22222A] hover:bg-[#2A2A34] border border-[#343440] text-[#A0A0AA] hover:text-white cursor-pointer transition-colors"
            title="Masaları Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onBackToKasa && (
            <button
              onClick={onBackToKasa}
              className="px-2.5 py-1.5 rounded-xl bg-[#22222A] hover:bg-[#2A2A34] border border-[#343440] text-[#E4E4E8] font-bold text-xs cursor-pointer transition-colors"
              title="Kasa Paneline Dön"
            >
              <span>Kasa Paneli</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </header>

      {/* Bölüm Tabları (Salon, Teras, Bahçe) */}
      <nav className="px-4 pt-3 pb-1 overflow-x-auto no-scrollbar flex gap-2">
        <button
          onClick={() => setActiveSectionId('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
            activeSectionId === 'ALL'
              ? 'bg-[#F5C877] text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-[#1C1C22] text-[#A0A0AA] hover:text-white border border-[#2C2C34]'
          }`}
        >
          Tüm Masalar ({tables.length})
        </button>

        {sections.map(sec => {
          const count = tables.filter(t => t.sectionId === sec.id).length;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSectionId(sec.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                activeSectionId === sec.id
                  ? 'bg-[#F5C877] text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#1C1C22] text-[#A0A0AA] hover:text-white border border-[#2C2C34]'
              }`}
            >
              {sec.name} ({count})
            </button>
          );
        })}
      </nav>

      {/* Masalar Izgarası (Grid) */}
      <main className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredTables.map(tbl => {
          const isOccupied = tbl.status === 'OCCUPIED';
          const isBillReq = tbl.status === 'BILL_REQUESTED';
          const itemsCount = tbl.order?.items?.reduce((c, i) => c + i.quantity, 0) || 0;
          const totalAmount = tbl.order?.totalAmount || 0;

          return (
            <button
              key={tbl.id}
              onClick={() => handleOpenTable(tbl)}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all active:scale-95 cursor-pointer relative overflow-hidden shadow-sm ${
                isBillReq
                  ? 'bg-amber-950/40 border-amber-500/70 text-amber-200 ring-2 ring-amber-500/50'
                  : isOccupied
                  ? 'bg-rose-950/40 border-rose-600/70 text-rose-200'
                  : 'bg-emerald-950/25 border-emerald-600/40 hover:border-emerald-500 text-emerald-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="font-black text-sm tracking-tight text-white">{tbl.name}</span>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                    isBillReq
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : isOccupied
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {isBillReq ? 'HESAP' : isOccupied ? 'DOLU' : 'BOŞ'}
                </span>
              </div>

              <div className="space-y-0.5">
                {isOccupied || isBillReq ? (
                  <>
                    <div className="text-base font-mono font-black text-white">
                      ₺{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-[#A0A0AA] flex items-center gap-1 font-mono">
                      <span>{itemsCount} ürün</span>
                      {tbl.order?.createdAt && (
                        <span>• {tbl.order.createdAt.substring(11, 16)}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Sipariş Al</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </main>

      {/* ========================================================================= */}
      {/* SİPARİŞ VE ADİSYON DÜZENLEME MODALI / DRAWER */}
      {/* ========================================================================= */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181C] rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#2C2C34] overflow-hidden">
            {/* Modal Üst Başlık */}
            <div className="p-4 border-b border-[#2A2A34] flex items-center justify-between bg-[#141416]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">{selectedTable.name}</h2>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      selectedTable.status === 'OCCUPIED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {selectedTable.status === 'OCCUPIED' ? 'Açık Adisyon' : 'Yeni Adisyon'}
                  </span>
                </div>
                <p className="text-[11px] text-[#8E8E98] mt-0.5">Garson: {waiterUser.ad}</p>
              </div>

              <button
                onClick={() => setSelectedTable(null)}
                className="w-8 h-8 rounded-full bg-[#24242C] hover:bg-[#30303A] text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Gövdesi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Masadaki Mevcut Kayıtlı Siparişler (Eğer varsa) */}
              {selectedTable.order?.items && selectedTable.order.items.length > 0 && (
                <div className="bg-[#141416] p-3.5 rounded-2xl border border-[#2C2C34] space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-[#F5C877]">
                    <span>Kayıtlı Masadaki Siparişler:</span>
                    <span className="font-mono text-white">₺{existingOrderTotal.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-[#24242C] max-h-36 overflow-y-auto pr-1">
                    {selectedTable.order.items.map((it, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-400 font-mono w-5">{it.quantity}x</span>
                          <span className="text-white">{it.name}</span>
                          {it.note && <span className="text-[10px] text-amber-300 italic">({it.note})</span>}
                        </div>
                        <span className="font-mono text-[#A0A0AA]">₺{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Yeni Eklenecek Ürün Sepeti */}
              {cartItems.length > 0 && (
                <div className="bg-amber-950/20 p-3.5 rounded-2xl border border-amber-500/40 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-amber-300">
                    <span>Bu Turda Eklenecekler:</span>
                    <span className="font-mono text-base text-white">₺{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-[#2C2C34] max-h-36 overflow-y-auto pr-1">
                    {cartItems.map((c, idx) => (
                      <div key={idx} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <div className="text-white font-bold">{c.product.name}</div>
                          <div className="text-[10px] text-[#8E8E98] font-mono">
                            ₺{c.product.price.toFixed(2)} x {c.quantity}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRemoveFromCart(c.product.id, c.note)}
                            className="w-7 h-7 rounded-lg bg-[#2A2A36] text-amber-300 flex items-center justify-center cursor-pointer hover:bg-[#343444]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-black text-white w-5 text-center">{c.quantity}</span>
                          <button
                            onClick={() => handleAddToCart(c.product)}
                            className="w-7 h-7 rounded-lg bg-[#2A2A36] text-amber-300 flex items-center justify-center cursor-pointer hover:bg-[#343444]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Genel Sipariş Notu */}
                  <div>
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="Mutfak için özel not (Örn: Acısız olsun, az pişmiş)..."
                      className="w-full mt-1 px-3 py-2 bg-[#121214] border border-[#383844] rounded-xl text-xs text-white placeholder-[#70707A] focus:outline-none focus:border-[#F5C877]"
                    />
                  </div>
                </div>
              )}

              {/* Ürün Arama & Kategori Seçimi */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#70707A] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Menüde ürün ara..."
                    className="w-full pl-9 pr-3 py-2 bg-[#141416] border border-[#2C2C34] rounded-xl text-xs text-white placeholder-[#70707A] focus:outline-none focus:border-[#F5C877]"
                  />
                </div>

                {/* Kategori Filtresi */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    onClick={() => setSelectedCategoryId('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                      selectedCategoryId === 'ALL'
                        ? 'bg-[#F5C877] text-slate-950'
                        : 'bg-[#202028] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    Tümü
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'bg-[#F5C877] text-slate-950'
                          : 'bg-[#202028] text-[#A0A0AA] hover:text-white'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ürünler Listesi */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {filteredProducts.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => handleAddToCart(prod)}
                    className="p-2.5 bg-[#141416] hover:bg-[#202026] active:scale-95 border border-[#2A2A34] hover:border-amber-500/50 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm"
                  >
                    <div className="text-xs font-black text-white line-clamp-1">{prod.name}</div>
                    <div className="mt-1.5 flex justify-between items-center">
                      <span className="font-mono text-amber-300 text-xs font-black">
                        ₺{prod.price.toFixed(2)}
                      </span>
                      <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Alt Aksiyon Butonları */}
            <div className="p-4 border-t border-[#2A2A34] bg-[#141416] flex gap-2">
              {/* Hesap İste Butonu (Yalnızca masada kayıtlı sipariş varsa) */}
              {selectedTable.status === 'OCCUPIED' && (
                <button
                  onClick={handleRequestBill}
                  className="py-3 px-3 bg-[#24242E] hover:bg-[#2F2F3C] border border-[#383848] text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Hesap İste</span>
                </button>
              )}

              {/* Siparişi Onayla & Mutfağa İlet */}
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || cartItems.length === 0}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                  cartItems.length > 0 && !submitting
                    ? 'bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-slate-950 shadow-amber-500/20 hover:brightness-110'
                    : 'bg-[#24242C] text-[#606068] cursor-not-allowed border border-[#30303A]'
                }`}
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Siparişi Mutfağa İlet {cartTotal > 0 && `(₺${cartTotal.toFixed(2)})`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
