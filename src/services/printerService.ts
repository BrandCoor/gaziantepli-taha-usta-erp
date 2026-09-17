import {
  restaurantDataService,
  PrinterConfig,
  OrderItemState,
  TableState,
  ReceiptSettingsConfig,
} from './restaurantDataService';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  note?: string;
  price?: number;
  chefStation?: string;
  isGift?: boolean;
}

export interface KitchenTicketData {
  ticketTitle: string;
  chefStation: 'OCAK' | 'FIRIN' | 'MUTFAK' | 'BAR' | 'GENEL';
  chefStationTitle: string;
  tableName: string;
  waiterName: string;
  orderTime: string;
  orderNumber?: number | string;
  orderNote?: string;
  isAdditionalOrder?: boolean;
  customerInfo?: {
    name: string;
    phone: string;
    address: string;
    note?: string;
  };
  items: KitchenTicketItem[];
}

export interface BillReceiptItem {
  name: string;
  quantity: number;
  price: number;
  totalPrice?: number;
  note?: string;
  isGift?: boolean;
}

export interface BillReceiptData {
  settings?: ReceiptSettingsConfig;
  restaurantName?: string;
  tableName: string;
  waiterName: string;
  orderTime: string;
  orderNumber?: number | string;
  customerInfo?: any;
  items: BillReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  discountPercent?: number;
  discountReason?: string;
  totalAmount: number;
  vatRate?: number;
  vatBase?: number;
  vatAmount?: number;
  isCourierTicket?: boolean;
  isHandoverTicket?: boolean;
  courierName?: string;
  handoverCode?: string;
  platformName?: string;
  paymentMethod?: string;
  deliveryModel?: string;
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

/**
 * Ürünün hangi mutfak istasyonunda (Ocak, Fırın veya Mutfak) hazırlanacağını akıllıca tespit eder
 */
export function determineStationForProduct(
  productName: string,
  categoryName?: string
): { stationKey: 'OCAK' | 'FIRIN' | 'MUTFAK' | 'BAR'; stationTitle: string; chefTitle: string } {
  const pLower = (productName || '').toLowerCase();
  const cLower = (categoryName || '').toLowerCase();

  // 1. BAR / İÇECEK & MEŞRUBAT
  if (
    cLower.includes('içecek') ||
    cLower.includes('icecek') ||
    cLower.includes('meşrubat') ||
    cLower.includes('mesrubat') ||
    cLower.includes('bar') ||
    pLower.includes('ayran') ||
    pLower.includes('kola') ||
    pLower.includes('cola') ||
    pLower.includes('fanta') ||
    pLower.includes('gazoz') ||
    pLower.includes('şalgam') ||
    pLower.includes('salgam') ||
    pLower.includes('çay') ||
    pLower.includes('cay') ||
    pLower.includes('kahve') ||
    pLower.includes('limonata')
  ) {
    return {
      stationKey: 'BAR',
      stationTitle: 'BAR / İÇECEK SİPARİŞİ',
      chefTitle: 'BAR & SERVİS',
    };
  }

  // 2. FIRIN / PİDE & LAHMACUN (Taş fırında pişecekler)
  if (
    cLower.includes('fırın') ||
    cLower.includes('firin') ||
    cLower.includes('pide') ||
    cLower.includes('lahmacun') ||
    pLower.includes('lahmacun') ||
    pLower.includes('pide') ||
    pLower.includes('katmer') ||
    pLower.includes('güveç') ||
    pLower.includes('guvec') ||
    pLower.includes('fırın') ||
    pLower.includes('firin') ||
    pLower.includes('cantık') ||
    pLower.includes('künefe') ||
    pLower.includes('kunefe')
  ) {
    return {
      stationKey: 'FIRIN',
      stationTitle: 'FIRIN / PİDE & LAHMACUN SİPARİŞİ',
      chefTitle: 'FIRIN USTASI',
    };
  }

  // 3. OCAK / KEBAP & IZGARA (Kebap ocağı ve ızgarada pişecekler)
  if (
    cLower.includes('kebap') ||
    cLower.includes('ızgara') ||
    cLower.includes('izgara') ||
    pLower.includes('kebap') ||
    pLower.includes('ızgara') ||
    pLower.includes('izgara') ||
    pLower.includes('adana') ||
    pLower.includes('urfa') ||
    pLower.includes('şiş') ||
    pLower.includes('sis') ||
    pLower.includes('kanat') ||
    pLower.includes('köfte') ||
    pLower.includes('kofte') ||
    pLower.includes('pirzola') ||
    pLower.includes('beyti') ||
    pLower.includes('ciğer') ||
    pLower.includes('ciger') ||
    pLower.includes('tavuk') ||
    pLower.includes('biftek') ||
    pLower.includes('antrikot') ||
    pLower.includes('ali nazik') ||
    pLower.includes('iskender')
  ) {
    return {
      stationKey: 'OCAK',
      stationTitle: 'OCAK / IZGARA & KEBAP SİPARİŞİ',
      chefTitle: 'OCAK USTASI',
    };
  }

  // 4. MUTFAK / MEZE & ÇORBA & SALATA
  return {
    stationKey: 'MUTFAK',
    stationTitle: 'MUTFAK / MEZE & SALATA SİPARİŞİ',
    chefTitle: 'MUTFAK USTASI',
  };
}

class PrinterService {
  /**
   * Türkçe karakterleri ESC/POS ve termal yazıcılar için ASCII uyumlu metne çevirir
   */
  public cleanTurkish(text: string): string {
    if (!text) return '';
    const charMap: Record<string, string> = {
      ğ: 'g',
      Ğ: 'G',
      ş: 's',
      Ş: 'S',
      ı: 'i',
      İ: 'I',
      ç: 'c',
      Ç: 'C',
      ö: 'o',
      Ö: 'O',
      ü: 'u',
      Ü: 'U',
    };
    return text
      .split('')
      .map(c => charMap[c] || c)
      .join('');
  }

