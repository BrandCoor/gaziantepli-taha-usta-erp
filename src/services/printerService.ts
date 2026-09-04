import { restaurantDataService, PrinterConfig, OrderItemState, TableState } from './restaurantDataService';

export interface KitchenTicketData {
  ticketTitle: string;
  tableName: string;
  waiterName: string;
  orderTime: string;
  orderNote?: string;
  customerInfo?: {
    name: string;
    phone: string;
    address: string;
    note?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    note?: string;
    price?: number;
  }>;
}

export interface BillReceiptData {
  restaurantName: string;
  tableName: string;
  waiterName: string;
  orderTime: string;
  customerInfo?: any;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    totalPrice?: number;
  }>;
  totalAmount: number;
  paymentBreakdown?: Record<string, number>;
}

export interface CancelTicketData {
  tableName: string;
  waiterName: string;
  orderTime: string;
  reason?: string;
  items: Array<{
    name: string;
    quantity: number;
    reason?: string;
  }>;
}

class PrinterService {
  /**
   * Türkçe karakterleri ESC/POS ve termal yazıcılar için ASCII uyumlu metne çevirir
   */
  public cleanTurkish(text: string): string {
    if (!text) return '';
    const charMap: Record<string, string> = {
      'ğ': 'g', 'Ğ': 'G',
      'ş': 's', 'Ş': 'S',
      'ı': 'i', 'İ': 'I',
      'ç': 'c', 'Ç': 'C',
      'ö': 'o', 'Ö': 'O',
      'ü': 'u', 'Ü': 'U',
    };
    return text.split('').map(c => charMap[c] || c).join('');
  }

  /**
   * Termal yazıcılar için düz metin fiş şablonu üretir (USB ve browser yazdırma için)
   */
  public generatePlainTextReceipt(type: 'KITCHEN' | 'BILL' | 'CANCEL', data: any): string {
    const line = '--------------------------------\n';
    const doubleLine = '================================\n';
    let txt = '';

    if (type === 'KITCHEN') {
      txt += `${data.ticketTitle || 'MUTFAK SIPARIS FISI'}\n`;
      txt += doubleLine;
      if (data.customerInfo) {
        txt += `*** PAKET SERVIS ***\n`;
        txt += `MUSTERI: ${this.cleanTurkish(data.customerInfo.name)}\n`;
        txt += `TEL    : ${this.cleanTurkish(data.customerInfo.phone)}\n`;
        txt += `ADRES  : ${this.cleanTurkish(data.customerInfo.address)}\n`;
        txt += line;
      }
      txt += `MASA  : ${this.cleanTurkish(data.tableName)}\n`;
      txt += `GARSON: ${this.cleanTurkish(data.waiterName)} | SAAT: ${data.orderTime}\n`;
      txt += line;
      for (const it of data.items || []) {
        txt += `${it.quantity} x ${this.cleanTurkish(it.name || it.productName)}\n`;
        if (it.note) txt += `  * NOT: ${this.cleanTurkish(it.note)}\n`;
      }
      if (data.orderNote) {
        txt += line;
        txt += `MASA NOTU: ${this.cleanTurkish(data.orderNote)}\n`;
      }
      txt += doubleLine;
    } else if (type === 'BILL') {
      txt += `${data.restaurantName || 'GAZIANTEPLI TAHA USTA'}\n`;
      txt += `HESAP / ADISYON FISI\n`;
      txt += doubleLine;
      txt += `MASA  : ${this.cleanTurkish(data.tableName)}\n`;
      txt += `GARSON: ${this.cleanTurkish(data.waiterName)} | SAAT: ${data.orderTime}\n`;
      txt += line;
      for (const it of data.items || []) {
        const name = this.cleanTurkish(it.name || it.productName).padEnd(16).substring(0, 16);
        const qty = String(it.quantity).padStart(2);
        const tot = (Number(it.totalPrice || it.price * it.quantity) || 0).toFixed(2).padStart(8);
        txt += `${name} ${qty}x ${tot} TL\n`;
      }
      txt += line;
      txt += `TOPLAM TUTAR: ${(Number(data.totalAmount) || 0).toFixed(2)} TL\n`;
      txt += doubleLine;
      txt += `AFIYET OLSUN - YINE BEKLERIZ\n`;
    } else if (type === 'CANCEL') {
      txt += `*** SIPARIS IPTAL FISI ***\n`;
      txt += doubleLine;
      txt += `MASA  : ${this.cleanTurkish(data.tableName)}\n`;
      txt += `GARSON: ${this.cleanTurkish(data.waiterName)} | SAAT: ${data.orderTime}\n`;
      txt += line;
      for (const it of data.items || []) {
        txt += `IPTAL: ${it.quantity}x ${this.cleanTurkish(it.name || it.productName)}\n`;
        if (it.reason) txt += `  * Neden: ${this.cleanTurkish(it.reason)}\n`;
      }
      txt += doubleLine;
    }

    return txt;
  }

