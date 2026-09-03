import React, { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  Users, 
  Clock, 
  Flame, 
  Printer, 
  Search, 
  XCircle, 
  AlertTriangle, 
  Ban, 
  ArrowRight, 
  ArrowRightLeft, 
  Trash2, 
  FileText, 
  MessageSquare, 
  Percent, 
  Lock, 
  CheckCircle2, 
  Building2, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Sparkles, 
  Edit3, 
  Tag, 
  Gift,
  Bike,
  MapPin,
  Phone
} from 'lucide-react';
import { 
  restaurantDataService, 
  TableState, 
  ProductConfig, 
  CategoryConfig, 
  SectionConfig, 
  OrderItemState,
  PaymentMethodConfig 
} from '../../services/restaurantDataService';
import { dataService, Customer } from '../../services/dataService';
import { notify } from '../../services/notificationService';

const CANCEL_REASONS = [
  'Müşteri Siparişten Vazgeçti',
  'Yanlış Ürün / Masa Seçimi Yapıldı',
  'Mutfakta / Ocakta Ürün Tükendi',
  'Müşteri Beklemek İstemedi (Gecikme)',
  'Ürün Yanık / Hatalı Hazırlandı',
  'Masa İptal Edildi (Ayrıldı)',
  'Diğer (Özel Açıklama)'
];

const KASA_QUICK_TAGS = ['🔥 Önden Gelsin', '🍲 Çorba Arkası', '🍽️ Birlikte Gelsin', '🌶️ Acılı', 'Acısız', '🧅 Soğansız', '🌿 Bol Yeşillik', 'Lavaş Çift', '🥩 Az Pişmiş', 'Çok Pişmiş', '🧊 Buzlu', '☕ Sıcak', 'Tuzsuz', 'Ayrı Tabak', '⚡ Acele / Misafir'];

interface PaymentEntry {
  id: string;
  type: string;
  amount: number;
  customerId?: string;
  customerName?: string;
}

interface PosViewProps {
  autoOpenTableId?: string | null;
  onClearAutoOpen?: () => void;
}

