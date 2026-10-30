// Gaziantepli Taha Usta - Restoran Veri Servisi (Gider, Toptancı & Net Kasa Destekli Z Raporu)
import { mergeById, safeParseArray } from './syncMerge';
import { getBusinessDate, formatLocalDate } from '../utils/businessDate';
import { ProcessedIdStore, normalizeIncomingId } from './incomingOrderDedup';
import { dataService } from './dataService';
import { realtimeSyncService } from './realtimeSyncService';
import { sortTablesNaturally } from '../utils/tableSorting';

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
  directions?: string;
  balance?: number;
  notes?: string;
}

export interface TableState {
  id: string;
  name: string;
  sectionId: string;
  sectionName?: string;
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
  imageUrl?: string;
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
  cancelledOrders?: CompletedOrderArchive[];
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
  status?: 'PAID' | 'CANCELLED';
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
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
  imageUrl?: string;
  description?: string;
}

/** Hazır/stok yemek fotoğrafı YOKTUR: ürün görselini işletme kendisi yükler. */
export const FOOD_IMAGE_PRESETS: Array<{ name: string; url: string }> = [];

/** Görsel yoksa ağ gerektirmeyen, nötr bir yer tutucu (tabak simgesi). Demo fotoğraf kullanılmaz. */
export function getProductFallbackImage(_name: string = '', _categoryId: string = ''): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>" +
    "<rect width='400' height='300' fill='#24242A'/>" +
    "<circle cx='200' cy='150' r='62' fill='none' stroke='#4A4A56' stroke-width='6'/>" +
    "<circle cx='200' cy='150' r='36' fill='none' stroke='#4A4A56' stroke-width='4'/>" +
    "</svg>";
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export interface WaiterConfig {
  id: string;
  name: string;
  phone?: string;
  pin: string;
  qrToken: string;
  pairingCode?: string;
  deviceUuid?: string;
  deviceName: string;
  macAddress?: string;
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
  pairedAt?: string;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'NETWORK' | 'USB' | 'SERIAL' | 'SYSTEM_DRIVER';
  ipAddress?: string;
  port?: number;
  usbName?: string;
  driverName?: string;
  serialPort?: string;
  baudRate?: number;
  role: string;
  paperWidth: number;
  autoCut: boolean;
  cutType?: 'FULL' | 'PARTIAL';
  beepOnPrint: boolean;
  codePage?: 'CP857' | 'UTF8' | 'WIN1254' | 'PC857';
  copies?: number;
  isBillPrinter: boolean;
  isKitchen: boolean;
  isDeliveryPrinter?: boolean;
  printAllKitchen?: boolean;
  assignedCategoryIds?: string[];
  assignedStations?: ('OCAK' | 'FIRIN' | 'BAR' | 'MUTFAK')[];
  failoverPrinterId?: string;
  isActive?: boolean;
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
    enabled: false,
    isOpen: true,
    supplierId: '',
    apiKey: '',
    secretKey: '',
    email: '',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  getir: {
    enabled: false,
    isOpen: true,
    restaurantName: 'Gaziantepli Taha Usta',
    secretKey: '',
    restaurantId: '',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  yemeksepeti: {
    enabled: false,
    isOpen: true,
    username: '',
    password: '',
    restaurantId: '',
    autoPrintReceipt: true,
    preparationTimeMinutes: 25,
    deliveryModel: 'RESTAURANT',
  },
  continuousAlarmUntilAction: true,
  autoAcceptOrders: false,
};

// Burada varsayılan bir sunucu adresi YAZILMAZ. Önceki varsayılan yazılımcının kendi
// alan adıydı; bu, işletmenin tüm verisinin (müşteri, personel maaş/IBAN, kasa, Z
// raporu) sahibinin haberi olmadan başka bir sunucuya akması demekti. Ayrıca kasa o
// sunucuya, garson uygulaması ise kendi hosting'ine bağlandığı için masalar hiçbir
// zaman örtüşmüyordu. Adres ayarlanmadıysa senkronizasyon yapılmaz.
export const getApiSyncUrl = (): string => {
  try {
    const custom = localStorage.getItem('CUSTOM_API_SYNC_URL');
    if (custom && custom.trim().length > 0) return custom.trim();
  } catch (e) {}
  return '';
};

export const isApiSyncConfigured = (): boolean => getApiSyncUrl().length > 0;

export const setApiSyncUrl = (url: string): void => {
  try {
    if (!url || url.trim().length === 0) {
      localStorage.removeItem('CUSTOM_API_SYNC_URL');
    } else {
      localStorage.setItem('CUSTOM_API_SYNC_URL', url.trim());
    }
  } catch (e) {}
};

/**
 * QR Kodların ve Garson Bağlantılarının Üretileceği Genel Ağ / Alan Adı URL'si
 * Eğer kullanıcı localhost üzerindeyse ve özel domain girmemişse bile
 * telefonların erişebileceği canlı sunucuyu varsayılan olarak döndürür.
 */
export const getPublicBaseUrl = (): string => {
  try {
    const custom = localStorage.getItem('CUSTOM_PUBLIC_BASE_URL');
    if (custom && custom.trim().length > 0) {
      let u = custom.trim();
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = 'https://' + u;
      }
      return u.replace(/\/+$/, '');
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Eğer tarayıcı localhost veya 127.0.0.1 DEĞİLSE, mevcut canlı sunucunun origin'ini kullan
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return window.location.origin.replace(/\/+$/, '');
    }
  }

  // Sabit bir alan adına düşülmez: önceki değer yazılımcının kendi adresiydi ve
  // kasanın ürettiği QR kodlar garsonu başka birinin sunucusuna yönlendiriyordu.
  // Adres girilmediyse boş döner; QR üretimi bunu kullanıcıya bildirir.
  return '';
};

