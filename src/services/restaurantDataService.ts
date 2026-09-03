// Gaziantepli Taha Usta - Restoran Veri Servisi (Gider, Toptancı & Net Kasa Destekli Z Raporu)
import { dataService } from './dataService';

export interface SectionConfig {
  id: string;
  name: string;
  tableCount: number;
  capacityPerTable: number;
}

export interface CustomerDeliveryInfo {
  customerId?: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface TableState {
  id: string;
  name: string;
  sectionId: string;
  capacity: number;
  status: 'EMPTY' | 'OCCUPIED' | 'BILL_REQUESTED';
  customerInfo?: CustomerDeliveryInfo;
  order?: ActiveOrder;
}

export interface OrderItemState {
  id: string;
  productId: string;
  productName: string;
  categoryName?: string;
  price: number;
  quantity: number;
  targetPrinter: string;
  note?: string;
  addedBy?: string;
  addedAt?: string;
  isGift?: boolean;
  status: 'PENDING' | 'SENT_TO_KITCHEN';
}

export interface PaymentRecord {
  id: string;
  type: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  time: string;
}

export interface ActiveOrder {
  id: string;
  orderNumber: number;
  totalAmount: number;
  orderTime: string;
  waiterName: string;
  orderNote?: string;
  customerInfo?: CustomerDeliveryInfo;
  items: OrderItemState[];
  payments?: PaymentRecord[];
}

export interface CompletedOrderArchive {
  id: string;
  orderNumber: number;
  tableName: string;
  sectionName: string;
  waiterName: string;
  orderTime: string;
  closedTime: string;
  totalAmount: number;
  items: OrderItemState[];
  payments: PaymentRecord[];
  zReportId?: string;
}

export interface ZReport {
  id: string;
  zNo: number;
  openedAt: string;
  closedAt: string;
  closedBy: string;
  grossTotal: number;
  netTotal: number;
  totalOrders: number;
  paymentBreakdown: { [paymentType: string]: number };
  cariDetails: { [customerName: string]: number };
  
  // GİDERLER & TOPTANCI MALİ ALANLARI
  totalExpenses: number;
  cashExpenses: number;
  bankExpenses: number;
  supplierInvoicesTotal: number;
  supplierPaymentsTotal: number;
  supplierCashPayments: number;
  supplierBankPayments: number;
  netCashInRegister: number; // (Nakit Satış) - (Nakit Giderler) - (Toptancı Nakit Ödemeleri)

