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
): { stationKey: 'OCAK' | 'FIRIN' | 'MUTFAK'; stationTitle: string; chefTitle: string } {
  const pLower = (productName || '').toLowerCase();
  const cLower = (categoryName || '').toLowerCase();

  // 1. FIRIN / PİDE & LAHMACUN (Taş fırında pişecekler)
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

  // 2. OCAK / KEBAP & IZGARA (Kebap ocağı ve ızgarada pişecekler)
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

  // 3. MUTFAK / MEZE & İÇECEK (Soğuk mezeler, çorbalar, salata ve içecekler)
  return {
    stationKey: 'MUTFAK',
    stationTitle: 'MUTFAK / MEZE & İÇECEK SİPARİŞİ',
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
      const s = data.settings || {};
      const title = s.title || data.restaurantName || 'GAZIANTEPLI TAHA USTA';
      const subtitle = s.subtitle || 'Kebap & Lahmacun Salonu';
      const address = s.address || 'Sehitkamil / Gaziantep';
      const phone = s.phone || '0 (342) 555 00 27';
      const taxOffice = s.taxOffice || 'Sehitkamil V.D.';
      const taxNumber = s.taxNumber || '1234567890';
      const mersisNo = s.mersisNo || '012345678900001';
      const orderNumber = data.orderNumber || 841;

      if (s.printLogo !== false) {
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
            return {
              success: true,
              message: `[${printer.name}] (${printer.ipAddress}) yazıcısına ağdan fiş iletildi.`,
            };
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
    const paperWidthPx = printer.paperWidth === 58 ? '260px' : '320px';

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
              s.printLogo !== false
                ? `<div class="logo-badge">TU</div>`
                : ''
            }
            <div class="brand-title">${s.title || 'GAZİANTEPLİ TAHA USTA'}</div>
            <div class="brand-subtitle">${s.subtitle || 'Kebap & Lahmacun Salonu'}</div>
            <div class="brand-sub">${s.address || 'Şehitkamil / Gaziantep'}</div>
            <div class="brand-sub">Tel: ${s.phone || '0 (342) 555 00 27'}</div>
            <div class="tax-info">
              ${s.taxOffice || 'Şehitkamil V.D.'} • VKN: ${s.taxNumber || '1234567890'}
              ${s.mersisNo ? ' • MERSİS: ' + s.mersisNo : ''}
            </div>
          </div>

          <div class="dashed-line"></div>

          <div class="meta-section">
            ${
              s.showTableNumber !== false
                ? `<div class="row"><span>MASA:</span><span class="bold">${data.tableName}</span></div>`
                : ''
            }
            ${
              s.showWaiterName !== false
                ? `<div class="row"><span>GARSON:</span><span>${data.waiterName || 'Mehmet Usta'}</span></div>`
                : ''
            }
            ${
              s.showOrderTime !== false
                ? `<div class="row"><span>TARİH & SAAT:</span><span>${data.orderTime}</span></div>`
                : ''
            }
            <div class="row"><span>ADİSYON NO:</span><span class="bold">#GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}</span></div>
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
                <div class="item-row">
                  <div class="item-left">
                    <div class="item-name">${qty}x ${it.name || it.productName}${it.isGift ? ' <span class="gift-badge">[İKRAM]</span>' : ''}</div>
                    ${it.note ? `<div class="item-sub">* ${it.note}</div>` : ''}
                    ${qty > 1 ? `<div class="item-sub">${qty} x ₺${price.toFixed(2)}</div>` : ''}
                  </div>
                  <div class="item-right">₺${total.toFixed(2)}</div>
                </div>
              `;
              })
              .join('')}
          </div>

          <div class="dashed-line"></div>

          <div class="totals-section">
            <div class="row">
              <span>Ara Toplam:</span>
              <span>₺${subtotal.toFixed(2)}</span>
            </div>
            ${
              discount > 0
                ? `
              <div class="row discount">
                <span>İkram & İndirim${data.discountPercent ? ` (%${data.discountPercent})` : ''}:</span>
                <span>-₺${discount.toFixed(2)}</span>
              </div>
            `
                : ''
            }
            <div class="row grand-total">
              <span>GENEL TOPLAM:</span>
              <span class="grand-price">₺${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          ${
            s.showVatDetails !== false
              ? `
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
            <div class="social-section">
              ${
                s.wifiName
                  ? `<div class="social-line">📶 Wi-Fi: <b>${s.wifiName}</b> | Şifre: <span class="mono">${s.wifiPassword || ''}</span></div>`
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

          <div class="footer-msg">
            ${s.footerMessage || 'Afiyet Olsun. Yine Bekleriz!'}
          </div>

          ${
            s.showBarcode !== false
              ? `
            <div class="barcode-container">
              <div class="barcode-bars">
                ${[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1]
                  .map(
                    w =>
                      `<div style="background-color:#0f172a; height:24px; width:${w}px; display:inline-block; margin-right:1px;"></div>`
                  )
                  .join('')}
              </div>
              <div class="barcode-text">GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}-KASA</div>
            </div>
          `
              : ''
          }

          <div class="zigzag-edge">
            ${Array.from({ length: 28 })
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
            ${Array.from({ length: 28 })
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
          @page { size: ${printer.paperWidth === 58 ? '58mm' : '80mm'} auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 4px;
            background: #fff;
            color: #000;
            font-size: 11px;
            line-height: 1.25;
          }
          .receipt-container, .kitchen-container {
            width: 100%;
            max-width: ${paperWidthPx};
            margin: 0 auto;
            padding: 4px;
          }
          .header { text-align: center; margin-bottom: 6px; }
          .logo-badge {
            width: 32px; height: 32px; margin: 0 auto 4px auto;
            background: #0f172a; color: #F5C877; border-radius: 50%;
            font-weight: 900; font-size: 14px; line-height: 32px; text-align: center;
          }
          .brand-title { font-weight: 900; font-size: 12.5px; text-transform: uppercase; color: #020617; }
          .brand-subtitle { font-size: 10px; font-weight: bold; color: #475569; }
          .brand-sub { font-size: 9px; color: #475569; }
          .tax-info { font-size: 8.5px; color: #64748b; margin-top: 2px; }

          .dashed-line { border-bottom: 1px dashed #64748b; margin: 5px 0; }
          .meta-section { font-size: 10px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .bold { font-weight: 900; color: #020617; }

          .items-table { margin: 4px 0; }
          .table-header { display: flex; justify-content: space-between; font-weight: 900; font-size: 9.5px; color: #475569; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10.5px; }
          .item-left { max-width: 75%; }
          .item-name { font-weight: bold; color: #020617; }
          .gift-badge { color: #dc2626; font-size: 9px; font-weight: 900; }
          .item-sub { font-size: 9px; color: #64748b; margin-top: 1px; }
          .item-right { font-weight: bold; white-space: nowrap; }

          .totals-section { padding: 4px 0; border-bottom: 2px solid #0f172a; font-size: 11px; }
          .discount { color: #047857; font-weight: bold; }
          .grand-total { font-weight: 900; font-size: 13px; color: #020617; padding-top: 4px; border-top: 1px solid #cbd5e1; }
          .grand-price { font-size: 14px; }

          .vat-section { padding: 4px 0; border-bottom: 1px dashed #64748b; font-size: 8.5px; color: #475569; }
          .vat-header { font-weight: bold; color: #334155; }
          .vat-row { margin-top: 2px; }

          .social-section { padding: 5px 0; border-bottom: 1px dashed #64748b; text-align: center; font-size: 9.5px; }
          .social-line { margin-bottom: 2px; }
          .mono { font-family: monospace; font-weight: bold; }

          .footer-msg { text-align: center; padding: 6px 0 4px 0; font-weight: bold; font-size: 10.5px; color: #0f172a; }
          .barcode-container { text-align: center; padding: 4px 0; }
          .barcode-bars { height: 24px; }
          .barcode-text { font-size: 8.5px; font-family: monospace; letter-spacing: 1.5px; margin-top: 2px; }

          /* Mutfak Fişi Stilleri */
          .kitchen-header { text-align: center; padding: 5px; background: #0f172a; color: #fff; border-radius: 4px; margin-bottom: 6px; }
          .station-title { font-size: 13px; font-weight: 900; color: #F5C877; }
          .chef-callout { font-size: 10.5px; font-weight: bold; margin-top: 1px; }
          .kitchen-meta { border: 2px solid #0f172a; padding: 5px; border-radius: 4px; margin-bottom: 6px; }
          .meta-table { font-size: 14px; font-weight: 900; color: #020617; }
          .meta-info { display: flex; justify-content: space-between; font-size: 10.5px; margin-top: 2px; }
          .order-no { font-size: 9.5px; font-weight: bold; color: #64748b; margin-top: 2px; }

          .delivery-box { border: 1px dashed #ea580c; background: #fff7ed; padding: 4px; border-radius: 4px; margin-bottom: 6px; font-size: 9.5px; }
          .delivery-title { font-weight: 900; color: #c2410c; }

          .items-title { font-size: 10px; font-weight: 900; border-bottom: 2px solid #0f172a; padding-bottom: 2px; margin-bottom: 4px; }
          .kitchen-item-card { border-bottom: 1px dashed #64748b; padding: 5px 0; }
          .item-name-line { font-size: 14px; font-weight: 900; color: #020617; }
          .station-badge { display: inline-block; background: #0f172a; color: #F5C877; font-size: 8.5px; font-weight: 900; padding: 1px 4px; border-radius: 3px; margin-top: 2px; }
          .gift-callout { color: #dc2626; font-weight: 900; font-size: 9.5px; margin-top: 2px; }
          .chef-note { background: #fef08a; border-left: 3px solid #ca8a04; padding: 2px 4px; margin-top: 3px; font-size: 9.5px; font-weight: 900; color: #854d0e; }
          .order-note-box { border: 1.5px solid #dc2626; background: #fef2f2; padding: 4px; border-radius: 4px; margin-top: 5px; font-size: 10px; color: #991b1b; font-weight: bold; }

          .zigzag-edge { height: 8px; overflow: hidden; display: flex; justify-content: center; margin-top: 6px; }
          .zigzag-tooth { width: 8px; height: 8px; background: #fff; border: 1px solid #cbd5e1; transform: rotate(45deg) translateY(-4px); flex-shrink: 0; margin-right: 2px; }

          .plain-raw { white-space: pre-wrap; font-family: monospace; font-size: 11px; }
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
   * ilgili mutfak/istasyon yazıcılarına (Fırın, Kebap Ocağı, Bar vb.) ayrı ayrı böler ve basar.
   */
  public async printKitchenTickets(
    table: { id: string; name: string; sectionId?: string; customerInfo?: any; order?: any },
    items: OrderItemState[],
    waiterName: string = 'Garson',
    orderNote?: string
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

    // İstasyon grupları
    interface StationGroup {
      stationKey: 'OCAK' | 'FIRIN' | 'MUTFAK';
      stationTitle: string;
      chefTitle: string;
      targetPrinter: PrinterConfig;
      items: KitchenTicketItem[];
    }

    const stationGroups = new Map<string, StationGroup>();

    // Yazıcıları rollerine göre eşle
    const ocakPrinter =
      printers.find(p => p.role?.toLowerCase().includes('ocak') || p.name.toLowerCase().includes('ocak')) ||
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
      printers.find(p => p.isKitchen) ||
      printers[0];

    const mutfakPrinter =
      printers.find(
        p =>
          p.role?.toLowerCase().includes('mutfak') ||
          p.name.toLowerCase().includes('mutfak')
      ) ||
      printers.find(p => p.isKitchen) ||
      printers[0];

    for (const item of items) {
      const prod = products.find(p => p.id === item.productId || p.name === item.productName);
      const cat = prod ? categories.find(c => c.id === prod.categoryId) : undefined;

      const stationInfo = determineStationForProduct(item.productName, cat?.name);

      // Hedef yazıcı tespiti: Ürün özel yazıcısı > Kategori yazıcısı > İstasyon yazıcısı
      let assignedPrinter: PrinterConfig | undefined;
      if (prod?.printerId) {
        assignedPrinter = printers.find(p => p.id === prod.printerId);
      }
      if (!assignedPrinter && cat?.printerId) {
        assignedPrinter = printers.find(p => p.id === cat.printerId);
      }
      if (!assignedPrinter) {
        if (stationInfo.stationKey === 'OCAK') assignedPrinter = ocakPrinter;
        else if (stationInfo.stationKey === 'FIRIN') assignedPrinter = firinPrinter;
        else assignedPrinter = mutfakPrinter;
      }

      if (!assignedPrinter) {
        assignedPrinter = printers.find(p => p.isKitchen) || printers[0];
      }

      // Grup anahtarı: yazıcı ID'si + istasyon adı (ayrı fiş çıkması için)
      const groupKey = `${assignedPrinter.id}_${stationInfo.stationKey}`;

      if (!stationGroups.has(groupKey)) {
        stationGroups.set(groupKey, {
          stationKey: stationInfo.stationKey,
          stationTitle: stationInfo.stationTitle,
          chefTitle: stationInfo.chefTitle,
          targetPrinter: assignedPrinter,
          items: [],
        });
      }

      stationGroups.get(groupKey)!.items.push({
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

    for (const group of stationGroups.values()) {
      const ticketData: KitchenTicketData = {
        ticketTitle: group.stationTitle,
        chefStation: group.stationKey,
        chefStationTitle: group.chefTitle,
        tableName: fullTableName,
        waiterName: waiterName || table.order?.waiterName || 'Mehmet Usta',
        orderTime: currentTime,
        orderNumber,
        orderNote: orderNote || table.order?.orderNote || '',
        customerInfo: table.customerInfo,
        items: group.items,
      };

      const result = await this.dispatchPrintJob(group.targetPrinter, 'KITCHEN', ticketData);
      if (result.success) {
        dispatchedCount++;
        details.push(`${group.targetPrinter.name} - ${group.chefTitle} (${group.items.length} kalem)`);
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