  /**
   * Termal yazıcılar için düz metin fiş şablonu üretir (USB ve raw text dökümü için)
   */
  public generatePlainTextReceipt(type: 'KITCHEN' | 'BILL' | 'CANCEL', data: any): string {
    const line = '--------------------------------\n';
    const doubleLine = '================================\n';
    let txt = '';

    if (type === 'KITCHEN') {
      if (data.isAdditionalOrder) {
        txt += `*** ILAVE SIPARIS (EK SIPARIS) ***\n`;
        txt += `>> ONCEKI SIPARISLERE ILAVE EDILMISTIR <<\n`;
        txt += doubleLine;
      }
      txt += `${this.cleanTurkish(data.ticketTitle || 'MUTFAK SIPARISI')}\n`;
      txt += `>>> ${this.cleanTurkish(data.chefStationTitle || 'USTA')} DIKKATINE <<<\n`;
      txt += doubleLine;

      if (data.customerInfo) {
        txt += `*** PAKET SERVIS / KURYE ***\n`;
        txt += `MUSTERI: ${this.cleanTurkish(data.customerInfo.name)}\n`;
        txt += `TEL    : ${this.cleanTurkish(data.customerInfo.phone)}\n`;
        txt += `ADRES  : ${this.cleanTurkish(data.customerInfo.address)}\n`;
        txt += line;
      }

      txt += `MASA  : ${this.cleanTurkish(data.tableName)}\n`;
      txt += `GARSON: ${this.cleanTurkish(data.waiterName)} | SAAT: ${data.orderTime}\n`;
      if (data.orderNumber) {
        txt += `ADISYON NO: #GTU-${new Date().getFullYear()}-${String(data.orderNumber).padStart(4, '0')}\n`;
      }
      txt += line;
      txt += `HAZIRLANACAK URUNLER:\n`;

      for (const it of data.items || []) {
        txt += `>> ${it.quantity} x ${this.cleanTurkish(it.name || it.productName)}\n`;
        txt += `   [YAPILACAK URUN: ${this.cleanTurkish(it.chefStation || data.chefStationTitle || 'USTA')}]\n`;
        if (it.isGift) {
          txt += `   *** [IKRAM URUN - HESAPSIZ] ***\n`;
        }
        if (it.note) {
          txt += `   * USTA NOTU: ${this.cleanTurkish(it.note)}\n`;
        }
        txt += line;
      }

      if (data.orderNote) {
        txt += `MASA NOTU: ${this.cleanTurkish(data.orderNote)}\n`;
        txt += doubleLine;
      }
    } else if (type === 'BILL') {
      if (data.isHandoverTicket) {
        // MODEL 2: PLATFORM KURYESİ (TRENDYOL GO / VALE / GETİR) - 4 HANELİ TESLİMAT KODU & PAKET ETİKETİ
        const platformTitle = this.cleanTurkish(data.platformName || data.tableName || 'ONLINE PLATFORM');
        const code = data.handoverCode || (typeof data.orderNumber === 'string' ? data.orderNumber.replace(/[^0-9]/g, '').slice(-4) : '----');
        
        txt += doubleLine;
        txt += `*** PAKET ETIKETI / TESLIMAT KODU ***\n`;
        txt += doubleLine;
        txt += `PLATFORM    : ${platformTitle}\n`;
        txt += `SIPARIS NO  : #${data.orderNumber || ''}\n`;
        txt += `TARIH & SAAT: ${data.orderTime}\n`;
        txt += line;
        txt += `================================\n`;
        txt += `   TESLIMAT KODU: #${code}\n`;
        txt += `================================\n`;
        txt += line;
        if (data.customerInfo) {
          txt += `MUSTERI     : ${this.cleanTurkish(data.customerInfo.name || '')}\n`;
        }
        txt += `PLATFORM KUR: ${this.cleanTurkish(data.courierName || 'Platform Kuryesi')}\n`;
        txt += `ODEME SEKLI : ONLINE ODENDI (UCRETSIZ)\n`;
        txt += line;
        txt += `PAKET ICERIGI:\n`;
        for (const it of data.items || []) {
          const qty = Number(it.quantity) || 1;
          const name = this.cleanTurkish(it.name || it.productName);
          txt += `>> ${qty} x ${name}\n`;
          if (it.note) txt += `   * ${this.cleanTurkish(it.note)}\n`;
        }
        txt += line;
        txt += `GENEL TOPLAM: ₺${(Number(data.totalAmount) || 0).toFixed(2)}\n`;
        txt += doubleLine;
        txt += `>>> PAKET UZERINE ZIMBALAYINIZ <<<\n`;
        txt += `(Platform kuryesine bu kodu veriniz)\n`;
        txt += doubleLine;
        return txt;
      }

      if (data.isCourierTicket) {
        // MODEL 1: RESTORAN KURYESİ (KENDİ KURYEMİZ) - KURYE YOL FİŞİ & ZİMMET
        const platformTitle = this.cleanTurkish(data.platformName || data.tableName || 'RESTORAN KURYESI');
        const courier = this.cleanTurkish(data.courierName || 'Kendi Kuryemiz');
        const payMethod = this.cleanTurkish(data.paymentMethod || 'Online');
        const isCashOnDoor = payMethod.toLowerCase().includes('nakit');
        const isPosOnDoor = payMethod.toLowerCase().includes('pos') || payMethod.toLowerCase().includes('kredi') && payMethod.toLowerCase().includes('kapı');

        txt += doubleLine;
        txt += `*** KURYE TESLIMAT YOL FISI ***\n`;
        txt += doubleLine;
        txt += `ATANAN KURYE : ${courier}\n`;
        txt += `KANAL / SIP  : ${platformTitle} (#${data.orderNumber || ''})\n`;
        txt += `TARIH & SAAT : ${data.orderTime}\n`;
        txt += line;
        if (data.customerInfo) {
          txt += `MUSTERI      : ${this.cleanTurkish(data.customerInfo.name || '')}\n`;
          txt += `TELEFON      : ${this.cleanTurkish(data.customerInfo.phone || 'Yok')}\n`;
          txt += `ACIK ADRES   : ${this.cleanTurkish(data.customerInfo.address || '')}\n`;
          if (data.customerInfo.note) {
            txt += `ADRES / NOT  : ${this.cleanTurkish(data.customerInfo.note)}\n`;
          }
        }
        txt += line;
        txt += `SIPARIS DOKUMU:\n`;
        for (const it of data.items || []) {
          const qty = Number(it.quantity) || 1;
          const name = this.cleanTurkish(it.name || it.productName);
          const price = Number(it.price) || 0;
          const total = Number(it.totalPrice || price * qty) || 0;
          txt += `${qty}x ${name}`.substring(0, 22).padEnd(22) + `₺${total.toFixed(2)}`.padStart(10) + '\n';
          if (it.note) txt += `  * ${this.cleanTurkish(it.note)}\n`;
        }
        txt += line;
        const grandTotal = Number(data.totalAmount) || 0;
        txt += `TOPLAM TUTAR :`.padEnd(20) + `₺${grandTotal.toFixed(2)}`.padStart(12) + '\n';
        txt += line;
        txt += `ODEME SEKLI  : ${payMethod}\n`;
        if (isCashOnDoor) {
          txt += `================================\n`;
          txt += `[!] KURYE TAHSIL EDECEK: KAPIDA NAKIT\n`;
          txt += `TAHSILAT TUTARI: ₺${grandTotal.toFixed(2)}\n`;
          txt += `================================\n`;
        } else if (isPosOnDoor) {
          txt += `================================\n`;
          txt += `[!] KURYE TAHSIL EDECEK: KAPIDA POS\n`;
          txt += `TAHSILAT TUTARI: ₺${grandTotal.toFixed(2)}\n`;
          txt += `================================\n`;
        } else {
          txt += `[OK] ONLINE ODENDI (TAHSILAT YAPILMAYACAK)\n`;
        }
        txt += doubleLine;
        txt += `Kurye Zimmet ve Teslimat Fisi\n`;
        txt += doubleLine;
        return txt;
      }

      const s = data.settings || {};
      const title = s.title || data.restaurantName || 'GAZIANTEPLI TAHA USTA';
      const subtitle = s.subtitle || 'Kebap & Lahmacun Salonu';
      const address = s.address || 'Sehitkamil / Gaziantep';
      const phone = s.phone || '0 (342) 555 00 27';
      const taxOffice = s.taxOffice || 'Sehitkamil V.D.';
      const taxNumber = s.taxNumber || '1234567890';
      const mersisNo = s.mersisNo || '012345678900001';
      const orderNumber = data.orderNumber || 841;

      if (s.printLogo) {
        txt += `[ TU ]\n`;
      }
      txt += `${this.cleanTurkish(title)}\n`;
      txt += `${this.cleanTurkish(subtitle)}\n`;
      txt += `${this.cleanTurkish(address)}\n`;
      txt += `Tel: ${this.cleanTurkish(phone)}\n`;
      txt += `${this.cleanTurkish(taxOffice)} . VKN: ${taxNumber}`;
      if (mersisNo) txt += ` . MERSIS: ${mersisNo}`;
      txt += `\n` + line;

      if (s.showTableNumber !== false) {
        txt += `MASA        : ${this.cleanTurkish(data.tableName)}\n`;
      }
      if (s.showWaiterName !== false) {
        txt += `GARSON      : ${this.cleanTurkish(data.waiterName || 'Mehmet Usta')}\n`;
      }
      if (s.showOrderTime !== false) {
        txt += `TARIH & SAAT: ${data.orderTime}\n`;
      }
      txt += `ADISYON NO  : #GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}\n`;
      txt += line;

      txt += `URUN ACIKLAMASI                 TUTAR\n`;
      txt += line;

      for (const it of data.items || []) {
        const name = this.cleanTurkish(it.name || it.productName);
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const total = Number(it.totalPrice || price * qty) || 0;

        const leftStr = `${qty}x ${name}`.substring(0, 22).padEnd(22);
        const rightStr = `₺${total.toFixed(2)}`.padStart(10);
        txt += `${leftStr}${rightStr}\n`;

        if (it.note) {
          txt += `  * ${this.cleanTurkish(it.note)}\n`;
        }
        if (qty > 1) {
          txt += `  ${qty} x ₺${price.toFixed(2)}\n`;
        }
      }

      txt += line;
      const subtotal = Number(data.subtotal || data.totalAmount) || 0;
      const discount = Number(data.discountAmount) || 0;
      const grandTotal = Number(data.totalAmount) || (subtotal - discount);

      txt += `Ara Toplam:`.padEnd(20) + `₺${subtotal.toFixed(2)}`.padStart(12) + '\n';
      if (discount > 0) {
        txt += `Ikram & Indirim:`.padEnd(20) + `-₺${discount.toFixed(2)}`.padStart(12) + '\n';
      }
      txt += doubleLine;
      txt += `GENEL TOPLAM:`.padEnd(16) + `₺${grandTotal.toFixed(2)}`.padStart(16) + '\n';
      txt += doubleLine;

      if (s.showVatDetails !== false) {
        const vatBase = Number(data.vatBase) || (grandTotal / 1.10);
        const vatAmount = Number(data.vatAmount) || (grandTotal - vatBase);
        txt += `KDV ORANI       MATRAH    KDV TUTARI\n`;
        txt += `%10 Yiyecek   ₺${vatBase.toFixed(2).padStart(8)}  ₺${vatAmount.toFixed(2).padStart(8)}\n`;
        txt += line;
      }

      if (s.wifiName || s.instagram) {
        if (s.wifiName) {
          txt += `Wi-Fi: ${this.cleanTurkish(s.wifiName)} | Sifre: ${this.cleanTurkish(s.wifiPassword || '')}\n`;
        }
        if (s.instagram) {
          txt += `Instagram: ${this.cleanTurkish(s.instagram)}\n`;
        }
        txt += line;
      }

      txt += `${this.cleanTurkish(s.footerMessage || 'Afiyet Olsun. Yine Bekleriz!')}\n`;

      if (s.showBarcode !== false) {
        txt += `||||| |||| |||||| |||||\n`;
        txt += `GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}-KASA\n`;
      }
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
   * Belirtilen fiş verisini ilgili yazıcı donanımına iletir (Ağ, USB veya Electron IPC)
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

    let printSuccess = false;
    let resultMessage = '';

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
          printSuccess = true;
          resultMessage = `[${printer.name}] hedefine fiş başarıyla yazdırıldı.`;
        }
      }
    } catch (netErr) {
      // Local HTTP agent o an kapalıysa Electron IPC veya alternatif kanala geç
    }