  discountTotal: number;
  giftTotal: number;
  cancelTotal: number;
  productSales: { [productName: string]: { quantity: number; total: number } };
  note?: string;
}

export interface CallLogItem {
  id: string;
  phone: string;
  customerId?: string;
  customerName: string;
  address?: string;
  time: string;
  date: string;
  isRegistered: boolean;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  type: 'CASH' | 'CARD' | 'MEAL_CARD' | 'DEBT' | 'DISCOUNT' | 'GIFT' | 'OTHER';
  color: string;
  isActive: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  color: string;
  printerId: string;
}

export interface ProductConfig {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  costPrice?: number;
  preparationMin: number;
  printerId?: string;
  isAvailable?: boolean;
}

export interface WaiterConfig {
  id: string;
  name: string;
  pin: string;
  qrToken: string;
  deviceUuid: string;
  deviceName: string;
  status: 'APPROVED' | 'SUSPENDED' | 'NOT_PAIRED';
  allowedSections: string[];
  permissions: {
    canDiscount: boolean;
    canVoidItem: boolean;
    canGift: boolean;
    canTransferTable: boolean;
    canPrintBill: boolean;
  };
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'NETWORK' | 'USB' | 'SERIAL';
  ipAddress?: string;
  port?: number;
  usbName?: string;
  role: string;
  paperWidth: number;
  autoCut: boolean;
  beepOnPrint: boolean;
  isBillPrinter: boolean;
  isKitchen: boolean;
}

export interface ReceiptSettingsConfig {
  title: string;
  subtitle: string;
  phone: string;
  address: string;
  taxNumber: string;
  footerMessage: string;
}

const STORAGE_KEYS = {
  SECTIONS: 'gtu_pos_sections',
  CATEGORIES: 'gtu_pos_categories',
  PRODUCTS: 'gtu_pos_products',
  WAITERS: 'gtu_pos_waiters',
  PRINTERS: 'gtu_pos_printers',
  TABLES: 'gtu_pos_tables',
  PAYMENT_METHODS: 'gtu_pos_payment_methods',
  RECEIPT_SETTINGS: 'gtu_pos_receipt_settings',
  COMPLETED_ORDERS: 'gtu_pos_completed_orders',
  Z_REPORTS: 'gtu_pos_z_reports',
  CANCEL_LOGS: 'gtu_pos_cancel_logs',
  CALL_LOGS: 'gtu_pos_call_logs',
};

const API_SYNC_URL = 'https://api.rymedya.com.tr/index.php';

const DEFAULT_PRINTERS: PrinterConfig[] = [
  { id: 'pr-kasa', name: 'Kasa Termal Yazıcı (USB)', type: 'USB', usbName: 'Afanda 892E', role: 'Hesap & Z Raporu', paperWidth: 80, autoCut: true, beepOnPrint: false, isBillPrinter: true, isKitchen: false },
  { id: 'pr-firin', name: 'Fırın Yazıcısı (IP)', type: 'NETWORK', ipAddress: '192.168.1.201', port: 9100, role: 'Lahmacun & Pide Fişleri', paperWidth: 80, autoCut: true, beepOnPrint: true, isBillPrinter: false, isKitchen: true },
  { id: 'pr-ocak', name: 'Kebap Ocağı Yazıcısı (IP)', type: 'NETWORK', ipAddress: '192.168.1.202', port: 9100, role: 'Kebap & Izgara Fişleri', paperWidth: 80, autoCut: true, beepOnPrint: true, isBillPrinter: false, isKitchen: true },
];

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'cat-kebap', name: 'Kebaplar & Izgaralar', color: '#ef4444', printerId: 'pr-ocak' },
  { id: 'cat-firin', name: 'Pide & Lahmacun', color: '#f97316', printerId: 'pr-firin' },
  { id: 'cat-corba', name: 'Çorbalar & Mezeler', color: '#eab308', printerId: 'pr-ocak' },
  { id: 'cat-icecek', name: 'İçecekler & Meşrubat', color: '#06b6d4', printerId: 'pr-kasa' },
  { id: 'cat-tatli', name: 'Tatlılar & Meyve', color: '#ec4899', printerId: 'pr-kasa' },
];

const DEFAULT_PRODUCTS: ProductConfig[] = [
  { id: 'p1', categoryId: 'cat-kebap', name: 'Adana Kebap (Porsiyon)', price: 320, preparationMin: 15, isAvailable: true },
  { id: 'p2', categoryId: 'cat-kebap', name: 'Urfa Kebap (Porsiyon)', price: 320, preparationMin: 15, isAvailable: true },
  { id: 'p3', categoryId: 'cat-kebap', name: 'Kuzu Şiş Kebap', price: 380, preparationMin: 18, isAvailable: true },
  { id: 'p4', categoryId: 'cat-kebap', name: 'Ali Nazik Kebap', price: 390, preparationMin: 20, isAvailable: true },
  { id: 'p5', categoryId: 'cat-firin', name: 'Gaziantep Lahmacun', price: 110, preparationMin: 8, isAvailable: true },
  { id: 'p6', categoryId: 'cat-firin', name: 'Kuşbaşılı Kaşarlı Pide', price: 280, preparationMin: 12, isAvailable: true },
  { id: 'p7', categoryId: 'cat-firin', name: 'Kıymalı Kaşarlı Pide', price: 260, preparationMin: 10, isAvailable: true },
  { id: 'p8', categoryId: 'cat-icecek', name: 'Açık Yayık Ayranı', price: 40, preparationMin: 1, isAvailable: true },
  { id: 'p9', categoryId: 'cat-icecek', name: 'Kutu Meşrubat / Şalgam', price: 45, preparationMin: 1, isAvailable: true },
  { id: 'p10', categoryId: 'cat-tatli', name: 'Antep Fıstıklı Künefe', price: 180, preparationMin: 12, isAvailable: true },
];

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'sec-salon', name: 'Ana Salon', tableCount: 12, capacityPerTable: 4 },
  { id: 'sec-bahce', name: 'Bahçe', tableCount: 10, capacityPerTable: 6 },
  { id: 'sec-paket', name: 'Paket Servis', tableCount: 8, capacityPerTable: 1 },
];