  /**
   * Belirtilen fiş verisini ilgili yazıcı donanımına iletir (Ağ, USB veya Elektron IPC)
   */
  public async dispatchPrintJob(
    printer: PrinterConfig,
    jobType: 'KITCHEN' | 'BILL' | 'CANCEL' | 'Z_REPORT',
    data: any
  ): Promise<{ success: boolean; message: string }> {
    // 1. Yazıcı sesli uyarı veriyorsa çal
    if (printer.beepOnPrint) {
      restaurantDataService.playAudioAlert('beep');
    }

    // A) HTTP Yerel Yazıcı Servisi (Electron server port 4545 veya local print agent)
    try {
      const response = await fetch('http://localhost:4545/api/printers/print-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer, jobType, data }),
      });
      if (response.ok) {
        const resJson = await response.json();
        if (resJson.success) {
          return { success: true, message: `[${printer.name}] hedefine fiş başarıyla yazdırıldı.` };
        }
      }
    } catch (netErr) {
      // Local HTTP agent o an kapalıysa Electron IPC veya alternatif kanala geç
    }

    // B) Electron Masaüstü IPC Doğrudan Erişim
    try {
      const win = window as any;
      if (win.require) {
        const { ipcRenderer } = win.require('electron');
        if (printer.type === 'NETWORK' && printer.ipAddress) {
          const ipcRes = await ipcRenderer.invoke('print-network-ticket', {
            ip: printer.ipAddress,
            port: printer.port || 9100,
            ticketType: jobType,
            data,
          });
          if (ipcRes && ipcRes.success) {
            return { success: true, message: `[${printer.name}] (${printer.ipAddress}) yazıcısına ağdan fiş iletildi.` };
          }
        } else if (printer.type === 'USB') {
          const rawText = this.generatePlainTextReceipt(jobType as any, data);
          const ipcRes = await ipcRenderer.invoke('print-usb-receipt', {
            printerName: printer.usbName || printer.name,
            rawText,
          });
          if (ipcRes && ipcRes.success) {
            return { success: true, message: `[${printer.name}] USB yazıcısına fiş döküldü.` };
          }
        }
      }
    } catch (ipcErr) {
      // IPC hatası olursa devam et
    }

