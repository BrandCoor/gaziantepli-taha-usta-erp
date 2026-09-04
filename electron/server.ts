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
  sendToNetworkPrinter,
  scanLocalNetworkPrinters
} from './printer';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const activeClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  activeClients.add(ws);
  ws.on('close', () => activeClients.delete(ws));
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

    let buffer: Buffer;
    if (jobType === 'BILL') {
      buffer = generateBillReceipt(data);
    } else if (jobType === 'CANCEL') {
      buffer = generateCancelReceipt(data);
    } else if (jobType === 'Z_REPORT') {
      buffer = generateZReportReceipt(data);
    } else {
      buffer = generateKitchenReceipt(data);
    }

    if (printer.type === 'NETWORK' && printer.ipAddress) {
      const success = await sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
      return res.json({ success, message: success ? 'Yazıcıya iletildi' : 'Yazıcıya bağlanılamadı' });
    }

    // USB / Diğer yazıcılar
    res.json({ success: true, message: 'İstek işlendi' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    }
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export function startLocalServer(port: number = 4545) {
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`📡 Restoran Yerel Sunucusu Calisiyor: http://${getLocalIPAddress()}:${port}`);
  });
}