const DEFAULT_WAITERS: WaiterConfig[] = [
  {
    id: 'w-admin',
    name: 'Taha Usta (Kasa & Yönetici)',
    pin: '1234',
    qrToken: 'TOKEN-ROOT-TAHAUSTA-9901',
    deviceUuid: 'KASA-TERMINAL-ROOT',
    deviceName: 'Ana Kasa Terminali',
    status: 'APPROVED',
    allowedSections: ['ALL'],
    permissions: { canDiscount: true, canVoidItem: true, canGift: true, canTransferTable: true, canPrintBill: true },
  },
];

const DEFAULT_RECEIPT_SETTINGS: ReceiptSettingsConfig = {
  title: 'GAZİANTEPLİ TAHA USTA',
  subtitle: 'Kebap & Lahmacun Salonu',
  phone: '0 (342) 555 00 27',
  address: 'Şehitkamil / Gaziantep',
  taxNumber: '1234567890',
  footerMessage: 'Afiyet Olsun. Yine Bekleriz!',
};

type ChangeListener = () => void;

class RestaurantDataService {
  private listeners: Set<ChangeListener> = new Set();
  private pendingActivePosTableId: string | null = null;

  constructor() {
    setTimeout(() => this.pushStateToCloud(), 1000);
    setInterval(() => this.pullPendingOrdersFromCloud(), 2500);
  }

