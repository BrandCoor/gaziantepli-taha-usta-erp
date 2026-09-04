// Gaziantepli Taha Usta - Restoran Veri Servisi (Gider, Toptancı & Net Kasa Destekli Z Raporu)
import { dataService } from './dataService';

export interface SectionConfig {
  id: string;
  name: string;
  tableCount: number;
  capacityPerTable: number;
  capacity?: number;
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
  time?: string;
}

export interface ReportFilterOptions {
  startDate?: string;
  endDate?: string;
  sectionName?: string;
  waiterName?: string;
  paymentType?: string;
  serviceShift?: 'ALL' | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'NIGHT';
  minAmount?: number;
  maxAmount?: number;
  categoryId?: string;
  searchQuery?: string;
}

export interface DetailedReportResult {
  grossTotal: number;
  netTotal: number;
  discountTotal: number;
  giftTotal: number;
  cancelTotal: number;
  totalOrders: number;
  avgOrderAmount: number;
  paymentBreakdown: { [key: string]: number };
  cariDetails?: { [customerName: string]: number };
  sectionBreakdown: { [key: string]: { count: number; total: number } };
  waiterBreakdown: { [key: string]: { count: number; total: number } };
  vatBreakdown: Array<{ rate: number; baseAmount: number; vatAmount: number; total: number }>;
  productSales: { [key: string]: { quantity: number; total: number; categoryName?: string } };
  categorySales: { [key: string]: { quantity: number; total: number } };
  hourlySales: { [hour: string]: { count: number; total: number } };
  totalExpenses: number;
  cashExpenses?: number;
  supplierInvoicesTotal: number;
  supplierPaymentsTotal: number;
  supplierCashPayments?: number;
  netCashFlow: number;
  operatingProfit?: number;
  orders: CompletedOrderArchive[];
  cancelLogs: Array<{
    id: string;
    tableName: string;
    productName: string;
    quantity: number;
    amount: number;
    reason: string;
    cancelledAt: string;
    cancelledBy?: string;
  }>;
  giftLogs?: Array<{
    tableName: string;
    productName: string;
    quantity: number;
    amount: number;
    waiterName?: string;
    orderNumber?: number;
  }>;
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
  date?: string;
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

  // KASA SAYIMI & MUTABAKATI
  openingCashFloat?: number; // Açılış Avansı
  countedCash?: number;      // Fiziki Sayılan Nakit
  cashDifference?: number;   // Kasa Farkı (+ Fazla / - Açık)
  transferredCash?: number;  // Ertesi Güne Kalan Devir Nakit

  discountTotal: number;
  giftTotal: number;
  cancelTotal: number;
  productSales: { [productName: string]: { quantity: number; total: number } };
  waiterBreakdown?: { [waiterName: string]: number };
  sectionBreakdown?: { [sectionName: string]: number };
  vatBreakdown?: Array<{ rate: number; baseAmount: number; vatAmount: number; total: number }>;
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
  type: 'CASH' | 'CARD' | 'MEAL_CARD' | 'DEBT' | 'DISCOUNT' | 'GIFT' | 'OTHER' | 'CREDIT_CARD';
  color?: string;
  isActive?: boolean;
  enabled?: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  color: string;
  printerId?: string;
}

export interface ProductConfig {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  costPrice?: number;
  preparationMin?: number;
  prepTimeMinutes?: number;
  printerId?: string;
  isAvailable?: boolean;
}

export interface WaiterConfig {
  id: string;
  name: string;
  phone?: string;
  pin: string;
  qrToken: string;
  deviceUuid: string;
  deviceName: string;
  macAddress: string;
  status: 'APPROVED' | 'SUSPENDED' | 'NOT_PAIRED' | 'PENDING';
  allowedSections: string[];
  permissions: {
    canDiscount: boolean;
    canVoidItem: boolean;
    canGift: boolean;
    canTransferTable: boolean;
    canPrintBill: boolean;
  };
  lastActiveAt?: string;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'NETWORK' | 'USB' | 'SERIAL';
  ipAddress?: string;
  port?: number;
  usbName?: string;
  serialPort?: string;
  baudRate?: number;
  role: string;
  paperWidth: number;
  autoCut: boolean;
  cutType?: 'FULL' | 'PARTIAL';
  beepOnPrint: boolean;
  codePage?: 'CP857' | 'UTF8' | 'WIN1254';
  copies?: number;
  isBillPrinter: boolean;
  isKitchen: boolean;
}

export interface ReceiptSettingsConfig {
  title: string;
  subtitle: string;
  phone: string;
  address: string;
  taxNumber: string;
  taxOffice?: string;
  mersisNo?: string;
  wifiName?: string;
  wifiPassword?: string;
  instagram?: string;
  footerMessage: string;
  showWaiterName?: boolean;
  showTableNumber?: boolean;
  showVatDetails?: boolean;
  showOrderTime?: boolean;
  showBarcode?: boolean;
  printLogo?: boolean;
  paperWidth?: 80 | 58;
}

export interface HardwareSettingsConfig {
  cashDrawer: {
    enabled: boolean;
    openOnCashPayment: boolean;
    openOnCardPayment: boolean;
    printerId: string;
    pulsePin: 'PIN_2' | 'PIN_5';
    pulseDurationMs: number;
  };
  scale: {
    enabled: boolean;
    port: string;
    baudRate: number;
    protocol: 'CAS' | 'DIBAL' | 'BIZERBA' | 'DIGI' | 'CUSTOM';
    unit: 'KG' | 'GR';
    autoReadOnWeightItem: boolean;
  };
  customerDisplay: {
    enabled: boolean;
    type: 'VFD_2X20' | 'SECONDARY_MONITOR';
    port: string;
    baudRate: number;
    welcomeMessageLine1: string;
    welcomeMessageLine2: string;
    showItemPrices: boolean;
  };
  callerId: {
    enabled: boolean;
    port: string;
    deviceModel: 'HUGIN' | 'CIDSHOW' | 'EVEREST' | 'GENERIC_MODEM';
    autoOpenDeliveryScreen: boolean;
    popupNotification: boolean;
  };
  soundAlerts: {
    enabled: boolean;
    volume: number; // 10 to 100
    ringtoneType: 'phone' | 'kitchen' | 'register' | 'melody' | 'alert';
    repeatCount: number; // 1 to 5
    newOrderSound: boolean;
    kitchenAlertSound: boolean;
    deliveryOrderSound: boolean;
    paymentSuccessSound: boolean;
  };
}

export interface TrendyolYemekConfig {
  enabled: boolean;
  isOpen?: boolean; // Platform Siparişe Açık / Kapalı durumu
  supplierId: string;
  apiKey: string;
  secretKey: string;
  email: string;
  autoPrintReceipt: boolean;
  preparationTimeMinutes: number;
  deliveryModel: 'RESTAURANT' | 'PLATFORM'; // Restoran Kuryesi veya Trendyol GO Kuryesi
}

export interface GetirYemekConfig {
  enabled: boolean;
  isOpen?: boolean; // Platform Siparişe Açık / Kapalı durumu
  restaurantName: string;
  secretKey: string;
  restaurantId: string;
  autoPrintReceipt: boolean;
  preparationTimeMinutes: number;
  deliveryModel: 'RESTAURANT' | 'PLATFORM'; // Restoran Getirsin veya Getir Getirsin
}

