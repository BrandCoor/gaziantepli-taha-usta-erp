import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import * as os from 'os';
import {
  generateKitchenReceipt,
  generateBillReceipt,
  sendToNetworkPrinter,
  scanLocalNetworkPrinters
} from './printer';

const prisma = new PrismaClient();
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

export function broadcastEvent(eventName: string, payload: any) {
  const message = JSON.stringify({ event: eventName, data: payload });
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

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

// 1. Ağdaki Yazıcıları Otomatik Bul
app.get('/api/printers/auto-scan', async (req, res) => {
  try {
    const found = await scanLocalNetworkPrinters();
    res.json({ success: true, printers: found });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Yazıcı Test Fişi Bas
app.post('/api/printers/test-print', async (req, res) => {
  try {
    const { ip, port, name } = req.body;
    const testBuffer = generateKitchenReceipt({
      printerIp: ip,
      ticketTitle: 'YAZICI BAGLANTI TESTI',
      orderNumber: 999,
      tableName: 'TEST MASASI',
      sectionName: 'SISTEM KONTROL',
      waiterName: 'Sistem Yoneticisi',
      orderTime: new Date().toLocaleTimeString('tr-TR'),
      items: [{ name: 'Test Kalemi 1 (Afanda 892E)', quantity: 1, note: 'Baglanti basarili!' }],
    });

    const success = await sendToNetworkPrinter(ip, port || 9100, testBuffer);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Garson 1 Kere Eşleme & Kalıcı Cihaz Tanıma
app.post('/api/waiter/register-device', async (req, res) => {
  try {
    const { qrToken, deviceFingerprint, deviceName } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { qrToken, isActive: true },
    });

    if (!employee) {
      return res.status(401).json({ success: false, message: 'Geçersiz QR Kod veya yetkisiz personel!' });
    }

    // Cihazı kalıcı kaydet
    await prisma.devicePairing.upsert({
      where: { deviceFingerprint },
      update: { employeeId: employee.id, deviceName: deviceName || 'Garson Telefonu', isApproved: true, lastSeenAt: new Date() },
      create: { employeeId: employee.id, deviceFingerprint, deviceName: deviceName || 'Garson Telefonu', isApproved: true },
    });

    res.json({
      success: true,
      waiter: {
        id: employee.id,
        fullName: employee.fullName,
        role: employee.role,
        pinCode: employee.pinCode,
      },
      message: 'Cihaz başarıyla kalıcı olarak eşleştirildi!',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Garson PIN ile Hızlı Giriş (Artık QR gerekmez)
app.post('/api/waiter/pin-login', async (req, res) => {
  try {
    const { deviceFingerprint, pinCode } = req.body;

    const pairing = await prisma.devicePairing.findUnique({
      where: { deviceFingerprint },
      include: { employee: true },
    });

    if (!pairing || !pairing.isApproved || !pairing.employee.isActive) {
      return res.status(401).json({ success: false, message: 'Bu cihazın yetkisi iptal edilmiş veya eşleşmemiş!' });
    }

    if (pairing.employee.pinCode !== pinCode) {
      return res.status(400).json({ success: false, message: 'Hatalı PIN Kodu!' });
    }

    await prisma.devicePairing.update({
      where: { id: pairing.id },
      data: { lastSeenAt: new Date() },
    });

    res.json({
      success: true,
      waiter: {
        id: pairing.employee.id,
        fullName: pairing.employee.fullName,
        role: pairing.employee.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function startLocalServer(port: number = 4545) {
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`📡 Restoran Yerel Sunucusu Calisiyor: http://${getLocalIPAddress()}:${port}`);
  });
}
