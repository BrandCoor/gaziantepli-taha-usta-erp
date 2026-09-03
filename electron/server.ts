import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as os from 'os';
import {
  generateKitchenReceipt,
  generateBillReceipt,
  generateZReportReceipt,
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

export function startLocalServer(port: number = 4545) {
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`📡 Restoran Yerel Sunucusu Calisiyor: http://${getLocalIPAddress()}:${port}`);
  });
}