  public subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
    this.pushStateToCloud();
  }

  public setPendingPosTableToOpen(tableId: string) {
    this.pendingActivePosTableId = tableId;
  }

  public getAndClearPendingPosTable(): string | null {
    const id = this.pendingActivePosTableId;
    this.pendingActivePosTableId = null;
    return id;
  }

  public getRecentCalls(): CallLogItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.CALL_LOGS);
    return data ? JSON.parse(data) : [];
  }

  public saveRecentCalls(calls: CallLogItem[]) {
    localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(calls));
    this.notify();
  }

  public addCallLog(phone: string, customerInfo?: { id?: string; name?: string; address?: string }): CallLogItem {
    const calls = this.getRecentCalls();
    const isReg = Boolean(customerInfo?.id);
    const newCall: CallLogItem = {
      id: `call-${Date.now()}`,
      phone: phone,
      customerId: customerInfo?.id,
      customerName: customerInfo?.name || 'Kayıtsız Numara',
      address: customerInfo?.address || '',
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      date: 'Bugün',
      isRegistered: isReg,
    };
    const updated = [newCall, ...calls.filter(c => c.phone !== phone)].slice(0, 20);
    this.saveRecentCalls(updated);
    return newCall;
  }

  public async pushStateToCloud() {
    try {
      const printers = this.getPrinters();
      const categories = this.getCategories();
      const products = this.getProducts().map(p => {
        const cat = categories.find(c => c.id === p.categoryId);
        const printerId = p.printerId || cat?.printerId;
        const printer = printers.find(pr => pr.id === printerId);
        return {
          ...p,
          printer: printer ? printer.name : 'Kasa Yazıcısı'
        };
      });

      await fetch(`${API_SYNC_URL}?action=push_kasa_state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: this.getSections(),
          tables: this.getTables(),
          products,
          categories,
        }),
      });
    } catch (e) {}
  }

  public async pullPendingOrdersFromCloud() {
    try {
      const res = await fetch(`${API_SYNC_URL}?action=pull_pending_orders`);
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        data.orders.forEach((ord: any) => {
          if (ord.type === 'BILL_REQUEST') {
            this.setBillRequested(ord.tableId);
          } else if (ord.type === 'TRANSFER_TABLE') {
            this.transferTable(ord.sourceTableId, ord.targetTableId);
          } else {
            this.processIncomingOrder(ord);
          }
        });
      }
    } catch (e) {}
  }

  private processIncomingOrder(incoming: any) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === incoming.tableId);
    if (!table) return;

    const existingItems = table.order?.items || [];
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const newItems: OrderItemState[] = (incoming.items || []).map((i: any) => ({
      ...i,
      id: `item-${Date.now()}-${Math.random()}`,
      addedBy: incoming.waiterName || 'Garson',
      addedAt: currentTime,
      status: 'SENT_TO_KITCHEN'
    }));

    const mergedItems = [...existingItems, ...newItems];
    this.updateTableOrder(table.id, mergedItems, incoming.waiterName, table.customerInfo, incoming.orderNote);
  }

  public getSections(): SectionConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.SECTIONS);
    return data ? JSON.parse(data) : DEFAULT_SECTIONS;
  }

  public saveSections(sections: SectionConfig[]) {
    localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(sections));
    this.syncTablesWithSections(sections);
    this.notify();
  }

  public getTables(): TableState[] {
    const data = localStorage.getItem(STORAGE_KEYS.TABLES);
    if (data) return JSON.parse(data);
    return this.syncTablesWithSections(this.getSections());
  }

  public syncTablesWithSections(sections: SectionConfig[]): TableState[] {
    const existingTables: TableState[] = localStorage.getItem(STORAGE_KEYS.TABLES) 
      ? JSON.parse(localStorage.getItem(STORAGE_KEYS.TABLES)!) 
      : [];

    const updatedTables: TableState[] = [];

    sections.forEach((sec) => {
      for (let i = 1; i <= sec.tableCount; i++) {
        const tableId = `tbl-${sec.id}-${i}`;
        const existing = existingTables.find((t) => t.id === tableId);

        if (existing) {
          updatedTables.push({
            ...existing,
            sectionId: sec.id,
            name: `${sec.name} ${i}`,
            capacity: sec.capacityPerTable,
          });
        } else {
          updatedTables.push({
            id: tableId,
            name: `${sec.name} ${i}`,
            sectionId: sec.id,
            capacity: sec.capacityPerTable,
            status: 'EMPTY',
          });
        }
      }
    });

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(updatedTables));
    return updatedTables;
  }

  public transferTable(sourceTableId: string, targetTableId: string): boolean {
    const tables = this.getTables();
    const srcIndex = tables.findIndex(t => t.id === sourceTableId);
    const tgtIndex = tables.findIndex(t => t.id === targetTableId);

    if (srcIndex === -1 || tgtIndex === -1 || !tables[srcIndex].order) return false;

    tables[tgtIndex].status = 'OCCUPIED';
    tables[tgtIndex].order = {
      ...tables[srcIndex].order!,
      items: [...(tables[srcIndex].order!.items || [])],
    };
    tables[tgtIndex].customerInfo = tables[srcIndex].customerInfo;

    tables[srcIndex].status = 'EMPTY';
    tables[srcIndex].order = undefined;
    tables[srcIndex].customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
    return true;
  }

  public setBillRequested(tableId: string) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId);
    if (table && table.status === 'OCCUPIED') {
      table.status = 'BILL_REQUESTED';
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
      this.notify();
    }
  }

  public updateTableOrder(
    tableId: string, 
    items: OrderItemState[], 
    waiterName: string = 'Taha Usta',
    customerInfo?: CustomerDeliveryInfo,
    orderNote?: string
  ) {
    const tables = this.getTables();
    const tableIndex = tables.findIndex((t) => t.id === tableId);
    if (tableIndex === -1) return;

    if (items.length === 0) {
      if (customerInfo) {
        tables[tableIndex].customerInfo = customerInfo;
        tables[tableIndex].status = 'OCCUPIED';
        tables[tableIndex].order = {
          id: `ord-${Date.now()}`,
          orderNumber: Math.floor(100 + Math.random() * 900),
          totalAmount: 0,
          orderTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          waiterName: waiterName,
          orderNote: orderNote,
          customerInfo: customerInfo,
          items: [],
        };
      } else {
        tables[tableIndex].status = 'EMPTY';
        tables[tableIndex].order = undefined;
        tables[tableIndex].customerInfo = undefined;
      }
    } else {
      const totalAmount = items.reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
      const existingOrder = tables[tableIndex].order;
      const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      tables[tableIndex].status = 'OCCUPIED';
      if (customerInfo) tables[tableIndex].customerInfo = customerInfo;

      tables[tableIndex].order = {
        id: existingOrder?.id || `ord-${Date.now()}`,
        orderNumber: existingOrder?.orderNumber || Math.floor(100 + Math.random() * 900),
        totalAmount,
        orderTime: existingOrder?.orderTime || currentTime,
        waiterName: existingOrder?.waiterName || waiterName,
        orderNote: orderNote || existingOrder?.orderNote,
        customerInfo: customerInfo || tables[tableIndex].customerInfo,
        items: items.map(i => ({
          ...i,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          targetPrinter: i.targetPrinter || 'pr-ocak',
          note: i.note || '',
          addedBy: i.addedBy || waiterName || 'Garson',
          addedAt: i.addedAt || currentTime,
        })),
      };
    }

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  public cancelItemQuantity(tableId: string, itemIndex: number, cancelQty: number, reason: string) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId);
    if (!table || !table.order) return;

    const items = [...table.order.items];
    const targetItem = items[itemIndex];
    if (!targetItem) return;

    const cancelLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');
    cancelLogs.push({
      id: `cancel-${Date.now()}`,
      tableName: table.name,
      productName: targetItem.productName,
      quantity: cancelQty,
      amount: (targetItem.price || 0) * cancelQty,
      reason: reason,
      cancelledAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEYS.CANCEL_LOGS, JSON.stringify(cancelLogs));

    if (targetItem.quantity <= cancelQty) {
      items.splice(itemIndex, 1);
    } else {
      targetItem.quantity -= cancelQty;
    }

    this.updateTableOrder(tableId, items, table.order.waiterName, table.customerInfo, table.order.orderNote);
  }

  public cancelTableOrder(tableId: string, reason: string) {
    const tables = this.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  public completeTablePayment(tableId: string, method: string, payments: PaymentRecord[] = []) {
    const tables = this.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.order) return;

    const completedOrders: CompletedOrderArchive[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_ORDERS) || '[]');
    completedOrders.push({
      id: `arch-${Date.now()}`,
      orderNumber: table.order.orderNumber,
      tableName: table.name,
      sectionName: table.sectionId,
      waiterName: table.order.waiterName,
      orderTime: table.order.orderTime,
      closedTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      totalAmount: table.order.totalAmount,
      items: table.order.items,
      payments: payments.length > 0 ? payments : [{ id: 'p1', type: method, amount: table.order.totalAmount, time: new Date().toLocaleTimeString('tr-TR') }],
    });
    localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(completedOrders));

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  public getCompletedOrdersCurrentSession(): CompletedOrderArchive[] {
    const all: CompletedOrderArchive[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_ORDERS) || '[]');
    return all.filter(o => !o.zReportId);
  }

  // =========================================================================
  // GİDERLER & TOPTANCILARI İÇEREN KAPSAMLI X VE Z RAPORU MOTORU
  // =========================================================================
  public getCurrentXReport() {
    const orders = this.getCompletedOrdersCurrentSession();
    const cancelLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');

    // Bugünün Tarihi
    const todayStr = new Date().toISOString().split('T')[0];

    // İŞLETME GİDERLERİ (BUGÜNKÜLER)
    const allExpenses = dataService.getExpenses() || [];
    const todayExpenses = allExpenses.filter(e => e.date === todayStr);
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const cashExpenses = todayExpenses.filter(e => e.paymentMethod === 'CASH').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const bankExpenses = todayExpenses.filter(e => e.paymentMethod !== 'CASH').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // TOPTANCI FATURALARI VE ÖDEMELERİ (BUGÜNKÜLER)
    const allSupplierTxs = dataService.getSupplierTransactions() || [];
    const todaySupplierTxs = allSupplierTxs.filter(t => t.date === todayStr);
    const supplierInvoicesTotal = todaySupplierTxs.filter(t => t.type === 'INVOICE').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const todaySupplierPayments = todaySupplierTxs.filter(t => t.type === 'PAYMENT');
    const supplierPaymentsTotal = todaySupplierPayments.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const supplierCashPayments = todaySupplierPayments.filter(t => t.paymentMethod === 'CASH').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const supplierBankPayments = todaySupplierPayments.filter(t => t.paymentMethod !== 'CASH').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let grossTotal = 0;
    let discountTotal = 0;
    let giftTotal = 0;
    const paymentBreakdown: { [type: string]: number } = {};
    const cariDetails: { [customerName: string]: number } = {};
    const productSales: { [prod: string]: { quantity: number; total: number } } = {};

    orders.forEach(ord => {
      grossTotal += Number(ord.totalAmount) || 0;

      (ord.payments || []).forEach(p => {
        const pType = p.type || 'Nakit';
        const pAmount = Number(p.amount) || 0;

        if (pType.includes('İndirim') || pType.includes('İskonto')) {
          discountTotal += pAmount;
        } else if (pType.includes('İkram')) {
          giftTotal += pAmount;
        } else if (pType.includes('Cari')) {
          paymentBreakdown['Cari (Veresiye)'] = (paymentBreakdown['Cari (Veresiye)'] || 0) + pAmount;
          const custName = p.customerName || pType.replace('Cari (', '').replace(')', '').trim();
          cariDetails[custName] = (cariDetails[custName] || 0) + pAmount;
        } else {
          paymentBreakdown[pType] = (paymentBreakdown[pType] || 0) + pAmount;
        }
      });

      (ord.items || []).forEach(item => {
        if (!productSales[item.productName]) {
          productSales[item.productName] = { quantity: 0, total: 0 };
        }
        productSales[item.productName].quantity += Number(item.quantity) || 1;
        productSales[item.productName].total += (Number(item.price) || 0) * (Number(item.quantity) || 1);
      });
    });

    const cancelTotal = cancelLogs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
    const cashSales = paymentBreakdown['Nakit'] || 0;
    
    // KASADA KALAN NET NAKİT = (Nakit Satış) - (Kasadan Çıkan Nakit Giderler) - (Kasadan Toptancıya Ödenen Nakitler)
    const netCashInRegister = cashSales - cashExpenses - supplierCashPayments;

    return {
      grossTotal,
      netTotal: grossTotal - discountTotal,
      totalOrders: orders.length,
      paymentBreakdown,
      cariDetails,
      totalExpenses,
      cashExpenses,
      bankExpenses,
      supplierInvoicesTotal,
      supplierPaymentsTotal,
      supplierCashPayments,
      supplierBankPayments,
      netCashInRegister,
      discountTotal,
      giftTotal,
      cancelTotal,
      productSales,
      orders,
    };
  }

  public closeDailyZReport(note: string = '', closedBy: string = 'Taha Usta'): ZReport {
    const xData = this.getCurrentXReport();
    const zReports: ZReport[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.Z_REPORTS) || '[]');
    const nextZNo = zReports.length + 1;

    const zReport: ZReport = {
      id: `z-${Date.now()}`,
      zNo: nextZNo,
      openedAt: xData.orders[0]?.orderTime || '09:00',
      closedAt: new Date().toLocaleString('tr-TR'),
      closedBy: closedBy,
      grossTotal: xData.grossTotal,
      netTotal: xData.netTotal,
      totalOrders: xData.totalOrders,
      paymentBreakdown: xData.paymentBreakdown,
      cariDetails: xData.cariDetails,
      totalExpenses: xData.totalExpenses,
      cashExpenses: xData.cashExpenses,
      bankExpenses: xData.bankExpenses,
      supplierInvoicesTotal: xData.supplierInvoicesTotal,
      supplierPaymentsTotal: xData.supplierPaymentsTotal,
      supplierCashPayments: xData.supplierCashPayments,
      supplierBankPayments: xData.supplierBankPayments,
      netCashInRegister: xData.netCashInRegister,
      discountTotal: xData.discountTotal,
      giftTotal: xData.giftTotal,
      cancelTotal: xData.cancelTotal,
      productSales: xData.productSales,
      note: note,
    };

    zReports.push(zReport);
    localStorage.setItem(STORAGE_KEYS.Z_REPORTS, JSON.stringify(zReports));

    const allCompleted: CompletedOrderArchive[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_ORDERS) || '[]');
    allCompleted.forEach(o => {
      if (!o.zReportId) o.zReportId = zReport.id;
    });
    localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(allCompleted));

    localStorage.removeItem(STORAGE_KEYS.CANCEL_LOGS);
    this.notify();
    return zReport;
  }

  public getZReportsHistory(): ZReport[] {
    const data = localStorage.getItem(STORAGE_KEYS.Z_REPORTS);
    return data ? JSON.parse(data) : [];
  }

  public getPaymentMethods(): PaymentMethodConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
    return data ? JSON.parse(data) : [];
  }

  public savePaymentMethods(methods: PaymentMethodConfig[]) {
    localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(methods));
    this.notify();
  }

  public togglePaymentMethod(id: string) {
    const methods = this.getPaymentMethods().map(pm => pm.id === id ? { ...pm, isActive: !pm.isActive } : pm);
    this.savePaymentMethods(methods);
  }

  public addPaymentMethod(pm: Omit<PaymentMethodConfig, 'id'>): PaymentMethodConfig {
    const methods = this.getPaymentMethods();
    const newPm: PaymentMethodConfig = { ...pm, id: `pm-${Date.now()}` };
    const updated = [...methods, newPm];
    this.savePaymentMethods(updated);
    return newPm;
  }

  public deletePaymentMethod(id: string) {
    const methods = this.getPaymentMethods().filter(pm => pm.id !== id);
    this.savePaymentMethods(methods);
  }

  public getPrinters(): PrinterConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRINTERS);
    return data ? JSON.parse(data) : DEFAULT_PRINTERS;
  }

  public savePrinters(printers: PrinterConfig[]) {
    localStorage.setItem(STORAGE_KEYS.PRINTERS, JSON.stringify(printers));
    this.notify();
  }

  public addPrinter(printer: Omit<PrinterConfig, 'id'>): PrinterConfig {
    const printers = this.getPrinters();
    const newPr: PrinterConfig = { ...printer, id: `pr-${Date.now()}` };
    const updated = [...printers, newPr];
    this.savePrinters(updated);
    return newPr;
  }

  public updatePrinter(id: string, partial: Partial<PrinterConfig>) {
    const printers = this.getPrinters().map(p => p.id === id ? { ...p, ...partial } : p);
    this.savePrinters(printers);
  }

  public deletePrinter(id: string) {
    const printers = this.getPrinters().filter(p => p.id !== id);
    this.savePrinters(printers);
  }

  public getCategories(): CategoryConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
  }

  public saveCategories(cats: CategoryConfig[]) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    this.notify();
  }

  public addCategory(cat: Omit<CategoryConfig, 'id'>): CategoryConfig {
    const categories = this.getCategories();
    const newCat: CategoryConfig = { ...cat, id: `cat-${Date.now()}` };
    const updated = [...categories, newCat];
    this.saveCategories(updated);
    return newCat;
  }

  public updateCategory(id: string, partial: Partial<CategoryConfig>) {
    const categories = this.getCategories().map(c => c.id === id ? { ...c, ...partial } : c);
    this.saveCategories(categories);
  }

  public deleteCategory(id: string) {
    const categories = this.getCategories().filter(c => c.id !== id);
    this.saveCategories(categories);
  }

  public getProducts(): ProductConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : DEFAULT_PRODUCTS;
  }

  public saveProducts(products: ProductConfig[]) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.notify();
  }

  public addProduct(prod: Omit<ProductConfig, 'id'>): ProductConfig {
    const products = this.getProducts();
    const newProd: ProductConfig = { ...prod, id: `prod-${Date.now()}`, isAvailable: prod.isAvailable ?? true };
    const updated = [...products, newProd];
    this.saveProducts(updated);
    return newProd;
  }

  public updateProduct(id: string, partial: Partial<ProductConfig>) {
    const products = this.getProducts().map(p => p.id === id ? { ...p, ...partial } : p);
    this.saveProducts(products);
  }

  public deleteProduct(id: string) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  }

  public getWaiters(): WaiterConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.WAITERS);
    return data ? JSON.parse(data) : DEFAULT_WAITERS;
  }

  public saveWaiters(waiters: WaiterConfig[]) {
    localStorage.setItem(STORAGE_KEYS.WAITERS, JSON.stringify(waiters));
    this.notify();
  }

  public addWaiter(waiter: Omit<WaiterConfig, 'id' | 'qrToken' | 'deviceUuid' | 'deviceName' | 'status'>): WaiterConfig {
    const waiters = this.getWaiters();
    const newW: WaiterConfig = {
      ...waiter,
      id: `w-${Date.now()}`,
      qrToken: `TOKEN-GTU-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      deviceUuid: 'Henüz Eşleşmedi',
      deviceName: 'Eşleşme Bekleniyor',
      status: 'NOT_PAIRED',
    };
    const updated = [...waiters, newW];
    this.saveWaiters(updated);
    return newW;
  }

  public updateWaiter(id: string, partial: Partial<WaiterConfig>) {
    const waiters = this.getWaiters().map(w => w.id === id ? { ...w, ...partial } : w);
    this.saveWaiters(waiters);
  }

  public deleteWaiter(id: string) {
    const waiters = this.getWaiters().filter(w => w.id !== id);
    this.saveWaiters(waiters);
  }

  public getReceiptSettings(): ReceiptSettingsConfig {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPT_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_RECEIPT_SETTINGS;
  }

  public saveReceiptSettings(settings: ReceiptSettingsConfig) {
    localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(settings));
    this.notify();
  }
}

export const restaurantDataService = new RestaurantDataService();