export const setPublicBaseUrl = (url: string): void => {
  try {
    if (!url || url.trim().length === 0) {
      localStorage.removeItem('CUSTOM_PUBLIC_BASE_URL');
    } else {
      let clean = url.trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      localStorage.setItem('CUSTOM_PUBLIC_BASE_URL', clean.replace(/\/+$/, ''));
    }
  } catch (e) {}
};

const DEFAULT_PRINTERS: PrinterConfig[] = [];

// Hazır (demo) kategori, ürün veya salon YOKTUR: işletme kendi menüsünü ve masa düzenini oluşturur.
const DEFAULT_CATEGORIES: CategoryConfig[] = [];
const DEFAULT_PRODUCTS: ProductConfig[] = [];
const DEFAULT_SECTIONS: SectionConfig[] = [];

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

/** Para tutarlarını kuruşa yuvarlar (float birikimini engeller). */
const round2 = (n: number): number => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

class RestaurantDataService {
  private listeners: Set<ChangeListener> = new Set();
  private pendingActivePosTableId: string | null = null;
  private kitchenPrintCallback?: (table: TableState, items: OrderItemState[], waiterName: string, orderNote?: string, isAdditionalOrder?: boolean) => void;
  private billPrintCallback?: (table: TableState, items: OrderItemState[]) => void;
  private isProcessingRemoteSync = false;
  private processedIncomingOrderIds = new ProcessedIdStore(localStorage);
  /** Tam yedek servisi tarafından atanır (döngüsel içe aktarmayı önler). */
  public autoBackupHook?: (label: string) => Promise<unknown>;

  public onKitchenOrderPrint(cb: (table: TableState, items: OrderItemState[], waiterName: string, orderNote?: string, isAdditionalOrder?: boolean) => void) {
    this.kitchenPrintCallback = cb;
  }

  public onBillRequestPrint(cb: (table: TableState, items: OrderItemState[]) => void) {
    this.billPrintCallback = cb;
  }

  constructor() {
    this.initRealtimeSyncListener();
    setTimeout(() => this.pushStateToCloud(), 1000);
    setInterval(() => this.pullPendingOrdersFromCloud(), 1500);
  }

