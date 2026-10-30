/**
 * ESC/POS grafik (raster) kodlayıcı — saf Node, Electron'a bağımlı değil (test edilebilir).
 * Görüntüyü 1 bitlik siyah-beyaza çevirir ve `GS v 0` komutlarıyla bantlar halinde yazıcıya gönderilecek bayt dizisini üretir.
 */
const ESC = 0x1b, GS = 0x1d;

export interface RasterOptions {
  /** 0-255; bundan KOYU pikseller siyah olur. Termal yazıcıda ince çizgiler solduğu için orta-yüksek değer kullanılır. */
  threshold?: number;
  /** Bir bant en çok kaç satır (bazı ucuz yazıcılar çok yüksek tek komutta takılır). */
  bandRows?: number;
  autoCut?: boolean;
  beep?: boolean;
}

/** bgra: 4 bayt/piksel (Electron NativeImage.toBitmap, Windows'ta BGRA). */
export function monoRows(bgra: Uint8Array, width: number, height: number, threshold = 165): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = bgra[i + 3];
      // Saydam piksel = kâğıt (beyaz)
      const lum = a === 0 ? 255 : (0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]) * (a / 255) + 255 * (1 - a / 255);
      if (lum < threshold) out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return out;
}

export function encodeRaster(bgra: Uint8Array, width: number, height: number, opt: RasterOptions = {}): Buffer {
  const rowBytes = Math.ceil(width / 8);
  const mono = monoRows(bgra, width, height, opt.threshold ?? 165);
  const band = Math.max(8, opt.bandRows ?? 192);
  const parts: Buffer[] = [Buffer.from([ESC, 0x40])]; // ESC @ (başlat)
  if (opt.beep) parts.push(Buffer.from([ESC, 0x42, 2, 2]));
  for (let y = 0; y < height; y += band) {
    const rows = Math.min(band, height - y);
    // GS v 0 m xL xH yL yH d1...dk  (m=0: normal yoğunluk)
    parts.push(Buffer.from([GS, 0x76, 0x30, 0x00, rowBytes & 0xff, (rowBytes >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff]));
    parts.push(Buffer.from(mono.subarray(y * rowBytes, (y + rows) * rowBytes)));
  }
  parts.push(Buffer.from([ESC, 0x64, 5])); // 5 satır besle
  if (opt.autoCut !== false) parts.push(Buffer.from([GS, 0x56, 0x42, 0x00])); // kısmi kesim
  return Buffer.concat(parts);
}
