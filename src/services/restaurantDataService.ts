// Gaziantepli Taha Usta - Restoran Veri Servisi (Personel Takibi & Sadeleştirilmiş Fiş)

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
  addedBy?: string; // Siparişi / İlaveyi Giren Garson veya Kasa
  addedAt?: string; // Giriş Saati (Örn: 14:35)
  isGift?: boolean;
  status: 'PENDING' | 'SENT_TO_KITCHEN';
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
  { id: 'sec-paket', name: 'Paket Servis', tableCount: 5, capacityPerTable: 1 },
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

    // Gelen yeni ürünlere ekleyen garsonun adını ve saatini damgala
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
      tables[tableIndex].status = 'EMPTY';
      tables[tableIndex].order = undefined;
      tables[tableIndex].customerInfo = undefined;
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

  public completeTablePayment(tableId: string, method: string) {
    const tables = this.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  // ÖDEME YÖNTEMLERİ CRUD
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

  // YAZICI CRUD
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

  // KATEGORİ CRUD
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

  // ÜRÜN CRUD
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

  // GARSON CRUD
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

  // FİŞ ŞABLONU
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
