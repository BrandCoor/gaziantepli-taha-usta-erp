import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as os from 'os';
import {
  generateKitchenReceipt,
  generateBillReceipt,
  generateZReportReceipt,
  generateCancelReceipt,
  generateCourierReceipt,
  generateHardwareTestReceipt,
  sendToNetworkPrinter,
  sendToWindowsSpooler,
  listSystemPrinters,
  scanLocalNetworkPrinters
} from './printer';
import { gCallerIdDriver, CallerIdEvent } from './callerid/gcallerid';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const activeClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  activeClients.add(ws);
  // Bağlanan istemciye güncel durum bildir
  ws.send(JSON.stringify({ 
    type: 'CALLERID_STATUS', 
    status: gCallerIdDriver.getStatus() 
  }));
  ws.on('close', () => activeClients.delete(ws));
});

// GCallerID gelen çağrı olayını bağlı tüm istemcilere (POS / Kasa) WebSocket ile fırlat
gCallerIdDriver.on('call', (event: CallerIdEvent) => {
  const payload = JSON.stringify({ type: 'CALLER_ID', event });
  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
});

export function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// 1. AĞ VE ETHERNET YAZICILARI TARAMA
app.get('/api/printers/auto-scan', async (req, res) => {
  try {
    const found = await scanLocalNetworkPrinters();
    res.json({ success: true, printers: found });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. TEST FİŞİ GÖNDERME
app.post('/api/printers/test-print', async (req, res) => {
  try {
    const { ip, port, name } = req.body;
    const testBuffer = generateKitchenReceipt({
      ticketTitle: 'YAZICI BAGLANTI TESTI',
      tableName: 'TEST MASASI',
      waiterName: 'Kasa Terminali',
      orderTime: new Date().toLocaleTimeString('tr-TR'),
      items: [{ name: `${name || 'Afanda 892E'}`, quantity: 1, note: 'Baglanti Kusursuz' }],
    });

    const success = await sendToNetworkPrinter(ip, port || 9100, testBuffer);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GENEL FİŞ YAZDIRMA (Mutfak, Hesap, İptal)
app.post('/api/printers/print-ticket', async (req, res) => {
  try {
    const { printer, jobType, data } = req.body;
    if (!printer) {
      return res.status(400).json({ success: false, error: 'Yazıcı bilgisi eksik' });
    }

    // Satır genişliği kağıt boyutuna göre hesaplanır (80mm=48, 58mm=32 karakter).
    const ticketData = { ...(data || {}), paperWidth: printer.paperWidth || 80 };

    let buffer: Buffer;
    if (jobType === 'BILL') {
      buffer = generateBillReceipt(ticketData);
    } else if (jobType === 'CANCEL') {
      buffer = generateCancelReceipt(ticketData);
    } else if (jobType === 'Z_REPORT') {
      buffer = generateZReportReceipt(ticketData);
    } else if (jobType === 'COURIER' || jobType === 'PLATFORM') {
      buffer = generateCourierReceipt(ticketData);
    } else {
      buffer = generateKitchenReceipt(ticketData);
    }

    if (printer.type === 'NETWORK' && printer.ipAddress) {
      const success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
      return res.json({ success, message: success ? 'Ağ yazıcısına iletildi' : 'Yazıcıya bağlanılamadı' });
    }

    // USB / Windows Spooler Yazıcılar (Afanda 892E vb.)
    const spoolRes = await sendToWindowsSpooler(printer.driverName || printer.usbName || printer.name, buffer);
    res.json({ 
      success: spoolRes.success, 
      message: spoolRes.success ? 'Yazıcıya ve Windows Spooler kuyruğuna iletildi' : (spoolRes.error || 'Spooler kuyruğuna yazılamadı') 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.1 WINDOWS SPOOLER YAZICI LİSTESİ (Sistem Sürücüleri)
app.get('/api/printers/windows-printers', async (req, res) => {
  try {
    const list = await listSystemPrinters();
    res.json({ success: true, printers: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3.2 DONANIM TEST YAZDIRMASI (ESC/POS & Spooler Doğrulama)
app.post('/api/printers/test-hardware', async (req, res) => {
  try {
    const { printer } = req.body;
    const targetName = printer?.driverName || printer?.usbName || printer?.name || 'Afanda 892E';
    const buffer = generateHardwareTestReceipt(targetName);

    if (printer?.type === 'NETWORK' && printer?.ipAddress) {
      const ok = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
      return res.json({ success: ok, message: ok ? `[${printer.ipAddress}] Ağ yazıcısına test fişi iletildi.` : 'Ağ yazıcısına ulaşılamadı.' });
    }

    const spoolRes = await sendToWindowsSpooler(targetName, buffer);
    res.json({
      success: spoolRes.success,
      message: spoolRes.success ? `[${targetName}] Windows Spooler üzerinden test fişi başarıyla döküldü.` : (spoolRes.error || 'Spooler hatası')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DİREKT MUTFAK FİŞİ GÖNDERME
app.post('/api/printers/print-kitchen', async (req, res) => {
  try {
    const { printer, ticket } = req.body;
    const buffer = generateKitchenReceipt(ticket);
    let success = false;
    if (printer?.type === 'NETWORK' && printer?.ipAddress) {
      success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
    } else {
      const r = await sendToWindowsSpooler(printer?.driverName || printer?.usbName || printer?.name, buffer);
      success = r.success;
    }
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. DİREKT ADİSYON / HESAP FİŞİ GÖNDERME
app.post('/api/printers/print-bill', async (req, res) => {
  try {
    const { printer, bill } = req.body;
    const buffer = generateBillReceipt(bill);
    let success = false;
    if (printer?.type === 'NETWORK' && printer?.ipAddress) {
      success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
    } else {
      const r = await sendToWindowsSpooler(printer?.driverName || printer?.usbName || printer?.name, buffer);
      success = r.success;
    }
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DİREKT İPTAL FİŞİ GÖNDERME
app.post('/api/printers/print-cancel', async (req, res) => {
  try {
    const { printer, cancelData } = req.body;
    const buffer = generateCancelReceipt(cancelData);
    let success = false;
    if (printer?.type === 'NETWORK' && printer?.ipAddress) {
      success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
    } else {
      const r = await sendToWindowsSpooler(printer?.driverName || printer?.usbName || printer?.name, buffer);
      success = r.success;
    }
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. DİREKT PAKET SERVİS & KURYE FİŞİ GÖNDERME
app.post('/api/printers/print-courier', async (req, res) => {
  try {
    const { printer, courierData } = req.body;
    const buffer = generateCourierReceipt(courierData);
    let success = false;
    if (printer?.type === 'NETWORK' && printer?.ipAddress) {
      success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
    } else {
      const r = await sendToWindowsSpooler(printer?.driverName || printer?.usbName || printer?.name, buffer);
      success = r.success;
    }
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 8. GCALLERID 2HAT (GENTEMA) HTTP WEBHOOK & URL YÖNLENDİRME
// ========================================================
// Resmi GCallerID yönlendirmesi veya harici cihazlardan gelen GET/POST istekleri
app.all('/api/callerid', (req, res) => {
  const lineParam = req.query.hat || req.query.line || req.query.h || req.body?.hat || req.body?.line || '1';
  const phoneParam = req.query.telefon || req.query.phone || req.query.tel || req.body?.telefon || req.body?.phone || '';

  console.log(`📡 [GCallerID Webhook Girdi] Line: ${lineParam}, Phone: ${phoneParam}`);
  const event = gCallerIdDriver.handleHttpWebhook(lineParam, phoneParam);

  if (event) {
    res.json({ success: true, message: 'Çağrı sisteme iletildi', event });
  } else {
    res.status(400).json({ 
      success: false, 
      message: 'Geçersiz telefon numarası veya çağrı formatı',
      received: { line: lineParam, phone: phoneParam }
    });
  }
});

// Port listesini döner
app.get('/api/callerid/ports', async (req, res) => {
  try {
    const ports = await gCallerIdDriver.listAvailablePorts();
    res.json({ success: true, ports });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Belirtilen porta bağlanır
app.post('/api/callerid/connect', async (req, res) => {
  const { port } = req.body;
  const result = await gCallerIdDriver.connect(port || 'AUTO');
  res.json(result);
});

// Cihaz durumunu sorgular
app.get('/api/callerid/status', (req, res) => {
  res.json({ success: true, ...gCallerIdDriver.getStatus() });
});

// Test / Simülasyon çağrısı fırlatır (Hat 1 veya Hat 2)
app.post('/api/callerid/simulate', (req, res) => {
  const line = req.body.line === 2 ? 2 : 1;
  const phone = req.body.phone || '05321234567';
  const event = gCallerIdDriver.handleHttpWebhook(line, phone);
  res.json({ success: true, event });
});

export function startLocalServer(port: number = 4545) {
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`📡 Restoran Yerel Sunucusu Calisiyor: http://${getLocalIPAddress()}:${port}`);
    // Otomatik olarak GCallerID portunu dinlemeye başla
    gCallerIdDriver.connect('AUTO').catch(err => {
      console.warn('GCallerID başlangıç bağlantı notu:', err.message);
    });
  });
}