    // B) Electron Masaüstü IPC Doğrudan Erişim
    if (!printSuccess) {
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
              printSuccess = true;
              resultMessage = `[${printer.name}] (${printer.ipAddress}) yazıcısına ağdan fiş iletildi.`;
            }
          } else if (printer.type === 'USB' || printer.type === 'SYSTEM_DRIVER') {
            const rawText = this.generatePlainTextReceipt(jobType as any, data);
            const ipcRes = await ipcRenderer.invoke('print-usb-receipt', {
              printerName: printer.driverName || printer.usbName || printer.name,
              rawText,
            });
            if (ipcRes && ipcRes.success) {
              printSuccess = true;
              resultMessage = `[${printer.name}] yazıcısına fiş döküldü.`;
            }
          }
        }
      } catch (ipcErr) {
        // IPC hatası olursa devam et
      }
    }

    // C) Browser İçi Termal Çerçevesi Fallback
    if (!printSuccess) {
      try {
        this.printViaHiddenFrame(jobType, data, printer);
        printSuccess = true;
        resultMessage = `[${printer.name}] fiş dökümü kuyruğa alındı.`;
      } catch (e) {
        resultMessage = `[${printer.name}] yazıcısına ulaşılamadı.`;
      }
    }

    // D) Otomatik Yedek (Failover) Yazıcı Desteği
    if (!printSuccess && printer.failoverPrinterId) {
      const allPrinters = restaurantDataService.getPrinters();
      const backupPrinter = allPrinters.find(p => p.id === printer.failoverPrinterId);
      if (backupPrinter && backupPrinter.id !== printer.id) {
        console.warn(`⚠️ [${printer.name}] çevrimdışı, otomatik yedek yazıcıya ([${backupPrinter.name}]) aktarılıyor...`);
        return this.dispatchPrintJob(backupPrinter, jobType, data);
      }
    }

    return { success: printSuccess, message: resultMessage };
  }

  /**
   * Tarayıcı ortamında 80mm/58mm termal kağıt formatında tam şablon uyumlu HTML yazdırma tetikler
   */
  private printViaHiddenFrame(type: string, data: any, printer: PrinterConfig) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    let htmlBody = '';
    const is58mm = printer.paperWidth === 58;

    if (type === 'BILL') {
      const s = data.settings || restaurantDataService.getReceiptSettings();
      const subtotal = Number(data.subtotal || data.totalAmount) || 0;
      const discount = Number(data.discountAmount) || 0;
      const grandTotal = Number(data.totalAmount) || subtotal - discount;
      const vatBase = Number(data.vatBase) || grandTotal / 1.1;
      const vatAmount = Number(data.vatAmount) || grandTotal - vatBase;
      const orderNumber = data.orderNumber || 841;

      htmlBody = `
        <div class="receipt-container">
          <div class="header">
            ${
              s.printLogo
                ? `<div class="logo-badge">TU</div>`
                : ''
            }
            <div class="brand-title">${s.title || 'GAZİANTEPLİ TAHA USTA'}</div>
            <div class="brand-subtitle">${s.subtitle || 'Kebap & Lahmacun Salonu'}</div>
            <div class="brand-sub">${s.address || 'Kadıköy / İSTANBUL'}</div>
            <div class="brand-sub">Tel: ${s.phone || '0 (342) 555 00 27'}</div>
            <div class="tax-info">
              ${s.taxOffice ? s.taxOffice + ' • ' : ''}VKN: ${s.taxNumber || '1234567890'}
              ${s.mersisNo ? ' • MERSİS: ' + s.mersisNo : ''}
            </div>
          </div>

          <div class="dashed-line"></div>

          <div class="meta-section">
            ${
              s.showTableNumber !== false
                ? `<div class="row"><span class="meta-label">MASA:</span><span class="meta-val-bold">${data.tableName}</span></div>`
                : ''
            }
            ${
              s.showWaiterName !== false
                ? `<div class="row"><span class="meta-label">GARSON:</span><span class="meta-val">${data.waiterName || 'Mehmet Usta'}</span></div>`
                : ''
            }
            ${
              s.showOrderTime !== false
                ? `<div class="row"><span class="meta-label">TARİH & SAAT:</span><span class="meta-val">${data.orderTime}</span></div>`
                : ''
            }
            <div class="row"><span class="meta-label">ADİSYON NO:</span><span class="meta-val-bold">#GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}</span></div>
          </div>

          <div class="dashed-line"></div>

          <div class="items-table">
            <div class="table-header">
              <span>ÜRÜN AÇIKLAMASI</span>
              <span>TUTAR</span>
            </div>

            ${(data.items || [])
              .map((it: any) => {
                const qty = Number(it.quantity) || 1;
                const price = Number(it.price) || 0;
                const total = Number(it.totalPrice || price * qty) || 0;
                return `
                <div class="item-block">
                  <div class="item-title-row">
                    <span class="item-name">${qty}x ${it.name || it.productName}${it.isGift ? ' <span class="gift-badge">[İKRAM]</span>' : ''}</span>
                    <span class="item-price">₺${total.toFixed(2)}</span>
                  </div>
                  ${it.note ? `<div class="item-note">* ${it.note}</div>` : ''}
                  ${qty > 1 ? `<div class="item-sub">${qty} x ₺${price.toFixed(2)}</div>` : ''}
                </div>
              `;
              })
              .join('')}
          </div>

          <div class="dashed-line"></div>

          <div class="totals-section">
            <div class="row">
              <span>Ara Toplam:</span>
              <span class="val-bold">₺${subtotal.toFixed(2)}</span>
            </div>
            ${
              discount > 0
                ? `
              <div class="row discount">
                <span>İkram & İndirim${data.discountPercent ? ` (%${data.discountPercent})` : ''}:</span>
                <span class="val-bold">-₺${discount.toFixed(2)}</span>
              </div>
            `
                : ''
            }
            <div class="row grand-total">
              <span class="grand-label">GENEL TOPLAM:</span>
              <span class="grand-price">₺${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          ${
            s.showVatDetails !== false
              ? `
            <div class="dashed-line"></div>
            <div class="vat-section">
              <div class="row vat-header">
                <span>KDV ORANI</span>
                <span>MATRAH</span>
                <span>KDV TUTARI</span>
              </div>
              <div class="row vat-row">
                <span>%10 Yiyecek & İçecek</span>
                <span>₺${vatBase.toFixed(2)}</span>
                <span>₺${vatAmount.toFixed(2)}</span>
              </div>
            </div>
          `
              : ''
          }

          ${
            s.wifiName || s.instagram
              ? `
            <div class="dashed-line"></div>
            <div class="social-section">
              ${
                s.wifiName
                  ? `<div class="social-line">📶 Wi-Fi: <b>${s.wifiName}</b> | Şifre: <b>${s.wifiPassword || ''}</b></div>`
                  : ''
              }
              ${
                s.instagram
                  ? `<div class="social-line">📸 Instagram: <b>${s.instagram}</b></div>`
                  : ''
              }
            </div>
          `
              : ''
          }

          <div class="dashed-line"></div>

          <div class="footer-msg">
            ${s.footerMessage || 'Afiyet Olsun. Yine Bekleriz!'}
          </div>

          ${
            s.showBarcode
              ? `
            <div class="barcode-container">
              <div class="barcode-bars">
                ${[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1]
                  .map(
                    w =>
                      `<div style="background-color:#000; height:24px; width:${w}px; display:inline-block; margin-right:1px;"></div>`
                  )
                  .join('')}
              </div>
              <div class="barcode-text">GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}-KASA</div>
            </div>
          `
              : ''
          }

          <div class="zigzag-edge">
            ${Array.from({ length: 30 })
              .map(
                () =>
                  `<div class="zigzag-tooth"></div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (type === 'KITCHEN') {
      htmlBody = `
        <div class="kitchen-container">
          ${
            data.isAdditionalOrder
              ? `
            <div class="additional-order-banner">*** İLAVE SİPARİŞ (EK SİPARİŞ) ***</div>
            <div class="additional-order-sub">&gt;&gt; ÖNCEKİ SİPARİŞLERE İLAVE EDİLMİŞTİR &lt;&lt;</div>
          `
              : ''
          }
          <div class="kitchen-header">
            <div class="station-title">*** ${data.ticketTitle || 'MUTFAK SİPARİŞİ'} ***</div>
            <div class="chef-callout">&gt;&gt;&gt; ${data.chefStationTitle || 'İSTASYON USTASI'} DİKKATİNE &lt;&lt;&lt;</div>
          </div>

          <div class="kitchen-meta">
            <div class="meta-table">MASA: ${data.tableName}</div>
            <div class="meta-info">
              <span>Garson: <b>${data.waiterName || 'Garson'}</b></span>
              <span>Saat: <b>${data.orderTime}</b></span>
            </div>
            ${
              data.orderNumber
                ? `<div class="order-no">Sipariş No: #GTU-${new Date().getFullYear()}-${String(data.orderNumber).padStart(4, '0')}</div>`
                : ''
            }
          </div>

          ${
            data.customerInfo
              ? `
            <div class="delivery-box">
              <div class="delivery-title">🛵 PAKET SERVİS / KURYE</div>
              <div><b>Müşteri:</b> ${data.customerInfo.name} (${data.customerInfo.phone})</div>
              <div><b>Adres:</b> ${data.customerInfo.address}</div>
            </div>
          `
              : ''
          }

          <div class="kitchen-items">
            <div class="items-title">HAZIRLANACAK / PİŞİRİLECEK ÜRÜNLER:</div>
            ${(data.items || [])
              .map(
                (it: any) => `
              <div class="kitchen-item-card">
                <div class="item-name-line">&gt;&gt; ${it.quantity}x ${it.name || it.productName}</div>
                <div class="station-badge">YAPILACAK ÜRÜN: ${it.chefStation || data.chefStationTitle || 'USTA'}</div>
                ${it.isGift ? `<div class="gift-callout">*** [İKRAM ÜRÜN - HESAPSIZ] ***</div>` : ''}
                ${it.note ? `<div class="chef-note">* USTA NOTU: ${it.note}</div>` : ''}
              </div>
            `
              )
              .join('')}
          </div>

          ${
            data.orderNote
              ? `
            <div class="order-note-box">
              <b>MASA GENEL NOTU:</b> ${data.orderNote}
            </div>
          `
              : ''
          }

          <div class="zigzag-edge">
            ${Array.from({ length: 30 })
              .map(
                () =>
                  `<div class="zigzag-tooth"></div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else {
      const rawText = this.generatePlainTextReceipt(type as any, data);
      htmlBody = `<div class="plain-raw">${rawText.replace(/\n/g, '<br/>')}</div>`;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${printer.name} - Baskı</title>
        <style>
          @page {
            size: ${is58mm ? '58mm' : '80mm'} auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: 'Consolas', 'Courier New', 'SF Mono', 'Roboto Mono', Menlo, Monaco, monospace;
            font-size: 12px;
            line-height: 1.35;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          .receipt-container, .kitchen-container {
            width: 100%;
            max-width: ${is58mm ? '280px' : '360px'};
            margin: 0 auto;
            padding: 10px 12px;
            background: #ffffff;
          }
          @media print {
            html, body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt-container, .kitchen-container {
              width: 100% !important;
              max-width: ${is58mm ? '50mm' : '74mm'} !important;
              margin: 0 auto !important;
              padding: 1.5mm 0.5mm !important;
            }
          }
          .header {
            text-align: center;
            margin-bottom: 6px;
          }
          .logo-badge {
            width: 34px;
            height: 34px;
            margin: 0 auto 4px auto;
            background: #0f172a;
            color: #F5C877;
            border-radius: 50%;
            font-weight: 900;
            font-size: 14px;
            line-height: 34px;
            text-align: center;
          }
          .brand-title {
            font-weight: 900;
            font-size: 15px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #000000;
          }
          .brand-subtitle {
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            margin-top: 2px;
          }
          .brand-sub {
            font-size: 11px;
            color: #334155;
            margin-top: 1px;
          }
          .tax-info {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
          }
          .dashed-line {
            border-bottom: 1.5px dashed #475569;
            margin: 6px 0;
          }
          .meta-section {
            font-size: 11.5px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 2px;
          }
          .meta-label {
            font-weight: 700;
            color: #334155;
          }
          .meta-val {
            color: #0f172a;
          }
          .meta-val-bold {
            font-weight: 900;
            color: #000000;
            font-size: 12px;
          }
          .items-table {
            margin: 4px 0;
          }
          .table-header {
            display: flex;
            justify-content: space-between;
            font-weight: 900;
            font-size: 11px;
            color: #334155;
            padding-bottom: 3px;
            border-bottom: 1px solid #94a3b8;
            letter-spacing: 0.5px;
          }
          .item-block {
            margin: 4px 0;
          }
          .item-title-row {
            display: flex;
            justify-content: space-between;
            font-weight: 800;
            font-size: 12.5px;
            color: #000000;
          }
          .item-name {
            max-width: 75%;
          }
          .item-price {
            font-weight: 900;
            white-space: nowrap;
          }
          .gift-badge {
            color: #dc2626;
            font-size: 10px;
            font-weight: 900;
          }
          .item-note {
            font-size: 10.5px;
            color: #475569;
            margin-top: 1px;
            padding-left: 6px;
          }
          .item-sub {
            font-size: 10.5px;
            color: #64748b;
            margin-top: 1px;
            padding-left: 6px;
          }
          .totals-section {
            padding: 4px 0;
            font-size: 12px;
          }
          .val-bold {
            font-weight: 800;
          }
          .discount {
            color: #047857;
            font-weight: 800;
          }
          .grand-total {
            font-weight: 900;
            font-size: 15px;
            color: #000000;
            padding-top: 6px;
            border-top: 2px solid #000000;
            margin-top: 4px;
          }
          .grand-label {
            font-weight: 900;
          }
          .grand-price {
            font-size: 17px;
            font-weight: 900;
          }
          .vat-section {
            font-size: 10.5px;
            color: #334155;
            padding: 2px 0;
          }
          .vat-header {
            font-weight: 900;
            color: #1e293b;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 2px;
          }
          .vat-row {
            margin-top: 2px;
          }
          .social-section {
            font-size: 11px;
            text-align: center;
            color: #334155;
            padding: 2px 0;
          }
          .social-line {
            margin-bottom: 2px;
          }
          .footer-msg {
            text-align: center;
            font-weight: 900;
            font-size: 12.5px;
            color: #000000;
            padding: 6px 0 4px 0;
          }
          .barcode-container {
            text-align: center;
            padding: 4px 0;
          }
          .barcode-bars {
            height: 24px;
          }
          .barcode-text {
            font-size: 9px;
            font-family: monospace;
            letter-spacing: 1.5px;
            margin-top: 2px;
          }
          .zigzag-edge {
            height: 8px;
            overflow: hidden;
            display: flex;
            justify-content: center;
            margin-top: 6px;
          }
          .zigzag-tooth {
            width: 8px;
            height: 8px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            transform: rotate(45deg) translateY(-4px);
            flex-shrink: 0;
            margin-right: 2px;
          }

          /* KITCHEN SPECIFIC STYLES */
          .additional-order-banner {
            background: #dc2626;
            color: #ffffff;
            text-align: center;
            padding: 6px 4px;
            font-weight: 900;
            font-size: 13.5px;
            border-radius: 4px;
            margin-bottom: 2px;
            letter-spacing: 0.5px;
          }
          .additional-order-sub {
            background: #b91c1c;
            color: #fef2f2;
            text-align: center;
            padding: 2px 4px 4px 4px;
            font-size: 10px;
            font-weight: 700;
            border-radius: 0 0 4px 4px;
            margin-bottom: 6px;
          }
          .kitchen-header {
            text-align: center;
            padding: 6px;
            background: #0f172a;
            color: #ffffff;
            border-radius: 4px;
            margin-bottom: 6px;
          }
          .station-title {
            font-size: 14px;
            font-weight: 900;
            color: #F5C877;
          }
          .chef-callout {
            font-size: 11px;
            font-weight: bold;
            margin-top: 2px;
          }
          .kitchen-meta {
            border: 2px solid #0f172a;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 6px;
          }
          .meta-table {
            font-size: 15px;
            font-weight: 900;
            color: #000000;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 11.5px;
            margin-top: 3px;
          }
          .order-no {
            font-size: 10px;
            font-weight: bold;
            color: #475569;
            margin-top: 2px;
          }
          .delivery-box {
            border: 1.5px dashed #ea580c;
            background: #fff7ed;
            padding: 5px;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 10.5px;
          }
          .delivery-title {
            font-weight: 900;
            color: #c2410c;
          }
          .items-title {
            font-size: 11px;
            font-weight: 900;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 4px;
          }
          .kitchen-item-card {
            border-bottom: 1.5px dashed #64748b;
            padding: 6px 0;
          }
          .item-name-line {
            font-size: 15px;
            font-weight: 900;
            color: #000000;
          }
          .station-badge {
            display: inline-block;
            background: #0f172a;
            color: #F5C877;
            font-size: 10px;
            font-weight: 900;
            padding: 2px 6px;
            border-radius: 3px;
            margin-top: 3px;
          }
          .gift-callout {
            color: #dc2626;
            font-weight: 900;
            font-size: 10.5px;
            margin-top: 3px;
          }
          .chef-note {
            background: #fef08a;
            border-left: 3px solid #ca8a04;
            padding: 3px 6px;
            margin-top: 4px;
            font-size: 11px;
            font-weight: 900;
            color: #854d0e;
          }
          .order-note-box {
            border: 1.5px solid #dc2626;
            background: #fef2f2;
            padding: 5px;
            border-radius: 4px;
            margin-top: 6px;
            font-size: 11px;
            color: #991b1b;
            font-weight: bold;
          }
          .plain-raw {
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {}
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 2500);
    }, 300);
  }

  /**
   * Kasa ve garsonlardan mutfağa gönderilen siparişleri
   * ilgili mutfak/istasyon yazıcılarına (Fırın, Kebap Ocağı, Bar vb.) yönlendirir.
   * AYNI ANDA GİRİLEN SİPARİŞLER AYNI YAZICI İÇİN TEK FİŞTE TOPLANIR.
   * Sonradan girilen ilave siparişler ise ayrı fiş olarak basılır.
   */
  public async printKitchenTickets(
    table: { id: string; name: string; sectionId?: string; customerInfo?: any; order?: any },
    items: OrderItemState[],
    waiterName: string = 'Garson',
    orderNote?: string,
    isAdditionalOrder?: boolean
  ): Promise<{ success: boolean; dispatchedCount: number; details: string[] }> {
    if (!items || items.length === 0) {
      return { success: false, dispatchedCount: 0, details: ['Yazdırılacak ürün yok'] };
    }

    const printers = restaurantDataService.getPrinters();
    if (!printers || printers.length === 0) {
      return { success: false, dispatchedCount: 0, details: ['Tanımlı yazıcı bulunmuyor.'] };
    }

    const categories = restaurantDataService.getCategories();
    const products = restaurantDataService.getProducts();
    const sections = restaurantDataService.getSections();

    const tableSection = sections.find(s => s.id === table.sectionId);
    const fullTableName = tableSection ? `${tableSection.name} / ${table.name}` : table.name;

    // Yazıcı bazlı gruplama yapısı (Aynı yazıcıya gidenler TEK fişte toplanır)
    interface PrinterGroup {
      targetPrinter: PrinterConfig;
      stations: Set<string>;
      items: KitchenTicketItem[];
    }

    const printerGroups = new Map<string, PrinterGroup>();

    // Varsayılan roller
    const ocakPrinter =
      printers.find(p => p.role?.toLowerCase().includes('ocak') || p.name.toLowerCase().includes('ocak')) ||
      printers.find(p => p.assignedStations?.includes('OCAK')) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    const firinPrinter =
      printers.find(
        p =>
          p.role?.toLowerCase().includes('fırın') ||
          p.role?.toLowerCase().includes('firin') ||
          p.name.toLowerCase().includes('fırın') ||
          p.name.toLowerCase().includes('firin')
      ) ||
      printers.find(p => p.assignedStations?.includes('FIRIN')) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    const barPrinter =
      printers.find(p => p.role?.toLowerCase().includes('bar') || p.name.toLowerCase().includes('bar')) ||
      printers.find(p => p.assignedStations?.includes('BAR')) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    const mutfakPrinter =
      printers.find(p => p.role?.toLowerCase().includes('mutfak') || p.name.toLowerCase().includes('mutfak')) ||
      printers.find(p => p.assignedStations?.includes('MUTFAK')) ||
      printers.find(p => p.printAllKitchen) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    for (const item of items) {
      const prod = products.find(p => p.id === item.productId || p.name === item.productName);
      const cat = prod ? categories.find(c => c.id === prod.categoryId) : undefined;

      const stationInfo = determineStationForProduct(item.productName, cat?.name);

      // Hedef yazıcı belirleme sırası:
      // 1. Ürün seviyesinde özel tanımlanmış yazıcı
      let assignedPrinter: PrinterConfig | undefined;
      if (prod?.printerId) {
        assignedPrinter = printers.find(p => p.id === prod.printerId);
      }

      // 2. Kategori seviyesinde atanmış yazıcı
      if (!assignedPrinter && cat?.printerId) {
        assignedPrinter = printers.find(p => p.id === cat.printerId);
      }

      // 3. Yazıcı ayarlarında atanmış kategoriler
      if (!assignedPrinter && cat?.id) {
        assignedPrinter = printers.find(p => p.assignedCategoryIds?.includes(cat.id));
      }

      // 4. Yazıcı ayarlarında atanmış istasyon (OCAK, FIRIN, BAR, MUTFAK)
      if (!assignedPrinter) {
        assignedPrinter = printers.find(p => p.assignedStations?.includes(stationInfo.stationKey as any));
      }

      // 5. İstasyon türüne göre eşleşme
      if (!assignedPrinter) {
        if (stationInfo.stationKey === 'OCAK') assignedPrinter = ocakPrinter;
        else if (stationInfo.stationKey === 'FIRIN') assignedPrinter = firinPrinter;
        else if (stationInfo.stationKey === 'BAR') assignedPrinter = barPrinter;
        else assignedPrinter = mutfakPrinter;
      }

      // 6. Genel mutfak yazıcısı veya ilk tanımlı yazıcı
      if (!assignedPrinter) {
        assignedPrinter = printers.find(p => p.printAllKitchen) || printers.find(p => p.isKitchen) || printers[0];
      }

      // AYNI YAZICIYA GİDEN TÜM SİPARİŞLER TEK FİŞTE BİRLEŞİR
      const groupKey = assignedPrinter.id;

      if (!printerGroups.has(groupKey)) {
        printerGroups.set(groupKey, {
          targetPrinter: assignedPrinter,
          stations: new Set<string>(),
          items: [],
        });
      }

      const group = printerGroups.get(groupKey)!;
      group.stations.add(stationInfo.stationKey);
      group.items.push({
        name: item.productName,
        quantity: Number(item.quantity) || 1,
        note: item.note,
        price: Number(item.price) || 0,
        chefStation: stationInfo.chefTitle,
        isGift: item.isGift,
      });
    }

    let dispatchedCount = 0;
    const details: string[] = [];
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const orderNumber = table.order?.orderNumber || 841;

    for (const group of printerGroups.values()) {
      let mainStation: 'OCAK' | 'FIRIN' | 'MUTFAK' | 'BAR' | 'GENEL' = 'GENEL';
      let title = group.targetPrinter.name.toUpperCase();
      let chefCallout = group.targetPrinter.name;

      if (group.stations.size === 1) {
        const s = Array.from(group.stations)[0];
        if (s === 'OCAK') {
          mainStation = 'OCAK';
          title = 'OCAK / IZGARA SİPARİŞİ';
          chefCallout = 'OCAKÇI VE IZGARA USTASI';
        } else if (s === 'FIRIN') {
          mainStation = 'FIRIN';
          title = 'FIRIN / LAHMACUN SİPARİŞİ';
          chefCallout = 'FIRIN VE PİDE USTASI';
        } else if (s === 'BAR') {
          mainStation = 'BAR';
          title = 'BAR / İÇECEK SİPARİŞİ';
          chefCallout = 'BAR & SERVİS';
        } else {
          mainStation = 'MUTFAK';
          title = 'MUTFAK / MEZE SİPARİŞİ';
          chefCallout = 'MUTFAK ŞEFİ';
        }
      } else {
        title = `${group.targetPrinter.name.toUpperCase()} SİPARİŞİ`;
        chefCallout = `${group.targetPrinter.name} USTASI`;
      }

      if (isAdditionalOrder) {
        title = `[İLAVE] ${title}`;
      }

      const ticketData: KitchenTicketData = {
        ticketTitle: title,
        chefStation: mainStation,
        chefStationTitle: chefCallout,
        tableName: fullTableName,
        waiterName: waiterName || table.order?.waiterName || 'Mehmet Usta',
        orderTime: currentTime,
        orderNumber,
        orderNote: orderNote || table.order?.orderNote || '',
        isAdditionalOrder,
        customerInfo: table.customerInfo,
        items: group.items,
      };

      const result = await this.dispatchPrintJob(group.targetPrinter, 'KITCHEN', ticketData);
      if (result.success) {
        dispatchedCount++;
        details.push(`${group.targetPrinter.name} (${group.items.length} kalem)`);
      }
    }

    restaurantDataService.playAudioAlert('kitchen');

    return {
      success: dispatchedCount > 0,
      dispatchedCount,
      details,
    };
  }

  /**
   * Masanın adisyon / hesap kapatma fişini şablona tam uyumlu olarak kasa yazıcısına gönderir
   */
  public async printBill(
    table: { id: string; name: string; sectionId?: string; customerInfo?: any; order?: any },
    items: OrderItemState[],
    payments?: any[]
  ): Promise<{ success: boolean; message: string }> {
    const printers = restaurantDataService.getPrinters();
    const settings = restaurantDataService.getReceiptSettings();
    const sections = restaurantDataService.getSections();

    const billPrinter =
      printers.find(p => p.isBillPrinter) ||
      printers.find(p => p.role?.toLowerCase().includes('kasa') || p.name.toLowerCase().includes('kasa')) ||
      printers.find(p => !p.isKitchen) ||
      printers[0];

    if (!billPrinter) {
      return { success: false, message: 'Kasa hesap yazıcısı tanımlı değil.' };
    }

    const tableSection = sections.find(s => s.id === table.sectionId);
    const fullTableName = tableSection ? `${tableSection.name} / ${table.name}` : table.name;

    // Kalemlerin toplamı
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // İskonto / İkram tutarı tespiti
    let discountAmount = 0;
    let discountReason = '';

    // İkram kalemleri
    const giftTotal = items
      .filter(i => i.isGift)
      .reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
    if (giftTotal > 0) {
      discountAmount += giftTotal;
      discountReason = 'İkram Ürün';
    }

    // Ödeme girişlerindeki iskonto/ikram
    if (Array.isArray(payments)) {
      payments.forEach(p => {
        const typeLower = (p.type || '').toLowerCase();
        if (typeLower.includes('indirim') || typeLower.includes('iskonto') || typeLower.includes('ikram')) {
          discountAmount += Number(p.amount) || 0;
          discountReason = p.type;
        }
      });
    }

    const grandTotal = Math.max(0, subtotal - discountAmount);
    const discountPercent = subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : undefined;
    const vatBase = grandTotal / 1.1;
    const vatAmount = grandTotal - vatBase;
    const orderNumber = table.order?.orderNumber || 841;

    const billData: BillReceiptData = {
      settings,
      restaurantName: settings.title || 'GAZİANTEPLİ TAHA USTA',
      tableName: fullTableName,
      waiterName: table.order?.waiterName || 'Mehmet Usta',
      orderTime: `${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      orderNumber,
      customerInfo: table.customerInfo,
      items: items.map(i => ({
        name: i.productName,
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
        totalPrice: (Number(i.price) || 0) * (Number(i.quantity) || 1),
        note: i.note,
        isGift: i.isGift,
      })),
      subtotal,
      discountAmount,
      discountPercent,
      discountReason,
      totalAmount: grandTotal,
      vatRate: 10,
      vatBase,
      vatAmount,
    };

    return await this.dispatchPrintJob(billPrinter, 'BILL', billData);
  }

  /**
   * Ayarlar sekmesindeki "Test Çıktısı Al" butonu için şablona birebir örnek adisyon basar
   */
  public async printTestBill(customSettings?: ReceiptSettingsConfig): Promise<{ success: boolean; message: string }> {
    const printers = restaurantDataService.getPrinters();
    const settings = customSettings || restaurantDataService.getReceiptSettings();

    const billPrinter =
      printers.find(p => p.isBillPrinter) ||
      printers.find(p => p.role?.toLowerCase().includes('kasa') || p.name.toLowerCase().includes('kasa')) ||
      printers.find(p => !p.isKitchen) ||
      printers[0];

    if (!billPrinter) {
      return { success: false, message: 'Kasa adisyon yazıcısı tanımlı değil.' };
    }

    const sampleItems: BillReceiptItem[] = [
      { name: 'Adana Kebap (Porsiyon)', quantity: 1, price: 280, totalPrice: 280, note: 'Acılı, köz biberli' },
      { name: 'Lahmacun (Antep Usulü)', quantity: 2, price: 90, totalPrice: 180 },
      { name: 'Yayık Ayran (300ml)', quantity: 2, price: 40, totalPrice: 80 },
      { name: 'Antep Katmeri', quantity: 1, price: 160, totalPrice: 160 },
    ];

    const subtotal = 700;
    const discountAmount = 35;
    const grandTotal = 665;
    const vatBase = 604.55;
    const vatAmount = 60.45;

    const testBillData: BillReceiptData = {
      settings,
      restaurantName: settings.title,
      tableName: 'Ana Salon / Masa 4',
      waiterName: 'Mehmet Usta',
      orderTime: `${new Date().toLocaleDateString('tr-TR')} - 19:42`,
      orderNumber: 841,
      items: sampleItems,
      subtotal,
      discountAmount,
      discountPercent: 5,
      totalAmount: grandTotal,
      vatRate: 10,
      vatBase,
      vatAmount,
    };

    return await this.dispatchPrintJob(billPrinter, 'BILL', testBillData);
  }

  /**
   * Afanda 892E & Win32 Spooler donanım doğrulama ve ESC/POS çekmece/kesici test fişi döker
   */
  public async printHardwareTest(printer: PrinterConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Yerel REST API (port 4545) üzerinden donanım testi
      const response = await fetch('http://localhost:4545/api/printers/test-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer }),
      });
      if (response.ok) {
        const res = await response.json();
        if (res.success) {
          return { success: true, message: res.message || `[${printer.name}] donanım testi başarıyla yazdırıldı.` };
        }
      }
    } catch (e) {}

    // 2. Electron IPC üzerinden test
    try {
      const win = window as any;
      if (win.require) {
        const { ipcRenderer } = win.require('electron');
        const res = await ipcRenderer.invoke('print-hardware-test', {
          printerName: printer.driverName || printer.usbName || printer.name,
          type: printer.type,
          ip: printer.ipAddress,
          port: printer.port || 9100,
        });
        if (res && res.success) {
          return { success: true, message: `[${printer.name}] donanım test çıktısı döküldü.` };
        }
      }
    } catch (e) {}

    // 3. Fallback standart test fişi
    const testTicket = {
      ticketTitle: `${printer.name.toUpperCase()} TEST FISI`,
      tableName: 'TEST MASASI',
      waiterName: 'Kasa',
      orderTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      items: [{ name: 'Donanım & Test Çıktısı', quantity: 1, note: 'Tamamlandı' }],
      orderNote: 'Yazıcı ve kağıt kesici devrede.'
    };
    return await this.dispatchPrintJob(printer, 'KITCHEN', testTicket);
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

  /**
   * Online Yemek Platformları (Yemeksepeti, Trendyol, Getir) Sipariş Çıktısı
   * Lahmacun/Pide fırın yazıcısına, kebaplar ocak yazıcısına, tam kurye fişi ise teslimat yazıcısına otomatik gönderilir.
   */
  public async printOnlineOrder(order: {
    platform: 'YEMEKSEPETI' | 'TRENDYOL' | 'GETIR' | string;
    platformOrderId: string;
    customerName: string;
    customerPhone?: string;
    address: string;
    orderNote?: string;
    items: { name: string; quantity: number; price?: number; note?: string }[];
    totalAmount: number;
    paymentMethod: string;
    deliveryModel?: 'RESTAURANT_COURIER' | 'PLATFORM_COURIER' | 'RESTAURANT' | 'PLATFORM';
    assignedCourierName?: string;
    platformCourierName?: string;
    platformCourierPhone?: string;
    handoverCode?: string;
  }): Promise<{ success: boolean; dispatchedCount: number; details: string[] }> {
    const printers = restaurantDataService.getPrinters();
    const details: string[] = [];
    let dispatchedCount = 0;

    if (!printers || printers.length === 0) {
      return { success: false, dispatchedCount: 0, details: ['Tanımlı yazıcı bulunamadı'] };
    }

    const platformNames: Record<string, string> = {
      YEMEKSEPETI: 'YEMEKSEPETİ',
      TRENDYOL: 'TRENDYOL YEMEK',
      GETIR: 'GETİRYEMEK',
    };
    const pTitle = platformNames[order.platform] || order.platform;

    // 1. Ürünleri istasyonlara ayrıştır
    const firinItems: KitchenTicketItem[] = [];
    const ocakItems: KitchenTicketItem[] = [];
    const digerMutfakItems: KitchenTicketItem[] = [];

    for (const it of order.items) {
      const station = determineStationForProduct(it.name);
      const ticketItem: KitchenTicketItem = {
        name: it.name,
        quantity: it.quantity,
        note: it.note,
        price: it.price,
      };

      if (station.stationKey === 'FIRIN') {
        firinItems.push(ticketItem);
      } else if (station.stationKey === 'OCAK') {
        ocakItems.push(ticketItem);
      } else {
        digerMutfakItems.push(ticketItem);
      }
    }

    // Yazıcıları bul
    const firinPrinter =
      printers.find(p => p.role?.toLowerCase().includes('fırın') || p.name.toLowerCase().includes('fırın') || p.name.toLowerCase().includes('firin')) ||
      printers.find(p => p.assignedStations?.includes('FIRIN')) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    const ocakPrinter =
      printers.find(p => p.role?.toLowerCase().includes('ocak') || p.name.toLowerCase().includes('ocak')) ||
      printers.find(p => p.assignedStations?.includes('OCAK')) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    const kuryePrinter =
      printers.find(p => p.isDeliveryPrinter) ||
      printers.find(p => p.isBillPrinter) ||
      printers.find(p => p.role?.toLowerCase().includes('kasa') || p.name.toLowerCase().includes('kasa')) ||
      printers[0];

    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // A) Fırın Fişi (Lahmacun & Pide)
    if (firinItems.length > 0 && firinPrinter) {
      const firinData: KitchenTicketData = {
        ticketTitle: `${pTitle} - FIRIN SİPARİŞİ`,
        chefStation: 'FIRIN',
        chefStationTitle: 'FIRIN USTASI (PİDE & LAHMACUN)',
        tableName: `ONLINE: #${order.platformOrderId}`,
        waiterName: pTitle,
        orderTime: nowTime,
        orderNumber: order.platformOrderId,
        orderNote: order.orderNote,
        items: firinItems,
      };
      await this.dispatchPrintJob(firinPrinter, 'KITCHEN', firinData);
      dispatchedCount++;
      details.push(`Fırın Yazıcısı [${firinPrinter.name}]: ${firinItems.length} çeşit pide/lahmacun basıldı.`);
    }

    // B) Ocak Fişi (Kebap & Izgara)
    if (ocakItems.length > 0 && ocakPrinter) {
      const ocakData: KitchenTicketData = {
        ticketTitle: `${pTitle} - OCAK SİPARİŞİ`,
        chefStation: 'OCAK',
        chefStationTitle: 'KEBAP & IZGARA OCAĞI',
        tableName: `ONLINE: #${order.platformOrderId}`,
        waiterName: pTitle,
        orderTime: nowTime,
        orderNumber: order.platformOrderId,
        orderNote: order.orderNote,
        items: ocakItems,
      };
      await this.dispatchPrintJob(ocakPrinter, 'KITCHEN', ocakData);
      dispatchedCount++;
      details.push(`Ocak Yazıcısı [${ocakPrinter.name}]: ${ocakItems.length} çeşit kebap basıldı.`);
    }

    // C) Lojistik & Kurye Çıktısı (Restoran Kuryesi Yol Fişi vs. Platform Kuryesi 4 Haneli Paket Etiketi)
    if (kuryePrinter) {
      const isPlatformCourier = order.deliveryModel === 'PLATFORM_COURIER' || order.deliveryModel === 'PLATFORM';
      const cleanHandoverCode = order.handoverCode || (order.platformOrderId ? order.platformOrderId.replace(/[^0-9]/g, '').slice(-4) : '1842');

      const billData: BillReceiptData = {
        tableName: `${pTitle} (#${order.platformOrderId})`,
        waiterName: isPlatformCourier ? 'Platform Kuryesi' : (order.assignedCourierName || 'Kendi Kuryemiz'),
        orderTime: nowTime,
        orderNumber: order.platformOrderId,
        platformName: pTitle,
        isCourierTicket: !isPlatformCourier,
        isHandoverTicket: isPlatformCourier,
        courierName: isPlatformCourier ? (order.platformCourierName || `${pTitle} Kuryesi`) : (order.assignedCourierName || 'Kendi Kuryemiz'),
        handoverCode: cleanHandoverCode,
        paymentMethod: order.paymentMethod,
        customerInfo: {
          name: order.customerName,
          phone: order.customerPhone || 'Belirtilmedi',
          address: order.address,
          note: order.orderNote || 'Not yok',
        },
        items: order.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price || 0,
          totalPrice: (i.quantity || 1) * (i.price || 0),
          note: i.note,
        })),
        subtotal: order.totalAmount,
        totalAmount: order.totalAmount,
      };
      await this.dispatchPrintJob(kuryePrinter, 'BILL', billData);
      dispatchedCount++;
      if (isPlatformCourier) {
        details.push(`Paket Etiketi [${kuryePrinter.name}]: 4 Haneli Teslimat Kodu (#${cleanHandoverCode}) basıldı.`);
      } else {
        details.push(`Kurye Yol Fişi [${kuryePrinter.name}]: Kurye zimmet ve yol fişi basıldı.`);
      }
    }

    return {
      success: dispatchedCount > 0,
      dispatchedCount,
      details,
    };
  }
}

export const printerService = new PrinterService();

// Garsonların mobilden girdiği siparişleri otomatik mutfak yazıcılarına yönlendir
restaurantDataService.onKitchenOrderPrint((table, items, waiterName, orderNote, isAdditionalOrder) => {
  printerService.printKitchenTickets(table, items, waiterName, orderNote, isAdditionalOrder);
});

// Garsonların mobilden hesap istediği masaların hesap fişini otomatik kasaya dök
restaurantDataService.onBillRequestPrint((table, items) => {
  printerService.printBill(table, items);
});