export const PosView: React.FC<PosViewProps> = ({ autoOpenTableId, onClearAutoOpen }) => {
  const [sections, setSections] = useState<SectionConfig[]>(restaurantDataService.getSections() || []);
  const [tables, setTables] = useState<TableState[]>(restaurantDataService.getTables() || []);
  const [categories, setCategories] = useState<CategoryConfig[]>(restaurantDataService.getCategories() || []);
  const [products, setProducts] = useState<ProductConfig[]>(restaurantDataService.getProducts() || []);
  const [customers, setCustomers] = useState<Customer[]>(dataService.getCustomers() || []);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(restaurantDataService.getPaymentMethods() || []);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || 'sec-salon');
  const [selectedTable, setSelectedTable] = useState<TableState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [orderItems, setOrderItems] = useState<OrderItemState[]>([]);
  const [generalOrderNote, setGeneralOrderNote] = useState('');

  // HIZLI NOT MODALI STATE
  const [itemNoteModal, setItemNoteModal] = useState<{ open: boolean; itemIndex: number; noteText: string }>({ open: false, itemIndex: -1, noteText: '' });

  // PARÇALI HESAP MODALI STATE
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [calcInput, setCalcInput] = useState<string>('');
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [selectedPayItemIndices, setSelectedPayItemIndices] = useState<number[]>([]);

  // CARİ POPUP STATE
  const [cariModalOpen, setCariModalOpen] = useState(false);
  const [cariSearchQuery, setCariSearchQuery] = useState('');

  // MASA TAŞIMA MODALI STATE
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [targetTransferTableId, setTargetTransferTableId] = useState('');

  // İPTAL MODALI STATE
  const [itemCancelModal, setItemCancelModal] = useState<{
    open: boolean;
    itemIndex: number;
    maxQty: number;
    cancelQty: number;
    selectedReason: string;
    customNote: string;
  }>({
    open: false,
    itemIndex: -1,
    maxQty: 1,
    cancelQty: 1,
    selectedReason: CANCEL_REASONS[0],
    customNote: ''
  });

  const [tableCancelModal, setTableCancelModal] = useState<{ open: boolean; selectedReason: string; customNote: string }>({
    open: false,
    selectedReason: CANCEL_REASONS[0],
    customNote: ''
  });

  // CALLER ID'DEN GELEN OTOMATİK PAKET MASASINI ANINDA AÇ
  useEffect(() => {
    const tableIdToOpen = autoOpenTableId || restaurantDataService.getAndClearPendingPosTable();
    if (tableIdToOpen) {
      const freshTables = restaurantDataService.getTables();
      const targetTbl = freshTables.find(t => t.id === tableIdToOpen);
      if (targetTbl) {
        setSelectedSectionId(targetTbl.sectionId);
        handleSelectTable(targetTbl);
      }
      if (onClearAutoOpen) onClearAutoOpen();
    }
  }, [autoOpenTableId]);

  useEffect(() => {
    const unsub = restaurantDataService.subscribe(() => {
      setSections(restaurantDataService.getSections() || []);
      const freshTables = restaurantDataService.getTables() || [];
      setTables(freshTables);
      setCategories(restaurantDataService.getCategories() || []);
      setProducts(restaurantDataService.getProducts() || []);
      setCustomers(dataService.getCustomers() || []);
      setPaymentMethods(restaurantDataService.getPaymentMethods() || []);

      if (selectedTable) {
        const freshSelected = freshTables.find(t => t.id === selectedTable.id);
        if (freshSelected) {
          setSelectedTable(freshSelected);
          if (freshSelected.order && Array.isArray(freshSelected.order.items)) {
            setOrderItems(freshSelected.order.items.map(i => ({
              ...i,
              price: Number(i.price) || 0,
              quantity: Number(i.quantity) || 1,
              targetPrinter: i.targetPrinter || 'pr-ocak',
              note: i.note || '',
              addedBy: i.addedBy || 'Garson',
              addedAt: i.addedAt || '12:00',
            })));
            setGeneralOrderNote(freshSelected.order.orderNote || '');
          } else {
            setOrderItems([]);
            setGeneralOrderNote('');
          }
        }
      }
    });
    return () => unsub();
  }, [selectedTable]);

  const filteredTables = (tables || []).filter(t => t.sectionId === selectedSectionId);
  const occupiedCount = (tables || []).filter(t => t.status !== 'EMPTY').length;
  const totalTurnover = (tables || []).reduce((sum, t) => sum + (Number(t.order?.totalAmount) || 0), 0);

  const handleSelectTable = (table: TableState) => {
    if (!table) return;
    setSelectedTable(table);
    if (table.order && Array.isArray(table.order.items)) {
      setOrderItems(table.order.items.map(i => ({
        ...i,
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        targetPrinter: i.targetPrinter || 'pr-ocak',
        note: i.note || '',
        addedBy: i.addedBy || 'Garson',
        addedAt: i.addedAt || '12:00',
      })));
      setGeneralOrderNote(table.order.orderNote || '');
    } else {
      setOrderItems([]);
      setGeneralOrderNote('');
    }
  };

  const handleAddProduct = (prod: ProductConfig) => {
    if (!prod) return;
    const cat = categories.find(c => c.id === prod.categoryId);
    const existingIndex = orderItems.findIndex(i => i.productId === prod.id && i.status === 'PENDING' && !i.isGift && !i.note);
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    if (existingIndex > -1) {
      const updated = [...orderItems];
      updated[existingIndex].quantity = (Number(updated[existingIndex].quantity) || 1) + 1;
      setOrderItems(updated);
    } else {
      setOrderItems([
        ...orderItems,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          productId: prod.id,
          productName: prod.name || 'Ürün',
          categoryName: cat?.name || 'Diğer',
          price: Number(prod.price) || 0,
          quantity: 1,
          targetPrinter: prod.printerId || cat?.printerId || 'pr-ocak',
          status: 'PENDING',
          note: '',
          addedBy: 'Kasa (Taha Usta)',
          addedAt: currentTime,
        }
      ]);
    }
  };

  const handleItemAction = (index: number) => {
    const item = orderItems[index];
    if (!item) return;

    if (item.status === 'PENDING') {
      const updated = [...orderItems];
      updated.splice(index, 1);
      setOrderItems(updated);
      return;
    }

    setItemCancelModal({
      open: true,
      itemIndex: index,
      maxQty: Number(item.quantity) || 1,
      cancelQty: 1,
      selectedReason: CANCEL_REASONS[0],
      customNote: ''
    });
  };

  const handleConfirmItemCancel = () => {
    if (itemCancelModal.itemIndex < 0 || !selectedTable) return;
    const item = orderItems[itemCancelModal.itemIndex];
    if (!item) return;
    const reason = itemCancelModal.selectedReason === 'Diğer (Özel Açıklama)' ? itemCancelModal.customNote : itemCancelModal.selectedReason;

    restaurantDataService.cancelItemQuantity(selectedTable.id, itemCancelModal.itemIndex, itemCancelModal.cancelQty, reason);
    notify.warning('Mutfak İptal Fişi Kesildi', `${selectedTable.name} -> ${itemCancelModal.cancelQty}x ${item.productName} iptal edildi. Sebep: ${reason}`);
    setItemCancelModal({ open: false, itemIndex: -1, maxQty: 1, cancelQty: 1, selectedReason: CANCEL_REASONS[0], customNote: '' });
  };

  // MUTFAĞA GÖNDERME (PAKET MÜŞTERİ BİLGİLERİYLE BİRLİKTE BASAR)
  const handleSendToKitchen = () => {
    if (!selectedTable) return;
    const pendingItems = orderItems.filter(i => i.status === 'PENDING');
    if (pendingItems.length === 0) {
      return notify.warning('Yeni Ürün Yok', 'Masada mutfağa gönderilecek yeni bir ilave ürün bulunmuyor!');
    }

    const isFirstOrder = !selectedTable.order || selectedTable.status === 'EMPTY';
    const ticketTitle = isFirstOrder ? 'MUTFAK SİPARİŞİ' : '*** İLAVE SİPARİŞ ***';

    const firinItems = pendingItems.filter(i => (i.targetPrinter || '').includes('firin') || (i.targetPrinter || '').includes('FIRIN'));
    const ocakItems = pendingItems.filter(i => (i.targetPrinter || '').includes('ocak') || (i.targetPrinter || '').includes('OCAK'));

    const updatedItems: OrderItemState[] = orderItems.map(i => ({ ...i, status: 'SENT_TO_KITCHEN' }));
    restaurantDataService.updateTableOrder(selectedTable.id, updatedItems, 'Taha Usta', selectedTable.customerInfo, generalOrderNote);

    if (selectedTable.customerInfo) {
      notify.success(
        '🛵 Paket Siparişi Mutfağa İletildi',
        `Müşteri: ${selectedTable.customerInfo.name} (${selectedTable.customerInfo.phone})\nAdres: ${selectedTable.customerInfo.address}\nFırın ve Ocak yazıcılarına müşteri adresiyle birlikte fiş basıldı.`
      );
    } else {
      notify.success('Mutfak Fişleri Basıldı', `${selectedTable.name} siparişi ilgili mutfak yazıcılarına iletildi.`);
    }

    setSelectedTable(null);
  };

  const handleConfirmTableCancel = () => {
    if (!selectedTable) return;
    const reason = tableCancelModal.selectedReason === 'Diğer (Özel Açıklama)' ? tableCancelModal.customNote : tableCancelModal.selectedReason;

    restaurantDataService.cancelTableOrder(selectedTable.id, reason);
    notify.error('Masa İptal Edildi', `${selectedTable.name} adisyonu iptal edilerek kapatıldı.`);

    setTableCancelModal({ open: false, selectedReason: CANCEL_REASONS[0], customNote: '' });
    setSelectedTable(null);
  };

  const handleTransferTable = () => {
    if (!selectedTable || !targetTransferTableId) return;
    const success = restaurantDataService.transferTable(selectedTable.id, targetTransferTableId);
    if (success) {
      notify.success('Masa Taşındı', `${selectedTable.name} siparişi başarıyla taşındı.`);
      setTransferModalOpen(false);
      setSelectedTable(null);
    } else {
      notify.error('Hata', 'Masa taşıma işlemi başarısız oldu.');
    }
  };

  // PARÇALI HESAPLAMA
  const currentTotal = (orderItems || []).reduce((sum, i) => sum + (i.isGift ? 0 : (Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
  const paidTotal = (paymentEntries || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingTotal = Math.max(0, currentTotal - paidTotal);
  const isFullyPaid = remainingTotal <= 0.01;

  const openCheckoutModal = () => {
    setPaymentEntries([]);
    setSelectedPayItemIndices([]);
    setCalcInput(currentTotal.toFixed(2));
    setCheckoutModalOpen(true);
  };

  const handleTogglePayItem = (index: number) => {
    const isAlreadySelected = selectedPayItemIndices.includes(index);
    const nextSelected = isAlreadySelected
      ? selectedPayItemIndices.filter(i => i !== index)
      : [...selectedPayItemIndices, index];

    setSelectedPayItemIndices(nextSelected);

    if (nextSelected.length > 0) {
      const selectedSum = nextSelected.reduce((sum, idx) => {
        const itm = orderItems[idx];
        return sum + (itm ? (Number(itm.price) || 0) * (Number(itm.quantity) || 1) : 0);
      }, 0);
      setCalcInput(Math.min(selectedSum, remainingTotal).toFixed(2));
    } else {
      setCalcInput(remainingTotal.toFixed(2));
    }
  };

  const handleApplyPercentage = (pct: number) => {
    if (remainingTotal <= 0) return;
    const calculatedShare = (remainingTotal * pct) / 100;
    setCalcInput(calculatedShare.toFixed(2));
  };

  const handleSplitDivisor = (divisor: number) => {
    if (remainingTotal <= 0) return;
    const share = remainingTotal / divisor;
    setCalcInput(share.toFixed(2));
  };

  const handleAddPaymentEntry = (type: string) => {
    const amount = parseFloat(calcInput) || remainingTotal;
    if (amount <= 0.01) return;

    if (amount > remainingTotal + 0.01) {
      notify.error('Hatalı Tutar', `Girilen tutar kalan borçtan (${remainingTotal.toFixed(2)} ₺) fazla olamaz!`);
      return;
    }

    const newEntry: PaymentEntry = {
      id: `pay-${Date.now()}-${Math.random()}`,
      type,
      amount: Math.min(amount, remainingTotal),
    };

    const nextEntries = [...paymentEntries, newEntry];
    setPaymentEntries(nextEntries);
    setSelectedPayItemIndices([]);

    const nextRemaining = Math.max(0, currentTotal - nextEntries.reduce((s, p) => s + p.amount, 0));
    setCalcInput(nextRemaining.toFixed(2));
  };

  const handleDeletePaymentEntry = (id: string) => {
    const nextEntries = paymentEntries.filter(p => p.id !== id);
    setPaymentEntries(nextEntries);

    const nextRemaining = Math.max(0, currentTotal - nextEntries.reduce((s, p) => s + p.amount, 0));
    setCalcInput(nextRemaining.toFixed(2));
  };

  const handleOpenCariPicker = () => {
    const amount = parseFloat(calcInput) || remainingTotal;
    if (amount <= 0.01) return notify.warning('Tutar Yok', 'Aktarılacak tutar 0 olamaz!');
    setCariSearchQuery('');
    setCariModalOpen(true);
  };

  const handleConfirmCariAssignment = (customer: Customer) => {
    const amount = parseFloat(calcInput) || remainingTotal;
    if (amount <= 0.01) return;

    notify.confirm({
      title: 'Cari (Veresiye) Borç Aktarımı',
      message: `Müşteri: ${customer.name}\nMevcut Bakiye: ${customer.balance.toFixed(2)} ₺\n\nHesap kapatıldığında ${amount.toFixed(2)} ₺ tutar [${customer.name}] carisine BORÇ olarak işlenecektir.`,
      confirmText: 'Evet, Borç Yaz',
      type: 'warning',
      onConfirm: () => {
        const newEntry: PaymentEntry = {
          id: `pay-cari-${Date.now()}`,
          type: `Cari (${customer.name})`,
          amount: amount,
          customerId: customer.id,
          customerName: customer.name,
        };

        const nextEntries = [...paymentEntries, newEntry];
        setPaymentEntries(nextEntries);
        setSelectedPayItemIndices([]);

        const nextRemaining = Math.max(0, currentTotal - nextEntries.reduce((s, p) => s + p.amount, 0));
        setCalcInput(nextRemaining.toFixed(2));
        setCariModalOpen(false);
        notify.success('Cari Seçildi', `[${customer.name}] için ${amount.toFixed(2)} ₺ borç kaydı hazırlandı.`);
      }
    });
  };

  const handleFinalizeBill = (printReceipt: boolean) => {
    if (!selectedTable) return;

    if (remainingTotal > 0.01) {
      notify.error('Hesap Kapanamaz', `Kalan Tutar: ${remainingTotal.toFixed(2)} ₺\nLütfen kalan tutarın tamamını tahsil edin.`);
      return;
    }

    // CARİ BORÇLANDIRMA
    const cariPayments = paymentEntries.filter(p => Boolean(p.customerId));
    cariPayments.forEach(cp => {
      if (cp.customerId) {
        dataService.addCustomerTransaction(cp.customerId, {
          type: 'DEBT',
          amount: cp.amount,
          paymentMethod: 'CASH',
          date: new Date().toISOString().split('T')[0],
          description: `${selectedTable.name} (#${selectedTable.order?.orderNumber || 101}) Adisyon Hesabı (Veresiye)`
        });
      }
    });

    restaurantDataService.completeTablePayment(selectedTable.id, 'Tamamlandı', paymentEntries);
    setCustomers(dataService.getCustomers());

    if (printReceipt) {
      notify.success('Hesap Kapatıldı & Fiş Basıldı', `${selectedTable.name} hesabı kapatıldı ve adisyon fişi kesildi.`);
    } else {
      notify.success('Hesap Kapatıldı', `${selectedTable.name} masası başarıyla kapatıldı.`);
    }

    setCheckoutModalOpen(false);
    setSelectedTable(null);
  };

  const filteredProducts = (products || []).filter(p => {
    const matchesCategory = activeCategory === 'all' || p.categoryId === activeCategory;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredCustomers = (customers || []).filter(c => 
    c.name.toLowerCase().includes(cariSearchQuery.toLowerCase()) || 
    (c.phone || '').includes(cariSearchQuery)
  );

  return (
    <div className="h-full flex flex-col bg-slate-900 select-none overflow-hidden font-sans text-slate-100">
      
      {/* ÜST BİLGİ & BÖLÜMLER */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto">
          {sections.map((sec) => {
            const isSelected = selectedSectionId === sec.id;
            const secOccupied = tables.filter(t => t.sectionId === sec.id && t.status !== 'EMPTY').length;
            const secTotal = tables.filter(t => t.sectionId === sec.id).length;

            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{sec.name}</span>
                <span className="px-2 py-0.5 bg-black/30 rounded-full text-[10px]">
                  {secOccupied} / {secTotal}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Açık Masalar Cirosu</div>
            <div className="text-lg font-black text-emerald-400">{totalTurnover.toFixed(2)} ₺</div>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Dolu Masa Oranı</div>
            <div className="text-lg font-black text-amber-400">{occupiedCount} / {tables.length} Masa Dolu</div>
          </div>
        </div>
      </div>

      {/* MASA PLANI GRID */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-900/60">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredTables.map((table) => {
            const isOccupied = table.status === 'OCCUPIED';
            const isBillReq = table.status === 'BILL_REQUESTED';
            const isDelivery = table.sectionId === 'sec-paket' || Boolean(table.customerInfo);
            const hasNotes = Boolean(table.order?.orderNote) || (table.order?.items || []).some(i => Boolean(i.note));

            return (
              <div
                key={table.id}
                onClick={() => handleSelectTable(table)}
                className={`group relative p-4 rounded-3xl border transition-all cursor-pointer transform hover:-translate-y-1 hover:shadow-2xl ${
                  isBillReq
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10 animate-pulse'
                    : isOccupied
                    ? isDelivery ? 'bg-orange-950/40 border-orange-500 shadow-lg' : 'bg-rose-950/40 border-rose-600/70 shadow-lg'
                    : 'bg-slate-800/70 border-slate-700/70 hover:border-amber-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-sm text-white tracking-tight">{table.name}</span>
                  <div className="flex items-center gap-1.5">
                    {hasNotes && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded text-[9px] font-black flex items-center gap-0.5" title="Masada Not Var">
                        <MessageSquare className="w-2.5 h-2.5" /> Not
                      </span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full ${isBillReq ? 'bg-amber-400' : isOccupied ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                  </div>
                </div>

                {table.customerInfo ? (
                  <div className="mb-2 text-[10px] text-orange-300 font-bold bg-orange-900/40 border border-orange-700/50 p-1.5 rounded-xl truncate">
                    🛵 {table.customerInfo.name}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{table.capacity} Kişilik</span>
                  </div>
                )}

                {isOccupied && table.order ? (
                  <div className="mt-2 pt-2 border-t border-slate-700/60">
                    <div className="text-base font-black text-rose-400 tracking-tight">
                      {(Number(table.order.totalAmount) || 0).toFixed(2)} ₺
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mt-1">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-rose-400" /> {table.order.orderTime || '12:00'}
                      </span>
                      <span className="truncate max-w-[70px] text-slate-300">{table.order.waiterName || 'Garson'}</span>
                    </div>
                  </div>
                ) : isBillReq && table.order ? (
                  <div className="mt-2 pt-2 border-t border-amber-500/40">
                    <div className="text-base font-black text-amber-400 tracking-tight">
                      {(Number(table.order.totalAmount) || 0).toFixed(2)} ₺
                    </div>
                    <div className="text-[10px] font-black text-amber-300 uppercase mt-0.5">
                      HESAP İSTENDİ
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                    <span>Masa Boş</span>
                    <span className="text-xs font-bold">+ Sipariş</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ADİSYON VE SİPARİŞ ALMA MODALI */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-6xl w-full h-[88vh] shadow-2xl border border-slate-800 flex overflow-hidden">
            
            {/* SOL TARAF: ADİSYON SEPETİ */}
            <div className="w-2/5 bg-slate-950 border-r border-slate-800 flex flex-col h-full">
              
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white">{selectedTable.name}</h2>
                    <p className="text-xs text-amber-400 font-medium">Garson: {selectedTable.order?.waiterName || 'Taha Usta'}</p>
                    
                    {/* PAKET MÜŞTERİ BİLGİ KARTI (ADİSYONUN EN ÜSTÜNDE) */}
                    {selectedTable.customerInfo && (
                      <div className="mt-2 p-2.5 bg-orange-950/70 border border-orange-700/80 rounded-2xl text-[11px] text-orange-200 shadow-md">
                        <div className="font-black text-white flex items-center gap-1.5 text-xs">
                          <Bike className="w-4 h-4 text-amber-400" />
                          <span>{selectedTable.customerInfo.name}</span>
                          <span className="font-mono text-amber-300">({selectedTable.customerInfo.phone})</span>
                        </div>
                        <div className="text-[11px] text-orange-100 font-medium mt-1 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span>{selectedTable.customerInfo.address}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedTable.status !== 'EMPTY' && (
                      <>
                        <button
                          onClick={() => setTransferModalOpen(true)}
                          className="px-2.5 py-1.5 bg-blue-900/50 hover:bg-blue-800 text-blue-300 border border-blue-700/60 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer"
                          title="Masayı Taşı"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Taşı</span>
                        </button>

                        <button
                          onClick={() => setTableCancelModal({ open: true, selectedReason: CANCEL_REASONS[0], customNote: '' })}
                          className="px-2.5 py-1.5 bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-700/60 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer"
                          title="İptal Et"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>İptal</span>
                        </button>
                      </>
                    )}

                    <button onClick={() => setSelectedTable(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {generalOrderNote && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-bold flex items-start gap-1.5">
                    <span className="text-amber-400 font-black flex items-center gap-1 whitespace-nowrap">
                      <FileText className="w-3.5 h-3.5" /> Masa Notu:
                    </span>
                    <span className="font-medium text-slate-200">{generalOrderNote}</span>
                  </div>
                )}
              </div>

              {/* Sipariş Kalemleri */}
              <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
                {orderItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
                    <UtensilsCrossed className="w-10 h-10 mb-2 text-slate-700 stroke-1" />
                    <span>Adisyonda ürün bulunmuyor.<br/>Sağdaki menüden ürün seçerek ilave edin.</span>
                  </div>
                ) : (
                  orderItems.map((item, idx) => (
                    <div key={idx} className={`p-3 bg-slate-900 border rounded-2xl shadow-sm flex flex-col gap-1.5 ${
                      item.status === 'PENDING' ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-xs text-white truncate">{item.productName}</span>
                          {item.status === 'SENT_TO_KITCHEN' ? (
                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black">Mutfakta</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded text-[9px] font-black">Yeni İlave</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setItemNoteModal({ open: true, itemIndex: idx, noteText: item.note || '' })}
                            className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-bold cursor-pointer"
                            title="Not Ekle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleItemAction(idx)}
                            className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs font-bold cursor-pointer"
                            title={item.status === 'PENDING' ? 'Listeden Sil' : 'İptal Et'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{item.quantity} Adet x {item.price} ₺ = <strong className="text-white">{((item.quantity || 1) * (item.price || 0)).toFixed(2)} ₺</strong></span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                          👤 {item.addedBy || 'Garson'} • {item.addedAt || '12:00'}
                        </span>
                      </div>

                      {item.note && (
                        <div className="text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl font-bold border border-amber-500/20 flex items-center gap-1 mt-0.5">
                          <span className="text-amber-400 font-black">📝 Not:</span>
                          <span className="font-medium text-slate-200">{item.note}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Alt Tutar & Mutfak / Paket Yazıcısına Gönderme */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Masa Notu:</span>
                  <input
                    type="text"
                    value={generalOrderNote}
                    onChange={(e) => setGeneralOrderNote(e.target.value)}
                    placeholder="Mutfak için genel masa notu..."
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Adisyon Toplamı:</span>
                  <span className="text-2xl font-black text-white">{currentTotal.toFixed(2)} ₺</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSendToKitchen}
                    className="py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Mutfağa / Pakete Gönder</span>
                  </button>

                  <button
                    onClick={openCheckoutModal}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Tahsilat / Hesap Kapat</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SAĞ TARAF: MENÜ & İLAVE ÜRÜN SEÇİCİ */}
            <div className="flex-1 flex flex-col h-full bg-slate-900">
              <div className="p-4 border-b border-slate-800 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Menüde ürün ara..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                      activeCategory === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Tüm Menü
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                        activeCategory === cat.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredProducts.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 rounded-2xl text-left transition-all group flex flex-col justify-between h-28 cursor-pointer shadow-sm"
                    >
                      <div>
                        <div className="font-black text-xs text-white group-hover:text-amber-400 line-clamp-2">
                          {prod.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">~{prod.preparationMin} dk</div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                        <span className="font-black text-sm text-amber-300">{prod.price} ₺</span>
                        <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                          +
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* KASA HIZLI NOT MODALI */}
      {itemNoteModal.open && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-sm font-black text-white">Ürün Açıklaması / Hızlı Not</h4>
              <button onClick={() => setItemNoteModal({ open: false, itemIndex: -1, noteText: '' })} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Hızlı Hazır Notlar (Tıklayın):</label>
              <div className="flex flex-wrap gap-1.5">
                {KASA_QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = itemNoteModal.noteText ? `${itemNoteModal.noteText}, ${tag}` : tag;
                      setItemNoteModal({ ...itemNoteModal, noteText: current });
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-xs font-bold rounded-lg text-slate-300 border border-slate-700/60 cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Özel Not Yazın:</label>
              <input
                type="text"
                value={itemNoteModal.noteText}
                onChange={(e) => setItemNoteModal({ ...itemNoteModal, noteText: e.target.value })}
                placeholder="Örn: Lavaş çift, az pişmiş..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setItemNoteModal({ open: false, itemIndex: -1, noteText: '' })}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  if (itemNoteModal.itemIndex > -1) {
                    const updated = [...orderItems];
                    updated[itemNoteModal.itemIndex].note = itemNoteModal.noteText.trim();
                    setOrderItems(updated);
                  }
                  setItemNoteModal({ open: false, itemIndex: -1, noteText: '' });
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-lg cursor-pointer"
              >
                Notu Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAHSİLAT & HESAP KAPATMA MERKEZİ */}
      {checkoutModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-6xl w-full h-[92vh] shadow-2xl border border-slate-800 flex flex-col overflow-hidden text-slate-100">
            
            <div className="py-3 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-lg">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <span>{selectedTable.name} — Hesap Kapatma & Tahsilat</span>
                    <span className="px-2 py-0.5 bg-slate-800 text-amber-400 rounded-md text-[10px] font-mono">#{selectedTable.order?.orderNumber || 101}</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Parçalı ürün seçimi yapabilir veya Cari / İndirim uygulayabilirsiniz.</p>
                </div>
              </div>

              <button onClick={() => setCheckoutModalOpen(false)} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden p-5 gap-5 bg-slate-900/60">
              
              {/* SOL SÜTUN */}
              <div className="w-1/2 flex flex-col gap-3.5 overflow-hidden">
                
                <div className="bg-slate-950 rounded-2xl border border-slate-800 flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Parçalı Ürün Ödeme (Dokunun)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {selectedPayItemIndices.length > 0 ? `${selectedPayItemIndices.length} Kalem Seçildi` : 'Tüm Hesap'}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1 space-y-0.5">
                    {orderItems.map((item, idx) => {
                      const isSelected = selectedPayItemIndices.includes(idx);
                      const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);

                      return (
                        <div
                          key={idx}
                          onClick={() => handleTogglePayItem(idx)}
                          className={`p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-amber-500/20 border border-amber-500/60 text-white font-bold shadow-inner' 
                              : 'hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-amber-500 border-amber-500 text-slate-950 font-black' : 'border-slate-700 bg-slate-900'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </div>
                            <div className="truncate">
                              <div className="font-bold truncate">{item.productName}</div>
                              {item.note && <div className="text-[10px] text-amber-400 truncate">📝 {item.note}</div>}
                              <div className="text-[9px] text-slate-500">👤 {item.addedBy || 'Garson'}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-slate-500 font-mono">{item.quantity} x {item.price} ₺</span>
                            <span className="font-mono font-black text-amber-300">{itemTotal.toFixed(2)} ₺</span>
                            <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3 flex flex-col">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 mb-1.5">
                    <span>ALINAN TAHSİLAT TÜRÜ</span>
                    <span>TUTAR / SİL</span>
                  </div>

                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {paymentEntries.length === 0 ? (
                      <div className="p-2 bg-slate-900/60 text-slate-500 text-xs font-bold text-center rounded-xl">
                        Henüz ödeme alınmadı
                      </div>
                    ) : (
                      paymentEntries.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {p.type}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white">₺ {p.amount.toFixed(2)}</span>
                            <button
                              onClick={() => handleDeletePaymentEntry(p.id)}
                              className="p-1 text-rose-400 hover:bg-rose-950/60 rounded-lg cursor-pointer"
                              title="Bu Tahsilatı İptal Et"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3.5 space-y-1.5 text-xs font-bold">
                  <div className="flex justify-between text-slate-400">
                    <span>Toplam Adisyon:</span>
                    <span className="text-white font-mono">{currentTotal.toFixed(2)} ₺</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Alınan Tahsilat:</span>
                    <span className="font-mono">{paidTotal.toFixed(2)} ₺</span>
                  </div>
                  <div className="h-px bg-slate-800 my-1"></div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-xs uppercase tracking-wider text-slate-300">Kalan Ödenecek:</span>
                    <span className={`text-xl font-black font-mono ${isFullyPaid ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                      {remainingTotal.toFixed(2)} ₺
                    </span>
                  </div>
                </div>

              </div>

              {/* SAĞ SÜTUN */}
              <div className="w-1/2 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between">
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2">
                    <span className="text-amber-400 font-black text-xl">₺</span>
                    <input
                      type="text"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right font-black font-mono text-2xl text-white bg-transparent focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 px-1 flex items-center gap-0.5">
                      <Percent className="w-3 h-3 text-amber-400" /> Kalan %:
                    </span>
                    <div className="flex gap-1 flex-1 justify-end">
                      <button onClick={() => handleApplyPercentage(5)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg cursor-pointer">%5</button>
                      <button onClick={() => handleApplyPercentage(10)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg cursor-pointer">%10</button>
                      <button onClick={() => handleApplyPercentage(15)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg cursor-pointer">%15</button>
                      <button onClick={() => handleApplyPercentage(20)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg cursor-pointer">%20</button>
                      <button onClick={() => handleApplyPercentage(50)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg cursor-pointer">%50</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 my-2">
                  <button onClick={() => setCalcInput('20')} className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 cursor-pointer">20 ₺</button>
                  <button onClick={() => setCalcInput('50')} className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 cursor-pointer">50 ₺</button>
                  <button onClick={() => setCalcInput('100')} className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 cursor-pointer">100 ₺</button>
                  <button onClick={() => setCalcInput('200')} className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 cursor-pointer">200 ₺</button>
                  <button onClick={() => setCalcInput(remainingTotal.toFixed(2))} className="py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl font-black text-xs text-amber-300 cursor-pointer">Tam Tutar</button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 flex-1 my-1">
                  <button onClick={() => setCalcInput(calcInput + '1')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">1</button>
                  <button onClick={() => setCalcInput(calcInput + '2')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">2</button>
                  <button onClick={() => setCalcInput(calcInput + '3')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">3</button>
                  <button onClick={() => handleSplitDivisor(2)} className="bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-amber-400 rounded-xl border border-slate-800 cursor-pointer">1/2 (2 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '4')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">4</button>
                  <button onClick={() => setCalcInput(calcInput + '5')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">5</button>
                  <button onClick={() => setCalcInput(calcInput + '6')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">6</button>
                  <button onClick={() => handleSplitDivisor(3)} className="bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-amber-400 rounded-xl border border-slate-800 cursor-pointer">1/3 (3 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '7')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">7</button>
                  <button onClick={() => setCalcInput(calcInput + '8')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">8</button>
                  <button onClick={() => setCalcInput(calcInput + '9')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">9</button>
                  <button onClick={() => handleSplitDivisor(4)} className="bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-amber-400 rounded-xl border border-slate-800 cursor-pointer">1/4 (4 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '.')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">.</button>
                  <button onClick={() => setCalcInput(calcInput + '0')} className="bg-slate-900 hover:bg-slate-800 text-base font-bold rounded-xl cursor-pointer">0</button>
                  <button onClick={() => setCalcInput(calcInput.slice(0, -1))} className="bg-slate-900 hover:bg-slate-800 text-xs font-bold text-rose-400 rounded-xl cursor-pointer">Sil</button>
                  <button onClick={() => handleSplitDivisor(5)} className="bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-amber-400 rounded-xl border border-slate-800 cursor-pointer">1/5 (5 Kişi)</button>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAddPaymentEntry('Nakit')}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Nakit</span>
                    </button>

                    <button
                      onClick={() => handleAddPaymentEntry('Kredi Kartı')}
                      className="py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Kredi Kartı</span>
                    </button>

                    <button
                      onClick={handleOpenCariPicker}
                      className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Cari (Veresiye)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAddPaymentEntry('İndirim (İskonto)')}
                      className="py-2 bg-[#b49045] hover:bg-[#96742f] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>İndirim (İskonto)</span>
                    </button>

                    <button
                      onClick={() => handleAddPaymentEntry('İkram (Tutar Düş)')}
                      className="py-2 bg-[#e11d48] hover:bg-[#be123c] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>İkram (Hesaptan Düş)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[10px] font-bold max-h-20 overflow-y-auto">
                    {paymentMethods
                      .filter(pm => pm.isActive && !['pm-cash', 'pm-card', 'pm-cari', 'pm-discount', 'pm-gift'].includes(pm.id))
                      .map((pm) => (
                        <button
                          key={pm.id}
                          onClick={() => handleAddPaymentEntry(pm.name)}
                          className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 truncate px-1 cursor-pointer"
                          title={pm.name}
                        >
                          {pm.name}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleFinalizeBill(false)}
                    disabled={!isFullyPaid}
                    className={`py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isFullyPaid 
                        ? 'bg-slate-800 hover:bg-slate-700 text-white shadow-lg' 
                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {!isFullyPaid && <Lock className="w-3.5 h-3.5 text-slate-600" />}
                    <span>Masayı Kapat (Fişsiz)</span>
                  </button>

                  <button
                    onClick={() => handleFinalizeBill(true)}
                    disabled={!isFullyPaid}
                    className={`py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                      isFullyPaid 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-600/20' 
                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {!isFullyPaid && <Lock className="w-3.5 h-3.5 text-slate-600" />}
                    <span>Hesap Kapat & Fiş Bas</span>
                    <Printer className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* CARİ POPUP */}
      {cariModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Cari Müşteri Seçimi (Veresiye)</h3>
                  <p className="text-xs text-amber-400 font-bold">Aktarılacak Tutar: {parseFloat(calcInput || '0').toFixed(2)} ₺</p>
                </div>
              </div>

              <button onClick={() => setCariModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={cariSearchQuery}
                onChange={(e) => setCariSearchQuery(e.target.value)}
                placeholder="Müşteri adı veya telefon ara..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl text-xs font-bold text-white focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl">
                  Kayıtlı müşteri bulunamadı.
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleConfirmCariAssignment(c)}
                    className="p-3.5 bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div>
                      <div className="font-black text-xs text-white group-hover:text-amber-300">{c.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone || 'Telefon yok'}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Mevcut Bakiye</div>
                      <div className={`font-mono font-black text-xs ${c.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {c.balance.toFixed(2)} ₺
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setCariModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASA TAŞIMA MODALI */}
      {transferModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              <span>{selectedTable.name} Masasını Taşı</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-400">Hedef Boş Masayı Seçin:</label>
              <select
                value={targetTransferTableId}
                onChange={(e) => setTargetTransferTableId(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white"
              >
                <option value="">Hedef Masa Seçin...</option>
                {tables
                  .filter(t => t.id !== selectedTable.id && t.status === 'EMPTY')
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (Boş)</option>
                  ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setTransferModalOpen(false)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">Vazgeç</button>
              <button onClick={handleTransferTable} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg">Masayı Taşı</button>
            </div>
          </div>
        </div>
      )}

      {/* İPTAL MODALI */}
      {itemCancelModal.open && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Ürün İptal Onayı</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-400">Kaç Adet İptal Edilecek? (Mevcut: {itemCancelModal.maxQty})</label>
              <input
                type="number"
                min="1"
                max={itemCancelModal.maxQty}
                value={itemCancelModal.cancelQty}
                onChange={(e) => setItemCancelModal({ ...itemCancelModal, cancelQty: Number(e.target.value) || 1 })}
                className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400">İptal Sebebi Seçin:</label>
              <div className="space-y-1 mt-1">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setItemCancelModal({ ...itemCancelModal, selectedReason: r })}
                    className={`w-full p-2 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                      itemCancelModal.selectedReason === r ? 'bg-rose-500/20 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setItemCancelModal({ ...itemCancelModal, open: false })} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">Vazgeç</button>
              <button onClick={handleConfirmItemCancel} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg">İptali Onayla & Fiş Kes</button>
            </div>
          </div>
        </div>
      )}

      {/* KOMPLE MASA İPTAL MODALI */}
      {tableCancelModal.open && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-800/80 space-y-4">
            <h3 className="text-base font-black text-rose-400">{selectedTable.name} Masasını Komple İptal Et</h3>
            <div className="space-y-1">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setTableCancelModal({ ...tableCancelModal, selectedReason: r })}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                    tableCancelModal.selectedReason === r ? 'bg-rose-500/20 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setTableCancelModal({ open: false, selectedReason: CANCEL_REASONS[0], customNote: '' })} className="px-4 py-2 bg-slate-800 text-xs font-bold">Vazgeç</button>
              <button onClick={handleConfirmTableCancel} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black">Masayı İptal Et & Kapat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
