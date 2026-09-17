/**
 * GCallerID 2Hat (Gentema Mühendislik) Donanım Sürücüsü
 * ----------------------------------------------------
 * USB üzerinden Sanal COM Port (RS-232 / Seri Port) ve
 * HTTP Webhook / URL Yönlendirme desteği ile 2 Hatlı arayan numara tespiti.
 */

import { EventEmitter } from 'events';

export interface CallerIdEvent {
  id: string;
  line: 1 | 2;
  phone: string;
  raw: string;
  timestamp: string;
}

export class GCallerIdDriver extends EventEmitter {
  private activePort: any = null;
  private currentPortName: string = 'AUTO';
  private baudRate: number = 9600;
  private isConnected: boolean = false;
  private buffer: string = '';

  constructor() {
    super();
  }

  /**
   * Sistemdeki COM portlarını listeler
   */
  public async listAvailablePorts(): Promise<Array<{ path: string; manufacturer?: string; pnpId?: string }>> {
    try {
      // Dinamik import ile serialport yüklenmeye çalışılır (native kütüphane esnekliği)
      // @ts-ignore
      const { SerialPort } = await import(/* @vite-ignore */ 'serialport');
      const ports = await SerialPort.list();
      return ports.map((p: any) => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Bilinmiyor',
        pnpId: p.pnpId || ''
      }));
    } catch (e) {
      console.warn('⚠️ [GCallerID] SerialPort listesi alınamadı veya modül kurulu değil:', e);
      return [];
    }
  }

  /**
   * COM portuna bağlanır veya Otomatik Algılama yapar
   */
  public async connect(portName: string = 'AUTO'): Promise<{ success: boolean; message: string }> {
    this.currentPortName = portName;

    try {
      // @ts-ignore
      const { SerialPort } = await import(/* @vite-ignore */ 'serialport');
      // @ts-ignore
      const { ReadlineParser } = await import(/* @vite-ignore */ '@serialport/parser-readline');

      let targetPort = portName;
      if (portName === 'AUTO') {
        const ports = await SerialPort.list();
        // Gentema, FTDI, Prolific veya CH340 gibi sanal COM aygıtlarını bul
        const found = ports.find((p: any) => 
          (p.manufacturer && /gentema|ftdi|prolific|ch340|silicon/i.test(p.manufacturer)) ||
          (p.pnpId && /usb/i.test(p.pnpId))
        );
        if (found) {
          targetPort = found.path;
        } else if (ports.length > 0) {
          targetPort = ports[0].path;
        } else {
          return { success: false, message: 'Takılı GCallerID veya COM portu bulunamadı.' };
        }
      }

      if (this.activePort && this.activePort.isOpen) {
        this.activePort.close();
      }

      this.activePort = new SerialPort({
        path: targetPort,
        baudRate: this.baudRate,
        autoOpen: true
      });

      const parser = this.activePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.activePort.on('open', () => {
        this.isConnected = true;
        console.log(`🔌 [GCallerID 2Hat] Port açıldı: ${targetPort} @ ${this.baudRate}bps`);
        this.emit('status', { connected: true, port: targetPort });
      });

      this.activePort.on('error', (err: any) => {
        this.isConnected = false;
        console.error(`❌ [GCallerID] Port hatası:`, err);
        this.emit('error', err);
      });

      this.activePort.on('close', () => {
        this.isConnected = false;
        console.log(`🔌 [GCallerID] Port kapandı.`);
        this.emit('status', { connected: false, port: targetPort });
      });

      parser.on('data', (line: string) => {
        this.parseRawData(line);
      });

      return { success: true, message: `${targetPort} portuna bağlanıldı.` };
    } catch (e: any) {
      this.isConnected = false;
      return { success: false, message: `Seri port bağlantı hatası: ${e.message}` };
    }
  }

  /**
   * Gelen ham metni GCallerID formatlarına göre çözümler
   * Desteklenen formatlar:
   * 1. [H:1, T:05321234567] veya [H:2, T:05551234567]
   * 2. CID:1,05321234567...
   * 3. HAT: 1, TEL: 05321234567
   * 4. L1:0532... / L2:0532...
   * 5. Salt telefon dizgileri
   */
  public parseRawData(rawData: string): CallerIdEvent | null {
    if (!rawData || rawData.trim().length === 0) return null;
    const str = rawData.trim();
    console.log(`📞 [GCallerID Ham Veri]:`, str);

    let line: 1 | 2 = 1;
    let phone = '';

    // 1. Regex: [H:1, T:05XXXXXXXXX] veya [H:2, ...]
    const regexGentema = /\[H:([12]),\s*T:([0-9+]+)\]/i;
    const matchGentema = str.match(regexGentema);
    if (matchGentema) {
      line = matchGentema[1] === '2' ? 2 : 1;
      phone = matchGentema[2];
    } else {
      // 2. Regex: CID:1,0532... veya CID:2,0532...
      const regexCID = /CID:([12]),?([0-9+]+)/i;
      const matchCID = str.match(regexCID);
      if (matchCID) {
        line = matchCID[1] === '2' ? 2 : 1;
        phone = matchCID[2];
      } else {
        // 3. Regex: HAT: 1 veya HAT: 2
        const regexHat = /(?:HAT|LINE|L)[:\s]*([12])/i;
        const matchHat = str.match(regexHat);
        if (matchHat) {
          line = matchHat[1] === '2' ? 2 : 1;
        }

        // Telefon numarasını ayıkla
        const phoneMatch = str.match(/(?:05|5|\+905)[0-9]{8,9}|0[2-4][0-9]{8,9}/);
        if (phoneMatch) {
          phone = phoneMatch[0];
        }
      }
    }

    // Telefon numarasını temizle (0532XXXXXXX standart Türkiye formatına getir)
    phone = this.cleanPhoneNumber(phone);

    if (phone && phone.length >= 10) {
      const event: CallerIdEvent = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        line,
        phone,
        raw: str,
        timestamp: new Date().toISOString()
      };
      console.log(`🔔 [GCallerID Çağrı Yakalandı] HAT ${line} -> ${phone}`);
      this.emit('call', event);
      return event;
    }

    return null;
  }

  /**
   * HTTP Webhook / URL Yönlendirme aracından gelen çağrıyı işler
   */
  public handleHttpWebhook(lineParam: any, phoneParam: any): CallerIdEvent | null {
    let line: 1 | 2 = 1;
    const lStr = String(lineParam || '1').trim();
    if (lStr === '2' || lStr.toLowerCase().includes('hat2') || lStr.toLowerCase().includes('line2')) {
      line = 2;
    }

    const clean = this.cleanPhoneNumber(String(phoneParam || ''));
    if (clean && clean.length >= 10) {
      const event: CallerIdEvent = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        line,
        phone: clean,
        raw: `HTTP_WEBHOOK: Line=${line}, Phone=${clean}`,
        timestamp: new Date().toISOString()
      };
      this.emit('call', event);
      return event;
    }
    return null;
  }

  /**
   * Telefon numarasını standartlaştırır: 05XXXXXXXXX veya 02XXXXXXXXX
   */
  public cleanPhoneNumber(raw: string): string {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length === 12) {
      digits = '0' + digits.slice(2);
    } else if (digits.length === 10 && !digits.startsWith('0')) {
      digits = '0' + digits;
    }
    return digits;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      portName: this.currentPortName,
      baudRate: this.baudRate
    };
  }
}

export const gCallerIdDriver = new GCallerIdDriver();
