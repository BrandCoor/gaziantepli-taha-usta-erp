import { APP_VERSION, MIN_API_VERSION } from './appVersion';

export interface ApiVersionInfo {
  apiVersion: string;
  schemaVersion: number;
  minKasaVersion: string;
  minGarsonVersion: string;
}
export type CompatResult =
  | { status: 'ok'; info: ApiVersionInfo }
  | { status: 'client-too-old' | 'api-too-old' | 'unknown'; message: string; info?: ApiVersionInfo };

const cmp = (a: string, b: string): number => {
  const p = (v: string) => (v.match(/\d+/g) || []).slice(0, 3).map(Number);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
};

/** Kasa ↔ API sürüm uyumu. Sunucuya ulaşılamazsa 'unknown' (uyumsuzluk iddia edilmez). */
export async function checkApiCompat(apiUrl: string): Promise<CompatResult> {
  if (!apiUrl) return { status: 'unknown', message: 'Sunucu adresi ayarlanmamış.' };
  try {
    const res = await fetch(`${apiUrl}?action=version`, { headers: { Accept: 'application/json' } });
    const j = await res.json();
    if (!j?.success || !j.apiVersion) return { status: 'unknown', message: 'Sunucu sürüm bilgisi vermiyor (eski sunucu olabilir). Sunucuyu güncelleyin.' };
    const info: ApiVersionInfo = { apiVersion: j.apiVersion, schemaVersion: Number(j.schemaVersion) || 0, minKasaVersion: j.minKasaVersion || '0.0.0', minGarsonVersion: j.minGarsonVersion || '0.0.0' };
    if (cmp(APP_VERSION, info.minKasaVersion) < 0) {
      return { status: 'client-too-old', info, message: `Bu kasa sürümü (${APP_VERSION}) sunucunun desteklediği en eski sürümden (${info.minKasaVersion}) eski. Önce kasa uygulamasını güncelleyin.` };
    }
    if (cmp(info.apiVersion, MIN_API_VERSION) < 0) {
      return { status: 'api-too-old', info, message: `Sunucu sürümü (${info.apiVersion}) bu kasa için eski (en az ${MIN_API_VERSION} gerekir). Sunucu dosyalarını güncelleyin.` };
    }
    return { status: 'ok', info };
  } catch (e: any) {
    return { status: 'unknown', message: 'Sunucu sürümü okunamadı: ' + (e?.message || 'bağlantı hatası') };
  }
}