  private initRealtimeSyncListener() {
    realtimeSyncService.subscribe((event) => {
      if (this.isProcessingRemoteSync) return;

      if (event.type === 'TABLES_UPDATED') {
        if (event.payload?.tables && Array.isArray(event.payload.tables)) {
          this.isProcessingRemoteSync = true;
          localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(event.payload.tables));
          this.listeners.forEach((l) => l());
          this.isProcessingRemoteSync = false;
        }
      } else if (event.type === 'ORDER_SUBMITTED') {
        if (event.payload) {
          this.processIncomingOrder(event.payload);
        }
      } else if (event.type === 'BILL_REQUESTED') {
        if (event.payload?.tableId) {
          this.setBillRequested(event.payload.tableId);
          const tbl = this.getTables().find(t => t.id === event.payload.tableId);
          if (tbl && tbl.order?.items && tbl.order.items.length > 0 && this.billPrintCallback) {
            this.billPrintCallback(tbl, tbl.order.items);
          }
        }
      } else if (event.type === 'TABLE_TRANSFERRED') {
        if (event.payload?.sourceTableId && event.payload?.targetTableId) {
          this.transferTable(event.payload.sourceTableId, event.payload.targetTableId);
        }
      } else if (event.type === 'WAITER_PAIRED' || event.type === 'WAITER_RESET') {
        this.listeners.forEach((l) => l());
      }
    });
  }

  public subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
    this.pushStateToCloud();
    if (!this.isProcessingRemoteSync) {
      realtimeSyncService.broadcastTablesUpdated(this.getTables(), 'KASA');
    }
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
    if (!data) return [];
    try {
      const calls: CallLogItem[] = JSON.parse(data);
      return calls.filter(c => 
        !c.phone?.includes('0532 999 88 77') && 
        !c.phone?.includes('05329998877') && 
        !c.phone?.includes('05325554141') && 
        !c.customerName?.includes('Müdavim Müşteri')
      );
    } catch {
      return [];
    }
  }

  public clearCallLogs(): void {
    localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify([]));
    this.notify();
  }

  public saveRecentCalls(calls: CallLogItem[]) {
    localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(calls));
    this.notify();
  }

  public addCallLog(phone: string, customerInfo?: { id?: string; name?: string; address?: string }): CallLogItem {
    const calls = this.getRecentCalls();
    const isReg = Boolean(customerInfo?.id);
    const newCall: CallLogItem = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

  private pushDebounceTimer: any = null;

  public async pushStateToCloud(): Promise<boolean> {
    if (!isApiSyncConfigured()) return false;
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }
    return new Promise((resolve) => {
      this.pushDebounceTimer = setTimeout(async () => {
        try {
        const printers = this.getPrinters();
        const categories = this.getCategories();
        const products = this.getProducts().map(p => {
          const cat = categories.find(c => c.id === p.categoryId);
          const printerId = p.printerId || cat?.printerId;
          const printer = printers.find(pr => pr.id === printerId);
          return {
            ...p,
            description: p.description || '',
            imageUrl: p.imageUrl || '',
            printer: printer ? printer.name : 'Kasa Yazıcısı'
          };
        });

        const res = await fetch(`${getApiSyncUrl()}?action=push_kasa_state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sections: this.getSections(),
            tables: this.getTables(),
            products,
            categories,
            employees: this.getWaiters(),
            customers: dataService.getCustomers(),
            customerTransactions: dataService.getCustomerTransactions(),
            suppliers: dataService.getSuppliers(),
            supplierTransactions: dataService.getSupplierTransactions(),
            expenses: dataService.getExpenses(),
            employeePayments: dataService.getEmployeePayments(),
            zReports: this.getZReportsHistory(),
            completedOrders: this.getAllCompletedOrders(),
            printers: this.getPrinters(),
            companySettings: dataService.getCompanySettings(),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          console.log('📡 [Canlı Veritabanı]', json.mode === 'MYSQL' ? 'MySQL Veritabanına Anında İşlendi' : 'JSON Depolandı', json);
          resolve(Boolean(json.success));
        } else {
          resolve(false);
        }
        } catch (e) {
          console.warn('Veritabanı anlık senkronizasyon hatası:', e);
          resolve(false);
        }
      }, 200);
    });
  }

  public saveTables(tables: TableState[]) {
    const sections = this.getSections();
    const sorted = sortTablesNaturally(tables, sections);
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(sorted));
    this.notify();
  }

  /**
   * Sunucudaki MySQL / phpMyAdmin veritabanındaki tüm ERP verilerini çeker ve eşitler
   */
  public async pullAllErpDataFromCloud(): Promise<boolean> {
    if (!isApiSyncConfigured()) return false;
    try {
      const res = await fetch(`${getApiSyncUrl()}?action=get_all_erp_data`);
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.success) {
        // Güvenlik: uygulama öncesi yerel verinin anlık kopyası (dosya yedeği, mümkünse)
        try { await this.autoBackupHook?.('bulut-cekme-oncesi'); } catch {}

        const rawLocal = (key: string) => safeParseArray(localStorage.getItem(key));
        const localEmpty = (key: string) => rawLocal(key).length === 0;

        // ANA VERİ: yalnızca yerel liste BOŞSA bulutan alınır (kasa asıl kaynaktır).
        if (data.sections?.length > 0 && localEmpty(STORAGE_KEYS.SECTIONS)) {
          localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(data.sections));
        }
        if (data.categories?.length > 0 && localEmpty(STORAGE_KEYS.CATEGORIES)) this.saveCategories(data.categories);
        if (data.products?.length > 0 && localEmpty(STORAGE_KEYS.PRODUCTS)) this.saveProducts(data.products);
        if (data.employees?.length > 0 && localEmpty(STORAGE_KEYS.WAITERS)) this.saveWaiters(data.employees);
        if (data.printers?.length > 0 && localEmpty(STORAGE_KEYS.PRINTERS)) this.savePrinters(data.printers);

        // MASALAR (açık adisyonlar dahil): yerelde hiç masa yoksa bulutan alınır; aksi halde yerel korunur.
        if (localEmpty(STORAGE_KEYS.TABLES)) {
          if (data.tables?.length > 0) {
            const sections = (data.sections?.length > 0) ? data.sections : this.getSections();
            localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(sortTablesNaturally(data.tables, sections)));
          } else if (data.sections?.length > 0) {
            this.syncTablesWithSections(data.sections);
          }
        }

        // GEÇMİŞ KAYITLAR: ID bazlı BİRLEŞİM — yerel hiçbir kayıt kaybolmaz.
        if (data.zReports?.length > 0) {
          localStorage.setItem(STORAGE_KEYS.Z_REPORTS, JSON.stringify(mergeById(rawLocal(STORAGE_KEYS.Z_REPORTS), data.zReports)));
        }
        if (data.completedOrders?.length > 0) {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(mergeById(rawLocal(STORAGE_KEYS.COMPLETED_ORDERS), data.completedOrders)));
        }

        // Cari ve Finans modülleri
        if (data.customers?.length > 0 && localEmpty('gtu_erp_customers')) dataService.saveCustomers(data.customers);
        if (data.customerTransactions?.length > 0) {
          localStorage.setItem('gtu_erp_customer_transactions', JSON.stringify(mergeById(rawLocal('gtu_erp_customer_transactions'), data.customerTransactions)));
        }
        if (data.suppliers?.length > 0 && localEmpty('gtu_erp_suppliers')) dataService.saveSuppliers(data.suppliers);
        if (data.supplierTransactions?.length > 0) {
          localStorage.setItem('gtu_erp_supplier_transactions', JSON.stringify(mergeById(rawLocal('gtu_erp_supplier_transactions'), data.supplierTransactions)));
        }
        if (data.expenses?.length > 0) {
          dataService.saveExpensesList(mergeById(rawLocal('gtu_erp_expenses'), data.expenses) as any);
        }
        if (data.companySettings && !localStorage.getItem('gtu_erp_company_settings')) dataService.saveCompanySettings(data.companySettings);

        this.notify();
        console.log('✅ [Merkezi MySQL] Tüm veriler phpMyAdmin veritabanından çekildi ve eşitlendi.');
        return true;
      }
    } catch (e) {
      console.warn('Veritabanından tam ERP verisi çekilemedi:', e);
    }
    return false;
  }

  /**
   * phpMyAdmin / MySQL tablosundan anında silme
   */
  public async deleteItemFromCloud(table: string, id: string): Promise<{ success: boolean; message?: string }> {
    if (!isApiSyncConfigured()) return { success: false, message: 'Senkronizasyon sunucusu ayarlanmadı.' };
    try {
      const res = await fetch(`${getApiSyncUrl()}?action=delete_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Buluttan silme hatası:', e);
    }
    return { success: true };
  }

  public async pullPendingOrdersFromCloud() {
    if (!isApiSyncConfigured()) return;
    try {
      // 1. Eşleşen Telefonları Canlı Senkronize Et
      try {
        const devRes = await fetch(`${getApiSyncUrl()}?action=get_paired_devices`);
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
      const res = await fetch(`${getApiSyncUrl()}?action=pull_pending_orders`);
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        const handledIds: string[] = [];
        data.orders.forEach((ord: any) => {
          let handled = false;
          try {
            const dedupId = normalizeIncomingId(ord);
            if (ord.type !== 'ORDER' && ord.type !== undefined && this.processedIncomingOrderIds.has(dedupId)) {
              handled = true; // daha önce işlendi, yalnızca onayı tekrarla
            } else if (ord.type === 'BILL_REQUEST') {
              this.setBillRequested(ord.tableId);
              const tbl = this.getTables().find(t => t.id === ord.tableId);
              if (tbl && tbl.order?.items && tbl.order.items.length > 0 && this.billPrintCallback) {
                this.billPrintCallback(tbl, tbl.order.items);
              }
              this.processedIncomingOrderIds.add(dedupId);
              handled = true;
            } else if (ord.type === 'TRANSFER_TABLE') {
              this.transferTable(ord.sourceTableId, ord.targetTableId);
              this.processedIncomingOrderIds.add(dedupId);
              handled = true;
            } else {
              handled = this.processIncomingOrder(ord);
            }
          } catch (err) {
            console.error('Gelen sipariş işlenemedi, onaylanmayacak (tekrar denenecek):', err);
          }
          if (handled && ord.id) handledIds.push(String(ord.id));
        });
        // Yalnızca kalıcı olarak işlenen siparişler bulutta onaylanır; aksi halde sonraki turda tekrar gelir.
        if (handledIds.length > 0) {
          try {
            await fetch(`${getApiSyncUrl()}?action=ack_orders`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: handledIds }),
            });
          } catch (ackErr) {
            // Onay gitmezse sipariş tekrar gelir; kalıcı tekrar engelleme çift işlemeyi önler.
          }
        }
      }
    } catch (e) {}
  }

  /** @returns true: sipariş kalıcı işlendi (ya da daha önce işlenmişti) ve onaylanabilir; false: işlenemedi. */
  public processIncomingOrder(incoming: any): boolean {
    if (!incoming || !incoming.tableId) return false;

    const orderDedupId = normalizeIncomingId(incoming);
    if (this.processedIncomingOrderIds.has(orderDedupId)) {
      return true;
    }

    const tables = this.getTables();
    const table = tables.find(t => t.id === incoming.tableId);
    if (!table) return false;

    const existingItems = table.order?.items || [];
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const newItems: OrderItemState[] = (incoming.items || []).map((i: any) => ({
      ...i,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      addedBy: incoming.waiterName || 'Garson',
      addedAt: currentTime,
      status: 'SENT_TO_KITCHEN'
    }));

    const mergedItems = [...existingItems, ...newItems];
    this.updateTableOrder(table.id, mergedItems, incoming.waiterName, table.customerInfo, incoming.orderNote);
    // Adisyon yazıldıktan HEMEN sonra kalıcı olarak işaretle (yeniden başlatmada çift ekleme olmaz).
    this.processedIncomingOrderIds.add(orderDedupId);

    // Garsonun mobilden girdiği yeni sipariş kalemlerini anında mutfak yazıcılarına bas
    if (newItems.length > 0 && this.kitchenPrintCallback) {
      const currentTable = this.getTables().find(t => t.id === incoming.tableId) || table;
      const isAdditionalOrder = existingItems.length > 0;
      this.kitchenPrintCallback(currentTable, newItems, incoming.waiterName || 'Garson', incoming.orderNote, isAdditionalOrder);
    }
    return true;
  }

  public getSections(): SectionConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.SECTIONS);
    return data ? JSON.parse(data) : DEFAULT_SECTIONS;
  }

  public saveSections(sections: SectionConfig[]) {
    localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(sections));
    const updatedTables = this.syncTablesWithSections(sections);
    this.notify();
    try {
      realtimeSyncService.broadcastTablesUpdated(updatedTables, 'KASA');
    } catch {}
    this.pushStateToCloud();
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
    this.deleteItemFromCloud('bolumler', id);
  }

  public getTables(): TableState[] {
    const data = localStorage.getItem(STORAGE_KEYS.TABLES);
    const sections = this.getSections();
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return sortTablesNaturally(parsed, sections);
      } catch {}
    }
    return this.syncTablesWithSections(sections);
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
            sectionName: sec.name,
            name: `${sec.name} ${i}`,
            capacity: sec.capacityPerTable || sec.capacity || 4,
          });
        } else {
          updatedTables.push({
            id: tableId,
            name: `${sec.name} ${i}`,
            sectionId: sec.id,
            sectionName: sec.name,
            capacity: sec.capacityPerTable || sec.capacity || 4,
            status: 'EMPTY',
          });
        }
      }
    });

    const sorted = sortTablesNaturally(updatedTables, sections);
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(sorted));
    return sorted;
  }

  /**
   * Masa taşıma / birleştirme.
   * - Hedef BOŞSA: adisyon hedefe taşınır.
   * - Hedef DOLUYSA: kalemler hedef adisyona EKLENİR (birleştirme); hedefteki hiçbir kalem kaybolmaz.
   * Kaynak masa her durumda boşaltılır. Hedef/kaynak geçersizse hiçbir şey değişmez.
   */
  public transferTable(sourceTableId: string, targetTableId: string): boolean {
    const tables = this.getTables();
    const srcIndex = tables.findIndex(t => t.id === sourceTableId);
    const tgtIndex = tables.findIndex(t => t.id === targetTableId);

    if (srcIndex === -1 || tgtIndex === -1 || srcIndex === tgtIndex || !tables[srcIndex].order) return false;

    const src = tables[srcIndex];
    const tgt = tables[tgtIndex];
    const srcItems = [...(src.order!.items || [])];

    if (tgt.order && (tgt.order.items?.length || 0) > 0) {
      const merged = [...tgt.order.items, ...srcItems];
      const total = merged.reduce((sum, it) => sum + (it.isGift ? 0 : (Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
      tgt.order = { ...tgt.order, items: merged, totalAmount: total };
      if (!tgt.customerInfo && src.customerInfo) tgt.customerInfo = src.customerInfo;
      if (tgt.status === 'EMPTY') tgt.status = 'OCCUPIED';
    } else {
      tgt.status = src.status === 'EMPTY' ? 'OCCUPIED' : src.status;
      tgt.order = { ...src.order!, items: srcItems };
      tgt.customerInfo = src.customerInfo;
    }

    src.status = 'EMPTY';
    src.order = undefined;
    src.customerInfo = undefined;

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
          id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderNumber: this.nextOrderNumber(),
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
        orderNumber: existingOrder?.orderNumber || this.nextOrderNumber(),
        totalAmount,
        orderTime: existingOrder?.orderTime || currentTime,
        waiterName: existingOrder?.waiterName || waiterName,
        orderNote: orderNote || existingOrder?.orderNote,
        customerInfo: customerInfo || tables[tableIndex].customerInfo,
        items: items.map(i => ({
          ...i,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          targetPrinter: i.targetPrinter || '',
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
      id: `cancel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

  public cancelTableOrder(tableId: string, reason: string, cancelledBy: string = 'Kasiyer') {
    const tables = this.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    if (table.order && table.order.items && table.order.items.length > 0) {
      const now = new Date();
      const todayDate = formatLocalDate(now);
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const orderAmount = Number(table.order.totalAmount) || table.order.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
      const section = this.getSections().find(s => s.id === table.sectionId);

      const completedOrders: CompletedOrderArchive[] = this.getAllCompletedOrders();
      completedOrders.push({
        id: `arch-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: table.order.orderNumber || this.nextOrderNumber(),
        tableName: table.name,
        sectionName: section?.name || table.sectionId,
        waiterName: table.order.waiterName || cancelledBy,
        orderTime: table.order.orderTime || timeStr,
        closedTime: `${todayDate} ${timeStr}`,
        date: todayDate,
        totalAmount: orderAmount,
        items: table.order.items,
        payments: [],
        status: 'CANCELLED',
        cancelReason: reason || 'Masa İptali',
        cancelledBy: cancelledBy,
        cancelledAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(completedOrders));

      // Detaylı ürün iptal kayıtlarına da ekle
      const cancelLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');
      table.order.items.forEach(item => {
        cancelLogs.push({
          id: `cancel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tableName: table.name,
          productName: item.productName,
          quantity: item.quantity,
          amount: (Number(item.price) || 0) * (Number(item.quantity) || 1),
          reason: reason || 'Adisyon İptali',
          cancelledAt: new Date().toISOString(),
          cancelledBy: cancelledBy,
          orderNumber: table.order?.orderNumber
        });
      });
      localStorage.setItem(STORAGE_KEYS.CANCEL_LOGS, JSON.stringify(cancelLogs));
    }

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
  }

  /**
   * Günlük artan adisyon numarası (iş günü başına 1'den başlar, çakışmaz).
   * Eskiden 100–999 arası rastgele sayıydı; aynı gün içinde tekrar edebiliyordu.
   */
  public nextOrderNumber(): number {
    const today = getBusinessDate();
    let state: { date: string; n: number } = { date: today, n: 0 };
    try {
      const raw = JSON.parse(localStorage.getItem('gtu_order_counter') || 'null');
      if (raw && raw.date === today && Number.isFinite(raw.n)) state = raw;
    } catch {}
    state.n += 1;
    localStorage.setItem('gtu_order_counter', JSON.stringify(state));
    return state.n;
  }

  /**
   * Adisyonu kapatır. Ödemeler adisyon tutarını TAM karşılamıyorsa kapatmaz.
   * Aynı masa için ikinci çağrı (çift tıklama) hiçbir şey yapmaz ve başarısız döner.
   */
  public completeTablePayment(tableId: string, method: string, payments: PaymentRecord[] = []): { success: boolean; error?: string } {
    const tables = this.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.order) return { success: false, error: 'Masada kapatılacak açık adisyon yok (zaten kapatılmış olabilir).' };

    const expectedTotal = (table.order.items || []).reduce(
      (sum, it) => sum + (it.isGift ? 0 : (Number(it.price) || 0) * (Number(it.quantity) || 1)),
      0
    );
    if (payments.length > 0) {
      const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (Math.abs(paid - expectedTotal) > 0.01) {
        return { success: false, error: `Ödemeler toplamı (${paid.toFixed(2)} ₺) adisyon tutarına (${expectedTotal.toFixed(2)} ₺) eşit değil.` };
      }
    }

    const now = new Date();
    const todayDate = formatLocalDate(now);
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const completedOrders: CompletedOrderArchive[] = this.getAllCompletedOrders();
    completedOrders.push({
      id: `arch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderNumber: table.order.orderNumber,
      tableName: table.name,
      sectionName: table.sectionId,
      waiterName: table.order.waiterName,
      orderTime: table.order.orderTime || timeStr,
      closedTime: `${todayDate} ${timeStr}`,
      date: todayDate,
      totalAmount: expectedTotal,
      items: table.order.items,
      payments: payments.length > 0 ? payments : [{ id: `p-${Date.now()}`, type: method, amount: expectedTotal, time: timeStr }],
    });
    localStorage.setItem(STORAGE_KEYS.COMPLETED_ORDERS, JSON.stringify(completedOrders));

    table.status = 'EMPTY';
    table.order = undefined;
    table.customerInfo = undefined;

    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    this.notify();
    return { success: true };
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

  // =========================================================================
  // GİDERLER & TOPTANCILARI İÇEREN KAPSAMLI X VE Z RAPORU MOTORU
  // =========================================================================
  public getCurrentXReport() {
    const orders = this.getCompletedOrdersCurrentSession();
    // Z ile kapatılmış iptal kayıtları arşivde kalır; X raporu yalnızca açık olanları sayar.
    const allCancelLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');
    const cancelLogs = allCancelLogs.filter((c: any) => !c.zReportId);

    // Bugünün (iş günü) Tarihi
    const todayStr = getBusinessDate();

    // Daha önce bir Z raporuna girmiş gider/toptancı hareketleri (aynı gün ikinci Z'de çift sayılmasın)
    const reported = this.getZReportedIds();

    // İŞLETME GİDERLERİ: bugüne kadar girilmiş ve henüz hiçbir Z'de raporlanmamış olanlar
    const allExpenses = dataService.getExpenses() || [];
    const todayExpenses = allExpenses.filter(e => e.date <= todayStr && !reported.expenses.has(e.id));
    const totalExpenses = round2(todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
    const cashExpenses = round2(todayExpenses.filter(e => e.paymentMethod === 'CASH').reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
    const bankExpenses = round2(todayExpenses.filter(e => e.paymentMethod !== 'CASH').reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

    // TOPTANCI FATURALARI VE ÖDEMELERİ (aynı kural)
    const allSupplierTxs = dataService.getSupplierTransactions() || [];
    const todaySupplierTxs = allSupplierTxs.filter(t => t.date <= todayStr && !reported.supplierTxs.has(t.id));
    const supplierInvoicesTotal = round2(todaySupplierTxs.filter(t => t.type === 'INVOICE').reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
    const todaySupplierPayments = todaySupplierTxs.filter(t => t.type === 'PAYMENT');
    const supplierPaymentsTotal = round2(todaySupplierPayments.reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
    const supplierCashPayments = round2(todaySupplierPayments.filter(t => t.paymentMethod === 'CASH').reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
    const supplierBankPayments = round2(todaySupplierPayments.filter(t => t.paymentMethod !== 'CASH').reduce((sum, t) => sum + (Number(t.amount) || 0), 0));

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

    const cancelTotal = round2(cancelLogs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0));
    const cashSales = round2(paymentBreakdown['Nakit'] || 0);

    // KASADA KALAN NET NAKİT = (Nakit Satış) - (Kasadan Çıkan Nakit Giderler) - (Kasadan Toptancıya Ödenen Nakitler)
    const netCashInRegister = round2(cashSales - cashExpenses - supplierCashPayments);

    grossTotal = round2(grossTotal);
    discountTotal = round2(discountTotal);
    giftTotal = round2(giftTotal);
    Object.keys(paymentBreakdown).forEach((k) => { paymentBreakdown[k] = round2(paymentBreakdown[k]); });

    const netTotal = round2(grossTotal - discountTotal);
    const vatRate = 10; // Mevcut kapsamda ürün bazlı KDV yok; tek oran (yiyecek %10). Bkz. docs/known-limitations.
    const vatBase = round2(netTotal / 1.10);
    const vatAmount = round2(netTotal - vatBase);

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
      id: `z-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

    // İptal kayıtları SİLİNMEZ (denetim izi): bu Z'ye bağlanıp arşivde kalır.
    try {
      const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CANCEL_LOGS) || '[]');
      logs.forEach((c: any) => { if (!c.zReportId) c.zReportId = zReport.id; });
      localStorage.setItem(STORAGE_KEYS.CANCEL_LOGS, JSON.stringify(logs));
    } catch {}

    // Bu Z'ye giren gider/toptancı hareketlerini işaretle (ikinci Z'de tekrar sayılmasın).
    const alreadyReported = this.getZReportedIds();
    const bizToday = getBusinessDate();
    this.markZReported(
      (dataService.getExpenses() || []).filter(e => e.date <= bizToday && !alreadyReported.expenses.has(e.id)).map(e => e.id),
      (dataService.getSupplierTransactions() || []).filter(t => t.date <= bizToday && !alreadyReported.supplierTxs.has(t.id)).map(t => t.id)
    );

    // Z kapanışı sonrası otomatik dosya yedeği (arka planda; sonucu raporu engellemez)
    try { void this.autoBackupHook?.('z-kapanis'); } catch {}

    this.notify();
    return zReport;
  }

  private getZReportedIds(): { expenses: Set<string>; supplierTxs: Set<string> } {
    try {
      const raw = JSON.parse(localStorage.getItem('gtu_z_reported_ids') || '{}');
      return { expenses: new Set(raw.expenses || []), supplierTxs: new Set(raw.supplierTxs || []) };
    } catch {
      return { expenses: new Set(), supplierTxs: new Set() };
    }
  }

  private markZReported(expenseIds: string[], supplierTxIds: string[]) {
    const cur = this.getZReportedIds();
    expenseIds.forEach((i) => cur.expenses.add(i));
    supplierTxIds.forEach((i) => cur.supplierTxs.add(i));
    localStorage.setItem('gtu_z_reported_ids', JSON.stringify({ expenses: [...cur.expenses], supplierTxs: [...cur.supplierTxs] }));
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
      return getBusinessDate();
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

    const paidOrders = orders.filter(o => o.status !== 'CANCELLED');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

    paidOrders.forEach(ord => {
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
    const totalOrders = paidOrders.length;
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
    const cancelLogsTotal = cancelLogs.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
    const cancelledOrdersTotal = cancelledOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
    const cancelTotal = cancelLogsTotal + cancelledOrdersTotal;

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
      cancelledOrders,
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
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
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
    this.deleteItemFromCloud('printers', id);
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
    this.deleteItemFromCloud('kategoriler', id);
  }

  public getProducts(): ProductConfig[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const list: ProductConfig[] = data ? JSON.parse(data) : DEFAULT_PRODUCTS;
    return list.map(p => ({
      ...p,
      imageUrl: p.imageUrl && p.imageUrl.trim().length > 0 ? p.imageUrl : getProductFallbackImage(p.name, p.categoryId)
    }));
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
    this.deleteItemFromCloud('urunler', id);
  }

  public generatePairingCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
    const pairingCode = waiter.pairingCode || this.generatePairingCode();
    const newW: WaiterConfig = {
      id: waiter.id || `w-${Date.now()}`,
      name: waiter.name.trim(),
      phone: waiter.phone?.trim() || '',
      pin: waiter.pin.trim(),
      qrToken: token,
      pairingCode,
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
    this.notify();
    return newW;
  }

  public updateWaiter(id: string, partial: Partial<WaiterConfig>) {
    const waiters = this.getWaiters().map(w => {
      if (w.id === id) {
        return {
          ...w,
          ...partial,
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
    this.deleteItemFromCloud('personeller', id);
  }

  public pairWaiterDevice(id: string, deviceIdentifier: string, deviceName?: string) {
    const cleanId = deviceIdentifier.trim() || `DEV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    this.updateWaiter(id, {
      deviceUuid: cleanId,
      macAddress: cleanId,
      deviceName: deviceName?.trim() || 'Mobil Garson Terminali',
      status: 'APPROVED',
      pairedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
  }

  public resetWaiterDevice(id: string) {
    this.updateWaiter(id, {
      deviceUuid: '',
      deviceName: 'Telefon Eşleşmesi Bekleniyor',
      status: 'NOT_PAIRED',
      macAddress: '',
      pairingCode: this.generatePairingCode(),
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
        id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        phone: callOrPhone,
        customerId: customerData?.id,
        customerName: customerData?.name || 'Kayıtlı Olmayan Numara',
        address: customerData?.address || '',
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        date: getBusinessDate(),
        isRegistered: !!customerData?.name,
      };
    } else {
      newLog = { ...callOrPhone, id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
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
      return { success: false, message: 'Para çekmecesi açılamadı: yazıcı hizmetine ulaşılamadı.' };
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
      await fetch(`${getApiSyncUrl()}?action=update_platform_store_status`, {
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
      const res = await fetch(`${getApiSyncUrl()}?action=get_platform_store_status`);
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

  public async testDatabaseConnection(customUrl?: string): Promise<{ success: boolean; mode: string; message: string; tables?: any; error?: string }> {
    try {
      const url = customUrl || getApiSyncUrl();
      const res = await fetch(`${url}?action=test_db`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) {
        return { success: false, mode: 'OFFLINE', message: `Sunucu HTTP ${res.status} hatası döndürdü.` };
      }
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, mode: 'OFFLINE', message: `Sunucuya erişilemedi: ${e.message || 'Bağlantı zaman aşımı'}` };
    }
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