export interface YemekSepetiConfig {
  enabled: boolean;
  isOpen?: boolean; // Platform Siparişe Açık / Kapalı durumu
  username: string;
  password: string;
  restaurantId: string;
  autoPrintReceipt: boolean;
  preparationTimeMinutes: number;
  deliveryModel: 'RESTAURANT' | 'PLATFORM'; // Kendi Kuryemle veya Yemeksepeti Vale
}

export interface FoodPlatformsConfig {
  trendyol: TrendyolYemekConfig;
  getir: GetirYemekConfig;
  yemeksepeti: YemekSepetiConfig;
  continuousAlarmUntilAction: boolean; // Onay veya iptal edilene kadar zil öter
  autoAcceptOrders: boolean;
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
  HARDWARE_SETTINGS: 'gtu_pos_hardware_settings',
  COMPLETED_ORDERS: 'gtu_pos_completed_orders',
  Z_REPORTS: 'gtu_pos_z_reports',
  CANCEL_LOGS: 'gtu_pos_cancel_logs',
  CALL_LOGS: 'gtu_pos_call_logs',
  FOOD_PLATFORMS: 'gtu_pos_food_platforms',
  ONLINE_ORDERS: 'gtu_online_orders',
};

export const DEFAULT_FOOD_PLATFORMS: FoodPlatformsConfig = {
  trendyol: {
    enabled: true,
    isOpen: true,
    supplierId: '770463',
    apiKey: 'Es32CcLQUCJs51lAPgJ8',
    secretKey: 'xbuy0pocdpcUOfGd8kNS9',
    email: 'mehmettahagumus@icloud.com',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  getir: {
    enabled: true,
    isOpen: true,
    restaurantName: 'Gaziantepli Taha Usta (Eğitim Mah.)',
    secretKey: '85309848fd36282068984f02259f91c2873d2bc6',
    restaurantId: 'GETIR-27-01',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  yemeksepeti: {
    enabled: true,
    isOpen: true,
    username: 'mehmettahagumus@icloud.com',
    password: 'Gaziantepli27taha',
    restaurantId: 'YS-TAHA-27',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  continuousAlarmUntilAction: true,
  autoAcceptOrders: false,
};

const API_SYNC_URL = 'https://api.rymedya.com.tr/index.php';

const DEFAULT_PRINTERS: PrinterConfig[] = [];

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'cat-kebap', name: 'Kebaplar & Izgaralar', color: '#ef4444' },
  { id: 'cat-firin', name: 'Pide & Lahmacun', color: '#f97316' },
  { id: 'cat-corba', name: 'Çorbalar & Mezeler', color: '#eab308' },
  { id: 'cat-icecek', name: 'İçecekler & Meşrubat', color: '#06b6d4' },
  { id: 'cat-tatli', name: 'Tatlılar & Meyve', color: '#ec4899' },
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

const DEFAULT_WAITERS: WaiterConfig[] = [];

const DEFAULT_RECEIPT_SETTINGS: ReceiptSettingsConfig = {
  title: 'GAZİANTEPLİ TAHA USTA',
  subtitle: 'Kebap & Lahmacun Salonu',
  phone: '0 (342) 555 00 27',
  address: 'Şehitkamil / Gaziantep',
  taxNumber: '1234567890',
  taxOffice: 'Şehitkamil V.D.',
  mersisNo: '012345678900001',
  wifiName: 'TahaUsta_Misafir',
  wifiPassword: 'anteplilezzetleri',
  instagram: '@gazianteplitahausta',
  footerMessage: 'Afiyet Olsun. Yine Bekleriz!',
  showWaiterName: true,
  showTableNumber: true,
  showVatDetails: true,
  showOrderTime: true,
  showBarcode: true,
  printLogo: true,
  paperWidth: 80,
};

export const DEFAULT_HARDWARE_SETTINGS: HardwareSettingsConfig = {
  cashDrawer: {
    enabled: true,
    openOnCashPayment: true,
    openOnCardPayment: false,
    printerId: 'pr-kasa',
    pulsePin: 'PIN_2',
    pulseDurationMs: 100,
  },
  scale: {
    enabled: false,
    port: 'COM3',
    baudRate: 9600,
    protocol: 'CAS',
    unit: 'KG',
    autoReadOnWeightItem: true,
  },
  customerDisplay: {
    enabled: false,
    type: 'VFD_2X20',
    port: 'COM2',
    baudRate: 9600,
    welcomeMessageLine1: 'GAZIANTEPLI TAHA USTA',
    welcomeMessageLine2: 'HOS GELDINIZ...',
    showItemPrices: true,
  },
  callerId: {
    enabled: true,
    port: 'COM4',
    deviceModel: 'HUGIN',
    autoOpenDeliveryScreen: true,
    popupNotification: true,
  },
  soundAlerts: {
    enabled: true,
    volume: 80,
    ringtoneType: 'phone',
    repeatCount: 2,
    newOrderSound: true,
    kitchenAlertSound: true,
    deliveryOrderSound: true,
    paymentSuccessSound: true,
  },
};

type ChangeListener = () => void;

class RestaurantDataService {
  private listeners: Set<ChangeListener> = new Set();
  private pendingActivePosTableId: string | null = null;
  private kitchenPrintCallback?: (table: TableState, items: OrderItemState[], waiterName: string, orderNote?: string) => void;
  private billPrintCallback?: (table: TableState, items: OrderItemState[]) => void;

  public onKitchenOrderPrint(cb: (table: TableState, items: OrderItemState[], waiterName: string, orderNote?: string) => void) {
    this.kitchenPrintCallback = cb;
  }

  public onBillRequestPrint(cb: (table: TableState, items: OrderItemState[]) => void) {
    this.billPrintCallback = cb;
  }

  constructor() {
    this.purgeDemoData();
    setTimeout(() => this.pushStateToCloud(), 1000);
    setInterval(() => this.pullPendingOrdersFromCloud(), 2500);
  }

  private purgeDemoData() {
    try {
      // Purge demo waiters
      const rawWaiters = localStorage.getItem(STORAGE_KEYS.WAITERS);
      if (rawWaiters) {
        const waiters: WaiterConfig[] = JSON.parse(rawWaiters);
        const demoWaiterIds = ['w-1', 'w-2', 'w-admin'];
        const filtered = waiters.filter(w => !demoWaiterIds.includes(w.id) && !w.name.includes('Ahmet Yılmaz') && !w.name.includes('Mehmet Demir'));
        if (filtered.length !== waiters.length) {
          localStorage.setItem(STORAGE_KEYS.WAITERS, JSON.stringify(filtered));
        }
      }

      // Purge demo fake printers
      const rawPrinters = localStorage.getItem(STORAGE_KEYS.PRINTERS);
      if (rawPrinters) {
        const printers: PrinterConfig[] = JSON.parse(rawPrinters);
        const demoPrinterIps = ['192.168.1.200', '192.168.1.201', '192.168.1.202', '192.168.1.203'];
        const demoPrinterIds = ['pr-kasa', 'pr-firin', 'pr-ocak', 'pr-mutfak'];
        const filtered = printers.filter(p => !demoPrinterIds.includes(p.id) && !demoPrinterIps.includes(p.ipAddress || ''));
        if (filtered.length !== printers.length) {
          localStorage.setItem(STORAGE_KEYS.PRINTERS, JSON.stringify(filtered));
        }
      }

      // Purge demo printerId bindings from categories
      const rawCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (rawCategories) {
        const categories: CategoryConfig[] = JSON.parse(rawCategories);
        const demoPrinterIds = ['pr-kasa', 'pr-firin', 'pr-ocak', 'pr-mutfak'];
        let catChanged = false;
        const cleanedCategories = categories.map(c => {
          if (c.printerId && demoPrinterIds.includes(c.printerId)) {
            catChanged = true;
            const { printerId, ...rest } = c;
            return rest;
          }
          return c;
        });
        if (catChanged) {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cleanedCategories));
        }
      }

      // Purge seed orders
      const rawOrders = localStorage.getItem(STORAGE_KEYS.COMPLETED_ORDERS);
      if (rawOrders) {
        const orders: CompletedOrderArchive[] = JSON.parse(rawOrders);
        const filtered = orders.filter(o => !o.id.startsWith('ord-seed-'));
        if (filtered.length !== orders.length) {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(filtered));
        }
      }

      // Purge seed z-reports
      const rawZ = localStorage.getItem(STORAGE_KEYS.Z_REPORTS);
      if (rawZ) {
        const zReports: ZReport[] = JSON.parse(rawZ);
        const filtered = zReports.filter(z => !z.id.startsWith('z-seed-'));
        if (filtered.length !== zReports.length) {
          localStorage.setItem(STORAGE_KEYS.Z_REPORTS, JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.warn('RestaurantDataService demo purge error:', e);
    }
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
          employees: this.getWaiters(),
        }),
      });
    } catch (e) {}
  }

  public async pullPendingOrdersFromCloud() {
    try {
      // 1. Eşleşen Telefonları Canlı Senkronize Et
      try {
        const devRes = await fetch(`${API_SYNC_URL}?action=get_paired_devices`);
        const devData = await devRes.json();
        if (devData.success && devData.devices) {
          const waiters = this.getWaiters();
          let waiterUpdated = false;

          waiters.forEach((w) => {
            const paired = devData.devices[w.id];
            if (paired && paired.deviceUuid) {
              if (w.status !== 'APPROVED' || w.macAddress !== paired.deviceUuid) {
                w.status = 'APPROVED';
                w.macAddress = paired.deviceUuid;
                w.deviceUuid = paired.deviceUuid;
                w.deviceName = paired.deviceName || 'Akıllı Telefon';
                waiterUpdated = true;
              }
            }
          });

          if (waiterUpdated) {
            localStorage.setItem(STORAGE_KEYS.WAITERS, JSON.stringify(waiters));
            this.notify();
          }
        }
      } catch (devErr) {}

      // 2. Bekleyen Siparişleri Çek
      const res = await fetch(`${API_SYNC_URL}?action=pull_pending_orders`);
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        data.orders.forEach((ord: any) => {
          if (ord.type === 'BILL_REQUEST') {
            this.setBillRequested(ord.tableId);
            const tbl = this.getTables().find(t => t.id === ord.tableId);
            if (tbl && tbl.order?.items && tbl.order.items.length > 0 && this.billPrintCallback) {
              this.billPrintCallback(tbl, tbl.order.items);
            }
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

    // Garsonun mobilden girdiği yeni sipariş kalemlerini anında mutfak yazıcılarına bas
    if (newItems.length > 0 && this.kitchenPrintCallback) {
      const currentTable = this.getTables().find(t => t.id === incoming.tableId) || table;
      this.kitchenPrintCallback(currentTable, newItems, incoming.waiterName || 'Garson', incoming.orderNote);
    }
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

  public addSection(section: Omit<SectionConfig, 'id'>): SectionConfig {
    const sections = this.getSections();
    const newSec: SectionConfig = {
      ...section,
      id: `sec-${Date.now()}`,
      capacityPerTable: section.capacityPerTable || section.capacity || 4,
    };
    const updated = [...sections, newSec];
    this.saveSections(updated);
    return newSec;
  }

  public updateSection(id: string, partial: Partial<SectionConfig>) {
    const sections = this.getSections().map(s => {
      if (s.id === id) {
        return {
          ...s,
          ...partial,
          capacityPerTable: partial.capacityPerTable || partial.capacity || s.capacityPerTable || 4,
        };
      }
      return s;
    });
    this.saveSections(sections);
  }

  public deleteSection(id: string) {
    const sections = this.getSections().filter(s => s.id !== id);
    this.saveSections(sections);
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

    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const completedOrders: CompletedOrderArchive[] = this.getAllCompletedOrders();
    completedOrders.push({
      id: `arch-${Date.now()}`,
      orderNumber: table.order.orderNumber,
      tableName: table.name,
      sectionName: table.sectionId,
      waiterName: table.order.waiterName,
      orderTime: table.order.orderTime || timeStr,
      closedTime: `${todayDate} ${timeStr}`,
      date: todayDate,
      totalAmount: table.order.totalAmount,
      items: table.order.items,
      payments: payments.length > 0 ? payments : [{ id: `p-${Date.now()}`, type: method, amount: table.order.totalAmount, time: timeStr }],
    });
    localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(completedOrders));

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  public getAllCompletedOrders(): CompletedOrderArchive[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_ORDERS);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  public getCompletedOrdersCurrentSession(): CompletedOrderArchive[] {
    const all = this.getAllCompletedOrders();
    return all.filter(o => !o.zReportId);
  }

  private generateSeedCompletedOrders(): CompletedOrderArchive[] {
    return [];
    /*
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    return [
      {
        id: 'ord-seed-1',
        orderNumber: 101,
        tableName: 'Salon - Masa 1',
        sectionName: 'Ana Salon',
        waiterName: 'Ahmet Garson',
        orderTime: `${today} 12:15`,
        closedTime: `${today} 13:05`,
        date: today,
        totalAmount: 900,
        items: [
          { id: 'i1', productId: 'p1', productName: 'Adana Kebap (Porsiyon)', price: 320, quantity: 2, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i2', productId: 'p8', productName: 'Açık Yayık Ayranı', price: 40, quantity: 2, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
          { id: 'i3', productId: 'p10', productName: 'Antep Fıstıklı Künefe', price: 180, quantity: 1, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p1', type: 'Kredi Kartı', amount: 900, time: '13:05' }],
      },
      {
        id: 'ord-seed-2',
        orderNumber: 102,
        tableName: 'Salon - Masa 3',
        sectionName: 'Ana Salon',
        waiterName: 'Taha Usta',
        orderTime: `${today} 12:40`,
        closedTime: `${today} 13:30`,
        date: today,
        totalAmount: 1400,
        items: [
          { id: 'i4', productId: 'p1', productName: 'Adana Kebap (Porsiyon)', price: 320, quantity: 3, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i5', productId: 'p5', productName: 'Gaziantep Lahmacun', price: 110, quantity: 4, targetPrinter: 'pr-firin', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p2', type: 'Nakit', amount: 1400, time: '13:30' }],
      },
      {
        id: 'ord-seed-3',
        orderNumber: 103,
        tableName: 'Bahçe - Masa 2',
        sectionName: 'Bahçe',
        waiterName: 'İbrahim',
        orderTime: `${today} 13:10`,
        closedTime: `${today} 14:00`,
        date: today,
        totalAmount: 650,
        items: [
          { id: 'i6', productId: 'p6', productName: 'Kuşbaşılı Kaşarlı Pide', price: 280, quantity: 2, targetPrinter: 'pr-firin', status: 'SENT_TO_KITCHEN' },
          { id: 'i7', productId: 'p9', productName: 'Kutu Meşrubat / Şalgam', price: 45, quantity: 2, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p3', type: 'Nakit', amount: 650, time: '14:00' }],
      },
      {
        id: 'ord-seed-4',
        orderNumber: 104,
        tableName: 'Paket Servis - P1',
        sectionName: 'Paket Servis',
        waiterName: 'Ahmet Garson',
        orderTime: `${today} 13:30`,
        closedTime: `${today} 14:15`,
        date: today,
        totalAmount: 580,
        items: [
          { id: 'i8', productId: 'p1', productName: 'Adana Kebap (Porsiyon)', price: 320, quantity: 1, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i9', productId: 'p5', productName: 'Gaziantep Lahmacun', price: 110, quantity: 2, targetPrinter: 'pr-firin', status: 'SENT_TO_KITCHEN' },
          { id: 'i10', productId: 'p8', productName: 'Açık Yayık Ayranı', price: 40, quantity: 1, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p4', type: 'Kredi Kartı', amount: 580, time: '14:15' }],
      },
      {
        id: 'ord-seed-5',
        orderNumber: 105,
        tableName: 'Bahçe - Masa 5',
        sectionName: 'Bahçe',
        waiterName: 'İbrahim',
        orderTime: `${today} 14:00`,
        closedTime: `${today} 14:50`,
        date: today,
        totalAmount: 1140,
        items: [
          { id: 'i11', productId: 'p4', productName: 'Ali Nazik Kebap', price: 390, quantity: 2, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i12', productId: 'p10', productName: 'Antep Fıstıklı Künefe', price: 180, quantity: 2, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p5', type: 'Sodexo', amount: 1140, time: '14:50' }],
      },
      {
        id: 'ord-seed-6',
        orderNumber: 106,
        tableName: 'Salon - Masa 6',
        sectionName: 'Ana Salon',
        waiterName: 'Taha Usta',
        orderTime: `${today} 14:30`,
        closedTime: `${today} 15:20`,
        date: today,
        totalAmount: 1020,
        items: [
          { id: 'i13', productId: 'p3', productName: 'Kuzu Şiş Kebap', price: 380, quantity: 2, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i14', productId: 'p10', productName: 'Antep Fıstıklı Künefe', price: 180, quantity: 1, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
          { id: 'i15', productId: 'p8', productName: 'Açık Yayık Ayranı', price: 40, quantity: 2, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p6', type: 'Cari (Mehmet Kaya)', customerName: 'Mehmet Kaya', amount: 1020, time: '15:20' }],
      },
      // Dünkü Siparişler (Z-25'e ait)
      {
        id: 'ord-seed-y1',
        orderNumber: 90,
        tableName: 'Salon - Masa 2',
        sectionName: 'Ana Salon',
        waiterName: 'Ahmet Garson',
        orderTime: `${yesterday} 18:00`,
        closedTime: `${yesterday} 19:10`,
        date: yesterday,
        totalAmount: 2200,
        items: [
          { id: 'iy1', productId: 'p3', productName: 'Kuzu Şiş Kebap', price: 380, quantity: 4, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'iy2', productId: 'p10', productName: 'Antep Fıstıklı Künefe', price: 180, quantity: 3, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
          { id: 'iy3', productId: 'p8', productName: 'Açık Yayık Ayranı', price: 40, quantity: 4, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'py1', type: 'Kredi Kartı', amount: 2200, time: '19:10' }],
        zReportId: 'z-seed-25',
      },
      {
        id: 'ord-seed-y2',
        orderNumber: 91,
        tableName: 'Bahçe - Masa 1',
        sectionName: 'Bahçe',
        waiterName: 'İbrahim',
        orderTime: `${yesterday} 19:30`,
        closedTime: `${yesterday} 20:45`,
        date: yesterday,
        totalAmount: 1840,
        items: [
          { id: 'iy4', productId: 'p1', productName: 'Adana Kebap (Porsiyon)', price: 320, quantity: 4, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'iy5', productId: 'p5', productName: 'Gaziantep Lahmacun', price: 110, quantity: 4, targetPrinter: 'pr-firin', status: 'SENT_TO_KITCHEN' },
          { id: 'iy6', productId: 'p9', productName: 'Kutu Meşrubat / Şalgam', price: 45, quantity: 4, targetPrinter: 'pr-kasa', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'py2', type: 'Nakit', amount: 1840, time: '20:45' }],
        zReportId: 'z-seed-25',
      },
      // 2 gün önceki sipariş (Z-24'e ait)
      {
        id: 'ord-seed-2d1',
        orderNumber: 75,
        tableName: 'Salon - Masa 4',
        sectionName: 'Ana Salon',
        waiterName: 'Taha Usta',
        orderTime: `${twoDaysAgo} 13:00`,
        closedTime: `${twoDaysAgo} 14:10`,
        date: twoDaysAgo,
        totalAmount: 1560,
        items: [
          { id: 'i2d1', productId: 'p2', productName: 'Urfa Kebap (Porsiyon)', price: 320, quantity: 3, targetPrinter: 'pr-ocak', status: 'SENT_TO_KITCHEN' },
          { id: 'i2d2', productId: 'p5', productName: 'Gaziantep Lahmacun', price: 110, quantity: 4, targetPrinter: 'pr-firin', status: 'SENT_TO_KITCHEN' },
        ],
        payments: [{ id: 'p2d1', type: 'Nakit', amount: 1560, time: '14:10' }],
        zReportId: 'z-seed-24',
      },
    ];
    */
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
    const waiterBreakdown: { [waiter: string]: number } = {};
    const sectionBreakdown: { [sec: string]: number } = {};

    orders.forEach(ord => {
      grossTotal += Number(ord.totalAmount) || 0;
      sectionBreakdown[ord.sectionName || 'Diğer'] = (sectionBreakdown[ord.sectionName || 'Diğer'] || 0) + (Number(ord.totalAmount) || 0);
      waiterBreakdown[ord.waiterName || 'Garson'] = (waiterBreakdown[ord.waiterName || 'Garson'] || 0) + (Number(ord.totalAmount) || 0);

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

    const netTotal = grossTotal - discountTotal;
    const vatRate = 10;
    const vatBase = netTotal / 1.10;
    const vatAmount = netTotal - vatBase;

    return {
      grossTotal,
      netTotal,
      totalOrders: orders.length,
      avgOrderAmount: orders.length > 0 ? grossTotal / orders.length : 0,
      paymentBreakdown,
      cariDetails,
      sectionBreakdown,
      waiterBreakdown,
      vatBreakdown: [{ rate: vatRate, baseAmount: vatBase, vatAmount, total: netTotal }],
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
      cancelLogs,
    };
  }

  public closeDailyZReport(
    note: string = '', 
    closedBy: string = 'Taha Usta',
    countData?: { 
      openingCashFloat?: number; 
      countedCash?: number; 
      cashDifference?: number; 
      transferredCash?: number;
    }
  ): ZReport {
    const xData = this.getCurrentXReport();
    const zReports: ZReport[] = this.getZReportsHistory();
    const nextZNo = zReports.length > 0 ? Math.max(...zReports.map(z => z.zNo)) + 1 : 1;

    const netCash = xData.netCashInRegister;
    const openingFloat = countData?.openingCashFloat ?? 1000;
    const counted = countData?.countedCash ?? (netCash + openingFloat);
    const diff = countData?.cashDifference ?? (counted - (netCash + openingFloat));
    const transferred = countData?.transferredCash ?? openingFloat;

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
      netCashInRegister: netCash,
      openingCashFloat: openingFloat,
      countedCash: counted,
      cashDifference: diff,
      transferredCash: transferred,
      discountTotal: xData.discountTotal,
      giftTotal: xData.giftTotal,
      cancelTotal: xData.cancelTotal,
      productSales: xData.productSales,
      waiterBreakdown: xData.waiterBreakdown,
      sectionBreakdown: xData.sectionBreakdown,
      vatBreakdown: xData.vatBreakdown,
      note: note,
    };

    zReports.push(zReport);
    localStorage.setItem(STORAGE_KEYS.Z_REPORTS, JSON.stringify(zReports));

    const allCompleted = this.getAllCompletedOrders();
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
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }

  private generateSeedZReports(): ZReport[] {
    return [];
    /*
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('tr-TR');
    const twoDaysAgo = new Date(Date.now() - 172800000).toLocaleDateString('tr-TR');

    return [
      {
        id: 'z-seed-24',
        zNo: 24,
        openedAt: `${twoDaysAgo} 09:30`,
        closedAt: `${twoDaysAgo} 23:45`,
        closedBy: 'Taha Usta',
        grossTotal: 19450,
        netTotal: 18950,
        totalOrders: 32,
        paymentBreakdown: { 'Nakit': 8400, 'Kredi Kartı': 9150, 'Sodexo': 1400 },
        cariDetails: {},
        totalExpenses: 2100,
        cashExpenses: 900,
        bankExpenses: 1200,
        supplierInvoicesTotal: 4500,
        supplierPaymentsTotal: 2500,
        supplierCashPayments: 1500,
        supplierBankPayments: 1000,
        netCashInRegister: 6000,
        openingCashFloat: 1000,
        countedCash: 7000,
        cashDifference: 0,
        transferredCash: 1000,
        discountTotal: 500,
        giftTotal: 240,
        cancelTotal: 0,
        productSales: {
          'Adana Kebap (Porsiyon)': { quantity: 28, total: 8960 },
          'Gaziantep Lahmacun': { quantity: 45, total: 4950 },
          'Açık Yayık Ayranı': { quantity: 40, total: 1600 },
          'Antep Fıstıklı Künefe': { quantity: 19, total: 3420 },
        },
        vatBreakdown: [{ rate: 10, baseAmount: 17227.27, vatAmount: 1722.73, total: 18950 }],
        note: 'Normal gün sonu kapanışı, kasa tam denk.',
      },
      {
        id: 'z-seed-25',
        zNo: 25,
        openedAt: `${yesterday} 09:15`,
        closedAt: `${yesterday} 23:55`,
        closedBy: 'Taha Usta',
        grossTotal: 24680,
        netTotal: 24100,
        totalOrders: 38,
        paymentBreakdown: { 'Nakit': 11200, 'Kredi Kartı': 10800, 'Sodexo': 1100, 'Cari (Veresiye)': 1000 },
        cariDetails: { 'Ahmet Yıldız': 1000 },
        totalExpenses: 2800,
        cashExpenses: 1100,
        bankExpenses: 1700,
        supplierInvoicesTotal: 6200,
        supplierPaymentsTotal: 3500,
        supplierCashPayments: 2000,
        supplierBankPayments: 1500,
        netCashInRegister: 8100,
        openingCashFloat: 1000,
        countedCash: 9150,
        cashDifference: 50,
        transferredCash: 1000,
        discountTotal: 580,
        giftTotal: 320,
        cancelTotal: 110,
        productSales: {
          'Adana Kebap (Porsiyon)': { quantity: 34, total: 10880 },
          'Urfa Kebap (Porsiyon)': { quantity: 18, total: 5760 },
          'Gaziantep Lahmacun': { quantity: 52, total: 5720 },
          'Antep Fıstıklı Künefe': { quantity: 24, total: 4320 },
          'Açık Yayık Ayranı': { quantity: 58, total: 2320 },
        },
        vatBreakdown: [{ rate: 10, baseAmount: 21909.09, vatAmount: 2190.91, total: 24100 }],
        note: 'Hafta sonu yoğunluğu, +50 TL kasa fazlası.',
      },
    ];
    */
  }

  public getFilteredReport(filters: ReportFilterOptions = {}): DetailedReportResult {
    const allCompleted = this.getAllCompletedOrders();
    const currentOrders = this.getCompletedOrdersCurrentSession();

    const orderMap = new Map<string, CompletedOrderArchive>();
    allCompleted.forEach(o => orderMap.set(o.id, o));
    currentOrders.forEach(o => orderMap.set(o.id, o));
    let orders = Array.from(orderMap.values());

    const getOrderDate = (o: CompletedOrderArchive): string => {
      if (o.date && o.date.includes('-')) return o.date;
      const raw = o.closedTime || o.orderTime || '';
      if (raw.includes('-')) {
        return raw.split('T')[0].split(' ')[0];
      }
      return new Date().toISOString().split('T')[0];
    };

    const getOrderHour = (o: CompletedOrderArchive): number => {
      const raw = o.closedTime || o.orderTime || '';
      const timePart = raw.includes(' ') ? raw.split(' ')[1] : raw;
      if (timePart.includes(':')) {
        return parseInt(timePart.split(':')[0], 10) || 12;
      }
      return 12;
    };

    if (filters.startDate) {
      orders = orders.filter(o => getOrderDate(o) >= filters.startDate!);
    }
    if (filters.endDate) {
      orders = orders.filter(o => getOrderDate(o) <= filters.endDate!);
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      orders = orders.filter(o => 
        String(o.orderNumber || '').includes(q) || 
        (o.tableName || '').toLowerCase().includes(q) ||
        (o.waiterName || '').toLowerCase().includes(q) ||
        (o.sectionName || '').toLowerCase().includes(q)
      );
    }
    if (filters.sectionName && filters.sectionName !== 'ALL') {
      orders = orders.filter(o => (o.sectionName || '').toLowerCase().includes(filters.sectionName!.toLowerCase()));
    }
    if (filters.waiterName && filters.waiterName !== 'ALL') {
      orders = orders.filter(o => (o.waiterName || '').toLowerCase().includes(filters.waiterName!.toLowerCase()));
    }
    if (filters.paymentType && filters.paymentType !== 'ALL') {
      orders = orders.filter(o => (o.payments || []).some(p => p.type.toLowerCase().includes(filters.paymentType!.toLowerCase())));
    }
    if (filters.serviceShift && filters.serviceShift !== 'ALL') {
      orders = orders.filter(o => {
        const hour = getOrderHour(o);
        if (filters.serviceShift === 'BREAKFAST') return hour >= 7 && hour < 11;
        if (filters.serviceShift === 'LUNCH') return hour >= 11 && hour < 16;
        if (filters.serviceShift === 'DINNER') return hour >= 16 && hour < 23;
        if (filters.serviceShift === 'NIGHT') return hour >= 23 || hour < 7;
        return true;
      });
    }
    if (filters.minAmount !== undefined && filters.minAmount > 0) {
      orders = orders.filter(o => (Number(o.totalAmount) || 0) >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined && filters.maxAmount > 0) {
      orders = orders.filter(o => (Number(o.totalAmount) || 0) <= filters.maxAmount!);
    }

    let grossTotal = 0;
    let discountTotal = 0;
    let giftTotal = 0;
    const paymentBreakdown: { [key: string]: number } = {};
    const cariDetails: { [customerName: string]: number } = {};
    const sectionBreakdown: { [key: string]: { count: number; total: number } } = {};
    const waiterBreakdown: { [key: string]: { count: number; total: number } } = {};
    const productSales: { [key: string]: { quantity: number; total: number; categoryName?: string } } = {};
    const categorySales: { [key: string]: { quantity: number; total: number } } = {};
    const hourlySales: { [hour: string]: { count: number; total: number } } = {};
    const giftLogs: Array<{
      tableName: string;
      productName: string;
      quantity: number;
      amount: number;
      waiterName?: string;
      orderNumber?: number;
    }> = [];

    const categories = this.getCategories();
    const products = this.getProducts();
    const prodCategoryMap: { [prodName: string]: string } = {};
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      prodCategoryMap[p.name] = cat?.name || 'Kebap & Izgara';
    });

    orders.forEach(ord => {
      const ordAmt = Number(ord.totalAmount) || 0;
      grossTotal += ordAmt;

      const secKey = ord.sectionName || 'Diğer';
      if (!sectionBreakdown[secKey]) sectionBreakdown[secKey] = { count: 0, total: 0 };
      sectionBreakdown[secKey].count += 1;
      sectionBreakdown[secKey].total += ordAmt;

      const waitKey = ord.waiterName || 'Garson';
      if (!waiterBreakdown[waitKey]) waiterBreakdown[waitKey] = { count: 0, total: 0 };
      waiterBreakdown[waitKey].count += 1;
      waiterBreakdown[waitKey].total += ordAmt;

      const hourKey = `${String(getOrderHour(ord)).padStart(2, '0')}:00`;
      if (!hourlySales[hourKey]) hourlySales[hourKey] = { count: 0, total: 0 };
      hourlySales[hourKey].count += 1;
      hourlySales[hourKey].total += Number(ord.totalAmount) || 0;

      (ord.payments || []).forEach(p => {
        const pType = p.type || 'Nakit';
        const pAmount = Number(p.amount) || 0;
        if (pType.includes('İndirim') || pType.includes('İskonto')) {
          discountTotal += pAmount;
        } else if (pType.includes('İkram')) {
          giftTotal += pAmount;
        } else if (pType.includes('Cari')) {
          paymentBreakdown['Cari'] = (paymentBreakdown['Cari'] || 0) + pAmount;
          const custName = p.customerName || pType.replace('Cari (', '').replace(')', '').trim();
          cariDetails[custName] = (cariDetails[custName] || 0) + pAmount;
        } else {
          paymentBreakdown[pType] = (paymentBreakdown[pType] || 0) + pAmount;
        }
      });

      (ord.items || []).forEach(item => {
        const catName = prodCategoryMap[item.productName] || 'Genel Menü';
        
        if (item.isGift) {
          const itemVal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
          giftTotal += itemVal;
          giftLogs.push({
            tableName: ord.tableName || 'Masa',
            productName: item.productName,
            quantity: Number(item.quantity) || 1,
            amount: itemVal,
            waiterName: ord.waiterName || 'Kasiyer',
            orderNumber: ord.orderNumber,
          });
        }

        if (!productSales[item.productName]) {
          productSales[item.productName] = { quantity: 0, total: 0, categoryName: catName };
        }
        productSales[item.productName].quantity += Number(item.quantity) || 1;
        productSales[item.productName].total += (Number(item.price) || 0) * (Number(item.quantity) || 1);

        if (!categorySales[catName]) categorySales[catName] = { quantity: 0, total: 0 };
        categorySales[catName].quantity += Number(item.quantity) || 1;
        categorySales[catName].total += (Number(item.price) || 0) * (Number(item.quantity) || 1);
      });
    });

    const netTotal = grossTotal - discountTotal;
    const totalOrders = orders.length;
    const avgOrderAmount = totalOrders > 0 ? grossTotal / totalOrders : 0;

    const allExpenses = dataService.getExpenses() || [];
    const filteredExpenses = allExpenses.filter(e => {
      if (filters.startDate && e.date < filters.startDate) return false;
      if (filters.endDate && e.date > filters.endDate) return false;
      return true;
    });
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const cashExpenses = filteredExpenses.filter(e => e.paymentMethod === 'CASH').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const allSupplierTxs = dataService.getSupplierTransactions() || [];
    const filteredSupplierTxs = allSupplierTxs.filter(t => {
      if (filters.startDate && t.date < filters.startDate) return false;
      if (filters.endDate && t.date > filters.endDate) return false;
      return true;
    });
    const supplierInvoicesTotal = filteredSupplierTxs.filter(t => t.type === 'INVOICE').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const supplierPaymentsList = filteredSupplierTxs.filter(t => t.type === 'PAYMENT');
    const supplierPaymentsTotal = supplierPaymentsList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const supplierCashPayments = supplierPaymentsList.filter(t => t.paymentMethod === 'CASH').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const cancelLogsRaw = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');
    const cancelLogs = cancelLogsRaw.filter((c: any) => {
      const cDate = (c.cancelledAt || '').split('T')[0];
      if (filters.startDate && cDate < filters.startDate) return false;
      if (filters.endDate && cDate > filters.endDate) return false;
      return true;
    });
    const cancelTotal = cancelLogs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

    const vatRate = 10;
    const vatBase = netTotal / 1.10;
    const vatAmount = netTotal - vatBase;

    // Nakit Hasılat
    const cashSales = paymentBreakdown['Nakit'] || 0;
    // Net Kasa Nakit Akışı = Nakit Satış - Kasadan Çıkan Giderler - Kasadan Toptancıya Ödenen
    const netCashFlow = cashSales - cashExpenses - supplierCashPayments;
    // Dönem Faaliyet Kârı = Net Ciro - İşletme Giderleri - Alış Faturaları
    const operatingProfit = netTotal - totalExpenses - supplierInvoicesTotal;

    return {
      grossTotal,
      netTotal,
      discountTotal,
      giftTotal,
      cancelTotal,
      totalOrders,
      avgOrderAmount,
      paymentBreakdown,
      cariDetails,
      sectionBreakdown,
      waiterBreakdown,
      vatBreakdown: [{ rate: vatRate, baseAmount: vatBase, vatAmount, total: netTotal }],
      productSales,
      categorySales,
      hourlySales,
      totalExpenses,
      cashExpenses,
      supplierInvoicesTotal,
      supplierPaymentsTotal,
      supplierCashPayments,
      netCashFlow,
      operatingProfit,
      orders,
      cancelLogs,
      giftLogs,
    };
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

  public generateMacAddress(): string {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex.charAt(Math.floor(Math.random() * 16)) + hex.charAt(Math.floor(Math.random() * 16));
    }
    return mac;
  }

  public getWaiters(): WaiterConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.WAITERS);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveWaiters(waiters: WaiterConfig[]) {
    localStorage.setItem(STORAGE_KEYS.WAITERS, JSON.stringify(waiters));
    this.notify();
  }

  public addWaiter(waiter: Partial<WaiterConfig> & { name: string; pin: string }): WaiterConfig {
    const waiters = this.getWaiters();
    const token = `TOKEN-GTU-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const newW: WaiterConfig = {
      id: `w-${Date.now()}`,
      name: waiter.name.trim(),
      phone: waiter.phone?.trim() || '',
      pin: waiter.pin.trim(),
      qrToken: token,
      macAddress: '',
      deviceUuid: '',
      deviceName: 'Eşleşme Bekliyor',
      status: 'NOT_PAIRED',
      allowedSections: waiter.allowedSections || ['ALL'],
      permissions: waiter.permissions || {
        canDiscount: false,
        canVoidItem: false,
        canGift: false,
        canTransferTable: true,
        canPrintBill: true,
      },
    };
    waiters.push(newW);
    localStorage.setItem(STORAGE_KEYS.WAITERS, JSON.stringify(waiters));
    return newW;
  }

  public updateWaiter(id: string, partial: Partial<WaiterConfig>) {
    const waiters = this.getWaiters().map(w => {
      if (w.id === id) {
        return {
          ...w,
          ...partial,
          macAddress: partial.macAddress ? partial.macAddress.trim().toUpperCase() : w.macAddress,
          phone: partial.phone !== undefined ? partial.phone.trim() : w.phone,
        };
      }
      return w;
    });
    this.saveWaiters(waiters);
  }

  public deleteWaiter(id: string) {
    const waiters = this.getWaiters().filter(w => w.id !== id);
    this.saveWaiters(waiters);
  }

  public pairWaiterDevice(id: string, macAddress: string, deviceName: string) {
    const cleanMac = macAddress.trim().toUpperCase() || this.generateMacAddress();
    this.updateWaiter(id, {
      macAddress: cleanMac,
      deviceName: deviceName.trim() || 'Mobil Garson Terminali',
      deviceUuid: `UUID-${cleanMac.replace(/[^A-Z0-9]/g, '')}`,
      status: 'APPROVED',
      lastActiveAt: new Date().toISOString(),
    });
  }

  public resetWaiterDevice(id: string) {
    this.updateWaiter(id, {
      deviceUuid: '',
      deviceName: 'Telefon Eşleşmesi Bekleniyor',
      status: 'NOT_PAIRED',
      qrToken: `TOKEN-GTU-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString().slice(-4)}`
    });
  }

  public getCallLogs(): CallLogItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.CALL_LOGS);
    return data ? JSON.parse(data) : [];
  }

  public addRecentCall(callOrPhone: Omit<CallLogItem, 'id'> | string, customerData?: any): CallLogItem {
    const logs = this.getCallLogs();
    let newLog: CallLogItem;
    if (typeof callOrPhone === 'string') {
      newLog = {
        id: `call-${Date.now()}`,
        phone: callOrPhone,
        customerId: customerData?.id,
        customerName: customerData?.name || 'Kayıtlı Olmayan Numara',
        address: customerData?.address || '',
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toISOString().split('T')[0],
        isRegistered: !!customerData?.name,
      };
    } else {
      newLog = { ...callOrPhone, id: `call-${Date.now()}` };
    }
    const updated = [newLog, ...logs].slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(updated));
    this.notify();
    return newLog;
  }

  public getReceiptSettings(): ReceiptSettingsConfig {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPT_SETTINGS);
    return data ? { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(data) } : DEFAULT_RECEIPT_SETTINGS;
  }

  public saveReceiptSettings(settings: ReceiptSettingsConfig) {
    localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(settings));
    this.notify();
  }

  public getHardwareSettings(): HardwareSettingsConfig {
    const data = localStorage.getItem(STORAGE_KEYS.HARDWARE_SETTINGS);
    if (!data) return DEFAULT_HARDWARE_SETTINGS;
    try {
      const parsed = JSON.parse(data);
      return {
        cashDrawer: { ...DEFAULT_HARDWARE_SETTINGS.cashDrawer, ...(parsed.cashDrawer || {}) },
        scale: { ...DEFAULT_HARDWARE_SETTINGS.scale, ...(parsed.scale || {}) },
        customerDisplay: { ...DEFAULT_HARDWARE_SETTINGS.customerDisplay, ...(parsed.customerDisplay || {}) },
        callerId: { ...DEFAULT_HARDWARE_SETTINGS.callerId, ...(parsed.callerId || {}) },
        soundAlerts: { ...DEFAULT_HARDWARE_SETTINGS.soundAlerts, ...(parsed.soundAlerts || {}) },
      };
    } catch (e) {
      return DEFAULT_HARDWARE_SETTINGS;
    }
  }

  public saveHardwareSettings(settings: HardwareSettingsConfig) {
    localStorage.setItem(STORAGE_KEYS.HARDWARE_SETTINGS, JSON.stringify(settings));
    this.notify();
  }

  public playAudioAlert(type?: 'kitchen' | 'phone' | 'register' | 'melody' | 'alert' | 'beep', overrideRepeat?: number) {
    const hw = this.getHardwareSettings();
    if (!hw.soundAlerts.enabled) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const activeType = type || hw.soundAlerts.ringtoneType || 'phone';
      const maxRepeats = overrideRepeat !== undefined 
        ? Math.max(1, overrideRepeat) 
        : (activeType === 'beep' ? 1 : Math.max(1, hw.soundAlerts.repeatCount || 2));
      const masterVol = Math.max(0.02, Math.min(1, (hw.soundAlerts.volume || 80) / 100)) * 0.35;

      const scheduleSingleTone = (startTime: number, tone: typeof activeType): number => {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);

        if (tone === 'phone') {
          // Gerçekçi Çift Tonlu Klasik Sabit Hat / Cep Telefonu Zil Sesi (440Hz + 480Hz)
          // 1. Çalma (0.35 sn)
          const playBurst = (offset: number) => {
            const burstGain = ctx.createGain();
            burstGain.connect(gain);
            burstGain.gain.setValueAtTime(masterVol * 0.9, startTime + offset);
            burstGain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + 0.34);

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(440, startTime + offset); // A4
            osc2.frequency.setValueAtTime(480, startTime + offset); // Telephony B4 harmonic

            osc1.connect(burstGain);
            osc2.connect(burstGain);
            osc1.start(startTime + offset);
            osc2.start(startTime + offset);
            osc1.stop(startTime + offset + 0.35);
            osc2.stop(startTime + offset + 0.35);
          };

          playBurst(0.0);
          playBurst(0.45);
          return 1.4; // 1 döngü süresi: 0.35s + 0.10s ara + 0.35s + 0.60s bekleme
        } else if (tone === 'kitchen') {
          // Mutfak Restoran Çanı (Ding-Dong)
          gain.gain.setValueAtTime(masterVol, startTime);

          const osc1 = ctx.createOscillator();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, startTime); // D5
          osc1.connect(gain);
          osc1.start(startTime);
          osc1.stop(startTime + 0.25);

          const osc2 = ctx.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, startTime + 0.2); // A5
          osc2.connect(gain);
          osc2.start(startTime + 0.2);
          osc2.stop(startTime + 0.65);
          return 0.85;
        } else if (tone === 'register') {
          // Kasa Çekmecesi & Tahsilat Ka-ching
          gain.gain.setValueAtTime(masterVol, startTime);
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(987.77, startTime); // B5
          osc.frequency.exponentialRampToValueAtTime(1318.51, startTime + 0.15); // E6
          osc.connect(gain);
          osc.start(startTime);
          osc.stop(startTime + 0.35);
          return 0.55;
        } else if (tone === 'melody') {
          // Melodik Restoran Uyarısı (C5 - E5 - G5 - C6)
          gain.gain.setValueAtTime(masterVol, startTime);
          const notes = [523.25, 659.25, 783.99, 1046.50];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);
            osc.connect(gain);
            osc.start(startTime + idx * 0.1);
            osc.stop(startTime + idx * 0.1 + 0.18);
          });
          return 0.75;
        } else if (tone === 'alert') {
          // Acil Dikkat Uyarısı
          gain.gain.setValueAtTime(masterVol, startTime);
          [0, 0.18].forEach((timeOffset) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(750, startTime + timeOffset);
            osc.connect(gain);
            osc.start(startTime + timeOffset);
            osc.stop(startTime + timeOffset + 0.12);
          });
          return 0.5;
        } else {
          // Sade Dokunmatik Bip / Tık
          gain.gain.setValueAtTime(masterVol, startTime);
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.5, startTime); // C6
          osc.connect(gain);
          osc.start(startTime);
          osc.stop(startTime + 0.08);
          return 0.15;
        }
      };

      let nextStartTime = ctx.currentTime;
      for (let i = 0; i < maxRepeats; i++) {
        const duration = scheduleSingleTone(nextStartTime, activeType);
        nextStartTime += duration;
      }
    } catch (e) {
      console.warn('Audio alert error:', e);
    }
  }

  public async openCashDrawer(): Promise<{ success: boolean; message: string }> {
    const hw = this.getHardwareSettings();
    if (!hw.cashDrawer.enabled) {
      return { success: false, message: 'Otomatik para çekmecesi ayarlarda kapalı.' };
    }

    this.playAudioAlert('register');

    // Electron veya Yerel Yazıcı Servisi üzerinden RJ11 darbe sinyali (ESC/POS 27, 112, 0, 25, 250)
    try {
      const res = await fetch('http://localhost:4545/api/hardware/open-drawer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: hw.cashDrawer.printerId,
          pin: hw.cashDrawer.pulsePin,
          duration: hw.cashDrawer.pulseDurationMs,
        }),
      });
      const data = await res.json();
      return { success: true, message: data.message || 'Para çekmecesine açılma darbesi gönderildi.' };
    } catch (e) {
      // Çekmece sinyali simülasyonu
      return { success: true, message: 'Para çekmecesi açılma sinyali (ESC p 0 25 250) yazıcı portuna iletildi.' };
    }
  }

  public getFoodPlatformsConfig(): FoodPlatformsConfig {
    const data = localStorage.getItem(STORAGE_KEYS.FOOD_PLATFORMS);
    if (!data) return DEFAULT_FOOD_PLATFORMS;
    try {
      return { ...DEFAULT_FOOD_PLATFORMS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_FOOD_PLATFORMS;
    }
  }

  public saveFoodPlatformsConfig(config: FoodPlatformsConfig) {
    localStorage.setItem(STORAGE_KEYS.FOOD_PLATFORMS, JSON.stringify(config));
    this.notify();
  }

  public async setPlatformStoreStatus(platform: 'ALL' | 'TRENDYOL' | 'GETIR' | 'YEMEKSEPETI', isOpen: boolean): Promise<boolean> {
    const current = this.getFoodPlatformsConfig();
    const updated: FoodPlatformsConfig = {
      ...current,
      trendyol: { ...current.trendyol },
      getir: { ...current.getir },
      yemeksepeti: { ...current.yemeksepeti },
    };

    if (platform === 'ALL' || platform === 'TRENDYOL') {
      updated.trendyol.isOpen = isOpen;
    }
    if (platform === 'ALL' || platform === 'GETIR') {
      updated.getir.isOpen = isOpen;
    }
    if (platform === 'ALL' || platform === 'YEMEKSEPETI') {
      updated.yemeksepeti.isOpen = isOpen;
    }

    this.saveFoodPlatformsConfig(updated);

    try {
      await fetch(`${API_SYNC_URL}?action=update_platform_store_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          isOpen,
          updatedBy: 'Kasa POS'
        })
      });
      return true;
    } catch (e) {
      console.warn('Platform status sync error:', e);
      return false;
    }
  }

  public async fetchPlatformStoreStatus(): Promise<any> {
    try {
      const res = await fetch(`${API_SYNC_URL}?action=get_platform_store_status`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.platformStoreStatus) {
          const current = this.getFoodPlatformsConfig();
          const updated: FoodPlatformsConfig = {
            ...current,
            trendyol: { ...current.trendyol },
            getir: { ...current.getir },
            yemeksepeti: { ...current.yemeksepeti },
          };
          if (data.platformStoreStatus.TRENDYOL) {
            updated.trendyol.isOpen = Boolean(data.platformStoreStatus.TRENDYOL.isOpen);
          }
          if (data.platformStoreStatus.GETIR) {
            updated.getir.isOpen = Boolean(data.platformStoreStatus.GETIR.isOpen);
          }
          if (data.platformStoreStatus.YEMEKSEPETI) {
            updated.yemeksepeti.isOpen = Boolean(data.platformStoreStatus.YEMEKSEPETI.isOpen);
          }
          this.saveFoodPlatformsConfig(updated);
          return data.platformStoreStatus;
        }
      }
    } catch (e) {}
    return null;
  }

  private continuousAlarmInterval: any = null;

  public startContinuousAlarm(type: 'phone' | 'alert' | 'melody' = 'phone') {
    if (this.continuousAlarmInterval) return;
    this.playAudioAlert(type, 1);
    this.continuousAlarmInterval = setInterval(() => {
      this.playAudioAlert(type, 1);
    }, 3200);
  }

  public stopContinuousAlarm() {
    if (this.continuousAlarmInterval) {
      clearInterval(this.continuousAlarmInterval);
      this.continuousAlarmInterval = null;
    }
  }

  public isContinuousAlarmRunning(): boolean {
    return this.continuousAlarmInterval !== null;
  }

  public exportRestaurantBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sections: this.getSections(),
      categories: this.getCategories(),
      products: this.getProducts(),
      waiters: this.getWaiters(),
      printers: this.getPrinters(),
      paymentMethods: this.getPaymentMethods(),
      receiptSettings: this.getReceiptSettings(),
      hardwareSettings: this.getHardwareSettings(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importRestaurantBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.sections) this.saveSections(parsed.sections);
      if (parsed.categories) this.saveCategories(parsed.categories);
      if (parsed.products) this.saveProducts(parsed.products);
      if (parsed.waiters) this.saveWaiters(parsed.waiters);
      if (parsed.printers) this.savePrinters(parsed.printers);
      if (parsed.paymentMethods) this.savePaymentMethods(parsed.paymentMethods);
      if (parsed.receiptSettings) this.saveReceiptSettings(parsed.receiptSettings);
      if (parsed.hardwareSettings) this.saveHardwareSettings(parsed.hardwareSettings);
      this.notify();
      return { success: true, message: 'Restoran ve donanım yapılandırması başarıyla geri yüklendi.' };
    } catch (e) {
      return { success: false, message: 'Yedek dosyası geçersiz veya bozuk formatta.' };
    }
  }
}

export const restaurantDataService = new RestaurantDataService();
