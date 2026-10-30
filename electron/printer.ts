import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function formatTurkishText(text: string): string {
  if (!text) return '';
  const charMap: { [key: string]: string } = {
    'ğ': 'g', 'Ğ': 'G',
    'ş': 's', 'Ş': 'S',
    'ı': 'i', 'İ': 'I',
    'ç': 'c', 'Ç': 'C',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U'
  };
  return text.split('').map(char => charMap[char] || char).join('');
}

const ESC = '\x1B';
const GS = '\x1D';

export const Commands = {
  INIT: `${ESC}@`,
  SELECT_CP857: `${ESC}t\x12`, // ESC t 18 (CP857 Türkçe kod tablosu)
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_SIZE: `${ESC}!\x30`,
  NORMAL_SIZE: `${ESC}!\x00`,
  BEEP: `${ESC}B\x02\x02`,
  DRAWER_KICK: `${ESC}p\x00\x19\xFA`, // 0x1B 0x70 0x00 0x19 0xFA Para Çekmecesi Açma
  CUT_PAPER: `${GS}V\x41\x03`,
  FULL_CUT: `${GS}V\x00`, // 0x1D 0x56 0x00 Tam Kağıt Kesme
  LINE: '--------------------------------\n',
  DOUBLE_LINE: '================================\n',
};

// 1. ETHERNET IP AĞ YAZICILARI TARAMASI (Port 9100)
export async function scanLocalNetworkPrinters(): Promise<{ ip: string; port: number; status: string; model: string }[]> {
  const interfaces = os.networkInterfaces();
  const baseIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
          if (!baseIps.includes(subnet)) {
            baseIps.push(subnet);
          }
        }
      }
    }
  }

  if (baseIps.length === 0) baseIps.push('192.168.1', '192.168.0');

  const foundPrinters: { ip: string; port: number; status: string; model: string }[] = [];
  const scanPromises: Promise<void>[] = [];

  for (const baseIp of baseIps) {
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${baseIp}.${i}`;
      const p = new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(500);

        socket.connect(9100, targetIp, () => {
          foundPrinters.push({
            ip: targetIp,
            port: 9100,
            status: 'ONLINE',
            model: 'Afanda 892E / Ethernet Ağ Yazıcısı'
          });
          socket.destroy();
          resolve();
        });

        socket.on('error', () => { socket.destroy(); resolve(); });
        socket.on('timeout', () => { socket.destroy(); resolve(); });
      });

      scanPromises.push(p);
    }
  }

  await Promise.all(scanPromises);
  return foundPrinters;
}

// 2. IP ÜZERİNDEN VERİ GÖNDERME
export async function sendToNetworkPrinter(ip: string, port: number = 9100, buffer: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(3500);

    client.connect(port, ip, () => {
      client.write(buffer, () => {
        client.end();
        resolve(true);
      });
    });

    client.on('error', () => { client.destroy(); resolve(false); });
    client.on('timeout', () => { client.destroy(); resolve(false); });
  });
}

// Fiş üretimi tek yerde: electron/receiptBuilder.ts
export {
  generateKitchenReceipt,
  generateBillReceipt,
  generateCancelReceipt,
  generateCourierReceipt,
  generateZReportReceipt,
  generateHardwareTestReceipt,
} from './receiptBuilder';

export async function sendToWindowsSpooler(printerName: string, buffer: Buffer): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    console.log(`[Win32 Spooler Simule Edildi] "${printerName}" yazıcısına ${buffer.length} bayt iletildi.`);
    return { success: true };
  }

  return new Promise((resolve) => {
    try {
      const tempFile = path.join(os.tmpdir(), `gtu_spool_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);
      fs.writeFileSync(tempFile, buffer);

      const targetPrinter = printerName || 'Afanda 892E';

      // Win32 winspool.drv P/Invoke ile RAW byte stream iletimi
      const psScript = `
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, string filePath) {
        if (!File.Exists(filePath)) return false;
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "GTU ESC/POS Raw Receipt";
        di.pDataType = "RAW";
        bool success = false;
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    int written = 0;
                    success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return success;
    }
}
'@
Add-Type -TypeDefinition $code -Language CSharp
$res = [RawPrinterHelper]::SendBytesToPrinter("${targetPrinter.replace(/"/g, '`"')}", "${tempFile.replace(/\\/g, '\\\\')}")
if ($res) { Write-Output "RAW_SUCCESS" } else { Write-Output "RAW_FAILED" }
`;
      const psScriptPath = path.join(os.tmpdir(), `gtu_spool_cmd_${Date.now()}.ps1`);
      fs.writeFileSync(psScriptPath, psScript);

      exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (err, stdout) => {
        try { fs.unlinkSync(tempFile); } catch (e) {}
        try { fs.unlinkSync(psScriptPath); } catch (e) {}

        if (err || !stdout.includes('RAW_SUCCESS')) {
          // Yedekleme (Fallback): cmd copy /b veya Out-Printer pipe
          exec(`cmd /c copy /b "${tempFile}" "\\\\127.0.0.1\\${targetPrinter}"`, (fallbackErr) => {
            if (fallbackErr) {
              resolve({ success: false, error: err?.message || 'Windows Spooler RAW kuyruğuna yazılamadı' });
            } else {
              resolve({ success: true });
            }
          });
        } else {
          resolve({ success: true });
        }
      });
    } catch (e: any) {
      resolve({ success: false, error: e.message });
    }
  });
}

// 10. SİSTEME BAĞLI TÜM WINDOWS / SPOOLER YAZICILARI TARAMA
export async function listSystemPrinters(): Promise<Array<{ name: string; displayName: string; isDefault: boolean; status: string; type: string }>> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      exec('powershell -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json"', (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve([
            { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal)', isDefault: true, status: 'READY', type: 'USB' }
          ]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const result = list.map((p: any) => ({
            name: p.Name || 'Yazıcı',
            displayName: `${p.Name} (${p.DriverName || 'USB POS'})`,
            isDefault: !!p.Default,
            status: 'READY',
            type: 'USB'
          }));
          resolve(result);
        } catch (e) {
          resolve([
            { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal)', isDefault: true, status: 'READY', type: 'USB' }
          ]);
        }
      });
    });
  }

  return [
    { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal Sürücü)', isDefault: true, status: 'READY', type: 'USB' }
  ];
}