    // C) Browser İçi Termal Simülasyon / Gizli Yazdırma Çerçevesi Fallback
    try {
      this.printViaHiddenFrame(jobType, data, printer);
      return { success: true, message: `[${printer.name}] fiş dökümü kuyruğa alındı.` };
    } catch (e) {
      return { success: false, message: `[${printer.name}] yazıcısına ulaşılamadı.` };
    }
  }

  /**
   * Tarayıcı ortamında 80mm/58mm termal kağıt formatında yazdırma penceresi tetikler
   */
  private printViaHiddenFrame(type: string, data: any, printer: PrinterConfig) {
    const rawText = this.generatePlainTextReceipt(type as any, data);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${printer.name} - Adisyon</title>
          <style>
            @page { size: ${printer.paperWidth === 58 ? '58mm' : '80mm'} auto; margin: 2mm; }
            body { font-family: monospace, 'Courier New', Courier; font-size: 13px; font-weight: bold; line-height: 1.3; color: #000; margin: 0; padding: 2px; white-space: pre-wrap; }
          </style>
        </head>
        <body>${rawText.replace(/\n/g, '<br/>')}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {}
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 300);
    }
  }

  /**
   * Kasa ve garsonlardan mutfağa gönderilen yeni sipariş kalemlerini
   * ilgili mutfak/istasyon yazıcılarına (Fırın, Kebap Ocağı, Bar vb.) ayrı ayrı böler ve basar.
   */
  public async printKitchenTickets(
    table: { id: string; name: string; customerInfo?: any; order?: any },
    items: OrderItemState[],
    waiterName: string = 'Garson',
    orderNote?: string
  ): Promise<{ success: boolean; dispatchedCount: number; details: string[] }> {
    if (!items || items.length === 0) {
      return { success: false, dispatchedCount: 0, details: ['Yazdırılacak ürün yok'] };
    }

    const printers = restaurantDataService.getPrinters();
    const categories = restaurantDataService.getCategories();
    const products = restaurantDataService.getProducts();

    // 1. Mutfak için tanımlı yazıcılar
    const kitchenPrinters = printers.filter(p => p.isKitchen);
    const defaultKitchenPrinter = kitchenPrinters[0] || printers[0];

    // Eğer sistemde hiç yazıcı tanımlı değilse
    if (printers.length === 0) {
      console.warn('⚠️ Sistemde kayıtlı termal yazıcı bulunamadı. Lütfen Ayarlar > Yazıcılar sekmesinden yazıcı ekleyin.');
      // Yine de mutfak çağrı zilini çal
      restaurantDataService.playAudioAlert('kitchen');
      return {
        success: false,
        dispatchedCount: 0,
        details: ['Sistemde tanımlı yazıcı bulunmuyor']
      };
    }

    // 2. Ürünleri hedef yazıcılarına göre grupla
    const printerGroupMap = new Map<string, Array<{ name: string; quantity: number; note?: string; price?: number }>>();

    for (const item of items) {
      const prod = products.find(p => p.id === item.productId || p.name === item.productName);
      const cat = prod ? categories.find(c => c.id === prod.categoryId) : undefined;

      // Ürünün özel yazıcısı > Kategorinin yazıcısı > Kalemin targetPrinter'ı > Varsayılan Mutfak Yazıcısı
      let targetPrinterId = prod?.printerId || cat?.printerId || item.targetPrinter;

      // Eğer bulunan yazıcı ID'si mevcut değilse veya boşsa
      let matchedPrinter = printers.find(p => p.id === targetPrinterId);
      if (!matchedPrinter) {
        matchedPrinter = defaultKitchenPrinter;
      }

      const assignedPrinterId = matchedPrinter ? matchedPrinter.id : 'default';

      if (!printerGroupMap.has(assignedPrinterId)) {
        printerGroupMap.set(assignedPrinterId, []);
      }

      printerGroupMap.get(assignedPrinterId)!.push({
        name: item.productName,
        quantity: Number(item.quantity) || 1,
        note: item.note,
        price: Number(item.price) || 0,
      });
    }

    // 3. Her yazıcı grubu için fiş bas
    let dispatchedCount = 0;
    const details: string[] = [];
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    for (const [printerId, groupedItems] of printerGroupMap.entries()) {
      const targetPrinter = printers.find(p => p.id === printerId) || defaultKitchenPrinter;
      if (!targetPrinter) continue;

      const ticketData: KitchenTicketData = {
        ticketTitle: targetPrinter.role ? `${targetPrinter.role.toUpperCase()} SIPARISI` : 'MUTFAK SIPARIS FISI',
        tableName: table.name,
        waiterName: waiterName || table.order?.waiterName || 'Garson',
        orderTime: currentTime,
        orderNote: orderNote || table.order?.orderNote || '',
        customerInfo: table.customerInfo,
        items: groupedItems,
      };

      const result = await this.dispatchPrintJob(targetPrinter, 'KITCHEN', ticketData);
      if (result.success) {
        dispatchedCount++;
        details.push(`${targetPrinter.name} (${groupedItems.length} kalem ürün)`);
      }
    }

    // Mutfak bildirim sesini çal
    restaurantDataService.playAudioAlert('kitchen');

    return {
      success: dispatchedCount > 0,
      dispatchedCount,
      details,
    };
  }

  /**
   * Masanın adisyon / hesap fişini kasa yazıcısına gönderir
   */
  public async printBill(
    table: { id: string; name: string; customerInfo?: any; order?: any },
    items: OrderItemState[],
    payments?: any[]
  ): Promise<{ success: boolean; message: string }> {
    const printers = restaurantDataService.getPrinters();
    const billPrinter = printers.find(p => p.isBillPrinter) || printers.find(p => !p.isKitchen) || printers[0];

    if (!billPrinter) {
      return { success: false, message: 'Kasa hesap yazıcısı tanımlı değil.' };
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.isGift ? 0 : (Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);

    const billData: BillReceiptData = {
      restaurantName: 'GAZIANTEPLI TAHA USTA',
      tableName: table.name,
      waiterName: table.order?.waiterName || 'Kasa',
      orderTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      customerInfo: table.customerInfo,
      items: items.map(i => ({
        name: i.productName,
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
        totalPrice: (Number(i.price) || 0) * (Number(i.quantity) || 1),
      })),
      totalAmount,
    };

    return await this.dispatchPrintJob(billPrinter, 'BILL', billData);
  }

  /**
   * İptal edilen ürün veya masalar için mutfak istasyonlarına iptal fişi basar
   */
  public async printCancellationTicket(
    table: { id: string; name: string },
    cancelledItems: Array<{ name: string; quantity: number; reason?: string }>,
    waiterName: string = 'Kasa'
  ): Promise<void> {
    const printers = restaurantDataService.getPrinters();
    const kitchenPrinters = printers.filter(p => p.isKitchen);
    const targetPrinters = kitchenPrinters.length > 0 ? kitchenPrinters : [printers[0]].filter(Boolean);

    const cancelData: CancelTicketData = {
      tableName: table.name,
      waiterName,
      orderTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      items: cancelledItems,
    };

    for (const pr of targetPrinters) {
      await this.dispatchPrintJob(pr, 'CANCEL', cancelData);
    }
  }
}

export const printerService = new PrinterService();

// Garsonların mobilden girdiği siparişleri otomatik mutfak yazıcılarına yönlendir
restaurantDataService.onKitchenOrderPrint((table, items, waiterName, orderNote) => {
  printerService.printKitchenTickets(table, items, waiterName, orderNote);
});

// Garsonların mobilden hesap istediği masaların hesap fişini otomatik kasaya dök
restaurantDataService.onBillRequestPrint((table, items) => {
  printerService.printBill(table, items);
});
