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
  Plus,
  Minus,
  ShoppingCart,
  ChevronRight,
  UserPlus,
  PhoneIncoming,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import { 
  restaurantDataService, 
  TableState, 
  ProductConfig, 
  CategoryConfig, 
  SectionConfig, 
  OrderItemState,
  PaymentMethodConfig,
  CustomerDeliveryInfo,
  CallLogItem 
} from '../../services/restaurantDataService';
import { dataService, Customer } from '../../services/dataService';
import { notify } from '../../services/notificationService';
import { printerService } from '../../services/printerService';

const CANCEL_REASONS = [
  'Müşteri Siparişten Vazgeçti',
  'Yanlış Ürün / Masa Seçimi Yapıldı',
  'Mutfakta / Ocakta Ürün Tükendi',
  'Müşteri Beklemek İstemedi (Gecikme)',
  'Ürün Yanık / Hatalı Hazırlandı',
  'Masa İptal Edildi (Ayrıldı)',
  'Diğer (Özel Açıklama)'
];

const formatMoney = (val: number) => (Number(val) || 0).toFixed(2) + ' ₺';

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
  const [recentCalls, setRecentCalls] = useState<CallLogItem[]>(restaurantDataService.getRecentCalls() || []);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || 'sec-salon');
  const [selectedTable, setSelectedTable] = useState<TableState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [orderItems, setOrderItems] = useState<OrderItemState[]>([]);
  const [generalOrderNote, setGeneralOrderNote] = useState('');

  // RESPONSİVE MOBİL & TABLET MODAL SEKMELERİ
  const [activeModalTab, setActiveModalTab] = useState<'MENU' | 'CART'>('MENU');
  const [checkoutModalTab, setCheckoutModalTab] = useState<'ITEMS' | 'PAYMENT'>('PAYMENT');

  // 3 SEÇENEKLİ MÜŞTERİ ATAMA MODALI STATE (CALLER ID / SON EKLENENLER / ARAMA)
  const [customerAssignModalOpen, setCustomerAssignModalOpen] = useState(false);
  const [customerAssignTab, setCustomerAssignTab] = useState<'CALLER_ID' | 'RECENT_CUSTOMERS' | 'SEARCH_ALL'>('CALLER_ID');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [newQuickCustName, setNewQuickCustName] = useState('');
  const [newQuickCustPhone, setNewQuickCustPhone] = useState('');
  const [newQuickCustAddress, setNewQuickCustAddress] = useState('');

  // HIZLI NOT MODALI STATE
  const [itemNoteModal, setItemNoteModal] = useState<{ open: boolean; itemIndex: number; noteText: string }>({ open: false, itemIndex: -1, noteText: '' });
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [calcInput, setCalcInput] = useState<string>('');
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [selectedPayItemIndices, setSelectedPayItemIndices] = useState<number[]>([]);

  const [cariModalOpen, setCariModalOpen] = useState(false);
  const [cariSearchQuery, setCariSearchQuery] = useState('');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [targetTransferTableId, setTargetTransferTableId] = useState('');
  const [transferSectionFilter, setTransferSectionFilter] = useState<string>('all');

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

  // CALLER ID OTOMATİK PAKET MASASI AÇMA
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
      setRecentCalls(restaurantDataService.getRecentCalls() || []);

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
    const hasExistingItems = Boolean(table.order && Array.isArray(table.order.items) && table.order.items.length > 0);
    // Masada hazır sipariş varsa adisyonu, boşsa menüyü öne çıkar
    setActiveModalTab(hasExistingItems ? 'CART' : 'MENU');
    setCheckoutModalTab('PAYMENT');

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

  // DOĞRUDAN ADİSYON KALEMİ ADEDİNİ ARTIRMA (+)
  const handleIncreaseQuantity = (index: number) => {
    const updated = [...orderItems];
    const item = updated[index];
    if (!item) return;

    if (item.status === 'PENDING') {
      item.quantity = (Number(item.quantity) || 1) + 1;
      setOrderItems(updated);
    } else {
      // Mutfakta olan ürünün adet artışı yeni ilave olarak eklenir
      const existingPending = updated.findIndex(i => i.productId === item.productId && i.status === 'PENDING' && !i.isGift && !i.note);
      if (existingPending > -1) {
        updated[existingPending].quantity = (Number(updated[existingPending].quantity) || 1) + 1;
        setOrderItems(updated);
      } else {
        const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        updated.push({
          ...item,
          id: `item-${Date.now()}-${Math.random()}`,
          quantity: 1,
          status: 'PENDING',
          addedAt: currentTime,
          addedBy: 'Kasa (Taha Usta)'
        });
        setOrderItems(updated);
      }
      notify.info('Yeni İlave Kalem', `+1 adet [${item.productName}] eklendi (mutfağa gönderilmeyi bekliyor).`);
    }
  };

  // DOĞRUDAN ADİSYON KALEMİ ADEDİNİ AZALTMA (-)
  const handleDecreaseQuantity = (index: number) => {
    const item = orderItems[index];
    if (!item) return;

    if (item.status === 'PENDING') {
      const updated = [...orderItems];
      if ((item.quantity || 1) > 1) {
        updated[index].quantity = (Number(item.quantity) || 1) - 1;
        setOrderItems(updated);
      } else {
        updated.splice(index, 1);
        setOrderItems(updated);
      }
    } else {
      // Mutfağa iletilmiş ürün için iptal nedeni ve onay penceresi açılır
      setItemCancelModal({
        open: true,
        itemIndex: index,
        maxQty: Number(item.quantity) || 1,
        cancelQty: 1,
        selectedReason: CANCEL_REASONS[0],
        customNote: ''
      });
    }
  };

  // KALEM İKRAMINI AÇMA / KAPATMA
  const handleToggleItemGift = (index: number) => {
    const updated = [...orderItems];
    const item = updated[index];
    if (!item) return;
    item.isGift = !item.isGift;
    setOrderItems(updated);
    if (item.isGift) {
      notify.info('İkram Uygulandı', `[${item.productName}] ikram olarak işaretlendi (0.00 ₺).`);
    } else {
      notify.info('İkram Kaldırıldı', `[${item.productName}] normal fiyata döndü.`);
    }
  };

  // ADİSYON / ARA HESAP FİŞİ YAZDIRMA
  const handlePrintPreliminaryBill = async () => {
    if (!selectedTable) return;
    if (orderItems.length === 0) {
      return notify.warning('Adisyon Boş', 'Yazdırılacak sipariş kalemi bulunmuyor.');
    }
    const res = await printerService.printBill(selectedTable, orderItems);
    if (res.success) {
      notify.success(
        'Adisyon Fişi Yazdırıldı',
        `${selectedTable.name} için ara hesap fişi (${currentTotal.toFixed(2)} ₺) kasaya ve adisyon yazıcısına gönderildi.`
      );
    } else {
      notify.warning(
        'Adisyon Yazdırılamadı',
        res.message || 'Yazıcıya bağlanılamadı. Lütfen Ayarlar > Yazıcılar sekmesinden yazıcı ayarlarınızı kontrol edin.'
      );
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

    // Mutfağa daha önce gönderilmiş ürün ise iptal fişi dök
    if (item.status === 'SENT_TO_KITCHEN') {
      printerService.printCancellationTicket(selectedTable, [{
        name: item.productName,
        quantity: itemCancelModal.cancelQty,
        reason: `${reason || 'İptal'}`
      }], 'Kasa / Taha Usta');
    }

    restaurantDataService.cancelItemQuantity(selectedTable.id, itemCancelModal.itemIndex, itemCancelModal.cancelQty, reason);
    notify.warning('Mutfak İptal Fişi Kesildi', `${selectedTable.name} -> ${itemCancelModal.cancelQty}x ${item.productName} iptal edildi.`);
    setItemCancelModal({ open: false, itemIndex: -1, maxQty: 1, cancelQty: 1, selectedReason: CANCEL_REASONS[0], customNote: '' });
  };

  // MUTFAĞA GÖNDERME
  const handleSendToKitchen = async () => {
    if (!selectedTable) return;
    const pendingItems = orderItems.filter(i => i.status === 'PENDING');
    if (pendingItems.length === 0) {
      return notify.warning('Yeni Ürün Yok', 'Masada mutfağa gönderilecek yeni bir ilave ürün bulunmuyor!');
    }

    const updatedItems: OrderItemState[] = orderItems.map(i => ({ ...i, status: 'SENT_TO_KITCHEN' }));
    restaurantDataService.updateTableOrder(selectedTable.id, updatedItems, 'Taha Usta', selectedTable.customerInfo, generalOrderNote);

    // Mutfak / Ocak / Fırın İstasyon Yazıcılarına Otomatik Fiş Dökümü
    const printResult = await printerService.printKitchenTickets(
      selectedTable,
      pendingItems,
      'Taha Usta',
      generalOrderNote
    );

    if (selectedTable.customerInfo) {
      notify.success(
        '🛵 Paket Siparişi Mutfağa İletildi',
        `Müşteri: ${selectedTable.customerInfo.name} (${selectedTable.customerInfo.phone})\nAdres: ${selectedTable.customerInfo.address}\n${printResult.success ? 'Yazıcılara fiş basıldı (' + printResult.details.join(', ') + ')' : 'Mutfak fişi gönderildi.'}`
      );
    } else {
      notify.success(
        'Mutfak Fişleri Basıldı',
        printResult.success
          ? `${selectedTable.name} siparişi ilgili istasyon yazıcılarına iletildi: ${printResult.details.join(', ')}`
          : `${selectedTable.name} siparişi mutfağa iletildi.`
      );
    }

    setSelectedTable(null);
  };

  const handleConfirmTableCancel = () => {
    if (!selectedTable) return;
    const reason = tableCancelModal.selectedReason === 'Diğer (Özel Açıklama)' ? tableCancelModal.customNote : tableCancelModal.selectedReason;

    // Mutfağa daha önce gönderilmiş ürünler varsa mutfağa toplu iptal fişi bas
    const kitchenItems = orderItems.filter(i => i.status === 'SENT_TO_KITCHEN');
    if (kitchenItems.length > 0) {
      printerService.printCancellationTicket(selectedTable, kitchenItems.map(i => ({
        name: i.productName,
        quantity: i.quantity,
        reason: `${reason || 'Masa İptali'}`
      })), 'Kasa');
    }

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

  // MÜŞTERİYİ MASAYA ATAMA İŞLEMİ
  const handleAssignCustomerToTable = (info: CustomerDeliveryInfo) => {
    if (!selectedTable) return;

    restaurantDataService.updateTableOrder(
      selectedTable.id,
      orderItems,
      selectedTable.order?.waiterName || 'Taha Usta',
      info,
      generalOrderNote
    );

    notify.success('Müşteri Atandı', `[${info.name}] müşteri bilgileri ${selectedTable.name} masasına bağlandı.`);
    setCustomerAssignModalOpen(false);
  };

  // HIZLI MÜŞTERİ KAYDEDİP MASAYA ATAMA
  const handleQuickCreateAndAssignCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuickCustName.trim()) return notify.error('Eksik Bilgi', 'Müşteri adını giriniz.');

    const created = dataService.addCustomer({
      name: newQuickCustName.trim(),
      phone: newQuickCustPhone.trim(),
      address: newQuickCustAddress.trim(),
      balance: 0,
      notes: 'Paket masası üzerinden kaydedildi'
    });

    handleAssignCustomerToTable({
      customerId: created.id,
      name: created.name,
      phone: created.phone || newQuickCustPhone,
      address: created.address || newQuickCustAddress,
    });
  };

  // PARÇALI HESAPLAMA
  const currentTotal = (orderItems || []).reduce((sum, i) => sum + (i.isGift ? 0 : (Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
  const paidTotal = (paymentEntries || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingTotal = Math.max(0, currentTotal - paidTotal);
  const isFullyPaid = remainingTotal <= 0.01;
  const selectedPayTotal = (selectedPayItemIndices || []).reduce((sum, idx) => {
    const itm = orderItems[idx];
    return sum + (itm && !itm.isGift ? (Number(itm.price) || 0) * (Number(itm.quantity) || 1) : 0);
  }, 0);

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
      printerService.printBill(selectedTable, orderItems, paymentEntries);
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

  const filteredAssignCustomers = (customers || []).filter(c => 
    c.name.toLowerCase().includes(assignSearchQuery.toLowerCase()) || 
    (c.phone || '').includes(assignSearchQuery) ||
    (c.address || '').toLowerCase().includes(assignSearchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#141416] select-none overflow-hidden font-sans text-[#FAF7F2]">
      
      {/* ÜST BİLGİ & BÖLÜMLER */}
      <div className="bg-[#1C1C20] border-b border-[#2C2C34] px-3 sm:px-6 py-2 sm:py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 shadow-md flex-shrink-0">
        <div className="flex bg-[#141416] p-1 sm:p-1.5 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto hide-scrollbar">
          {sections.map((sec) => {
            const isSelected = selectedSectionId === sec.id;
            const secOccupied = tables.filter(t => t.sectionId === sec.id && t.status !== 'EMPTY').length;
            const secTotal = tables.filter(t => t.sectionId === sec.id).length;

            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  isSelected 
                    ? 'bg-[#F5C877] text-[#141416] shadow-lg shadow-[#F5C877]/20' 
                    : 'text-[#8E8E98] hover:text-white hover:bg-[#1C1C20]'
                }`}
              >
                <span>{sec.name}</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-[#141416]/20 text-[#141416]' : 'bg-[#1C1C20] text-[#8E8E98]'}`}>
                  {secOccupied} / {secTotal}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-6 bg-[#141416]/60 md:bg-transparent p-2 sm:p-0 rounded-xl border border-[#2C2C34]/40 md:border-0">
          <div className="text-left md:text-right">
            <div className="text-[9px] sm:text-[10px] uppercase font-extrabold text-[#8E8E98] tracking-wider">Açık Masalar Cirosu</div>
            <div className="text-sm sm:text-lg font-black text-emerald-400 font-mono">{totalTurnover.toFixed(2)} ₺</div>
          </div>
          <div className="h-6 sm:h-8 w-px bg-[#2C2C34]"></div>
          <div className="text-right">
            <div className="text-[9px] sm:text-[10px] uppercase font-extrabold text-[#8E8E98] tracking-wider">Dolu Masa Oranı</div>
            <div className="text-sm sm:text-lg font-black text-[#F5C877] font-mono">{occupiedCount} / {tables.length} Masa</div>
          </div>
        </div>
      </div>

      {/* MASA PLANI GRID */}
      <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-[#141416]">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
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
                    ? 'bg-[#282115] border-[#F5C877] shadow-lg shadow-[#F5C877]/10 animate-pulse'
                    : isOccupied
                    ? isDelivery ? 'bg-[#261E16] border-orange-500/50 shadow-lg' : 'bg-[#241A1C] border-rose-500/50 shadow-lg'
                    : 'bg-[#1C1C20] border-[#2C2C34] hover:border-[#F5C877]/60 hover:bg-[#222228]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-sm text-[#FAF7F2] tracking-tight">{table.name}</span>
                  <div className="flex items-center gap-1.5">
                    {hasNotes && (
                      <span className="px-1.5 py-0.5 bg-[#F5C877] text-[#141416] rounded text-[9px] font-black flex items-center gap-0.5" title="Masada Not Var">
                        <MessageSquare className="w-2.5 h-2.5" /> Not
                      </span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full ${isBillReq ? 'bg-[#F5C877]' : isOccupied ? 'bg-rose-500' : 'bg-emerald-400'}`}></span>
                  </div>
                </div>

                {table.customerInfo ? (
                  <div className="mb-2 text-[10px] text-orange-300 font-bold bg-orange-950/60 border border-orange-700/50 p-1.5 rounded-xl truncate">
                    🛵 {table.customerInfo.name}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E98] mb-2">
                    <Users className="w-3.5 h-3.5 text-[#8E8E98]" />
                    <span>{table.capacity} Kişilik</span>
                  </div>
                )}

                {isOccupied && table.order ? (
                  <div className="mt-2 pt-2 border-t border-[#2C2C34]">
                    <div className="text-base font-black text-rose-400 font-mono tracking-tight">
                      {(Number(table.order.totalAmount) || 0).toFixed(2)} ₺
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#8E8E98] font-bold mt-1">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-rose-400" /> {table.order.orderTime || '12:00'}
                      </span>
                      <span className="truncate max-w-[70px] text-slate-300">{table.order.waiterName || 'Garson'}</span>
                    </div>
                  </div>
                ) : isBillReq && table.order ? (
                  <div className="mt-2 pt-2 border-t border-[#F5C877]/30">
                    <div className="text-base font-black text-[#F5C877] font-mono tracking-tight">
                      {(Number(table.order.totalAmount) || 0).toFixed(2)} ₺
                    </div>
                    <div className="text-[10px] font-black text-[#F5C877] uppercase mt-0.5">
                      HESAP İSTENDİ
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-[#2C2C34] flex items-center justify-between text-[11px] font-bold text-emerald-400">
                    <span>Masa Boş</span>
                    <span className="text-xs font-bold text-[#8E8E98] group-hover:text-[#F5C877]">+ Sipariş</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ADİSYON VE SİPARİŞ ALMA MODALI (TAM RESPONSİVE & DÜZENLİ) */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/85 sm:p-2 md:p-4 z-50 backdrop-blur-md flex items-center justify-center animate-fadeIn select-none">
          <div className="bg-[#1C1C20] w-full h-full sm:h-[92vh] sm:max-w-7xl sm:rounded-3xl shadow-2xl border border-[#2C2C34] flex flex-col overflow-hidden text-[#FAF7F2]">
            
            {/* ÜST BAŞLIK & MASA ARAÇ ÇUBUĞU */}
            {/* ÜST BAŞLIK & MASA ARAÇ ÇUBUĞU */}
            <div className="bg-[#141416] border-b border-[#2C2C34] flex flex-col flex-shrink-0">
              {/* Üst Satır: Masa Bilgileri & Aksiyon Butonları */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                {/* Sol: Masa Bilgileri */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-sm sm:text-lg font-black text-[#FAF7F2] tracking-tight truncate">{selectedTable.name}</span>
                    <span className="text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-lg bg-[#222228] border border-[#2C2C34] text-[#8E8E98] whitespace-nowrap">
                      {sections.find(s => s.id === selectedTable.sectionId)?.name || 'Salon'}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      selectedTable.status === 'BILL_REQUESTED' ? 'bg-[#F5C877] animate-pulse' :
                      selectedTable.status === 'OCCUPIED' ? 'bg-rose-500' : 'bg-emerald-400'
                    }`} />
                  </div>

                  <span className="hidden md:inline-block text-xs text-[#F5C877] font-medium border-l border-[#2C2C34] pl-3 truncate">
                    Garson: <strong className="text-white">{selectedTable.order?.waiterName || 'Taha Usta'}</strong>
                  </span>
                </div>

                {/* Sağ: Hızlı İşlem Butonları */}
                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  {/* Müşteri Ata / Değiştir */}
                  <button
                    onClick={() => {
                      setAssignSearchQuery('');
                      setNewQuickCustName('');
                      setNewQuickCustPhone('');
                      setNewQuickCustAddress('');
                      setCustomerAssignModalOpen(true);
                    }}
                    className={`px-2 sm:px-2.5 py-1.5 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors ${
                      selectedTable.customerInfo
                        ? 'bg-amber-500/20 text-[#F5C877] border border-[#F5C877]/50'
                        : 'bg-[#222228] hover:bg-[#2C2C34] text-[#8E8E98] hover:text-white border border-[#2C2C34]'
                    }`}
                    title="Müşteri Seç / Paket Bilgisi"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{selectedTable.customerInfo ? 'Müşteri Değiştir' : 'Müşteri Ata'}</span>
                  </button>

                  {/* Ara Hesap / Adisyon Fişi Bas */}
                  {orderItems.length > 0 && (
                    <button
                      onClick={handlePrintPreliminaryBill}
                      className="px-2 sm:px-2.5 py-1.5 bg-[#222228] hover:bg-[#2C2C34] text-slate-200 border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                      title="Adisyon / Ara Hesap Fişi Yazdır"
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-400" />
                      <span className="hidden sm:inline">Adisyon Yazdır</span>
                    </button>
                  )}

                  {/* Masa Taşı & İptal */}
                  {selectedTable.status !== 'EMPTY' && (
                    <>
                      <button
                        onClick={() => setTransferModalOpen(true)}
                        className="px-2 sm:px-2.5 py-1.5 bg-[#222228] hover:bg-[#2C2C34] text-sky-400 border border-sky-500/30 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        title="Masayı Başka Masaya Taşı"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Taşı</span>
                      </button>

                      <button
                        onClick={() => setTableCancelModal({ open: true, selectedReason: CANCEL_REASONS[0], customNote: '' })}
                        className="px-2 sm:px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        title="Masayı ve Adisyonu İptal Et"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">İptal</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setSelectedTable(null)}
                    className="p-1.5 text-[#8E8E98] hover:text-white hover:bg-[#222228] cursor-pointer rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Kapat"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Alt Satır: Sadece Mobilde (< md) Görünen Segmented Tab Seçici */}
              <div className="md:hidden px-3 pb-2.5 flex items-center justify-between gap-2 border-t border-[#2C2C34]/40 pt-2">
                <div className="flex-1 grid grid-cols-2 bg-[#1C1C20] p-1 rounded-2xl border border-[#2C2C34] gap-1">
                  <button
                    onClick={() => setActiveModalTab('MENU')}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeModalTab === 'MENU'
                        ? 'bg-[#F5C877] text-[#141416] shadow-sm'
                        : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>Menü</span>
                  </button>
                  <button
                    onClick={() => setActiveModalTab('CART')}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeModalTab === 'CART'
                        ? 'bg-[#F5C877] text-[#141416] shadow-sm'
                        : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Adisyon ({orderItems.length})</span>
                    <span className="font-mono text-[11px] font-bold">
                      • {currentTotal.toFixed(0)} ₺
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* BAĞLI MÜŞTERİ BİLGİ ŞERİDİ (Varsa Kompakt ve Şık Gösterim) */}
            {selectedTable.customerInfo && (
              <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#261E16] to-[#1C1C20] border-b border-orange-500/30 flex items-center justify-between text-xs text-orange-200">
                <div className="flex items-center gap-2 truncate">
                  <span className="px-2 py-0.5 rounded bg-orange-500/20 text-[#F5C877] font-black text-[10px] flex items-center gap-1 flex-shrink-0">
                    <Bike className="w-3 h-3" /> Paket Müşterisi
                  </span>
                  <strong className="text-white truncate">{selectedTable.customerInfo.name}</strong>
                  <span className="font-mono text-[#F5C877] flex-shrink-0">({selectedTable.customerInfo.phone})</span>
                  {selectedTable.customerInfo.address && (
                    <span className="text-[#8E8E98] truncate hidden md:inline">• 📍 {selectedTable.customerInfo.address}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAssignSearchQuery('');
                    setCustomerAssignModalOpen(true);
                  }}
                  className="text-[11px] text-[#F5C877] hover:underline font-bold flex-shrink-0 ml-2"
                >
                  Düzenle
                </button>
              </div>
            )}

            {/* ANA GÖVDE: SOL MENÜ + SAĞ ADİSYON SEPETİ */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              
              {/* SOL SÜTUN: MENÜ VE ÜRÜNLER (Mobil/Tablette Tab'a Göre Görünür) */}
              <div className={`flex-1 flex-col h-full bg-[#1C1C20] overflow-hidden ${
                activeModalTab === 'MENU' ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Arama & Kategori Seçimi */}
                <div className="p-3 sm:p-4 border-b border-[#2C2C34] space-y-2.5 bg-[#1C1C20] flex-shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E98]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Menüde ürün ara (Adana kebap, ayran, künefe...)"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#141416] border border-[#2C2C34] focus:border-[#F5C877] rounded-2xl text-xs font-bold text-white focus:outline-none placeholder:text-[#8E8E98]"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E98] hover:text-white"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Yatay Kategori Çipleri */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-all ${
                        activeCategory === 'all'
                          ? 'bg-[#F5C877] text-[#141416] shadow-md shadow-[#F5C877]/20'
                          : 'bg-[#141416] text-[#8E8E98] hover:text-white border border-[#2C2C34]'
                      }`}
                    >
                      Tüm Menü ({products.length})
                    </button>
                    {categories.map((cat) => {
                      const count = products.filter(p => p.categoryId === cat.id).length;
                      const isCatActive = activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                            isCatActive
                              ? 'bg-[#F5C877] text-[#141416] shadow-md shadow-[#F5C877]/20'
                              : 'bg-[#141416] text-[#8E8E98] hover:text-white border border-[#2C2C34]'
                          }`}
                        >
                          <span>{cat.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                            isCatActive ? 'bg-[#141416]/20 text-[#141416]' : 'bg-[#222228] text-[#8E8E98]'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ürün Kartları Grid Listesi */}
                <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-[#8E8E98] text-xs">
                      <Search className="w-8 h-8 text-[#2C2C34] mb-2" />
                      <span>Aradığınız kriterde ürün bulunamadı.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {filteredProducts.map((prod) => {
                        const inCartCount = orderItems
                          .filter(i => i.productId === prod.id)
                          .reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

                        return (
                          <button
                            key={prod.id}
                            onClick={() => handleAddProduct(prod)}
                            className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all group flex flex-col justify-between h-28 cursor-pointer relative border ${
                              inCartCount > 0
                                ? 'bg-[#1F1E1C] border-[#F5C877]/50 shadow-md'
                                : 'bg-[#141416] hover:bg-[#1E1E24] border-[#2C2C34] hover:border-[#F5C877]/60 shadow-sm'
                            } active:scale-95`}
                          >
                            {/* Adisyonda Varsa Sayı Rozeti */}
                            {inCartCount > 0 && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#F5C877] text-[#141416] rounded-md text-[10px] font-black shadow">
                                {inCartCount} Adet
                              </span>
                            )}

                            <div>
                              <div className="font-black text-xs text-[#FAF7F2] group-hover:text-[#F5C877] line-clamp-2 pr-12 sm:pr-14">
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-[#8E8E98] mt-0.5">
                                ~{prod.preparationMin || 15} dk hazırlık
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2C2C34]/80">
                              <span className="font-black text-xs sm:text-sm text-[#F5C877] font-mono">
                                {prod.price} ₺
                              </span>
                              <div className="w-6 h-6 rounded-lg bg-[#F5C877] text-[#141416] flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                <Plus className="w-3.5 h-3.5 text-[#141416]" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mobilde Menü Görünümünde Sabit Alt Adisyon Butonu */}
                <div className="md:hidden p-3 bg-[#141416] border-t border-[#2C2C34] flex items-center justify-between shadow-lg">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#8E8E98]">Adisyon Toplamı</div>
                    <div className="text-base font-black text-[#F5C877] font-mono">
                      {currentTotal.toFixed(2)} ₺ <span className="text-xs text-[#8E8E98] font-normal">({orderItems.length} Kalem)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveModalTab('CART')}
                    className="px-4 py-2.5 bg-[#F5C877] text-[#141416] font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <span>Adisyonu İncele</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* SAĞ SÜTUN: ADİSYON SEPETİ (Ferah, Net & Düzenli) */}
              <div className={`w-full md:w-80 lg:w-[420px] xl:w-[460px] bg-[#141416] md:border-l border-[#2C2C34] flex-col h-full flex-shrink-0 overflow-hidden ${
                activeModalTab === 'CART' ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Sepet Başlığı */}
                <div className="px-4 py-2.5 bg-[#1C1C20] border-b border-[#2C2C34] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#FAF7F2] uppercase tracking-wide">Adisyon Kalemleri</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#141416] border border-[#2C2C34] text-[10px] font-bold text-[#F5C877]">
                      {orderItems.length} Kalem
                    </span>
                  </div>

                  {/* Mobilde Menüye Dönüş Butonu */}
                  <button
                    onClick={() => setActiveModalTab('MENU')}
                    className="md:hidden text-xs text-[#F5C877] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>+ Menüden Ürün Ekle</span>
                  </button>
                </div>

                {/* Masa Notu Varsa Şerit */}
                {generalOrderNote && (
                  <div className="px-4 py-2 bg-[#F5C877]/10 border-b border-[#F5C877]/30 text-xs text-[#F5C877] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[#F5C877]" />
                      <strong className="text-white truncate">{generalOrderNote}</strong>
                    </div>
                    <button
                      onClick={() => setGeneralOrderNote('')}
                      className="text-[10px] text-[#8E8E98] hover:text-white underline flex-shrink-0"
                    >
                      Kaldır
                    </button>
                  </div>
                )}

                {/* Sipariş Kalemleri Listesi */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                  {orderItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#8E8E98] text-xs text-center p-6 space-y-2">
                      <UtensilsCrossed className="w-10 h-10 text-[#2C2C34] stroke-1" />
                      <p className="font-bold text-slate-300">Adisyonda henüz ürün bulunmuyor.</p>
                      <p className="text-[11px] text-[#8E8E98]">
                        Soldaki menüden ürünlere dokunarak adisyona hızlıca ekleyebilirsiniz.
                      </p>
                      <button
                        onClick={() => setActiveModalTab('MENU')}
                        className="md:hidden mt-2 px-4 py-2 bg-[#F5C877] text-[#141416] font-black rounded-xl text-xs"
                      >
                        Menüye Git
                      </button>
                    </div>
                  ) : (
                    orderItems.map((item, idx) => {
                      const itemTotal = item.isGift ? 0 : ((Number(item.quantity) || 1) * (Number(item.price) || 0));

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition-all ${
                            item.isGift
                              ? 'bg-purple-950/20 border-purple-500/40'
                              : item.status === 'PENDING'
                              ? 'bg-[#1F1B14] border-[#F5C877]/40'
                              : 'bg-[#1C1C20] border-[#2C2C34]'
                          }`}
                        >
                          {/* 1. Satır: Ürün Adı, Rozet, Adet Kontrolü (+ / -) ve Satır Tutarı */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-xs text-[#FAF7F2] truncate">{item.productName}</span>
                                {item.isGift ? (
                                  <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded text-[9px] font-black">
                                    🎁 İkram
                                  </span>
                                ) : item.status === 'SENT_TO_KITCHEN' ? (
                                  <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black">
                                    Mutfakta
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 bg-[#F5C877] text-[#141416] rounded text-[9px] font-black">
                                    Yeni İlave
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Adet Kontrol Butonları (- [Adet] +) */}
                            <div className="flex items-center gap-1.5 bg-[#141416] px-1.5 py-1 rounded-xl border border-[#2C2C34]">
                              <button
                                onClick={() => handleDecreaseQuantity(idx)}
                                className="w-6 h-6 sm:w-5 sm:h-5 rounded-lg bg-[#222228] hover:bg-rose-500/20 hover:text-rose-400 text-[#8E8E98] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                                title="1 Adet Azalt / Sil"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center font-black text-xs text-white font-mono">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleIncreaseQuantity(idx)}
                                className="w-6 h-6 sm:w-5 sm:h-5 rounded-lg bg-[#222228] hover:bg-[#F5C877]/20 hover:text-[#F5C877] text-[#8E8E98] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                                title="1 Adet Arttır"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Satır Tutarı */}
                            <div className="text-right min-w-[65px]">
                              <span className={`font-mono font-black text-xs ${item.isGift ? 'text-purple-400 line-through' : 'text-[#FAF7F2]'}`}>
                                {itemTotal.toFixed(2)} ₺
                              </span>
                              {item.isGift && (
                                <div className="text-[10px] text-purple-300 font-bold">0.00 ₺</div>
                              )}
                            </div>
                          </div>

                          {/* 2. Satır: Birim Fiyat, Ekleyen Bilgisi & Hızlı Kalem İşlemleri */}
                          <div className="flex items-center justify-between text-[10px] text-[#8E8E98] mt-2 pt-1.5 border-t border-[#2C2C34]/60">
                            <div className="flex items-center gap-2">
                              <span>@{item.price} ₺</span>
                              <span>•</span>
                              <span>{item.addedBy || 'Garson'} ({item.addedAt || '12:00'})</span>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Not Ekle */}
                              <button
                                onClick={() => setItemNoteModal({ open: true, itemIndex: idx, noteText: item.note || '' })}
                                className="px-1.5 py-0.5 text-[#F5C877] hover:bg-[#F5C877]/10 rounded flex items-center gap-1 font-bold cursor-pointer"
                                title="Kaleme Pişirme/Özel Not Ekle"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{item.note ? 'Notu Düzenle' : 'Not'}</span>
                              </button>

                              {/* İkram Yap / Kaldır */}
                              <button
                                onClick={() => handleToggleItemGift(idx)}
                                className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-bold cursor-pointer ${
                                  item.isGift ? 'text-purple-400 bg-purple-500/10' : 'text-[#8E8E98] hover:text-purple-300'
                                }`}
                                title="Bu Ürünü İkram Yap"
                              >
                                <Gift className="w-3 h-3" />
                                <span>{item.isGift ? 'İkramı İptal Et' : 'İkram'}</span>
                              </button>

                              {/* Sil / İptal */}
                              <button
                                onClick={() => handleItemAction(idx)}
                                className="p-1 text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer ml-1"
                                title={item.status === 'PENDING' ? 'Listeden Sil' : 'Mutfaktan İptal Et'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Kalem Notu Varsa */}
                          {item.note && (
                            <div className="mt-1.5 text-[10px] text-[#F5C877] bg-[#F5C877]/10 px-2 py-1 rounded-lg font-bold border border-[#F5C877]/20 flex items-center gap-1">
                              <span>📝 {item.note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Adisyon Alt Özeti & Aksiyon Butonları */}
                <div className="p-3 sm:p-4 bg-[#1C1C20] border-t border-[#2C2C34] space-y-2.5 flex-shrink-0">
                  {/* Hızlı Masa Notu Girişi */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#8E8E98] whitespace-nowrap">Masa Notu:</span>
                    <input
                      type="text"
                      value={generalOrderNote}
                      onChange={(e) => setGeneralOrderNote(e.target.value)}
                      placeholder="Mutfak/kasa için not (örn: Acil gelsin, misafir masa)"
                      className="w-full px-2.5 py-1.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-xs text-[#FAF7F2] focus:outline-none focus:border-[#F5C877]"
                    />
                  </div>

                  {/* Toplam Göstergesi */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#8E8E98] tracking-wider">Adisyon Toplamı</span>
                      <div className="text-[10px] text-[#8E8E98]">{orderItems.length} Kalem Sipariş</div>
                    </div>
                    <span className="text-2xl font-black text-[#FAF7F2] font-mono tracking-tight">
                      {currentTotal.toFixed(2)} ₺
                    </span>
                  </div>

                  {/* Ana Aksiyon Butonları Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Mutfağa Gönder Butonu */}
                    <button
                      onClick={handleSendToKitchen}
                      className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md ${
                        orderItems.some(i => i.status === 'PENDING')
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 text-slate-950 shadow-orange-500/20 active:scale-95 animate-pulse'
                          : 'bg-[#282830] text-[#8E8E98] hover:text-white'
                      }`}
                    >
                      <Flame className="w-4 h-4" />
                      <span>Mutfağa Gönder</span>
                    </button>

                    {/* Hesap Kapat Butonu */}
                    <button
                      onClick={openCheckoutModal}
                      className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Hesap Kapat</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3 SEÇENEKLİ MÜŞTERİ ATAMA MODALI (SON ARAYANLAR / SON EKLENEN / REHBER) */}
      {/* ========================================================================= */}
      {customerAssignModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-[#FAF7F2] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div>
                <h3 className="text-base font-black text-white">{selectedTable.name} — Müşteri ve Teslimat Bilgisi Bağla</h3>
                <p className="text-[11px] text-[#F5C877] font-medium">Kurye ve mutfak fişlerinde adres ve telefonun çıkması için müşteri seçin.</p>
              </div>
              <button onClick={() => setCustomerAssignModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* 3 Seçenek Sekmesi */}
            <div className="flex bg-[#141416] p-1 rounded-2xl border border-[#2C2C34] gap-1">
              <button
                onClick={() => setCustomerAssignTab('CALLER_ID')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerAssignTab === 'CALLER_ID' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <PhoneIncoming className="w-3.5 h-3.5" />
                <span>📞 Son Arayanlar</span>
              </button>

              <button
                onClick={() => setCustomerAssignTab('RECENT_CUSTOMERS')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerAssignTab === 'RECENT_CUSTOMERS' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>✨ Son Müşteriler</span>
              </button>

              <button
                onClick={() => setCustomerAssignTab('SEARCH_ALL')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerAssignTab === 'SEARCH_ALL' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>🔍 Rehber / Yeni Ekle</span>
              </button>
            </div>

            {/* SEKME 1: SON ARAYANLAR */}
            {customerAssignTab === 'CALLER_ID' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {recentCalls.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8E8E98] bg-[#141416] rounded-2xl">
                    Henüz gelen arama kaydı yok.
                  </div>
                ) : (
                  recentCalls.map((call) => {
                    const matched = customers.find(c => (c.phone || '').includes(call.phone));
                    const name = matched ? matched.name : call.customerName;
                    const address = matched ? matched.address : call.address;

                    return (
                      <div
                        key={call.id}
                        onClick={() => handleAssignCustomerToTable({
                          customerId: matched?.id,
                          name: name,
                          phone: call.phone,
                          address: address || 'Adres bilgisi yok',
                        })}
                        className="p-3 bg-[#141416] hover:bg-[#282830] border border-[#2C2C34] hover:border-[#F5C877]/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-2">
                            <span>{name}</span>
                            <span className="text-[10px] text-[#F5C877] font-mono">{call.phone}</span>
                          </div>
                          <div className="text-[11px] text-[#8E8E98] truncate max-w-[340px] mt-0.5">📍 {address || 'Adres yok'}</div>
                        </div>

                        <span className="px-3 py-1.5 bg-[#F5C877] text-[#141416] rounded-xl text-[10px] font-black">
                          Bu Müşteriyi Ata →
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* SEKME 2: SON EKLENEN MÜŞTERİLER */}
            {customerAssignTab === 'RECENT_CUSTOMERS' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {[...customers].reverse().slice(0, 10).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleAssignCustomerToTable({
                      customerId: c.id,
                      name: c.name,
                      phone: c.phone || '',
                      address: c.address || 'Adres yok',
                    })}
                    className="p-3 bg-[#141416] hover:bg-[#282830] border border-[#2C2C34] hover:border-[#F5C877]/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div>
                      <div className="font-bold text-xs text-white">{c.name}</div>
                      <div className="text-[11px] text-[#F5C877] font-mono">{c.phone || 'Telefon yok'}</div>
                      <div className="text-[10px] text-[#8E8E98] truncate max-w-[340px]">📍 {c.address || 'Adres yok'}</div>
                    </div>

                    <span className="px-3 py-1.5 bg-[#F5C877] text-[#141416] rounded-xl text-[10px] font-black">
                      Ata →
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* SEKME 3: TÜM REHBERDE ARAMA VEYA YENİ MÜŞTERİ KAYDI */}
            {customerAssignTab === 'SEARCH_ALL' && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E8E98]" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="Müşteri adı, telefon veya adres ara..."
                    className="w-full pl-9 pr-3 py-2 bg-[#141416] border border-[#2C2C34] rounded-xl text-xs text-white focus:outline-none focus:border-[#F5C877]"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-[#2C2C34]/40">
                  {filteredAssignCustomers.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleAssignCustomerToTable({
                        customerId: c.id,
                        name: c.name,
                        phone: c.phone || '',
                        address: c.address || '',
                      })}
                      className="pt-1.5 flex items-center justify-between text-xs cursor-pointer hover:text-[#F5C877]"
                    >
                      <div>
                        <div className="font-bold text-white">{c.name} ({c.phone})</div>
                        <div className="text-[10px] text-[#8E8E98] truncate">{c.address}</div>
                      </div>
                      <span className="text-[10px] font-bold text-[#F5C877]">Ata →</span>
                    </div>
                  ))}
                </div>

                {/* HIZLI YENİ MÜŞTERİ FORMU */}
                <form onSubmit={handleQuickCreateAndAssignCustomer} className="p-3 bg-[#141416] rounded-2xl border border-[#2C2C34] space-y-2 pt-2">
                  <div className="text-[10px] font-black uppercase text-[#F5C877]">Yeni Müşteri Oluştur & Masaya Ata:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newQuickCustName}
                      onChange={(e) => setNewQuickCustName(e.target.value)}
                      placeholder="Müşteri Adı Soyadı"
                      className="p-2 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newQuickCustPhone}
                      onChange={(e) => setNewQuickCustPhone(e.target.value)}
                      placeholder="Telefon No"
                      className="p-2 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs text-[#F5C877] font-mono focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={newQuickCustAddress}
                    onChange={(e) => setNewQuickCustAddress(e.target.value)}
                    placeholder="Açık Teslimat Adresi..."
                    className="w-full p-2 bg-[#1C1C20] border border-[#2C2C34] rounded-xl text-xs text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] font-black text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    + Kaydet ve Bu Masaya Bağla
                  </button>
                </form>
              </div>
            )}

            <div className="pt-2 border-t border-[#2C2C34] flex justify-end">
              <button
                onClick={() => setCustomerAssignModalOpen(false)}
                className="px-4 py-2 bg-[#282830] text-[#8E8E98] rounded-xl text-xs font-bold"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KASA HIZLI NOT MODALI */}
      {itemNoteModal.open && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] border border-[#2C2C34] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#2C2C34] pb-2">
              <h4 className="text-sm font-black text-[#FAF7F2]">Ürün Açıklaması / Hızlı Not</h4>
              <button onClick={() => setItemNoteModal({ open: false, itemIndex: -1, noteText: '' })} className="text-[#8E8E98] hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#8E8E98] uppercase tracking-wider mb-2 block">Hızlı Hazır Notlar (Tıklayın):</label>
              <div className="flex flex-wrap gap-1.5">
                {KASA_QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = itemNoteModal.noteText ? `${itemNoteModal.noteText}, ${tag}` : tag;
                      setItemNoteModal({ ...itemNoteModal, noteText: current });
                    }}
                    className="px-2.5 py-1 bg-[#141416] hover:bg-[#282830] active:bg-[#F5C877] active:text-[#141416] text-xs font-bold rounded-lg text-[#FAF7F2] border border-[#2C2C34] cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#8E8E98] uppercase tracking-wider mb-1 block">Özel Not Yazın:</label>
              <input
                type="text"
                value={itemNoteModal.noteText}
                onChange={(e) => setItemNoteModal({ ...itemNoteModal, noteText: e.target.value })}
                placeholder="Örn: Lavaş çift, az pişmiş..."
                className="w-full p-2.5 bg-[#1C1C20] border border-[#383844] rounded-xl text-xs text-amber-300 focus:outline-none focus:border-[#F5C877]"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setItemNoteModal({ open: false, itemIndex: -1, noteText: '' })}
                className="flex-1 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white text-xs font-bold rounded-xl cursor-pointer"
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
                className="flex-1 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] text-[#141416] text-xs font-black rounded-xl shadow-lg cursor-pointer"
              >
                Notu Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAHSİLAT & HESAP KAPATMA MERKEZİ (TAM RESPONSİVE & DÜZENLİ) */}
      {checkoutModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center sm:p-3 z-50 backdrop-blur-md animate-fadeIn font-sans select-none">
          <div className="bg-[#1C1C20] w-full h-full sm:h-[94vh] sm:max-w-6xl sm:rounded-3xl shadow-2xl border border-[#2C2C34] flex flex-col overflow-hidden text-[#FAF7F2]">
            
            {/* ÜST BAŞLIK */}
            <div className="bg-[#141416] border-b border-[#2C2C34] flex flex-col flex-shrink-0">
              <div className="py-2.5 sm:py-3 px-3 sm:px-6 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black text-sm sm:text-lg flex-shrink-0">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-base font-black text-white flex items-center gap-1.5 sm:gap-2 truncate">
                      <span className="truncate">{selectedTable.name} — Tahsilat</span>
                      <span className="px-1.5 sm:px-2 py-0.5 bg-[#1C1C20] text-[#F5C877] rounded-md text-[10px] font-mono flex-shrink-0">
                        #{selectedTable.order?.orderNumber || 101}
                      </span>
                    </h2>
                    <p className="text-[10px] sm:text-[11px] text-[#8E8E98] font-medium hidden sm:block">
                      Parçalı ürün seçimi yapabilir veya Cari / İndirim uygulayabilirsiniz.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1C1C20] hover:bg-[#282830] text-[#8E8E98] hover:text-white flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                  title="Kapat"
                >
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Mobilde Görünüm Sekmesi (Adisyon vs Ödeme) */}
              <div className="md:hidden px-3 pb-2.5 pt-1 border-t border-[#2C2C34]/40">
                <div className="grid grid-cols-2 bg-[#1C1C20] p-1 rounded-2xl border border-[#2C2C34] gap-1">
                  <button
                    onClick={() => setCheckoutModalTab('ITEMS')}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      checkoutModalTab === 'ITEMS' ? 'bg-[#F5C877] text-[#141416] shadow-sm' : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Adisyon ({orderItems.length})</span>
                  </button>
                  <button
                    onClick={() => setCheckoutModalTab('PAYMENT')}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      checkoutModalTab === 'PAYMENT' ? 'bg-[#F5C877] text-[#141416] shadow-sm' : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Ödeme • {remainingTotal.toFixed(0)} ₺</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ANA GÖVDE */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 sm:p-5 gap-3 sm:gap-5 bg-[#141416]/60">
              
              {/* SOL SÜTUN: ADİSYON KALEMLERİ (PARÇALI SEÇİM) & ALINAN TAHSİLATLAR */}
              <div className={`w-full md:w-1/2 flex-col gap-3 overflow-hidden ${
                checkoutModalTab === 'ITEMS' ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Parçalı Kalem Seçim Listesi */}
                <div className="bg-[#141416] rounded-2xl border border-[#2C2C34] flex-1 overflow-hidden flex flex-col">
                  <div className="p-3 bg-[#1C1C20] border-b border-[#2C2C34] flex items-center justify-between text-xs font-bold">
                    <span className="text-[#F5C877] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Parçalı Ürün Ödeme (Dokunun)
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedPayItemIndices.length > 0 && (
                        <button
                          onClick={() => setSelectedPayItemIndices([])}
                          className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Seçimi Temizle
                        </button>
                      )}
                      <span className="text-[10px] text-[#8E8E98] bg-[#141416] px-2 py-0.5 rounded-lg border border-[#2C2C34]">
                        {selectedPayItemIndices.length > 0 ? `${selectedPayItemIndices.length} Kalem Seçildi` : 'Tüm Hesap'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-[#2C2C34]/40 p-1 space-y-0.5">
                    {orderItems.map((item, idx) => {
                      const isSelected = selectedPayItemIndices.includes(idx);
                      const itemTotal = item.isGift ? 0 : ((Number(item.price) || 0) * (Number(item.quantity) || 1));

                      return (
                        <div
                          key={idx}
                          onClick={() => handleTogglePayItem(idx)}
                          className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-[#F5C877]/20 border border-[#F5C877]/60 text-white font-bold shadow-inner' 
                              : 'hover:bg-[#1C1C20] text-[#FAF7F2]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] flex-shrink-0 ${
                              isSelected ? 'bg-[#F5C877] border-[#F5C877] text-[#141416] font-black' : 'border-[#2C2C34] bg-[#1C1C20]'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </div>
                            <div className="truncate">
                              <div className="font-bold truncate flex items-center gap-1.5">
                                <span>{item.productName}</span>
                                {item.isGift && (
                                  <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded text-[9px] font-black">İkram</span>
                                )}
                              </div>
                              {item.note && <div className="text-[10px] text-[#F5C877] truncate">📝 {item.note}</div>}
                              <div className="text-[9px] text-[#8E8E98]">👤 {item.addedBy || 'Garson'}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="text-[#8E8E98] font-mono text-[11px]">{item.quantity} x {item.price} ₺</span>
                            <span className={`font-mono font-black ${item.isGift ? 'text-purple-400 line-through' : 'text-amber-300'}`}>
                              {itemTotal.toFixed(2)} ₺
                            </span>
                            <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#F5C877]' : 'text-[#8E8E98]'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alınan Tahsilat Listesi */}
                <div className="bg-[#141416] rounded-2xl border border-[#2C2C34] p-3 flex flex-col flex-shrink-0">
                  <div className="flex justify-between text-[10px] font-black text-[#8E8E98] uppercase tracking-wider border-b border-[#2C2C34] pb-1.5 mb-1.5">
                    <span>ALINAN TAHSİLATLAR ({paymentEntries.length})</span>
                    <span>TUTAR / SİL</span>
                  </div>

                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {paymentEntries.length === 0 ? (
                      <div className="p-2 bg-[#1C1C20] text-[#8E8E98] text-xs font-bold text-center rounded-xl">
                        Henüz ödeme alınmadı
                      </div>
                    ) : (
                      paymentEntries.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs p-1.5 bg-[#1C1C20] rounded-xl border border-[#2C2C34]">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {p.type}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white">₺ {p.amount.toFixed(2)}</span>
                            <button
                              onClick={() => handleDeletePaymentEntry(p.id)}
                              className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
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

                {/* Tutar Dengesi Özeti */}
                <div className="bg-[#141416] rounded-2xl border border-[#2C2C34] p-3 space-y-1 text-xs font-bold flex-shrink-0">
                  <div className="flex justify-between text-[#8E8E98]">
                    <span>Toplam Adisyon:</span>
                    <span className="text-[#FAF7F2] font-mono">{currentTotal.toFixed(2)} ₺</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Alınan Tahsilat:</span>
                    <span className="font-mono">{paidTotal.toFixed(2)} ₺</span>
                  </div>
                  <div className="h-px bg-[#2C2C34] my-1"></div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-xs uppercase tracking-wider text-[#FAF7F2]">Kalan Ödenecek:</span>
                    <span className={`text-xl font-black font-mono ${isFullyPaid ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                      {remainingTotal.toFixed(2)} ₺
                    </span>
                  </div>
                </div>

                {/* Mobilde Ödemeye Geç Butonu */}
                <div className="md:hidden pt-1 flex-shrink-0">
                  <button
                    onClick={() => setCheckoutModalTab('PAYMENT')}
                    className="w-full py-3 bg-[#F5C877] hover:bg-[#F5C877]/90 text-[#141416] font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                  >
                    <span>Ödemeye Geç ({selectedPayItemIndices.length > 0 ? selectedPayTotal.toFixed(2) : remainingTotal.toFixed(2)} ₺)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* SAĞ SÜTUN: TUŞ TAKIMI, HESAPLAMA & ÖDEME BUTONLARI */}
              <div className={`w-full md:w-1/2 bg-[#141416] rounded-2xl border border-[#2C2C34] p-3 sm:p-4 flex-col justify-between overflow-y-auto ${
                checkoutModalTab === 'PAYMENT' ? 'flex' : 'hidden md:flex'
              }`}>
                
                {/* Mobilde Kalem Seçimine Dön Butonu */}
                <div className="md:hidden pb-2 flex-shrink-0">
                  <button
                    onClick={() => setCheckoutModalTab('ITEMS')}
                    className="w-full py-2 bg-[#1C1C20] hover:bg-[#282830] text-[#8E8E98] hover:text-white border border-[#2C2C34] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kalemleri & Parçalı Seçimi Gör ({orderItems.length} Kalem)</span>
                  </button>
                </div>

                {/* Tutar Göstergesi & Yüzde Düğmeleri */}
                <div className="space-y-2 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-[#1C1C20] border border-[#2C2C34] rounded-2xl px-4 py-2">
                    <span className="text-[#F5C877] font-black text-xl">₺</span>
                    <input
                      type="text"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right font-black font-mono text-2xl text-white bg-transparent focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 bg-[#1C1C20] p-1.5 rounded-xl border border-[#2C2C34]">
                    <span className="text-[10px] font-black uppercase text-[#8E8E98] px-1 flex items-center gap-0.5">
                      <Percent className="w-3 h-3 text-[#F5C877]" /> Kalan %:
                    </span>
                    <div className="flex gap-1 flex-1 justify-end">
                      <button onClick={() => handleApplyPercentage(5)} className="px-2 py-1 bg-[#141416] hover:bg-[#282830] text-[#F5C877] font-bold text-xs rounded-lg cursor-pointer">%5</button>
                      <button onClick={() => handleApplyPercentage(10)} className="px-2 py-1 bg-[#141416] hover:bg-[#282830] text-[#F5C877] font-bold text-xs rounded-lg cursor-pointer">%10</button>
                      <button onClick={() => handleApplyPercentage(15)} className="px-2 py-1 bg-[#141416] hover:bg-[#282830] text-[#F5C877] font-bold text-xs rounded-lg cursor-pointer">%15</button>
                      <button onClick={() => handleApplyPercentage(20)} className="px-2 py-1 bg-[#141416] hover:bg-[#282830] text-[#F5C877] font-bold text-xs rounded-lg cursor-pointer">%20</button>
                      <button onClick={() => handleApplyPercentage(50)} className="px-2 py-1 bg-[#141416] hover:bg-[#282830] text-[#F5C877] font-bold text-xs rounded-lg cursor-pointer">%50</button>
                    </div>
                  </div>
                </div>

                {/* Hızlı Banknot Butonları */}
                <div className="grid grid-cols-5 gap-1.5 my-2 flex-shrink-0">
                  <button onClick={() => setCalcInput('20')} className="py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] rounded-xl font-bold text-xs text-[#FAF7F2] cursor-pointer">20 ₺</button>
                  <button onClick={() => setCalcInput('50')} className="py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] rounded-xl font-bold text-xs text-[#FAF7F2] cursor-pointer">50 ₺</button>
                  <button onClick={() => setCalcInput('100')} className="py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] rounded-xl font-bold text-xs text-[#FAF7F2] cursor-pointer">100 ₺</button>
                  <button onClick={() => setCalcInput('200')} className="py-2 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] rounded-xl font-bold text-xs text-[#FAF7F2] cursor-pointer">200 ₺</button>
                  <button onClick={() => setCalcInput(remainingTotal.toFixed(2))} className="py-2 bg-[#F5C877]/15 hover:bg-[#F5C877]/25 border border-[#F5C877]/30 rounded-xl font-black text-xs text-[#F5C877] cursor-pointer">Tam Tutar</button>
                </div>

                {/* Numpad & Kişi Başı Bölüşüm */}
                <div className="grid grid-cols-4 gap-1.5 flex-1 my-1 min-h-[140px]">
                  <button onClick={() => setCalcInput(calcInput + '1')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">1</button>
                  <button onClick={() => setCalcInput(calcInput + '2')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">2</button>
                  <button onClick={() => setCalcInput(calcInput + '3')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">3</button>
                  <button onClick={() => handleSplitDivisor(2)} className="bg-[#1C1C20] hover:bg-[#282830] text-[11px] font-bold text-[#F5C877] rounded-xl border border-[#2C2C34] cursor-pointer">1/2 (2 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '4')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">4</button>
                  <button onClick={() => setCalcInput(calcInput + '5')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">5</button>
                  <button onClick={() => setCalcInput(calcInput + '6')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">6</button>
                  <button onClick={() => handleSplitDivisor(3)} className="bg-[#1C1C20] hover:bg-[#282830] text-[11px] font-bold text-[#F5C877] rounded-xl border border-[#2C2C34] cursor-pointer">1/3 (3 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '7')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">7</button>
                  <button onClick={() => setCalcInput(calcInput + '8')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">8</button>
                  <button onClick={() => setCalcInput(calcInput + '9')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">9</button>
                  <button onClick={() => handleSplitDivisor(4)} className="bg-[#1C1C20] hover:bg-[#282830] text-[11px] font-bold text-[#F5C877] rounded-xl border border-[#2C2C34] cursor-pointer">1/4 (4 Kişi)</button>

                  <button onClick={() => setCalcInput(calcInput + '.')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">.</button>
                  <button onClick={() => setCalcInput(calcInput + '0')} className="bg-[#1C1C20] hover:bg-[#282830] text-base font-bold rounded-xl cursor-pointer">0</button>
                  <button onClick={() => setCalcInput(calcInput.slice(0, -1))} className="bg-[#1C1C20] hover:bg-[#282830] text-xs font-bold text-rose-400 rounded-xl cursor-pointer">Sil</button>
                  <button onClick={() => handleSplitDivisor(5)} className="bg-[#1C1C20] hover:bg-[#282830] text-[11px] font-bold text-[#F5C877] rounded-xl border border-[#2C2C34] cursor-pointer">1/5 (5 Kişi)</button>
                </div>

                {/* Ödeme Yöntemleri Butonları */}
                <div className="space-y-1.5 pt-2 border-t border-[#2C2C34] flex-shrink-0">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAddPaymentEntry('Nakit')}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Nakit</span>
                    </button>

                    <button
                      onClick={() => handleAddPaymentEntry('Kredi Kartı')}
                      className="py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Kredi Kartı</span>
                    </button>

                    <button
                      onClick={handleOpenCariPicker}
                      className="py-2.5 bg-[#F5C877] hover:bg-[#F5C877]/90 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <Building2 className="w-4 h-4 text-[#141416]" />
                      <span>Cari (Veresiye)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAddPaymentEntry('İndirim (İskonto)')}
                      className="py-2 bg-[#282830] hover:bg-[#343440] text-[#F5C877] border border-[#F5C877]/30 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>İndirim (İskonto)</span>
                    </button>

                    <button
                      onClick={() => handleAddPaymentEntry('İkram (Tutar Düş)')}
                      className="py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>İkram (Hesaptan Düş)</span>
                    </button>
                  </div>

                  {/* Özel Tanımlı Diğer Ödeme Yöntemleri */}
                  {paymentMethods.filter(pm => pm.isActive && !['pm-cash', 'pm-card', 'pm-cari', 'pm-discount', 'pm-gift'].includes(pm.id)).length > 0 && (
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-bold max-h-16 overflow-y-auto hide-scrollbar pt-1">
                      {paymentMethods
                        .filter(pm => pm.isActive && !['pm-cash', 'pm-card', 'pm-cari', 'pm-discount', 'pm-gift'].includes(pm.id))
                        .map((pm) => (
                          <button
                            key={pm.id}
                            onClick={() => handleAddPaymentEntry(pm.name)}
                            className="py-1.5 bg-[#1C1C20] hover:bg-[#282830] border border-[#2C2C34] rounded-lg text-[#FAF7F2] truncate px-1 cursor-pointer"
                            title={pm.name}
                          >
                            {pm.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Alt Kapatma Butonları */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#2C2C34] flex-shrink-0">
                  <button
                    onClick={() => handleFinalizeBill(false)}
                    disabled={!isFullyPaid}
                    className={`py-3 sm:py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isFullyPaid 
                        ? 'bg-[#282830] hover:bg-[#343440] text-[#FAF7F2] shadow-lg active:scale-95' 
                        : 'bg-[#1C1C20] text-[#8E8E98] border border-[#2C2C34] cursor-not-allowed opacity-50'
                    }`}
                  >
                    {!isFullyPaid && <Lock className="w-3.5 h-3.5 text-[#8E8E98]" />}
                    <span>Masayı Kapat (Fişsiz)</span>
                  </button>

                  <button
                    onClick={() => handleFinalizeBill(true)}
                    disabled={!isFullyPaid}
                    className={`py-3 sm:py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                      isFullyPaid 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white shadow-emerald-600/20 active:scale-95' 
                        : 'bg-[#1C1C20] text-[#8E8E98] border border-[#2C2C34] cursor-not-allowed opacity-50'
                    }`}
                  >
                    {!isFullyPaid && <Lock className="w-3.5 h-3.5 text-[#8E8E98]" />}
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
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4 text-[#FAF7F2]">
            <div className="flex items-center justify-between border-b border-[#2C2C34] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Cari Müşteri Seçimi (Veresiye)</h3>
                  <p className="text-xs text-[#F5C877] font-bold">Aktarılacak Tutar: {parseFloat(calcInput || '0').toFixed(2)} ₺</p>
                </div>
              </div>

              <button onClick={() => setCariModalOpen(false)} className="text-[#8E8E98] hover:text-white cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E98]" />
              <input
                type="text"
                value={cariSearchQuery}
                onChange={(e) => setCariSearchQuery(e.target.value)}
                placeholder="Müşteri adı veya telefon ara..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#141416] border border-[#2C2C34] focus:border-[#F5C877] rounded-2xl text-xs font-bold text-white focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8E8E98] bg-[#141416] rounded-2xl">
                  Kayıtlı müşteri bulunamadı.
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleConfirmCariAssignment(c)}
                    className="p-3.5 bg-[#141416] hover:bg-[#F5C877]/10 border border-[#2C2C34] hover:border-[#F5C877]/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div>
                      <div className="font-black text-xs text-white group-hover:text-amber-300">{c.name}</div>
                      <div className="text-[11px] text-[#8E8E98] font-mono mt-0.5">{c.phone || 'Telefon yok'}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-[#8E8E98]">Mevcut Bakiye</div>
                      <div className={`font-mono font-black text-xs ${c.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatMoney(c.balance)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end">
              <button
                onClick={() => setCariModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-[#FAF7F2] rounded-xl text-xs font-bold cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚀 GÖRSEL MASA TAŞIMA MODALI (RESTORAN AYARLARI VE TÜM BÖLÜMLERLE UYUMLU) */}
      {/* ========================================================================= */}
      {transferModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-4xl w-full max-h-[90vh] sm:max-h-[85vh] p-4 sm:p-6 shadow-2xl border border-[#2C2C34] flex flex-col space-y-3 sm:space-y-4">
            
            {/* Modal Başlığı */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2C2C34] pb-3 sm:pb-4 gap-3">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#F5C877]/10 border border-[#F5C877]/30 text-[#F5C877] flex items-center justify-center font-black">
                    <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <span>{selectedTable.name} Masasını Taşı</span>
                      <span className="text-xs text-[#F5C877] font-bold">({selectedTable.order?.totalAmount ? `${Number(selectedTable.order.totalAmount).toFixed(2)} ₺` : 'Açık'})</span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#8E8E98]">Taşımak istediğiniz hedef masaya dokunun.</p>
                  </div>
                </div>

                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="sm:hidden text-[#8E8E98] hover:text-white cursor-pointer p-1"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Bölüm Filtre Butonları */}
              <div className="flex bg-[#141416] p-1 rounded-2xl border border-[#2C2C34] gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTransferSectionFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    transferSectionFilter === 'all' ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  Tümü
                </button>
                {sections.map(sec => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setTransferSectionFilter(sec.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      transferSectionFilter === sec.id ? 'bg-[#F5C877] text-[#141416]' : 'text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Masalar Izgarası (Grid) */}
            <div className="flex-1 overflow-y-auto p-2 bg-[#141416] rounded-2xl border border-[#2C2C34] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 min-h-[260px] max-h-[420px]">
              {tables
                .filter(t => transferSectionFilter === 'all' || t.sectionId === transferSectionFilter)
                .map(t => {
                  const isCurrent = t.id === selectedTable.id;
                  const isSelected = t.id === targetTransferTableId;
                  const isEmpty = t.status === 'EMPTY';
                  const isOccupied = t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED';
                  const secName = sections.find(s => s.id === t.sectionId)?.name || '';

                  let cardStyle = 'bg-[#1C1C20] border-[#2C2C34] hover:border-[#F5C877]/60 cursor-pointer';
                  if (isCurrent) {
                    cardStyle = 'bg-[#141416]/50 border-dashed border-[#2C2C34] opacity-30 cursor-not-allowed';
                  } else if (isSelected) {
                    cardStyle = 'bg-[#F5C877]/15 border-[#F5C877] ring-2 ring-[#F5C877] shadow-lg shadow-[#F5C877]/20 scale-[1.02]';
                  } else if (isEmpty) {
                    cardStyle = 'bg-[#1C1C20] border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/20 cursor-pointer';
                  } else if (isOccupied) {
                    cardStyle = 'bg-[#1C1C20] border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/20 cursor-pointer';
                  }

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (!isCurrent) {
                          setTargetTransferTableId(t.id);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[110px] ${cardStyle}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#8E8E98] truncate">{secName}</span>
                        {isCurrent ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">MEVCUT</span>
                        ) : isEmpty ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">BOŞ</span>
                        ) : (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">DOLU</span>
                        )}
                      </div>

                      <div className="my-1">
                        <div className="font-black text-sm text-white">{t.name}</div>
                        {isOccupied && t.order && (
                          <div className="text-[11px] font-mono font-bold text-rose-400 mt-0.5">
                            {(Number(t.order.totalAmount) || 0).toFixed(2)} ₺
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-bold">
                        {isSelected ? (
                          <span className="text-[#F5C877] font-black flex items-center gap-1">
                            ✓ Hedef Seçildi
                          </span>
                        ) : isEmpty ? (
                          <span className="text-emerald-400">Taşımaya Uygun</span>
                        ) : isOccupied ? (
                          <span className="text-rose-400">Birleştirilecek</span>
                        ) : (
                          <span className="text-[#8E8E98]">{t.capacity} Kişilik</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Alt Seçim ve Onay Barı */}
            <div className="pt-2 border-t border-[#2C2C34] flex items-center justify-between">
              <div className="text-xs">
                {targetTransferTableId ? (
                  <span className="font-bold text-white">
                    Seçilen Hedef: <strong className="text-[#F5C877] font-black text-sm">{tables.find(t => t.id === targetTransferTableId)?.name}</strong>
                    {tables.find(t => t.id === targetTransferTableId)?.status !== 'EMPTY' ? (
                      <span className="text-rose-400 ml-2 font-normal">(Dolu masa seçildi, siparişler birleştirilecek)</span>
                    ) : (
                      <span className="text-emerald-400 ml-2 font-normal">(Boş masa, doğrudan aktarılacak)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[#8E8E98]">Lütfen taşımak istediğiniz hedef masaya tıklayın.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTargetTransferTableId('');
                  }}
                  className="px-4 py-2.5 bg-[#282830] text-[#8E8E98] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!targetTransferTableId}
                  onClick={handleTransferTable}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#F5C877] to-[#D4A351] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-[#141416] font-black rounded-xl text-xs shadow-lg transition-all cursor-pointer"
                >
                  ✅ Masayı Taşı
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* İPTAL MODALI */}
      {itemCancelModal.open && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#2C2C34] space-y-4">
            <h3 className="text-base font-black text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Ürün İptal Onayı</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-[#8E8E98]">Kaç Adet İptal Edilecek? (Mevcut: {itemCancelModal.maxQty})</label>
              <input
                type="number"
                min="1"
                max={itemCancelModal.maxQty}
                value={itemCancelModal.cancelQty}
                onChange={(e) => setItemCancelModal({ ...itemCancelModal, cancelQty: Number(e.target.value) || 1 })}
                className="w-full mt-1 p-2.5 bg-[#141416] border border-[#2C2C34] rounded-xl text-xs font-mono font-bold text-[#F5C877]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#8E8E98]">İptal Sebebi Seçin:</label>
              <div className="space-y-1 mt-1">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setItemCancelModal({ ...itemCancelModal, selectedReason: r })}
                    className={`w-full p-2 rounded-xl border text-xs font-bold text-left cursor-pointer transition-all ${
                      itemCancelModal.selectedReason === r ? 'bg-rose-500/15 border-rose-500/50 text-rose-300' : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
              <button onClick={() => setItemCancelModal({ ...itemCancelModal, open: false })} className="px-4 py-2 bg-[#282830] text-[#8E8E98] rounded-xl text-xs font-bold">Vazgeç</button>
              <button onClick={handleConfirmItemCancel} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg">İptali Onayla & Fiş Kes</button>
            </div>
          </div>
        </div>
      )}

      {/* KOMPLE MASA İPTAL MODALI */}
      {tableCancelModal.open && selectedTable && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn font-sans">
          <div className="bg-[#1C1C20] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30 space-y-4">
            <h3 className="text-base font-black text-rose-400">{selectedTable.name} Masasını Komple İptal Et</h3>
            <div className="space-y-1">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setTableCancelModal({ ...tableCancelModal, selectedReason: r })}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer transition-all ${
                    tableCancelModal.selectedReason === r ? 'bg-rose-500/15 border-rose-500/50 text-rose-300' : 'bg-[#141416] border-[#2C2C34] text-[#8E8E98]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-[#2C2C34] flex justify-end gap-2">
              <button onClick={() => setTableCancelModal({ open: false, selectedReason: CANCEL_REASONS[0], customNote: '' })} className="px-4 py-2 bg-[#282830] text-[#8E8E98] text-xs font-bold">Vazgeç</button>
              <button onClick={handleConfirmTableCancel} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black">Masayı İptal Et & Kapat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
